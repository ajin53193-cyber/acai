"""Admin console APIs: 2FA login, USDT top-ups, members, translations, notifications, reports."""
import base64
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import pyotp
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import email_auth
from clerk_auth import require_user
from mailer import send_mail, notify_email
from sms import send_sms_text, _dagou_sign
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


def account_no(user_id: str) -> str:
    """Short numeric account id shown to users & admins (same formula as /me/profile)."""
    return str(100000000 + (int(hashlib.md5(user_id.encode()).hexdigest()[:6], 16) % 900000000))


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
async def admin_topups(status: str = "", q: str = "", date_from: str = "", date_to: str = "", limit: int = 300, admin: dict = Depends(current_admin)):
    query = {}
    if status:
        query["status"] = status
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59.999999"
        query["created_at"] = rng
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        uids = [u["user_id"] async for u in db.users.find({"$or": [{"email": rx}, {"phone": rx}, {"name": rx}]}, {"_id": 0, "user_id": 1})]
        if q.strip().isdigit():  # allow searching by the short numeric account id
            uids += [u["user_id"] async for u in db.users.find({}, {"_id": 0, "user_id": 1}) if account_no(u["user_id"]) == q.strip()]
        query["$or"] = [{"out_trade_no": rx}, {"order_no": rx}, {"reference_code": rx}, {"user_id": rx}, {"tx_id": rx}, {"user_id": {"$in": uids}}]
    items = await db.topup_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({t["user_id"] for t in items})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "name": 1})}
    for t in items:
        u = users.get(t["user_id"], {})
        t["user_email"] = u.get("email", "")
        t["user_phone"] = u.get("phone", "")
        t["account_no"] = account_no(t["user_id"])
    base = {k: v for k, v in query.items() if k != "status"}
    counts = {c["_id"]: c["n"] async for c in db.topup_orders.aggregate([{"$match": base}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    return {"rows": items, "counts": counts, "total": sum(counts.values())}


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
        out.append({**u, "banned": bool(u.get("banned")), "account_no": account_no(u["user_id"]), "email": "" if email.endswith("@" + email_auth.PHONE_DOMAIN) else email, "order_count": o.get("count", 0), "spent_usd": round(o.get("spent", 0) or 0, 2),
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
    return {**u, "emails": emails, "account_no": account_no(uid), "phone": acct["phone"] if acct else (c.get("public_metadata") or {}).get("phone", ""),
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
EVENT_TITLES = {"order_paid": "订单已支付", "order_completed": "订单已完成", "order_cancelled": "订单已取消", "order_rejected": "充值资料被驳回", "topup_paid": "钱包充值到账"}
DEFAULT_NOTIFY = {
    "email_enabled": True, "sms_enabled": False,
    "events": {"order_paid": True, "order_completed": True, "order_cancelled": True, "order_rejected": True, "topup_paid": True},
    "templates": {
        "order_paid": {"subject": "【GOGO589】订单已支付 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已支付成功，我们将尽快为您处理。"},
        "order_completed": {"subject": "【GOGO589】订单已完成 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已充值完成，感谢您的购买！"},
        "order_cancelled": {"subject": "【GOGO589】订单已取消 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已取消。{reason}如已付款，款项已退回您的钱包余额。"},
        "order_rejected": {"subject": "【GOGO589】订单资料被驳回 {order_id}", "body": "您好，您的订单 {order_id} 充值资料被驳回：{reason}。请登录后重新填写。"},
        "topup_paid": {"subject": "【GOGO589】钱包充值到账 {amount}", "body": "您好，您的充值 {amount} 已到账，当前余额 {balance}。"},
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


class _Ctx(dict):
    def __missing__(self, key):
        return ""


def order_ctx(o: dict, **extra) -> dict:
    items = o.get("items") or []
    product = items[0].get("product_name") or items[0].get("name", "") if items else ""
    if len(items) > 1:
        product += f" 等 {len(items)} 件"
    return {"order_id": o.get("order_no") or o.get("id", ""), "amount": f"USD$ {float(o.get('total_usd') or 0):.2f}", "product": product, **extra}


async def _log(user_id: str, event: str, channel: str, to: str, subject: str, body: str, ok: bool, error: str = ""):
    await db.notification_logs.insert_one({"id": uuid.uuid4().hex, "user_id": user_id, "event": event, "channel": channel, "to": to, "subject": subject, "body": body,
                                           "status": "sent" if ok else "failed", "error": error, "created_at": datetime.now(timezone.utc).isoformat()})


async def notify_user(user_id: str, event: str, ctx: dict):
    try:
        cfg = await get_notify_settings()
        if not cfg["events"].get(event):
            return
        ctx = _Ctx(ctx)
        tpl = cfg["templates"].get(event) or {}
        subject = tpl.get("subject", "").format_map(ctx)
        body = tpl.get("body", "").format_map(ctx)
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "phone": 1}) or {}
        email = u.get("email", "")
        if cfg.get("email_enabled") and email and not email.endswith("@" + email_auth.PHONE_DOMAIN):
            rows = [("订单编号", ctx.get("order_id")), ("商品", ctx.get("product")), ("金额", ctx.get("amount")), ("余额", ctx.get("balance")), ("原因", ctx.get("reason"))]
            link = f"{os.environ.get('APP_PUBLIC_URL', '').rstrip('/')}/orders" if ctx.get("order_id") and os.environ.get("APP_PUBLIC_URL") else ""
            html = notify_email(EVENT_TITLES.get(event, subject), body, rows, link)
            try:
                await send_mail(email, subject, html, body)
                await _log(user_id, event, "email", email, subject, body, True)
            except Exception as e:
                await _log(user_id, event, "email", email, subject, body, False, str(e))
        if cfg.get("sms_enabled") and u.get("phone"):
            try:
                await send_sms_text(u["phone"], body)
                await _log(user_id, event, "sms", u["phone"], subject, body, True)
            except Exception as e:
                await _log(user_id, event, "sms", u["phone"], subject, body, False, str(e))
    except Exception as e:
        logger.warning("notify %s failed: %s", event, e)


class NotifyIn(BaseModel):
    value: dict


@router.get("/notifications")
async def admin_notifications(admin: dict = Depends(current_admin)):
    return await get_notify_settings()


@router.get("/notifications/logs")
async def admin_notification_logs(event: str = "", status: str = "", q: str = "", limit: int = 100, admin: dict = Depends(current_admin)):
    flt = {}
    if event:
        flt["event"] = event
    if status:
        flt["status"] = status
    if q:
        flt["$or"] = [{"to": {"$regex": re.escape(q), "$options": "i"}}, {"subject": {"$regex": re.escape(q), "$options": "i"}}, {"user_id": q}]
    rows = await db.notification_logs.find(flt, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 500))
    return {"rows": rows, "total": await db.notification_logs.count_documents(flt)}


@router.post("/notifications/logs/{lid}/resend")
async def admin_notification_resend(lid: str, admin: dict = Depends(current_admin)):
    log = await db.notification_logs.find_one({"id": lid}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="紀錄不存在")
    try:
        if log["channel"] == "email":
            await send_mail(log["to"], log["subject"], notify_email(EVENT_TITLES.get(log["event"], log["subject"]), log["body"], []), log["body"])
        else:
            await send_sms_text(log["to"], log["body"])
        await _log(log["user_id"], log["event"], log["channel"], log["to"], log["subject"], log["body"], True)
        return {"ok": True}
    except Exception as e:
        await _log(log["user_id"], log["event"], log["channel"], log["to"], log["subject"], log["body"], False, str(e))
        raise HTTPException(status_code=502, detail=f"重發失敗：{e}")


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
PAID_STATUSES = ["paid", "processing", "shipped", "completed"]


async def _period_stats(since: str, until: str) -> dict:
    o = await db.orders.aggregate([{"$match": {"created_at": {"$gte": since, "$lt": until}}}, {"$group": {"_id": None, "orders": {"$sum": 1},
        "revenue": {"$sum": {"$cond": [{"$in": ["$status", PAID_STATUSES]}, "$total_usd", 0]}}}}]).to_list(1)
    t = await db.topup_orders.aggregate([{"$match": {"created_at": {"$gte": since, "$lt": until}, "status": "paid"}}, {"$group": {"_id": None, "n": {"$sum": 1}, "usd": {"$sum": "$amount_usd"}}}]).to_list(1)
    users = await db.users.count_documents({"created_at": {"$gte": since, "$lt": until}})
    return {"orders": (o[0]["orders"] if o else 0), "revenue_usd": round((o[0]["revenue"] if o else 0) or 0, 2), "topups": (t[0]["n"] if t else 0), "topup_usd": round((t[0]["usd"] if t else 0) or 0, 2), "new_users": users}


@router.get("/dashboard")
async def admin_dashboard(days: int = 30, admin: dict = Depends(current_admin)):
    days = max(7, min(days, 365))
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    prev_since = (now - timedelta(days=2 * days - 1)).strftime("%Y-%m-%d")
    cur, prev = await _period_stats(since, "9999"), await _period_stats(prev_since, since)
    rows = {}
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        rows[d] = {"date": d, "orders": 0, "revenue_usd": 0.0, "topup_usd": 0.0, "new_users": 0}
    product_rev: dict = {}
    async for o in db.orders.find({"created_at": {"$gte": since}}, {"_id": 0, "created_at": 1, "status": 1, "total_usd": 1, "items": 1}):
        r = rows.get(o["created_at"][:10])
        paid = o.get("status") in PAID_STATUSES
        if r:
            r["orders"] += 1
            if paid:
                r["revenue_usd"] += float(o.get("total_usd") or 0)
        if paid:
            for it in o.get("items", []):
                p = product_rev.setdefault(it.get("product_id"), {"product_id": it.get("product_id"), "name": it.get("product_name"), "image": it.get("image", ""), "qty": 0, "revenue_usd": 0.0})
                p["qty"] += int(it.get("quantity") or 1)
                p["revenue_usd"] += float(it.get("unit_price_usd") or it.get("price_usd") or 0) * int(it.get("quantity") or 1)
    async for t in db.topup_orders.find({"created_at": {"$gte": since}, "status": "paid"}, {"_id": 0, "created_at": 1, "amount_usd": 1}):
        r = rows.get(t["created_at"][:10])
        if r:
            r["topup_usd"] += float(t.get("amount_usd") or 0)
    async for u in db.users.find({"created_at": {"$gte": since}}, {"_id": 0, "created_at": 1}):
        r = rows.get((u.get("created_at") or "")[:10])
        if r:
            r["new_users"] += 1
    by_status = {r["_id"]: r["n"] for r in await db.orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(20)}
    pay_mix = await db.topup_orders.aggregate([{"$match": {"status": "paid", "created_at": {"$gte": since}}}, {"$group": {"_id": {"$ifNull": ["$method_name", {"$ifNull": ["$provider", "USDT"]}]}, "n": {"$sum": 1}, "usd": {"$sum": "$amount_usd"}}}, {"$sort": {"usd": -1}}]).to_list(10)
    wallet = await db.users.aggregate([{"$group": {"_id": None, "s": {"$sum": {"$ifNull": ["$wallet_balance_usd", 0]}}}}]).to_list(1)
    cat_rev = await db.orders.aggregate([{"$match": {"created_at": {"$gte": since}, "status": {"$in": PAID_STATUSES}}}, {"$unwind": "$items"},
        {"$lookup": {"from": "products", "localField": "items.product_id", "foreignField": "id", "as": "p"}}, {"$unwind": {"path": "$p", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": {"$ifNull": ["$p.category", "other"]}, "usd": {"$sum": {"$multiply": [{"$ifNull": ["$items.unit_price_usd", {"$ifNull": ["$items.price_usd", 0]}]}, {"$ifNull": ["$items.quantity", 1]}]}}}}, {"$sort": {"usd": -1}}, {"$limit": 8}]).to_list(8)
    cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    recent_orders = await db.orders.find({}, {"_id": 0, "id": 1, "order_no": 1, "user_email": 1, "items": 1, "total_usd": 1, "status": 1, "created_at": 1}).sort("created_at", -1).to_list(8)
    recent_topups = await db.topup_orders.find({}, {"_id": 0, "id": 1, "amount_usd": 1, "status": 1, "provider": 1, "method_name": 1, "created_at": 1, "user_id": 1}).sort("created_at", -1).to_list(6)
    top_products = sorted(product_rev.values(), key=lambda p: -p["revenue_usd"])[:8]
    for p in top_products:
        p["revenue_usd"] = round(p["revenue_usd"], 2)
    return {
        "days": days, "current": cur, "previous": prev,
        "totals": {"wallet_balance_usd": round((wallet[0]["s"] if wallet else 0) or 0, 2), "users": await db.users.count_documents({}), "products": await db.products.count_documents({"active": True}),
                   "pending_dispatch": (by_status.get("paid", 0) + by_status.get("processing", 0)), "pending_topup_reviews": await db.topup_orders.count_documents({"status": "reviewing"}),
                   "pending_verifications": await db.verifications.count_documents({"status": "pending"}), "open_feedback": await db.feedback.count_documents({"status": "open"})},
        "series": [{**r, "revenue_usd": round(r["revenue_usd"], 2), "topup_usd": round(r["topup_usd"], 2)} for r in rows.values()],
        "by_status": by_status, "payment_mix": [{"name": r["_id"] or "-", "count": r["n"], "usd": round(r["usd"], 2)} for r in pay_mix],
        "category_mix": [{"name": cats.get(r["_id"], r["_id"]), "usd": round(r["usd"], 2)} for r in cat_rev],
        "top_products": top_products, "recent_orders": recent_orders, "recent_topups": recent_topups,
    }


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
