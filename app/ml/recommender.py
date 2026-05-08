"""
Cart-based recommender on top of trained item embeddings (TruncatedSVD).

Training still uses orders from MongoDB to learn item embeddings.
Inference does NOT require the user to be present in the training set:
recommendations are built from the current cart only.
"""

import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD

MODELPATH = Path(__file__).parent.parent.parent / "cart_recsys_model.pkl"


class RecSysModel:
    instance: Optional["RecSysModel"] = None

    def __init__(self):
        self.user_embeddings: Optional[np.ndarray] = None
        self.item_embeddings: Optional[np.ndarray] = None
        self.user_list: list[str] = []
        self.item_list: list[str] = []
        self.user_history: dict[str, set[str]] = {}
        self.ready = False

    @classmethod
    def get(cls) -> "RecSysModel":
        if cls.instance is None:
            cls.instance = RecSysModel()
        return cls.instance

    @classmethod
    def load(cls):
        inst = cls.get()
        if MODELPATH.exists():
            with open(MODELPATH, "rb") as f:
                arts = pickle.load(f)

            inst.user_embeddings = arts["user_embeddings"]
            inst.item_embeddings = arts["item_embeddings"]
            inst.user_list = arts["user_list"]
            inst.item_list = arts["item_list"]
            inst.user_history = arts.get("user_history", {})
            inst.ready = True
            print(f"[RecSys] loaded from {MODELPATH}")
        else:
            print("[RecSys] model file not found — call /api/v1/recommendations/train first")

    async def train_from_db(self):
        from app.db.mongodb import orderscol

        cursor = orderscol.find({}, {"userid": 1, "products": 1})
        rows = []

        async for doc in cursor:
            uid = str(doc["userid"])
            for p in doc.get("products", []):
                rows.append(
                    {
                        "userid": uid,
                        "productid": str(p["productid"]),
                        "quantity": float(p.get("quantity", 1)),
                    }
                )

        if not rows:
            raise RuntimeError("No orders found in DB for training")

        df = pd.DataFrame(rows)
        agg = df.groupby(["userid", "productid"], as_index=False)["quantity"].sum()

        self.user_history = (
            agg.groupby("userid")["productid"].apply(lambda s: set(map(str, s))).to_dict()
        )

        user_cat = agg["userid"].astype("category")
        item_cat = agg["productid"].astype("category")

        mat = csr_matrix(
            (agg["quantity"].astype(float), (user_cat.cat.codes, item_cat.cat.codes))
        )

        self.user_list = list(map(str, user_cat.cat.categories.tolist()))
        self.item_list = list(map(str, item_cat.cat.categories.tolist()))

        n_users, n_items = mat.shape
        n_components = max(1, min(50, n_users - 1, n_items - 1))

        svd = TruncatedSVD(n_components=n_components, n_iter=15, random_state=42)
        self.user_embeddings = svd.fit_transform(mat)
        self.item_embeddings = svd.components_.T

        self.ready = True

        arts = {
            "user_embeddings": self.user_embeddings,
            "item_embeddings": self.item_embeddings,
            "user_list": self.user_list,
            "item_list": self.item_list,
            "user_history": self.user_history,
        }

        with open(MODELPATH, "wb") as f:
            pickle.dump(arts, f)

        print(f"[RecSys] trained & saved — {len(self.user_list)} users, {len(self.item_list)} items")

    def recommend(
        self,
        cart_product_ids: list[str] | None,
        topn: int = 10,
    ) -> tuple[list[tuple[str, float]], bool]:
        """
        Returns: ([(product_id, score), ...], is_fallback)

        Main mode:
        - Build a pseudo-user vector from current cart items using learned item embeddings.
        - Score all items by similarity to that pseudo-user vector.

        Fallback:
        - If cart is empty or none of its items are known to the model,
          return globally popular items from embedding magnitude.
        """
        if not self.ready or self.item_embeddings is None or not self.item_list:
            return [], True

        cart_product_ids = [str(pid) for pid in (cart_product_ids or [])]
        cart_set = set(cart_product_ids)

        known_idxs = [
            self.item_list.index(pid)
            for pid in cart_product_ids
            if pid in self.item_list
        ]

        if known_idxs:
            pseudo_user = self.item_embeddings[known_idxs].mean(axis=0)
            scores = self.item_embeddings.dot(pseudo_user)
            is_fallback = False
        else:
            scores = np.linalg.norm(self.item_embeddings, axis=1)
            is_fallback = True

        sorted_idxs = np.argsort(scores)[::-1]

        recs: list[tuple[str, float]] = []
        for idx in sorted_idxs:
            pid = self.item_list[idx]
            if pid in cart_set:
                continue
            recs.append((pid, float(scores[idx])))
            if len(recs) >= topn:
                break

        return recs, is_fallback