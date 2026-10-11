"""Auth domain routes: login / logout / me / 2FA (TOTP).

Extracted from server.py. Infra (db) via core, deps via deps; business helpers
(check_lockout, record_login_failure, security_policy, audit) imported from server
after definition (server includes this router at the bottom) to avoid circular imports.
"""
import asyncio
import base64
import io as _io

from typing import Optional

import pyotp
import qrcode
from fastapi import APIRouter, Depends, Request, Response, HTTPException
from pydantic import BaseModel

from core import db
from utils import client_ip, verify_password, hash_password, create_access_token, clean_user, iso, now_utc
from models import LoginInput
from deps import get_current_user
from email_utils import notify_security
from shared import audit
from server import check_lockout, record_login_failure, security_policy, verify_step_up_dep, LOCK_MAX_FAILS, LOCK_MINUTES

router = APIRouter(prefix="/api")


@router.post("/auth/login")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower()
    ip = client_ip(request)
    identifier = email
    await check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        locked = await record_login_failure(identifier, email, ip)
        if locked:
            raise HTTPException(status_code=423, detail=f"连续 {LOCK_MAX_FAILS} 次密码错误，账号已锁定 {LOCK_MINUTES} 分钟")
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if user.get("status") == "frozen":
        raise HTTPException(status_code=403, detail="账号已被冻结")
    if user["role"] not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="该账号无后台登录权限，请使用商户 API 或联系平台管理员")
    if user.get("totp_enabled") and user["role"] in ("admin", "operator"):
        if not data.code:
            return {"requires_2fa": True}
        secret = user.get("totp_secret")
        if not secret or not pyotp.TOTP(secret).verify(str(data.code).strip().replace(" ", ""), valid_window=1):
            locked = await record_login_failure(identifier, email, ip)
            asyncio.create_task(notify_security(user, "fail", ip))
            if locked:
                raise HTTPException(status_code=423, detail=f"连续 {LOCK_MAX_FAILS} 次验证失败，账号已锁定 {LOCK_MINUTES} 分钟")
            raise HTTPException(status_code=401, detail="两步验证码错误")
    await db.login_attempts.delete_one({"identifier": identifier})
    pol = await security_policy()
    if pol.get("login_alert", True) and ip:
        known = user.get("login_ips") or []
        if ip not in known:
            if known:
                asyncio.create_task(notify_security(user, "login_new_device", ip))
            await db.users.update_one({"_id": user["_id"]},
                                      {"$set": {"login_ips": (known + [ip])[-10:], "last_login_at": iso(now_utc()), "last_login_ip": ip}})
        else:
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": iso(now_utc()), "last_login_ip": ip}})
    token = create_access_token(str(user["_id"]), user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"token": token, "user": clean_user(user)}


@router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return clean_user(user)


class TotpCode(BaseModel):
    code: str


@router.post("/auth/2fa/setup")
async def totp_setup(user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="当前角色无需两步验证")
    if user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="两步验证已启用，请先关闭再重新绑定")
    secret = pyotp.random_base32()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"totp_pending_secret": secret}})
    uri = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="四方收款平台")
    img = qrcode.make(uri)
    buf = _io.BytesIO(); img.save(buf, format="PNG"); buf.seek(0)
    qr_data = "data:image/png;base64," + base64.b64encode(buf.read()).decode()
    return {"secret": secret, "otpauth_uri": uri, "qr": qr_data}


@router.post("/auth/2fa/enable")
async def totp_enable(data: TotpCode, request: Request, user: dict = Depends(get_current_user)):
    secret = user.get("totp_pending_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="请先获取绑定二维码")
    if not pyotp.TOTP(secret).verify(data.code.strip().replace(" ", ""), valid_window=1):
        raise HTTPException(status_code=400, detail="验证码错误，请重试")
    await db.users.update_one({"_id": user["_id"]},
                              {"$set": {"totp_secret": secret, "totp_enabled": True},
                               "$unset": {"totp_pending_secret": ""}})
    await audit(user, "auth.2fa_enable", "user", user["_id"], {}, request)
    asyncio.create_task(notify_security(user, "enable", client_ip(request)))
    return {"ok": True, "totp_enabled": True}


@router.post("/auth/2fa/disable")
async def totp_disable(data: TotpCode, request: Request, user: dict = Depends(get_current_user)):
    if not user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="两步验证未启用")
    if user.get("totp_required"):
        raise HTTPException(status_code=403, detail="管理员已强制开启两步验证，无法关闭")
    secret = user.get("totp_secret")
    if not secret or not pyotp.TOTP(secret).verify(data.code.strip().replace(" ", ""), valid_window=1):
        raise HTTPException(status_code=400, detail="验证码错误")
    await db.users.update_one({"_id": user["_id"]},
                              {"$set": {"totp_enabled": False}, "$unset": {"totp_secret": "", "totp_pending_secret": ""}})
    await audit(user, "auth.2fa_disable", "user", user["_id"], {}, request)
    asyncio.create_task(notify_security(user, "disable", client_ip(request)))
    return {"ok": True, "totp_enabled": False}


class OpCodeSet(BaseModel):
    new_code: str
    current_code: Optional[str] = None
    totp_code: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


@router.get("/auth/op-code/status")
async def op_code_status(user: dict = Depends(get_current_user)):
    return {"op_code_set": bool(user.get("op_code_hash"))}


@router.post("/auth/op-code/set")
async def op_code_set(data: OpCodeSet, request: Request, user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="当前角色无需操作安全码")
    new = (data.new_code or "").strip()
    if len(new) < 6:
        raise HTTPException(status_code=400, detail="操作安全码至少 6 位")
    if user.get("op_code_hash"):
        if not data.current_code or not verify_password(data.current_code.strip(), user["op_code_hash"]):
            raise HTTPException(status_code=403, detail="当前操作安全码错误")
    if user.get("totp_enabled"):
        tc = (data.totp_code or "").strip().replace(" ", "")
        if not tc or not pyotp.TOTP(user.get("totp_secret") or "").verify(tc, valid_window=1):
            raise HTTPException(status_code=403, detail="谷歌验证码错误")
    await db.users.update_one({"_id": user["_id"]},
        {"$set": {"op_code_hash": hash_password(new), "op_code_fails": 0}, "$unset": {"op_code_locked_until": ""}})
    await audit(user, "auth.op_code_set", "user", user["_id"], {}, request)
    return {"ok": True, "op_code_set": True}


@router.post("/auth/change-password")
async def change_password(data: ChangePassword, request: Request, user: dict = Depends(verify_step_up_dep)):
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=403, detail="当前登录密码错误")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await audit(user, "auth.change_password", "user", user["_id"], {}, request)
    return {"ok": True}
