"""Built-in online support chat.

Thread key = order_no. Anonymous payer (checkout, no auth) <-> support agents
(admin / operators with the ``support.manage`` seat permission). Features:
Telegram ping on new conversation, saved reply templates, image attachments
(stored in Emergent object storage), open/resolved status with auto-assignment,
visitor typing indicator, workload stats, and auto-purge of a resolved+paid
conversation's data.
"""
import asyncio
import hmac
import logging
import os
from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Request, HTTPException, Query, Response
from pydantic import BaseModel

from core import db
from utils import iso, now_utc, chat_token
from deps import require_roles
from shared import audit, send_telegram
from storage import upload_data_url, get_object

try:
    import opencc
    _s2t = opencc.OpenCC("s2tw")

    def to_trad(s: Optional[str]) -> Optional[str]:
        return _s2t.convert(s) if s else s
except Exception:  # pragma: no cover - fallback if opencc unavailable
    def to_trad(s: Optional[str]) -> Optional[str]:
        return s

router = APIRouter(prefix="/api")
logger = logging.getLogger("sifang")

MAX_LEN = 2000
MAX_IMG = 3_600_000
TYPING_WINDOW = 8
DEFAULT_TEMPLATES = [
    "你好，请问有什么可以帮助您呢？",
    "你好，请提供您的付款截图及交易哈希值（交易号）。",
    "您好，请提供您的转账哈希（TxID），我们帮您核实。",
    "已收到，正在为您查询，请稍候。",
    "您的订单已成功到账，感谢您的支付。",
    "金额与订单不一致，请核对实际到账金额后告知我们。",
    "请提供转账截图，方便我们快速处理。",
]


class SupportMessageIn(BaseModel):
    text: str = ""
    image: Optional[str] = None


class ThreadStatusIn(BaseModel):
    status: str


class TemplatesIn(BaseModel):
    templates: List[str]


class AssignIn(BaseModel):
    assigned_id: str


class SupportSettingsIn(BaseModel):
    max_per_seat: int


SEAT_ONLINE_SECS = 120


def _seat_query():
    return {"$or": [{"role": "admin"}, {"role": "operator", "permissions": "support.manage"}]}


async def _touch_seen(user: dict):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"support_last_seen": iso(now_utc())}})


async def _online_seats() -> list:
    cutoff = now_utc() - timedelta(seconds=SEAT_ONLINE_SECS)
    out = []
    for s in await db.users.find(_seat_query()).to_list(200):
        ls = s.get("support_last_seen")
        try:
            if ls and datetime.fromisoformat(ls) >= cutoff:
                out.append(s)
        except Exception:
            pass
    out.sort(key=lambda s: str(s["_id"]))
    return out


async def _online_count() -> int:
    return len(await _online_seats())


async def _open_load_map() -> dict:
    agg = await db.support_threads.aggregate([
        {"$match": {"status": "open", "assigned_id": {"$ne": None}}},
        {"$group": {"_id": "$assigned_id", "n": {"$sum": 1}}}]).to_list(1000)
    return {a["_id"]: a["n"] for a in agg}


async def _max_per_seat() -> int:
    doc = await db.settings.find_one({"_id": "support"}) or {}
    try:
        return max(1, int(doc.get("max_per_seat", 5)))
    except Exception:
        return 5


async def _auto_assign(order_no: str, order: dict) -> Optional[str]:
    """Assign an unassigned thread to the least-busy online seat that is not at
    its concurrent-conversation cap. Returns the seat name, or None if nobody
    is available (nobody online, or every online seat is full)."""
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    if th.get("assigned_id"):
        return th.get("assigned_to")
    seats = await _online_seats()
    if not seats:
        return None
    load = await _open_load_map()
    cap = await _max_per_seat()
    avail = [s for s in seats if load.get(str(s["_id"]), 0) < cap]
    if not avail:
        return None
    # rotate order by last pick so equal-load seats are chosen fairly
    doc = await db.settings.find_one({"_id": "support"}) or {}
    last = doc.get("rr_last")
    ids = [str(s["_id"]) for s in avail]
    start = (ids.index(last) + 1) % len(ids) if last in ids else 0
    ordered = avail[start:] + avail[:start]
    seat = min(ordered, key=lambda s: load.get(str(s["_id"]), 0))
    sid = str(seat["_id"])
    sname = seat.get("name") or seat["email"]
    await db.support_threads.update_one({"_id": order_no},
        {"$set": {"assigned_id": sid, "assigned_to": sname}})
    await db.settings.update_one({"_id": "support"}, {"$set": {"rr_last": sid}}, upsert=True)
    await db.support_messages.insert_one({"order_no": order_no, "merchant_id": order.get("merchant_id"),
        "merchant_name": order["merchant_name"], "sender": "system", "sender_name": "系统",
        "text": f"系统已自动分配给 {sname}", "image": None, "created_at": iso(now_utc()),
        "read_agent": True, "read_customer": True})
    return sname


async def _waiting_since(order_no: str):
    """ISO time of the oldest customer message not yet followed by an agent reply."""
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(1000)
    last_agent = None
    for m in msgs:
        if m["sender"] == "agent":
            last_agent = m["created_at"]
    for m in msgs:
        if m["sender"] == "customer" and (last_agent is None or m["created_at"] > last_agent):
            return m["created_at"]
    return None


async def _reassign_offline():
    """Move unanswered open conversations off offline seats onto online, non-full
    seats. Throttled to ~30s so concurrent agent polling stays cheap."""
    doc = await db.settings.find_one({"_id": "support"}) or {}
    now = now_utc()
    last = doc.get("reassign_at")
    if last:
        try:
            if (now - datetime.fromisoformat(last)).total_seconds() < 30:
                return
        except Exception:
            pass
    await db.settings.update_one({"_id": "support"}, {"$set": {"reassign_at": iso(now)}}, upsert=True)
    online = await _online_seats()
    if not online:
        return
    online_ids = {str(s["_id"]) for s in online}
    load = await _open_load_map()
    cap = await _max_per_seat()
    rows = await db.support_threads.find(
        {"status": "open", "assigned_id": {"$ne": None}, "last_sender": "customer"}).to_list(1000)
    for th in rows:
        if th.get("assigned_id") in online_ids:
            continue
        avail = [s for s in online if load.get(str(s["_id"]), 0) < cap]
        if not avail:
            break
        seat = min(avail, key=lambda s: load.get(str(s["_id"]), 0))
        sid = str(seat["_id"]); sname = seat.get("name") or seat["email"]
        prev = th.get("assigned_to") or "原坐席"
        await db.support_threads.update_one({"_id": th["_id"]}, {"$set": {"assigned_id": sid, "assigned_to": sname}})
        load[sid] = load.get(sid, 0) + 1
        await db.support_messages.insert_one({"order_no": th["_id"], "merchant_id": th.get("merchant_id"),
            "merchant_name": th.get("merchant_name", ""), "sender": "system", "sender_name": "系统",
            "text": f"{prev} 已离线，会话自动转交给 {sname}", "image": None, "created_at": iso(now_utc()),
            "read_agent": True, "read_customer": True})


def _msg_view(m: dict) -> dict:
    return {"id": str(m["_id"]), "sender": m["sender"], "sender_name": m.get("sender_name", ""),
            "text": m.get("text", ""), "image": m.get("image"), "created_at": m["created_at"]}


async def _get_order(order_no: str) -> dict:
    o = await db.orders.find_one({"order_no": order_no})
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    return o


async def _merchant_of(order: dict):
    if not order.get("merchant_id"):
        return None
    try:
        return await db.users.find_one({"_id": ObjectId(order["merchant_id"])})
    except Exception:
        return None


async def _store_image(img: Optional[str]) -> Optional[str]:
    if not img:
        return None
    if not img.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="图片格式无效")
    if len(img) > MAX_IMG:
        raise HTTPException(status_code=400, detail="图片过大，请压缩后重试")
    # Store inline (base64) so images always render for agents regardless of
    # object-storage availability across preview/production environments.
    return img


async def _touch_thread(order: dict, text: str, sender: str, reopen: bool):
    now = iso(now_utc())
    upd = {"$set": {"merchant_id": order.get("merchant_id"), "merchant_name": order["merchant_name"],
                    "last_text": text or "[图片]", "last_sender": sender, "last_at": now}}
    if reopen:
        upd["$set"]["status"] = "open"
        upd["$setOnInsert"] = {"created_at": now}
    else:
        upd["$setOnInsert"] = {"created_at": now, "status": "open"}
    await db.support_threads.update_one({"_id": order["order_no"]}, upd, upsert=True)


# ---------------- Payer side (public, bound to checkout chat_token) ----------------
async def _public_order(order_no: str, request: Request) -> dict:
    tok = request.headers.get("x-chat-token") or request.query_params.get("t") or ""
    if not hmac.compare_digest(tok, chat_token(order_no)):
        raise HTTPException(status_code=403, detail="会话凭证无效")
    return await _get_order(order_no)


@router.get("/support/public/{order_no}")
async def support_public_get(order_no: str, request: Request):
    o = await _public_order(order_no, request)
    merchant = await _merchant_of(o)
    enabled = True if merchant is None else merchant.get("support_enabled", True)
    welcome = (merchant or {}).get("support_welcome") or ""
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(500)
    await db.support_messages.update_many(
        {"order_no": order_no, "sender": "agent", "read_customer": False}, {"$set": {"read_customer": True}})
    views = []
    for m in msgs:
        if m["sender"] == "system":
            continue
        v = _msg_view(m)
        if v["sender"] == "agent":
            v["text"] = to_trad(v["text"])  # agents type Simplified; payer sees Traditional
        views.append(v)
    # queue notice: a pending customer message with no online seat able to handle it
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    queued = False
    queue_position = 0
    if th.get("last_sender") == "customer":
        online_ids = {str(s["_id"]) for s in await _online_seats()}
        if th.get("assigned_id") not in online_ids:
            queued = True
            my_last = th.get("last_at") or ""
            waiting = await db.support_threads.find(
                {"status": "open", "last_sender": "customer"}).to_list(2000)
            ahead = 0
            for w in waiting:
                if w["_id"] == order_no:
                    continue
                if w.get("assigned_id") in online_ids:
                    continue
                if (w.get("last_at") or "") < my_last:
                    ahead += 1
            queue_position = ahead + 1
    return {"enabled": enabled, "welcome": to_trad(welcome), "merchant_name": o["merchant_name"],
            "order_status": o["status"], "status": th.get("status", "open"),
            "queued": queued, "queue_position": queue_position, "messages": views}


@router.post("/support/public/{order_no}/close")
async def support_public_close(order_no: str, request: Request):
    """Payer closed the chat after the issue was resolved — purge the thread and
    its messages/images so no record is kept."""
    await _public_order(order_no, request)
    th = await db.support_threads.find_one({"_id": order_no})
    if not th or th.get("status") != "resolved":
        return {"ok": True, "deleted": False}
    for m in await db.support_messages.find({"order_no": order_no, "image": {"$ne": None}}).to_list(1000):
        p = (m.get("image") or "").replace("/api/support/file/", "")
        if p:
            await db.support_files.update_one({"path": p}, {"$set": {"is_deleted": True}})
    await db.support_messages.delete_many({"order_no": order_no})
    await db.support_threads.delete_one({"_id": order_no})
    logger.info(f"support thread purged on payer close order_no={order_no}")
    return {"ok": True, "deleted": True}


@router.post("/support/public/{order_no}")
async def support_public_post(order_no: str, data: SupportMessageIn, request: Request):
    o = await _public_order(order_no, request)
    merchant = await _merchant_of(o)
    if merchant is not None and not merchant.get("support_enabled", True):
        raise HTTPException(status_code=403, detail="该商户未开启在线客服")
    text = (data.text or "").strip()[:MAX_LEN]
    if not text and not data.image:
        raise HTTPException(status_code=400, detail="消息不能为空")
    image = await _store_image(data.image)
    prior_unread = await db.support_messages.count_documents(
        {"order_no": order_no, "sender": "customer", "read_agent": False})
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "customer", "sender_name": "访客", "text": text, "image": image,
           "created_at": iso(now_utc()), "read_agent": False, "read_customer": True}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _touch_thread(o, text, "customer", reopen=True)
    assigned = await _auto_assign(order_no, o)
    if prior_unread == 0 and assigned is None:
        online = await _online_count()
        reason = "（当前无坐席在线）" if online == 0 else "（所有在线坐席已达会话上限）"
        snippet = (text or "[图片]")[:80]
        asyncio.create_task(send_telegram(
            f"💬 <b>新的客服咨询</b>\n商户：{o['merchant_name']}\n订单：{order_no}\n内容：{snippet}\n{reason}请尽快到后台「在线客服」回复", "support"))
    return _msg_view(doc)


@router.get("/support/public/{order_no}/unread")
async def support_public_unread(order_no: str, request: Request):
    await _public_order(order_no, request)
    n = await db.support_messages.count_documents({"order_no": order_no, "sender": "agent", "read_customer": False})
    return {"unread": n}


@router.post("/support/public/{order_no}/typing")
async def support_typing(order_no: str, request: Request):
    await _public_order(order_no, request)
    await db.support_threads.update_one({"_id": order_no}, {"$set": {"customer_typing_at": iso(now_utc())}})
    return {"ok": True}


@router.get("/support/file/{path:path}")
async def support_file(path: str):
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="非法路径")
    rec = await db.support_files.find_one({"path": path})
    if not rec or rec.get("is_deleted"):
        raise HTTPException(status_code=404, detail="文件不存在")
    try:
        data, ct = await asyncio.to_thread(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="文件不存在")
    return Response(content=data, media_type=(rec or {}).get("content_type") or ct)


# ---------------- Agent side (admin / support seat) ----------------
@router.get("/support/unread-count")
async def support_unread(user: dict = Depends(require_roles("admin", "operator"))):
    await _touch_seen(user)
    n = await db.support_messages.count_documents({"sender": "customer", "read_agent": False})
    threads = await db.support_messages.distinct("order_no", {"sender": "customer", "read_agent": False})
    return {"unread": n, "threads": len(threads)}


@router.get("/support/stats")
async def support_stats(user: dict = Depends(require_roles("admin", "operator"))):
    open_n = await db.support_threads.count_documents({"status": "open"})
    resolved_n = await db.support_threads.count_documents({"status": "resolved"})
    total = await db.support_threads.count_documents({})
    mine_open = await db.support_threads.count_documents({"status": "open", "assigned_id": str(user["_id"])})
    online_n = await _online_count()
    # avg response time per seat: delta between a customer msg and the next agent reply
    seats = {}
    order_nos = await db.support_messages.distinct("order_no")
    for ono in order_nos:
        msgs = await db.support_messages.find({"order_no": ono}).sort("created_at", 1).to_list(1000)
        pending = None
        for m in msgs:
            if m["sender"] == "customer":
                if pending is None:
                    pending = m["created_at"]
            elif m["sender"] == "agent":
                name = m.get("sender_name") or "客服"
                s = seats.setdefault(name, {"name": name, "replies": 0, "sum": 0.0, "cnt": 0})
                s["replies"] += 1
                if pending is not None:
                    try:
                        d = (datetime.fromisoformat(m["created_at"]) - datetime.fromisoformat(pending)).total_seconds()
                        if d >= 0:
                            s["sum"] += d
                            s["cnt"] += 1
                    except Exception:
                        pass
                    pending = None
    by_seat = [{"name": s["name"], "replies": s["replies"],
                "avg_seconds": int(s["sum"] / s["cnt"]) if s["cnt"] else None}
               for s in sorted(seats.values(), key=lambda x: -x["replies"])]
    return {"open": open_n, "resolved": resolved_n, "total": total, "mine_open": mine_open,
            "online": online_n, "max_per_seat": await _max_per_seat(), "by_seat": by_seat}


@router.get("/support/seats")
async def support_seats(user: dict = Depends(require_roles("admin", "operator"))):
    cutoff = now_utc() - timedelta(seconds=SEAT_ONLINE_SECS)
    load = await _open_load_map()
    cap = await _max_per_seat()
    now = now_utc()
    # longest unanswered wait per seat
    wait_by_seat = {}
    unanswered = await db.support_threads.find(
        {"status": "open", "assigned_id": {"$ne": None}, "last_sender": "customer"}).to_list(1000)
    for th in unanswered:
        since = await _waiting_since(th["_id"])
        if not since:
            continue
        try:
            secs = (now - datetime.fromisoformat(since)).total_seconds()
        except Exception:
            continue
        aid = th["assigned_id"]
        if secs > wait_by_seat.get(aid, 0):
            wait_by_seat[aid] = secs
    out = []
    for s in await db.users.find(_seat_query()).to_list(200):
        ls = s.get("support_last_seen"); online = False
        try:
            online = bool(ls) and datetime.fromisoformat(ls) >= cutoff
        except Exception:
            online = False
        sid = str(s["_id"]); n = load.get(sid, 0)
        out.append({"id": sid, "name": s.get("name") or s["email"], "role": s["role"],
                    "online": online, "open_count": n, "max": cap, "full": n >= cap,
                    "max_wait_seconds": int(wait_by_seat.get(sid, 0)) or None})
    out.sort(key=lambda x: (not x["online"], x["name"]))
    return out


@router.get("/support/settings")
async def get_support_settings(user: dict = Depends(require_roles("admin", "operator"))):
    doc = await db.settings.find_one({"_id": "support"}) or {}
    return {"max_per_seat": await _max_per_seat(), "retain_days": int(doc.get("retain_days", 7))}


@router.put("/support/settings")
async def put_support_settings(data: SupportSettingsIn, request: Request,
                               user: dict = Depends(require_roles("admin"))):
    v = max(1, min(100, int(data.max_per_seat)))
    await db.settings.update_one({"_id": "support"}, {"$set": {"max_per_seat": v}}, upsert=True)
    await audit(user, "support.settings", "settings", "support", {"max_per_seat": v}, request)
    return {"max_per_seat": v}


@router.patch("/support/threads/{order_no}/assign")
async def assign_thread(order_no: str, data: AssignIn, request: Request,
                        user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    try:
        target = await db.users.find_one({"_id": ObjectId(data.assigned_id)})
    except Exception:
        target = None
    ok = target and (target["role"] == "admin" or (target["role"] == "operator" and "support.manage" in (target.get("permissions") or [])))
    if not ok:
        raise HTTPException(status_code=400, detail="目标坐席无效")
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    tname = target.get("name") or target["email"]
    await db.support_threads.update_one({"_id": order_no},
        {"$set": {"assigned_id": str(target["_id"]), "assigned_to": tname, "merchant_name": o["merchant_name"]},
         "$setOnInsert": {"created_at": iso(now_utc()), "status": "open", "last_at": iso(now_utc())}}, upsert=True)
    sys_text = (f"会话由 {user.get('name') or '客服'} 转交给 {tname}" if th.get("assigned_to")
               else f"{user.get('name') or '客服'} 将会话分配给 {tname}")
    await db.support_messages.insert_one({"order_no": order_no, "merchant_id": o.get("merchant_id"),
        "merchant_name": o["merchant_name"], "sender": "system", "sender_name": "系统", "text": sys_text,
        "image": None, "created_at": iso(now_utc()), "read_agent": True, "read_customer": True})
    await audit(user, "support.assign", "support_thread", order_no, {"to": tname}, request)
    return {"ok": True, "assigned_to": tname}


@router.post("/cron/support-cleanup")
async def cron_support_cleanup(request: Request):
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", ""); token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    doc = await db.settings.find_one({"_id": "support"}) or {}
    days = int(doc.get("retain_days", 7))
    cutoff = iso(now_utc() - timedelta(days=days))
    purged = 0
    for th in await db.support_threads.find({"status": "resolved", "last_at": {"$lt": cutoff}}).to_list(2000):
        o = await db.orders.find_one({"order_no": th["_id"]})
        if o and o.get("status") == "paid":
            for m in await db.support_messages.find({"order_no": th["_id"], "image": {"$ne": None}}).to_list(1000):
                p = (m.get("image") or "").replace("/api/support/file/", "")
                if p:
                    await db.support_files.update_one({"path": p}, {"$set": {"is_deleted": True}})
            await db.support_messages.delete_many({"order_no": th["_id"]})
            await db.support_threads.delete_one({"_id": th["_id"]})
            purged += 1
    logger.info(f"support cleanup purged={purged} retain_days={days}")
    return {"ok": True, "purged": purged, "retain_days": days}


@router.get("/support/templates")
async def get_templates(user: dict = Depends(require_roles("admin", "operator"))):
    doc = await db.settings.find_one({"_id": "support"}) or {}
    return {"templates": doc.get("templates", DEFAULT_TEMPLATES)}


@router.put("/support/templates")
async def put_templates(data: TemplatesIn, request: Request, user: dict = Depends(require_roles("admin"))):
    tpls = [t.strip()[:300] for t in data.templates if t.strip()][:30]
    await db.settings.update_one({"_id": "support"}, {"$set": {"templates": tpls}}, upsert=True)
    await audit(user, "support.templates", "settings", "support", {"count": len(tpls)}, request)
    return {"templates": tpls}


class BulkEndIn(BaseModel):
    resolved: bool = False
    stale_hours: Optional[int] = None


@router.post("/support/threads/bulk-end")
async def bulk_end_threads(data: BulkEndIn, request: Request,
                           user: dict = Depends(require_roles("admin", "operator"))):
    """One-click cleanup: purge all resolved and/or stale (no activity for N
    hours) conversations, freeing their seat slots."""
    order_nos = set()
    if data.resolved:
        for th in await db.support_threads.find({"status": "resolved"}).to_list(5000):
            order_nos.add(th["_id"])
    if data.stale_hours and data.stale_hours > 0:
        cutoff = iso(now_utc() - timedelta(hours=data.stale_hours))
        for th in await db.support_threads.find({"last_at": {"$lt": cutoff}}).to_list(5000):
            order_nos.add(th["_id"])
    purged = 0
    for ono in order_nos:
        for m in await db.support_messages.find({"order_no": ono, "image": {"$ne": None}}).to_list(1000):
            p = (m.get("image") or "").replace("/api/support/file/", "")
            if p:
                await db.support_files.update_one({"path": p}, {"$set": {"is_deleted": True}})
        await db.support_messages.delete_many({"order_no": ono})
        await db.support_threads.delete_one({"_id": ono})
        purged += 1
    await audit(user, "support.bulk_end", "support_thread", "*",
                {"resolved": data.resolved, "stale_hours": data.stale_hours, "purged": purged}, request)
    return {"ok": True, "purged": purged}


@router.get("/support/threads")
async def support_threads(status: str = Query("all"), user: dict = Depends(require_roles("admin", "operator"))):
    await _touch_seen(user)
    asyncio.create_task(_reassign_offline())
    q = {}
    if status in ("open", "resolved"):
        q["status"] = status
    rows = await db.support_threads.find(q).sort("last_at", -1).limit(500).to_list(500)
    agg = await db.support_messages.aggregate([
        {"$match": {"sender": "customer", "read_agent": False}},
        {"$group": {"_id": "$order_no", "n": {"$sum": 1}}}]).to_list(1000)
    unread_map = {a["_id"]: a["n"] for a in agg}
    return [{"order_no": r["_id"], "merchant_name": r.get("merchant_name", ""), "last_text": r.get("last_text", ""),
             "last_sender": r.get("last_sender", ""), "last_at": r.get("last_at"), "status": r.get("status", "open"),
             "assigned_to": r.get("assigned_to"), "unread": unread_map.get(r["_id"], 0)} for r in rows]


@router.get("/support/threads/{order_no}")
async def support_thread_get(order_no: str, user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    msgs = await db.support_messages.find({"order_no": order_no}).sort("created_at", 1).to_list(1000)
    await db.support_messages.update_many(
        {"order_no": order_no, "sender": "customer", "read_agent": False}, {"$set": {"read_agent": True}})
    typing = False
    if th.get("customer_typing_at"):
        try:
            typing = (now_utc() - datetime.fromisoformat(th["customer_typing_at"])).total_seconds() < TYPING_WINDOW
        except Exception:
            typing = False
    return {"order_no": order_no, "merchant_name": o["merchant_name"], "order_status": o["status"],
            "status": th.get("status", "open"), "assigned_to": th.get("assigned_to"), "assigned_id": th.get("assigned_id"),
            "customer_typing": typing, "order_id": str(o["_id"]), "amount_usdt": o["amount_usdt"], "pay_amount": o.get("pay_amount"),
            "wallet_address": o["wallet_address"], "network": o["network"], "created_at": o["created_at"],
            "expires_at": o.get("expires_at"), "tx_id": o.get("tx_id"), "out_trade_no": o.get("out_trade_no"),
            "messages": [_msg_view(m) for m in msgs]}


@router.post("/support/threads/{order_no}")
async def support_thread_post(order_no: str, data: SupportMessageIn, request: Request,
                              user: dict = Depends(require_roles("admin", "operator"))):
    o = await _get_order(order_no)
    text = (data.text or "").strip()[:MAX_LEN]
    if not text and not data.image:
        raise HTTPException(status_code=400, detail="消息不能为空")
    image = await _store_image(data.image)
    doc = {"order_no": order_no, "merchant_id": o.get("merchant_id"), "merchant_name": o["merchant_name"],
           "sender": "agent", "sender_name": user.get("name") or "客服", "text": text, "image": image,
           "created_at": iso(now_utc()), "read_agent": True, "read_customer": False}
    r = await db.support_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    await _touch_thread(o, text, "agent", reopen=False)
    # auto-assign to the first agent who replies
    th = await db.support_threads.find_one({"_id": order_no}) or {}
    if not th.get("assigned_id"):
        await db.support_threads.update_one({"_id": order_no},
            {"$set": {"assigned_id": str(user["_id"]), "assigned_to": user.get("name") or "客服"}})
    return _msg_view(doc)


@router.delete("/support/threads/{order_no}")
async def delete_thread(order_no: str, request: Request,
                        user: dict = Depends(require_roles("admin", "operator"))):
    """Manually end a conversation: purge its messages/images/thread so it no
    longer occupies a seat slot nor shows in the list."""
    for m in await db.support_messages.find({"order_no": order_no, "image": {"$ne": None}}).to_list(1000):
        p = (m.get("image") or "").replace("/api/support/file/", "")
        if p:
            await db.support_files.update_one({"path": p}, {"$set": {"is_deleted": True}})
    await db.support_messages.delete_many({"order_no": order_no})
    await db.support_threads.delete_one({"_id": order_no})
    await audit(user, "support.end", "support_thread", order_no, {"manual": True}, request)
    return {"ok": True, "deleted": True}


@router.patch("/support/threads/{order_no}/status")
async def set_thread_status(order_no: str, data: ThreadStatusIn, request: Request,
                            user: dict = Depends(require_roles("admin", "operator"))):
    if data.status not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="状态无效")
    o = await _get_order(order_no)
    # Auto-purge: a completed (paid) order whose conversation is resolved no longer
    # needs its chat data — delete it to keep the store lean.
    if data.status == "resolved" and o["status"] == "paid":
        files = await db.support_messages.find({"order_no": order_no, "image": {"$ne": None}}).to_list(1000)
        for m in files:
            p = (m.get("image") or "").replace("/api/support/file/", "")
            if p:
                await db.support_files.update_one({"path": p}, {"$set": {"is_deleted": True}})
        await db.support_messages.delete_many({"order_no": order_no})
        await db.support_threads.delete_one({"_id": order_no})
        await audit(user, "support.purge", "support_thread", order_no, {"reason": "resolved+paid"}, request)
        return {"ok": True, "status": "resolved", "deleted": True}
    await db.support_threads.update_one(
        {"_id": order_no},
        {"$set": {"status": data.status, "merchant_name": o["merchant_name"], "last_at": iso(now_utc())}}, upsert=True)
    await audit(user, "support.status", "support_thread", order_no, {"status": data.status}, request)
    return {"ok": True, "status": data.status, "deleted": False}


# ---------------- Per-merchant support config (admin) ----------------
class SupportConfigIn(BaseModel):
    support_enabled: bool = True
    support_welcome: str = ""


@router.patch("/accounts/{account_id}/support")
async def set_support_config(account_id: str, data: SupportConfigIn, request: Request,
                             user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc or acc["role"] != "merchant":
        raise HTTPException(status_code=404, detail="商户不存在")
    upd = {"support_enabled": data.support_enabled, "support_welcome": (data.support_welcome or "").strip()[:500]}
    await db.users.update_one({"_id": acc["_id"]}, {"$set": upd})
    await audit(user, "merchant.support_config", "user", account_id, upd, request)
    return {"ok": True, **upd}
