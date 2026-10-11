"""Shared FastAPI auth/permission dependencies (no business services)."""
from typing import List, Optional

import jwt
from bson import ObjectId
from fastapi import Request, Depends, HTTPException

from core import db
from utils import get_jwt_secret, JWT_ALGORITHM

OPERATOR_PERMS = {
    "orders.view": "订单查看", "orders.verify": "手动核账", "payouts.review": "提现审核",
    "accounts.view": "商户/代理查看", "balance.adjust": "余额调整", "channels.manage": "通道/地址管理",
    "callbacks.retry": "回调重试", "audit.view": "审计日志", "reports.export": "报表导出",
}
PERM_RULES = [
    ("/api/orders/", "resend-callback", "callbacks.retry"),
    ("/api/orders/", "reject", "orders.verify"),
    ("/api/orders/", "verify", "orders.verify"), ("/api/orders", None, "orders.view"),
    ("/api/settlements/payouts", None, "payouts.review"), ("/api/settlements", None, "orders.view"),
    ("/api/accounts/", "adjust", "balance.adjust"), ("/api/accounts", None, "accounts.view"),
    ("/api/channels", None, "channels.manage"), ("/api/chain", None, "channels.manage"), ("/api/alerts", None, "channels.manage"),
    ("/api/callbacks", None, "callbacks.retry"), ("/api/audit-logs", None, "audit.view"), ("/api/reports", None, "reports.export"),
    ("/api/dashboard", None, "orders.view"), ("/api/notifications", None, "orders.view"),
    ("/api/stats", None, "orders.view"),
    ("/api/dev", None, "orders.view"),
    ("/api/export", None, "reports.export"),
]
OPERATOR_FORBIDDEN = ("/api/accounts/me", "/api/auth/lockouts", "/api/checkout/settings", "/api/notify/settings")


def perm_for_path(path: str, method: str) -> Optional[str]:
    for p in OPERATOR_FORBIDDEN:
        if path.startswith(p):
            return None
    if path == "/api/accounts" and method == "POST":
        return None
    if path.startswith("/api/accounts/") and (path.endswith("toggle-status") or path.endswith("reset-api-key") or path.endswith("require-2fa")):
        return None
    for prefix, suffix, perm in PERM_RULES:
        if path.startswith(prefix) and (suffix is None or path.endswith(suffix)):
            return perm
    return None


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="无效的令牌类型")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        if user.get("status") == "frozen":
            raise HTTPException(status_code=403, detail="账号已被冻结")
        if user["role"] == "operator":
            path = request.url.path
            if not path.startswith(("/api/auth/me", "/api/auth/logout", "/api/auth/refresh", "/api/auth/2fa", "/api/security/policy")):
                perm = perm_for_path(path, request.method)
                if not perm or perm not in (user.get("permissions") or []):
                    raise HTTPException(status_code=403, detail="操作员无此权限")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的令牌")


def require_roles(*roles):
    async def checker(request: Request, user: dict = Depends(get_current_user)) -> dict:
        if user["role"] in roles:
            return user
        if user["role"] == "operator" and "admin" in roles:
            perm = perm_for_path(request.url.path, request.method)
            if perm and perm in (user.get("permissions") or []):
                return user
        raise HTTPException(status_code=403, detail="无权限访问")
    return checker


async def merchant_ids_for_scope(user: dict) -> Optional[List[ObjectId]]:
    """Return list of merchant ObjectIds the user can see, or None for all (admin)."""
    role = user["role"]
    if role == "admin":
        return None
    if role == "operator":
        return None if "orders.view" in (user.get("permissions") or []) else []
    if role == "merchant":
        return [user["_id"]]
    cursor = db.users.find({"role": "merchant", "parent_agent_id": str(user["_id"])}, {"_id": 1})
    ids = [m["_id"] async for m in cursor]
    return ids
