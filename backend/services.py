"""Order domain core business logic (核心资金逻辑).

Channel routing, address picking, order construction, settlement (fee /
commission split) and paid-marking. Depends on core (db), utils and shared
cross-cutting helpers only — never on server.py — so routes can import it freely.
"""
import random
from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from core import db
from utils import iso, now_utc, gen_order_no, gen_wallet_address, gen_txid, is_private_host
from shared import record_ledger, enqueue_callback, send_telegram, alert_settings


def channel_addresses(ch: dict) -> List[str]:
    addrs = ch.get("wallet_addresses") or ([ch["wallet_address"]] if ch.get("wallet_address") else [])
    return [a for a in addrs if a]


async def ordered_addresses(ch: dict) -> List[str]:
    """Channel addresses sorted by current pending load (least busy first)."""
    addrs = channel_addresses(ch)
    if not addrs:
        return []
    paused = {m["address"] async for m in db.address_meta.find({"address": {"$in": addrs}, "status": "paused"})}
    active = [a for a in addrs if a not in paused] or addrs
    if len(active) == 1:
        return active
    pipeline = [{"$match": {"status": "pending", "wallet_address": {"$in": active}}},
                {"$group": {"_id": "$wallet_address", "n": {"$sum": 1}}}]
    counts = {r["_id"]: r["n"] async for r in db.orders.aggregate(pipeline)}
    return sorted(active, key=lambda a: (counts.get(a, 0), random.random()))


async def pick_address(ch: dict) -> str:
    addrs = await ordered_addresses(ch)
    return addrs[0] if addrs else ""


async def free_pay_amount(amount: float, address: str) -> Optional[float]:
    """A 2-decimal pay amount unique among this address's pending orders, or None
    when all 100 cent-variants are currently taken (address saturated)."""
    base = round(amount, 2)
    cents = list(range(0, 100))
    random.shuffle(cents)
    for c in cents:
        cand = round(base + c / 100, 2)
        if not await db.orders.find_one({"status": "pending", "wallet_address": address, "pay_amount": cand}):
            return cand
    return None


async def pick_channel(network: Optional[str], amount: float) -> Optional[dict]:
    q = {"status": "active"}
    if network:
        q["network"] = network
    channels = await db.channels.find(q).to_list(100)
    channels = [c for c in channels if c["min_amount"] <= amount <= c["max_amount"]]
    if not channels:
        return None
    # weighted random
    total = sum(c["weight"] for c in channels)
    r = random.uniform(0, total)
    upto = 0
    for c in channels:
        upto += c["weight"]
        if r <= upto:
            return c
    return channels[0]


async def build_order(merchant: dict, amount_usdt: float, network: Optional[str], remark: str,
                      notify_url: Optional[str], out_trade_no: Optional[str] = None,
                      return_url: Optional[str] = None) -> dict:
    network = "TRC20"
    if amount_usdt <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于 0")
    from urllib.parse import urlparse
    if notify_url:
        if not notify_url.startswith(("http://", "https://")) or is_private_host(urlparse(notify_url).hostname or ""):
            raise HTTPException(status_code=422, detail="notify_url 必须为公网 http(s) 地址")
    channel = await pick_channel(network, amount_usdt) if not (merchant.get("wallet_addresses") or []) else None
    m_addrs = merchant.get("wallet_addresses") or []
    if m_addrs:
        channel = {"_id": None, "name": "商户专属地址", "wallet_addresses": m_addrs}
        channel_id_str = ""
    else:
        if not channel:
            raise HTTPException(status_code=400, detail="没有可用的收款通道")
        channel_id_str = str(channel["_id"])
    expires = now_utc() + timedelta(minutes=15)
    live = bool(channel_addresses(channel))
    amount = round(amount_usdt, 2)
    for _attempt in range(3):
        if live:
            address, pay_amount = None, None
            for a in await ordered_addresses(channel):
                cand = await free_pay_amount(amount, a)
                if cand is not None:
                    address, pay_amount = a, cand
                    break
            if address is None:
                raise HTTPException(status_code=409, detail="当前收款地址繁忙，请稍后再试，或联系客服增配地址")
        else:
            address = gen_wallet_address(network)
            pay_amount = amount
        clean_return = _clean_return_url(return_url, await db.settings.find_one({"_id": "checkout"}) or {})
        order = {
            "order_no": gen_order_no(),
            "out_trade_no": out_trade_no or None,
            "merchant_id": str(merchant["_id"]),
            "merchant_name": merchant["name"],
            "amount_usdt": amount,
            "pay_amount": pay_amount,
            "live": live,
            "network": network,
            "wallet_address": address,
            "tx_id": None,
            "status": "pending",
            "channel_id": channel_id_str,
            "channel_name": channel["name"],
            "remark": remark or "",
            "notify_url": notify_url or merchant.get("notify_url") or None,
            "return_url": clean_return or None,
            "callback_status": None,
            "created_at": iso(now_utc()),
            "paid_at": None,
            "expires_at": iso(expires),
        }
        try:
            res = await db.orders.insert_one(order)
        except DuplicateKeyError:
            continue  # another concurrent order grabbed this address+pay_amount; re-pick
        order["_id"] = res.inserted_id
        return order
    raise HTTPException(status_code=409, detail="当前收款地址繁忙，请稍后再试")


def _clean_return_url(return_url: Optional[str], cfg: dict) -> str:
    clean_return = return_url.strip() if return_url else ""
    if not clean_return:
        return ""
    if not clean_return.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="return_url 必须以 http:// 或 https:// 开头")
    allow = [d.strip().lower() for d in (cfg.get("return_url_domains") or "").replace("\n", ",").split(",") if d.strip()]
    if allow:
        from urllib.parse import urlparse
        host = (urlparse(clean_return).hostname or "").lower()
        if not any(host == d or host.endswith("." + d) for d in allow):
            raise HTTPException(status_code=422, detail="return_url 域名不在允许白名单内")
    return clean_return


async def settle_order(order: dict):
    """Compute fee/commission split and credit balances."""
    merchant = await db.users.find_one({"_id": ObjectId(order["merchant_id"])})
    channel = None
    if order.get("channel_id"):
        try:
            channel = await db.channels.find_one({"_id": ObjectId(order["channel_id"])})
        except Exception:
            channel = None
    amount = order["amount_usdt"]
    merchant_rate = merchant.get("rate", 0.03)
    channel_rate = channel.get("fee_rate", 0.02) if channel else 0.02

    fee = round(amount * merchant_rate, 4)
    merchant_receive = round(amount - fee, 4)

    agent_commission = 0.0
    agent_id = merchant.get("parent_agent_id")
    if agent_id:
        agent = await db.users.find_one({"_id": ObjectId(agent_id)})
        if agent:
            agent_rate = agent.get("rate", channel_rate)
            agent_commission = round(amount * max(merchant_rate - agent_rate, 0), 4)
            if agent_commission > 0:
                await db.users.update_one({"_id": agent["_id"]},
                                          {"$inc": {"balance": agent_commission}})
                agent_upd = await db.users.find_one({"_id": agent["_id"]})
                await record_ledger(str(agent["_id"]), "commission", agent_commission,
                                    agent_upd.get("balance", 0), agent_upd.get("frozen_balance", 0),
                                    "order", order.get("order_no"),
                                    remark=f"订单 {order.get('order_no')} 代理分润")
    platform_profit = round(fee - agent_commission, 4)

    await db.users.update_one({"_id": merchant["_id"]}, {"$inc": {"balance": merchant_receive}})
    m_upd = await db.users.find_one({"_id": merchant["_id"]})
    await record_ledger(str(merchant["_id"]), "order_credit", merchant_receive,
                        m_upd.get("balance", 0), m_upd.get("frozen_balance", 0),
                        "order", order.get("order_no"),
                        remark=f"{order.get('network', '')} 收款 {amount} USDT，手续费 {fee}")
    return fee, merchant_receive, agent_commission, platform_profit


async def mark_paid(order: dict, tx_id: Optional[str] = None, paid_at: Optional[datetime] = None,
                    notify: bool = True) -> dict:
    claimed = await db.orders.find_one_and_update(
        {"_id": order["_id"], "status": "pending"}, {"$set": {"status": "confirming"}})
    if not claimed:
        return order
    fee, merchant_receive, agent_commission, platform_profit = await settle_order(order)
    update = {
        "status": "paid",
        "tx_id": tx_id or gen_txid(order["network"]),
        "paid_at": iso(paid_at or now_utc()),
        "fee": fee,
        "merchant_receive": merchant_receive,
        "agent_commission": agent_commission,
        "platform_profit": platform_profit,
        "callback_status": "none" if not order.get("notify_url") else "pending",
    }
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    order.update(update)
    if notify:
        await enqueue_callback(order)
    cfg = await alert_settings()
    if order["amount_usdt"] >= cfg.get("big_payment", 1000):
        await send_telegram(f"💰 <b>大额到账</b> {order['amount_usdt']} USDT\n商户：{order['merchant_name']}\n订单：<code>{order['order_no']}</code>\n网络：{order['network']}" + (f"\nTx：<code>{update['tx_id']}</code>" if order.get("live") else ""), "payment")
    return order
