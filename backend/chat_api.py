"""Live customer-service chat (guest or signed-in) + admin alert feed."""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from admin_api import current_admin
from clerk_auth import require_user

router = APIRouter(prefix="/api")
db = None
upload_b64 = None

GUEST_RX = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _optional_user(request: Request) -> Optional[dict]:
    try:
        return require_user(request)
    except HTTPException:
        return None


class SessionIn(BaseModel):
    guest_id: str
    name: str = ""
    contact: str = ""


class MessageIn(BaseModel):
    guest_id: str = ""
    text: str = ""
    image_b64: str = ""
    image_name: str = "image.jpg"
    quick: int = -1


class AdminMessageIn(BaseModel):
    text: str = ""
    image_b64: str = ""
    image_name: str = "image.jpg"


class SessionPatch(BaseModel):
    status: str


class EndIn(BaseModel):
    guest_id: str = ""


CHAT_CLOSE_TTL = 600  # auto-delete a session 10 minutes after the visitor closes the widget


class QuickReply(BaseModel):
    q: str
    a: str


class QuickRepliesIn(BaseModel):
    items: list[QuickReply]


class HoursIn(BaseModel):
    enabled: bool = False
    start: str = "09:00"
    end: str = "23:00"
    tz: int = 8
    message: str = ""


DEFAULT_HOURS = {"enabled": False, "start": "09:00", "end": "23:00", "tz": 8,
                 "message": "您好，目前為非工作時段（客服時間 {start}–{end}，UTC+{tz}）。您的留言已收到，客服上線後會第一時間回覆您；充值類問題系統會自動處理，請耐心等候。"}


async def get_hours() -> dict:
    doc = await db.settings.find_one({"key": "chat_hours"}, {"_id": 0})
    return {**DEFAULT_HOURS, **((doc or {}).get("value") or {})}


def _hm(s: str) -> int:
    try:
        h, m = s.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 0


def is_online(h: dict) -> bool:
    if not h.get("enabled"):
        return True
    now = datetime.now(timezone(timedelta(hours=int(h.get("tz", 8)))))
    cur = now.hour * 60 + now.minute
    s, e = _hm(h.get("start", "09:00")), _hm(h.get("end", "23:00"))
    return s <= cur < e if s <= e else (cur >= s or cur < e)


def hours_message(h: dict) -> str:
    return (h.get("message") or DEFAULT_HOURS["message"]).replace("{start}", h.get("start", "")).replace("{end}", h.get("end", "")).replace("{tz}", str(h.get("tz", 8)))


DEFAULT_QUICK = [
    {"q": "充值多久到帳？", "a": "一般下單付款後 1～10 分鐘內自動到帳；禮品卡類商品為系統即時轉贈，如超過 30 分鐘未到帳請提供訂單號，客服會立即為您查詢。"},
    {"q": "可以退款嗎？", "a": "未開始充值的訂單可申請全額退款至錢包餘額；已充值成功的訂單因虛擬商品特性無法退款。如充值失敗系統會自動退回，請放心。"},
    {"q": "帳號填錯怎麼辦？", "a": "請立即把訂單號與正確帳號發給客服，若尚未開始充值可為您更正；已充值到錯誤帳號將無法追回，請務必確認後再下單。"},
    {"q": "怎麼查看我的訂單？", "a": "登入後點擊右上角頭像 →「我的訂單」即可查看全部訂單與充值進度；也可以直接告訴我訂單號，我幫您查。"},
]


async def get_quick_replies() -> list:
    doc = await db.settings.find_one({"key": "chat_quick_replies"}, {"_id": 0})
    items = (doc or {}).get("items") or []
    return [i for i in items if i.get("q", "").strip()] or DEFAULT_QUICK


def _check_guest(gid: str):
    if not GUEST_RX.match(gid or ""):
        raise HTTPException(status_code=400, detail="invalid guest id")


async def _owner_cond(sid: str, guest_id: str, user: Optional[dict]) -> dict:
    cond = {"id": sid}
    if user:
        cond["$or"] = [{"user_id": user["user_id"]}, {"guest_id": guest_id}] if guest_id else [{"user_id": user["user_id"]}]
    else:
        _check_guest(guest_id)
        cond["guest_id"] = guest_id
    return cond


async def _member_info(user_id: str) -> dict:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "name": 1, "phone": 1}) or {}
    return {"user_id": user_id, "name": u.get("name") or "", "contact": u.get("email") or u.get("phone") or ""}


# ----------------------------- public -----------------------------
@router.post("/chat/sessions")
async def open_session(body: SessionIn, request: Request):
    _check_guest(body.guest_id)
    user = _optional_user(request)
    cond = {"status": "open", "$or": [{"guest_id": body.guest_id}] + ([{"user_id": user["user_id"]}] if user else [])}
    s = await db.chat_sessions.find_one(cond, {"_id": 0}, sort=[("last_at", -1)])
    patch = {}
    if user:
        info = await _member_info(user["user_id"])
        patch = {k: v for k, v in info.items() if v}
    if s:
        upd = {**patch, "guest_id": body.guest_id, "closed_at": ""}
        await db.chat_sessions.update_one({"id": s["id"]}, {"$set": upd})
        s.update(upd)
        return s
    doc = {"id": uuid.uuid4().hex, "guest_id": body.guest_id, "user_id": user["user_id"] if user else "", "name": body.name[:60], "contact": body.contact[:120],
           "status": "open", "last_message": "", "last_at": now_iso(), "last_sender": "", "unread_admin": 0, "unread_user": 0, "created_at": now_iso(),
           "ua": request.headers.get("user-agent", "")[:200], "page": request.headers.get("referer", "")[:300]}
    doc.update(patch)
    await db.chat_sessions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/chat/sessions/{sid}/messages")
async def user_messages(sid: str, request: Request, guest_id: str = "", after: str = ""):
    user = _optional_user(request)
    s = await db.chat_sessions.find_one(await _owner_cond(sid, guest_id, user), {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    q = {"session_id": sid}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    if s.get("unread_user"):
        await db.chat_sessions.update_one({"id": sid}, {"$set": {"unread_user": 0}})
    return {"session": {**s, "unread_user": 0}, "messages": msgs}


@router.post("/chat/sessions/{sid}/messages")
async def user_send(sid: str, body: MessageIn, request: Request):
    user = _optional_user(request)
    s = await db.chat_sessions.find_one(await _owner_cond(sid, body.guest_id, user), {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    text = body.text.strip()[:2000]
    quick = await get_quick_replies()
    qr = quick[body.quick] if 0 <= body.quick < len(quick) else None
    if qr:
        text = qr["q"]
    if not text and not body.image_b64:
        raise HTTPException(status_code=400, detail="請輸入內容")
    image = await upload_b64("gogo589/chat", body.image_b64, body.image_name, max_mb=5) if body.image_b64 else ""
    msg = {"id": uuid.uuid4().hex, "session_id": sid, "sender": "user", "text": text, "image": image, "auto": bool(qr), "created_at": now_iso()}
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    if qr:
        ans = {"id": uuid.uuid4().hex, "session_id": sid, "sender": "admin", "text": qr["a"], "image": "", "auto": True, "admin_name": "自動回覆", "created_at": now_iso()}
        await db.chat_messages.insert_one(ans)
        ans.pop("_id", None)
        await db.chat_sessions.update_one({"id": sid}, {"$set": {"last_message": qr["a"], "last_at": ans["created_at"], "last_sender": "admin", "status": "open", "closed_at": ""}})
        return {**msg, "reply": ans}
    await db.chat_sessions.update_one({"id": sid}, {"$set": {"last_message": text or "[圖片]", "last_at": msg["created_at"], "last_sender": "user", "status": "open", "closed_at": ""}, "$inc": {"unread_admin": 1}})
    hours = await get_hours()
    if not is_online(hours):
        last = s.get("after_hours_at") or ""
        if not last or (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() > 6 * 3600:
            ans = {"id": uuid.uuid4().hex, "session_id": sid, "sender": "admin", "text": hours_message(hours), "image": "", "auto": True, "admin_name": "自動回覆", "created_at": now_iso()}
            await db.chat_messages.insert_one(ans)
            ans.pop("_id", None)
            await db.chat_sessions.update_one({"id": sid}, {"$set": {"after_hours_at": ans["created_at"]}})
            return {**msg, "reply": ans}
    return msg


@router.get("/chat/status")
async def chat_status():
    h = await get_hours()
    online = is_online(h)
    return {"online": online, "start": h["start"], "end": h["end"], "tz": h["tz"], "message": "" if online else hours_message(h)}


@router.post("/chat/sessions/{sid}/close")
async def user_close_session(sid: str, body: EndIn, request: Request):
    """Visitor closed the widget: stamp closed_at so the sweeper deletes it after CHAT_CLOSE_TTL."""
    user = _optional_user(request)
    try:
        s = await db.chat_sessions.find_one(await _owner_cond(sid, body.guest_id, user), {"_id": 0, "id": 1})
    except HTTPException:
        return {"ok": True}
    if s:
        await db.chat_sessions.update_one({"id": sid}, {"$set": {"closed_at": now_iso()}})
    return {"ok": True}


@router.post("/chat/sessions/{sid}/end")
async def user_end_session(sid: str, body: EndIn, request: Request):
    """Visitor tapped 結束: immediately end the conversation and delete its records."""
    user = _optional_user(request)
    try:
        s = await db.chat_sessions.find_one(await _owner_cond(sid, body.guest_id, user), {"_id": 0, "id": 1})
    except HTTPException:
        return {"ok": True}
    if s:
        await db.chat_messages.delete_many({"session_id": sid})
        await db.chat_sessions.delete_one({"id": sid})
    return {"ok": True}


async def sweep_closed_sessions():
    """Delete sessions (and their messages) that the visitor closed over CHAT_CLOSE_TTL seconds ago."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=CHAT_CLOSE_TTL)).isoformat()
    stale = await db.chat_sessions.find({"closed_at": {"$gt": "", "$lte": cutoff}}, {"_id": 0, "id": 1}).to_list(500)
    if not stale:
        return
    ids = [s["id"] for s in stale]
    await db.chat_messages.delete_many({"session_id": {"$in": ids}})
    await db.chat_sessions.delete_many({"id": {"$in": ids}})


@router.get("/me/chat/sessions")
async def my_sessions(request: Request, guest_id: str = "", user: dict = Depends(require_user)):
    ors = [{"user_id": user["user_id"]}]
    if guest_id and GUEST_RX.match(guest_id):
        ors.append({"guest_id": guest_id})
    return await db.chat_sessions.find({"$or": ors, "last_message": {"$ne": ""}}, {"_id": 0}).sort("last_at", -1).to_list(50)


@router.get("/chat/quick-replies")
async def public_quick_replies():
    return [{"q": i["q"]} for i in await get_quick_replies()]


@router.get("/admin/chat/quick-replies")
async def admin_quick_replies(admin: dict = Depends(current_admin)):
    return await get_quick_replies()


@router.put("/admin/chat/quick-replies")
async def admin_save_quick_replies(body: QuickRepliesIn, admin: dict = Depends(current_admin)):
    items = [{"q": i.q.strip()[:100], "a": i.a.strip()[:1000]} for i in body.items if i.q.strip() and i.a.strip()][:12]
    await db.settings.update_one({"key": "chat_quick_replies"}, {"$set": {"items": items}}, upsert=True)
    return await get_quick_replies()


@router.get("/admin/chat/hours")
async def admin_get_hours(admin: dict = Depends(current_admin)):
    h = await get_hours()
    return {**h, "online_now": is_online(h)}


@router.put("/admin/chat/hours")
async def admin_save_hours(body: HoursIn, admin: dict = Depends(current_admin)):
    if not re.match(r"^\d{2}:\d{2}$", body.start) or not re.match(r"^\d{2}:\d{2}$", body.end):
        raise HTTPException(status_code=400, detail="時間格式需為 HH:MM")
    val = {"enabled": body.enabled, "start": body.start, "end": body.end, "tz": max(-12, min(14, body.tz)), "message": body.message.strip()[:600]}
    await db.settings.update_one({"key": "chat_hours"}, {"$set": {"value": val}}, upsert=True)
    h = await get_hours()
    return {**h, "online_now": is_online(h)}


ORDER_PROJ = {"_id": 0, "id": 1, "order_no": 1, "status": 1, "total_usd": 1, "items.product_name": 1, "items.spec_label": 1, "items.quantity": 1,
              "created_at": 1, "paid_at": 1, "delivery_info": 1, "user_email": 1, "admin_note": 1, "gift_manual": 1, "gift_auto_failed": 1, "info_submitted": 1}


@router.get("/admin/chat/sessions/{sid}/context")
async def admin_session_context(sid: str, admin: dict = Depends(current_admin)):
    s = await db.chat_sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    if not s.get("user_id"):
        return {"member": None, "orders": [], "topups": []}
    uid = s["user_id"]
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "phone": 1, "wallet_balance_usd": 1, "created_at": 1, "banned": 1}) or {"user_id": uid}
    orders = await db.orders.find({"user_id": uid}, ORDER_PROJ).sort("created_at", -1).to_list(5)
    topups = await db.topup_orders.find({"user_id": uid}, {"_id": 0, "id": 1, "amount_usd": 1, "status": 1, "provider": 1, "method_name": 1, "created_at": 1, "proof_at": 1}).sort("created_at", -1).to_list(3)
    return {"member": {**u, "orders_total": await db.orders.count_documents({"user_id": uid})}, "orders": orders, "topups": topups}


@router.get("/admin/chat/orders")
async def admin_chat_order_lookup(q: str = "", admin: dict = Depends(current_admin)):
    q = q.strip()
    if len(q) < 4:
        return []
    rx = {"$regex": re.escape(q), "$options": "i"}
    return await db.orders.find({"$or": [{"order_no": rx}, {"user_email": rx}, {"id": rx}]}, ORDER_PROJ).sort("created_at", -1).to_list(8)


# ----------------------------- admin -----------------------------
@router.get("/admin/chat/sessions")
async def admin_sessions(status: str = "open", q: str = "", admin: dict = Depends(current_admin)):
    cond = {"last_message": {"$ne": ""}} if status == "all" else {"status": status, "last_message": {"$ne": ""}}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        cond["$or"] = [{"name": rx}, {"contact": rx}, {"last_message": rx}, {"guest_id": rx}]
    items = await db.chat_sessions.find(cond, {"_id": 0}).sort("last_at", -1).to_list(300)
    counts = {"open": await db.chat_sessions.count_documents({"status": "open", "last_message": {"$ne": ""}}), "handled": await db.chat_sessions.count_documents({"status": "handled"}),
              "unread": await db.chat_sessions.count_documents({"unread_admin": {"$gt": 0}})}
    return {"items": items, "counts": counts}


@router.get("/admin/chat/sessions/{sid}/messages")
async def admin_messages(sid: str, after: str = "", admin: dict = Depends(current_admin)):
    s = await db.chat_sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    q = {"session_id": sid}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(1000)
    if s.get("unread_admin"):
        await db.chat_sessions.update_one({"id": sid}, {"$set": {"unread_admin": 0}})
    return {"session": {**s, "unread_admin": 0}, "messages": msgs}


@router.post("/admin/chat/sessions/{sid}/messages")
async def admin_send(sid: str, body: AdminMessageIn, admin: dict = Depends(current_admin)):
    s = await db.chat_sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    text = body.text.strip()[:2000]
    if not text and not body.image_b64:
        raise HTTPException(status_code=400, detail="請輸入內容")
    image = await upload_b64("gogo589/chat", body.image_b64, body.image_name, max_mb=5) if body.image_b64 else ""
    msg = {"id": uuid.uuid4().hex, "session_id": sid, "sender": "admin", "text": text, "image": image, "admin_name": admin.get("name") or admin.get("email") or "客服", "created_at": now_iso()}
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    await db.chat_sessions.update_one({"id": sid}, {"$set": {"last_message": text or "[圖片]", "last_at": msg["created_at"], "last_sender": "admin", "unread_admin": 0}, "$inc": {"unread_user": 1}})
    return msg


@router.patch("/admin/chat/sessions/{sid}")
async def admin_patch_session(sid: str, body: SessionPatch, admin: dict = Depends(current_admin)):
    if body.status not in ("open", "handled"):
        raise HTTPException(status_code=400, detail="bad status")
    r = await db.chat_sessions.update_one({"id": sid}, {"$set": {"status": body.status, "unread_admin": 0, "handled_at": now_iso() if body.status == "handled" else ""}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="session not found")
    return await db.chat_sessions.find_one({"id": sid}, {"_id": 0})


# ----------------------------- alert feed (sound notifications) -----------------------------
@router.get("/admin/alerts")
async def admin_alerts(since: str = "", admin: dict = Depends(current_admin)):
    now = now_iso()
    if not since:
        return {"now": now, "orders": [], "topups": [], "chats": []}
    orders = await db.orders.find({"paid_at": {"$gt": since, "$lte": now}}, {"_id": 0, "id": 1, "order_no": 1, "total_usd": 1, "user_email": 1, "paid_at": 1}).sort("paid_at", -1).to_list(20)
    topups = await db.topup_orders.find({"proof_at": {"$gt": since, "$lte": now}, "status": "reviewing"}, {"_id": 0, "id": 1, "amount_usd": 1, "method_name": 1, "provider": 1, "proof_at": 1}).sort("proof_at", -1).to_list(20)
    chats = await db.chat_messages.find({"sender": "user", "auto": {"$ne": True}, "created_at": {"$gt": since, "$lte": now}}, {"_id": 0, "session_id": 1, "text": 1, "image": 1, "created_at": 1}).sort("created_at", -1).to_list(20)
    return {"now": now, "orders": orders, "topups": topups, "chats": chats}
