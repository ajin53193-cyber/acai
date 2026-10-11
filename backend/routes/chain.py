"""On-chain domain routes: matched tx log, manual sync, address health,
address metadata, sweeps, add/remove addresses, balance refresh.

Chain workers (chain_listener/balance_refresher) and low-level helpers remain in
server.py and are imported late; cross-cutting audit via shared; channel_addresses
via services.
"""
import asyncio
import re
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel

from core import db
from utils import serialize, iso, now_utc
from deps import require_roles
from shared import audit
from services import channel_addresses
from server import (
    live_address_list, sync_address, set_address_health, check_balance_alert,
    check_sweep_alert, fetch_balance, normalize_addresses, _tx_explorer, NETWORKS,
    chain_usage_snapshot,
)
from datetime import timedelta

router = APIRouter(prefix="/api")


@router.get("/chain/usage")
async def chain_usage(user: dict = Depends(require_roles("admin", "operator"))):
    snap = chain_usage_snapshot()
    used, limit = snap["used"], snap["limit"]
    return {**snap, "remaining": max(0, limit - used),
            "pct": round(used / limit * 100, 2) if limit else 0.0}


@router.get("/chain/txs")
async def list_chain_txs(user: dict = Depends(require_roles("admin")), address: Optional[str] = None,
                         order_no: Optional[str] = None, limit: int = Query(100, le=500)):
    q: dict = {}
    if address:
        q["to"] = {"$regex": f"^{re.escape(address)}$", "$options": "i"}
    if order_no:
        q["order_no"] = order_no
    txs = await db.chain_txs.find(q).sort("created_at", -1).to_list(limit)
    return [{**serialize(t), "explorer": _tx_explorer(t["network"], t["tx_id"])} for t in txs]


@router.post("/chain/sync")
async def chain_sync_now(user: dict = Depends(require_roles("admin"))):
    pairs = await live_address_list()
    scanned, matched, errors = 0, 0, []
    since = int((now_utc() - timedelta(hours=24)).timestamp() * 1000)
    for ch, addr in pairs:
        before = await db.orders.count_documents({"status": "paid", "wallet_address": addr})
        try:
            scanned += await asyncio.wait_for(sync_address(ch, addr, since), timeout=25)
        except asyncio.TimeoutError:
            errors.append(f"{ch['network']} {addr[:8]}…: 超时（地址交易过多），后台轮询将继续处理")
            continue
        except Exception as e:
            errors.append(f"{ch['network']} {addr[:8]}…: {str(e)[:80]}")
            continue
        matched += await db.orders.count_documents({"status": "paid", "wallet_address": addr}) - before
    return {"channels": len({str(ch["_id"]) for ch, _ in pairs}), "addresses": len(pairs),
            "scanned": scanned, "matched": matched, "errors": errors}


@router.get("/chain/addresses")
async def list_address_health(user: dict = Depends(require_roles("admin"))):
    pairs = await live_address_list()
    health = {(h["network"], h["address"]): h async for h in db.address_health.find()}
    meta = {m["address"]: m async for m in db.address_meta.find()}
    pipeline = [{"$match": {"status": "pending"}}, {"$group": {"_id": "$wallet_address", "n": {"$sum": 1}}}]
    pending = {r["_id"]: r["n"] async for r in db.orders.aggregate(pipeline)}
    paid_pipeline = [{"$match": {"status": "paid", "live": True}},
                     {"$group": {"_id": "$wallet_address", "n": {"$sum": 1}, "vol": {"$sum": "$amount_usdt"}, "last": {"$max": "$paid_at"}}}]
    paid = {r["_id"]: r async for r in db.orders.aggregate(paid_pipeline)}
    sweep_pipeline = [{"$group": {"_id": "$address", "total": {"$sum": "$amount"}, "last": {"$max": "$created_at"}, "n": {"$sum": 1}}}]
    sweeps = {r["_id"]: r async for r in db.sweeps.aggregate(sweep_pipeline)}
    rows = []
    for ch, addr in pairs:
        h = health.get((ch["network"], addr), {})
        p = paid.get(addr, {})
        m = meta.get(addr, {})
        sw = sweeps.get(addr, {})
        explorer = f"https://tronscan.org/#/address/{addr}"
        bal = h.get("balance")
        rows.append({"address": addr, "network": ch["network"], "channel_id": str(ch["_id"]), "channel_name": ch["name"],
                     "label": m.get("label", ""), "paused": m.get("status") == "paused",
                     "balance": bal, "balance_at": h.get("balance_at"), "balance_error": h.get("balance_error"),
                     "last_sync_at": h.get("last_sync_at"), "sync_error": h.get("sync_error"),
                     "pending": pending.get(addr, 0), "paid_count": p.get("n", 0), "paid_volume": round(p.get("vol", 0), 2),
                     "last_paid_at": p.get("last"), "explorer": explorer,
                     "swept_total": round(sw.get("total", 0), 2), "swept_count": sw.get("n", 0), "last_swept_at": sw.get("last"),
                     "unswept": round(bal, 2) if bal is not None else None,
                     "status": "error" if h.get("sync_error") or h.get("balance_error") else ("ok" if h.get("last_sync_at") or h.get("balance_at") else "idle")})
    total_balance = round(sum(r["balance"] or 0 for r in rows), 2)
    return {"total_balance": total_balance, "total_swept": round(sum(r["swept_total"] for r in rows), 2),
            "by_network": {n: round(sum(r["balance"] or 0 for r in rows if r["network"] == n), 2) for n in NETWORKS},
            "addresses": rows}


class AddressMeta(BaseModel):
    label: Optional[str] = None
    status: Optional[str] = None  # active | paused


@router.patch("/chain/addresses/{address}")
async def update_address_meta(address: str, data: AddressMeta, request: Request, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "status" in upd and upd["status"] not in ("active", "paused"):
        raise HTTPException(status_code=400, detail="status 需为 active 或 paused")
    if not upd:
        raise HTTPException(status_code=400, detail="无更新内容")
    await db.address_meta.update_one({"address": address}, {"$set": {**upd, "updated_at": iso(now_utc())}}, upsert=True)
    await audit(user, "address.update", "address", address, upd, request)
    m = await db.address_meta.find_one({"address": address})
    return serialize(m)


class SweepCreate(BaseModel):
    address: str
    network: str
    amount: float
    tx_id: Optional[str] = ""
    cold_wallet: Optional[str] = ""
    note: Optional[str] = ""


@router.post("/chain/sweeps")
async def create_sweep(data: SweepCreate, request: Request, user: dict = Depends(require_roles("admin"))):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="归集金额必须大于 0")
    if data.network not in NETWORKS:
        raise HTTPException(status_code=400, detail="不支持的网络")
    doc = {**data.model_dump(), "operator": user["email"], "created_at": iso(now_utc())}
    res = await db.sweeps.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(user, "address.sweep", "address", data.address,
                {"amount": data.amount, "network": data.network, "cold_wallet": data.cold_wallet, "tx_id": data.tx_id}, request)
    return serialize(doc)


@router.get("/chain/sweeps")
async def list_sweeps(user: dict = Depends(require_roles("admin")), address: Optional[str] = None, limit: int = Query(100, le=500)):
    q = {"address": address} if address else {}
    rows = await db.sweeps.find(q).sort("created_at", -1).to_list(limit)
    return [serialize(r) for r in rows]


class AddressAdd(BaseModel):
    channel_id: str
    addresses: List[str]
    label: Optional[str] = ""


@router.post("/chain/addresses")
async def add_addresses(data: AddressAdd, request: Request, user: dict = Depends(require_roles("admin"))):
    ch = await db.channels.find_one({"_id": ObjectId(data.channel_id)})
    if not ch:
        raise HTTPException(status_code=404, detail="通道不存在")
    merged = normalize_addresses(ch["network"], channel_addresses(ch) + data.addresses, None)
    await db.channels.update_one({"_id": ch["_id"]}, {"$set": {"wallet_addresses": merged, "wallet_address": merged[0] if merged else ""}})
    if data.label:
        for a in data.addresses:
            await db.address_meta.update_one({"address": a.strip()}, {"$set": {"label": data.label}}, upsert=True)
    await audit(user, "address.add", "channel", data.channel_id, {"added": data.addresses, "channel": ch["name"]}, request)
    return {"wallet_addresses": merged}


@router.delete("/chain/addresses/{channel_id}/{address}")
async def remove_address(channel_id: str, address: str, request: Request, user: dict = Depends(require_roles("admin"))):
    ch = await db.channels.find_one({"_id": ObjectId(channel_id)})
    if not ch:
        raise HTTPException(status_code=404, detail="通道不存在")
    pending = await db.orders.count_documents({"status": "pending", "wallet_address": address})
    if pending:
        raise HTTPException(status_code=400, detail=f"该地址仍有 {pending} 笔待支付订单，请先暂停并等待订单结束")
    remaining = [a for a in channel_addresses(ch) if a != address]
    await db.channels.update_one({"_id": ch["_id"]}, {"$set": {"wallet_addresses": remaining, "wallet_address": remaining[0] if remaining else ""}})
    await audit(user, "address.remove", "channel", channel_id, {"removed": address, "channel": ch["name"]}, request)
    return {"wallet_addresses": remaining}


@router.post("/chain/addresses/refresh")
async def refresh_address_health(user: dict = Depends(require_roles("admin"))):
    pairs = await live_address_list()
    ok, errors = 0, []
    for ch, addr in pairs:
        try:
            bal = await fetch_balance(ch["network"], addr)
            await check_balance_alert(ch["network"], addr, ch, bal)
            await check_sweep_alert(ch["network"], addr, ch, bal)
            await set_address_health(ch["network"], addr, ch, balance=bal, balance_at=iso(now_utc()), balance_error=None)
            ok += 1
        except Exception as e:
            await set_address_health(ch["network"], addr, ch, balance_error=str(e)[:200])
            errors.append(f"{ch['network']} {addr[:8]}…: {str(e)[:80]}")
    return {"ok": ok, "errors": errors}
