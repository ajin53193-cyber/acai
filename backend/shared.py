"""Cross-cutting infrastructure helpers shared across domains.

Audit logging, balance ledger writes, merchant callback delivery, and
notification (Telegram) primitives. Depends only on core (db) + utils, so it is
safe to import from services.py and routes/* without circular imports.
"""
import asyncio
import logging
from datetime import timedelta
from typing import Any, Optional

import httpx
from bson import ObjectId
from fastapi import Request

from core import db
from utils import iso, now_utc, client_ip, sign_payload

logger = logging.getLogger("sifang")

CALLBACK_RETRY_DELAYS = [15, 60, 300, 1800, 7200]
DEFAULT_ALERT_SETTINGS = {"pct": 10.0, "min_abs": 100.0, "sync_minutes": 10, "sweep_threshold": 10000.0, "big_payment": 1000.0}
DEFAULT_NOTIFY_SETTINGS = {"telegram_enabled": False, "telegram_bot_token": "", "telegram_chat_id": "",
                           "notify_alerts": True, "notify_big_payment": True, "notify_sweep": True,
                           "export_notify_threshold": 500}


async def audit(user: dict, action: str, target_type: str, target_id: str,
                detail: Any = None, request: Optional[Request] = None):
    await db.audit_logs.insert_one({
        "actor_id": str(user["_id"]), "actor_email": user["email"], "actor_role": user["role"],
        "action": action, "target_type": target_type, "target_id": str(target_id),
        "detail": detail or {}, "ip": client_ip(request) if request else None,
        "created_at": iso(now_utc()),
    })


async def record_ledger(account_id: str, category: str, amount: float, balance_after: float,
                        frozen_after: Optional[float] = None, ref_type: Optional[str] = None,
                        ref_id: Optional[Any] = None, remark: str = "", operator: Optional[str] = None):
    await db.balance_ledger.insert_one({
        "account_id": str(account_id), "category": category, "amount": round(amount, 4),
        "balance_after": round(balance_after, 4),
        "frozen_after": round(frozen_after, 4) if frozen_after is not None else None,
        "ref_type": ref_type, "ref_id": str(ref_id) if ref_id else None,
        "remark": remark, "operator": operator, "created_at": iso(now_utc()),
    })


async def enqueue_callback(order: dict):
    url = order.get("notify_url")
    if not url:
        return
    await db.callbacks.insert_one({
        "order_no": order["order_no"], "merchant_id": order["merchant_id"],
        "merchant_name": order["merchant_name"], "url": url, "status": "pending",
        "attempts": 0, "max_attempts": len(CALLBACK_RETRY_DELAYS) + 1,
        "next_at": iso(now_utc()), "last_code": None, "last_response": None,
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    })
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"callback_status": "pending"}})


async def build_callback_payload(order: dict, secret: str) -> dict:
    payload = {
        "order_no": order["order_no"], "amount_usdt": order["amount_usdt"],
        "pay_amount": order.get("pay_amount", order["amount_usdt"]), "network": order["network"],
        "status": order["status"], "tx_id": order.get("tx_id"), "paid_at": order.get("paid_at"),
        "remark": order.get("remark", ""), "out_trade_no": order.get("out_trade_no") or "",
        "timestamp": int(now_utc().timestamp()),
    }
    payload["sign"] = sign_payload(payload, secret)
    return payload


async def deliver_callback(cb: dict):
    order = await db.orders.find_one({"order_no": cb["order_no"]})
    merchant = await db.users.find_one({"_id": ObjectId(cb["merchant_id"])})
    if not order or not merchant:
        await db.callbacks.update_one({"_id": cb["_id"]}, {"$set": {"status": "failed", "last_response": "订单或商户不存在"}})
        return
    payload = await build_callback_payload(order, merchant.get("api_secret", ""))
    code, body, ok = None, "", False
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            resp = await hc.post(cb["url"], json=payload)
            code, body = resp.status_code, resp.text[:500]
            ok = 200 <= resp.status_code < 300 and ("success" in body.lower() or body.strip() in ("ok", "OK", "1", ""))
    except Exception as e:
        body = f"请求异常: {e}"[:500]
    attempts = cb["attempts"] + 1
    upd = {"attempts": attempts, "last_code": code, "last_response": body, "updated_at": iso(now_utc())}
    if ok:
        upd["status"] = "success"
        upd["delivered_at"] = iso(now_utc())
    elif attempts - 1 < len(CALLBACK_RETRY_DELAYS):
        upd["status"] = "retrying"
        upd["next_at"] = iso(now_utc() + timedelta(seconds=CALLBACK_RETRY_DELAYS[attempts - 1]))
    else:
        upd["status"] = "failed"
    await db.callbacks.update_one({"_id": cb["_id"]}, {"$set": upd})
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"callback_status": upd["status"]}})


async def callback_worker():
    while True:
        try:
            due = await db.callbacks.find({"status": {"$in": ["pending", "retrying"]},
                                           "next_at": {"$lte": iso(now_utc())}}).to_list(50)
            for cb in due:
                await deliver_callback(cb)
        except Exception as e:
            logger.warning(f"callback worker error: {e}")
        await asyncio.sleep(5)


async def notify_settings() -> dict:
    doc = await db.settings.find_one({"_id": "notify"}) or {}
    doc.pop("_id", None)
    return {**DEFAULT_NOTIFY_SETTINGS, **doc}


async def send_telegram(text: str, kind: str = "alert") -> bool:
    cfg = await notify_settings()
    if not cfg["telegram_enabled"] or not cfg["telegram_bot_token"] or not cfg["telegram_chat_id"]:
        return False
    if kind != "report" and ((kind == "alert" and not cfg["notify_alerts"]) or (kind == "payment" and not cfg["notify_big_payment"]) or (kind == "sweep" and not cfg["notify_sweep"])):
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(f"https://api.telegram.org/bot{cfg['telegram_bot_token']}/sendMessage",
                              json={"chat_id": cfg["telegram_chat_id"], "text": text, "parse_mode": "HTML", "disable_web_page_preview": True})
            ok = r.status_code == 200 and r.json().get("ok")
        await db.notify_log.insert_one({"kind": kind, "text": text, "ok": bool(ok), "resp": r.text[:300], "created_at": iso(now_utc())})
        return bool(ok)
    except Exception as e:
        await db.notify_log.insert_one({"kind": kind, "text": text, "ok": False, "resp": str(e)[:300], "created_at": iso(now_utc())})
        return False


async def alert_settings() -> dict:
    doc = await db.settings.find_one({"_id": "alerts"}) or {}
    doc.pop("_id", None)
    return {**DEFAULT_ALERT_SETTINGS, **doc}
