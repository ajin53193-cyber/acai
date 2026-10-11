"""Built-in online support chat.

Thread key = order_no. Anonymous payer (on the checkout page, no auth) talks to
admin/operator agents (in the dashboard). Realtime via lightweight client
polling (WebSockets are unreliable through the ingress; the checkout already
polls). Per-merchant config: support_enabled + support_welcome.
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel

from core import db
from utils import iso, now_utc
from deps import require_roles
from shared import audit

router = APIRouter(prefix="/api")

MAX_LEN = 2000


class SupportMessageIn(BaseModel):
    text: str


class SupportConfigIn(BaseModel):
    support_enabled: bool = True
    support_welcome: str = ""


def _msg_view(m: dict) -> dict:
    return {"id": str(m["_id"]), "sender": m["sender"], "sender_name": m.get("sender_name", ""),
            "text": m["text"], "created_at": m["created_at"]}


async def _get_order(order_no: str) -> dict:
    o = await db.orders.find_one({"order_no": order_no})
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    return o


async def _merchant_of(order: dict):
    if not order.get("merchant_id"):
        return None
    try:
        return await db.users.find_one({"_id": ObjectId(order["merchant_id"])})
    except Exception:
        return None


# ---------------- Payer side (public, no auth) ----------------
@router.get("/support/public/{order_no}")
async def support_public_get(order_no: str):
    o = await _get_order(order_no)
    merchant = await _merchant_of(o)
    enabled = True if merchant is None else merchant.get("support_enabled", True)
    welcome = (merchant or {}).get("support_welcome") or ""
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(500)
    await db.support_messages.update_many(
        {"order_no": order_no, "sender": "agent", "read_customer": False}, {"$set": {"read_customer": True}})
    return {"enabled": enabled, "welcome": welcome, "merchant_name": o["merchant_name"],
            "order_status": o["status"], "messages": [_msg_view(m) for m in msgs]}


@router.post("/support/public/{order_no}")
async def support_public_post(order_no: str, data: SupportMessageIn):
    o = await _get_order(order_no)
    merchant = await _merchant_of(o)
    if merchant is not None and not merchant.get("support_enabled", True):
        raise HTTPException(status_code=403, detail="该商户未开启在线客服")
    text = (data.text or "").strip()[:MAX_LEN]
    if not text:
        raise HTTPException(status_code=400, detail="消息不能为空")
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "customer", "sender_name": "访客", "text": text,
           "created_at": iso(now_utc()), "read_agent": False, "read_customer": True}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _msg_view(doc)


# ---------------- Agent side (admin / operator) ----------------
@router.get("/support/unread-count")
async def support_unread(user: dict = Depends(require_roles("admin", "operator"))):
    n = await db.support_messages.count_documents({"sender": "customer", "read_agent": False})
    threads = await db.support_messages.distinct("order_no", {"sender": "customer", "read_agent": False})
    return {"unread": n, "threads": len(threads)}


@router.get("/support/threads")
async def support_threads(user: dict = Depends(require_roles("admin", "operator"))):
    pipeline = [
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$order_no",
                    "merchant_name": {"$last": "$merchant_name"},
                    "last_text": {"$last": "$text"},
                    "last_sender": {"$last": "$sender"},
                    "last_at": {"$last": "$created_at"},
                    "total": {"$sum": 1},
                    "unread": {"$sum": {"$cond": [
                        {"$and": [{"$eq": ["$sender", "customer"]}, {"$eq": ["$read_agent", False]}]}, 1, 0]}}}},
        {"$sort": {"last_at": -1}},
        {"$limit": 500},
    ]
    rows = await db.support_messages.aggregate(pipeline).to_list(500)
    return [{"order_no": r["_id"], "merchant_name": r.get("merchant_name", ""), "last_text": r["last_text"],
             "last_sender": r["last_sender"], "last_at": r["last_at"], "total": r["total"], "unread": r["unread"]}
            for r in rows]


@router.get("/support/threads/{order_no}")
async def support_thread_get(order_no: str, user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(1000)
    await db.support_messages.update_many(
        {"order_no": order_no, "sender": "customer", "read_agent": False}, {"$set": {"read_agent": True}})
    return {"order_no": order_no, "merchant_name": o["merchant_name"], "order_status": o["status"],
            "amount_usdt": o["amount_usdt"], "pay_amount": o.get("pay_amount"),
            "wallet_address": o["wallet_address"], "messages": [_msg_view(m) for m in msgs]}


@router.post("/support/threads/{order_no}")
async def support_thread_post(order_no: str, data: SupportMessageIn, request: Request,
                              user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    text = (data.text or "").strip()[:MAX_LEN]
    if not text:
        raise HTTPException(status_code=400, detail="消息不能为空")
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "agent", "sender_name": user.get("name") or "客服", "text": text,
           "created_at": iso(now_utc()), "read_agent": True, "read_customer": False}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _msg_view(doc)


# ---------------- Per-merchant support config (admin) ----------------
@router.patch("/accounts/{account_id}/support")
async def set_support_config(account_id: str, data: SupportConfigIn, request: Request,
                             user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc or acc["role"] != "merchant":
        raise HTTPException(status_code=404, detail="商户不存在")
    upd = {"support_enabled": data.support_enabled, "support_welcome": (data.support_welcome or "").strip()[:500]}
    await db.users.update_one({"_id": acc["_id"]}, {"$set": upd})
    await audit(user, "merchant.support_config", "user", account_id, upd, request)
    return {"ok": True, **upd}
