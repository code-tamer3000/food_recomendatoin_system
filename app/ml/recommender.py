"""
SVD-based collaborative filtering (TruncatedSVD).
Модель тренируется из orders в MongoDB при первом вызове
или загружается из recsys_model.pkl если файл существует.
"""
import pickle, asyncio
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD

MODEL_PATH = Path(__file__).parent.parent.parent / "recsys_model.pkl"


class RecSysModel:
    _instance: Optional["RecSysModel"] = None

    def __init__(self):
        self.user_embeddings: Optional[np.ndarray] = None
        self.item_embeddings: Optional[np.ndarray] = None
        self.user_list: list = []
        self.item_list: list = []
        self.user_history: dict = {}
        self.ready = False

    @classmethod
    def get(cls) -> "RecSysModel":
        if cls._instance is None:
            cls._instance = RecSysModel()
        return cls._instance

    @classmethod
    def load(cls):
        inst = cls.get()
        if MODEL_PATH.exists():
            with open(MODEL_PATH, "rb") as f:
                arts = pickle.load(f)
            inst.user_embeddings = arts["user_embeddings"]
            inst.item_embeddings = arts["item_embeddings"]
            inst.user_list = arts["user_list"]
            inst.item_list = arts["item_list"]
            inst.user_history = arts["user_history"]
            inst.ready = True
            print(f"[RecSys] loaded from {MODEL_PATH}")
        else:
            print("[RecSys] model file not found — call /api/v1/recommendations/train first")

    async def train_from_db(self):
        """Train model on orders stored in MongoDB, then save pkl."""
        from app.db.mongodb import orders_col
        cursor = orders_col().find({}, {"user_id": 1, "products": 1})
        rows = []
        async for doc in cursor:
            uid = str(doc["user_id"])
            for p in doc.get("products", []):
                rows.append({
                    "user_id": uid,
                    "product_id": str(p["product_id"]),
                    "quantity": float(p.get("quantity", 1)),
                })
        if not rows:
            raise RuntimeError("No orders found in DB for training")

        df = pd.DataFrame(rows)
        agg = df.groupby(["user_id", "product_id"])["quantity"].sum().reset_index()

        # history dict for cold-start filtering
        self.user_history = (
            df.groupby("user_id")["product_id"].apply(set).to_dict()
        )

        user_cat = agg["user_id"].astype("category")
        item_cat = agg["product_id"].astype("category")

        mat = csr_matrix((
            agg["quantity"].astype(float),
            (user_cat.cat.codes, item_cat.cat.codes),
        ))

        self.user_list = user_cat.cat.categories.tolist()
        self.item_list = item_cat.cat.categories.tolist()

        svd = TruncatedSVD(n_components=50, n_iter=15, random_state=42)
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
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(arts, f)
        print(f"[RecSys] trained & saved — {len(self.user_list)} users, {len(self.item_list)} items")

    def recommend(self, user_id: str, top_n: int = 10) -> tuple[list[tuple[str, float]], bool]:
        """
        Returns ([(product_id, score), ...], is_cold_start).
        If user not in training data → popular items fallback.
        """
        if not self.ready:
            return [], True

        if user_id not in self.user_list:
            # Cold start: return top-N most popular items overall
            scores = self.item_embeddings.sum(axis=1)
            best = np.argsort(scores)[::-1][:top_n]
            return [(self.item_list[i], float(scores[i])) for i in best], True

        u_idx = self.user_list.index(user_id)
        scores = self.user_embeddings[u_idx].dot(self.item_embeddings.T)
        sorted_idx = np.argsort(scores)[::-1]
        already = self.user_history.get(user_id, set())
        recs = []
        for idx in sorted_idx:
            pid = self.item_list[idx]
            if pid not in already:
                recs.append((pid, float(scores[idx])))
            if len(recs) == top_n:
                break
        return recs, False