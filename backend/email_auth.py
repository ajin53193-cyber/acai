"""Email OTP auth via Mailgun SMTP; Clerk stays the session provider (sign-in tickets)."""
import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from clerk_auth import require_user, CLERK_BACKEND_API
from mailer import send_mail, otp_email
from sms import send_sms_code

logger = logging.getLogger("email_auth")
router = APIRouter(prefix="/api/auth/email")
CODE_TTL_MIN = 10
RESEND_SECONDS = 60
MAX_PER_HOUR = 6
MAX_ATTEMPTS = 5
PURPOSES = ("login", "register", "reset", "change_password")
TEST_SUFFIX = "+clerk_test@"
TEST_PHONE_PREFIX = "+1201555"
PHONE_DOMAIN = "phone.gogo589.com"
TEST_CODE = "424242"
db = None  # injected from server.py


def _now():
    return datetime.now(timezone.utc)


def _hash(email: str, code: str) -> str:
    return hmac.new(os.environ["CLERK_SECRET_KEY"].encode(), f"{email.lower()}:{code}".encode(), hashlib.sha256).hexdigest()


def _pw_ok(p: str) -> bool:
    if not 8 <= len(p) <= 32:
        return False
    return sum(bool(re.search(r, p)) for r in (r"[0-9]", r"[a-zA-Z]", r"[^0-9a-zA-Z]")) >= 2


async def _clerk(method: str, path: str, **kw) -> httpx.Response:
    headers = {"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "gogo589-backend"}
    async with httpx.AsyncClient(timeout=20) as c:
        return await c.request(method, f"{CLERK_BACKEND_API}{path}", headers=headers, **kw)


async def _find_user(identifier: str) -> Optional[dict]:
    key = "phone_number" if identifier.startswith("+") else "email_address"
    r = await _clerk("GET", "/users", params={key: identifier, "limit": 1})
    r.raise_for_status()
    users = r.json()
    return users[0] if users else None


async def _ticket(user_id: str) -> str:
    r = await _clerk("POST", "/sign_in_tokens", json={"user_id": user_id, "expires_in_seconds": 300})
    if r.status_code >= 300:
        logger.error("sign_in_token failed: %s", r.text[:200])
        raise HTTPException(status_code=502, detail="登入服務暫時不可用，請稍後再試")
    return r.json()["token"]


def _primary_email(u: dict) -> str:
    """Primary contact for OTP: real email, or the phone for phone-registered accounts."""
    pid = u.get("primary_email_address_id")
    email = next((e["email_address"] for e in u.get("email_addresses", []) if e["id"] == pid), "") or (u.get("email_addresses") or [{}])[0].get("email_address", "")
    if email.endswith("@" + PHONE_DOMAIN):
        return (u.get("public_metadata") or {}).get("phone", "")
    return email


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
            raise HTTPException(status_code=502, detail="簡訊發送失敗，請稍後再試" if is_phone else "郵件發送失敗，請稍後再試")
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
    return {"ticket": await _ticket(user["id"]), "is_new": False}


@router.post("/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    await _consume_code(email, "register", body.code)
    if await _find_user(email):
        raise HTTPException(status_code=409, detail="此信箱已註冊，請直接登入")
    r = await _clerk("POST", "/users", json={"email_address": [email], "password": body.password, "skip_password_checks": True})
    if r.status_code >= 300:
        logger.error("register failed: %s", r.text[:300])
        raise HTTPException(status_code=400, detail=(r.json().get("errors") or [{}])[0].get("long_message") or "註冊失敗，請稍後再試")
    return {"ticket": await _ticket(r.json()["id"])}


@router.post("/password-login")
async def password_login(body: PasswordLoginIn):
    ident = body.identifier.strip().lower()
    user = await _phone_user(ident) if ident.startswith("+") else await _find_user(ident)
    if not user:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    if not user.get("password_enabled"):
        raise HTTPException(status_code=400, detail="此帳號尚未設定密碼，請使用驗證碼登入")
    r = await _clerk("POST", f"/users/{user['id']}/verify_password", json={"password": body.password})
    if r.status_code != 200 or not r.json().get("verified"):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {"ticket": await _ticket(user["id"])}


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    email = body.email.lower()
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    await _consume_code(email, "reset", body.code)
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="此信箱尚未註冊")
    r = await _clerk("PATCH", f"/users/{user['id']}", json={"password": body.new_password, "skip_password_checks": True, "sign_out_of_other_sessions": True})
    if r.status_code >= 300:
        logger.error("reset password failed: %s", r.text[:300])
        raise HTTPException(status_code=400, detail=(r.json().get("errors") or [{}])[0].get("long_message") or "重設失敗")
    return {"ticket": await _ticket(user["id"])}


@router.post("/me/send-code")
async def me_send_code(user: dict = Depends(require_user)):
    r = await _clerk("GET", f"/users/{user['user_id']}")
    r.raise_for_status()
    email = _primary_email(r.json())
    if not email:
        raise HTTPException(status_code=400, detail="帳號未綁定信箱")
    res = await _issue_code(email, "change_password")
    masked = email[:4] + "****" + email[-3:] if email.startswith("+") else email[:2] + "***" + email[email.index("@"):]
    return {**res, "email": masked}


@router.post("/me/change-password")
async def me_change_password(body: ChangePwIn, user: dict = Depends(require_user)):
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    r = await _clerk("GET", f"/users/{user['user_id']}")
    r.raise_for_status()
    email = _primary_email(r.json())
    await _consume_code(email, "change_password", body.code)
    r = await _clerk("PATCH", f"/users/{user['user_id']}", json={"password": body.new_password, "skip_password_checks": True})
    if r.status_code >= 300:
        raise HTTPException(status_code=400, detail=(r.json().get("errors") or [{}])[0].get("long_message") or "修改失敗")
    return {"ok": True}


@router.post("/me/set-password")
async def me_set_password(body: SetPwIn, user: dict = Depends(require_user)):
    """First-time password for accounts registered by phone (no code needed while no password exists)."""
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    r = await _clerk("GET", f"/users/{user['user_id']}")
    r.raise_for_status()
    if r.json().get("password_enabled"):
        raise HTTPException(status_code=409, detail="帳號已設定密碼，請使用修改密碼")
    r = await _clerk("PATCH", f"/users/{user['user_id']}", json={"password": body.password, "skip_password_checks": True})
    if r.status_code >= 300:
        raise HTTPException(status_code=400, detail=(r.json().get("errors") or [{}])[0].get("long_message") or "設定失敗")
    return {"ok": True}


# ----------------------------- Phone (SUBMAIL international SMS) -----------------------------
def _phone_placeholder_email(phone: str) -> str:
    return f"p{phone.lstrip('+')}@{PHONE_DOMAIN}"


def _check_phone(phone: str) -> str:
    phone = re.sub(r"[\s-]", "", phone)
    if not re.fullmatch(r"\+[1-9]\d{6,14}", phone):
        raise HTTPException(status_code=400, detail="請輸入正確的手機號碼")
    return phone


async def _phone_user(phone: str) -> Optional[dict]:
    acct = await db.phone_accounts.find_one({"phone": phone}, {"_id": 0})
    if not acct:
        return None
    r = await _clerk("GET", f"/users/{acct['user_id']}")
    return r.json() if r.status_code == 200 else None


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
    exists = await db.phone_accounts.find_one({"phone": phone}) is not None
    if body.purpose in ("login", "reset") and not exists:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊，請先註冊")
    if body.purpose == "register" and exists:
        raise HTTPException(status_code=409, detail="此手機號已註冊，請直接登入")
    return await _issue_code(phone, body.purpose)


@router.post("/phone/register")
async def phone_register(body: PhoneRegisterIn):
    phone = _check_phone(body.phone)
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    await _consume_code(phone, "register", body.code)
    if await db.phone_accounts.find_one({"phone": phone}):
        raise HTTPException(status_code=409, detail="此手機號已註冊，請直接登入")
    r = await _clerk("POST", "/users", json={"email_address": [_phone_placeholder_email(phone)], "password": body.password,
                                             "skip_password_checks": True, "public_metadata": {"phone": phone}})
    if r.status_code >= 300:
        logger.error("phone register failed: %s", r.text[:300])
        raise HTTPException(status_code=400, detail="註冊失敗，請稍後再試")
    uid = r.json()["id"]
    await db.phone_accounts.insert_one({"phone": phone, "user_id": uid, "created_at": _now().isoformat()})
    await db.users.update_one({"user_id": uid}, {"$set": {"phone": phone}}, upsert=True)
    return {"ticket": await _ticket(uid)}


@router.post("/phone/verify")
async def phone_verify(body: PhoneVerifyIn):
    phone = _check_phone(body.phone)
    await _consume_code(phone, "login", body.code)
    user = await _phone_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊，請先註冊")
    return {"ticket": await _ticket(user["id"])}


@router.post("/phone/reset-password")
async def phone_reset_password(body: PhoneRegisterIn):
    phone = _check_phone(body.phone)
    if not _pw_ok(body.password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    await _consume_code(phone, "reset", body.code)
    user = await _phone_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="此手機號尚未註冊")
    r = await _clerk("PATCH", f"/users/{user['id']}", json={"password": body.password, "skip_password_checks": True, "sign_out_of_other_sessions": True})
    if r.status_code >= 300:
        raise HTTPException(status_code=400, detail="重設失敗")
    return {"ticket": await _ticket(user["id"])}


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
        payload = {"email_address": [email], "skip_password_requirement": True, "public_metadata": {"google_sub": g.get("sub", "")}}
        if g.get("given_name"):
            payload["first_name"] = g["given_name"]
        if g.get("family_name"):
            payload["last_name"] = g["family_name"]
        r = await _clerk("POST", "/users", json=payload)
        if r.status_code >= 300:
            logger.error("google create user failed: %s", r.text[:300])
            raise HTTPException(status_code=502, detail="建立帳號失敗，請稍後再試")
        user = r.json()
    return {"ticket": await _ticket(user["id"]), "is_new": is_new, "email": email}


@router.post("/me/change-password-by-old")
async def me_change_password_by_old(body: ChangePwByOldIn, user: dict = Depends(require_user)):
    if not _pw_ok(body.new_password):
        raise HTTPException(status_code=400, detail="密碼長度為8~32位，數字、字母、符號至少包含兩種")
    r = await _clerk("GET", f"/users/{user['user_id']}")
    r.raise_for_status()
    if r.json().get("password_enabled"):
        v = await _clerk("POST", f"/users/{user['user_id']}/verify_password", json={"password": body.current_password})
        if v.status_code != 200 or not v.json().get("verified"):
            raise HTTPException(status_code=400, detail="舊密碼錯誤")
    r = await _clerk("PATCH", f"/users/{user['user_id']}", json={"password": body.new_password, "skip_password_checks": True})
    if r.status_code >= 300:
        raise HTTPException(status_code=400, detail=(r.json().get("errors") or [{}])[0].get("long_message") or "修改失敗")
    return {"ok": True}
