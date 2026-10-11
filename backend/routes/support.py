"""Built-in online support chat.

Thread key = order_no. Anonymous payer (checkout page, no auth) <-> support
agents (admin / operators holding the ``support.manage`` seat permission).
Realtime via client polling. Threads carry open/resolved status; payers may
attach a (client-compressed) transfer screenshot; a Telegram ping fires when a
new customer conversation needs attention.
"""
import asyncio
from bson import ObjectId
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from core import db
from utils import iso, now_utc
from deps import require_roles
from shared import audit, send_telegram

router = APIRouter(prefix="/api")

MAX_LEN = 2000
MAX_IMG = 3_600_000  # base64 data-URL cap (~2.6MB binary)
DEFAULT_TEMPLATES = [
    "您好，请提供您的转账哈希（TxID），我们帮您核实。",
    "已收到，正在为您查询，请稍候。",
    "您的订单已成功到账，感谢您的支付。",
    "金额与订单不一致，请核对实际到账金额后告知我们。",
    "请提供转账截图，方便我们快速处理。",
]


class SupportMessageIn(BaseModel):
    text: str = ""
    image: Optional[str] = None


class ThreadStatusIn(BaseModel):
    status: str


class TemplatesIn(BaseModel):
    templates: List[str]


def _msg_view(m: dict) -> dict:
    return {"id": str(m["_id"]), "sender": m["sender"], "sender_name": m.get("sender_name", ""),
            "text": m.get("text", ""), "image": m.get("image"), "created_at": m["created_at"]}


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


def _clean_image(img: Optional[str]) -> Optional[str]:
    if not img:
        return None
    if not img.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="图片格式无效")
    if len(img) > MAX_IMG:
        raise HTTPException(status_code=400, detail="图片过大，请压缩后重试")
    return img


async def _touch_thread(order: dict, text: str, sender: str, reopen: bool):
    now = iso(now_utc())
    upd = {"$set": {"merchant_id": order.get("merchant_id"), "merchant_name": order["merchant_name"],
                    "last_text": text or "[图片]", "last_sender": sender, "last_at": now},
           "$setOnInsert": {"created_at": now, "status": "open"}}
    if reopen:
        upd["$set"]["status"] = "open"
    await db.support_threads.update_one({"_id": order["order_no"]}, upd, upsert=True)


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
    image = _clean_image(data.image)
    if not text and not image:
        raise HTTPException(status_code=400, detail="消息不能为空")
    prior_unread = await db.support_messages.count_documents(
        {"order_no": order_no, "sender": "customer", "read_agent": False})
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "customer", "sender_name": "访客", "text": text, "image": image,
           "created_at": iso(now_utc()), "read_agent": False, "read_customer": True}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _touch_thread(o, text, "customer", reopen=True)
    if prior_unread == 0:  # one ping per fresh conversation burst
        snippet = (text or "[图片]")[:80]
        asyncio.create_task(send_telegram(
            f"💬 <b>新的客服咨询</b>\n商户：{o['merchant_name']}\n订单：{order_no}\n内容：{snippet}\n请到后台「在线客服」及时回复", "support"))
    return _msg_view(doc)


# ---------------- Agent side (admin / support seat) ----------------
@router.get("/support/unread-count")
async def support_unread(user: dict = Depends(require_roles("admin", "operator"))):
    n = await db.support_messages.count_documents({"sender": "customer", "read_agent": False})
    threads = await db.support_messages.distinct("order_no", {"sender": "customer", "read_agent": False})
    return {"unread": n, "threads": len(threads)}


@router.get("/support/templates")
async def get_templates(user: dict = Depends(require_roles("admin", "operator"))):
    doc = await db.settings.find_one({"_id": "support"}) or {}
    return {"templates": doc.get("templates", DEFAULT_TEMPLATES)}


@router.put("/support/templates")
async def put_templates(data: TemplatesIn, request: Request, user: dict = Depends(require_roles("admin"))):
    tpls = [t.strip()[:300] for t in data.templates if t.strip()][:30]
    await db.settings.update_one({"_id": "support"}, {"$set": {"templates": tpls}}, upsert=True)
    await audit(user, "support.templates", "settings", "support", {"count": len(tpls)}, request)
    return {"templates": tpls}


@router.get("/support/threads")
async def support_threads(status: str = Query("all"), user: dict = Depends(require_roles("admin", "operator"))):
    q = {}
    if status in ("open", "resolved"):
        q["status"] = status
    rows = await db.support_threads.find(q).sort("last_at", -1).limit(500).to_list(500)
    agg = await db.support_messages.aggregate([
        {"$match": {"sender": "customer", "read_agent": False}},
        {"$group": {"_id": "$order_no", "n": {"$sum": 1}}}]).to_list(1000)
    unread_map = {a["_id"]: a["n"] for a in agg}
    return [{"order_no": r["_id"], "merchant_name": r.get("merchant_name", ""), "last_text": r.get("last_text", ""),
             "last_sender": r.get("last_sender", ""), "last_at": r.get("last_at"),
             "status": r.get("status", "open"), "unread": unread_map.get(r["_id"], 0)} for r in rows]


@router.get("/support/threads/{order_no}")
async def support_thread_get(order_no: str, user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(1000)
    await db.support_messages.update_many(
        {"order_no": order_no, "sender": "customer", "read_agent": False}, {"$set": {"read_agent": True}})
    return {"order_no": order_no, "merchant_name": o["merchant_name"], "order_status": o["status"],
            "status": th.get("status", "open"), "amount_usdt": o["amount_usdt"], "pay_amount": o.get("pay_amount"),
            "wallet_address": o["wallet_address"], "network": o["network"], "created_at": o["created_at"],
            "expires_at": o.get("expires_at"), "tx_id": o.get("tx_id"), "out_trade_no": o.get("out_trade_no"),
            "messages": [_msg_view(m) for m in msgs]}


@router.post("/support/threads/{order_no}")
async def support_thread_post(order_no: str, data: SupportMessageIn, request: Request,
                              user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    text = (data.text or "").strip()[:MAX_LEN]
    image = _clean_image(data.image)
    if not text and not image:
        raise HTTPException(status_code=400, detail="消息不能为空")
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "agent", "sender_name": user.get("name") or "客服", "text": text, "image": image,
           "created_at": iso(now_utc()), "read_agent": True, "read_customer": False}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _touch_thread(o, text, "agent", reopen=False)
    return _msg_view(doc)


@router.patch("/support/threads/{order_no}/status")
async def set_thread_status(order_no: str, data: ThreadStatusIn, request: Request,
                            user: dict = Depends(require_roles("admin", "operator"))):
    if data.status not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="状态无效")
    o = await _get_order(order_no)
    await db.support_threads.update_one(
        {"_id": order_no},
        {"$set": {"status": data.status, "merchant_name": o["merchant_name"], "last_at": iso(now_utc())}}, upsert=True)
    await audit(user, "support.status", "support_thread", order_no, {"status": data.status}, request)
    return {"ok": True, "status": data.status}


# ---------------- Per-merchant support config (admin) ----------------
class SupportConfigIn(BaseModel):
    support_enabled: bool = True
    support_welcome: str = ""


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
