"""總後台（多平台管理）— 掛在主站域名的隱藏路徑下（預設 /12334），API 前綴 /api/hub-admin。
超級管理員來自 backend/.env；其他管理員存於 db.hub_admins（bcrypt），權限 = 模組 × 平台範圍。"""
import hashlib
import hmac
import os
import re
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import base64
import importlib
from datetime import datetime, timedelta, timezone

import admin_api
import chat_api
import hub_api
import hub_giftray
import hub_sifang
import payments_api

db = None
HUB_PATH = os.environ.get("HUB_PATH", "12334").strip("/")
STATIC = Path(__file__).parent / "hub_static"
router = APIRouter(prefix="/api/hub-admin")
page_router = APIRouter()
_fails: Dict[str, List[float]] = {}
HUB_ACTOR = {"user_id": "hub-console", "email": "hub-console"}
MODULES = ["dashboard", "orders", "orders_write", "topups", "topups_write", "cs", "cs_write", "members", "members_write", "funds_write", "platforms", "admins"]
LOCAL = {**hub_api.LOCAL, "kind": "local"}
META_STATUS = {"_pending": ("paid", "processing", "shipped", "need_info"), "_done": ("completed",), "_closed": ("cancelled", "refunded", "failed", "pending_payment")}
TOPUP_META = {"_pending": ("reviewing", "pending"), "_done": ("approved", "paid", "completed"), "_closed": ("rejected", "expired", "failed", "cancelled")}


def now_iso():
    return hub_api.now_iso()


# ----------------------------- auth -----------------------------
def _cfg():
    user, pw = os.environ.get("HUB_ADMIN_USER", ""), os.environ.get("HUB_ADMIN_PASSWORD", "")
    secret = os.environ.get("HUB_SECRET") or os.environ.get("CLERK_SECRET_KEY", "")
    if not (user and pw and secret):
        raise HTTPException(status_code=503, detail="尚未設定總後台帳號：請在 backend/.env 加入 HUB_ADMIN_USER / HUB_ADMIN_PASSWORD / HUB_SECRET")
    return user, pw, secret


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _super(user: str) -> dict:
    return {"user": user, "super": True, "modules": MODULES, "platforms": "all"}


async def current_hub_user(authorization: str = Header("")) -> dict:
    su, _, secret = _cfg()
    try:
        user, exp, sig = authorization.replace("Bearer ", "").split(".")
        ok = hmac.compare_digest(sig, _sign(secret, user + exp)) and int(exp) > time.time()
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        raise HTTPException(status_code=401, detail="請重新登入")
    if hmac.compare_digest(user, su):
        return _super(user)
    a = await db.hub_admins.find_one({"username": user, "enabled": True}, {"_id": 0, "password_hash": 0})
    if not a:
        raise HTTPException(status_code=401, detail="帳號已停用，請重新登入")
    return {"user": user, "super": False, "modules": a.get("modules", []), "platforms": a.get("platforms", [])}


def need(module: str):
    async def dep(me: dict = Depends(current_hub_user)) -> dict:
        if module not in me["modules"]:
            raise HTTPException(status_code=403, detail="沒有此模組的權限")
        return me
    return dep


def _allowed(me: dict, pid: str) -> bool:
    return me["platforms"] == "all" or pid in me["platforms"]


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn):
    su, pw, secret = _cfg()
    recent = [t for t in _fails.get(body.username, []) if t > time.time() - 900]
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="嘗試次數過多，請 15 分鐘後再試")
    ok = hmac.compare_digest(body.username, su) and hmac.compare_digest(body.password, pw)
    if not ok:
        a = await db.hub_admins.find_one({"username": body.username}, {"_id": 0})
        ok = bool(a and a.get("enabled", True) and bcrypt.checkpw(body.password.encode(), a["password_hash"].encode()))
    if not ok:
        _fails[body.username] = recent + [time.time()]
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    _fails.pop(body.username, None)
    await db.hub_admins.update_one({"username": body.username}, {"$set": {"last_login_at": now_iso()}})
    exp = str(int(time.time()) + 12 * 3600)
    return {"token": f"{body.username}.{exp}.{_sign(secret, body.username + exp)}", "user": body.username}


@router.get("/me")
async def me(me: dict = Depends(current_hub_user)):
    return {**me, "platforms_list": await _visible(me)}


# ----------------------------- platforms -----------------------------
async def _all_platforms() -> List[dict]:
    cfg = await hub_api.get_cfg()
    return [LOCAL] + [p for p in cfg["platforms"] if p.get("enabled", True)]


LOCAL_URLS = {"admin_url": "/gg589-k7p2x", "cs_url": "/gg589-k7p2x?s=chat-sessions", "orders_url": "/gg589-k7p2x?s=giftcard-orders", "topups_url": "/gg589-k7p2x?s=topups", "members_url": "/gg589-k7p2x?s=members"}


def _urls(p: dict) -> dict:
    local = p["id"] == LOCAL["id"]
    admin = p.get("admin_url") or ("" if not local else LOCAL_URLS["admin_url"])
    return {k: (p.get(k) or (LOCAL_URLS[k] if local else admin)) for k in ("admin_url", "cs_url", "orders_url", "topups_url", "members_url")}


async def _visible(me: dict) -> List[dict]:
    return [{"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop"), "origin": re.sub(r"^(https?://[^/]+).*$", r"\1", p.get("base_url") or ""), **_urls(p)} for p in await _all_platforms() if _allowed(me, p["id"])]


async def _plat(me: dict, pid: str) -> dict:
    p = next((x for x in await _all_platforms() if x["id"] == pid), None)
    if not p or not _allowed(me, pid):
        raise HTTPException(status_code=404, detail="平台不存在或無權限")
    return p


@router.get("/platforms")
async def platforms(me: dict = Depends(need("platforms"))):
    cfg = await hub_api.get_cfg()
    return {"local": hub_api.LOCAL, "platforms": [hub_api._mask(p) for p in cfg["platforms"]]}


@router.put("/platforms")
async def platforms_put(body: List[hub_api.PlatformIn], me: dict = Depends(need("platforms"))):
    return await hub_api.admin_hub_platforms_put(body, admin={**HUB_ACTOR, "email": me["user"]})


@router.post("/platforms/{pid}/test")
async def platform_test(pid: str, me: dict = Depends(need("platforms"))):
    return await hub_api.admin_hub_platform_test(pid, admin=HUB_ACTOR)


# ----------------------------- per-platform data -----------------------------
def _k(p: dict) -> str:
    return p.get("kind", "shop")


@router.get("/overview")
async def overview(platform: str = "all", days: int = 30, me: dict = Depends(need("dashboard"))):
    days = max(1, min(days, 365))
    if platform == "all":
        ps = [p for p in await _all_platforms() if _allowed(me, p["id"]) and _k(p) != "sifang"]
        rows, errors = [], []
        for p in ps:
            try:
                r = await hub_api.local_stats(days) if _k(p) == "local" else await hub_api._remote(p, "/hub/stats", {"days": days})
                rows.append({**{k: r.get(k, 0) for k in hub_api.STAT_KEYS}, "platform": {"id": p["id"], "name": p["name"], "kind": _k(p)}})
            except Exception as e:  # noqa: BLE001
                errors.append({"platform": p["id"], "name": p["name"], "error": getattr(e, "detail", str(e))})
        total = {k: round(sum(float(x.get(k) or 0) for x in rows), 2) if k.endswith("_usd") else int(sum(int(x.get(k) or 0) for x in rows)) for k in hub_api.STAT_KEYS}
        return {"days": days, "platforms": rows, "total": total, "errors": errors}
    p = await _plat(me, platform)
    if _k(p) == "sifang":
        return {"kind": "sifang", **(await hub_sifang.overview(p, days))}
    r = await hub_api.local_stats(days) if _k(p) == "local" else await hub_api._remote(p, "/hub/stats", {"days": days})
    return {"kind": "shop", "platform": {"id": p["id"], "name": p["name"]}, **{k: r.get(k, 0) for k in hub_api.STAT_KEYS}, "days": days}


@router.get("/orders")
async def orders(platform: str, kind: str = "all", status: str = "", q: str = "", size: int = 200, me: dict = Depends(need("orders"))):
    p = await _plat(me, platform)
    size = max(1, min(size, 500))
    if _k(p) == "sifang":
        return {"kind": "sifang", **(await hub_sifang.order_list(p, status, "", "", q, size))}
    cfg = await hub_api.get_cfg()
    meta = status in META_STATUS
    r = await hub_api.hub_orders(status="" if meta else status, size=size, x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/orders", {"status": "" if meta else status, "size": size})
    rows = [x for x in r.get("rows", []) if kind == "all" or x.get("type") == kind]
    if meta:
        rows = [x for x in rows if x.get("status") in META_STATUS[status]]
    if q:
        ql = q.lower()
        rows = [x for x in rows if ql in str(x.get("order_no", "")).lower() or ql in str(x.get("user", "")).lower() or any(ql in str(i).lower() for i in x.get("items", []))]
    return {"kind": "shop", "platform": {"id": p["id"], "name": p["name"]}, "rows": rows}


@router.get("/topups")
async def topups(platform: str, status: str = "", q: str = "", size: int = 200, me: dict = Depends(need("topups"))):
    p = await _plat(me, platform)
    size = max(1, min(size, 500))
    if _k(p) == "sifang":
        return {"kind": "sifang", **(await hub_sifang.order_list(p, "paid", "", "", q, size))}
    cfg = await hub_api.get_cfg()
    meta = status in TOPUP_META
    r = await hub_api.hub_topups(status="" if meta else status, size=size, x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/topups", {"status": "" if meta else status, "size": size})
    rows = r.get("rows", [])
    if meta:
        rows = [x for x in rows if x.get("status") in TOPUP_META[status]]
    if q:
        ql = q.lower()
        rows = [x for x in rows if ql in str(x.get("order_no", "")).lower() or ql in str(x.get("user", "")).lower() or any(ql in str(i).lower() for i in x.get("items", []))]
    return {"kind": "shop", "platform": {"id": p["id"], "name": p["name"]}, "rows": rows}


@router.get("/members")
async def members(platform: str, q: str = "", size: int = 200, me: dict = Depends(need("members"))):
    p = await _plat(me, platform)
    size = max(1, min(size, 500))
    if _k(p) == "sifang":
        r = await hub_sifang.account_list(p, "")
        if q:
            ql = q.lower()
            r["rows"] = [x for x in r["rows"] if ql in x["email"].lower() or ql in x["name"].lower()]
        return {"kind": "sifang", **r}
    cfg = await hub_api.get_cfg()
    r = await hub_api.hub_members(q=q, size=min(size, 200), x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/members", {"q": q, "size": min(size, 200)})
    return {"kind": "shop", "platform": {"id": p["id"], "name": p["name"]}, "rows": r.get("rows", [])}


async def _with_assign(p: dict, res: dict) -> dict:
    amap = {a["sid"]: a["admin"] async for a in db.hub_chat_assign.find({"platform": p["id"]}, {"_id": 0})}
    for r in res.get("rows", []):
        r["hub_assigned"] = amap.get(r.get("id") or r.get("order_no") or "", "")
    return res


@router.get("/chats")
async def chats(platform: str, status: str = "open", me: dict = Depends(need("cs"))):
    p = await _plat(me, platform)
    return await _with_assign(p, await _chats(p, status))


async def _chats(p: dict, status: str) -> dict:
    url = (p.get("cs_url") or "") if _k(p) != "local" else "/gg589-k7p2x?s=chat-sessions"
    if _k(p) == "sifang":
        r = await hub_sifang.thread_list(p, status)
        return {"kind": "sifang", "cs_url": url, "platform": r["platform"], "rows": r["rows"], "unread": sum(t["unread"] for t in r["rows"])}
    if _k(p) == "giftray":
        return {"kind": "shop", "cs_url": url, **(await hub_giftray.chats(p, status))}
    if _k(p) == "local":
        cond = {"last_message": {"$ne": ""}} if status == "all" else {"status": status, "last_message": {"$ne": ""}}
        items = await db.chat_sessions.find(cond, {"_id": 0}).sort("last_at", -1).to_list(300)
        rows = [{"id": s["id"], "name": s.get("name") or "", "contact": s.get("contact") or "", "last_message": s.get("last_message") or "", "last_at": s.get("last_at"), "last_sender": s.get("last_sender") or "",
                 "status": s.get("status"), "unread": int(s.get("unread_admin") or 0), "assigned": ""} for s in items]
        return {"kind": "shop", "cs_url": url, "platform": hub_api.LOCAL, "rows": rows, "unread": sum(r["unread"] for r in rows)}
    return {"kind": "shop", "cs_url": url, "platform": {"id": p["id"], "name": p["name"]}, "rows": [], "unread": 0, "unsupported": True}


@router.get("/alerts")
async def alerts(since: str = "", me: dict = Depends(need("orders"))):
    now = now_iso()
    if not since:
        return {"now": now, "orders": []}
    out = []
    if _allowed(me, LOCAL["id"]):
        local = await db.orders.find({"paid_at": {"$gt": since, "$lte": now}}, {"_id": 0}).sort("paid_at", -1).to_list(20)
        out += [{**hub_api._order_row(o), "platform": hub_api.LOCAL} for o in local]
    for p in await _all_platforms():
        if _k(p) == "sifang" and _allowed(me, p["id"]):
            out += await hub_sifang.new_paid(p, since)
    for o in await hub_api.remote_new_paid_orders(since):
        if _allowed(me, o["platform"]["id"]):
            out.append({"id": o["id"], "order_no": o.get("order_no"), "type": "giftcard" if o.get("is_giftcard_order") else "order", "user": o.get("user_email"),
                        "amount_usd": o.get("total_usd"), "items": [i.get("product_name", "") for i in o.get("items", [])], "paid_at": o.get("paid_at"), "platform": o["platform"]})
    return {"now": now, "orders": out}


# ----------------------------- admins -----------------------------
class AdminIn(BaseModel):
    username: str
    password: Optional[str] = None
    modules: List[str] = []
    platforms: List[str] = []
    note: str = ""
    enabled: bool = True


def _clean(body: AdminIn) -> dict:
    return {"modules": [m for m in body.modules if m in MODULES], "platforms": body.platforms, "note": body.note[:100], "enabled": body.enabled}


def _pub(a: dict) -> dict:
    return {k: v for k, v in a.items() if k != "password_hash"}


@router.get("/admins")
async def admins_list(me: dict = Depends(need("admins"))):
    su, _, _ = _cfg()
    rows = [_pub(a) async for a in db.hub_admins.find({}, {"_id": 0}).sort("created_at", 1)]
    return {"super": su, "modules": MODULES, "admins": rows}


@router.post("/admins")
async def admins_create(body: AdminIn, me: dict = Depends(need("admins"))):
    su, _, _ = _cfg()
    u = body.username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_.@-]{3,40}", u):
        raise HTTPException(status_code=400, detail="帳號需 3~40 位英數字")
    if u == su or await db.hub_admins.find_one({"username": u}):
        raise HTTPException(status_code=409, detail="帳號已存在")
    if not body.password or len(body.password) < 8:
        raise HTTPException(status_code=400, detail="密碼至少 8 位")
    doc = {"id": uuid.uuid4().hex, "username": u, "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(), **_clean(body), "created_by": me["user"], "created_at": now_iso()}
    await db.hub_admins.insert_one(doc)
    return _pub({k: v for k, v in doc.items() if k != "_id"})


@router.put("/admins/{aid}")
async def admins_update(aid: str, body: AdminIn, me: dict = Depends(need("admins"))):
    a = await db.hub_admins.find_one({"id": aid}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="管理員不存在")
    upd = _clean(body)
    if body.password:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="密碼至少 8 位")
        upd["password_hash"] = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    await db.hub_admins.update_one({"id": aid}, {"$set": upd})
    return _pub({**a, **upd})


@router.delete("/admins/{aid}")
async def admins_delete(aid: str, me: dict = Depends(need("admins"))):
    if (await db.hub_admins.delete_one({"id": aid})).deleted_count == 0:
        raise HTTPException(status_code=404, detail="管理員不存在")
    return {"ok": True}


class PwIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/me/password")
async def my_password(body: PwIn, me: dict = Depends(current_hub_user)):
    if me["super"]:
        raise HTTPException(status_code=400, detail="超級管理員密碼請在 backend/.env 修改")
    a = await db.hub_admins.find_one({"username": me["user"]}, {"_id": 0})
    if not a or not bcrypt.checkpw(body.old_password.encode(), a["password_hash"].encode()):
        raise HTTPException(status_code=400, detail="舊密碼錯誤")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="新密碼至少 8 位")
    await db.hub_admins.update_one({"username": me["user"]}, {"$set": {"password_hash": bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()}})
    return {"ok": True}


# ----------------------------- actions (write) -----------------------------
def _srv():
    return importlib.import_module("server")


def _actor(me: dict) -> dict:
    return {"user_id": "hub:" + me["user"], "email": "總後台 " + me["user"], "name": me["user"], "role": "admin"}


async def _log(me: dict, p: dict, action: str, target: str, detail: str = ""):
    await db.hub_logs.insert_one({"id": uuid.uuid4().hex, "user": me["user"], "platform": p["id"], "action": action, "target": target, "detail": detail[:300], "at": now_iso()})


class ActionIn(BaseModel):
    action: str
    remark: str = ""
    tx_id: str = ""
    amount: Optional[float] = None
    force: bool = False


@router.post("/orders/{platform}/{oid}/action")
async def order_action(platform: str, oid: str, body: ActionIn, me: dict = Depends(need("orders_write"))):
    p = await _plat(me, platform)
    k, a = _k(p), body.action
    if k == "local":
        srv = _srv()
        st_map = {"cancel": "cancelled", "processing": "processing", "ship": "shipped", "mark_completed": "completed", "exception": "exception", "set_status": body.remark and body.tx_id}
        if a == "complete":
            r = await srv.admin_confirm_topup(oid, admin=_actor(me))
        elif a == "reject_info":
            r = await srv.admin_reject_info(oid, srv.RejectInfoIn(reason=body.remark), admin=_actor(me))
        elif a == "set_status":
            r = await srv.admin_update_order(oid, srv.StatusUpdate(status=body.tx_id, admin_note=body.remark or None), admin=_actor(me))
        elif a in st_map:
            r = await srv.admin_update_order(oid, srv.StatusUpdate(status=st_map[a], admin_note=body.remark or None), admin=_actor(me))
        else:
            raise HTTPException(status_code=400, detail="不支援的操作")
        res = {"ok": True, "status": r.get("status") if isinstance(r, dict) else None}
    elif k == "giftray":
        if a == "add_number_review":
            res = {"ok": True, "result": await hub_giftray.post(p, f"/admin/orders/{oid}/add-number-review")}
        elif a == "regenerate_txn":
            res = {"ok": True, "result": await hub_giftray.post(p, f"/admin/orders/{oid}/txn", {"regenerate": True})}
        else:
            st = {"complete": "completed", "processing": "processing", "cancel": "cancelled", "reject_info": "need_info"}.get(a)
            if not st:
                raise HTTPException(status_code=400, detail="不支援的操作")
            await hub_giftray.post(p, f"/admin/orders/{oid}/status", {"status": st, "remark": body.remark})
            res = {"ok": True, "status": st}
    elif k == "sifang":
        if a != "manual_callback":
            raise HTTPException(status_code=400, detail="不支援的操作")
        if "funds_write" not in me["modules"]:
            raise HTTPException(status_code=403, detail="需要「四方資金操作」權限")
        if not body.tx_id or not body.amount:
            raise HTTPException(status_code=400, detail="請填寫 TxID 與金額")
        r = await hub_sifang.post(p, f"/orders/{oid}/manual-callback", {"tx_id": body.tx_id, "amount": body.amount, "force": body.force})
        res = {"ok": True, "result": r}
    else:
        raise HTTPException(status_code=400, detail="此平台不支援遠端操作")
    await _log(me, p, "order:" + a, oid, body.remark or body.tx_id)
    if body.remark:
        await db.hub_order_notes.insert_one({"id": uuid.uuid4().hex, "platform": p["id"], "oid": oid, "by": me["user"], "text": body.remark, "action": a, "at": now_iso()})
    return res


@router.post("/topups/{platform}/{tid}/action")
async def topup_action(platform: str, tid: str, body: ActionIn, me: dict = Depends(need("topups_write"))):
    p = await _plat(me, platform)
    k, a = _k(p), body.action
    if k == "local":
        if a == "approve":
            await payments_api.admin_topup_approve(tid, admin=_actor(me))
        elif a == "reject":
            await payments_api.admin_topup_reject(tid, payments_api.RejectIn(reason=body.remark), admin=_actor(me))
        else:
            raise HTTPException(status_code=400, detail="不支援的操作")
    elif k == "giftray":
        path = {"approve": "approve", "reject": "reject", "gateway_sync": "gateway-sync", "reverify": "reverify"}.get(a)
        if not path:
            raise HTTPException(status_code=400, detail="不支援的操作")
        await hub_giftray.post(p, f"/admin/recharges/{tid}/{path}", {"remark": body.remark} if a == "reject" else {})
    else:
        raise HTTPException(status_code=400, detail="此平台不支援此操作")
    await _log(me, p, "topup:" + a, tid, body.remark)
    return {"ok": True}


# ----------------------------- chat read / reply -----------------------------
@router.get("/chats/{platform}/{sid}/messages")
async def chat_messages(platform: str, sid: str, me: dict = Depends(need("cs"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        r = await chat_api.admin_messages(sid, admin=_actor(me))
        return {"messages": [{"id": m.get("id"), "from": "admin" if m.get("sender") == "admin" else "system" if m.get("sender") == "system" else "user", "text": m.get("text") or "", "image": m.get("image") or "", "name": m.get("admin_name") or "", "at": m.get("created_at")} for m in r["messages"]], "session": r["session"]}
    if k == "giftray":
        return await hub_giftray.messages(p, sid)
    if k == "sifang":
        return await hub_sifang.messages(p, sid)
    raise HTTPException(status_code=400, detail="此平台不支援")


class ReplyIn(BaseModel):
    text: str = ""
    image_b64: str = ""
    image_name: str = "image.jpg"
    image_url: str = ""


@router.post("/chats/{platform}/{sid}/reply")
async def chat_reply(platform: str, sid: str, body: ReplyIn, me: dict = Depends(need("cs_write"))):
    p = await _plat(me, platform)
    k, text = _k(p), body.text.strip()
    if not text and not body.image_b64 and not body.image_url:
        raise HTTPException(status_code=400, detail="請輸入內容或附上圖片")
    if body.image_b64 and len(body.image_b64) > 11_000_000:
        raise HTTPException(status_code=400, detail="圖片請小於 8MB")
    if k == "local":
        await chat_api.admin_send(sid, chat_api.AdminMessageIn(text=text, image_b64=body.image_b64, image_name=body.image_name), admin=_actor(me))
    elif k == "giftray":
        url = body.image_url
        if body.image_b64:
            raw = body.image_b64.split(",", 1)[-1]
            url = await hub_giftray.upload(p, base64.b64decode(raw), body.image_name or "image.jpg")
        await hub_giftray.post(p, f"/admin/chat/sessions/{sid}/messages", {k2: v for k2, v in {"text": text, "image": url}.items() if v})
    elif k == "sifang":
        if body.image_b64:
            raise HTTPException(status_code=400, detail="四方平台僅支援圖片網址，請貼圖片 URL")
        await hub_sifang.post(p, f"/support/threads/{sid}/reply", {k2: v for k2, v in {"text": text, "sender_name": "總後台 " + me["user"], "image": body.image_url}.items() if v})
    else:
        raise HTTPException(status_code=400, detail="此平台不支援")
    await _log(me, p, "chat:reply", sid, text or "[圖片]")
    return {"ok": True}


class AssignIn(BaseModel):
    admin: str = ""


@router.get("/cs-agents")
async def cs_agents(me: dict = Depends(need("cs"))):
    su, _, _ = _cfg()
    rows = [a["username"] async for a in db.hub_admins.find({"enabled": True, "modules": "cs_write"}, {"_id": 0, "username": 1})]
    return {"agents": [su] + rows}


@router.post("/chats/{platform}/{sid}/assign")
async def chat_assign(platform: str, sid: str, body: AssignIn, me: dict = Depends(need("cs_write"))):
    p = await _plat(me, platform)
    if body.admin:
        await db.hub_chat_assign.update_one({"platform": p["id"], "sid": sid}, {"$set": {"admin": body.admin, "by": me["user"], "at": now_iso()}}, upsert=True)
    else:
        await db.hub_chat_assign.delete_one({"platform": p["id"], "sid": sid})
    await _log(me, p, "chat:assign", sid, body.admin or "取消指派")
    return {"ok": True}


@router.post("/chats/{platform}/{sid}/{op}")
async def chat_op(platform: str, sid: str, op: str, me: dict = Depends(need("cs_write"))):
    if op not in ("close", "reopen"):
        raise HTTPException(status_code=404)
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        await chat_api.admin_patch_session(sid, chat_api.SessionPatch(status="handled" if op == "close" else "open"), admin=_actor(me))
    elif k == "giftray":
        await hub_giftray.post(p, f"/admin/chat/sessions/{sid}/{op}")
    else:
        raise HTTPException(status_code=400, detail="此平台不支援結束 / 重開")
    await _log(me, p, "chat:" + op, sid)
    return {"ok": True}


# ----------------------------- sifang funds -----------------------------
class AdjustIn(BaseModel):
    action: str
    amount: float = 0
    remark: str = ""


@router.post("/sifang/{platform}/accounts/{aid}/adjust")
async def sifang_adjust(platform: str, aid: str, body: AdjustIn, me: dict = Depends(need("funds_write"))):
    p = await _plat(me, platform)
    if _k(p) != "sifang":
        raise HTTPException(status_code=400, detail="僅四方平台")
    if body.action == "toggle":
        r = await hub_sifang.post(p, f"/accounts/{aid}/toggle-status")
    elif body.action in ("credit", "debit", "freeze", "unfreeze"):
        r = await hub_sifang.post(p, f"/accounts/{aid}/adjust", {"amount": body.amount, "action": body.action, "remark": body.remark})
    else:
        raise HTTPException(status_code=400, detail="不支援的操作")
    await _log(me, p, "account:" + body.action, aid, f"{body.amount} {body.remark}")
    return {"ok": True, "result": r}


@router.get("/sifang/{platform}/payouts")
async def sifang_payouts(platform: str, status: str = "pending", me: dict = Depends(need("members"))):
    p = await _plat(me, platform)
    if _k(p) != "sifang":
        raise HTTPException(status_code=400, detail="僅四方平台")
    return {"rows": await hub_sifang.payouts(p, status)}


@router.post("/sifang/{platform}/payouts/{pid}/{op}")
async def sifang_payout_op(platform: str, pid: str, op: str, me: dict = Depends(need("funds_write"))):
    if op not in ("approve", "reject"):
        raise HTTPException(status_code=404)
    p = await _plat(me, platform)
    if _k(p) != "sifang":
        raise HTTPException(status_code=400, detail="僅四方平台")
    r = await hub_sifang.post(p, f"/settlements/payouts/{pid}/{op}")
    await _log(me, p, "payout:" + op, pid)
    return {"ok": True, "result": r}


@router.get("/logs")
async def hub_logs(size: int = 200, me: dict = Depends(need("admins"))):
    return {"rows": await db.hub_logs.find({}, {"_id": 0}).sort("at", -1).to_list(max(1, min(size, 500)))}


# ----------------------------- detail panels -----------------------------
def _hk(v, rate):
    return f"HK${float(v or 0):,.0f}"


def _local_order_detail(o: dict) -> dict:
    fields = {}
    for pid, f in (o.get("delivery_info") or {}).items():
        if isinstance(f, dict):
            fields.update(f)
    if o.get("recharge_account"):
        fields.setdefault("充值帳號", o["recharge_account"])
    if o.get("recharge_note"):
        fields.setdefault("備註", o["recharge_note"])
    return {"id": o["id"], "order_no": o.get("order_no"), "type": "giftcard" if o.get("is_giftcard_order") else "order", "status": o.get("status"), "user": o.get("user_email"), "contact": o.get("contact") or "",
            "amount_usd": float(o.get("total_usd") or 0), "amount_label": "", "payment_method": o.get("payment_method") or "", "promo": o.get("promo_code") or o.get("cart_promo_title") or "",
            "items": [{"name": i.get("product_name"), "spec": i.get("spec_label") or "", "qty": i.get("quantity") or 1, "price": float(i.get("unit_price_usd") or 0), "image": i.get("image") or ""} for i in o.get("items", [])],
            "fields": fields, "info_submitted": bool(o.get("info_submitted")), "info_rejected": bool(o.get("info_rejected")), "admin_note": o.get("admin_note") or "", "images": [],
            "timeline": [{"at": t.get("at"), "text": t.get("status"), "by": ""} for t in o.get("timeline", [])], "created_at": o.get("created_at"), "paid_at": o.get("paid_at"), "completed_at": None, "transaction_no": o.get("transaction_no") or "",
            "extra": {k: v for k, v in {"等級": o.get("level_name"), "積分折抵": o.get("points_discount_usd"), "優惠": o.get("discount_usd")}.items() if v}}


def _giftray_order_detail(o: dict, rate: float) -> dict:
    tl = [{"at": o.get("createdAt"), "text": "下單（餘額扣款）", "by": ""}]
    if o.get("completedAt"):
        tl.append({"at": o["completedAt"], "text": "完成", "by": ""})
    if o.get("redeemedAt"):
        tl.append({"at": o["redeemedAt"], "text": "禮品卡已核銷", "by": o.get("redeemedBy") or ""})
    gift = bool(o.get("transactionNo") or o.get("autoReview") or o.get("redeemed"))
    return {"id": o.get("id"), "order_no": o.get("id"), "type": "giftcard" if gift else "order", "status": hub_giftray.STATUS.get(o.get("status"), o.get("status")), "user": o.get("email") or "", "contact": o.get("email") or "",
            "amount_usd": hub_giftray._usd(o.get("amount"), rate), "amount_label": _hk(o.get("amount"), rate), "payment_method": "餘額", "promo": "",
            "items": [{"name": o.get("productName"), "spec": o.get("denom") or "", "qty": o.get("qty") or 1, "price": hub_giftray._usd(float(o.get("amount") or 0) / max(1, int(o.get("qty") or 1)), rate), "image": o.get("image") or ""}],
            "fields": o.get("fields") or {}, "need_fields": o.get("needFields") or [], "info_submitted": bool(o.get("fields")), "info_rejected": o.get("status") == "need_info", "admin_note": o.get("deliveryNote") or "", "reject_reason": o.get("rejectReason") or "",
            "images": [], "timeline": tl, "created_at": o.get("createdAt"), "paid_at": o.get("createdAt"), "completed_at": o.get("completedAt"), "transaction_no": o.get("transactionNo") or "",
            "extra": {k: v for k, v in {"自動審核": {"matched": "號碼庫命中", "unmatched": "需人工"}.get(o.get("autoReview"), o.get("autoReview")), "已核銷": "是" if o.get("redeemed") else None, "測試單": "是" if o.get("isTest") else None}.items() if v}}


@router.get("/orders/{platform}/{oid}")
async def order_detail(platform: str, oid: str, me: dict = Depends(need("orders"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        o = await db.orders.find_one({"id": oid}, {"_id": 0})
        if not o:
            raise HTTPException(status_code=404, detail="訂單不存在")
        return {"kind": "shop", **_local_order_detail(o)}
    if k == "giftray":
        rate = await hub_giftray._rate(p)
        o = next((x for x in hub_giftray._items(await hub_giftray._get(p, "/admin/orders", {"limit": 3000})) if x.get("id") == oid), None)
        if not o:
            raise HTTPException(status_code=404, detail="訂單不存在")
        return {"kind": "shop", **_giftray_order_detail(o, rate)}
    if k == "sifang":
        o = await hub_sifang._get(p, f"/orders/{oid}")
        return {"kind": "sifang", **hub_sifang._row(o if isinstance(o, dict) else {}), "raw": o}
    raise HTTPException(status_code=400, detail="此平台不支援")


@router.get("/topups/{platform}/{tid}")
async def topup_detail(platform: str, tid: str, me: dict = Depends(need("topups"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="充值單不存在")
        u = await db.users.find_one({"user_id": t.get("user_id")}, {"_id": 0, "email": 1, "wallet_balance_usd": 1})
        bank = t.get("bank") or {}
        return {"kind": "shop", "id": t["id"], "order_no": t.get("out_trade_no") or t["id"], "status": t.get("status"), "user": (u or {}).get("email", ""), "wallet_usd": float((u or {}).get("wallet_balance_usd") or 0),
                "amount_usd": float(t.get("amount_usd") or 0), "fee_usd": float(t.get("fee_usd") or 0), "pay_amount": t.get("pay_amount"), "method": t.get("method_name") or "", "provider": t.get("provider") or "", "network": t.get("network") or "",
                "address": bank.get("account_no") or "", "bank": bank, "tx_hash": "", "reference_code": t.get("reference_code") or "", "payer_name": t.get("payer_name") or "", "proof_image": t.get("proof_image") or "", "proof_note": t.get("proof_note") or "", "proof_at": t.get("proof_at"),
                "reject_reason": t.get("reject_reason") or "", "created_at": t.get("created_at"), "expires_at": t.get("expires_at"), "paid_at": t.get("paid_at") or t.get("approved_at"), "extra": {}}
    if k == "giftray":
        t = next((x for x in hub_giftray._items(await hub_giftray._get(p, "/admin/recharges", {"limit": 3000})) if x.get("id") == tid), None)
        if not t:
            raise HTTPException(status_code=404, detail="充值單不存在")
        rate = await hub_giftray._rate(p)
        return {"kind": "shop", "id": t["id"], "order_no": t["id"], "status": hub_giftray.STATUS.get(t.get("status"), t.get("status")), "user": t.get("email") or "", "wallet_usd": None,
                "amount_usd": round(float(t.get("usdt") or 0), 2), "amount_label": _hk(t.get("hkd"), rate), "fee_usd": 0, "pay_amount": t.get("payAmount"), "method": hub_giftray.SOURCE.get(t.get("source") or "", t.get("source")), "provider": t.get("source") or "usdt", "network": t.get("network") or "",
                "address": t.get("address") or "", "tx_hash": t.get("txHash") or "", "reference_code": t.get("outTradeNo") or t.get("gatewayOrderNo") or "", "payer_name": "", "proof_image": "", "proof_note": "", "proof_at": None,
                "reject_reason": t.get("rejectReason") or "", "created_at": t.get("createdAt"), "expires_at": None, "paid_at": t.get("approvedAt"),
                "extra": {k2: v for k2, v in {"鏈上核驗": t.get("verifyStatus"), "核驗說明": t.get("verifyReason"), "審核人": t.get("approvedBy") or t.get("rejectedBy"), "通道狀態": t.get("gatewayStatus"), "原申請 USDT": t.get("originalUsdt") if t.get("amountAdjusted") else None, "測試單": "是" if t.get("isTest") else None}.items() if v}}
    if k == "sifang":
        o = await hub_sifang._get(p, f"/orders/{tid}")
        return {"kind": "sifang", **hub_sifang._row(o if isinstance(o, dict) else {}), "raw": o}
    raise HTTPException(status_code=400, detail="此平台不支援")


@router.get("/chats/{platform}/{sid}/customer")
async def chat_customer(platform: str, sid: str, me: dict = Depends(need("cs"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        sess = await db.chat_sessions.find_one({"id": sid}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=404, detail="會話不存在")
        u = await db.users.find_one({"user_id": sess.get("user_id")}, {"_id": 0}) if sess.get("user_id") else None
        if not u and sess.get("contact"):
            u = await db.users.find_one({"email": sess["contact"]}, {"_id": 0})
        orders, topups = [], []
        if u:
            orders = [hub_api._order_row(o) for o in await db.orders.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)]
            topups = [{"id": t["id"], "order_no": t.get("out_trade_no") or t["id"], "status": t.get("status"), "amount_usd": float(t.get("amount_usd") or 0), "created_at": t.get("created_at")} for t in await db.topup_orders.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)]
        return {"guest": not u, "session": {"id": sid, "name": sess.get("name"), "contact": sess.get("contact"), "status": sess.get("status"), "page": sess.get("page"), "created_at": sess.get("created_at")},
                "user": {"email": u.get("email"), "name": u.get("name"), "wallet_usd": float(u.get("wallet_balance_usd") or 0), "created_at": u.get("created_at"), "order_count": len(orders)} if u else None, "orders": orders, "topups": topups}
    if k == "giftray":
        d = await hub_giftray._get(p, f"/admin/chat/sessions/{sid}/customer")
        rate = await hub_giftray._rate(p)
        u = d.get("user") or None
        return {"guest": bool(d.get("guest")) or not u, "session": {"id": sid, "name": (d.get("session") or {}).get("name"), "contact": (d.get("session") or {}).get("account"), "status": (d.get("session") or {}).get("status")},
                "user": {"email": u.get("account") or u.get("email"), "name": u.get("name"), "wallet_usd": hub_giftray._usd(u.get("balance"), rate), "wallet_label": _hk(u.get("balance"), rate), "created_at": u.get("createdAt"), "order_count": u.get("orderCount")} if u else None,
                "orders": [hub_giftray._order_row(o, rate) for o in d.get("orders") or []], "topups": [hub_giftray._topup_row(t) for t in d.get("recharges") or []]}
    if k == "sifang":
        try:
            o = await hub_sifang._get(p, f"/orders/{sid}")
        except HTTPException:
            o = None
        return {"guest": True, "session": {"id": sid, "name": sid, "contact": "", "status": ""}, "user": None, "orders": [], "topups": [{**hub_sifang._topup_row(o), "order_no": o.get("order_no")}] if isinstance(o, dict) and o.get("order_no") else []}
    raise HTTPException(status_code=400, detail="此平台不支援")


@router.get("/chats/{platform}/quick-replies")
async def chat_quick_replies(platform: str, me: dict = Depends(need("cs"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        return {"items": [(i.get("a") or i.get("q")) for i in await chat_api.get_quick_replies()]}
    if k == "giftray":
        try:
            d = await hub_giftray._get(p, "/admin/chat/settings")
            return {"items": [x for x in (d.get("quickReplies") or []) if x]}
        except HTTPException:
            return {"items": []}
    return {"items": []}


class NoteIn(BaseModel):
    note: str = ""
    transaction_no: str = ""


@router.post("/orders/{platform}/{oid}/note")
async def order_note(platform: str, oid: str, body: NoteIn, me: dict = Depends(need("orders_write"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        r = await db.orders.update_one({"id": oid}, {"$set": {"admin_note": body.note}}) if body.note else None
        if r is not None and not r.matched_count:
            raise HTTPException(status_code=404, detail="訂單不存在")
    elif k == "giftray":
        if body.transaction_no:
            await hub_giftray.post(p, f"/admin/orders/{oid}/txn", {"transactionNo": body.transaction_no})
        if body.note:
            o = next((x for x in hub_giftray._items(await hub_giftray._get(p, "/admin/orders", {"limit": 3000})) if x.get("id") == oid), None)
            if not o:
                raise HTTPException(status_code=404, detail="訂單不存在")
            await hub_giftray.post(p, f"/admin/orders/{oid}/status", {"status": o.get("status"), "remark": body.note})
    else:
        raise HTTPException(status_code=400, detail="此平台不支援")
    await _log(me, p, "order:note", oid, body.note or body.transaction_no)
    if body.note:
        await db.hub_order_notes.insert_one({"id": uuid.uuid4().hex, "platform": p["id"], "oid": oid, "by": me["user"], "text": body.note, "action": "note", "at": now_iso()})
    return {"ok": True}


@router.get("/orders/{platform}/{oid}/notes")
async def order_notes(platform: str, oid: str, me: dict = Depends(need("orders"))):
    p = await _plat(me, platform)
    rows = await db.hub_order_notes.find({"platform": p["id"], "oid": oid}, {"_id": 0}).sort("at", -1).to_list(100)
    if _k(p) == "local":
        o = await db.orders.find_one({"id": oid}, {"_id": 0, "admin_note": 1, "confirmed_by": 1, "completed_at": 1}) or {}
        if o.get("admin_note") and not any(r["text"] == o["admin_note"] for r in rows):
            rows.append({"by": "原後台", "text": o["admin_note"], "action": "note", "at": o.get("completed_at")})
    return {"rows": rows}


# ----------------------------- cs unread + today strip -----------------------------
@router.get("/cs-unread")
async def cs_unread(me: dict = Depends(need("cs"))):
    out, total = {}, 0
    for p in await _all_platforms():
        if not _allowed(me, p["id"]):
            continue
        try:
            r = await _chats(p, "open")
            out[p["id"]] = int(r.get("unread") or 0)
            total += out[p["id"]]
        except Exception:  # noqa: BLE001
            out[p["id"]] = None
    return {"total": total, "by_platform": out, "now": now_iso()}


@router.get("/today")
async def today_strip(me: dict = Depends(need("dashboard"))):
    bj = timezone(timedelta(hours=8))
    t0 = datetime.now(bj).replace(hour=0, minute=0, second=0, microsecond=0)
    today, yday = t0.astimezone(timezone.utc).isoformat(), (t0 - timedelta(days=1)).astimezone(timezone.utc).isoformat()
    cfg = await hub_api.get_cfg()
    rows, errors = [], []
    for p in await _all_platforms():
        if not _allowed(me, p["id"]):
            continue
        try:
            if _k(p) == "sifang":
                os_ = [hub_sifang._row(o) for o in await hub_sifang._orders(p)]
                def agg(a, b):
                    pd = [o for o in os_ if o["status"] == "paid" and a <= (o["paid_at"] or "") < b]
                    return {"rev": round(sum(o["amount_usdt"] for o in pd), 2), "orders": len(pd), "topup": 0}
                rows.append({"platform": {"id": p["id"], "name": p["name"], "kind": "sifang"}, "today": agg(today, "9"), "yday": agg(yday, today), "unit": "USDT"})
                continue
            o = (await hub_api.hub_orders(status="", size=500, x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/orders", {"size": 500}))["rows"]
            t = (await hub_api.hub_topups(status="", size=500, x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/topups", {"size": 500}))["rows"]
            def agg2(a, b):
                po = [x for x in o if x.get("paid_at") and a <= x["paid_at"] < b and x.get("status") not in ("cancelled", "refunded")]
                pt = [x for x in t if x.get("status") in ("approved", "paid", "completed") and a <= (x.get("paid_at") or x.get("created_at") or "") < b]
                return {"rev": round(sum(float(x.get("amount_usd") or 0) for x in po), 2), "orders": len(po), "topup": round(sum(float(x.get("amount_usd") or 0) for x in pt), 2)}
            rows.append({"platform": {"id": p["id"], "name": p["name"], "kind": _k(p)}, "today": agg2(today, "9"), "yday": agg2(yday, today), "unit": "USD"})
        except Exception as e:  # noqa: BLE001
            errors.append({"platform": p["id"], "name": p["name"], "error": getattr(e, "detail", str(e))})
    return {"rows": rows, "errors": errors, "bj_date": t0.strftime("%Y-%m-%d")}


# ----------------------------- member detail / actions -----------------------------
@router.get("/members/{platform}/{uid}")
async def member_detail(platform: str, uid: str, me: dict = Depends(need("members"))):
    p = await _plat(me, platform)
    k = _k(p)
    if k == "local":
        u = await db.users.find_one({"user_id": uid}, {"_id": 0})
        if not u:
            raise HTTPException(status_code=404, detail="會員不存在")
        orders = [hub_api._order_row(o) for o in await db.orders.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(200)]
        topups = [{"id": t["id"], "order_no": t.get("out_trade_no") or t["id"], "status": t.get("status"), "amount_usd": float(t.get("amount_usd") or 0), "items": [t.get("method_name") or t.get("network") or ""], "created_at": t.get("created_at")} for t in await db.topup_orders.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(200)]
        txs = [{"at": x.get("created_at"), "kind": x.get("kind"), "amount": float(x.get("amount_usd") or 0), "after": float(x.get("balance_after_usd") or 0), "note": x.get("note") or ""} for x in await db.wallet_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(50)]
        return {"kind": "shop", "user": {"id": uid, "email": u.get("email", ""), "name": u.get("name") or (u.get("profile") or {}).get("name") or "", "phone": u.get("phone", ""), "wallet_usd": float(u.get("wallet_balance_usd") or 0), "wallet_label": "", "disabled": bool(u.get("banned")), "ban_reason": u.get("ban_reason", ""), "is_test": bool(u.get("is_test")), "created_at": u.get("created_at"), "level": u.get("level_name") or "", "points": u.get("points")},
                "orders": orders, "topups": topups, "wallet_tx": txs, "currency": "USD"}
    if k == "giftray":
        d = await hub_giftray._get(p, f"/admin/users/{uid}/detail")
        rate = await hub_giftray._rate(p)
        u = d.get("user") or {}
        return {"kind": "shop", "user": {"id": u.get("id") or uid, "email": u.get("account") or u.get("email") or "", "name": u.get("name") or "", "phone": u.get("phone", ""), "wallet_usd": hub_giftray._usd(u.get("balance"), rate), "wallet_label": _hk(u.get("balance"), rate), "wallet_hkd": float(u.get("balance") or 0), "disabled": bool(u.get("disabled")), "ban_reason": "", "is_test": bool(u.get("isTest")), "created_at": u.get("createdAt"), "level": u.get("role") or "", "twofa": bool(u.get("twofa_enabled"))},
                "orders": [hub_giftray._order_row(o, rate) for o in d.get("orders") or []], "topups": [hub_giftray._topup_row(t) for t in d.get("recharges") or []], "wallet_tx": [], "currency": "HKD"}
    if k == "sifang":
        a = next((x for x in (await hub_sifang.account_list(p, ""))["rows"] if str(x["id"]) == uid), None)
        if not a:
            raise HTTPException(status_code=404, detail="帳戶不存在")
        rows = [o for o in (await hub_sifang.order_list(p, "", "", "", "", 500))["rows"] if o["merchant_id"] == uid or o["merchant_name"] == a["name"]]
        return {"kind": "sifang", "user": {**a, "disabled": a.get("status") == "frozen"}, "orders": rows, "topups": [], "wallet_tx": [], "currency": "USDT"}
    raise HTTPException(status_code=400, detail="此平台不支援")


class MemberActIn(BaseModel):
    action: str
    amount: float = 0
    remark: str = ""


@router.post("/members/{platform}/{uid}/action")
async def member_action(platform: str, uid: str, body: MemberActIn, me: dict = Depends(need("members_write"))):
    p = await _plat(me, platform)
    k, a = _k(p), body.action
    if k == "local":
        if a == "adjust":
            if not body.amount:
                raise HTTPException(status_code=400, detail="金額不可為 0")
            bal = await _srv()._wallet_tx(uid, "admin_adjust", float(body.amount), f"總後台 {me['user']}：{body.remark}".strip("：")) 
            res = {"ok": True, "balance": bal}
        elif a == "disable":
            await admin_api.admin_member_ban(uid, admin_api.BanIn(reason=body.remark or f"總後台 {me['user']} 停用"), admin=_actor(me))
            res = {"ok": True}
        elif a == "enable":
            await admin_api.admin_member_unban(uid, admin=_actor(me))
            res = {"ok": True}
        else:
            raise HTTPException(status_code=400, detail="不支援的操作")
    elif k == "giftray":
        if a == "adjust":
            if not body.amount:
                raise HTTPException(status_code=400, detail="金額不可為 0")
            res = {"ok": True, **(await hub_giftray.post(p, f"/admin/users/{uid}/balance", {"delta": float(body.amount)}) or {})}
        elif a in ("disable", "enable"):
            await hub_giftray.post(p, f"/admin/users/{uid}/disable", {"disabled": a == "disable"})
            res = {"ok": True}
        else:
            raise HTTPException(status_code=400, detail="不支援的操作")
    else:
        raise HTTPException(status_code=400, detail="四方商戶請使用「資金操作」")
    await _log(me, p, "member:" + a, uid, f"{body.amount} {body.remark}".strip())
    return res


# ----------------------------- batch -----------------------------
class BatchIn(BaseModel):
    ids: List[str]
    action: str
    remark: str = ""


@router.post("/orders/{platform}/batch")
async def orders_batch(platform: str, body: BatchIn, me: dict = Depends(need("orders_write"))):
    ok, failed = 0, []
    for oid in body.ids[:200]:
        try:
            await order_action(platform, oid, ActionIn(action=body.action, remark=body.remark), me=me)
            ok += 1
        except HTTPException as e:
            failed.append({"id": oid, "detail": e.detail})
        except Exception as e:  # noqa: BLE001
            failed.append({"id": oid, "detail": str(e)[:120]})
    return {"ok": ok, "failed": failed}


@router.post("/topups/{platform}/batch")
async def topups_batch(platform: str, body: BatchIn, me: dict = Depends(need("topups_write"))):
    ok, failed = 0, []
    for tid in body.ids[:200]:
        try:
            await topup_action(platform, tid, ActionIn(action=body.action, remark=body.remark), me=me)
            ok += 1
        except HTTPException as e:
            failed.append({"id": tid, "detail": e.detail})
        except Exception as e:  # noqa: BLE001
            failed.append({"id": tid, "detail": str(e)[:120]})
    return {"ok": ok, "failed": failed}


@router.get("/ui", include_in_schema=False)
@page_router.get(f"/{HUB_PATH}", include_in_schema=False)
@page_router.get(f"/{HUB_PATH}/{{rest:path}}", include_in_schema=False)
async def hub_page(rest: str = ""):
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})
