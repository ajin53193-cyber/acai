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
