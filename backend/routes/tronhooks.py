"""TronHooks webhook integration: instant TRC20 USDT arrival (replaces waiting for TronGrid polling)."""
import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db
from deps import require_roles
from utils import iso, now_utc
from server import match_chain_tx, live_address_list, verify_step_up_dep, audit

router = APIRouter(prefix="/api")
logger = logging.getLogger("sifang.tronhooks")
TH = "https://tronhooks.com"


def _key() -> str:
    return (os.environ.get("TRONHOOKS_API_KEY") or "").strip()


def _webhook_url() -> str:
    return f"{(os.environ.get('FRONTEND_URL') or '').rstrip('/')}/api/webhooks/tronhooks"


def _headers():
    return {"Authorization": f"Bearer {_key()}"}


async def _record_status(**fields):
    await db.settings.update_one({"_id": "tronhooks"}, {"$set": {**fields, "updated_at": iso(now_utc())}}, upsert=True)


async def sync_watches() -> dict:
    """Ensure every active live address has a USDT watch; drop watches for removed addresses."""
    if not _key():
        return {"enabled": False}
    wanted = {a for _, a in await live_address_list()}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{TH}/v1/watches", headers=_headers())
        r.raise_for_status()
        remote = {w["address"]: w for w in r.json().get("data", []) if w.get("asset_filter") in ("USDT", "ALL")}
        created, removed, errors = [], [], []
        for addr in wanted - set(remote):
            rr = await c.post(f"{TH}/v1/watches", headers=_headers(),
                              json={"address": addr, "asset_filter": "USDT", "direction": "incoming", "webhook_url": _webhook_url()})
            if rr.status_code in (200, 201):
                w = rr.json()
                await db.tronhooks_watches.update_one({"_id": w["id"]}, {"$set": {
                    "address": addr, "secret": w.get("secret"), "status": w.get("status"), "webhook_url": _webhook_url(),
                    "created_at": iso(now_utc())}}, upsert=True)
                created.append(addr)
            else:
                errors.append(f"{addr}: HTTP {rr.status_code} {rr.text[:120]}")
        for addr, w in remote.items():
            if addr not in wanted and w.get("webhook_url") == _webhook_url():
                dr = await c.delete(f"{TH}/v1/watches/{w['id']}", headers=_headers())
                if dr.status_code in (200, 204):
                    await db.tronhooks_watches.delete_one({"_id": w["id"]})
                    removed.append(addr)
        for addr, w in remote.items():
            await db.tronhooks_watches.update_one({"_id": w["id"]}, {"$set": {"address": addr, "status": w.get("status")}}, upsert=True)
    res = {"enabled": True, "watched": len(remote) + len(created) - len(removed), "created": created, "removed": removed, "errors": errors}
    await _record_status(last_sync_at=iso(now_utc()), last_sync=res)
    return res


async def tronhooks_sync_loop():
    await asyncio.sleep(20)
    while True:
        if _key():
            try:
                await sync_watches()
            except Exception as e:
                logger.warning("TronHooks 同步失败: %s", e)
                await _record_status(last_error=str(e)[:200])
        await asyncio.sleep(120)


@router.post("/webhooks/tronhooks")
async def tronhooks_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("x-signature") or ""
    try:
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="bad json")
    watch = await db.tronhooks_watches.find_one({"_id": payload.get("watch_id")})
    secrets = [watch["secret"]] if watch and watch.get("secret") else \
        [w["secret"] async for w in db.tronhooks_watches.find({"secret": {"$exists": True}})]
    if not any(hmac.compare_digest(hmac.new(s.encode(), raw, hashlib.sha256).hexdigest(), sig) for s in secrets):
        logger.warning("TronHooks 签名无效 event=%s", payload.get("event_id"))
        raise HTTPException(status_code=401, detail="invalid signature")
    if payload.get("type") != "transfer.confirmed" or payload.get("asset") != "USDT" or payload.get("direction") != "incoming":
        return {"ok": True, "ignored": True}
    try:
        await db.tronhooks_events.insert_one({"_id": payload["event_id"], "tx_id": payload.get("tx_id"),
                                              "to": payload.get("to"), "amount": payload.get("amount"), "received_at": iso(now_utc())})
    except Exception:
        return {"ok": True, "duplicate": True}
    ts = datetime.fromisoformat(payload["block_timestamp"].replace("Z", "+00:00")).astimezone(timezone.utc)
    tx = {"transaction_id": payload["tx_id"], "value": payload["amount_raw"], "decimals": 6,
          "block_timestamp": int(ts.timestamp() * 1000), "from": payload.get("from")}
    await match_chain_tx(tx, payload["to"], "TRC20", source="tronhooks")
    await _record_status(last_event_at=iso(now_utc()))
    return {"ok": True}


@router.get("/tronhooks/status")
async def tronhooks_status(user: dict = Depends(require_roles("admin", "operator"))):
    st = await db.settings.find_one({"_id": "tronhooks"}) or {}
    st.pop("_id", None)
    watches = [{"id": w["_id"], "address": w.get("address"), "status": w.get("status")} async for w in db.tronhooks_watches.find()]
    events = await db.tronhooks_events.count_documents({})
    return {"enabled": bool(_key()), "webhook_url": _webhook_url(), "watches": watches, "events_received": events, **st}


@router.post("/tronhooks/sync")
async def tronhooks_sync(request: Request, user: dict = Depends(require_roles("admin")), _su: dict = Depends(verify_step_up_dep)):
    if not _key():
        raise HTTPException(status_code=400, detail="未配置 TRONHOOKS_API_KEY")
    try:
        res = await sync_watches()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"TronHooks 返回 {e.response.status_code}: {e.response.text[:160]}")
    await audit(user, "tronhooks.sync", "system", "watches", {"created": res["created"], "removed": res["removed"]}, request)
    return res
