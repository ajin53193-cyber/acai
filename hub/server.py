"""Standalone multi-platform console ("總後台"): one login, pulls stats / orders / topups / members from every platform
that implements the Hub spec (gogo589, Giftray, 四方充值平台 …). Serves its own UI from ./static. Run: python server.py"""
import asyncio
import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("HUB_DB_NAME", "gogo589_hub")]
SECRET = os.environ["HUB_SECRET"]
ADMIN_USER = os.environ["HUB_ADMIN_USER"]
ADMIN_PASSWORD = os.environ["HUB_ADMIN_PASSWORD"]
app = FastAPI(title="Hub Console")
_fails: Dict[str, List[float]] = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ----------------------------- auth (single console account from .env) -----------------------------
def _sign(payload: str) -> str:
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _token(user: str) -> str:
    exp = str(int(time.time()) + 12 * 3600)
    return f"{user}.{exp}.{_sign(user + exp)}"


def current_user(authorization: str = Header("")) -> str:
    try:
        user, exp, sig = authorization.replace("Bearer ", "").split(".")
        if hmac.compare_digest(sig, _sign(user + exp)) and int(exp) > time.time():
            return user
    except Exception:  # noqa: BLE001
        pass
    raise HTTPException(status_code=401, detail="請重新登入")


class LoginIn(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(body: LoginIn):
    recent = [t for t in _fails.get(body.username, []) if t > time.time() - 900]
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="嘗試次數過多，請 15 分鐘後再試")
    if not (hmac.compare_digest(body.username, ADMIN_USER) and hmac.compare_digest(body.password, ADMIN_PASSWORD)):
        _fails[body.username] = recent + [time.time()]
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    _fails.pop(body.username, None)
    return {"token": _token(body.username), "user": body.username}


# ----------------------------- platforms -----------------------------
class PlatformIn(BaseModel):
    id: str
    name: str
    base_url: str
    api_key: str = ""
    cs_url: str = ""
    admin_url: str = ""
    kind: str = "shop"
    enabled: bool = True


async def platforms() -> List[dict]:
    return [p async for p in db.platforms.find({}, {"_id": 0}).sort("order", 1)]


def _mask(p: dict) -> dict:
    return {**p, "api_key": ("•" * 8 + p["api_key"][-4:]) if p.get("api_key") else ""}


async def _remote(p: dict, path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.get(p["base_url"].rstrip("/") + path, params={k: v for k, v in params.items() if v not in ("", None)}, headers={"X-Hub-Key": p.get("api_key", "")})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"{p['name']} 回應 {r.status_code}")
    return r.json()


async def _gather(ps: List[dict], path: str, params: dict):
    res = await asyncio.gather(*[_remote(p, path, params) for p in ps], return_exceptions=True)
    out, errors = [], []
    for p, r in zip(ps, res):
        if isinstance(r, Exception):
            errors.append({"platform": p["id"], "name": p["name"], "error": getattr(r, "detail", str(r))})
        else:
            out.append((p, r))
    return out, errors


def _tag(p: dict) -> dict:
    return {"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop")}


async def _active(platform: str = "all") -> List[dict]:
    ps = [p for p in await platforms() if p.get("enabled", True)]
    return [p for p in ps if p["id"] == platform] if platform != "all" else ps


@app.get("/api/platforms")
async def get_platforms(user: str = Depends(current_user)):
    return {"platforms": [_mask(p) for p in await platforms()]}


@app.put("/api/platforms")
async def put_platforms(body: List[PlatformIn], user: str = Depends(current_user)):
    old = {p["id"]: p for p in await platforms()}
    rows = []
    for i, p in enumerate(body):
        d = p.model_dump()
        d["id"] = "".join(ch for ch in d["id"].strip().lower() if ch.isalnum() or ch in "-_") or "p" + secrets.token_hex(3)
        if d["api_key"].startswith("••••") and d["id"] in old:
            d["api_key"] = old[d["id"]]["api_key"]
        d["order"] = i
        rows.append(d)
    await db.platforms.delete_many({})
    if rows:
        await db.platforms.insert_many([dict(r) for r in rows])
    return {"platforms": [_mask(p) for p in rows]}


@app.post("/api/platforms/{pid}/test")
async def test_platform(pid: str, user: str = Depends(current_user)):
    p = next((x for x in await platforms() if x["id"] == pid), None)
    if not p:
        raise HTTPException(status_code=404, detail="平台不存在")
    try:
        r = await _remote(p, "/hub/stats", {"days": 7})
        return {"ok": True, "platform": r.get("platform"), "stats": {k: v for k, v in r.items() if k != "platform"}}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": getattr(e, "detail", str(e))}


# ----------------------------- aggregated views -----------------------------
STAT_KEYS = ["revenue_usd", "orders", "topup_usd", "topups", "new_members", "members", "pending_orders", "pending_topups", "open_chats"]


@app.get("/api/stats")
async def stats(days: int = 30, user: str = Depends(current_user)):
    got, errors = await _gather(await _active(), "/hub/stats", {"days": max(1, min(days, 365))})
    plats = [{**{k: r.get(k, 0) for k in STAT_KEYS}, "platform": _tag(p)} for p, r in got]
    total = {k: round(sum(float(x.get(k) or 0) for x in plats), 2) if k.endswith("_usd") else int(sum(int(x.get(k) or 0) for x in plats)) for k in STAT_KEYS}
    return {"days": days, "platforms": plats, "total": total, "errors": errors}


@app.get("/api/orders")
async def orders(platform: str = "all", kind: str = "all", status: str = "", q: str = "", size: int = 100, user: str = Depends(current_user)):
    ps = await _active(platform)
    rows, errors = [], []
    if kind in ("all", "order", "giftcard"):
        got, errs = await _gather([p for p in ps if p.get("kind") != "topup"], "/hub/orders", {"status": status, "size": size})
        errors += errs
        for p, r in got:
            rows += [{**x, "platform": _tag(p)} for x in r.get("rows", []) if kind == "all" or x.get("type") == kind]
    if kind in ("all", "topup"):
        got, errs = await _gather(ps, "/hub/topups", {"status": status, "size": size})
        errors += errs
        for p, r in got:
            rows += [{**x, "type": "topup", "platform": _tag(p)} for x in r.get("rows", [])]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in str(r.get("order_no", "")).lower() or ql in str(r.get("user", "")).lower() or any(ql in str(i).lower() for i in r.get("items", []))]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"rows": rows[:size], "errors": errors}


@app.get("/api/members")
async def members(platform: str = "all", q: str = "", size: int = 100, user: str = Depends(current_user)):
    got, errors = await _gather(await _active(platform), "/hub/members", {"q": q, "size": size})
    rows = [{**x, "platform": _tag(p)} for p, r in got for x in r.get("rows", [])]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"rows": rows[:size], "errors": errors}


@app.get("/api/alerts")
async def alerts(since: str = "", user: str = Depends(current_user)):
    now = now_iso()
    if not since:
        return {"now": now, "orders": []}
    ps = [p for p in await _active() if p.get("kind") != "topup"]
    try:
        got, _ = await asyncio.wait_for(_gather(ps, "/hub/orders", {"paid_since": since, "size": 20}), timeout=6)
    except asyncio.TimeoutError:
        got = []
    out = [{**o, "platform": _tag(p)} for p, r in got for o in r.get("rows", []) if o.get("paid_at") and o["paid_at"] > since and o.get("status") not in ("pending_payment", "cancelled", "failed")]
    return {"now": now, "orders": out}


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/{path:path}")
async def spa(path: str):
    return FileResponse(ROOT / "static" / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("HUB_PORT", "8101")), reload=False)
