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

import importlib

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
MODULES = ["dashboard", "orders", "orders_write", "topups", "topups_write", "cs", "cs_write", "members", "funds_write", "platforms", "admins"]
LOCAL = {**hub_api.LOCAL, "kind": "local"}


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


async def _visible(me: dict) -> List[dict]:
    return [{"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop"), "cs_url": p.get("cs_url", "/gg589-k7p2x?s=chat-sessions" if p["id"] == LOCAL["id"] else ""),
             "admin_url": p.get("admin_url", "/gg589-k7p2x" if p["id"] == LOCAL["id"] else "")} for p in await _all_platforms() if _allowed(me, p["id"])]


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
    r = await hub_api.hub_orders(status=status, size=min(size, 200), x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/orders", {"status": status, "size": min(size, 200)})
    rows = [x for x in r.get("rows", []) if kind == "all" or x.get("type") == kind]
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
    r = await hub_api.hub_topups(status=status, size=min(size, 200), x_hub_key=cfg["inbound_key"]) if _k(p) == "local" else await hub_api._remote(p, "/hub/topups", {"status": status, "size": min(size, 200)})
    rows = r.get("rows", [])
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


@router.get("/chats")
async def chats(platform: str, status: str = "open", me: dict = Depends(need("cs"))):
    p = await _plat(me, platform)
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
        if a == "complete":
            r = await srv.admin_confirm_topup(oid, admin=_actor(me))
        elif a == "reject_info":
            r = await srv.admin_reject_info(oid, srv.RejectInfoIn(reason=body.remark), admin=_actor(me))
        elif a in ("cancel", "processing"):
            r = await srv.admin_update_order(oid, srv.StatusUpdate(status="cancelled" if a == "cancel" else "processing", admin_note=body.remark or None), admin=_actor(me))
        else:
            raise HTTPException(status_code=400, detail="不支援的操作")
        res = {"ok": True, "status": r.get("status") if isinstance(r, dict) else None}
    elif k == "giftray":
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
    text: str


@router.post("/chats/{platform}/{sid}/reply")
async def chat_reply(platform: str, sid: str, body: ReplyIn, me: dict = Depends(need("cs_write"))):
    p = await _plat(me, platform)
    k, text = _k(p), body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="請輸入內容")
    if k == "local":
        await chat_api.admin_send(sid, chat_api.AdminMessageIn(text=text), admin=_actor(me))
    elif k == "giftray":
        await hub_giftray.post(p, f"/admin/chat/sessions/{sid}/messages", {"text": text})
    elif k == "sifang":
        await hub_sifang.post(p, f"/support/threads/{sid}/reply", {"text": text, "sender_name": "總後台 " + me["user"]})
    else:
        raise HTTPException(status_code=400, detail="此平台不支援")
    await _log(me, p, "chat:reply", sid, text)
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


@router.get("/ui", include_in_schema=False)
@page_router.get(f"/{HUB_PATH}", include_in_schema=False)
@page_router.get(f"/{HUB_PATH}/{{rest:path}}", include_in_schema=False)
async def hub_page(rest: str = ""):
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})
