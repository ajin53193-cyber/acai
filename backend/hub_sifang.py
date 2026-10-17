"""四方 USDT 收款平台直接對接：把其 Admin Open API（/api/admin-api/orders、/accounts、/support/threads）轉成 Hub 規範格式（充值 + 會員 + 統計）。"""
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException

_cache: Dict[str, tuple] = {}
TTL = 10
STATUS = {"pending": "pending_payment", "confirming": "confirming", "paid": "paid", "expired": "expired"}


async def _get(p: dict, path: str, params: dict | None = None) -> Any:
    key = f"{p['id']}|{path}|{sorted((params or {}).items())}"
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(p["base_url"].rstrip("/") + path, params=params, headers={"X-Api-Key": p.get("api_key", "")})
    if r.status_code != 200:
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=502, detail=f"{p['name']} 回應 {r.status_code} {detail}".strip())
    body = r.json()
    data = body.get("data", body) if isinstance(body, dict) and "code" in body else body
    _cache[key] = (time.time() + TTL, data)
    return data


def _list(d: Any) -> List[dict]:
    if isinstance(d, dict):
        for k in ("items", "list", "rows", "orders", "accounts", "threads", "data"):
            if isinstance(d.get(k), list):
                return d[k]
        return []
    return d or []


def _tag(p: dict) -> dict:
    return {"id": p["id"], "name": p["name"]}


def _topup_row(o: dict) -> dict:
    addr = o.get("wallet_address") or ""
    return {"id": o.get("order_no"), "order_no": o.get("order_no"), "type": "topup", "user": o.get("merchant_name") or o.get("merchant_id") or "",
            "status": STATUS.get(o.get("status"), o.get("status")), "amount_usd": round(float(o.get("amount_usdt") or 0), 2), "amount_label": f"實付 {float(o.get('pay_amount') or 0):g} USDT" if o.get("pay_amount") else "",
            "items": [" ".join(x for x in [o.get("network") or "", (addr[:6] + "…" + addr[-4:]) if len(addr) > 12 else addr, ("商戶單 " + o["out_trade_no"]) if o.get("out_trade_no") else ""] if x)],
            "created_at": o.get("created_at"), "paid_at": o.get("paid_at")}


def _member_row(a: dict) -> dict:
    return {"id": a.get("id") or a.get("account_id"), "email": a.get("email") or a.get("username") or a.get("name") or "", "name": a.get("name") or a.get("merchant_name") or a.get("username") or "",
            "wallet_usd": round(float(a.get("balance") if a.get("balance") is not None else a.get("balance_usdt") or 0), 2), "created_at": a.get("created_at"), "is_test": False,
            "role": a.get("role") or "merchant"}


async def _orders(p: dict) -> List[dict]:
    return _list(await _get(p, "/orders", {"page": 1, "page_size": 500}))


async def _accounts(p: dict) -> List[dict]:
    return _list(await _get(p, "/accounts", {}))


async def orders(p: dict, params: dict) -> dict:
    return {"platform": _tag(p), "total": 0, "rows": []}


async def topups(p: dict, params: dict) -> dict:
    size = max(1, min(int(params.get("size") or 50), 200))
    rows = [_topup_row(o) for o in await _orders(p)]
    if params.get("status"):
        rows = [r for r in rows if r["status"] == params["status"]]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:size]}


async def members(p: dict, params: dict) -> dict:
    size = max(1, min(int(params.get("size") or 50), 200))
    q = (params.get("q") or "").lower()
    rows = [_member_row(a) for a in await _accounts(p)]
    if q:
        rows = [r for r in rows if q in r["email"].lower() or q in r["name"].lower()]
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:size]}


async def stats(p: dict, params: dict) -> dict:
    days = max(1, min(int(params.get("days") or 30), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    os_ = await _orders(p)
    accts = await _accounts(p)
    paid = [o for o in os_ if o.get("status") == "paid" and (o.get("paid_at") or o.get("created_at") or "") >= since]
    chats = 0
    try:
        chats = len(_list(await _get(p, "/support/threads", {"status": "open"})))
    except Exception:  # noqa: BLE001
        pass
    return {"platform": _tag(p), "days": days, "revenue_usd": 0, "orders": 0,
            "topup_usd": round(sum(float(o.get("amount_usdt") or 0) for o in paid), 2), "topups": len(paid),
            "new_members": len([a for a in accts if (a.get("created_at") or "") >= since]), "members": len(accts),
            "pending_orders": 0, "pending_topups": len([o for o in os_ if o.get("status") in ("pending", "confirming")]), "open_chats": chats}


HANDLERS = {"/hub/orders": orders, "/hub/topups": topups, "/hub/members": members, "/hub/stats": stats}


async def fetch(p: dict, path: str, params: dict) -> dict:
    return await HANDLERS[path](p, {k: v for k, v in params.items() if v not in ("", None)})


# ----------------------------- 獨立「四方收款」頁面用 -----------------------------
BJ = timezone(timedelta(hours=8))


def _row(o: dict) -> dict:
    addr = o.get("wallet_address") or ""
    return {"order_no": o.get("order_no"), "out_trade_no": o.get("out_trade_no") or "", "merchant_id": o.get("merchant_id") or "", "merchant_name": o.get("merchant_name") or o.get("merchant_id") or "",
            "amount_usdt": round(float(o.get("amount_usdt") or 0), 2), "pay_amount": round(float(o.get("pay_amount") or 0), 4), "network": o.get("network") or "", "wallet_address": addr,
            "status": o.get("status"), "tx_id": o.get("tx_id") or "", "manual_confirmed": bool(o.get("manual_confirmed")), "remark": o.get("remark") or "", "created_at": o.get("created_at"), "paid_at": o.get("paid_at"), "expires_at": o.get("expires_at")}


async def overview(p: dict, days: int) -> dict:
    days = max(1, min(days, 365))
    os_ = [_row(o) for o in await _orders(p)]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    today = datetime.now(BJ).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()

    def agg(rows):
        paid = [o for o in rows if o["status"] == "paid"]
        return {"count": len(rows), "paid": len(paid), "usdt": round(sum(o["amount_usdt"] for o in paid), 2), "rate": round(len(paid) / len(rows) * 100, 1) if rows else 0}

    accts = await _accounts(p)
    merchants = [a for a in accts if (a.get("role") or "merchant") == "merchant"]
    by_m: Dict[str, dict] = {}
    for o in os_:
        if o["status"] == "paid" and (o["paid_at"] or o["created_at"] or "") >= since:
            m = by_m.setdefault(o["merchant_id"] or o["merchant_name"], {"merchant_name": o["merchant_name"], "paid": 0, "usdt": 0.0})
            m["paid"] += 1
            m["usdt"] = round(m["usdt"] + o["amount_usdt"], 2)
    chats = 0
    try:
        chats = len(_list(await _get(p, "/support/threads", {"status": "open"})))
    except Exception:  # noqa: BLE001
        pass
    return {"platform": _tag(p), "days": days, "today": agg([o for o in os_ if (o["created_at"] or "") >= today]), "period": agg([o for o in os_ if (o["created_at"] or "") >= since]), "all": agg(os_),
            "pending": len([o for o in os_ if o["status"] == "pending"]), "confirming": len([o for o in os_ if o["status"] == "confirming"]), "expired": len([o for o in os_ if o["status"] == "expired"]),
            "merchants": len(merchants), "merchant_balance": round(sum(float(a.get("balance") if a.get("balance") is not None else a.get("balance_usdt") or 0) for a in merchants), 2), "open_chats": chats,
            "by_merchant": sorted(by_m.values(), key=lambda m: -m["usdt"])[:10]}


async def order_list(p: dict, status: str = "", merchant: str = "", network: str = "", q: str = "", size: int = 200) -> dict:
    rows = [_row(o) for o in await _orders(p)]
    if status:
        rows = [o for o in rows if o["status"] == status]
    if merchant:
        rows = [o for o in rows if merchant in (o["merchant_id"], o["merchant_name"])]
    if network:
        rows = [o for o in rows if o["network"] == network]
    if q:
        ql = q.lower()
        rows = [o for o in rows if ql in o["order_no"].lower() or ql in o["out_trade_no"].lower() or ql in o["tx_id"].lower() or ql in o["wallet_address"].lower() or ql in o["merchant_name"].lower() or ql in o["remark"].lower()]
    rows.sort(key=lambda o: o.get("created_at") or "", reverse=True)
    return {"platform": _tag(p), "total": len(rows), "rows": rows[:max(1, min(size, 500))], "merchants": sorted({o["merchant_name"] for o in rows if o["merchant_name"]}), "networks": sorted({o["network"] for o in rows if o["network"]})}


async def account_list(p: dict, role: str = "") -> dict:
    rows = [{**_member_row(a), "status": a.get("status") or ("frozen" if a.get("frozen") or a.get("disabled") else "active"), "frozen": round(float(a.get("frozen_balance") or a.get("frozen") or 0), 2) if isinstance(a.get("frozen_balance") or a.get("frozen"), (int, float)) else 0} for a in await _accounts(p)]
    if role:
        rows = [r for r in rows if r["role"] == role]
    rows.sort(key=lambda r: -r["wallet_usd"])
    return {"platform": _tag(p), "rows": rows}


async def thread_list(p: dict, status: str = "open") -> dict:
    rows = _list(await _get(p, "/support/threads", {"status": status or "all"}))
    return {"platform": _tag(p), "rows": [{"order_no": t.get("order_no"), "status": t.get("status"), "unread": int(t.get("unread") or t.get("unread_count") or 0), "last_message": t.get("last_message") or t.get("last_text") or "",
                                            "last_at": t.get("last_at") or t.get("updated_at") or t.get("created_at"), "customer": t.get("customer_name") or t.get("merchant_name") or ""} for t in rows]}


async def new_paid(p: dict, since: str) -> List[dict]:
    try:
        rows = [_row(o) for o in await _orders(p)]
    except Exception:  # noqa: BLE001
        return []
    return [{"id": f"{p['id']}:{o['order_no']}", "order_no": o["order_no"], "type": "sifang", "user": o["merchant_name"], "amount_usd": o["amount_usdt"], "items": [f"{o['network']} 商戶單 {o['out_trade_no']}".strip()],
             "paid_at": o["paid_at"], "status": "paid", "platform": _tag(p)} for o in rows if o["status"] == "paid" and o["paid_at"] and o["paid_at"] > since]


async def post(p: dict, path: str, body: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(p["base_url"].rstrip("/") + path, json=body or {}, headers={"X-Api-Key": p.get("api_key", "")})
    for k in [k for k in _cache if k.startswith(p["id"] + "|")]:
        _cache.pop(k, None)
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", "")
        except Exception:  # noqa: BLE001
            detail = r.text[:200]
        raise HTTPException(status_code=400 if r.status_code < 500 else 502, detail=f"{p['name']}：{detail or r.status_code}")
    body = r.json() if r.content else {}
    return body.get("data", body) if isinstance(body, dict) else body


def _msg(m: dict) -> dict:
    f = m.get("sender") or m.get("from") or "customer"
    return {"id": m.get("id"), "from": "admin" if f in ("agent", "admin") else "system" if f == "system" else "user", "text": m.get("text") or m.get("content") or "", "image": m.get("image") or "", "name": m.get("sender_name") or m.get("agent_name") or "", "at": m.get("created_at") or m.get("at")}


async def messages(p: dict, order_no: str) -> dict:
    d = await _get(p, f"/support/threads/{order_no}")
    _cache.pop(f"{p['id']}|/support/threads/{order_no}|[]", None)
    msgs = d.get("messages") if isinstance(d, dict) and "messages" in d else _list(d)
    return {"messages": [_msg(m) for m in (msgs or [])], "session": {k: v for k, v in d.items() if k != "messages"} if isinstance(d, dict) else {}}


async def payouts(p: dict, status: str = "pending") -> List[dict]:
    rows = _list(await _get(p, "/settlements/payouts", {"status": status or "all"}))
    _cache.pop(f"{p['id']}|/settlements/payouts|{sorted({'status': status or 'all'}.items())}", None)
    return [{"id": x.get("id") or x.get("payout_id"), "account": x.get("merchant_name") or x.get("account_name") or x.get("account_id") or "", "amount_usdt": round(float(x.get("amount_usdt") or x.get("amount") or 0), 2),
             "address": x.get("address") or x.get("wallet_address") or "", "network": x.get("network") or "TRC20", "status": x.get("status") or "pending", "created_at": x.get("created_at"), "remark": x.get("remark") or ""} for x in rows]
