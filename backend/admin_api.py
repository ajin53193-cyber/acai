"""Admin console APIs: 2FA login, USDT top-ups, members, translations, notifications, reports."""
import base64
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import pyotp
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import email_auth
from clerk_auth import require_user
from mailer import send_mail
from sms import send_sms_code, _dagou_sign
from translate import translate_batch

logger = logging.getLogger("admin")
router = APIRouter(prefix="/api/admin")
db = None
translator = None
require_role = None
_wallet_tx = None
_usdt_settle = None
_usdt_call = None
_usdt_creds = None
ADMIN_TOKEN_TTL = 12 * 3600


def _sign(payload: dict, ttl: int) -> str:
    body = json.dumps({**payload, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()
    sig = hmac.new(os.environ["CLERK_SECRET_KEY"].encode(), body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _verify(token: str) -> Optional[dict]:
    try:
        b, s = token.split(".")
        body = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4))
        sig = base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
        if not hmac.compare_digest(hmac.new(os.environ["CLERK_SECRET_KEY"].encode(), body, hashlib.sha256).digest(), sig):
            return None
        data = json.loads(body)
        return data if data.get("exp", 0) > time.time() else None
    except Exception:
        return None


async def admin_guard(request: Request, member: dict) -> dict:
    """Admins with 2FA enrolled must present a valid X-Admin-Token."""
    rec = await db.admin_2fa.find_one({"user_id": member["user_id"], "enabled": True})
    if rec:
        data = _verify(request.headers.get("x-admin-token", ""))
        if not data or data.get("uid") != member["user_id"]:
            raise HTTPException(status_code=401, detail="admin_2fa_required")
    return member


async def current_admin(request: Request, user: dict = Depends(require_user)) -> dict:
    m = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not m or m.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    if m.get("banned"):
        raise HTTPException(status_code=403, detail="帳號已被停用")
    return await admin_guard(request, m)


# ----------------------------- 2FA login -----------------------------
class AdminLoginIn(BaseModel):
    identifier: str
    password: str


class AdminTotpIn(BaseModel):
    pre_token: str
    code: str


@router.post("/auth/login")
async def admin_login(body: AdminLoginIn):
    ident = body.identifier.strip().lower()
    user = await email_auth._phone_user(ident) if ident.startswith("+") else await email_auth._find_user(ident)
    if not user:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    r = await email_auth._clerk("POST", f"/users/{user['id']}/verify_password", json={"password": body.password})
    if r.status_code != 200 or not r.json().get("verified"):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    m = await db.users.find_one({"user_id": user["id"]}, {"_id": 0})
    if not m or m.get("role") != "admin":
        raise HTTPException(status_code=403, detail="此帳號沒有後台權限")
    rec = await db.admin_2fa.find_one({"user_id": user["id"]}, {"_id": 0})
    setup = None
    if not rec or not rec.get("enabled"):
        secret = (rec or {}).get("secret") or pyotp.random_base32()
        await db.admin_2fa.update_one({"user_id": user["id"]}, {"$set": {"secret": secret, "enabled": False}}, upsert=True)
        setup = {"secret": secret, "otpauth_url": pyotp.TOTP(secret).provisioning_uri(name=ident, issuer_name="GOGO589 Admin")}
    return {"pre_token": _sign({"uid": user["id"], "stage": "totp"}, 600), "setup": setup}


@router.post("/auth/totp")
async def admin_totp(body: AdminTotpIn):
    data = _verify(body.pre_token)
    if not data or data.get("stage") != "totp":
        raise HTTPException(status_code=401, detail="登入已逾時，請重新登入")
    rec = await db.admin_2fa.find_one({"user_id": data["uid"]}, {"_id": 0})
    if not rec or not pyotp.TOTP(rec["secret"]).verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="驗證碼錯誤")
    await db.admin_2fa.update_one({"user_id": data["uid"]}, {"$set": {"enabled": True, "verified_at": datetime.now(timezone.utc).isoformat()}})
    return {"ticket": await email_auth._ticket(data["uid"]), "admin_token": _sign({"uid": data["uid"]}, ADMIN_TOKEN_TTL), "expires_in": ADMIN_TOKEN_TTL}


# ----------------------------- USDT top-ups -----------------------------
class CreditIn(BaseModel):
    note: str = ""


@router.get("/topups")
async def admin_topups(status: str = "", q: str = "", limit: int = 200, admin: dict = Depends(current_admin)):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"out_trade_no": {"$regex": q, "$options": "i"}}, {"order_no": {"$regex": q, "$options": "i"}}, {"user_id": {"$regex": q, "$options": "i"}}, {"tx_id": {"$regex": q, "$options": "i"}}]
    items = await db.topup_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({t["user_id"] for t in items})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "name": 1})}
    for t in items:
        u = users.get(t["user_id"], {})
        t["user_email"] = u.get("email", "")
        t["user_phone"] = u.get("phone", "")
    return items


@router.post("/topups/{tid}/requery")
async def admin_topup_requery(tid: str, admin: dict = Depends(current_admin)):
    t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="充值單不存在")
    pm = await db.payment_methods.find_one({"id": t.get("method_id")}, {"_id": 0})
    key, secret, base = _usdt_creds(pm)
    gw = await _usdt_call("/api/v1/orders/query", {"out_trade_no": t["out_trade_no"]}, key, secret, base)
    if gw.get("status") == "paid" and t["status"] == "pending":
        t = await _usdt_settle(t, gw)
    elif gw.get("status") in ("expired", "cancelled", "closed", "failed") and t["status"] == "pending":
        await db.topup_orders.update_one({"id": tid}, {"$set": {"status": gw["status"]}})
        t["status"] = gw["status"]
    return {"topup": t, "gateway": gw}


@router.post("/topups/{tid}/credit")
async def admin_topup_credit(tid: str, body: CreditIn, admin: dict = Depends(current_admin)):
    t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="充值單不存在")
    if t["status"] == "paid":
        raise HTTPException(status_code=409, detail="此充值單已入帳")
    await db.topup_orders.update_one({"id": tid}, {"$set": {"status": "pending"}})
    t = await _usdt_settle({**t, "status": "pending"}, {"paid_at": datetime.now(timezone.utc).isoformat(), "tx_id": t.get("tx_id", "")})
    await db.topup_orders.update_one({"id": tid}, {"$set": {"manual_credit": True, "manual_note": body.note, "manual_by": admin["user_id"]}})
    return t


# ----------------------------- Members -----------------------------
class ResetPwIn(BaseModel):
    new_password: str


@router.get("/members")
async def admin_members(q: str = "", limit: int = 200, admin: dict = Depends(current_admin)):
    query = {}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}, {"user_id": {"$regex": q, "$options": "i"}}, {"profile.name": {"$regex": q, "$options": "i"}}]
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = [u["user_id"] for u in users]
    orders = {o["_id"]: o async for o in db.orders.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "spent": {"$sum": "$total_usd"}}}])}
    bal = {b["_id"]: b["bal"] async for b in db.wallet_transactions.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "bal": {"$sum": "$amount_usd"}}}])}
    out = []
    for u in users:
        o = orders.get(u["user_id"], {})
        email = u.get("email", "")
        out.append({**u, "banned": bool(u.get("banned")), "email": "" if email.endswith("@" + email_auth.PHONE_DOMAIN) else email, "order_count": o.get("count", 0), "spent_usd": round(o.get("spent", 0) or 0, 2),
                    "balance_usd": round(bal.get(u["user_id"], 0) or 0, 2), "google": bool((u.get("public_metadata") or {}).get("google_sub"))})
    return out


@router.get("/members/{uid}")
async def admin_member_detail(uid: str, admin: dict = Depends(current_admin)):
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="會員不存在")
    r = await email_auth._clerk("GET", f"/users/{uid}")
    c = r.json() if r.status_code == 200 else {}
    emails = [e["email_address"] for e in c.get("email_addresses", []) if not e["email_address"].endswith("@" + email_auth.PHONE_DOMAIN)]
    acct = await db.phone_accounts.find_one({"user_id": uid}, {"_id": 0})
    orders = await db.orders.find({"user_id": uid}, {"_id": 0, "id": 1, "status": 1, "total_usd": 1, "created_at": 1, "items": 1}).sort("created_at", -1).to_list(20)
    txs = await db.wallet_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {**u, "emails": emails, "phone": acct["phone"] if acct else (c.get("public_metadata") or {}).get("phone", ""),
            "google": bool((c.get("public_metadata") or {}).get("google_sub")) or any(a.get("provider") == "oauth_google" for a in c.get("external_accounts", [])),
            "password_enabled": c.get("password_enabled", False), "banned": c.get("banned", False) or u.get("banned", False),
            "last_sign_in_at": c.get("last_sign_in_at"), "orders": orders, "transactions": txs,
            "balance_usd": round(sum(t.get("amount_usd", 0) for t in await db.wallet_transactions.find({"user_id": uid}, {"_id": 0, "amount_usd": 1}).to_list(10000)), 2)}


@router.post("/members/{uid}/ban")
async def admin_member_ban(uid: str, admin: dict = Depends(current_admin)):
    await email_auth._clerk("POST", f"/users/{uid}/ban")
    await db.users.update_one({"user_id": uid}, {"$set": {"banned": True}})
    return {"ok": True, "banned": True}


@router.post("/members/{uid}/unban")
async def admin_member_unban(uid: str, admin: dict = Depends(current_admin)):
    await email_auth._clerk("POST", f"/users/{uid}/unban")
    await db.users.update_one({"user_id": uid}, {"$set": {"banned": False}})
    return {"ok": True, "banned": False}


@router.post("/members/{uid}/reset-password")
async def admin_member_reset_pw(uid: str, body: ResetPwIn, admin: dict = Depends(current_admin)):
    if not email_auth._pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    r = await email_auth._clerk("PATCH", f"/users/{uid}", json={"password": body.new_password, "skip_password_checks": True, "sign_out_of_other_sessions": True})
    if r.status_code >= 300:
        raise HTTPException(status_code=400, detail="重設失敗")
    return {"ok": True}


# ----------------------------- Translations -----------------------------
class TranslationIn(BaseModel):
    src: str
    en: str


class RetranslateIn(BaseModel):
    src: str


@router.get("/translations")
async def admin_translations(q: str = "", limit: int = 100, admin: dict = Depends(current_admin)):
    query = {"$or": [{"src": {"$regex": q, "$options": "i"}}, {"en": {"$regex": q, "$options": "i"}}]} if q else {}
    return await db.translations.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)


@router.put("/translations")
async def admin_translation_put(body: TranslationIn, admin: dict = Depends(current_admin)):
    await translator.save_many({body.src: body.en.strip()})
    return {"ok": True}


@router.post("/translations/retranslate")
async def admin_retranslate(body: RetranslateIn, admin: dict = Depends(current_admin)):
    res = await translate_batch([body.src])
    await translator.save_many(res)
    return {"src": body.src, "en": res.get(body.src, "")}


# ----------------------------- Notifications -----------------------------
DEFAULT_NOTIFY = {
    "email_enabled": True, "sms_enabled": False,
    "events": {"order_paid": True, "order_completed": True, "order_rejected": True, "topup_paid": True},
    "templates": {
        "order_paid": {"subject": "【GOGO589】订单已支付 {order_id}", "body": "您好，您的订单 {order_id}（{amount}）已支付成功，我们将尽快为您处理。"},
        "order_completed": {"subject": "【GOGO589】订单已完成 {order_id}", "body": "您好，您的订单 {order_id}（{amount}）已充值完成，感谢您的购买！"},
        "order_rejected": {"subject": "【GOGO589】订单资料被驳回 {order_id}", "body": "您好，您的订单 {order_id} 充值资料被驳回：{reason}。请登录后重新填写。"},
        "topup_paid": {"subject": "【GOGO589】钱包充值到账 {amount}", "body": "您好，您的 USDT 充值 {amount} 已到账，当前余额 {balance}。"},
    },
}


async def get_notify_settings() -> dict:
    doc = await db.settings.find_one({"key": "notifications"}, {"_id": 0}) or {}
    cfg = json.loads(json.dumps(DEFAULT_NOTIFY))
    for k, v in (doc.get("value") or {}).items():
        if isinstance(v, dict) and isinstance(cfg.get(k), dict):
            cfg[k].update(v)
        else:
            cfg[k] = v
    return cfg


async def notify_user(user_id: str, event: str, ctx: dict):
    try:
        cfg = await get_notify_settings()
        if not cfg["events"].get(event):
            return
        tpl = cfg["templates"].get(event) or {}
        subject = tpl.get("subject", "").format(**ctx)
        body = tpl.get("body", "").format(**ctx)
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "phone": 1}) or {}
        email = u.get("email", "")
        if cfg.get("email_enabled") and email and not email.endswith("@" + email_auth.PHONE_DOMAIN):
            html = f'<div style="font-family:sans-serif;font-size:14px;color:#0f172a;line-height:1.7"><div style="color:#f97316;font-weight:800;font-size:20px">gogo589</div><p>{body}</p><p style="color:#94a3b8;font-size:12px">此邮件由系统自动发送，请勿回复。</p></div>'
            await send_mail(email, subject, html, body)
        if cfg.get("sms_enabled") and u.get("phone"):
            await send_sms_code(u["phone"], body[:60])
    except Exception as e:
        logger.warning("notify %s failed: %s", event, e)


class NotifyIn(BaseModel):
    value: dict


@router.get("/notifications")
async def admin_notifications(admin: dict = Depends(current_admin)):
    return await get_notify_settings()


@router.put("/notifications")
async def admin_notifications_put(body: NotifyIn, admin: dict = Depends(current_admin)):
    await db.settings.update_one({"key": "notifications"}, {"$set": {"value": body.value}}, upsert=True)
    return await get_notify_settings()


@router.post("/notifications/test")
async def admin_notifications_test(admin: dict = Depends(current_admin)):
    email = admin.get("email", "")
    if not email or email.endswith("@" + email_auth.PHONE_DOMAIN):
        raise HTTPException(status_code=400, detail="管理員帳號沒有可用信箱")
    await send_mail(email, "【GOGO589】通知測試郵件", "<p>這是一封後台通知測試郵件。</p>", "這是一封後台通知測試郵件。")
    return {"ok": True, "to": email}


@router.get("/sms/balance")
async def admin_sms_balance(admin: dict = Depends(current_admin)):
    out = {}
    try:
        p = {"uname": os.environ["DAGOU_UNAME"], "timestamp": str(int(time.time()))}
        p["sign"] = _dagou_sign(p, os.environ["DAGOU_KEY"])
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{os.environ['DAGOU_GATEWAY'].rstrip('/')}/api/get_balance", data=p)
        out["dagou"] = r.json()
    except Exception as e:
        out["dagou"] = {"status": 0, "msg": str(e)}
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post("https://api-v4.mysubmail.com/balance/internationalsms.json", data={"appid": os.environ["SUBMAIL_APPID"], "signature": os.environ["SUBMAIL_APPKEY"]})
        out["submail"] = r.json()
    except Exception as e:
        out["submail"] = {"status": "error", "msg": str(e)}
    return out


# ----------------------------- Reports -----------------------------
@router.get("/reports")
async def admin_reports(days: int = 30, format: str = "json", admin: dict = Depends(current_admin)):
    days = max(1, min(days, 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    rows = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        rows[d] = {"date": d, "orders": 0, "revenue_usd": 0.0, "paid_orders": 0, "topups": 0, "topup_usd": 0.0, "new_users": 0}
    async for o in db.orders.find({"created_at": {"$gte": since}}, {"_id": 0, "created_at": 1, "status": 1, "total_usd": 1}):
        r = rows.get(o["created_at"][:10])
        if r:
            r["orders"] += 1
            if o.get("status") not in ("pending", "cancelled", "failed"):
                r["paid_orders"] += 1
                r["revenue_usd"] += float(o.get("total_usd") or 0)
    async for t in db.topup_orders.find({"created_at": {"$gte": since}, "status": "paid"}, {"_id": 0, "created_at": 1, "amount_usd": 1}):
        r = rows.get(t["created_at"][:10])
        if r:
            r["topups"] += 1
            r["topup_usd"] += float(t.get("amount_usd") or 0)
    async for u in db.users.find({"created_at": {"$gte": since}}, {"_id": 0, "created_at": 1}):
        r = rows.get((u.get("created_at") or "")[:10])
        if r:
            r["new_users"] += 1
    data = [{**r, "revenue_usd": round(r["revenue_usd"], 2), "topup_usd": round(r["topup_usd"], 2)} for r in rows.values()]
    if format == "csv":
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(data[0].keys()))
        w.writeheader()
        w.writerows(data)
        return StreamingResponse(iter([("\ufeff" + buf.getvalue()).encode()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=report_{days}d.csv"})
    totals = {k: round(sum(r[k] for r in data), 2) for k in ("orders", "revenue_usd", "paid_orders", "topups", "topup_usd", "new_users")}
    return {"days": days, "rows": data, "totals": totals}
