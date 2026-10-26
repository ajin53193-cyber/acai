"""Admin console APIs: 2FA login, USDT top-ups, members, translations, notifications, reports."""
import bjtime as _bj
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
from typing import Optional, List

import httpx
import pyotp
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import email_auth
import ipgeo
import local_auth
from local_auth import require_user
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
award_points = None
log_user = None
get_points_config = None
upload_b64 = None
run_referral_weekly = None
get_activity_center_cfg = None
ADMIN_TOKEN_TTL = 12 * 3600


def account_no(user_id: str) -> str:
    """Short numeric account id shown to users & admins (same formula as /me/profile)."""
    return str(100000000 + (int(hashlib.md5(user_id.encode()).hexdigest()[:6], 16) % 900000000))


DEFAULT_LEVELS = [
    {"name": "普通會員", "min_spend_usd": 0, "discount_percent": 0, "color": "sky"},
    {"name": "白銀會員", "min_spend_usd": 300, "discount_percent": 2, "color": "slate"},
    {"name": "黃金會員", "min_spend_usd": 1000, "discount_percent": 5, "color": "amber"},
    {"name": "鑽石會員", "min_spend_usd": 3000, "discount_percent": 8, "color": "violet"},
]


async def _levels():
    rows = await db.member_levels.find({}, {"_id": 0}).sort("min_spend_usd", 1).to_list(100)
    if not rows:
        rows = [{**lv, "id": uuid.uuid4().hex[:12], "sort": i} for i, lv in enumerate(DEFAULT_LEVELS)]
        await db.member_levels.insert_many([dict(r) for r in rows])
        rows = await db.member_levels.find({}, {"_id": 0}).sort("min_spend_usd", 1).to_list(100)
    return rows


def _level_of(spend: float, levels: list) -> dict:
    cur = None
    for lv in levels:
        if spend + 1e-9 >= (lv.get("min_spend_usd") or 0):
            cur = lv
    if not cur and levels:
        cur = levels[0]
    return {"name": cur["name"], "color": cur.get("color", "slate"), "discount_percent": cur.get("discount_percent", 0)} if cur else {"name": "普通會員", "color": "slate", "discount_percent": 0}


def _sign(payload: dict, ttl: int) -> str:
    body = json.dumps({**payload, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()
    sig = hmac.new(local_auth.secret().encode(), body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _verify(token: str) -> Optional[dict]:
    try:
        b, s = token.split(".")
        body = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4))
        sig = base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
        if not hmac.compare_digest(hmac.new(local_auth.secret().encode(), body, hashlib.sha256).digest(), sig):
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


# 後台登入暴力破解防護：帳號 / IP / TOTP 階段各自 15 分鐘內錯 5 次即鎖定
_auth_fails: dict = {}
_FAIL_MAX, _FAIL_WINDOW = 5, 900


def _fail_guard(*keys: str):
    now = time.time()
    for k in keys:
        recent = [t for t in _auth_fails.get(k, []) if t > now - _FAIL_WINDOW]
        _auth_fails[k] = recent
        if len(recent) >= _FAIL_MAX:
            raise HTTPException(status_code=429, detail="嘗試次數過多，請 15 分鐘後再試")


def _fail_mark(*keys: str):
    for k in keys:
        _auth_fails.setdefault(k, []).append(time.time())


def _fail_clear(*keys: str):
    for k in keys:
        _auth_fails.pop(k, None)


def _req_ip(request: Request) -> str:
    return ipgeo.client_ip(request)


@router.post("/auth/login")
async def admin_login(body: AdminLoginIn, request: Request):
    ident = body.identifier.strip().lower()
    ip = _req_ip(request)
    _fail_guard(f"login:{ident}", f"ip:{ip}")
    user = await local_auth.find_by_identifier(ident)
    if not user:
        _fail_mark(f"login:{ident}", f"ip:{ip}")
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    if not await local_auth.verify_password(user, body.password):
        _fail_mark(f"login:{ident}", f"ip:{ip}")
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    _fail_clear(f"login:{ident}")
    user["id"] = user["user_id"]
    m = user
    if m.get("role") != "admin":
        raise HTTPException(status_code=403, detail="此帳號沒有後台權限")
    rec = await db.admin_2fa.find_one({"user_id": user["id"]}, {"_id": 0})
    setup = None
    if not rec or not rec.get("enabled"):
        secret = (rec or {}).get("secret") or pyotp.random_base32()
        await db.admin_2fa.update_one({"user_id": user["id"]}, {"$set": {"secret": secret, "enabled": False}}, upsert=True)
        setup = {"secret": secret, "otpauth_url": pyotp.TOTP(secret).provisioning_uri(name=ident, issuer_name="GOGO589 Admin")}
    return {"pre_token": _sign({"uid": user["id"], "stage": "totp"}, 600), "setup": setup}


@router.post("/auth/totp")
async def admin_totp(body: AdminTotpIn, request: Request):
    data = _verify(body.pre_token)
    if not data or data.get("stage") != "totp":
        raise HTTPException(status_code=401, detail="登入已逾時，請重新登入")
    ip = _req_ip(request)
    _fail_guard(f"totp:{data['uid']}", f"ip:{ip}")
    rec = await db.admin_2fa.find_one({"user_id": data["uid"]}, {"_id": 0})
    if not rec or not pyotp.TOTP(rec["secret"]).verify(body.code.strip(), valid_window=1):
        _fail_mark(f"totp:{data['uid']}", f"ip:{ip}")
        raise HTTPException(status_code=400, detail="驗證碼錯誤")
    _fail_clear(f"totp:{data['uid']}", f"ip:{ip}")
    await db.admin_2fa.update_one({"user_id": data["uid"]}, {"$set": {"enabled": True, "verified_at": datetime.now(timezone.utc).isoformat()}})
    tok = await local_auth.token_for(data["uid"])
    return {"token": tok, "ticket": tok, "admin_token": _sign({"uid": data["uid"]}, ADMIN_TOKEN_TTL), "expires_in": ADMIN_TOKEN_TTL}


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
        mid = t.get("method_id") or t.get("provider") or ""
        t["channel_no"] = "CH" + str(10000 + (int(hashlib.md5(mid.encode()).hexdigest()[:5], 16) % 90000)) if mid else "-"
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


SAFE_USER = {"_id": 0, "password_hash": 0, "token_ver": 0}


async def _member_or_404(uid: str) -> dict:
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1})
    if not u:
        raise HTTPException(status_code=404, detail="會員不存在")
    return u


@router.get("/members")
async def admin_members(q: str = "", limit: int = 200, admin: dict = Depends(current_admin)):
    query = {}
    q = (q or "").strip()
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{f: rx} for f in ("email", "phone", "name", "user_id", "profile.name", "last_ip", "last_ip_region", "register_ip_region")]
        if q.isdigit() and len(q) >= 6:
            # 會員 ID（account_no）是由 user_id 推導的數字，無法直接查庫，掃描比對後併入結果
            ids = [u["user_id"] async for u in db.users.find({}, {"_id": 0, "user_id": 1}) if account_no(u["user_id"]).startswith(q)]
            if ids:
                query["$or"].append({"user_id": {"$in": ids}})
    users = await db.users.find(query, SAFE_USER).sort("created_at", -1).to_list(limit)
    uids = [u["user_id"] for u in users]
    orders = {o["_id"]: o async for o in db.orders.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "spent": {"$sum": "$total_usd"}}}])}
    bal = {b["_id"]: b["bal"] async for b in db.wallet_transactions.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "bal": {"$sum": "$amount_usd"}}}])}
    levels = await _levels()
    out = []
    for u in users:
        o = orders.get(u["user_id"], {})
        email = u.get("email", "")
        spent = round(o.get("spent", 0) or 0, 2)
        lv = _level_of(spent, levels)
        out.append({**u, "banned": bool(u.get("banned")), "account_no": account_no(u["user_id"]), "email": "" if email.endswith("@" + email_auth.PHONE_DOMAIN) else email, "order_count": o.get("count", 0), "spent_usd": spent,
                    "balance_usd": round(bal.get(u["user_id"], 0) or 0, 2), "points": int(u.get("points") or 0), "tags": u.get("tags", []), "level": lv,
                    "google": bool((u.get("public_metadata") or {}).get("google_sub"))})
    return out


@router.get("/members/stats")
async def admin_member_stats(admin: dict = Depends(current_admin)):
    now = datetime.now(timezone.utc)
    since30 = (now - timedelta(days=30)).isoformat()
    total = await db.users.count_documents({})
    banned = await db.users.count_documents({"banned": True})
    new30 = await db.users.count_documents({"created_at": {"$gte": since30}})
    active_ids = await db.orders.distinct("user_id", {"created_at": {"$gte": since30}})
    return {"total": total, "active": len(active_ids), "new": new30, "banned": banned}


@router.get("/members/{uid}")
async def admin_member_detail(uid: str, admin: dict = Depends(current_admin)):
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    has_pw = bool(u.get("password_hash")) if u and "password_hash" in u else None
    u = {k: v for k, v in (u or {}).items() if k not in ("password_hash", "token_ver")} if u else None
    if not u:
        raise HTTPException(status_code=404, detail="會員不存在")
    emails = [e for e in [local_auth.real_email(u.get("email", ""))] + list(u.get("alt_emails") or []) if e]
    acct = await db.phone_accounts.find_one({"user_id": uid}, {"_id": 0})
    orders = await db.orders.find({"user_id": uid}, {"_id": 0, "id": 1, "status": 1, "total_usd": 1, "created_at": 1, "items": 1}).sort("created_at", -1).to_list(20)
    txs = await db.wallet_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(20)
    verified = bool(await db.verifications.find_one({"user_id": uid, "status": "approved"}, {"_id": 1}))
    order_count = await db.orders.count_documents({"user_id": uid})
    agg = await db.orders.aggregate([{"$match": {"user_id": uid}}, {"$group": {"_id": None, "spent": {"$sum": "$total_usd"}}}]).to_list(1)
    spent = round((agg[0]["spent"] if agg else 0) or 0, 2)
    bal_agg = await db.wallet_transactions.aggregate([{"$match": {"user_id": uid}}, {"$group": {"_id": None, "bal": {"$sum": "$amount_usd"}}}]).to_list(1)
    balance = round((bal_agg[0]["bal"] if bal_agg else 0) or 0, 2)
    level = _level_of(spent, await _levels())
    ptx = await db.point_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {**u, "emails": emails, "account_no": account_no(uid), "verified": verified, "order_count": order_count, "spent_usd": spent, "phone": acct["phone"] if acct else u.get("phone", ""),
            "google": bool(u.get("google_sub") or (u.get("public_metadata") or {}).get("google_sub")),
            "password_enabled": has_pw if has_pw is not None else await local_auth.has_password(u), "banned": u.get("banned", False), "ban_reason": u.get("ban_reason", ""),
            "points": int(u.get("points") or 0), "tags": u.get("tags", []), "level": level, "point_transactions": ptx,
            "last_sign_in_at": u.get("last_seen_at"), "orders": orders, "transactions": txs, "balance_usd": balance}


@router.get("/members/{uid}/recent")
async def admin_member_recent(uid: str, admin: dict = Depends(current_admin)):
    """Compact recent activity for a user — shown in order detail dialogs to spot abuse/刷单."""
    orders = await db.orders.find({"user_id": uid}, {"_id": 0, "id": 1, "order_no": 1, "total_usd": 1, "status": 1, "created_at": 1, "items": 1}).sort("created_at", -1).to_list(6)
    topups = await db.topup_orders.find({"user_id": uid}, {"_id": 0, "id": 1, "order_no": 1, "out_trade_no": 1, "amount_usd": 1, "status": 1, "provider": 1, "own_wallet": 1, "created_at": 1}).sort("created_at", -1).to_list(6)
    oc = await db.orders.count_documents({"user_id": uid})
    tc = await db.topup_orders.count_documents({"user_id": uid})
    agg = await db.orders.aggregate([{"$match": {"user_id": uid}}, {"$group": {"_id": None, "s": {"$sum": "$total_usd"}}}]).to_list(1)
    return {"orders": orders, "topups": topups, "order_count": oc, "topup_count": tc,
            "spent_usd": round((agg[0]["s"] if agg else 0) or 0, 2), "account_no": account_no(uid)}


class BanIn(BaseModel):
    reason: str = ""


class TestFlagIn(BaseModel):
    is_test: bool = True


@router.post("/members/{uid}/test-flag")
async def admin_member_test_flag(uid: str, body: TestFlagIn, admin: dict = Depends(current_admin)):
    await db.users.update_one({"user_id": uid}, {"$set": {"is_test": body.is_test}})
    return {"ok": True, "is_test": body.is_test}


class TestAccountIn(BaseModel):
    email: str
    password: str


@router.post("/members/create-test")
async def admin_member_create_test(body: TestAccountIn, admin: dict = Depends(current_admin)):
    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="請輸入正確的信箱")
    if not email_auth._pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    if await local_auth.find_by_email(email):
        raise HTTPException(status_code=409, detail="此信箱已有帳號，可直接在會員列表標記為測試帳號")
    u = await local_auth.create_user(email=email, password=body.password, is_test=True)
    return {"ok": True, "user_id": u["user_id"]}


@router.post("/members/{uid}/ban")
async def admin_member_ban(uid: str, body: BanIn = BanIn(), admin: dict = Depends(current_admin)):
    await _member_or_404(uid)
    await db.users.update_one({"user_id": uid}, {"$set": {"banned": True, "ban_reason": body.reason, "banned_at": datetime.now(timezone.utc).isoformat()}})
    if log_user:
        await log_user(uid, "ban", "加入黑名單", body.reason or f"管理員 {admin.get('email', '')} 操作")
    return {"ok": True, "banned": True}


@router.post("/members/{uid}/unban")
async def admin_member_unban(uid: str, admin: dict = Depends(current_admin)):
    await _member_or_404(uid)
    await db.users.update_one({"user_id": uid}, {"$set": {"banned": False}, "$unset": {"ban_reason": "", "banned_at": ""}})
    if log_user:
        await log_user(uid, "ban", "解除黑名單", f"管理員 {admin.get('email', '')} 操作")
    return {"ok": True, "banned": False}


@router.post("/members/{uid}/reset-password")
async def admin_member_reset_pw(uid: str, body: ResetPwIn, admin: dict = Depends(current_admin)):
    await _member_or_404(uid)
    if not email_auth._pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    await local_auth.set_password(uid, body.new_password, sign_out_others=True)
    return {"ok": True}


# ----------------------------- Member Levels / Tags / Assets / Blacklist / Logs / Points -----------------------------
class LevelIn(BaseModel):
    name: str
    min_spend_usd: float = 0
    discount_percent: float = 0
    color: str = "slate"
    reward_points: int = 0
    reward_coupon_code: str = ""


@router.get("/member-levels")
async def admin_levels_list(admin: dict = Depends(current_admin)):
    rows = await _levels()
    counts = {}
    # attach member counts by spend bucket
    spends = [s async for s in db.orders.aggregate([{"$group": {"_id": "$user_id", "spent": {"$sum": "$total_usd"}}}])]
    for lv in rows:
        counts[lv["id"]] = 0
    for s in spends:
        lv = _level_of(s.get("spent", 0) or 0, rows)
        for r in rows:
            if r["name"] == lv["name"]:
                counts[r["id"]] = counts.get(r["id"], 0) + 1
                break
    return [{**r, "member_count": counts.get(r["id"], 0)} for r in rows]


@router.post("/member-levels")
async def admin_level_create(body: LevelIn, admin: dict = Depends(current_admin)):
    await _levels()  # ensure seeded
    doc = {"id": uuid.uuid4().hex[:12], **body.dict(), "sort": int(body.min_spend_usd)}
    await db.member_levels.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/member-levels/{lid}")
async def admin_level_update(lid: str, body: LevelIn, admin: dict = Depends(current_admin)):
    await db.member_levels.update_one({"id": lid}, {"$set": {**body.dict(), "sort": int(body.min_spend_usd)}})
    return {"ok": True}


@router.delete("/member-levels/{lid}")
async def admin_level_delete(lid: str, admin: dict = Depends(current_admin)):
    await db.member_levels.delete_one({"id": lid})
    return {"ok": True}


class TagIn(BaseModel):
    name: str
    color: str = "slate"


class AssignTagsIn(BaseModel):
    tag_ids: list[str] = []


@router.get("/user-tags")
async def admin_tags_list(admin: dict = Depends(current_admin)):
    rows = await db.user_tags.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for t in rows:
        t["member_count"] = await db.users.count_documents({"tags": t["id"]})
    return rows


@router.post("/user-tags")
async def admin_tag_create(body: TagIn, admin: dict = Depends(current_admin)):
    doc = {"id": uuid.uuid4().hex[:12], "name": body.name, "color": body.color, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.user_tags.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/user-tags/{tid}")
async def admin_tag_update(tid: str, body: TagIn, admin: dict = Depends(current_admin)):
    await db.user_tags.update_one({"id": tid}, {"$set": {"name": body.name, "color": body.color}})
    return {"ok": True}


@router.delete("/user-tags/{tid}")
async def admin_tag_delete(tid: str, admin: dict = Depends(current_admin)):
    await db.user_tags.delete_one({"id": tid})
    await db.users.update_many({"tags": tid}, {"$pull": {"tags": tid}})
    return {"ok": True}


@router.post("/members/{uid}/tags")
async def admin_assign_tags(uid: str, body: AssignTagsIn, admin: dict = Depends(current_admin)):
    await db.users.update_one({"user_id": uid}, {"$set": {"tags": body.tag_ids}}, upsert=True)
    return {"ok": True, "tags": body.tag_ids}


@router.get("/member-assets")
async def admin_member_assets(q: str = "", limit: int = 200, admin: dict = Depends(current_admin)):
    query = {}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}]
    users = await db.users.find(query, {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "name": 1, "profile": 1, "points": 1}).to_list(limit)
    uids = [u["user_id"] for u in users]
    bal = {b["_id"]: b["bal"] async for b in db.wallet_transactions.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "bal": {"$sum": "$amount_usd"}}}])}
    coupons = {}
    async for c in db.promo_redemptions.aggregate([{"$match": {"user_id": {"$in": uids}}}, {"$group": {"_id": "$user_id", "n": {"$sum": 1}}}]):
        coupons[c["_id"]] = c["n"]
    out = []
    total_balance = total_points = 0
    for u in users:
        b = round(bal.get(u["user_id"], 0) or 0, 2)
        p = int(u.get("points") or 0)
        total_balance += b
        total_points += p
        out.append({"user_id": u["user_id"], "account_no": account_no(u["user_id"]), "email": "" if (u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN)) else u.get("email", ""),
                    "phone": u.get("phone", ""), "name": u.get("profile", {}).get("name") if u.get("profile") else u.get("name", ""), "balance_usd": b, "points": p, "coupons": coupons.get(u["user_id"], 0)})
    out.sort(key=lambda x: x["balance_usd"], reverse=True)
    return {"rows": out, "summary": {"total_balance": round(total_balance, 2), "total_points": total_points, "members": len(out)}}


@router.get("/blacklist")
async def admin_blacklist(q: str = "", admin: dict = Depends(current_admin)):
    query = {"banned": True}
    if q:
        query["$and"] = [{"$or": [{"email": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}]}]
    users = await db.users.find(query, {"_id": 0}).sort("banned_at", -1).to_list(500)
    return [{"user_id": u["user_id"], "account_no": account_no(u["user_id"]), "email": "" if u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN) else u.get("email", ""),
             "phone": u.get("phone", ""), "name": u.get("profile", {}).get("name") if u.get("profile") else u.get("name", ""), "ban_reason": u.get("ban_reason", ""), "banned_at": u.get("banned_at", "")} for u in users]


@router.get("/user-logs")
async def admin_user_logs(type: str = "", q: str = "", uid: str = "", date_from: str = "", date_to: str = "", limit: int = 300, admin: dict = Depends(current_admin)):
    query = {}
    if type:
        query["type"] = type
    if uid:
        query["user_id"] = uid
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        query["created_at"] = rng
    if q:
        query["$or"] = [{"action": {"$regex": q, "$options": "i"}}, {"detail": {"$regex": q, "$options": "i"}}, {"user_id": {"$regex": q, "$options": "i"}}]
    rows = await db.user_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({r["user_id"] for r in rows})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    for r in rows:
        u = users.get(r["user_id"], {})
        r["account_no"] = account_no(r["user_id"])
        r["user_label"] = ("" if u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN) else u.get("email", "")) or u.get("phone", "") or r["user_id"][-8:]
    return rows


class PointsConfigIn(BaseModel):
    earn_enabled: bool = True
    earn_per_usd: float = 1
    order_enabled: bool = True
    topup_enabled: bool = True
    redeem_enabled: bool = False
    points_per_usd_redeem: float = 100
    min_redeem: float = 500


class PointsAdjustIn(BaseModel):
    delta: int
    reason: str = ""


@router.get("/points/config")
async def admin_points_config(admin: dict = Depends(current_admin)):
    return await get_points_config()


@router.put("/points/config")
async def admin_points_config_put(body: PointsConfigIn, admin: dict = Depends(current_admin)):
    await db.settings.update_one({"key": "points"}, {"$set": {"key": "points", "value": body.dict()}}, upsert=True)
    return {"ok": True}


@router.get("/points/ledger")
async def admin_points_ledger(q: str = "", uid: str = "", limit: int = 300, admin: dict = Depends(current_admin)):
    query = {}
    if uid:
        query["user_id"] = uid
    if q:
        query["$or"] = [{"reason": {"$regex": q, "$options": "i"}}, {"user_id": {"$regex": q, "$options": "i"}}, {"source": {"$regex": q, "$options": "i"}}]
    rows = await db.point_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({r["user_id"] for r in rows})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    for r in rows:
        u = users.get(r["user_id"], {})
        r["account_no"] = account_no(r["user_id"])
        r["user_label"] = ("" if u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN) else u.get("email", "")) or u.get("phone", "") or r["user_id"][-8:]
    return rows


@router.post("/members/{uid}/points/adjust")
async def admin_points_adjust(uid: str, body: PointsAdjustIn, admin: dict = Depends(current_admin)):
    if body.delta == 0:
        raise HTTPException(status_code=400, detail="積分變動不可為 0")
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "points": 1})
    if u is None:
        raise HTTPException(status_code=404, detail="會員不存在")
    new_bal = int(u.get("points") or 0) + body.delta
    if new_bal < 0:
        raise HTTPException(status_code=400, detail="扣減後積分不可為負")
    await db.users.update_one({"user_id": uid}, {"$set": {"points": new_bal}})
    await db.point_transactions.insert_one({"id": uuid.uuid4().hex[:12], "user_id": uid, "delta": body.delta, "balance_after": new_bal, "source": "admin",
                                            "reason": body.reason or f"管理員調整（{admin.get('email', '')}）", "ref": "", "created_at": datetime.now(timezone.utc).isoformat()})
    if log_user:
        await log_user(uid, "points", "積分調整", f"{'+' if body.delta > 0 else ''}{body.delta} · {body.reason}")
    return {"ok": True, "points": new_bal}


# ----------------------------- Recharge Bonus (充值贈送) -----------------------------
class RechargeBonusIn(BaseModel):
    min_usd: float = 0
    bonus_type: str = "fixed_usd"  # fixed_usd | percent | points
    bonus_value: float = 0
    active: bool = True


@router.get("/recharge-bonus")
async def admin_recharge_bonus_list(admin: dict = Depends(current_admin)):
    return await db.recharge_bonus_rules.find({}, {"_id": 0}).sort("min_usd", 1).to_list(100)


@router.post("/recharge-bonus")
async def admin_recharge_bonus_create(body: RechargeBonusIn, admin: dict = Depends(current_admin)):
    doc = {"id": uuid.uuid4().hex[:12], **body.dict()}
    await db.recharge_bonus_rules.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/recharge-bonus/{rid}")
async def admin_recharge_bonus_update(rid: str, body: RechargeBonusIn, admin: dict = Depends(current_admin)):
    await db.recharge_bonus_rules.update_one({"id": rid}, {"$set": body.dict()})
    return {"ok": True}


@router.delete("/recharge-bonus/{rid}")
async def admin_recharge_bonus_delete(rid: str, admin: dict = Depends(current_admin)):
    await db.recharge_bonus_rules.delete_one({"id": rid})
    return {"ok": True}


# ----------------------------- Gift Cards (禮品卡) -----------------------------
import secrets


def _gen_card_code() -> str:
    raw = secrets.token_hex(8).upper()
    return "GC" + "-".join(raw[i:i + 4] for i in range(0, 16, 4))


class GiftCardBatchIn(BaseModel):
    count: int = 1
    face_value_usd: float
    note: str = ""


@router.get("/gift-cards")
async def admin_gift_cards(status: str = "", q: str = "", limit: int = 500, admin: dict = Depends(current_admin)):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"code": {"$regex": q, "$options": "i"}}, {"batch_no": {"$regex": q, "$options": "i"}}, {"note": {"$regex": q, "$options": "i"}}]
    rows = await db.gift_cards.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    agg = {s["_id"]: s["n"] async for s in db.gift_cards.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    val = await db.gift_cards.aggregate([{"$group": {"_id": None, "total": {"$sum": "$face_value_usd"}, "redeemed": {"$sum": {"$cond": [{"$eq": ["$status", "redeemed"]}, "$face_value_usd", 0]}}}}]).to_list(1)
    summary = {"active": agg.get("active", 0), "redeemed": agg.get("redeemed", 0), "disabled": agg.get("disabled", 0),
               "total_value": round((val[0]["total"] if val else 0) or 0, 2), "redeemed_value": round((val[0]["redeemed"] if val else 0) or 0, 2)}
    return {"rows": rows, "summary": summary}


@router.post("/gift-cards")
async def admin_gift_cards_create(body: GiftCardBatchIn, admin: dict = Depends(current_admin)):
    n = max(1, min(int(body.count), 500))
    if body.face_value_usd <= 0:
        raise HTTPException(status_code=400, detail="面額必須大於 0")
    batch_no = "B" + datetime.now(timezone.utc).strftime("%y%m%d%H%M%S")
    docs = []
    for _ in range(n):
        docs.append({"id": uuid.uuid4().hex[:12], "code": _gen_card_code(), "face_value_usd": round(float(body.face_value_usd), 2), "status": "active",
                     "batch_no": batch_no, "note": body.note, "created_at": datetime.now(timezone.utc).isoformat(),
                     "redeemed_by": None, "redeemed_at": None, "redeemed_via": None})
    await db.gift_cards.insert_many([dict(d) for d in docs])
    return {"ok": True, "batch_no": batch_no, "count": n, "codes": [d["code"] for d in docs]}


@router.post("/gift-cards/{cid}/disable")
async def admin_gift_card_disable(cid: str, admin: dict = Depends(current_admin)):
    c = await db.gift_cards.find_one({"id": cid}, {"_id": 0, "status": 1})
    if not c or c.get("status") == "redeemed":
        raise HTTPException(status_code=400, detail="已核銷的卡不可停用")
    new_status = "active" if c.get("status") == "disabled" else "disabled"
    await db.gift_cards.update_one({"id": cid}, {"$set": {"status": new_status}})
    return {"ok": True, "status": new_status}


@router.delete("/gift-cards/{cid}")
async def admin_gift_card_delete(cid: str, admin: dict = Depends(current_admin)):
    await db.gift_cards.delete_one({"id": cid})
    return {"ok": True}


@router.get("/gift-card-orders")
async def admin_gift_card_orders(status: str = "", q: str = "", limit: int = 300, admin: dict = Depends(current_admin)):
    gift_ids = [p["id"] async for p in db.products.find({"is_giftcard": True}, {"_id": 0, "id": 1})]
    query: dict = {"$or": [{"is_giftcard_order": True}, {"items.product_id": {"$in": gift_ids}}]}
    if status:
        query["status"] = status
    if q:
        query = {"$and": [query, {"$or": [{"order_no": {"$regex": q, "$options": "i"}}, {"gift_trade_no": {"$regex": q}}, {"gift_trade_nos.trade_no": {"$regex": q}}, {"user_email": {"$regex": q, "$options": "i"}}]}]}
    rows = await db.orders.find(query, {"_id": 0, "id": 1, "order_no": 1, "user_id": 1, "user_email": 1, "items": 1, "total_usd": 1, "currency": 1, "rate_to_usd": 1,
                                        "status": 1, "created_at": 1, "paid_at": 1, "completed_at": 1, "delivery_info": 1, "recharge_account": 1, "gift_trade_nos": 1, "gift_trade_no": 1}).sort("created_at", -1).to_list(limit)
    for r in rows:
        r["account_no"] = account_no(r.get("user_id", ""))
        r["items"] = [i for i in r.get("items", []) if i.get("product_id") in gift_ids] or r.get("items", [])
    counts = {c["_id"]: c["n"] async for c in db.orders.aggregate([{"$match": {"$or": [{"is_giftcard_order": True}, {"items.product_id": {"$in": gift_ids}}]}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    return {"rows": rows, "counts": counts}


@router.get("/gift-card-redemptions")
async def admin_gift_card_redemptions(q: str = "", limit: int = 500, admin: dict = Depends(current_admin)):
    query = {"status": "redeemed"}
    if q:
        query["code"] = {"$regex": q, "$options": "i"}
    rows = await db.gift_cards.find(query, {"_id": 0}).sort("redeemed_at", -1).to_list(limit)
    uids = list({r["redeemed_by"] for r in rows if r.get("redeemed_by")})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    for r in rows:
        u = users.get(r.get("redeemed_by"), {})
        r["account_no"] = account_no(r["redeemed_by"]) if r.get("redeemed_by") else "-"
        r["user_label"] = ("" if u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN) else u.get("email", "")) or u.get("phone", "") or (r.get("redeemed_via") or "-")
    return rows


@router.get("/gift-card-api")
async def admin_gift_card_api(admin: dict = Depends(current_admin)):
    doc = await db.settings.find_one({"key": "giftcard_api"}, {"_id": 0}) or {}
    key = (doc.get("value") or {}).get("api_key")
    if not key:
        key = "gck_" + secrets.token_hex(20)
        await db.settings.update_one({"key": "giftcard_api"}, {"$set": {"key": "giftcard_api", "value": {"api_key": key}}}, upsert=True)
    base = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")
    return {"api_key": key, "endpoint": (base + "/api/giftcard/redeem") if base else "/api/giftcard/redeem"}


@router.post("/gift-card-api/regenerate")
async def admin_gift_card_api_regen(admin: dict = Depends(current_admin)):
    key = "gck_" + secrets.token_hex(20)
    await db.settings.update_one({"key": "giftcard_api"}, {"$set": {"key": "giftcard_api", "value": {"api_key": key}}}, upsert=True)
    return {"api_key": key}


# ----------------------------- Cart Promotions (滿減/滿折) -----------------------------
class CartPromoIn(BaseModel):
    title: str = ""
    promo_type: str = "reduce"  # reduce | percent
    threshold_usd: float = 0
    value: float = 0
    active: bool = True
    start_at: str = ""
    end_at: str = ""


@router.get("/cart-promotions")
async def admin_cart_promos(admin: dict = Depends(current_admin)):
    return await db.cart_promotions.find({}, {"_id": 0}).sort("threshold_usd", 1).to_list(100)


@router.post("/cart-promotions")
async def admin_cart_promo_create(body: CartPromoIn, admin: dict = Depends(current_admin)):
    doc = {"id": uuid.uuid4().hex[:12], **body.dict()}
    await db.cart_promotions.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/cart-promotions/{cid}")
async def admin_cart_promo_update(cid: str, body: CartPromoIn, admin: dict = Depends(current_admin)):
    await db.cart_promotions.update_one({"id": cid}, {"$set": body.dict()})
    return {"ok": True}


@router.delete("/cart-promotions/{cid}")
async def admin_cart_promo_delete(cid: str, admin: dict = Depends(current_admin)):
    await db.cart_promotions.delete_one({"id": cid})
    return {"ok": True}


# ----------------------------- Flash Sales (秒殺) -----------------------------
class FlashSaleIn(BaseModel):
    title: str = ""
    product_id: str
    spec_id: str
    flash_price_usd: float
    stock: int = 0
    per_user_limit: int = 1
    start_at: str = ""
    end_at: str = ""
    active: bool = True


async def _enrich_flash(fs: dict) -> dict:
    p = await db.products.find_one({"id": fs["product_id"]}, {"_id": 0, "name": 1, "image": 1, "specs": 1})
    fs["product_name"] = (p or {}).get("name", fs["product_id"])
    fs["image"] = (p or {}).get("image", "")
    spec = next((s for s in (p or {}).get("specs", []) if s["id"] == fs["spec_id"]), {})
    fs["spec_label"] = spec.get("label", "")
    fs["original_price_usd"] = spec.get("price_usd")
    fs["remaining"] = max(0, int(fs.get("stock") or 0) - int(fs.get("sold") or 0))
    return fs


@router.get("/flash-sales")
async def admin_flash_sales(admin: dict = Depends(current_admin)):
    rows = await db.flash_sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _enrich_flash(fs) for fs in rows]


@router.post("/flash-sales")
async def admin_flash_sale_create(body: FlashSaleIn, admin: dict = Depends(current_admin)):
    doc = {"id": uuid.uuid4().hex[:12], **body.dict(), "sold": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.flash_sales.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/flash-sales/{fid}")
async def admin_flash_sale_update(fid: str, body: FlashSaleIn, admin: dict = Depends(current_admin)):
    await db.flash_sales.update_one({"id": fid}, {"$set": body.dict()})
    return {"ok": True}


@router.delete("/flash-sales/{fid}")
async def admin_flash_sale_delete(fid: str, admin: dict = Depends(current_admin)):
    await db.flash_sales.delete_one({"id": fid})
    return {"ok": True}


# ----------------------------- Lottery (積分抽獎) -----------------------------
DEFAULT_LOTTERY = {
    "enabled": True,
    "cost_points": 100,
    "free_daily": True,
    "prizes": [
        {"id": "p1", "label": "50 積分", "type": "points", "value": 50, "weight": 30, "stock": -1, "color": "#fb923c"},
        {"id": "p2", "label": "謝謝惠顧", "type": "none", "value": 0, "weight": 35, "stock": -1, "color": "#fed7aa"},
        {"id": "p3", "label": "USD$0.5 餘額", "type": "balance", "value": 0.5, "weight": 12, "stock": 200, "color": "#f97316"},
        {"id": "p4", "label": "200 積分", "type": "points", "value": 200, "weight": 10, "stock": -1, "color": "#fbbf24"},
        {"id": "p5", "label": "USD$2 餘額", "type": "balance", "value": 2, "weight": 7, "stock": 100, "color": "#fb7185"},
        {"id": "p6", "label": "實物公仔", "type": "physical", "value": 0, "weight": 1, "stock": 10, "color": "#f43f5e"},
    ],
}


async def get_lottery_cfg() -> dict:
    doc = await db.settings.find_one({"key": "lottery"}, {"_id": 0})
    if not doc or not doc.get("value"):
        val = json.loads(json.dumps(DEFAULT_LOTTERY))
        await db.settings.update_one({"key": "lottery"}, {"$set": {"key": "lottery", "value": val}}, upsert=True)
        return val
    return {**DEFAULT_LOTTERY, **doc["value"]}


class LotteryPrizeIn(BaseModel):
    id: str = ""
    label: str
    type: str = "none"  # points | balance | coupon | physical | none
    value: object = 0
    weight: int = 1
    stock: int = -1
    color: str = "#fb923c"


class LotteryConfigIn(BaseModel):
    enabled: bool = True
    cost_points: int = 0
    free_daily: bool = False
    invite_only: bool = True
    invite_draws: int = 1
    title: str = "邀請好友 · 抽大獎"
    subtitle: str = "每成功邀請 1 位好友註冊，即得 1 次抽獎機會"
    rules: str = ""
    prizes: List[LotteryPrizeIn] = []


@router.get("/lottery")
async def admin_lottery_get(admin: dict = Depends(current_admin)):
    return await get_lottery_cfg()


@router.put("/lottery")
async def admin_lottery_put(body: LotteryConfigIn, admin: dict = Depends(current_admin)):
    prizes = []
    for p in body.prizes:
        d = p.dict()
        if not d.get("id"):
            d["id"] = uuid.uuid4().hex[:8]
        prizes.append(d)
    val = {"enabled": body.enabled, "cost_points": int(body.cost_points), "free_daily": bool(body.free_daily), "invite_only": bool(body.invite_only),
           "invite_draws": max(1, int(body.invite_draws)), "title": body.title, "subtitle": body.subtitle, "rules": body.rules, "prizes": prizes}
    await db.settings.update_one({"key": "lottery"}, {"$set": {"key": "lottery", "value": val}}, upsert=True)
    return val


@router.get("/lottery/draws")
async def admin_lottery_draws(q: str = "", limit: int = 300, admin: dict = Depends(current_admin)):
    rows = await db.lottery_draws.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({r["user_id"] for r in rows if r.get("user_id")})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    for r in rows:
        u = users.get(r.get("user_id"), {})
        r["account_no"] = account_no(r["user_id"]) if r.get("user_id") else "-"
        r["user_label"] = ("" if u.get("email", "").endswith("@" + email_auth.PHONE_DOMAIN) else u.get("email", "")) or u.get("phone", "") or "-"
    if q:
        rows = [r for r in rows if q in (r.get("account_no") or "") or q in (r.get("user_label") or "") or q in (r.get("prize_label") or "")]
    return rows


@router.post("/lottery/draws/{did}/fulfill")
async def admin_lottery_fulfill(did: str, admin: dict = Depends(current_admin)):
    await db.lottery_draws.update_one({"id": did}, {"$set": {"fulfilled": True, "fulfilled_at": datetime.now(timezone.utc).isoformat(), "fulfilled_by": admin.get("email", "")}})
    return {"ok": True}


# ----------------------------- Combos (組合套餐) -----------------------------
class ComboItemIn(BaseModel):
    product_id: str
    spec_id: str
    quantity: int = 1


class ComboIn(BaseModel):
    title: str
    image: str = ""
    items: List[ComboItemIn] = []
    price_usd: float = 0
    active: bool = True
    sort_order: int = 0
    start_at: str = ""
    end_at: str = ""
    stock: int = 0


async def _enrich_combo(c: dict) -> dict:
    orig = 0.0
    out_items = []
    for ci in c.get("items", []):
        p = await db.products.find_one({"id": ci["product_id"]}, {"_id": 0, "name": 1, "image": 1, "specs": 1})
        spec = next((s for s in (p or {}).get("specs", []) if s["id"] == ci["spec_id"]), {}) if p else {}
        qty = int(ci.get("quantity") or 1)
        orig += float(spec.get("price_usd") or 0) * qty
        out_items.append({**ci, "product_name": (p or {}).get("name", ci["product_id"]), "image": (p or {}).get("image", ""), "spec_label": spec.get("label", "")})
    c["items"] = out_items
    c["original_total_usd"] = round(orig, 2)
    c["remaining"] = (max(0, int(c.get("stock") or 0) - int(c.get("sold") or 0)) if int(c.get("stock") or 0) > 0 else None)
    return c


@router.get("/combos")
async def admin_combos(admin: dict = Depends(current_admin)):
    rows = await db.combos.find({}, {"_id": 0}).sort([("sort_order", 1)]).to_list(100)
    return [await _enrich_combo(c) for c in rows]


@router.post("/combos")
async def admin_combo_create(body: ComboIn, admin: dict = Depends(current_admin)):
    doc = {"id": uuid.uuid4().hex[:12], **body.dict(), "sold": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.combos.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/combos/{cid}")
async def admin_combo_update(cid: str, body: ComboIn, admin: dict = Depends(current_admin)):
    await db.combos.update_one({"id": cid}, {"$set": body.dict()})
    return {"ok": True}


@router.delete("/combos/{cid}")
async def admin_combo_delete(cid: str, admin: dict = Depends(current_admin)):
    await db.combos.delete_one({"id": cid})
    return {"ok": True}


# ----------------------------- Activity Records (活動記錄) -----------------------------
async def _user_labels(uids: list) -> dict:
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": list(uids)}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    out = {}
    for uid, u in users.items():
        email = u.get("email", "") or ""
        label = ("" if email.endswith("@" + email_auth.PHONE_DOMAIN) else email) or u.get("phone", "") or "-"
        out[uid] = {"label": label, "account_no": account_no(uid)}
    return out


@router.get("/activity-records")
async def admin_activity_records(type: str = "all", limit: int = 200, admin: dict = Depends(current_admin)):
    recs = []
    if type in ("all", "seckill"):
        orders = await db.orders.find({"items.flash_id": {"$ne": None}}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        for o in orders:
            for it in o.get("items", []):
                if it.get("flash_id"):
                    recs.append({"type": "seckill", "created_at": o.get("created_at", ""), "user_id": o.get("user_id"),
                                 "title": f"{it.get('product_name', '')} · {it.get('spec_label', '')}", "detail": f"×{it.get('quantity', 1)}",
                                 "amount_usd": round(float(it.get("unit_price_usd") or 0) * int(it.get("quantity") or 1), 2),
                                 "ref": o.get("order_no", ""), "status": o.get("status", "")})
    if type in ("all", "combo"):
        orders = await db.orders.find({"combo_discount_usd": {"$gt": 0}}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        for o in orders:
            recs.append({"type": "combo", "created_at": o.get("created_at", ""), "user_id": o.get("user_id"),
                         "title": o.get("combo_title", "") or "套餐", "detail": f"省 USD${float(o.get('combo_discount_usd') or 0):.2f}",
                         "amount_usd": round(float(o.get("total_usd") or 0), 2), "ref": o.get("order_no", ""), "status": o.get("status", "")})
    if type in ("all", "lottery"):
        draws = await db.lottery_draws.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        for d in draws:
            recs.append({"type": "lottery", "created_at": d.get("created_at", ""), "user_id": d.get("user_id"),
                         "title": d.get("prize_label", ""), "detail": ("免費抽" if d.get("free") else f"消耗 {d.get('cost_points', 0)} 積分"),
                         "amount_usd": None, "ref": d.get("prize_type", ""), "status": "fulfilled" if d.get("fulfilled") else ("done" if d.get("prize_type") != "physical" else "pending")})
    recs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    recs = recs[:limit]
    labels = await _user_labels({r["user_id"] for r in recs if r.get("user_id")})
    for r in recs:
        lb = labels.get(r.get("user_id"), {})
        r["account_no"] = lb.get("account_no", "-")
        r["user_label"] = lb.get("label", "-")
    return recs


@router.get("/activity-stats")
async def admin_activity_stats(admin: dict = Depends(current_admin)):
    today = _bj.today()
    seckill_units = seckill_rev = 0
    paid = {"$in": ["paid", "processing", "completed", "shipped"]}
    async for o in db.orders.find({"created_at": _bj.today_q(), "items.flash_id": {"$ne": None}}, {"_id": 0, "items": 1}):
        for it in o.get("items", []):
            if it.get("flash_id"):
                q = int(it.get("quantity") or 1)
                seckill_units += q
                seckill_rev += float(it.get("unit_price_usd") or 0) * q
    combo_orders = combo_rev = combo_saved = 0
    async for o in db.orders.find({"created_at": _bj.today_q(), "combo_discount_usd": {"$gt": 0}}, {"_id": 0, "total_usd": 1, "combo_discount_usd": 1}):
        combo_orders += 1
        combo_rev += float(o.get("total_usd") or 0)
        combo_saved += float(o.get("combo_discount_usd") or 0)
    lottery_draws = await db.lottery_draws.count_documents({"created_at": _bj.today_q()})
    lottery_real = await db.lottery_draws.count_documents({"created_at": _bj.today_q(), "prize_type": {"$nin": ["none"]}})
    return {
        "date": today,
        "seckill": {"units": seckill_units, "revenue_usd": round(seckill_rev, 2)},
        "lottery": {"draws": lottery_draws, "real_wins": lottery_real},
        "combo": {"orders": combo_orders, "revenue_usd": round(combo_rev, 2), "saved_usd": round(combo_saved, 2)},
    }


@router.get("/activity-trend")
async def admin_activity_trend(days: int = 7, admin: dict = Depends(current_admin)):
    days = max(1, min(30, int(days)))
    today = _bj.now().date()
    buckets = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)]
    idx = {d: {"date": d, "seckill": 0, "lottery": 0, "combo": 0} for d in buckets}
    start = buckets[0]
    async for o in db.orders.find({"created_at": _bj.rng(start), "items.flash_id": {"$ne": None}}, {"_id": 0, "created_at": 1, "items": 1}):
        d = _bj.day(o.get("created_at"))
        if d in idx:
            idx[d]["seckill"] += sum(int(it.get("quantity") or 1) for it in o.get("items", []) if it.get("flash_id"))
    async for o in db.orders.find({"created_at": _bj.rng(start), "combo_discount_usd": {"$gt": 0}}, {"_id": 0, "created_at": 1}):
        d = _bj.day(o.get("created_at"))
        if d in idx:
            idx[d]["combo"] += 1
    async for dr in db.lottery_draws.find({"created_at": _bj.rng(start)}, {"_id": 0, "created_at": 1}):
        d = _bj.day(dr.get("created_at"))
        if d in idx:
            idx[d]["lottery"] += 1
    return [idx[d] for d in buckets]


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
EVENT_TITLES = {"order_paid": "订单已支付", "order_completed": "订单已完成", "order_cancelled": "订单已取消", "order_rejected": "充值资料被驳回", "topup_paid": "钱包充值到账", "level_up": "会员升级", "giftcard_completed": "礼品卡转赠成功"}
DEFAULT_NOTIFY = {
    "email_enabled": True, "sms_enabled": False,
    "events": {"order_paid": True, "order_completed": True, "order_cancelled": True, "order_rejected": True, "topup_paid": True, "level_up": True, "giftcard_completed": True},
    "templates": {
        "order_paid": {"subject": "【GOGO589】订单已支付 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已支付成功，我们将尽快为您处理。"},
        "order_completed": {"subject": "【GOGO589】订单已完成 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已充值完成，感谢您的购买！"},
        "giftcard_completed": {"subject": "【GOGO589】礼品卡转赠成功 {order_id}", "body": "您好，您的礼品卡订单 {order_id}（{product}，{amount}）已转赠成功。交易号：{trade_nos}。请妥善保存交易号，凭交易号与收礼人手机号即可核销使用。"},
        "order_cancelled": {"subject": "【GOGO589】订单已取消 {order_id}", "body": "您好，您的订单 {order_id}（{product}，{amount}）已取消。{reason}如已付款，款项已退回您的钱包余额。"},
        "order_rejected": {"subject": "【GOGO589】订单资料被驳回 {order_id}", "body": "您好，您的订单 {order_id} 充值资料被驳回：{reason}。请登录后重新填写。"},
        "topup_paid": {"subject": "【GOGO589】钱包充值到账 {amount}", "body": "您好，您的充值 {amount} 已到账，当前余额 {balance}。"},
        "level_up": {"subject": "【GOGO589】恭喜升级为 {level} 🎉", "body": "恭喜您升级为 {level}！{reward}已存入您的账户，登录即可查看与使用。"},
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
            rows = [("订单编号", ctx.get("order_id")), ("商品", ctx.get("product")), ("金额", ctx.get("amount")), ("交易号", ctx.get("trade_nos")), ("收礼人", ctx.get("recipient")), ("余额", ctx.get("balance")), ("原因", ctx.get("reason"))]
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


async def _test_uids() -> list:
    return [u["user_id"] async for u in db.users.find({"is_test": True}, {"_id": 0, "user_id": 1})]


async def _period_stats(since: str, until: str) -> dict:
    nt = {"$nin": await _test_uids()}
    o = await db.orders.aggregate([{"$match": {"created_at": _bj.rng(since, until), "user_id": nt}}, {"$group": {"_id": None, "orders": {"$sum": 1},
        "revenue": {"$sum": {"$cond": [{"$in": ["$status", PAID_STATUSES]}, "$total_usd", 0]}}}}]).to_list(1)
    t = await db.topup_orders.aggregate([{"$match": {"created_at": _bj.rng(since, until), "status": "paid", "user_id": nt}}, {"$group": {"_id": None, "n": {"$sum": 1}, "usd": {"$sum": "$amount_usd"}}}]).to_list(1)
    users = await db.users.count_documents({"created_at": _bj.rng(since, until), "is_test": {"$ne": True}})
    return {"orders": (o[0]["orders"] if o else 0), "revenue_usd": round((o[0]["revenue"] if o else 0) or 0, 2), "topups": (t[0]["n"] if t else 0), "topup_usd": round((t[0]["usd"] if t else 0) or 0, 2), "new_users": users}


@router.get("/dashboard")
async def admin_dashboard(days: int = 30, admin: dict = Depends(current_admin)):
    days = max(7, min(days, 365))
    now = _bj.now()
    since = (now - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    prev_since = (now - timedelta(days=2 * days - 1)).strftime("%Y-%m-%d")
    cur, prev = await _period_stats(since, "9999"), await _period_stats(prev_since, since)
    rows = {}
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        rows[d] = {"date": d, "orders": 0, "revenue_usd": 0.0, "topup_usd": 0.0, "new_users": 0}
    product_rev: dict = {}
    nt = {"$nin": await _test_uids()}
    async for o in db.orders.find({"created_at": _bj.rng(since), "user_id": nt}, {"_id": 0, "created_at": 1, "status": 1, "total_usd": 1, "items": 1}):
        r = rows.get(_bj.day(o["created_at"]))
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
    async for t in db.topup_orders.find({"created_at": _bj.rng(since), "status": "paid", "user_id": nt}, {"_id": 0, "created_at": 1, "amount_usd": 1}):
        r = rows.get(_bj.day(t["created_at"]))
        if r:
            r["topup_usd"] += float(t.get("amount_usd") or 0)
    async for u in db.users.find({"created_at": _bj.rng(since), "is_test": {"$ne": True}}, {"_id": 0, "created_at": 1}):
        r = rows.get(_bj.day(u.get("created_at")))
        if r:
            r["new_users"] += 1
    by_status = {r["_id"]: r["n"] for r in await db.orders.aggregate([{"$match": {"user_id": nt}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(20)}
    pay_mix = await db.topup_orders.aggregate([{"$match": {"status": "paid", "created_at": _bj.rng(since), "user_id": nt}}, {"$group": {"_id": {"$ifNull": ["$method_name", {"$ifNull": ["$provider", "USDT"]}]}, "n": {"$sum": 1}, "usd": {"$sum": "$amount_usd"}}}, {"$sort": {"usd": -1}}]).to_list(10)
    wallet = await db.users.aggregate([{"$match": {"is_test": {"$ne": True}}}, {"$group": {"_id": None, "s": {"$sum": {"$ifNull": ["$wallet_balance_usd", 0]}}}}]).to_list(1)
    cat_rev = await db.orders.aggregate([{"$match": {"created_at": _bj.rng(since), "status": {"$in": PAID_STATUSES}, "user_id": nt}}, {"$unwind": "$items"},
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
        "totals": {"wallet_balance_usd": round((wallet[0]["s"] if wallet else 0) or 0, 2), "users": await db.users.count_documents({"is_test": {"$ne": True}}), "products": await db.products.count_documents({"active": True}),
                   "pending_dispatch": (by_status.get("paid", 0) + by_status.get("processing", 0)), "pending_topup_reviews": await db.topup_orders.count_documents({"status": "reviewing"}),
                   "pending_verifications": await db.verifications.count_documents({"status": "pending"}), "open_feedback": await db.feedback.count_documents({"status": "open"}),
                   "bad_reviews": await db.reviews.count_documents({"rating": {"$lte": 2}, "handled": {"$ne": True}, "$or": [{"reply": ""}, {"reply": {"$exists": False}}]})},
        "series": [{**r, "revenue_usd": round(r["revenue_usd"], 2), "topup_usd": round(r["topup_usd"], 2)} for r in rows.values()],
        "by_status": by_status, "payment_mix": [{"name": r["_id"] or "-", "count": r["n"], "usd": round(r["usd"], 2)} for r in pay_mix],
        "category_mix": [{"name": cats.get(r["_id"], r["_id"]), "usd": round(r["usd"], 2)} for r in cat_rev],
        "top_products": top_products, "recent_orders": recent_orders, "recent_topups": recent_topups,
    }


@router.get("/reports")
async def admin_reports(days: int = 30, format: str = "json", admin: dict = Depends(current_admin)):
    days = max(1, min(days, 365))
    since = _bj.days_ago(days - 1)
    rows = {}
    for i in range(days):
        d = _bj.days_ago(days - 1 - i)
        rows[d] = {"date": d, "orders": 0, "revenue_usd": 0.0, "paid_orders": 0, "topups": 0, "topup_usd": 0.0, "new_users": 0}
    async for o in db.orders.find({"created_at": _bj.rng(since)}, {"_id": 0, "created_at": 1, "status": 1, "total_usd": 1}):
        r = rows.get(_bj.day(o["created_at"]))
        if r:
            r["orders"] += 1
            if o.get("status") not in ("pending", "cancelled", "failed"):
                r["paid_orders"] += 1
                r["revenue_usd"] += float(o.get("total_usd") or 0)
    async for t in db.topup_orders.find({"created_at": _bj.rng(since), "status": "paid"}, {"_id": 0, "created_at": 1, "amount_usd": 1}):
        r = rows.get(_bj.day(t["created_at"]))
        if r:
            r["topups"] += 1
            r["topup_usd"] += float(t.get("amount_usd") or 0)
    async for u in db.users.find({"created_at": _bj.rng(since)}, {"_id": 0, "created_at": 1}):
        r = rows.get(_bj.day(u.get("created_at")))
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


# ---------------- 邀請返利（Referral） ----------------
REFERRAL_DEFAULTS = {"enabled": True, "referrer_points": 500, "referee_points": 200,
                     "poster_title": "邀請好友 · 一起賺積分", "poster_subtitle": "掃碼註冊並完成首充，雙方立得積分獎勵",
                     "weekly_enabled": True,
                     "weekly_rewards": [{"rank": 1, "type": "points", "value": 2000, "coupon_code": ""},
                                        {"rank": 2, "type": "points", "value": 1000, "coupon_code": ""},
                                        {"rank": 3, "type": "points", "value": 500, "coupon_code": ""}],
                     "milestones_enabled": True,
                     "milestones": [{"count": 3, "type": "points", "value": 300, "coupon_code": ""},
                                    {"count": 5, "type": "points", "value": 800, "coupon_code": ""},
                                    {"count": 10, "type": "points", "value": 2000, "coupon_code": ""}]}


class ReferralConfigIn(BaseModel):
    enabled: bool = True
    referrer_points: int = 500
    referee_points: int = 200
    poster_title: str = ""
    poster_subtitle: str = ""
    weekly_enabled: bool = True
    weekly_rewards: list = []
    milestones_enabled: bool = True
    milestones: list = []


class PosterIn(BaseModel):
    name: str = ""
    image_b64: str = ""
    image_name: str = "poster.png"
    image: str = ""
    active: bool = True
    sort: int = 0
    style: dict = {}


def _ref_user_label(u: dict) -> str:
    if not u:
        return ""
    email = u.get("email", "") or ""
    if email.endswith("@" + email_auth.PHONE_DOMAIN):
        email = ""
    return email or u.get("phone", "") or (u.get("user_id", "") or "")[-8:]


async def _ref_cfg() -> dict:
    doc = await db.settings.find_one({"key": "referral"}, {"_id": 0})
    return {**REFERRAL_DEFAULTS, **((doc or {}).get("value") or {})}


@router.get("/referral/config")
async def admin_referral_config(admin: dict = Depends(current_admin)):
    return await _ref_cfg()


@router.put("/referral/config")
async def admin_referral_config_put(body: ReferralConfigIn, admin: dict = Depends(current_admin)):
    cur = await _ref_cfg()
    cur.update(body.dict(exclude_unset=True))
    await db.settings.update_one({"key": "referral"}, {"$set": {"key": "referral", "value": cur}}, upsert=True)
    return {"ok": True}


@router.get("/referral/stats")
async def admin_referral_stats(admin: dict = Depends(current_admin)):
    bound_q = {"referred_by": {"$exists": True, "$nin": [None, ""]}}
    total_bound = await db.users.count_documents(bound_q)
    total_rewarded = await db.users.count_documents({"referral_rewarded": True})
    total_inviters = len([x for x in await db.users.distinct("referred_by", bound_q) if x])
    agg = await db.users.aggregate([{"$group": {"_id": None, "pts": {"$sum": "$referral_points_earned"}}}]).to_list(1)
    points_granted = int((agg[0].get("pts") if agg else 0) or 0)
    return {"total_bound": total_bound, "total_rewarded": total_rewarded,
            "total_inviters": total_inviters, "points_granted": points_granted}


@router.get("/referral/records")
async def admin_referral_records(q: str = "", rewarded: str = "", limit: int = 500, admin: dict = Depends(current_admin)):
    query = {"referred_by": {"$exists": True, "$nin": [None, ""]}}
    if rewarded == "yes":
        query["referral_rewarded"] = True
    elif rewarded == "no":
        query["referral_rewarded"] = {"$ne": True}
    rows = await db.users.find(query, {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "referred_by": 1,
                                       "referral_rewarded": 1, "referred_at": 1, "referral_rewarded_at": 1}
                               ).sort("referred_at", -1).to_list(limit)
    inviter_ids = list({r["referred_by"] for r in rows if r.get("referred_by")})
    inviters = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": inviter_ids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    cfg = await _ref_cfg()
    out = []
    ql = q.lower().strip()
    for r in rows:
        inv = inviters.get(r.get("referred_by"), {})
        rw = bool(r.get("referral_rewarded"))
        item = {
            "referee_label": _ref_user_label(r), "referee_account": account_no(r["user_id"]),
            "inviter_label": _ref_user_label(inv), "inviter_account": account_no(r["referred_by"]) if r.get("referred_by") else "",
            "referred_at": r.get("referred_at", ""), "rewarded": rw, "rewarded_at": r.get("referral_rewarded_at", ""),
            "referrer_points": int(cfg["referrer_points"]) if rw else 0, "referee_points": int(cfg["referee_points"]) if rw else 0,
        }
        if ql and ql not in " ".join([item["referee_label"], item["inviter_label"], item["referee_account"], item["inviter_account"]]).lower():
            continue
        out.append(item)
    return out


@router.get("/referral/leaderboard")
async def admin_referral_leaderboard(limit: int = 20, admin: dict = Depends(current_admin)):
    rows = await db.users.find({"referral_invited": {"$gt": 0}},
                               {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "referral_invited": 1, "referral_points_earned": 1}
                               ).sort("referral_invited", -1).to_list(limit)
    return [{"account": account_no(r["user_id"]), "label": _ref_user_label(r),
             "invited": int(r.get("referral_invited") or 0), "points_earned": int(r.get("referral_points_earned") or 0)} for r in rows]


@router.get("/referral/posters")
async def admin_referral_posters(admin: dict = Depends(current_admin)):
    rows = await db.referral_posters.find({}, {"_id": 0}).sort("sort", 1).to_list(100)
    for r in rows:
        r["style"] = r.get("style") or {}
    return rows


@router.post("/referral/posters")
async def admin_referral_poster_create(body: PosterIn, admin: dict = Depends(current_admin)):
    img = body.image
    if body.image_b64:
        img = await upload_b64("gogo589/referral", body.image_b64, body.image_name, max_mb=4)
    if not img:
        raise HTTPException(status_code=400, detail="請上傳海報背景圖")
    doc = {"id": uuid.uuid4().hex[:12], "name": body.name.strip() or "海報模板", "image": img,
           "active": bool(body.active), "sort": int(body.sort), "style": body.style or {},
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.referral_posters.insert_one(dict(doc))
    return doc


@router.put("/referral/posters/{pid}")
async def admin_referral_poster_update(pid: str, body: PosterIn, admin: dict = Depends(current_admin)):
    upd = {"name": body.name.strip() or "海報模板", "active": bool(body.active), "sort": int(body.sort), "style": body.style or {}}
    if body.image_b64:
        upd["image"] = await upload_b64("gogo589/referral", body.image_b64, body.image_name, max_mb=4)
    elif body.image:
        upd["image"] = body.image
    await db.referral_posters.update_one({"id": pid}, {"$set": upd})
    return {"ok": True}


@router.delete("/referral/posters/{pid}")
async def admin_referral_poster_delete(pid: str, admin: dict = Depends(current_admin)):
    await db.referral_posters.delete_one({"id": pid})
    return {"ok": True}


@router.get("/referral/trend")
async def admin_referral_trend(days: int = 14, admin: dict = Depends(current_admin)):
    days = max(1, min(int(days or 14), 60))
    start = _bj.days_ago(days - 1)
    rows = {}
    for i in range(days):
        d = _bj.days_ago(days - 1 - i)
        rows[d] = {"date": d, "bound": 0, "converted": 0}
    async for u in db.users.find({"referred_at": _bj.rng(start)}, {"_id": 0, "referred_at": 1}):
        r = rows.get(_bj.day(u.get("referred_at")))
        if r:
            r["bound"] += 1
    async for u in db.users.find({"referral_rewarded_at": _bj.rng(start)}, {"_id": 0, "referral_rewarded_at": 1}):
        r = rows.get(_bj.day(u.get("referral_rewarded_at")))
        if r:
            r["converted"] += 1
    data = list(rows.values())
    tot_bound = sum(r["bound"] for r in data)
    tot_conv = sum(r["converted"] for r in data)
    all_bound = await db.users.count_documents({"referred_by": {"$nin": [None, ""]}})
    all_conv = await db.users.count_documents({"referral_rewarded": True})
    return {"days": days, "rows": data,
            "period_bound": tot_bound, "period_converted": tot_conv,
            "period_rate": round((tot_conv / tot_bound * 100) if tot_bound else 0, 1),
            "total_bound": all_bound, "total_converted": all_conv,
            "total_rate": round((all_conv / all_bound * 100) if all_bound else 0, 1)}


@router.get("/referral/funnel")
async def admin_referral_funnel(days: int = 14, admin: dict = Depends(current_admin)):
    days = max(1, min(int(days or 14), 60))
    start = _bj.days_ago(days - 1)

    def rate(a, b):
        return round((a / b * 100) if b else 0, 1)

    p_visits = await db.referral_visits.count_documents({"created_at": _bj.rng(start)})
    p_regs = await db.users.count_documents({"referred_at": _bj.rng(start)})
    p_tops = await db.users.count_documents({"referral_rewarded_at": _bj.rng(start)})
    t_visits = await db.referral_visits.count_documents({})
    t_regs = await db.users.count_documents({"referred_by": {"$nin": [None, ""]}})
    t_tops = await db.users.count_documents({"referral_rewarded": True})
    return {"days": days,
            "period": {"visits": p_visits, "registers": p_regs, "topups": p_tops,
                       "reg_rate": rate(p_regs, p_visits), "topup_rate": rate(p_tops, p_regs), "overall_rate": rate(p_tops, p_visits)},
            "total": {"visits": t_visits, "registers": t_regs, "topups": t_tops,
                      "reg_rate": rate(t_regs, t_visits), "topup_rate": rate(t_tops, t_regs), "overall_rate": rate(t_tops, t_visits)}}


@router.get("/referral/weekly/awards")
async def admin_referral_weekly_awards(limit: int = 100, admin: dict = Depends(current_admin)):
    rows = await db.referral_weekly_awards.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    uids = list({r["user_id"] for r in rows})
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1})}
    for r in rows:
        u = users.get(r["user_id"], {})
        r["label"] = _ref_user_label(u)
        r["account"] = account_no(r["user_id"])
        r["reward_label"] = (f"+{r.get('value')} 積分" if r.get("type") == "points" else f"優惠券 {r.get('coupon_code') or '-'}")
    return rows


@router.post("/referral/weekly/run")
async def admin_referral_weekly_run(admin: dict = Depends(current_admin)):
    if run_referral_weekly is None:
        raise HTTPException(status_code=500, detail="weekly settle unavailable")
    await run_referral_weekly()
    return {"ok": True}


# ---------------- 活動中心配置（Activity Center） ----------------
class ActivityCenterIn(BaseModel):
    header_title: str = ""
    header_subtitle: str = ""
    cards: list = []


@router.get("/activity-center")
async def admin_activity_center_get(admin: dict = Depends(current_admin)):
    return await get_activity_center_cfg()


@router.put("/activity-center")
async def admin_activity_center_put(body: ActivityCenterIn, admin: dict = Depends(current_admin)):
    await db.settings.update_one({"key": "activity_center"},
                                 {"$set": {"key": "activity_center", "value": body.dict()}}, upsert=True)
    return {"ok": True}


# ================= 系統配置：RBAC / 管理員 / 操作日誌 / 集成配置 =================
ALL_PERMISSIONS = [
    "overview", "sales-analysis", "download-reports",
    "members", "user-tags", "member-assets", "blacklist", "user-logs", "verifications", "user-batch", "feedback", "user-reports", "chat-sessions",
    "products", "categories", "reviews",
    "giftcard-list", "giftcard-pool", "giftcard-orders", "giftcard-new", "giftcard-trade-query", "giftcard-api", "giftcard-report",
    "home-decoration", "banners", "footer", "recommendations", "promos", "notifications", "announcements",
    "activities",
    "order-settlement", "topups", "payments", "reconciliation", "currencies", "finance-reports",
    "siteconfig", "admins", "roles", "operation-logs", "sms-config", "email-config", "oauth-config", "translations", "paylogos",
]

INTEGRATION_FIELDS = {
    "sms": [
        {"key": "DAGOU_UNAME", "label": "大狗 SMS 用戶名", "secret": False},
        {"key": "DAGOU_KEY", "label": "大狗 SMS 密鑰", "secret": True},
        {"key": "DAGOU_GATEWAY", "label": "大狗 SMS 網關地址", "secret": False},
        {"key": "SUBMAIL_APPID", "label": "SUBMAIL AppID", "secret": False},
        {"key": "SUBMAIL_APPKEY", "label": "SUBMAIL AppKey", "secret": True},
        {"key": "SUBMAIL_PROJECT", "label": "SUBMAIL 模板項目", "secret": False},
    ],
    "email": [
        {"key": "SMTP_HOST", "label": "SMTP 主機", "secret": False},
        {"key": "SMTP_PORT", "label": "SMTP 端口", "secret": False},
        {"key": "SMTP_USER", "label": "SMTP 帳號", "secret": False},
        {"key": "SMTP_PASSWORD", "label": "SMTP 密碼", "secret": True},
        {"key": "MAIL_FROM", "label": "寄件信箱", "secret": False},
        {"key": "MAIL_FROM_NAME", "label": "寄件人名稱", "secret": False},
    ],
    "oauth": [
        {"key": "GOOGLE_CLIENT_ID", "label": "Google Client ID", "secret": False},
        {"key": "GOOGLE_CLIENT_SECRET", "label": "Google Client Secret", "secret": True},
    ],
}
MASK = "••••••"


def _is_super(admin: dict) -> bool:
    if admin.get("admin_super") is True:
        return True
    # legacy / bootstrap: an admin without an assigned non-super role is treated as super
    return not admin.get("admin_role_id") and admin.get("admin_super") is None


async def _admin_perms(admin: dict) -> list:
    if _is_super(admin):
        return list(ALL_PERMISSIONS)
    role = await db.admin_roles.find_one({"id": admin.get("admin_role_id")}, {"_id": 0})
    return [p for p in (role or {}).get("permissions", []) if p in ALL_PERMISSIONS]


async def require_super(admin: dict = Depends(current_admin)) -> dict:
    if not _is_super(admin):
        raise HTTPException(status_code=403, detail="僅超級管理員可操作")
    return admin


@router.get("/me")
async def admin_me(admin: dict = Depends(current_admin)):
    role = await db.admin_roles.find_one({"id": admin.get("admin_role_id")}, {"_id": 0}) if admin.get("admin_role_id") else None
    return {"user_id": admin["user_id"], "email": admin.get("email", ""), "account": account_no(admin["user_id"]),
            "is_super": _is_super(admin), "role_name": (role or {}).get("name") or ("超級管理員" if _is_super(admin) else ""),
            "permissions": await _admin_perms(admin), "all_permissions": ALL_PERMISSIONS}


# ---- Launch reset (wipe test data; super admin only) ----
class LaunchResetIn(BaseModel):
    confirm: str = ""
    keep_admin_emails: List[str] = []


@router.post("/system/launch-reset")
async def admin_launch_reset(body: LaunchResetIn, admin: dict = Depends(require_super)):
    import reset_for_launch
    keep = [e.strip().lower() for e in body.keep_admin_emails if e.strip()]
    if keep and (admin.get("email") or "").lower() not in keep:
        raise HTTPException(status_code=400, detail="保留名單必須包含您自己的帳號")
    items = await reset_for_launch.plan(db, keep or None)
    preview = {c: n for c, _, n in items}
    if body.confirm != "RESET":
        return {"preview": preview}
    r = await reset_for_launch.execute(db, items)
    logger.warning("launch reset by %s: %s", admin.get("email"), r["deleted"])
    return {"ok": True, **r}



# ---- Roles ----
class RoleIn(BaseModel):
    name: str
    permissions: list = []


@router.get("/roles")
async def admin_roles_list(admin: dict = Depends(require_super)):
    rows = await db.admin_roles.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
    for r in rows:
        r["admin_count"] = await db.users.count_documents({"role": "admin", "admin_role_id": r["id"]})
    return rows


@router.post("/roles")
async def admin_role_create(body: RoleIn, admin: dict = Depends(require_super)):
    perms = [p for p in body.permissions if p in ALL_PERMISSIONS]
    doc = {"id": uuid.uuid4().hex[:12], "name": body.name.strip() or "角色", "permissions": perms, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.admin_roles.insert_one(dict(doc))
    return doc


@router.put("/roles/{rid}")
async def admin_role_update(rid: str, body: RoleIn, admin: dict = Depends(require_super)):
    perms = [p for p in body.permissions if p in ALL_PERMISSIONS]
    await db.admin_roles.update_one({"id": rid}, {"$set": {"name": body.name.strip() or "角色", "permissions": perms}})
    return {"ok": True}


@router.delete("/roles/{rid}")
async def admin_role_delete(rid: str, admin: dict = Depends(require_super)):
    await db.users.update_many({"admin_role_id": rid}, {"$unset": {"admin_role_id": ""}})
    await db.admin_roles.delete_one({"id": rid})
    return {"ok": True}


# ---- Admin passwords ----
class AdminChangePwIn(BaseModel):
    old_password: str
    new_password: str


class AdminResetPwIn(BaseModel):
    new_password: str


PW_RULE = "密碼需 8~32 位，且同時包含字母與數字"


def _admin_pw_ok(p: str) -> bool:
    return 8 <= len(p) <= 32 and bool(re.search(r"[0-9]", p)) and bool(re.search(r"[a-zA-Z]", p))


async def _set_clerk_password(uid: str, new_password: str):
    await local_auth.set_password(uid, new_password, sign_out_others=True)


@router.post("/me/password")
async def admin_change_own_password(body: AdminChangePwIn, admin: dict = Depends(current_admin)):
    if not _admin_pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    if body.new_password == body.old_password:
        raise HTTPException(status_code=400, detail="新密碼不可與舊密碼相同")
    if not await local_auth.verify_password(admin, body.old_password):
        raise HTTPException(status_code=401, detail="舊密碼錯誤")
    await _set_clerk_password(admin["user_id"], body.new_password)
    await record_admin_log(admin["user_id"], admin.get("email", ""), "PASSWORD", "管理員修改自己的密碼", 200)
    return {"ok": True, "token": await local_auth.token_for(admin["user_id"])}


@router.post("/admins/{uid}/password")
async def admin_reset_password(uid: str, body: AdminResetPwIn, admin: dict = Depends(require_super)):
    if not _admin_pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    target = await db.users.find_one({"user_id": uid}, {"_id": 0, "email": 1, "role": 1})
    if not target or target.get("role") != "admin":
        raise HTTPException(status_code=404, detail="管理員不存在")
    await _set_clerk_password(uid, body.new_password)
    await record_admin_log(admin["user_id"], admin.get("email", ""), "PASSWORD", f"重設管理員密碼 {target.get('email', uid)}", 200)
    return {"ok": True}


# ---- Admins ----
class PromoteIn(BaseModel):
    email: str
    role_id: str = ""


class AssignRoleIn(BaseModel):
    role_id: str = ""
    is_super: bool = False


@router.get("/admins")
async def admin_admins_list(admin: dict = Depends(require_super)):
    rows = await db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1, "email": 1, "phone": 1, "admin_super": 1, "admin_role_id": 1, "created_at": 1}).to_list(200)
    roles = {r["id"]: r async for r in db.admin_roles.find({}, {"_id": 0, "id": 1, "name": 1})}
    out = []
    for r in rows:
        twofa = await db.admin_2fa.find_one({"user_id": r["user_id"], "enabled": True}, {"_id": 1})
        out.append({"user_id": r["user_id"], "email": _ref_user_label(r), "account": account_no(r["user_id"]),
                    "is_super": _is_super(r), "role_id": r.get("admin_role_id") or "",
                    "role_name": roles.get(r.get("admin_role_id"), {}).get("name", ""),
                    "twofa": bool(twofa), "is_self": r["user_id"] == admin["user_id"], "created_at": r.get("created_at", "")})
    return out


class AdminCreateIn(BaseModel):
    email: str
    password: str
    role_id: str = ""


@router.post("/admins/create")
async def admin_admins_create(body: AdminCreateIn, admin: dict = Depends(require_super)):
    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="請輸入正確的信箱")
    if not email_auth._pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    if await local_auth.find_by_email(email):
        raise HTTPException(status_code=409, detail="此信箱已有帳號，請改用「提升為管理員」")
    u = await local_auth.create_user(email=email, password=body.password, role="admin", admin_super=False, admin_role_id=body.role_id or "")
    return {"ok": True, "user_id": u["user_id"]}


@router.post("/admins/promote")
async def admin_admins_promote(body: PromoteIn, admin: dict = Depends(require_super)):
    email = body.email.strip().lower()
    u = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "role": 1})
    if not u:
        raise HTTPException(status_code=404, detail="找不到該用戶，請先讓對方用此信箱註冊帳號")
    upd = {"role": "admin"}
    if body.role_id:
        upd["admin_role_id"] = body.role_id
        upd["admin_super"] = False
    await db.users.update_one({"user_id": u["user_id"]}, {"$set": upd})
    return {"ok": True}


@router.post("/admins/{uid}/role")
async def admin_admins_set_role(uid: str, body: AssignRoleIn, admin: dict = Depends(require_super)):
    if body.is_super:
        await db.users.update_one({"user_id": uid}, {"$set": {"admin_super": True}, "$unset": {"admin_role_id": ""}})
    else:
        if uid == admin["user_id"]:
            raise HTTPException(status_code=400, detail="不能降級自己的超級管理員權限")
        await db.users.update_one({"user_id": uid}, {"$set": {"admin_super": False, "admin_role_id": body.role_id or ""}})
    return {"ok": True}


@router.post("/admins/{uid}/revoke")
async def admin_admins_revoke(uid: str, admin: dict = Depends(require_super)):
    if uid == admin["user_id"]:
        raise HTTPException(status_code=400, detail="不能撤銷自己的管理員權限")
    supers = await db.users.count_documents({"role": "admin", "admin_super": True})
    target = await db.users.find_one({"user_id": uid}, {"_id": 0, "admin_super": 1, "admin_role_id": 1})
    if target and _is_super(target) and supers <= 1:
        raise HTTPException(status_code=400, detail="至少需保留一位超級管理員")
    await db.users.update_one({"user_id": uid}, {"$set": {"role": "user"}, "$unset": {"admin_super": "", "admin_role_id": ""}})
    return {"ok": True}


# ---- Operation logs ----
@router.get("/operation-logs")
async def admin_operation_logs(q: str = "", method: str = "", page: int = 1, size: int = 50, admin: dict = Depends(require_super)):
    page, size = max(1, page), min(max(1, size), 200)
    query = {}
    if method:
        query["method"] = method
    if q:
        query["$or"] = [{"path": {"$regex": re.escape(q)}}, {"admin_email": {"$regex": re.escape(q), "$options": "i"}}, {"detail": {"$regex": re.escape(q), "$options": "i"}}]
    total = await db.admin_logs.count_documents(query)
    rows = await db.admin_logs.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * size).limit(size).to_list(size)
    return {"rows": rows, "total": total, "page": page, "size": size}


@router.get("/operation-logs/export")
async def admin_operation_logs_export(q: str = "", method: str = "", admin: dict = Depends(require_super)):
    query = {}
    if method:
        query["method"] = method
    if q:
        query["$or"] = [{"path": {"$regex": re.escape(q)}}, {"admin_email": {"$regex": re.escape(q), "$options": "i"}}, {"detail": {"$regex": re.escape(q), "$options": "i"}}]
    rows = await db.admin_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(5000).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["time", "admin", "method", "path", "status", "detail"])
    for r in rows:
        w.writerow([r.get("created_at", ""), r.get("admin_email", ""), r.get("method", ""), r.get("path", ""), r.get("status", ""), r.get("detail", "")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=operation_logs.csv"})


# ---- Integration settings (sms / email / oauth) ----
class IntegrationIn(BaseModel):
    group: str
    values: dict = {}


class IntegrationTestIn(BaseModel):
    group: str
    target: str


def _mask(val: str) -> str:
    if not val:
        return ""
    return MASK + val[-4:] if len(val) > 4 else MASK


@router.get("/integration-settings")
async def admin_integration_get(group: str, admin: dict = Depends(require_super)):
    fields = INTEGRATION_FIELDS.get(group)
    if not fields:
        raise HTTPException(status_code=400, detail="未知配置組")
    out = []
    for f in fields:
        val = os.environ.get(f["key"], "") or ""
        db_set = bool(await db.integration_settings.find_one({"key": f["key"]}, {"_id": 1}))
        out.append({"key": f["key"], "label": f["label"], "secret": f["secret"], "set": bool(val),
                    "source": "db" if db_set else ("env" if val else "none"),
                    "value": _mask(val) if f["secret"] else val})
    return {"group": group, "fields": out}


@router.put("/integration-settings")
async def admin_integration_put(body: IntegrationIn, admin: dict = Depends(require_super)):
    fields = {f["key"]: f for f in INTEGRATION_FIELDS.get(body.group, [])}
    if not fields:
        raise HTTPException(status_code=400, detail="未知配置組")
    changed = 0
    for key, val in (body.values or {}).items():
        if key not in fields:
            continue
        val = (val or "").strip()
        if not val or val.startswith(MASK):
            continue  # unchanged / masked placeholder
        await db.integration_settings.update_one({"key": key}, {"$set": {"key": key, "value": val, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        os.environ[key] = val
        changed += 1
    return {"ok": True, "changed": changed}


@router.post("/integration-settings/test")
async def admin_integration_test(body: IntegrationTestIn, admin: dict = Depends(require_super)):
    try:
        if body.group == "sms":
            await send_sms_text(body.target, "【GOGO589】測試短信：您的後台短信配置已生效。")
            return {"ok": True, "message": "測試短信已發送"}
        if body.group == "email":
            await send_mail(body.target, "GOGO589 測試郵件", "<p>您的後台郵箱配置已生效。</p>", "您的後台郵箱配置已生效。")
            return {"ok": True, "message": "測試郵件已發送"}
        raise HTTPException(status_code=400, detail="該配置組不支持測試")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"發送失敗：{str(e)[:160]}")


async def load_integration_settings():
    """Load DB-stored integration secrets into the process env (DB overrides .env)."""
    try:
        async for s in db.integration_settings.find({}, {"_id": 0, "key": 1, "value": 1}):
            if s.get("value"):
                os.environ[s["key"]] = s["value"]
    except Exception as e:
        logger.error("load_integration_settings failed: %s", e)


async def record_admin_log(uid: str, email: str, method: str, path: str, status: int, detail: str = ""):
    try:
        if not email and uid:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0, "email": 1})
            email = (u or {}).get("email", "")
        await db.admin_logs.insert_one({"id": uuid.uuid4().hex, "admin_user_id": uid, "admin_email": email,
                                        "method": method, "path": path, "status": status, "detail": detail,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass


# ================= 財務管理：訂單結算 / 財務對賬 =================
def _since(days: int) -> str:
    days = max(1, min(int(days or 30), 365))
    return _bj.days_ago(days - 1)


@router.get("/finance/settlement")
async def admin_finance_settlement(days: int = 30, settled: str = "", limit: int = 500, admin: dict = Depends(current_admin)):
    start = _since(days)
    query = {"status": {"$in": ["paid", "processing", "shipped", "completed"]}, "created_at": _bj.rng(start)}
    if settled == "yes":
        query["settled"] = True
    elif settled == "no":
        query["settled"] = {"$ne": True}
    rows = await db.orders.find(query, {"_id": 0, "id": 1, "user_id": 1, "total_usd": 1, "status": 1, "settled": 1, "settled_at": 1, "created_at": 1}).sort("created_at", -1).to_list(limit)
    out = []
    for r in rows:
        out.append({"id": r["id"], "user_id": r.get("user_id", ""), "account": account_no(r.get("user_id", "")), "total_usd": round(float(r.get("total_usd") or 0), 2),
                    "status": r.get("status"), "settled": bool(r.get("settled")), "settled_at": r.get("settled_at", ""), "created_at": r.get("created_at", "")})
    total_amt = round(sum(r["total_usd"] for r in out), 2)
    settled_amt = round(sum(r["total_usd"] for r in out if r["settled"]), 2)
    return {"rows": out, "count": len(out), "total_amount": total_amt, "settled_amount": settled_amt,
            "unsettled_amount": round(total_amt - settled_amt, 2),
            "unsettled_count": len([r for r in out if not r["settled"]])}


class SettleIn(BaseModel):
    order_ids: list = []
    unsettle: bool = False


@router.post("/finance/settle")
async def admin_finance_settle(body: SettleIn, admin: dict = Depends(current_admin)):
    ids = [str(x) for x in (body.order_ids or [])]
    if not ids:
        raise HTTPException(status_code=400, detail="請選擇訂單")
    if body.unsettle:
        await db.orders.update_many({"id": {"$in": ids}}, {"$set": {"settled": False}, "$unset": {"settled_at": ""}})
    else:
        await db.orders.update_many({"id": {"$in": ids}}, {"$set": {"settled": True, "settled_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "count": len(ids)}


@router.get("/finance/reconciliation")
async def admin_finance_reconciliation(days: int = 30, admin: dict = Depends(current_admin)):
    start = _since(days)
    tp = await db.topup_orders.aggregate([
        {"$match": {"created_at": _bj.rng(start)}},
        {"$group": {"_id": {"provider": "$provider", "status": "$status"}, "count": {"$sum": 1}, "amount": {"$sum": "$amount_usd"}}},
    ]).to_list(200)
    topups = [{"provider": r["_id"].get("provider") or "-", "status": r["_id"].get("status") or "-", "count": r["count"], "amount": round(float(r.get("amount") or 0), 2)} for r in tp]
    topups.sort(key=lambda x: (x["provider"], x["status"]))
    od = await db.orders.aggregate([
        {"$match": {"created_at": _bj.rng(start)}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "amount": {"$sum": "$total_usd"}}},
    ]).to_list(50)
    orders = [{"status": r["_id"] or "-", "count": r["count"], "amount": round(float(r.get("amount") or 0), 2)} for r in od]
    orders.sort(key=lambda x: x["status"])
    topup_paid = round(sum(t["amount"] for t in topups if t["status"] == "paid"), 2)
    topup_pending = round(sum(t["amount"] for t in topups if t["status"] == "pending"), 2)
    order_revenue = round(sum(o["amount"] for o in orders if o["status"] in ("paid", "processing", "shipped", "completed")), 2)
    return {"topups": topups, "orders": orders, "topup_paid": topup_paid, "topup_pending": topup_pending,
            "topup_pending_count": sum(t["count"] for t in topups if t["status"] == "pending"), "order_revenue": order_revenue}


# ================= 儀表盤：銷售分析 / 實時監控 ；用戶：批量 / 報表 =================
@router.get("/analytics/sales")
async def admin_analytics_sales(date_from: str = "", date_to: str = "", tz_offset: int = 0, admin: dict = Depends(current_admin)):
    """date_from/date_to 為使用者本地日期(YYYY-MM-DD, 含兩端)；tz_offset = JS getTimezoneOffset() 分鐘。"""
    off = timedelta(minutes=max(-840, min(840, tz_offset)))
    now_local = datetime.now(timezone.utc) - off
    try:
        d_to = datetime.strptime(date_to, "%Y-%m-%d") if date_to else now_local.replace(tzinfo=None)
        d_from = datetime.strptime(date_from, "%Y-%m-%d") if date_from else d_to - timedelta(days=29)
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式錯誤")
    d_from, d_to = d_from.replace(hour=0, minute=0, second=0, microsecond=0), d_to.replace(hour=0, minute=0, second=0, microsecond=0)
    if d_from > d_to:
        d_from, d_to = d_to, d_from
    ndays = min((d_to - d_from).days + 1, 366)
    d_to = d_from + timedelta(days=ndays - 1)
    start = (d_from.replace(tzinfo=timezone.utc) + off).isoformat()
    end = (d_to.replace(tzinfo=timezone.utc) + off + timedelta(days=1)).isoformat()
    prev_start = (d_from.replace(tzinfo=timezone.utc) + off - timedelta(days=ndays)).isoformat()
    nt = {"$nin": await _test_uids()}
    rng = {"created_at": {"$gte": start, "$lt": end}, "user_id": nt}
    hourly = ndays == 1

    def bucket(created: str) -> str:
        try:
            t = datetime.fromisoformat(created.replace("Z", "+00:00")) - off
        except Exception:
            return ""
        return t.strftime("%H:00") if hourly else t.strftime("%m-%d")

    keys = [f"{h:02d}:00" for h in range(24)] if hourly else [(d_from + timedelta(days=i)).strftime("%m-%d") for i in range(ndays)]
    series = {k: {"label": k, "orders": 0, "paid_orders": 0, "revenue_usd": 0.0, "topup_usd": 0.0, "topups": 0, "new_users": 0, "first_topup_users": 0} for k in keys}
    status_dist: dict = {}
    product_rev: dict = {}
    orders_n = paid_n = 0
    revenue = 0.0
    async for o in db.orders.find(rng, {"_id": 0, "created_at": 1, "status": 1, "total_usd": 1, "items": 1}):
        st = o.get("status") or "-"
        status_dist[st] = status_dist.get(st, 0) + 1
        paid = st in PAID_STATUSES
        r = series.get(bucket(o.get("created_at", "")))
        orders_n += 1
        if r:
            r["orders"] += 1
        if paid:
            paid_n += 1
            amt = float(o.get("total_usd") or 0)
            revenue += amt
            if r:
                r["paid_orders"] += 1
                r["revenue_usd"] += amt
            for it in o.get("items", []):
                p = product_rev.setdefault(it.get("product_id") or it.get("product_name"), {"name": it.get("product_name") or "-", "qty": 0, "amount": 0.0})
                q = int(it.get("quantity") or 1)
                p["qty"] += q
                p["amount"] += float(it.get("line_usd") or 0) or float(it.get("unit_price_usd") or it.get("price_usd") or 0) * q
    topups_n = 0
    topup_usd = 0.0
    channels: dict = {}
    first_seen: dict = {}
    async for t in db.topup_orders.find({**rng, "status": "paid"}, {"_id": 0, "created_at": 1, "amount_usd": 1, "provider": 1, "user_id": 1}, sort=[("created_at", 1)]):
        amt = float(t.get("amount_usd") or 0)
        topups_n += 1
        if t.get("user_id") and t["user_id"] not in first_seen:
            first_seen[t["user_id"]] = t.get("created_at", "")
        topup_usd += amt
        r = series.get(bucket(t.get("created_at", "")))
        if r:
            r["topups"] += 1
            r["topup_usd"] += amt
        c = channels.setdefault(t.get("provider") or "-", {"provider": t.get("provider") or "-", "count": 0, "amount": 0.0})
        c["count"] += 1
        c["amount"] += amt
    # 首次充值人數：期間內有到帳充值、且在期間開始前從未有過到帳充值的用戶
    if first_seen:
        earlier = set(await db.topup_orders.distinct("user_id", {"user_id": {"$in": list(first_seen)}, "status": "paid", "created_at": {"$lt": start}}))
        for uid, created in first_seen.items():
            if uid not in earlier:
                r = series.get(bucket(created))
                if r:
                    r["first_topup_users"] += 1
        first_topup_users = len(set(first_seen) - earlier)
    else:
        first_topup_users = 0
    urng = {"created_at": rng["created_at"], "is_test": {"$ne": True}}
    async for u in db.users.find(urng, {"_id": 0, "created_at": 1}):
        r = series.get(bucket(u.get("created_at", "")))
        if r:
            r["new_users"] += 1
    new_users = await db.users.count_documents(urng)
    prev = await _period_stats(prev_start, start)
    prev_first = await db.topup_orders.distinct("user_id", {"status": "paid", "created_at": {"$gte": prev_start, "$lt": start}, "user_id": nt})
    if prev_first:
        prev_earlier = set(await db.topup_orders.distinct("user_id", {"user_id": {"$in": prev_first}, "status": "paid", "created_at": {"$lt": prev_start}}))
        prev["first_topup_users"] = len(set(prev_first) - prev_earlier)
    else:
        prev["first_topup_users"] = 0
    for r in series.values():
        r["revenue_usd"] = round(r["revenue_usd"], 2)
        r["topup_usd"] = round(r["topup_usd"], 2)
    products = sorted(product_rev.values(), key=lambda x: -x["amount"])[:15]
    for p in products:
        p["amount"] = round(p["amount"], 2)
    return {
        "date_from": d_from.strftime("%Y-%m-%d"), "date_to": d_to.strftime("%Y-%m-%d"), "days": ndays, "hourly": hourly,
        "summary": {"orders": orders_n, "paid_orders": paid_n, "revenue_usd": round(revenue, 2), "avg_order_usd": round(revenue / paid_n, 2) if paid_n else 0,
                    "topups": topups_n, "topup_usd": round(topup_usd, 2), "new_users": new_users, "first_topup_users": first_topup_users},
        "prev": prev,
        "series": list(series.values()),
        "status_dist": [{"status": k, "count": v} for k, v in sorted(status_dist.items(), key=lambda x: -x[1])],
        "top_products": products,
        "channels": [{**c, "amount": round(c["amount"], 2)} for c in sorted(channels.values(), key=lambda x: -x["amount"])],
    }


@router.get("/analytics/realtime")
async def admin_analytics_realtime(admin: dict = Depends(current_admin)):
    today = _bj.today()
    tq = {"created_at": _bj.today_q()}
    paid = {"status": {"$in": ["paid", "processing", "shipped", "completed"]}}
    rev = await db.orders.aggregate([{"$match": {**tq, **paid}}, {"$group": {"_id": None, "a": {"$sum": "$total_usd"}}}]).to_list(1)
    tp = await db.topup_orders.aggregate([{"$match": {**tq, "status": "paid"}}, {"$group": {"_id": None, "a": {"$sum": "$amount_usd"}}}]).to_list(1)
    orders = await db.orders.find(tq, {"_id": 0, "id": 1, "user_id": 1, "total_usd": 1, "status": 1, "created_at": 1}).sort("created_at", -1).to_list(15)
    for o in orders:
        o["account"] = account_no(o.get("user_id", ""))
    return {"today": today,
            "orders_today": await db.orders.count_documents(tq),
            "revenue_today": round(float(rev[0]["a"]) if rev else 0, 2),
            "topups_today": await db.topup_orders.count_documents({**tq, "status": "paid"}),
            "topup_amount_today": round(float(tp[0]["a"]) if tp else 0, 2),
            "new_users_today": await db.users.count_documents(tq),
            "pending_topups": await db.topup_orders.count_documents({"status": "pending"}),
            "recent_orders": orders}


class UserBatchIn(BaseModel):
    user_ids: list = []
    action: str
    value: str = ""


@router.post("/users/batch")
async def admin_users_batch(body: UserBatchIn, admin: dict = Depends(current_admin)):
    ids = [str(x) for x in (body.user_ids or [])]
    if not ids:
        raise HTTPException(status_code=400, detail="請選擇用戶")
    act = body.action
    if act == "ban":
        await db.users.update_many({"user_id": {"$in": ids}}, {"$set": {"banned": True}})
    elif act == "unban":
        await db.users.update_many({"user_id": {"$in": ids}}, {"$set": {"banned": False}})
    elif act == "add_tag" and body.value.strip():
        await db.users.update_many({"user_id": {"$in": ids}}, {"$addToSet": {"tags": body.value.strip()}})
    elif act == "add_points":
        pts = int(float(body.value or 0))
        for uid in ids:
            await db.users.update_one({"user_id": uid}, {"$inc": {"points": pts}})
            await db.point_transactions.insert_one({"id": uuid.uuid4().hex, "user_id": uid, "delta": pts, "source": "admin_batch", "reason": "後台批量發放", "created_at": datetime.now(timezone.utc).isoformat()})
    else:
        raise HTTPException(status_code=400, detail="未知操作")
    return {"ok": True, "count": len(ids)}


@router.get("/user-reports")
async def admin_user_reports(days: int = 30, admin: dict = Depends(current_admin)):
    start = _since(days)
    total = await db.users.count_documents({})
    new_in = await db.users.count_documents({"created_at": _bj.rng(start)})
    banned = await db.users.count_documents({"banned": True})
    levels = await db.users.aggregate([{"$group": {"_id": "$level_name", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]).to_list(20)
    spenders = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["paid", "processing", "shipped", "completed"]}}},
        {"$group": {"_id": "$user_id", "spent": {"$sum": "$total_usd"}, "orders": {"$sum": 1}}},
        {"$sort": {"spent": -1}}, {"$limit": 15},
    ]).to_list(15)
    top = [{"account": account_no(r["_id"] or ""), "spent": round(float(r["spent"] or 0), 2), "orders": r["orders"]} for r in spenders]
    return {"total_users": total, "new_users": new_in, "banned": banned,
            "levels": [{"name": l["_id"] or "普通會員", "count": l["count"]} for l in levels], "top_spenders": top}
