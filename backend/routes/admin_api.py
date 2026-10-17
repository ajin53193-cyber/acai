"""Platform Admin Open API (server-to-server).

For an external multi-platform admin/aggregator system to pull & manage this
platform's data (orders, support, accounts, stats) using a single API key.

Auth: header ``X-Api-Key: <key>`` over HTTPS. The key is generated/rotated by a
platform admin (JWT) via /api/admin-api/key/rotate; only its SHA-256 hash is
stored (in db.settings, _id='admin_api'). Optional IP allowlist.
"""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query, HTTPException, Header
from pydantic import BaseModel

from core import db
from utils import iso, now_utc, client_ip, bj_day_bounds, bj_str
from deps import require_roles
from routes.support import _touch_thread, _store_image, _get_order
from models import BalanceAdjust, CheckoutSettings
from routes.orders import manual_callback as _manual_callback, ManualCallbackIn
from routes.settlements import approve_payout as _approve_payout, reject_payout as _reject_payout
from server import (adjust_balance as _adjust_balance, toggle_status as _toggle_status,
                    put_checkout_settings as _put_checkout_settings, DEFAULT_CHECKOUT_SETTINGS)

# Synthetic actor used for audit/ledger when actions come in via the Admin API key.
SYS_ACTOR = {"_id": "admin-api", "email": "admin-api", "role": "admin", "name": "平台管理API"}

router = APIRouter(prefix="/api/admin-api", tags=["admin-api"])

SETTINGS_ID = "admin_api"


def _hash_key(k: str) -> str:
    return hashlib.sha256(k.strip().encode()).hexdigest()


def _platform_name() -> str:
    return os.environ.get("EMAIL_FROM_NAME") or "四方收款平台"


async def require_admin_api(request: Request, x_api_key: Optional[str] = Header(None)):
    cfg = await db.settings.find_one({"_id": SETTINGS_ID})
    if not cfg or not cfg.get("key_hash"):
        raise HTTPException(status_code=401, detail="平台管理 API 未启用，请管理员先生成 API Key")
    if not x_api_key:
        raise HTTPException(status_code=401, detail="缺少 X-Api-Key 请求头")
    if not hmac.compare_digest(_hash_key(x_api_key), cfg["key_hash"]):
        raise HTTPException(status_code=401, detail="X-Api-Key 无效")
    wl = cfg.get("ip_whitelist") or []
    ip = client_ip(request)
    if wl and ip not in wl:
        raise HTTPException(status_code=403, detail=f"来源 IP {ip} 不在白名单内")
    return cfg


def _order_view(o: dict) -> dict:
    return {
        "order_no": o["order_no"], "out_trade_no": o.get("out_trade_no"),
        "merchant_id": o.get("merchant_id"), "merchant_name": o.get("merchant_name"),
        "amount_usdt": o["amount_usdt"], "pay_amount": o.get("pay_amount", o["amount_usdt"]),
        "network": o["network"], "wallet_address": o.get("wallet_address"),
        "status": o["status"], "tx_id": o.get("tx_id"),
        "manual_confirmed": bool(o.get("manual_confirmed")),
        "remark": o.get("remark"), "live": bool(o.get("live")),
        "created_at": o.get("created_at"), "created_at_bj": bj_str(o.get("created_at"), "%Y-%m-%d %H:%M:%S"),
        "paid_at": o.get("paid_at"), "paid_at_bj": bj_str(o.get("paid_at"), "%Y-%m-%d %H:%M:%S"),
        "expires_at": o.get("expires_at"),
    }


# ---------------------------------------------------------------------------
# Key management (platform admin, JWT) — how you obtain/rotate the API key
# ---------------------------------------------------------------------------
class IpWhitelistIn(BaseModel):
    ips: list[str] = []


@router.post("/key/rotate")
async def rotate_key(user: dict = Depends(require_roles("admin"))):
    key = "ak_" + secrets.token_hex(24)
    cfg = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    await db.settings.update_one({"_id": SETTINGS_ID}, {"$set": {
        "key_hash": _hash_key(key), "key_prefix": key[:10],
        "ip_whitelist": cfg.get("ip_whitelist", []),
        "rotated_at": iso(now_utc()), "rotated_by": user.get("email"),
    }}, upsert=True)
    return {"api_key": key, "note": "请妥善保存，此 Key 只显示这一次。调用时放在请求头 X-Api-Key 中。"}


@router.get("/key")
async def get_key_info(user: dict = Depends(require_roles("admin"))):
    cfg = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    return {
        "enabled": bool(cfg.get("key_hash")),
        "key_prefix": cfg.get("key_prefix"),
        "ip_whitelist": cfg.get("ip_whitelist", []),
        "rotated_at": cfg.get("rotated_at"),
        "rotated_by": cfg.get("rotated_by"),
        "base_url": (os.environ.get("FRONTEND_URL", "").rstrip("/")) + "/api/admin-api",
    }


@router.put("/key/ip-whitelist")
async def set_ip_whitelist(data: IpWhitelistIn, user: dict = Depends(require_roles("admin"))):
    import ipaddress
    ips: list[str] = []
    for raw in data.ips:
        s = (raw or "").strip()
        if not s:
            continue
        try:
            ipaddress.ip_address(s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"IP 格式不正确: {s}")
        if s not in ips:
            ips.append(s)
    await db.settings.update_one({"_id": SETTINGS_ID}, {"$set": {"ip_whitelist": ips}}, upsert=True)
    return {"ip_whitelist": ips}


# ---------------------------------------------------------------------------
# Data API (X-Api-Key)
# ---------------------------------------------------------------------------
@router.get("/ping")
async def ping(cfg: dict = Depends(require_admin_api)):
    return {"code": 0, "msg": "success", "data": {
        "platform": _platform_name(),
        "server_time_bj": bj_str(now_utc(), "%Y-%m-%d %H:%M:%S"),
        "server_date_bj": bj_str(now_utc(), "%Y-%m-%d"),
    }}


@router.get("/stats")
async def stats(date: Optional[str] = None, cfg: dict = Depends(require_admin_api)):
    try:
        day_start, day_end, label = bj_day_bounds(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    orders = await db.orders.find({}).to_list(100000)
    paid = [o for o in orders if o["status"] == "paid"]
    def in_day(o):
        try:
            return day_start <= datetime.fromisoformat(o["created_at"]) < day_end
        except Exception:
            return False
    today = [o for o in orders if in_day(o)]
    today_paid = [o for o in today if o["status"] == "paid"]
    return {"code": 0, "msg": "success", "data": {
        "date": label,
        "total_orders": len(orders),
        "paid_orders": len(paid),
        "pending_orders": len([o for o in orders if o["status"] == "pending"]),
        "total_volume": round(sum(o["amount_usdt"] for o in paid), 2),
        "today_orders": len(today),
        "today_paid_orders": len(today_paid),
        "today_volume": round(sum(o["amount_usdt"] for o in today_paid), 2),
        "success_rate": round(len(paid) / len(orders) * 100, 1) if orders else 0.0,
    }}


@router.get("/orders")
async def list_orders(cfg: dict = Depends(require_admin_api),
                      status: Optional[str] = None, network: Optional[str] = None,
                      merchant_id: Optional[str] = None, keyword: Optional[str] = None,
                      date: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
                      page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500)):
    q: dict = {}
    if merchant_id:
        q["merchant_id"] = merchant_id
    if start and end:
        ds, _, _ = bj_day_bounds(start)
        _, de, _ = bj_day_bounds(end)
        q["created_at"] = {"$gte": iso(ds), "$lt": iso(de)}
    elif date:
        ds, de, _ = bj_day_bounds(date)
        q["created_at"] = {"$gte": iso(ds), "$lt": iso(de)}
    if status:
        q["status"] = status
    if network:
        q["network"] = network
    if keyword:
        raw = keyword.strip()[:64]
        kw = re.escape(raw)
        q["$or"] = [{"order_no": {"$regex": kw, "$options": "i"}},
                    {"tx_id": {"$regex": kw, "$options": "i"}},
                    {"out_trade_no": {"$regex": kw, "$options": "i"}},
                    {"wallet_address": {"$regex": kw, "$options": "i"}},
                    {"merchant_name": {"$regex": kw, "$options": "i"}}]
    total = await db.orders.count_documents(q)
    rows = await db.orders.find(q).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"code": 0, "msg": "success", "data": {
        "items": [_order_view(o) for o in rows], "total": total, "page": page, "page_size": page_size}}


@router.get("/orders/{order_no}")
async def get_order(order_no: str, cfg: dict = Depends(require_admin_api)):
    o = await db.orders.find_one({"order_no": order_no})
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"code": 0, "msg": "success", "data": _order_view(o)}


@router.get("/accounts")
async def list_accounts(role: Optional[str] = None, cfg: dict = Depends(require_admin_api)):
    q = {"role": role} if role in ("merchant", "operator", "agent") else {"role": {"$in": ["merchant", "operator", "agent"]}}
    rows = await db.users.find(q).sort("created_at", -1).to_list(1000)
    return {"code": 0, "msg": "success", "data": [{
        "id": str(u["_id"]), "role": u.get("role"), "name": u.get("name"), "email": u.get("email"),
        "status": u.get("status", "active"), "balance": round(u.get("balance", 0), 2),
        "rate": u.get("rate"), "created_at": u.get("created_at"),
    } for u in rows]}


@router.get("/support/threads")
async def support_threads(status: str = Query("all"), cfg: dict = Depends(require_admin_api)):
    fq = {}
    if status in ("open", "resolved"):
        fq["status"] = status
    rows = await db.support_threads.find(fq).sort("last_at", -1).limit(500).to_list(500)
    agg = await db.support_messages.aggregate([
        {"$match": {"sender": "customer", "read_agent": False}},
        {"$group": {"_id": "$order_no", "n": {"$sum": 1}}}]).to_list(1000)
    unread = {a["_id"]: a["n"] for a in agg}
    return {"code": 0, "msg": "success", "data": [{
        "order_no": r["_id"], "merchant_name": r.get("merchant_name", ""), "last_text": r.get("last_text", ""),
        "last_sender": r.get("last_sender", ""), "last_at": r.get("last_at"),
        "status": r.get("status", "open"), "assigned_to": r.get("assigned_to"),
        "unread": unread.get(r["_id"], 0)} for r in rows]}


@router.get("/support/threads/{order_no}")
async def support_thread_messages(order_no: str, cfg: dict = Depends(require_admin_api)):
    th = await db.support_threads.find_one({"_id": order_no})
    if not th:
        raise HTTPException(status_code=404, detail="会话不存在")
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(1000)
    return {"code": 0, "msg": "success", "data": {
        "order_no": order_no, "merchant_name": th.get("merchant_name", ""), "status": th.get("status", "open"),
        "assigned_to": th.get("assigned_to"),
        "messages": [{"id": str(m["_id"]), "sender": m["sender"], "sender_name": m.get("sender_name", ""),
                      "text": m.get("text", ""), "image": m.get("image"), "created_at": m["created_at"]} for m in msgs]}}


class ReplyIn(BaseModel):
    text: str = ""
    image: Optional[str] = None
    sender_name: Optional[str] = None


@router.post("/support/threads/{order_no}/reply")
async def support_reply(order_no: str, data: ReplyIn, cfg: dict = Depends(require_admin_api)):
    o = await _get_order(order_no)
    text = (data.text or "").strip()[:2000]
    if not text and not data.image:
        raise HTTPException(status_code=400, detail="消息不能为空")
    image = await _store_image(data.image)
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "agent", "sender_name": (data.sender_name or "客服")[:40], "text": text, "image": image,
           "created_at": iso(now_utc()), "read_agent": True, "read_customer": False}
    r = await db.support_messages.insert_one(doc)
    await _touch_thread(o, text, "agent", reopen=False)
    return {"code": 0, "msg": "success", "data": {"id": str(r.inserted_id), "created_at": doc["created_at"]}}


# ---------------------------------------------------------------------------
# Fund / sensitive write operations (X-Api-Key) — reuse the exact admin handlers
# ---------------------------------------------------------------------------
@router.post("/orders/{order_id}/manual-callback")
async def api_manual_callback(order_id: str, data: ManualCallbackIn, request: Request,
                              cfg: dict = Depends(require_admin_api)):
    """手动补单：输入链上 TxID + 金额，核验后按实际到账金额确认订单并触发商户回调。
    差异过大需 force=true。"""
    return {"code": 0, "msg": "success", "data": await _manual_callback(order_id, data, request, user=SYS_ACTOR)}


@router.post("/accounts/{account_id}/adjust")
async def api_adjust_balance(account_id: str, data: BalanceAdjust, request: Request,
                             cfg: dict = Depends(require_admin_api)):
    """调整余额：action = credit 增加 / debit 扣减 / freeze 冻结 / unfreeze 解冻。"""
    return {"code": 0, "msg": "success", "data": await _adjust_balance(account_id, data, request, user=SYS_ACTOR, _su={})}


@router.post("/accounts/{account_id}/toggle-status")
async def api_toggle_status(account_id: str, request: Request, cfg: dict = Depends(require_admin_api)):
    """冻结/解冻账户（在 active 与 frozen 之间切换）。"""
    return {"code": 0, "msg": "success", "data": await _toggle_status(account_id, request, user=SYS_ACTOR, _su={})}


@router.get("/settlements/payouts")
async def api_list_payouts(status: str = Query("pending"), cfg: dict = Depends(require_admin_api)):
    q = {} if status == "all" else {"status": status}
    rows = await db.payouts.find(q).sort("created_at", -1).limit(500).to_list(500)
    return {"code": 0, "msg": "success", "data": [{
        "id": str(p["_id"]), "merchant_id": p.get("merchant_id"), "merchant_name": p.get("merchant_name"),
        "amount": p.get("amount"), "address": p.get("address"), "network": p.get("network"),
        "status": p.get("status"), "created_at": p.get("created_at"),
        "created_at_bj": bj_str(p.get("created_at"), "%Y-%m-%d %H:%M:%S"), "approved_at": p.get("approved_at"),
    } for p in rows]}


@router.post("/settlements/payouts/{payout_id}/approve")
async def api_approve_payout(payout_id: str, request: Request, cfg: dict = Depends(require_admin_api)):
    """审核提现：通过放款。"""
    return {"code": 0, "msg": "success", "data": await _approve_payout(payout_id, request, user=SYS_ACTOR)}


@router.post("/settlements/payouts/{payout_id}/reject")
async def api_reject_payout(payout_id: str, request: Request, cfg: dict = Depends(require_admin_api)):
    """审核提现：驳回并退回余额。"""
    return {"code": 0, "msg": "success", "data": await _reject_payout(payout_id, request, user=SYS_ACTOR)}


@router.get("/checkout/settings")
async def api_get_checkout_settings(cfg: dict = Depends(require_admin_api)):
    doc = await db.settings.find_one({"_id": "checkout"}) or {}
    doc.pop("_id", None)
    return {"code": 0, "msg": "success", "data": {**DEFAULT_CHECKOUT_SETTINGS, **doc}}


@router.put("/checkout/settings")
async def api_put_checkout_settings(data: CheckoutSettings, request: Request, cfg: dict = Depends(require_admin_api)):
    """改配置：收银台/品牌/能量等配置。"""
    return {"code": 0, "msg": "success", "data": await _put_checkout_settings(data, request, user=SYS_ACTOR)}
