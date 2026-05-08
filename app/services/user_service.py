from datetime import datetime
from bson import ObjectId

from app.db.mongodb import users_col
from app.schemas.user import (
    UserPublic, UserUpdateRequest,
    AddressAddRequest, CartAddRequest, CartUpdateRequest, CartResponse
)
from app.models.user import CartItem


def _to_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        username=doc["username"],
        email=doc["email"],
        full_name=doc.get("full_name"),
        phone=doc.get("phone"),
        avatar_url=doc.get("avatar_url"),
        addresses=doc.get("addresses", []),
        persona=doc.get("persona"),
        cart_count=len(doc.get("cart", [])),
        is_admin=doc.get("is_admin", False),
    )


async def get_profile(user_id: str) -> UserPublic:
    doc = await users_col().find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise ValueError("User not found")
    return _to_public(doc)


async def update_profile(user_id: str, data: UserUpdateRequest) -> UserPublic:
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.utcnow()
    doc = await users_col().find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
        return_document=True,
    )
    return _to_public(doc)


async def add_address(user_id: str, addr: AddressAddRequest) -> UserPublic:
    doc = await users_col().find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$push": {"addresses": addr.model_dump()}, "$set": {"updated_at": datetime.utcnow()}},
        return_document=True,
    )
    return _to_public(doc)


async def delete_address(user_id: str, index: int) -> UserPublic:
    doc = await users_col().find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise ValueError("User not found")
    addresses = doc.get("addresses", [])
    if index < 0 or index >= len(addresses):
        raise ValueError("Address index out of range")
    addresses.pop(index)
    doc = await users_col().find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": {"addresses": addresses, "updated_at": datetime.utcnow()}},
        return_document=True,
    )
    return _to_public(doc)


# ---- Cart CRUD ----

async def get_cart(user_id: str) -> CartResponse:
    doc = await users_col().find_one({"_id": ObjectId(user_id)}, {"cart": 1})
    items = [CartItem(**i) for i in doc.get("cart", [])]
    return CartResponse(
        items=items,
        total=round(sum(i.price * i.quantity for i in items), 2),
        count=sum(i.quantity for i in items),
    )


async def add_to_cart(user_id: str, req: CartAddRequest) -> CartResponse:
    doc = await users_col().find_one({"_id": ObjectId(user_id)}, {"cart": 1})
    cart = doc.get("cart", [])

    # If same product+modification already in cart — increment qty
    for item in cart:
        if item["product_id"] == req.product_id and item.get("modification_id") == req.modification_id:
            item["quantity"] += req.quantity
            break
    else:
        cart.append(req.model_dump())

    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"cart": cart, "updated_at": datetime.utcnow()}},
    )
    items = [CartItem(**i) for i in cart]
    return CartResponse(
        items=items,
        total=round(sum(i.price * i.quantity for i in items), 2),
        count=sum(i.quantity for i in items),
    )


async def update_cart_item(user_id: str, req: CartUpdateRequest) -> CartResponse:
    doc = await users_col().find_one({"_id": ObjectId(user_id)}, {"cart": 1})
    cart = doc.get("cart", [])

    if req.quantity <= 0:
        cart = [
            i for i in cart
            if not (i["product_id"] == req.product_id and i.get("modification_id") == req.modification_id)
        ]
    else:
        for item in cart:
            if item["product_id"] == req.product_id and item.get("modification_id") == req.modification_id:
                item["quantity"] = req.quantity
                break

    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"cart": cart, "updated_at": datetime.utcnow()}},
    )
    items = [CartItem(**i) for i in cart]
    return CartResponse(
        items=items,
        total=round(sum(i.price * i.quantity for i in items), 2),
        count=sum(i.quantity for i in items),
    )


async def clear_cart(user_id: str) -> CartResponse:
    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"cart": [], "updated_at": datetime.utcnow()}},
    )
    return CartResponse(items=[], total=0.0, count=0)