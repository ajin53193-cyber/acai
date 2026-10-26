"""Self-hosted auth: bcrypt passwords + HS256 JWT sessions, all stored in our own MongoDB.
Legacy accounts (created while Clerk was the provider) are migrated lazily on first password login."""
import logging
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger("local_auth")
router = APIRouter(prefix="/api/auth")
db = None  # injected from server.py
TOKEN_DAYS = 30
PHONE_DOMAIN = "phone.gogo589.com"
CLERK_BACKEND_API = "https://api.clerk.com/v1"


def _now():
    return datetime.now(timezone.utc)


def secret() -> str:
    s = os.environ.get("AUTH_SECRET") or os.environ.get("CLERK_SECRET_KEY")
    if not s:
        raise RuntimeError("AUTH_SECRET is not set")
    return s


def new_user_id() -> str:
    return "user_" + secrets.token_hex(12)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def issue_token(user_id: str, ver: int = 0) -> str:
    now = _now()
    return jwt.encode({"sub": user_id, "sid": secrets.token_hex(8), "ver": int(ver or 0), "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}, secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, secret(), algorithms=["HS256"], leeway=5)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")


async def require_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get("auth_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    claims = decode_token(token)
    u = await db.users.find_one({"user_id": claims["sub"]}, {"_id": 0, "token_ver": 1, "banned": 1})
    if u is None or int(u.get("token_ver") or 0) != int(claims.get("ver") or 0):
        raise HTTPException(status_code=401, detail="登入已失效，請重新登入")
    if u.get("banned"):
        raise HTTPException(status_code=403, detail="帳號已被停用")
    return {"user_id": claims["sub"], "session_id": claims.get("sid"), "claims": claims}


# ----------------------------- lookups -----------------------------
def real_email(email: str) -> str:
    return "" if not email or email.endswith("@" + PHONE_DOMAIN) else email


async def find_by_email(email: str) -> Optional[dict]:
    email = (email or "").strip().lower()
    if not email:
        return None
    return await db.users.find_one({"$or": [{"email": email}, {"alt_emails": email}]}, {"_id": 0})


async def find_by_phone(phone: str) -> Optional[dict]:
    acct = await db.phone_accounts.find_one({"phone": phone}, {"_id": 0})
    if acct:
        return await db.users.find_one({"user_id": acct["user_id"]}, {"_id": 0})
    return await db.users.find_one({"phone": phone}, {"_id": 0})


async def find_by_identifier(ident: str) -> Optional[dict]:
    ident = (ident or "").strip().lower()
    return await find_by_phone(ident) if ident.startswith("+") else await find_by_email(ident)


async def get_user(uid: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": uid}, {"_id": 0})


async def create_user(email: str = "", phone: str = "", password: str = "", name: str = "", role: str = "member", **extra) -> dict:
    uid = new_user_id()
    doc = {"user_id": uid, "email": (email or "").lower(), "phone": phone or "", "name": name or real_email(email) or phone or "",
           "role": role, "password_hash": hash_password(password) if password else "", "token_ver": 0,
           "created_at": _now().isoformat(), **extra}
    await db.users.insert_one(doc)
    if phone:
        await db.phone_accounts.insert_one({"phone": phone, "user_id": uid, "created_at": doc["created_at"]})
    doc.pop("_id", None)
    return doc


# ----------------------------- passwords -----------------------------
async def _clerk_verify(uid: str, password: str) -> Optional[bool]:
    """Legacy check against Clerk while the key still exists. None = unknown (no key / unreachable)."""
    key = os.environ.get("CLERK_SECRET_KEY")
    if not key or not uid.startswith("user_") or len(uid) != 32:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            h = {"Authorization": f"Bearer {key}", "User-Agent": "gogo589-backend"}
            r = await c.post(f"{CLERK_BACKEND_API}/users/{uid}/verify_password", json={"password": password}, headers=h)
            if r.status_code == 200:
                return bool(r.json().get("verified"))
            if r.status_code in (400, 422):
                return False
            if r.status_code == 404:
                return False
    except Exception as e:
        logger.warning("legacy verify failed: %s", e)
    return None


async def has_password(user: dict) -> bool:
    if user.get("password_hash"):
        return True
    if "password_hash" in user:
        return False
    key = os.environ.get("CLERK_SECRET_KEY")
    if not key:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{CLERK_BACKEND_API}/users/{user['user_id']}", headers={"Authorization": f"Bearer {key}", "User-Agent": "gogo589-backend"})
        if r.status_code == 200:
            return bool(r.json().get("password_enabled"))
        if r.status_code == 404:
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": ""}})
    except Exception as e:
        logger.warning("legacy password_enabled lookup failed: %s", e)
    return False


async def verify_password(user: dict, password: str) -> bool:
    h = user.get("password_hash")
    if h:
        try:
            return bcrypt.checkpw(password.encode(), h.encode())
        except ValueError:
            return False
    if "password_hash" in user:
        return False
    ok = await _clerk_verify(user["user_id"], password)
    if ok:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(password), "migrated_at": _now().isoformat()}})
        return True
    return False


async def set_password(uid: str, password: str, sign_out_others: bool = False):
    upd = {"$set": {"password_hash": hash_password(password)}}
    if sign_out_others:
        upd["$inc"] = {"token_ver": 1}
    await db.users.update_one({"user_id": uid}, upd)


async def token_for(uid: str) -> str:
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "token_ver": 1})
    return issue_token(uid, (u or {}).get("token_ver") or 0)


def public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "email": real_email(u.get("email", "")), "phone": u.get("phone", ""), "name": u.get("name", ""),
            "role": u.get("role", "member"), "google": bool(u.get("google_sub") or (u.get("public_metadata") or {}).get("google_sub")),
            "password_enabled": bool(u.get("password_hash")) if "password_hash" in u else None, "created_at": u.get("created_at")}


@router.get("/me")
async def auth_me(user: dict = Depends(require_user)):
    u = await get_user(user["user_id"])
    if not u:
        raise HTTPException(status_code=401, detail="Not signed in")
    out = public_user(u)
    if out["password_enabled"] is None:
        out["password_enabled"] = await has_password(u)
    return out


@router.post("/logout")
async def auth_logout(user: dict = Depends(require_user)):
    return {"ok": True}
