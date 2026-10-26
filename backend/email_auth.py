"""Email / phone OTP + password auth. Sessions are our own JWTs (see local_auth.py); no third-party provider."""
import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr

import ipgeo
import local_auth
from local_auth import require_user
from mailer import send_mail, otp_email
from sms import send_sms_code

logger = logging.getLogger("email_auth")
router = APIRouter(prefix="/api/auth/email")
CODE_TTL_MIN = 10
RESEND_SECONDS = 90
MAX_PER_HOUR = 6
MAX_ATTEMPTS = 5
PURPOSES = ("login", "register", "reset", "change_password", "bind")
TEST_SUFFIX = "+clerk_test@"
TEST_PHONE_PREFIX = "+1201555"
PHONE_DOMAIN = local_auth.PHONE_DOMAIN
TEST_CODE = "424242"
PW_RULE = "密碼長度為8~32位，數字、字母、符號至少包含兩種"
db = None  # injected from server.py


def _now():
    return datetime.now(timezone.utc)


def _hash(email: str, code: str) -> str:
    return hmac.new(local_auth.secret().encode(), f"{email.lower()}:{code}".encode(), hashlib.sha256).hexdigest()


def _pw_ok(p: str) -> bool:
    if not 8 <= len(p) <= 32:
        return False
    return sum(bool(re.search(r, p)) for r in (r"[0-9]", r"[a-zA-Z]", r"[^0-9a-zA-Z]")) >= 2


async def _find_user(identifier: str) -> Optional[dict]:
    return await local_auth.find_by_identifier(identifier)


async def _ticket(user_id: str) -> str:
    return await local_auth.token_for(user_id)


def _primary_contact(u: dict) -> str:
    """Primary contact for OTP: real email, or the phone for phone-registered accounts."""
    return local_auth.real_email(u.get("email", "")) or u.get("phone", "")


class SendIn(BaseModel):
    email: EmailStr
    purpose: str = "login"


class VerifyIn(BaseModel):
    email: EmailStr
    code: str


class ResetIn(VerifyIn):
    new_password: str


class RegisterIn(VerifyIn):
    password: str


class PasswordLoginIn(BaseModel):
    identifier: str
    password: str


class SetPwIn(BaseModel):
    password: str


class ChangePwIn(BaseModel):
    code: str
    new_password: str


class ChangePwByOldIn(BaseModel):
    current_password: str = ""
    new_password: str


async def _issue_code(email: str, purpose: str) -> dict:
    email = email.lower()
    now = _now()
    last = await db.email_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)])
    if last and (now - datetime.fromisoformat(last["created_at"])).total_seconds() < RESEND_SECONDS:
        raise HTTPException(status_code=429, detail=f"請 {RESEND_SECONDS} 秒後再重新發送")
    hour_ago = (now - timedelta(hours=1)).isoformat()
    if await db.email_codes.count_documents({"email": email, "created_at": {"$gt": hour_ago}}) >= MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="發送過於頻繁，請稍後再試")
    is_phone = email.startswith("+")
    is_test = TEST_SUFFIX in email or (is_phone and email.startswith(TEST_PHONE_PREFIX))
    code = TEST_CODE if is_test else f"{secrets.randbelow(900000) + 100000}"
    await db.email_codes.delete_many({"email": email, "purpose": purpose})
    await db.email_codes.insert_one({"email": email, "purpose": purpose, "hash": _hash(email, code), "attempts": 0,
                                     "created_at": now.isoformat(), "expires_at": (now + timedelta(minutes=CODE_TTL_MIN)).isoformat()})
    if not is_test:
        try:
            if is_phone:
                await send_sms_code(email, code, CODE_TTL_MIN)
            else:
                subject, html, text = otp_email(code, purpose, CODE_TTL_MIN)
                await send_mail(email, subject, html, text)
        except Exception as e:
            logger.error("otp send failed: %s", e)
            await db.email_codes.delete_many({"email": email, "purpose": purpose})
            raise HTTPException(status_code=503, detail="簡訊發送失敗，請稍後再試" if is_phone else "郵件發送失敗，請稍後再試")
    return {"sent": True, "resend_after": RESEND_SECONDS, "expires_in": CODE_TTL_MIN * 60}


async def _consume_code(email: str, purpose: str, code: str):
    email = email.lower()
    rec = await db.email_codes.find_one({"email": email, "purpose": purpose})
    if not rec or datetime.fromisoformat(rec["expires_at"]) < _now():
        raise HTTPException(status_code=400, detail="驗證碼已過期，請重新發送")
    if rec["attempts"] >= MAX_ATTEMPTS:
        await db.email_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=400, detail="錯誤次數過多，請重新發送驗證碼")
    if not hmac.compare_digest(rec["hash"], _hash(email, code.strip())):
        await db.email_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="驗證碼錯誤")
    await db.email_codes.delete_one({"_id": rec["_id"]})


def _session(uid: str, token: str, **extra) -> dict:
    return {"token": token, "ticket": token, "user_id": uid, **extra}


@router.post("/send-code")
async def send_code(body: SendIn):
    if body.purpose not in PURPOSES:
        raise HTTPException(status_code=400, detail="invalid purpose")
    user = await _find_user(body.email.lower())
    if body.purpose in ("login", "reset") and not user:
        raise HTTPException(status_code=404, detail="此信箱尚未註冊，請先註冊")
    if body.purpose == "register" and user:
        raise HTTPException(status_code=409, detail="此信箱已註冊，請直接登入")
    res = await _issue_code(body.email, body.purpose)
    return {**res, "is_new": user is None}


@router.post("/verify")
async def verify_login(body: VerifyIn):
    email = body.email.lower()
    await _consume_code(email, "login", body.code)
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="此信箱尚未註冊，請先註冊")
    _not_banned(user)
    return _session(user["user_id"], await _ticket(user["user_id"]), is_new=False)


@router.post("/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    await _consume_code(email, "register", body.code)
    if await _find_user(email):
        raise HTTPException(status_code=409, detail="此信箱已註冊，請直接登入")
    u = await local_auth.create_user(email=email, password=body.password)
    return _session(u["user_id"], await _ticket(u["user_id"]))


def _ip(request: Request) -> str:
    return ipgeo.client_ip(request)


def _not_banned(user: dict):
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="帳號已被停用")


@router.post("/password-login")
async def password_login(body: PasswordLoginIn, request: Request):
    ident = body.identifier.strip().lower()
    ip = _ip(request)
    local_auth.fail_guard(ident, ip)
    user = await _find_user(ident)
    if not user:
        local_auth.fail_mark(ident, ip)
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    _not_banned(user)
    if not await local_auth.verify_password(user, body.password):
        local_auth.fail_mark(ident, ip)
        if not await local_auth.has_password(user):
            raise HTTPException(status_code=400, detail="此帳號尚未設定密碼，請使用驗證碼登入")
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    local_auth.fail_clear(ident)
    return _session(user["user_id"], await _ticket(user["user_id"]))


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    email = body.email.lower()
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    await _consume_code(email, "reset", body.code)
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="此信箱尚未註冊")
    await local_auth.set_password(user["user_id"], body.new_password, sign_out_others=True)
    return _session(user["user_id"], await _ticket(user["user_id"]))


@router.post("/me/send-code")
async def me_send_code(user: dict = Depends(require_user)):
    u = await local_auth.get_user(user["user_id"]) or {}
    email = _primary_contact(u)
    if not email:
        raise HTTPException(status_code=400, detail="帳號未綁定信箱")
    res = await _issue_code(email, "change_password")
    masked = email[:4] + "****" + email[-3:] if email.startswith("+") else email[:2] + "***" + email[email.index("@"):]
    return {**res, "email": masked}


@router.post("/me/change-password")
async def me_change_password(body: ChangePwIn, user: dict = Depends(require_user)):
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    u = await local_auth.get_user(user["user_id"]) or {}
    await _consume_code(_primary_contact(u), "change_password", body.code)
    await local_auth.set_password(user["user_id"], body.new_password)
    return {"ok": True, "token": await _ticket(user["user_id"])}


@router.post("/me/set-password")
async def me_set_password(body: SetPwIn, user: dict = Depends(require_user)):
    """First-time password for accounts registered by phone (no code needed while no password exists)."""
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    u = await local_auth.get_user(user["user_id"]) or {}
    if await local_auth.has_password(u):
        raise HTTPException(status_code=409, detail="帳號已設定密碼，請使用修改密碼")
    await local_auth.set_password(user["user_id"], body.password)
    return {"ok": True, "token": await _ticket(user["user_id"])}


# ----------------------------- Phone -----------------------------
def _phone_placeholder_email(phone: str) -> str:
    return f"p{phone.lstrip('+')}@{PHONE_DOMAIN}"


def _check_phone(phone: str) -> str:
    phone = re.sub(r"[\s-]", "", phone)
    if not re.fullmatch(r"\+[1-9]\d{6,14}", phone):
        raise HTTPException(status_code=400, detail="請輸入正確的手機號碼")
    return phone


async def _phone_user(phone: str) -> Optional[dict]:
    return await local_auth.find_by_phone(phone)


class PhoneSendIn(BaseModel):
    phone: str
    purpose: str = "login"


class PhoneVerifyIn(BaseModel):
    phone: str
    code: str


class PhoneRegisterIn(PhoneVerifyIn):
    password: str


@router.post("/phone/send-code")
async def phone_send_code(body: PhoneSendIn):
    if body.purpose not in ("login", "register", "reset"):
        raise HTTPException(status_code=400, detail="invalid purpose")
    phone = _check_phone(body.phone)
    exists = await _phone_user(phone) is not None
    if body.purpose in ("login", "reset") and not exists:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊，請先註冊")
    if body.purpose == "register" and exists:
        raise HTTPException(status_code=409, detail="此手機號已註冊，請直接登入")
    return await _issue_code(phone, body.purpose)


@router.post("/phone/register")
async def phone_register(body: PhoneRegisterIn):
    phone = _check_phone(body.phone)
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    await _consume_code(phone, "register", body.code)
    if await _phone_user(phone):
        raise HTTPException(status_code=409, detail="此手機號已註冊，請直接登入")
    u = await local_auth.create_user(phone=phone, password=body.password)
    return _session(u["user_id"], await _ticket(u["user_id"]))


@router.post("/phone/verify")
async def phone_verify(body: PhoneVerifyIn):
    phone = _check_phone(body.phone)
    await _consume_code(phone, "login", body.code)
    user = await _phone_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊，請先註冊")
    _not_banned(user)
    return _session(user["user_id"], await _ticket(user["user_id"]))


@router.post("/phone/reset-password")
async def phone_reset_password(body: PhoneRegisterIn):
    phone = _check_phone(body.phone)
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    await _consume_code(phone, "reset", body.code)
    user = await _phone_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊")
    await local_auth.set_password(user["user_id"], body.password, sign_out_others=True)
    return _session(user["user_id"], await _ticket(user["user_id"]))


# ----------------------------- Google OAuth (own client, code flow) -----------------------------
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
class GoogleIn(BaseModel):
    code: str
    redirect_uri: str


@router.post("/google")
async def google_login(body: GoogleIn):
    async with httpx.AsyncClient(timeout=20) as c:
        tok = await c.post("https://oauth2.googleapis.com/token", data={
            "code": body.code, "client_id": os.environ["GOOGLE_CLIENT_ID"], "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": body.redirect_uri, "grant_type": "authorization_code"})
        if tok.status_code != 200:
            logger.warning("google token exchange failed: %s", tok.text[:300])
            raise HTTPException(status_code=400, detail="Google 授權失敗，請重試")
        info = await c.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
    if info.status_code != 200:
        raise HTTPException(status_code=400, detail="無法取得 Google 帳號資料")
    g = info.json()
    email = (g.get("email") or "").lower()
    if not email or not g.get("email_verified", True):
        raise HTTPException(status_code=400, detail="Google 帳號未綁定已驗證的信箱")
    user = await _find_user(email)
    is_new = user is None
    if is_new:
        name = " ".join(x for x in [g.get("given_name"), g.get("family_name")] if x)
        user = await local_auth.create_user(email=email, name=name, google_sub=g.get("sub", ""))
    elif not user.get("google_sub"):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"google_sub": g.get("sub", "")}})
    _not_banned(user)
    return _session(user["user_id"], await _ticket(user["user_id"]), is_new=is_new, email=email)


@router.post("/me/change-password-by-old")
async def me_change_password_by_old(body: ChangePwByOldIn, user: dict = Depends(require_user)):
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail=PW_RULE)
    u = await local_auth.get_user(user["user_id"]) or {}
    if await local_auth.has_password(u) and not await local_auth.verify_password(u, body.current_password):
        raise HTTPException(status_code=400, detail="舊密碼錯誤")
    await local_auth.set_password(user["user_id"], body.new_password)
    return {"ok": True, "token": await _ticket(user["user_id"])}


# ----------------------------- Bind email / phone to the logged-in account -----------------------------
class BindSendIn(BaseModel):
    identifier: str  # email or E.164 phone


class BindIn(BindSendIn):
    code: str


@router.post("/me/bind/send-code")
async def bind_send_code(body: BindSendIn, user: dict = Depends(require_user)):
    ident = body.identifier.strip().lower()
    if ident.startswith("+"):
        ident = _check_phone(ident)
        other = await _phone_user(ident)
        if other and other["user_id"] != user["user_id"]:
            raise HTTPException(status_code=409, detail="此手機號已綁定其他帳號")
    else:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", ident) or ident.endswith("@" + PHONE_DOMAIN):
            raise HTTPException(status_code=400, detail="請輸入正確的信箱")
        other = await _find_user(ident)
        if other and other["user_id"] != user["user_id"]:
            raise HTTPException(status_code=409, detail="此信箱已綁定其他帳號")
    return await _issue_code(ident, "bind")


@router.post("/me/bind")
async def bind_identifier(body: BindIn, user: dict = Depends(require_user)):
    ident = body.identifier.strip().lower()
    uid = user["user_id"]
    await _consume_code(ident, "bind", body.code)
    if ident.startswith("+"):
        ident = _check_phone(ident)
        other = await _phone_user(ident)
        if other and other["user_id"] != uid:
            raise HTTPException(status_code=409, detail="此手機號已綁定其他帳號")
        await db.phone_accounts.delete_many({"user_id": uid})
        await db.phone_accounts.insert_one({"phone": ident, "user_id": uid, "created_at": _now().isoformat()})
        await db.users.update_one({"user_id": uid}, {"$set": {"phone": ident}})
        return {"ok": True, "phone": ident}
    other = await _find_user(ident)
    if other and other["user_id"] != uid:
        raise HTTPException(status_code=409, detail="此信箱已綁定其他帳號")
    u = await local_auth.get_user(uid) or {}
    cur = local_auth.real_email(u.get("email", ""))
    upd = {"$set": {"email": ident}}
    if cur and cur != ident:
        upd["$addToSet"] = {"alt_emails": cur}
    await db.users.update_one({"user_id": uid}, upd)
    return {"ok": True, "email": ident}
