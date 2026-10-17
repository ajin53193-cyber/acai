"""Multi-platform hub: pulls orders / topups / members / stats from other platforms that implement the Hub spec,
and exposes gogo589's own data through the same spec (so Giftray can mirror it, and the hub can be self-tested)."""
import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

import admin_api
import hub_giftray
import hub_sifang
from admin_api import current_admin, require_super

db = None
router = APIRouter(prefix="/api")
LOCAL = {"id": "gogo589", "name": "gogo589"}
KEY = "hub_platforms"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_cfg() -> dict:
    doc = await db.settings.find_one({"key": KEY}, {"_id": 0}) or {}
    if not doc.get("inbound_key"):
        doc["inbound_key"] = "hub_" + secrets.token_hex(20)
        await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "inbound_key": doc["inbound_key"]}}, upsert=True)
    return {"inbound_key": doc["inbound_key"], "platforms": doc.get("platforms") or []}


# ----------------------------- outbound: gogo589 implements the Hub spec -----------------------------
async def _inbound_auth(x_hub_key: str):
    cfg = await get_cfg()
    if not x_hub_key or x_hub_key != cfg["inbound_key"]:
        raise HTTPException(status_code=401, detail="無效的 Hub Key")


GIFT_IDS: set = set()


async def _refresh_gift_ids():
    GIFT_IDS.clear()
    GIFT_IDS.update([p["id"] async for p in db.products.find({"is_giftcard": True}, {"_id": 0, "id": 1})])


def _order_row(o: dict) -> dict:
    gift = bool(o.get("is_giftcard_order")) or any(it.get("product_id") in GIFT_IDS for it in o.get("items", []))
    return {"id": o.get("id"), "order_no": o.get("order_no") or (o.get("id") or "")[:8], "type": "giftcard" if gift else "order",
            "user": o.get("user_email") or "", "status": o.get("status"), "amount_usd": float(o.get("total_usd") or 0),
            "items": [f"{it.get('product_name', '')} {it.get('spec_label', '')} ×{it.get('qty') or it.get('quantity') or 1}".strip() for it in o.get("items", [])],
            "created_at": o.get("created_at"), "paid_at": o.get("paid_at")}


def _topup_row(t: dict) -> dict:
    return {"id": t.get("id"), "order_no": (t.get("id") or "")[:8].upper(), "type": "topup", "user": t.get("user_email") or t.get("user_id") or "", "status": t.get("status"),
            "amount_usd": float(t.get("amount_usd") or 0), "items": [t.get("method_name") or t.get("provider") or ""], "created_at": t.get("created_at"), "paid_at": t.get("paid_at") or t.get("approved_at")}


@router.get("/hub/orders")
async def hub_orders(since: str = "", paid_since: str = "", status: str = "", page: int = 1, size: int = 50, x_hub_key: str = Header("", alias="X-Hub-Key")):
    await _inbound_auth(x_hub_key)
    q: Dict[str, Any] = {}
    if since:
        q["created_at"] = {"$gte": since}
    if paid_since:
        q["paid_at"] = {"$gt": paid_since}
    if status:
        q["status"] = status
    size = max(1, min(size, 200))
    await _refresh_gift_ids()
    total = await db.orders.count_documents(q)
    rows = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * size).to_list(size)
    return {"platform": LOCAL, "total": total, "page": page, "size": size, "rows": [_order_row(o) for o in rows]}


@router.get("/hub/topups")
async def hub_topups(since: str = "", status: str = "", page: int = 1, size: int = 50, x_hub_key: str = Header("", alias="X-Hub-Key")):
    await _inbound_auth(x_hub_key)
    q: Dict[str, Any] = {}
    if since:
        q["created_at"] = {"$gte": since}
    if status:
        q["status"] = status
    size = max(1, min(size, 200))
    total = await db.topup_orders.count_documents(q)
    rows = await db.topup_orders.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * size).to_list(size)
    emails = {u["user_id"]: u.get("email", "") async for u in db.users.find({"user_id": {"$in": [r.get("user_id") for r in rows]}}, {"_id": 0, "user_id": 1, "email": 1})}
    return {"platform": LOCAL, "total": total, "page": page, "size": size, "rows": [_topup_row({**t, "user_email": emails.get(t.get("user_id"), "")}) for t in rows]}


@router.get("/hub/members")
async def hub_members(q: str = "", page: int = 1, size: int = 50, x_hub_key: str = Header("", alias="X-Hub-Key")):
    await _inbound_auth(x_hub_key)
    cond: Dict[str, Any] = {"role": {"$ne": "admin"}}
    if q:
        cond["email"] = {"$regex": q, "$options": "i"}
    size = max(1, min(size, 200))
    total = await db.users.count_documents(cond)
    rows = await db.users.find(cond, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "created_at": 1, "wallet_balance_usd": 1, "is_test": 1}).sort("created_at", -1).skip((page - 1) * size).to_list(size)
    return {"platform": LOCAL, "total": total, "page": page, "size": size,
            "rows": [{"id": u.get("user_id"), "email": u.get("email", ""), "name": u.get("name", ""), "wallet_usd": float(u.get("wallet_balance_usd") or 0), "created_at": u.get("created_at"), "is_test": bool(u.get("is_test"))} for u in rows]}


async def local_stats(days: int) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    paid = {"$in": ["paid", "processing", "shipped", "completed"]}
    rev = await db.orders.aggregate([{"$match": {"status": paid, "paid_at": {"$gte": since}}}, {"$group": {"_id": None, "s": {"$sum": "$total_usd"}, "n": {"$sum": 1}}}]).to_list(1)
    top = await db.topup_orders.aggregate([{"$match": {"status": {"$in": ["approved", "paid", "completed"]}, "created_at": {"$gte": since}}}, {"$group": {"_id": None, "s": {"$sum": "$amount_usd"}, "n": {"$sum": 1}}}]).to_list(1)
    return {"days": days, "revenue_usd": round((rev[0]["s"] if rev else 0) or 0, 2), "orders": (rev[0]["n"] if rev else 0),
            "topup_usd": round((top[0]["s"] if top else 0) or 0, 2), "topups": (top[0]["n"] if top else 0),
            "new_members": await db.users.count_documents({"role": {"$ne": "admin"}, "created_at": {"$gte": since}}),
            "members": await db.users.count_documents({"role": {"$ne": "admin"}}),
            "pending_orders": await db.orders.count_documents({"status": {"$in": ["paid", "processing"]}}),
            "pending_topups": await db.topup_orders.count_documents({"status": "reviewing"}),
            "open_chats": await db.chat_sessions.count_documents({"status": {"$ne": "closed"}, "unread_admin": {"$gt": 0}}) if "chat_sessions" in await db.list_collection_names() else 0}


@router.get("/hub/stats")
async def hub_stats(days: int = 30, x_hub_key: str = Header("", alias="X-Hub-Key")):
    await _inbound_auth(x_hub_key)
    return {"platform": LOCAL, **(await local_stats(max(1, min(days, 365))))}


# ----------------------------- inbound: pull from remote platforms -----------------------------
async def remote_new_paid_orders(paid_since: str) -> List[dict]:
    """Paid orders that arrived on remote platforms after `paid_since` (used by the admin new-order alert)."""
    cfg = await get_cfg()
    plats = [p for p in cfg["platforms"] if p.get("enabled", True) and not is_topup(p)]
    if not plats or not paid_since:
        return []
    try:
        got, _ = await asyncio.wait_for(_gather(plats, "/hub/orders", {"paid_since": paid_since, "size": 20}), timeout=6)
    except asyncio.TimeoutError:
        return []
    out = []
    for p, r in got:
        for o in r.get("rows", []):
            if o.get("paid_at") and o["paid_at"] > paid_since and o.get("status") not in ("pending_payment", "cancelled", "failed"):
                out.append({"id": f"{p['id']}:{o.get('id')}", "order_no": o.get("order_no"), "total_usd": o.get("amount_usd"), "user_email": o.get("user"), "paid_at": o.get("paid_at"),
                            "is_giftcard_order": o.get("type") == "giftcard", "items": [{"product_name": i} for i in o.get("items", [])], "platform": {"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop")}})
    return out
class PlatformIn(BaseModel):
    id: str
    name: str
    base_url: str
    api_key: str = ""
    cs_url: str = ""
    admin_url: str = ""
    kind: str = "shop"  # shop = 商城（Hub 規範）, giftray = Giftray 商城（直接對接其後台 API）, topup = 充值平台（只有充值+會員）
    enabled: bool = True


ADAPTERS = {"giftray": hub_giftray.fetch, "sifang": hub_sifang.fetch}
TOPUP_KINDS = ("topup", "sifang")


def is_topup(p: dict) -> bool:
    return p.get("kind") in TOPUP_KINDS


async def _remote(p: dict, path: str, params: dict) -> dict:
    if p.get("kind") in ADAPTERS:
        return await ADAPTERS[p["kind"]](p, path, params)
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.get(p["base_url"].rstrip("/") + path, params=params, headers={"X-Hub-Key": p.get("api_key", "")})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"{p['name']} 回應 {r.status_code}")
    return r.json()


async def _gather(platforms: List[dict], path: str, params: dict):
    res = await asyncio.gather(*[_remote(p, path, params) for p in platforms], return_exceptions=True)
    out, errors = [], []
    for p, r in zip(platforms, res):
        if isinstance(r, Exception):
            errors.append({"platform": p["id"], "name": p["name"], "error": getattr(r, "detail", str(r))})
        else:
            out.append((p, r))
    return out, errors


def _mask(p: dict) -> dict:
    return {**p, "api_key": ("•" * 8 + p["api_key"][-4:]) if p.get("api_key") else ""}


@router.get("/admin/hub/platforms")
async def admin_hub_platforms(admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    return {"inbound_key": cfg["inbound_key"], "local": LOCAL, "platforms": [_mask(p) for p in cfg["platforms"]]}


@router.put("/admin/hub/platforms")
async def admin_hub_platforms_put(body: List[PlatformIn], admin: dict = Depends(require_super)):
    cfg = await get_cfg()
    old = {p["id"]: p for p in cfg["platforms"]}
    rows = []
    for p in body:
        d = p.model_dump()
        d["id"] = "".join(ch for ch in d["id"].strip().lower() if ch.isalnum() or ch in "-_") or "p" + secrets.token_hex(3)
        if d["id"] == LOCAL["id"]:
            raise HTTPException(status_code=400, detail="平台代號不可與本站相同")
        if d["api_key"].startswith("••••") and d["id"] in old:
            d["api_key"] = old[d["id"]]["api_key"]
        rows.append(d)
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "platforms": rows}}, upsert=True)
    await admin_api.record_admin_log(admin["user_id"], admin.get("email", ""), "HUB", f"更新平台接入 {len(rows)} 個", 200)
    return {"inbound_key": cfg["inbound_key"], "local": LOCAL, "platforms": [_mask(p) for p in rows]}


@router.post("/admin/hub/platforms/{pid}/test")
async def admin_hub_platform_test(pid: str, admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    p = next((x for x in cfg["platforms"] if x["id"] == pid), None)
    if not p:
        raise HTTPException(status_code=404, detail="平台不存在")
    try:
        r = await _remote(p, "/hub/stats", {"days": 7})
        return {"ok": True, "platform": r.get("platform"), "stats": {k: v for k, v in r.items() if k != "platform"}}
    except HTTPException as e:
        return {"ok": False, "error": e.detail}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


@router.get("/admin/hub/platforms/public")
async def admin_hub_platforms_public(admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    return {"platforms": [{"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop"), "cs_url": p.get("cs_url", ""), "admin_url": p.get("admin_url", "")} for p in cfg["platforms"] if p.get("enabled", True) and p.get("kind") != "sifang"]}


def _active(cfg: dict, platform: str) -> List[dict]:
    ps = [p for p in cfg["platforms"] if p.get("enabled", True) and p.get("kind") != "sifang"]
    return [p for p in ps if p["id"] == platform] if platform and platform != "all" else ps


@router.get("/admin/hub/orders")
async def admin_hub_orders(platform: str = "all", kind: str = "all", status: str = "", q: str = "", size: int = 50, admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    size = max(1, min(size, 200))
    rows, errors = [], []
    if platform in ("all", LOCAL["id"]):
        if kind in ("all", "order", "giftcard"):
            lo = await hub_orders(status=status, size=size, x_hub_key=cfg["inbound_key"])
            rows += [{**r, "platform": LOCAL} for r in lo["rows"] if kind == "all" or r["type"] == kind]
        if kind in ("all", "topup"):
            lt = await hub_topups(status=status, size=size, x_hub_key=cfg["inbound_key"])
            rows += [{**r, "platform": LOCAL} for r in lt["rows"]]
    remote = _active(cfg, platform)
    if remote:
        paths = [x for x in ["/hub/orders", "/hub/topups"] if kind == "all" or (x.endswith("orders") and kind in ("order", "giftcard")) or (x.endswith("topups") and kind == "topup")]
        for path in paths:
            targets = [p for p in remote if not (path.endswith("orders") and is_topup(p))]
            if not targets:
                continue
            got, errs = await _gather(targets, path, {"status": status, "size": size})
            errors += errs
            for p, r in got:
                rows += [{**x, "platform": {"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop")}} for x in r.get("rows", []) if kind == "all" or x.get("type") == kind or path.endswith("topups")]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("order_no") or "").lower() or ql in (r.get("user") or "").lower() or any(ql in (i or "").lower() for i in r.get("items", []))]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"rows": rows[:size], "errors": errors}


@router.get("/admin/hub/members")
async def admin_hub_members(platform: str = "all", q: str = "", size: int = 50, admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    rows, errors = [], []
    if platform in ("all", LOCAL["id"]):
        lm = await hub_members(q=q, size=size, x_hub_key=cfg["inbound_key"])
        rows += [{**r, "platform": LOCAL} for r in lm["rows"]]
    got, errors = await _gather(_active(cfg, platform), "/hub/members", {"q": q, "size": size})
    for p, r in got:
        rows += [{**x, "platform": {"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop")}} for x in r.get("rows", [])]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"rows": rows[:size], "errors": errors}


@router.get("/admin/hub/stats")
async def admin_hub_stats(days: int = 30, admin: dict = Depends(current_admin)):
    cfg = await get_cfg()
    days = max(1, min(days, 365))
    local = {"platform": LOCAL, **(await local_stats(days))}
    got, errors = await _gather(_active(cfg, "all"), "/hub/stats", {"days": days})
    plats = [local] + [{**{k: v for k, v in r.items() if k != "platform"}, "platform": {"id": p["id"], "name": p["name"], "kind": p.get("kind", "shop")}} for p, r in got]
    keys = ["revenue_usd", "orders", "topup_usd", "topups", "new_members", "members", "pending_orders", "pending_topups", "open_chats"]
    total = {k: round(sum(float(x.get(k) or 0) for x in plats), 2) if k.endswith("_usd") else int(sum(int(x.get(k) or 0) for x in plats)) for k in keys}
    return {"days": days, "platforms": plats, "total": total, "errors": errors}
