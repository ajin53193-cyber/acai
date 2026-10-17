"""Giftray 商城直接對接：把 Giftray 後台管理 API（/admin/orders、/admin/recharges、/admin/users…）轉成 Hub 規範格式。"""
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException

_cache: Dict[str, tuple] = {}
TTL = 10
PAID = ("need_info", "processing", "completed")
STATUS = {"need_info": "need_info", "processing": "processing", "completed": "completed", "cancelled": "cancelled",
          "pending": "reviewing", "approved": "approved", "rejected": "rejected"}
SOURCE = {"": "USDT 直轉", "gateway": "快捷支付", "stripe": "信用卡"}


async def _get(p: dict, path: str, params: dict | None = None) -> Any:
    key = f"{p['id']}|{path}|{sorted((params or {}).items())}"
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(p["base_url"].rstrip("/") + path, params=params, headers={"X-Admin-Api-Key": p.get("api_key", "")})
    if r.status_code != 200:
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=502, detail=f"{p['name']} 回應 {r.status_code} {detail}".strip())
    data = r.json()
    _cache[key] = (time.time() + TTL, data)
    return data


def _items(d: Any) -> List[dict]:
    if isinstance(d, dict):
        d = d.get("items") or d.get("rows") or d.get("orders") or d.get("recharges") or d.get("users") or []
    return [x for x in (d or []) if not x.get("isTest")]


async def _rate(p: dict) -> float:
    try:
        v = float((await _get(p, "/settings")).get("usdtRate") or 0)
        return v if 1 < v < 20 else 7.8
    except Exception:  # noqa: BLE001
        return 7.8


def _usd(hkd: Any, rate: float) -> float:
    return round(float(hkd or 0) / rate, 2)


def _tag(p: dict) -> dict:
    return {"id": p["id"], "name": p["name"]}


def _order_row(o: dict, rate: float) -> dict:
    gift = bool(o.get("transactionNo") or o.get("autoReview") or o.get("redeemed"))
    return {"id": o.get("id"), "order_no": o.get("id"), "type": "giftcard" if gift else "order", "user": o.get("email") or o.get("userId") or "",
            "status": STATUS.get(o.get("status"), o.get("status")), "amount_usd": _usd(o.get("amount"), rate), "amount_label": f"HK${float(o.get('amount') or 0):,.0f}",
            "items": [f"{o.get('productName', '')} {o.get('denom', '')} ×{o.get('qty') or 1}".strip()],
            "created_at": o.get("createdAt"), "paid_at": o.get("createdAt") if o.get("status") in PAID else None}


def _topup_row(t: dict) -> dict:
    return {"id": t.get("id"), "order_no": t.get("id"), "type": "topup", "user": t.get("email") or t.get("userId") or "", "status": STATUS.get(t.get("status"), t.get("status")),
            "amount_usd": round(float(t.get("usdt") or 0), 2), "amount_label": f"HK${float(t.get('hkd') or 0):,.0f}",
            "items": [" ".join(x for x in [SOURCE.get(t.get("source") or "", t.get("source")), t.get("network") or ""] if x)],
            "created_at": t.get("createdAt"), "paid_at": t.get("approvedAt")}


def _member_row(u: dict, rate: float) -> dict:
    return {"id": u.get("id"), "email": u.get("email") or u.get("account") or u.get("phone") or "", "name": u.get("name") or "", "wallet_usd": _usd(u.get("balance"), rate),
            "created_at": u.get("createdAt"), "is_test": bool(u.get("isTest"))}


async def orders(p: dict, params: dict) -> dict:
    size = max(1, min(int(params.get("size") or 50), 500))
    rate = await _rate(p)
    rows = [_order_row(o, rate) for o in _items(await _get(p, "/admin/orders", {"limit": 3000}))]
    if params.get("status"):
        rows = [r for r in rows if r["status"] == params["status"]]
    if params.get("paid_since"):
        rows = [r for r in rows if r["paid_at"] and r["paid_at"] > params["paid_since"]]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:size]}


async def topups(p: dict, params: dict) -> dict:
    size = max(1, min(int(params.get("size") or 50), 500))
    rows = [_topup_row(t) for t in _items(await _get(p, "/admin/recharges", {"limit": 3000}))]
    if params.get("status"):
        rows = [r for r in rows if r["status"] == params["status"]]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:size]}


async def members(p: dict, params: dict) -> dict:
    size = max(1, min(int(params.get("size") or 50), 500))
    rate = await _rate(p)
    data = await _get(p, "/admin/users", {"limit": 5000})
    users = [u for u in (data.get("items") or data.get("users") or [] if isinstance(data, dict) else data or []) if not u.get("is_admin")]
    q = (params.get("q") or "").lower()
    rows = [_member_row(u, rate) for u in users if not q or q in str(u.get("email", "")).lower() or q in str(u.get("account", "")).lower() or q in str(u.get("name", "")).lower() or q in str(u.get("phone", "")).lower()]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:size]}


async def stats(p: dict, params: dict) -> dict:
    days = max(1, min(int(params.get("days") or 30), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rate = await _rate(p)
    os_ = _items(await _get(p, "/admin/orders", {"limit": 20000}))
    rc = _items(await _get(p, "/admin/recharges", {"limit": 5000}))
    data = await _get(p, "/admin/users", {"limit": 5000})
    us = [u for u in (data.get("items") or data.get("users") or [] if isinstance(data, dict) else data or []) if not u.get("isTest") and not u.get("is_admin")]
    recent = [o for o in os_ if o.get("status") in PAID and (o.get("createdAt") or "") >= since]
    approved = [t for t in rc if t.get("status") == "approved" and (t.get("approvedAt") or t.get("createdAt") or "") >= since]
    chats = 0
    try:
        chats = int((await _get(p, "/admin/pending-counts")).get("chat") or 0)
    except Exception:  # noqa: BLE001
        pass
    return {"platform": _tag(p), "days": days, "revenue_usd": _usd(sum(float(o.get("amount") or 0) for o in recent), rate), "orders": len(recent),
            "topup_usd": round(sum(float(t.get("usdt") or 0) for t in approved), 2), "topups": len(approved),
            "new_members": len([u for u in us if (u.get("createdAt") or "") >= since]), "members": len(us),
            "pending_orders": len([o for o in os_ if o.get("status") in ("need_info", "processing")]), "pending_topups": len([t for t in rc if t.get("status") == "pending"]), "open_chats": chats}


HANDLERS = {"/hub/orders": orders, "/hub/topups": topups, "/hub/members": members, "/hub/stats": stats}


async def fetch(p: dict, path: str, params: dict) -> dict:
    return await HANDLERS[path](p, {k: v for k, v in params.items() if v not in ("", None)})


async def chats(p: dict, status: str = "open") -> dict:
    d = await _get(p, "/admin/chat/sessions", {"status": status or "open"})
    rows = d.get("sessions", []) if isinstance(d, dict) else (d or [])
    return {"platform": _tag(p), "unread": int((d or {}).get("unreadTotal") or 0) if isinstance(d, dict) else 0,
            "rows": [{"id": s.get("id"), "name": s.get("name") or "", "contact": s.get("account") or "", "last_message": s.get("lastMsg") or "", "last_at": s.get("lastAt"), "last_sender": s.get("lastFrom") or "",
                      "status": s.get("status") or "open", "unread": int(s.get("unreadAdmin") or 0), "assigned": s.get("assignedName") or ""} for s in rows]}


async def post(p: dict, path: str, body: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(p["base_url"].rstrip("/") + path, json=body or {}, headers={"X-Admin-Api-Key": p.get("api_key", "")})
    for k in [k for k in _cache if k.startswith(p["id"] + "|")]:
        _cache.pop(k, None)
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", "")
        except Exception:  # noqa: BLE001
            detail = r.text[:200]
        raise HTTPException(status_code=400 if r.status_code < 500 else 502, detail=f"{p['name']}：{detail or r.status_code}")
    return r.json() if r.content else {}


def _msg(m: dict) -> dict:
    f = m.get("from") or "user"
    return {"id": m.get("id"), "from": "admin" if f == "admin" else "system" if f == "system" else "user", "text": m.get("text") or "", "image": m.get("image") or "", "name": m.get("adminName") or "", "at": m.get("createdAt")}


async def messages(p: dict, sid: str) -> dict:
    d = await _get(p, f"/admin/chat/sessions/{sid}/messages")
    _cache.pop(f"{p['id']}|/admin/chat/sessions/{sid}/messages|[]", None)
    return {"messages": [_msg(m) for m in (d.get("messages") or [])], "session": d.get("session") or {}}


async def upload(p: dict, data: bytes, name: str) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(p["base_url"].rstrip("/") + "/admin/chat/upload", files={"file": (name, data)}, headers={"X-Admin-Api-Key": p.get("api_key", "")})
    if r.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"{p['name']} 圖片上傳失敗 {r.status_code}")
    return r.json().get("url", "")
