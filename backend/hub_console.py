"""總後台（多平台管理）— 掛在主站域名的隱藏路徑下（預設 /12334），獨立帳號登入，API 前綴 /api/hub-admin。"""
import hashlib
import hmac
import os
import time
from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import hub_api

db = None
HUB_PATH = os.environ.get("HUB_PATH", "12334").strip("/")
STATIC = Path(__file__).parent / "hub_static"
router = APIRouter(prefix="/api/hub-admin")
page_router = APIRouter()
_fails: Dict[str, List[float]] = {}
HUB_ACTOR = {"user_id": "hub-console", "email": "hub-console"}


def _cfg():
    user, pw = os.environ.get("HUB_ADMIN_USER", ""), os.environ.get("HUB_ADMIN_PASSWORD", "")
    secret = os.environ.get("HUB_SECRET") or os.environ.get("CLERK_SECRET_KEY", "")
    if not (user and pw and secret):
        raise HTTPException(status_code=503, detail="尚未設定總後台帳號：請在 backend/.env 加入 HUB_ADMIN_USER / HUB_ADMIN_PASSWORD / HUB_SECRET")
    return user, pw, secret


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def current_hub_user(authorization: str = Header("")) -> str:
    _, _, secret = _cfg()
    try:
        user, exp, sig = authorization.replace("Bearer ", "").split(".")
        if hmac.compare_digest(sig, _sign(secret, user + exp)) and int(exp) > time.time():
            return user
    except Exception:  # noqa: BLE001
        pass
    raise HTTPException(status_code=401, detail="請重新登入")


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn):
    user, pw, secret = _cfg()
    recent = [t for t in _fails.get(body.username, []) if t > time.time() - 900]
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="嘗試次數過多，請 15 分鐘後再試")
    if not (hmac.compare_digest(body.username, user) and hmac.compare_digest(body.password, pw)):
        _fails[body.username] = recent + [time.time()]
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    _fails.pop(body.username, None)
    exp = str(int(time.time()) + 12 * 3600)
    return {"token": f"{user}.{exp}.{_sign(secret, user + exp)}", "user": user}


@router.get("/platforms")
async def platforms(user: str = Depends(current_hub_user)):
    cfg = await hub_api.get_cfg()
    return {"local": hub_api.LOCAL, "platforms": [hub_api._mask(p) for p in cfg["platforms"]]}


@router.put("/platforms")
async def platforms_put(body: List[hub_api.PlatformIn], user: str = Depends(current_hub_user)):
    return await hub_api.admin_hub_platforms_put(body, admin=HUB_ACTOR)


@router.post("/platforms/{pid}/test")
async def platform_test(pid: str, user: str = Depends(current_hub_user)):
    return await hub_api.admin_hub_platform_test(pid, admin=HUB_ACTOR)


@router.get("/stats")
async def stats(days: int = 30, user: str = Depends(current_hub_user)):
    return await hub_api.admin_hub_stats(days=days, admin=HUB_ACTOR)


@router.get("/orders")
async def orders(platform: str = "all", kind: str = "all", status: str = "", q: str = "", size: int = 100, user: str = Depends(current_hub_user)):
    return await hub_api.admin_hub_orders(platform=platform, kind=kind, status=status, q=q, size=size, admin=HUB_ACTOR)


@router.get("/members")
async def members(platform: str = "all", q: str = "", size: int = 100, user: str = Depends(current_hub_user)):
    return await hub_api.admin_hub_members(platform=platform, q=q, size=size, admin=HUB_ACTOR)


@router.get("/alerts")
async def alerts(since: str = "", user: str = Depends(current_hub_user)):
    now = hub_api.now_iso()
    if not since:
        return {"now": now, "orders": []}
    local = await db.orders.find({"paid_at": {"$gt": since, "$lte": now}}, {"_id": 0}).sort("paid_at", -1).to_list(20)
    out = [{**hub_api._order_row(o), "platform": hub_api.LOCAL} for o in local]
    for o in await hub_api.remote_new_paid_orders(since):
        out.append({"id": o["id"], "order_no": o.get("order_no"), "type": "giftcard" if o.get("is_giftcard_order") else "order", "user": o.get("user_email"),
                    "amount_usd": o.get("total_usd"), "items": [i.get("product_name", "") for i in o.get("items", [])], "paid_at": o.get("paid_at"), "platform": o["platform"]})
    return {"now": now, "orders": out}


@page_router.get(f"/{HUB_PATH}", include_in_schema=False)
@page_router.get(f"/{HUB_PATH}/{{rest:path}}", include_in_schema=False)
async def hub_page(rest: str = ""):
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})
