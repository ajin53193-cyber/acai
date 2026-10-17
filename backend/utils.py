"""Pure, dependency-free helpers shared across the backend (no DB access)."""
import os
import random
import string
import secrets
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

import bcrypt
import jwt
from fastapi import Request

JWT_ALGORITHM = "HS256"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# ---- Beijing time (UTC+8) helpers: storage stays UTC, display/day-cuts use CST ----
BJ_TZ = timezone(timedelta(hours=8))


def now_bj() -> datetime:
    return now_utc().astimezone(BJ_TZ)


def bj_today_str() -> str:
    return now_bj().strftime("%Y-%m-%d")


def bj_yesterday_str() -> str:
    return (now_bj() - timedelta(days=1)).strftime("%Y-%m-%d")


def bj_day_bounds(date_str: Optional[str] = None):
    """Return (start_utc, end_utc, label) for a Beijing-time calendar day."""
    if date_str:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        start_bj = datetime(d.year, d.month, d.day, tzinfo=BJ_TZ)
    else:
        n = now_bj()
        start_bj = datetime(n.year, n.month, n.day, tzinfo=BJ_TZ)
    start_utc = start_bj.astimezone(timezone.utc)
    return start_utc, start_utc + timedelta(days=1), start_bj.strftime("%Y-%m-%d")


def bj_str(value, fmt: str = "%Y-%m-%d %H:%M") -> str:
    """Format a UTC datetime or ISO string as Beijing local time."""
    if not value:
        return ""
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BJ_TZ).strftime(fmt)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def gen_order_no() -> str:
    return "SF" + now_utc().strftime("%Y%m%d%H%M%S") + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))


def gen_wallet_address(network: str) -> str:
    if network == "TRC20":
        return "T" + "".join(random.choices(string.ascii_letters + string.digits, k=33))
    return "0x" + "".join(random.choices("abcdef" + string.digits, k=40))


def gen_txid(network: str) -> str:
    if network == "TRC20":
        return "".join(random.choices("abcdef" + string.digits, k=64))
    return "0x" + "".join(random.choices("abcdef" + string.digits, k=64))


def gen_api_key() -> str:
    return "mk_" + secrets.token_hex(16)


def gen_api_secret() -> str:
    return "sk_" + secrets.token_hex(24)


def gen_gateway_code() -> str:
    return secrets.token_hex(8)


def clean_user(u: dict) -> dict:
    u = dict(u)
    u["id"] = str(u.pop("_id"))
    u.pop("password_hash", None)
    u["totp_enabled"] = bool(u.get("totp_enabled"))
    u["totp_required"] = bool(u.get("totp_required"))
    u["op_code_set"] = bool(u.get("op_code_hash"))
    u.pop("op_code_hash", None)
    u.pop("op_code_fails", None)
    u.pop("op_code_locked_until", None)
    u.pop("totp_secret", None)
    u.pop("totp_pending_secret", None)
    u.pop("login_ips", None)
    u.pop("login_cities", None)
    u.pop("api_secret", None)
    return u


def is_private_host(host: str) -> bool:
    import ipaddress
    h = (host or "").strip("[]").lower()
    if h in ("localhost", "") or h.endswith((".local", ".internal")):
        return True
    try:
        ip = ipaddress.ip_address(h)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast
    except ValueError:
        return False


def serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def canon(v: Any) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def sign_payload(payload: dict, secret: str) -> str:
    items = sorted((k, v) for k, v in payload.items() if k != "sign" and v is not None and v != "")
    raw = "&".join(f"{k}={canon(v)}" for k, v in items)
    return hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()


TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "1"))


def chat_token(order_no: str) -> str:
    return hmac.new(get_jwt_secret().encode(), f"chat:{order_no}".encode(), hashlib.sha256).hexdigest()[:32]


def client_ip(request: Request) -> Optional[str]:
    """Take the address appended by the trusted edge proxy (right-most hops), so a
    client-supplied X-Forwarded-For prefix cannot spoof the IP."""
    xff = request.headers.get("x-forwarded-for")
    if xff and TRUSTED_PROXY_HOPS > 0:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-TRUSTED_PROXY_HOPS] if len(parts) >= TRUSTED_PROXY_HOPS else parts[0]
    return request.client.host if request.client else None
