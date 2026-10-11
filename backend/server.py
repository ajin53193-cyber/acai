from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, Header
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: F401  (client/db provided via core)
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Annotated, Any
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import logging
import random
import string
import secrets
import bcrypt
import jwt
import asyncio
import hmac
import hashlib
import json
import re
from urllib.parse import urlparse
import httpx
import pyotp
import qrcode
import io as _io
import base64
from email_utils import notify_security

# ---------------------------------------------------------------------------
# DB & app setup
# ---------------------------------------------------------------------------
from core import client, db, fs

app = FastAPI(title="四方收款平台 API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("sifang")

JWT_ALGORITHM = "HS256"
NETWORKS = ["TRC20"]
TRONGRID_API = os.environ.get("TRONGRID_API", "https://api.trongrid.io")
TRONGRID_API_KEY = os.environ.get("TRONGRID_API_KEY", "")
USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
CHAIN_POLL_SECONDS = int(os.environ.get("CHAIN_POLL_SECONDS", "20"))
CHAIN_MIN_INTERVAL = float(os.environ.get("CHAIN_MIN_INTERVAL", "0.08"))  # global QPS cap (~12/s)
CHAIN_ADDR_INTERVAL = float(os.environ.get("CHAIN_ADDR_INTERVAL", "1"))  # delay between addresses in a poll cycle
CHAIN_CURSOR_OVERLAP_MS = 180000  # re-scan a 3-min overlap so no tx slips past the cursor
CALLBACK_RETRY_DELAYS = [15, 60, 300, 1800, 7200]
_chain_rate_lock = asyncio.Lock()
_chain_last_call = 0.0
TRONGRID_DAILY_LIMIT = int(os.environ.get("TRONGRID_DAILY_LIMIT", "500000"))
CHAIN_SPIKE_MULT = float(os.environ.get("CHAIN_SPIKE_MULT", "3"))
CHAIN_SPIKE_MIN = int(os.environ.get("CHAIN_SPIKE_MIN", "2000"))
CHAIN_FORECAST_LEAD = float(os.environ.get("CHAIN_FORECAST_LEAD", "6"))
_chain_usage = {"date": "", "count": 0, "hours": {}, "alerted_hour": "", "forecast_alerted": ""}


def _usage_today_key():
    return now_utc().strftime("%Y-%m-%d")


def _bump_usage(n: int = 1):
    k = _usage_today_key()
    if _chain_usage["date"] != k:
        _chain_usage["date"] = k
        _chain_usage["count"] = 0
        _chain_usage["hours"] = {}
        _chain_usage["forecast_alerted"] = ""
    _chain_usage["count"] += n
    hh = now_utc().strftime("%H")
    _chain_usage["hours"][hh] = _chain_usage["hours"].get(hh, 0) + n


def chain_usage_memory() -> dict:
    return {"date": _chain_usage["date"], "hours": dict(_chain_usage["hours"])}


def chain_usage_forecast() -> dict:
    """Project today's end-of-day request total from the recent hourly rate and
    flag whether the daily quota will be exhausted before UTC midnight."""
    k = _usage_today_key()
    now = now_utc()
    used = _chain_usage["count"] if _chain_usage["date"] == k else 0
    limit = TRONGRID_DAILY_LIMIT
    secs_elapsed = max(1, now.hour * 3600 + now.minute * 60 + now.second)
    hours_remaining = (86400 - secs_elapsed) / 3600
    hours = _chain_usage["hours"] if _chain_usage["date"] == k else {}
    cur = now.strftime("%H")
    completed = sorted(((hh, v) for hh, v in hours.items() if hh != cur), reverse=True)[:3]
    if completed:
        rate = sum(v for _, v in completed) / len(completed)
    else:
        mins = now.minute + now.second / 60
        rate = (hours.get(cur, 0) / mins * 60) if mins > 0 else 0.0
    projected = used + rate * hours_remaining
    will_exhaust = limit > 0 and projected >= limit
    hours_to_exhaust = ((limit - used) / rate) if (rate > 0 and limit > used) else None
    eta = None
    if will_exhaust and hours_to_exhaust is not None and hours_to_exhaust <= hours_remaining:
        eta = (now + timedelta(hours=hours_to_exhaust)).strftime("%H:%M")
    return {"projected_eod": int(projected), "rate_per_hour": int(rate),
            "will_exhaust": bool(will_exhaust),
            "hours_to_exhaust": round(hours_to_exhaust, 1) if hours_to_exhaust is not None else None,
            "eta": eta}


async def _maybe_alert_forecast():
    """Telegram-warn once per day when the current rate projects the daily quota
    will be exhausted before midnight — gives hours of lead time."""
    k = _usage_today_key()
    if _chain_usage["date"] != k:
        return
    snap = chain_usage_snapshot()
    if snap["limit"] <= 0 or snap["used"] < snap["limit"] * 0.1:
        return
    fc = chain_usage_forecast()
    if not fc["will_exhaust"]:
        return
    doc = await db.settings.find_one({"_id": "chain_alert"}) or {}
    lead = float(doc.get("forecast_lead_hours", CHAIN_FORECAST_LEAD))
    h2e = fc["hours_to_exhaust"]
    if h2e is not None and h2e > lead:
        return
    if _chain_usage.get("forecast_alerted") == k:
        return
    _chain_usage["forecast_alerted"] = k
    pct = round(snap["used"] / snap["limit"] * 100, 1)
    await send_telegram(
        f"⏳ <b>TronGrid 额度预测告警</b>\n"
        f"按当前速率（约 {fc['rate_per_hour']}/时），预计今日请求将达 {fc['projected_eod']}，超过额度 {snap['limit']}。\n"
        + (f"预计约 {fc['eta']} (UTC) 用尽。\n" if fc["eta"] else "")
        + f"当前已用 {snap['used']}（{pct}%）。\n"
        f"建议升级 TronGrid 套餐，或调大 CHAIN_POLL_SECONDS 放慢轮询。", "alert")


async def _maybe_alert_spike():
    """Telegram-alert (once per hour) when the current UTC hour's TronGrid request
    count is abnormally higher than the recent hourly average — catches runaway
    polling / abuse before it drains the daily quota."""
    k = _usage_today_key()
    if _chain_usage["date"] != k:
        return
    hours = _chain_usage["hours"]
    cur = now_utc().strftime("%H")
    cnt = hours.get(cur, 0)
    doc = await db.settings.find_one({"_id": "chain_alert"}) or {}
    smin = int(doc.get("spike_min", CHAIN_SPIKE_MIN))
    mult = float(doc.get("spike_mult", CHAIN_SPIKE_MULT))
    if cnt < smin:
        return
    past = [v for hh, v in hours.items() if hh != cur and v > 0]
    if len(past) < 3:
        return
    avg = sum(past) / len(past)
    if avg <= 0 or cnt < avg * mult:
        return
    hour_key = f"{k} {cur}"
    if _chain_usage.get("alerted_hour") == hour_key:
        return
    _chain_usage["alerted_hour"] = hour_key
    snap = chain_usage_snapshot()
    pct = round(snap["used"] / snap["limit"] * 100, 2) if snap["limit"] else 0
    await send_telegram(
        f"🚨 <b>TronGrid 请求异常激增</b>\n"
        f"时段：{cur}:00 (UTC)\n"
        f"本时段请求：{cnt} 次（约为近期均值 {avg:.0f} 的 {cnt / avg:.1f} 倍）\n"
        f"今日累计：{snap['used']}/{snap['limit']}（{pct}%）\n"
        f"请检查是否存在异常轮询或攻击，避免额度被提前耗尽。", "alert")


def chain_usage_snapshot() -> dict:
    k = _usage_today_key()
    used = _chain_usage["count"] if _chain_usage["date"] == k else 0
    pct = (used / TRONGRID_DAILY_LIMIT * 100) if TRONGRID_DAILY_LIMIT else 0
    mult = 8 if pct >= 95 else 4 if pct >= 85 else 2 if pct >= 70 else 1
    return {"date": k, "used": used, "limit": TRONGRID_DAILY_LIMIT,
            "throttle_x": mult, "poll_seconds": CHAIN_POLL_SECONDS * mult}


# ---------------------------------------------------------------------------
# Helpers — pure/stateless helpers now live in utils.py
# ---------------------------------------------------------------------------
from utils import (
    now_utc, iso, hash_password, verify_password, get_jwt_secret, create_access_token,
    gen_order_no, gen_wallet_address, gen_txid, gen_api_key, gen_api_secret, is_private_host,
    clean_user, serialize, canon, sign_payload, client_ip,
)

# Cross-cutting infra (audit/ledger/callbacks/notifications) and order domain
# financial logic were extracted to shared.py / services.py.
from shared import (
    audit, record_ledger, enqueue_callback, build_callback_payload, deliver_callback,
    callback_worker, notify_settings, send_telegram, alert_settings,
    DEFAULT_ALERT_SETTINGS, DEFAULT_NOTIFY_SETTINGS,
)
from services import (
    channel_addresses, pick_address, pick_channel,
    build_order, settle_order, mark_paid,
)
from models import SecurityPolicy, CheckoutSettings  # consolidated into models.py


async def _chain_throttle():
    global _chain_last_call
    import time
    async with _chain_rate_lock:
        wait = CHAIN_MIN_INTERVAL - (time.monotonic() - _chain_last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        _chain_last_call = time.monotonic()


async def _chain_get(client, url, **kw):
    """GET with a global QPS throttle + exponential backoff on 403/429/5xx/timeouts."""
    import random
    last = None
    for attempt in range(5):
        await _chain_throttle()
        try:
            _bump_usage()
            r = await client.get(url, **kw)
            if r.status_code in (403, 429, 500, 502, 503):
                last = httpx.HTTPStatusError(f"chain {r.status_code}", request=r.request, response=r)
                raise last
            r.raise_for_status()
            return r
        except (httpx.HTTPStatusError, httpx.TransportError, httpx.TimeoutException) as e:
            last = e
            if attempt == 4:
                break
            await asyncio.sleep(min(8.0, 0.5 * (2 ** attempt)) + random.random() * 0.3)
    raise last


async def fetch_trc20_transfers(address: str, since_ms: int) -> List[dict]:
    headers = {"TRON-PRO-API-KEY": TRONGRID_API_KEY} if TRONGRID_API_KEY else {}
    params = {"only_confirmed": "true", "only_to": "true", "limit": 100,
              "contract_address": USDT_TRC20_CONTRACT, "min_timestamp": since_ms}
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await _chain_get(hc, f"{TRONGRID_API}/v1/accounts/{address}/transactions/trc20", params=params, headers=headers)
        return [{"transaction_id": t["transaction_id"], "from": t.get("from"), "value": t["value"],
                 "decimals": t.get("token_info", {}).get("decimals", 6), "block_timestamp": t["block_timestamp"]}
                for t in r.json().get("data", [])]


async def fetch_transfers(network: str, address: str, since_ms: int) -> List[dict]:
    return await fetch_trc20_transfers(address, since_ms)


async def fetch_balance(network: str, address: str) -> float:
    headers = {"TRON-PRO-API-KEY": TRONGRID_API_KEY} if TRONGRID_API_KEY else {}
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await _chain_get(hc, f"{TRONGRID_API}/v1/accounts/{address}", headers=headers)
        data = r.json().get("data") or [{}]
    for item in data[0].get("trc20", []):
        if USDT_TRC20_CONTRACT in item:
            return round(int(item[USDT_TRC20_CONTRACT]) / 1e6, 2)
    return 0.0


async def raise_alert(kind: str, network: str, address: str, channel: dict, message: str, detail: dict, cooldown_min: int = 60):
    recent = await db.alerts.find_one({"type": kind, "address": address, "network": network,
                                       "created_at": {"$gt": iso(now_utc() - timedelta(minutes=cooldown_min))}})
    if recent:
        return
    await db.alerts.insert_one({"type": kind, "network": network, "address": address, "channel_name": channel["name"],
                                "message": message, "detail": detail, "read": False, "created_at": iso(now_utc())})
    logger.warning(f"ALERT {kind} {network} {address}: {message}")
    icon = {"balance_change": "⚠️", "sync_failed": "🔴", "sweep_due": "🧊"}.get(kind, "⚠️")
    await send_telegram(f"{icon} <b>地址预警</b>\n{message}\n<code>{network} {address}</code>", "sweep" if kind == "sweep_due" else "alert")


async def check_sweep_alert(network: str, address: str, ch: dict, bal: float):
    cfg = await alert_settings()
    if cfg.get("sweep_threshold", 0) > 0 and bal >= cfg["sweep_threshold"]:
        await raise_alert("sweep_due", network, address, ch,
                          f"{ch['name']} 地址余额 {round(bal, 2)} USDT 已超过归集阈值 {cfg['sweep_threshold']}，建议归集至冷钱包",
                          {"balance": round(bal, 2), "threshold": cfg["sweep_threshold"]}, cooldown_min=360)


async def check_balance_alert(network: str, address: str, ch: dict, new_bal: float):
    prev = await db.address_health.find_one({"address": address, "network": network})
    old = prev.get("balance") if prev else None
    if old is None:
        return
    diff = new_bal - old
    cfg = await alert_settings()
    if abs(diff) >= cfg["min_abs"] and (old == 0 or abs(diff) / old * 100 >= cfg["pct"]):
        sign = "+" if diff > 0 else ""
        await raise_alert("balance_change", network, address, ch,
                          f"{ch['name']} 地址余额突变 {sign}{round(diff, 2)} USDT（{round(old, 2)} → {round(new_bal, 2)}）",
                          {"before": round(old, 2), "after": round(new_bal, 2), "diff": round(diff, 2)}, cooldown_min=5)


async def check_sync_alert(network: str, address: str, ch: dict):
    h = await db.address_health.find_one({"address": address, "network": network}) or {}
    cfg = await alert_settings()
    first_err = h.get("first_error_at")
    if not first_err:
        await db.address_health.update_one({"address": address, "network": network}, {"$set": {"first_error_at": iso(now_utc())}}, upsert=True)
        return
    if datetime.fromisoformat(first_err) <= now_utc() - timedelta(minutes=cfg["sync_minutes"]):
        await raise_alert("sync_failed", network, address, ch,
                          f"{ch['name']} 地址同步失败已超过 {cfg['sync_minutes']} 分钟：{h.get('sync_error', '')[:80]}",
                          {"since": first_err, "error": h.get("sync_error")})


async def set_address_health(network: str, address: str, channel: dict, **fields):
    fields["updated_at"] = iso(now_utc())
    await db.address_health.update_one({"address": address, "network": network},
                                       {"$set": {**fields, "channel_id": str(channel["_id"]), "channel_name": channel["name"]}},
                                       upsert=True)


async def match_chain_tx(tx: dict, address: str, network: str = "TRC20"):
    txid = tx["transaction_id"]
    if await db.chain_txs.find_one({"tx_id": txid}):
        return
    decimals = tx.get("decimals", 6)
    amount = round(int(tx["value"]) / (10 ** decimals), 6)
    ts = datetime.fromtimestamp(tx["block_timestamp"] / 1000, tz=timezone.utc)
    addr_q = address if network == "TRC20" else {"$regex": f"^{address}$", "$options": "i"}
    order = await db.orders.find_one({"status": "pending", "wallet_address": addr_q,
                                      "pay_amount": amount, "network": network})
    rec = {"tx_id": txid, "network": network, "to": address, "from": tx.get("from"),
           "amount": amount, "block_time": iso(ts), "order_no": order["order_no"] if order else None,
           "matched": bool(order), "created_at": iso(now_utc())}
    await db.chain_txs.insert_one(rec)
    if order:
        await mark_paid(order, tx_id=txid, paid_at=ts)
        logger.info(f"链上到账匹配成功 {order['order_no']} {amount} USDT tx={txid}")


async def live_address_list() -> List[tuple]:
    chs = await db.channels.find({"status": "active"}).to_list(200)
    return [(ch, a) for ch in chs for a in channel_addresses(ch)]


async def sync_address(ch: dict, addr: str, since_ms: int) -> int:
    network = ch["network"]
    try:
        txs = await fetch_transfers(network, addr, since_ms)
        max_ts = since_ms
        for tx in txs:
            await match_chain_tx(tx, addr, network)
            if tx.get("block_timestamp", 0) > max_ts:
                max_ts = tx["block_timestamp"]
        await db.channels.update_one({"_id": ch["_id"]}, {"$set": {"last_sync_at": iso(now_utc()), "sync_error": None}})
        await set_address_health(network, addr, ch, last_sync_at=iso(now_utc()), sync_error=None,
                                 last_tx_count=len(txs), first_error_at=None, cursor_ms=max_ts)
        return len(txs)
    except Exception as e:
        await db.channels.update_one({"_id": ch["_id"]}, {"$set": {"sync_error": str(e)[:200]}})
        await set_address_health(network, addr, ch, sync_error=str(e)[:200])
        await check_sync_alert(network, addr, ch)
        logger.warning(f"{network} 轮询失败 {addr}: {e}")
        raise


async def chain_listener():
    await asyncio.sleep(3)
    try:
        doc = await db.chain_usage.find_one({"_id": _usage_today_key()}) or {}
        _chain_usage["date"] = _usage_today_key()
        _chain_usage["count"] = int(doc.get("count", 0))
        _chain_usage["hours"] = dict(doc.get("hours", {}) or {})
    except Exception:
        pass
    while True:
        try:
            for ch, addr in await live_address_list():
                has_pending = await db.orders.count_documents({"status": "pending", "wallet_address": addr}) > 0
                if not has_pending:
                    continue
                floor = int((now_utc() - timedelta(hours=2)).timestamp() * 1000)
                h = await db.address_health.find_one({"address": addr, "network": ch["network"]}) or {}
                cursor = h.get("cursor_ms")
                since = max(floor, cursor - CHAIN_CURSOR_OVERLAP_MS) if cursor else floor
                try:
                    await sync_address(ch, addr, since)
                except Exception:
                    pass
                await asyncio.sleep(CHAIN_ADDR_INTERVAL)
            await db.orders.update_many({"status": "pending", "expires_at": {"$lt": iso(now_utc())}},
                                        {"$set": {"status": "expired"}})
        except Exception as e:
            logger.warning(f"chain listener error: {e}")
        try:
            await db.chain_usage.update_one({"_id": _chain_usage["date"] or _usage_today_key()},
                {"$set": {"count": _chain_usage["count"], "hours": _chain_usage["hours"],
                          "updated_at": iso(now_utc())}}, upsert=True)
        except Exception:
            pass
        try:
            await _maybe_alert_spike()
        except Exception:
            pass
        try:
            await _maybe_alert_forecast()
        except Exception:
            pass
        await asyncio.sleep(chain_usage_snapshot()["poll_seconds"])


async def balance_refresher():
    await asyncio.sleep(10)
    while True:
        try:
            for ch, addr in await live_address_list():
                try:
                    bal = await fetch_balance(ch["network"], addr)
                    await check_balance_alert(ch["network"], addr, ch, bal)
                    await check_sweep_alert(ch["network"], addr, ch, bal)
                    await set_address_health(ch["network"], addr, ch, balance=bal, balance_at=iso(now_utc()), balance_error=None)
                except Exception as e:
                    await set_address_health(ch["network"], addr, ch, balance_error=str(e)[:200])
                await asyncio.sleep(2)
        except Exception as e:
            logger.warning(f"balance refresher error: {e}")
        await asyncio.sleep(300)


# ---------------------------------------------------------------------------
# Auth / permission dependencies — moved to deps.py
# ---------------------------------------------------------------------------
from deps import (
    get_current_user, require_roles, perm_for_path, merchant_ids_for_scope,
    OPERATOR_PERMS, PERM_RULES, OPERATOR_FORBIDDEN,
)


# ---------------------------------------------------------------------------
# Models — request models extracted to models.py
# ---------------------------------------------------------------------------
from models import (
    LoginInput, AccountCreate, PermissionsUpdate, BalanceAdjust, ChannelCreate, ChannelUpdate,
    OrderCreate, ApiOrderCreate, ApiOrderQuery, DevTestOrder, NotifySettings, IpWhitelist,
)


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
LOCK_MAX_FAILS = 5
LOCK_MINUTES = 15


async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("locked_until") and datetime.fromisoformat(rec["locked_until"]) > now_utc():
        remain = int((datetime.fromisoformat(rec["locked_until"]) - now_utc()).total_seconds() // 60) + 1
        raise HTTPException(status_code=423, detail=f"失败次数过多，账号已临时锁定，请 {remain} 分钟后再试")


async def record_login_failure(identifier: str, email: str, ip: Optional[str]):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    window_start = now_utc() - timedelta(minutes=LOCK_MINUTES)
    count = 1
    if rec and rec.get("last_fail_at") and datetime.fromisoformat(rec["last_fail_at"]) > window_start:
        count = rec.get("count", 0) + 1
    upd = {"identifier": identifier, "email": email, "ip": ip, "count": count, "last_fail_at": iso(now_utc())}
    locked = count >= LOCK_MAX_FAILS
    if locked:
        upd["locked_until"] = iso(now_utc() + timedelta(minutes=LOCK_MINUTES))
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": upd}, upsert=True)
    from shared import ip_geo
    geo = await ip_geo(ip)
    await db.audit_logs.insert_one({
        "actor_id": None, "actor_email": email, "actor_role": "anonymous",
        "action": "auth.locked" if locked else "auth.login_failed", "target_type": "login", "target_id": email,
        "detail": {"fail_count": count, **({"locked_minutes": LOCK_MINUTES} if locked else {})},
        "ip": ip, **({"geo": geo} if geo else {}), "created_at": iso(now_utc()),
    })
    return locked


# ---------------------------------------------------------------------------
# Auth routes (login / logout / me / 2FA) moved to routes/auth.py
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Security policy
# ---------------------------------------------------------------------------
async def security_policy() -> dict:
    doc = await db.settings.find_one({"_id": "security"}) or {}
    doc.pop("_id", None)
    return {"enforce_admin_2fa": False, "enforce_operator_2fa": False, "enforce_operator_op_code": False, "login_alert": True, **doc}


# ---------------------------------------------------------------------------
# Step-up verification for sensitive operations (operation security code + TOTP)
# ---------------------------------------------------------------------------
OP_LOCK_MAX = 5
OP_LOCK_MINUTES = 15


async def _op_code_check_lock(user: dict):
    until = user.get("op_code_locked_until")
    if until:
        try:
            locked = datetime.fromisoformat(until) > now_utc()
        except Exception:
            locked = False
        if locked:
            raise HTTPException(status_code=423, detail="操作安全码错误次数过多，请稍后再试")


async def verify_step_up_dep(request: Request, x_op_code: Optional[str] = Header(None),
                             x_op_totp: Optional[str] = Header(None),
                             user: dict = Depends(get_current_user)):
    """Gate a sensitive operation behind the operation security code AND a fresh
    Google Authenticator TOTP. Each factor is only enforced if the user has
    configured it (lenient until set), converging to both-required once set up."""
    need_op = bool(user.get("op_code_hash"))
    need_totp = bool(user.get("totp_enabled"))
    if not need_op and not need_totp:
        return user

    def challenge(err=None):
        return HTTPException(status_code=428, detail={"step_up": True, "need_op_code": need_op,
                                                      "need_totp": need_totp, "error": err})
    if need_op:
        await _op_code_check_lock(user)
    oc = (x_op_code or "").strip()
    tc = (x_op_totp or "").strip().replace(" ", "")
    if (need_op and not oc) or (need_totp and not tc):
        raise challenge()
    if need_op and not verify_password(oc, user["op_code_hash"]):
        fails = int(user.get("op_code_fails", 0)) + 1
        upd = {"op_code_fails": fails}
        if fails >= OP_LOCK_MAX:
            upd = {"op_code_fails": 0, "op_code_locked_until": iso(now_utc() + timedelta(minutes=OP_LOCK_MINUTES))}
        await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
        raise challenge("操作安全码错误")
    if need_totp and not pyotp.TOTP(user.get("totp_secret") or "").verify(tc, valid_window=1):
        raise challenge("谷歌验证码错误")
    if need_op and user.get("op_code_fails"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"op_code_fails": 0}})
    request.state.step_up = {"op_code": need_op, "totp": need_totp}
    return user


@api_router.post("/admin/reset-test-data")
async def admin_reset_test_data(request: Request, user: dict = Depends(require_roles("admin")),
                                _su: dict = Depends(verify_step_up_dep)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    from reset_data import reset
    report = await reset(db)
    await db.audit_logs.insert_one({
        "actor_id": str(user["_id"]), "actor_email": user["email"], "actor_role": "admin",
        "action": "admin.reset_test_data", "target_type": "system", "target_id": "all",
        "detail": report, "ip": client_ip(request), "created_at": iso(now_utc()),
        "step_up": getattr(request.state, "step_up", None),
    })
    return {"ok": True, "report": report}


@api_router.get("/security/policy")
async def get_security_policy(user: dict = Depends(get_current_user)):
    pol = await security_policy()
    enforced = (user["role"] == "admin" and pol["enforce_admin_2fa"]) or (user["role"] == "operator" and pol["enforce_operator_2fa"])
    op_enforced = user["role"] == "operator" and pol["enforce_operator_op_code"] and not user.get("op_code_hash")
    return {**pol, "enforced_for_me": bool(enforced), "op_code_required_for_me": bool(op_enforced)}


@api_router.put("/security/policy")
async def put_security_policy(data: SecurityPolicy, request: Request, user: dict = Depends(require_roles("admin")),
                              _su: dict = Depends(verify_step_up_dep)):
    await db.settings.update_one({"_id": "security"}, {"$set": data.model_dump()}, upsert=True)
    await audit(user, "settings.security", "settings", "security", data.model_dump(), request)
    return {"ok": True, **data.model_dump()}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user), date: Optional[str] = None):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}

    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    if date:
        try:
            today_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    day_end = today_start + timedelta(days=1)
    all_orders = await db.orders.find(q).to_list(5000)

    total_volume = sum(o["amount_usdt"] for o in all_orders if o["status"] == "paid")
    today_volume = sum(o["amount_usdt"] for o in all_orders
                       if o["status"] == "paid" and today_start <= datetime.fromisoformat(o["created_at"]) < day_end)
    total_orders = len(all_orders)
    paid_orders = len([o for o in all_orders if o["status"] == "paid"])
    pending_orders = len([o for o in all_orders if o["status"] == "pending"])
    success_rate = round(paid_orders / total_orders * 100, 1) if total_orders else 0.0

    today_all = [o for o in all_orders if today_start <= datetime.fromisoformat(o["created_at"]) < day_end]
    today_orders = len(today_all)
    today_paid = len([o for o in today_all if o["status"] == "paid"])
    today_success_rate = round(today_paid / today_orders * 100, 1) if today_orders else 0.0

    if user["role"] == "admin":
        profit = sum(o.get("platform_profit", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "平台利润"
    elif user["role"] == "agent":
        profit = sum(o.get("agent_commission", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "分润收益"
    else:
        profit = sum(o.get("merchant_receive", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "实收金额"

    # 7-day trend
    trend = []
    for i in range(6, -1, -1):
        day = (today_start - timedelta(days=i))
        day_end = day + timedelta(days=1)
        vol = sum(o["amount_usdt"] for o in all_orders
                  if o["status"] == "paid" and day <= datetime.fromisoformat(o["created_at"]) < day_end)
        cnt = len([o for o in all_orders if day <= datetime.fromisoformat(o["created_at"]) < day_end])
        trend.append({"date": day.strftime("%m-%d"), "volume": round(vol, 2), "orders": cnt})

    active_channels = await db.channels.count_documents({"status": "active"})
    balance = round(user.get("balance", 0), 2)

    return {
        "total_volume": round(total_volume, 2),
        "today_volume": round(today_volume, 2),
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "success_rate": success_rate,
        "profit": round(profit, 2),
        "profit_label": profit_label,
        "active_channels": active_channels,
        "balance": balance,
        "trend": trend,
        "today_orders": today_orders,
        "today_paid": today_paid,
        "today_success_rate": today_success_rate,
        "stat_date": today_start.strftime("%Y-%m-%d"),
    }


def _date_window(date: Optional[str], start: Optional[str], end: Optional[str]):
    if start and end:
        try:
            ds = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            de = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        if de <= ds:
            raise HTTPException(status_code=400, detail="结束日期需不早于开始日期")
        return ds, de, f"{start} ~ {end}"
    ds = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    if date:
        try:
            ds = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    return ds, ds + timedelta(days=1), ds.strftime("%Y-%m-%d")


@api_router.get("/stats/merchants")
async def merchant_stats(date: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
                         user: dict = Depends(require_roles("admin"))):
    day_start, day_end, label = _date_window(date, start, end)
    merchants = await db.users.find({"role": "merchant"}).to_list(1000)
    orders = await db.orders.find({"created_at": {"$gte": iso(day_start), "$lt": iso(day_end)}}).to_list(100000)
    by_m: dict = {}
    for o in orders:
        s = by_m.setdefault(o["merchant_id"], {"orders": 0, "paid": 0, "volume": 0.0, "fee": 0.0, "receive": 0.0})
        s["orders"] += 1
        if o["status"] == "paid":
            s["paid"] += 1
            s["volume"] += o.get("amount_usdt", 0)
            s["fee"] += o.get("fee", 0)
            s["receive"] += o.get("merchant_receive", 0)
    result = []
    for mer in merchants:
        mid = str(mer["_id"])
        s = by_m.get(mid, {"orders": 0, "paid": 0, "volume": 0.0, "fee": 0.0, "receive": 0.0})
        result.append({
            "id": mid, "name": mer.get("name"), "email": mer.get("email"),
            "status": mer.get("status", "active"),
            "balance": round(mer.get("balance", 0), 2), "frozen_balance": round(mer.get("frozen_balance", 0), 2),
            "orders": s["orders"], "paid": s["paid"],
            "success_rate": round(s["paid"] / s["orders"] * 100, 1) if s["orders"] else 0.0,
            "volume": round(s["volume"], 2), "fee": round(s["fee"], 2), "receive": round(s["receive"], 2),
        })
    result.sort(key=lambda x: (x["volume"], x["paid"]), reverse=True)
    return {"date": label, "start": day_start.strftime("%Y-%m-%d"),
            "end": (day_end - timedelta(days=1)).strftime("%Y-%m-%d"),
            "count": len(result), "merchants": result}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Merchant Open API (api_key + HMAC signature)
# ---------------------------------------------------------------------------
def api_pay_url(order_no: str) -> str:
    return f"{os.environ.get('FRONTEND_URL', '')}/pay/{order_no}"


async def verify_api_request(body: dict, request: Request) -> dict:
    merchant = await db.users.find_one({"api_key": body.get("api_key"), "role": "merchant"})
    if not merchant:
        raise HTTPException(status_code=401, detail="api_key 无效")
    if merchant.get("status") == "frozen":
        raise HTTPException(status_code=403, detail="商户已被冻结")
    wl = merchant.get("ip_whitelist") or []
    ip = client_ip(request)
    if wl and ip not in wl:
        await db.audit_logs.insert_one({
            "actor_id": str(merchant["_id"]), "actor_email": merchant["email"], "actor_role": "merchant",
            "action": "api.ip_rejected", "target_type": "api", "target_id": body.get("api_key", ""),
            "detail": {"ip": ip}, "ip": ip, "created_at": iso(now_utc())})
        raise HTTPException(status_code=403, detail=f"来源 IP {ip} 不在白名单内")
    if abs(int(now_utc().timestamp()) - int(body.get("timestamp", 0))) > 300:
        raise HTTPException(status_code=401, detail="timestamp 已过期（允许 ±300 秒）")
    nonce = body.get("nonce", "")
    if not nonce or await db.api_nonces.find_one({"api_key": body["api_key"], "nonce": nonce}):
        raise HTTPException(status_code=401, detail="nonce 重复或缺失")
    expected = sign_payload(body, merchant.get("api_secret", ""))
    if not hmac.compare_digest(expected, str(body.get("sign", ""))):
        raise HTTPException(status_code=401, detail="签名错误")
    await db.api_nonces.insert_one({"api_key": body["api_key"], "nonce": nonce, "created_at": now_utc()})
    return merchant


def api_order_view(o: dict) -> dict:
    return {"order_no": o["order_no"], "out_trade_no": o.get("out_trade_no"), "amount_usdt": o["amount_usdt"],
            "pay_amount": o.get("pay_amount", o["amount_usdt"]), "network": o["network"],
            "wallet_address": o["wallet_address"], "status": o["status"], "tx_id": o.get("tx_id"),
            "paid_at": o.get("paid_at"), "expires_at": o["expires_at"], "pay_url": api_pay_url(o["order_no"])}


# ---------------------------------------------------------------------------
# Developer API console routes extracted to routes/dev.py (included at bottom)
# ---------------------------------------------------------------------------


DEFAULT_CHECKOUT_SETTINGS = {
    "energy_enabled": False, "energy_trx_address": "", "energy_price_text": "2TRX/笔（即每65500能量只需2TRX）",
    "energy_amounts": "2,4",
    "support_url": "", "tutorial_links": [], "energy_rules": [],
    "logo_url": "", "brand_subtitle": "USDT 安全收款", "brand_subtitle_tw": "USDT 安全收款", "brand_subtitle_en": "Secure USDT Payment",
    "theme_color": "#26A17B",
    "success_auto_redirect": False, "success_redirect_seconds": 5,
    "return_url_domains": "",
}


@api_router.get("/checkout/settings")
async def get_checkout_settings():
    doc = await db.settings.find_one({"_id": "checkout"}) or {}
    doc.pop("_id", None)
    return {**DEFAULT_CHECKOUT_SETTINGS, **doc}


@api_router.put("/checkout/settings")
async def put_checkout_settings(data: CheckoutSettings, request: Request, user: dict = Depends(require_roles("admin"))):
    addr = data.energy_trx_address.strip()
    if addr:
        validate_wallet("TRC20", addr)
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", data.theme_color or ""):
        raise HTTPException(status_code=400, detail="主题色需为 #RRGGBB 格式")
    doc = data.model_dump()
    doc["energy_trx_address"] = addr
    await db.settings.update_one({"_id": "checkout"}, {"$set": doc}, upsert=True)
    await audit(user, "settings.checkout", "settings", "checkout", doc, request)
    return doc


# ---------------------------------------------------------------------------
# Batch order operations (admin / operator)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Daily profit-sharing reconciliation (cron): snapshot + backfill + Telegram
# Profit-sharing stays real-time (settle_order). This only snapshots & safety-nets.
# ---------------------------------------------------------------------------
async def build_profit_snapshot(day: str) -> dict:
    start, end = f"{day}T00:00:00", f"{day}T23:59:59.999999"
    orders = await db.orders.find({"status": "paid", "paid_at": {"$gte": start, "$lte": end}}).to_list(100000)
    merchants: dict = {}
    tot = {"amount": 0.0, "fee": 0.0, "receive": 0.0, "commission": 0.0, "platform": 0.0}
    for o in orders:
        tot["amount"] += o.get("amount_usdt", 0); tot["fee"] += o.get("fee", 0)
        tot["receive"] += o.get("merchant_receive", 0); tot["commission"] += o.get("agent_commission", 0)
        tot["platform"] += o.get("platform_profit", 0)
        m = merchants.setdefault(o["merchant_id"], {"merchant_id": o["merchant_id"], "merchant_name": o.get("merchant_name", ""),
                                                     "orders": 0, "amount": 0.0, "fee": 0.0, "receive": 0.0, "commission": 0.0, "platform": 0.0})
        m["orders"] += 1; m["amount"] += o.get("amount_usdt", 0); m["fee"] += o.get("fee", 0)
        m["receive"] += o.get("merchant_receive", 0); m["commission"] += o.get("agent_commission", 0); m["platform"] += o.get("platform_profit", 0)
    return {
        "date": day, "order_count": len(orders),
        "total_amount": round(tot["amount"], 4), "total_fee": round(tot["fee"], 4),
        "total_merchant_receive": round(tot["receive"], 4), "total_agent_commission": round(tot["commission"], 4),
        "total_platform_profit": round(tot["platform"], 4),
        "merchants": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items()} for m in merchants.values()],
        "updated_at": iso(now_utc()),
    }


async def backfill_unsettled() -> int:
    count = 0
    async for o in db.orders.find({"status": "paid", "merchant_receive": None}):
        fee, mr, ac, pp = await settle_order(o)
        await db.orders.update_one({"_id": o["_id"]},
                                   {"$set": {"fee": fee, "merchant_receive": mr, "agent_commission": ac, "platform_profit": pp}})
        count += 1
    return count


def snapshot_report_text(snap: dict) -> str:
    bf = snap.get("backfilled") or 0
    return (f"📊 <b>日终分润对账</b> {snap.get('date')}\n"
            f"订单数：{snap['order_count']}\n收款总额：{snap['total_amount']} USDT\n"
            f"手续费：{snap['total_fee']} USDT\n商户实收：{snap['total_merchant_receive']} USDT\n"
            f"代理分润：{snap['total_agent_commission']} USDT\n平台利润：{snap['total_platform_profit']} USDT"
            + (f"\n⚠️ 补偿结算：{bf} 单" if bf else ""))


async def run_daily_settlement(run_id: str, day: str) -> dict:
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"skipped": True}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "daily-settle", "day": day, "started_at": iso(now_utc())})
    backfilled = await backfill_unsettled()
    snap = await build_profit_snapshot(day)
    snap["backfilled"] = backfilled
    prev_day = (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    prev = await db.profit_snapshots.find_one({"date": prev_day})
    pct = None
    if prev and prev.get("total_platform_profit"):
        pct = round((snap["total_platform_profit"] - prev["total_platform_profit"]) / prev["total_platform_profit"] * 100, 1)
    snap["platform_profit_change_pct"] = pct
    await db.profit_snapshots.update_one({"date": day}, {"$set": snap}, upsert=True)
    text = snapshot_report_text(snap)
    if pct is not None and abs(pct) >= 50:
        text += f"\n🚨 平台利润环比{'骤增' if pct > 0 else '骤降'} {abs(pct)}%（异常波动预警）"
    await send_telegram(text, "report")
    await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"finished_at": iso(now_utc())}})
    # cleanup expired export files (TTL)
    now_iso = iso(now_utc())
    async for ej in db.export_jobs.find({"expires_at": {"$lt": now_iso}, "file_id": {"$ne": None}}):
        try:
            await fs.delete(ObjectId(ej["file_id"]))
        except Exception:
            pass
        await db.export_jobs.delete_one({"_id": ej["_id"]})
    return snap


@api_router.post("/cron/daily-settle")
async def cron_daily_settle(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    run_id = request.headers.get("X-Webhook-Id") or (body or {}).get("run_id") or secrets.token_hex(8)
    day = (now_utc() - timedelta(days=1)).strftime("%Y-%m-%d")
    asyncio.create_task(run_daily_settlement(run_id, day))
    return {"ok": True, "accepted": True, "run_id": run_id, "date": day}


@api_router.get("/profit-snapshots")
async def list_profit_snapshots(user: dict = Depends(require_roles("admin")), limit: int = Query(90, le=365)):
    rows = await db.profit_snapshots.find().sort("date", -1).to_list(limit)
    return [serialize(r) for r in rows]


@api_router.post("/profit-snapshots/run")
async def run_profit_snapshot(request: Request, date: Optional[str] = None, user: dict = Depends(require_roles("admin"))):
    day = date or (now_utc() - timedelta(days=1)).strftime("%Y-%m-%d")
    if day > now_utc().strftime("%Y-%m-%d"):
        raise HTTPException(status_code=400, detail="不能为未来日期生成快照")
    snap = await run_daily_settlement("manual-" + secrets.token_hex(6), day)
    await audit(user, "settle.snapshot", "snapshot", day, {"order_count": snap.get("order_count")}, request)
    doc = await db.profit_snapshots.find_one({"date": day})
    return serialize(doc) if doc else {"date": day, "order_count": 0}


def _tx_explorer(network: str, txid: str) -> str:
    return f"https://tronscan.org/#/transaction/{txid}"


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------
@api_router.get("/callbacks")
async def list_callbacks(user: dict = Depends(get_current_user), status: Optional[str] = None,
                         limit: int = Query(200, le=1000)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    if status:
        q["status"] = status
    cbs = await db.callbacks.find(q).sort("created_at", -1).to_list(limit)
    return [serialize(c) for c in cbs]


@api_router.post("/callbacks/{callback_id}/retry")
async def retry_callback(callback_id: str, user: dict = Depends(get_current_user)):
    cb = await db.callbacks.find_one({"_id": ObjectId(callback_id)})
    if not cb:
        raise HTTPException(status_code=404, detail="回调记录不存在")
    scope = await merchant_ids_for_scope(user)
    if scope is not None and ObjectId(cb["merchant_id"]) not in scope:
        raise HTTPException(status_code=403, detail="无权限")
    await db.callbacks.update_one({"_id": cb["_id"]}, {"$set": {"status": "retrying", "next_at": iso(now_utc())}})
    cb = await db.callbacks.find_one({"_id": cb["_id"]})
    await deliver_callback(cb)
    cb = await db.callbacks.find_one({"_id": cb["_id"]})
    return serialize(cb)


@api_router.post("/callbacks/test-receiver")
async def callback_test_receiver(request: Request):
    body = await request.json()
    await db.callback_inbox.insert_one({"payload": body, "received_at": iso(now_utc())})
    return Response(content="success", media_type="text/plain")


@api_router.get("/callbacks/sign-preview")
async def callback_sign_preview(user: dict = Depends(require_roles("merchant"))):
    sample = {"order_no": "SF20260601120000", "amount_usdt": 100.0, "pay_amount": 100.0037,
              "network": "TRC20", "status": "paid", "tx_id": "a" * 64,
              "paid_at": iso(now_utc()), "remark": "", "timestamp": int(now_utc().timestamp())}
    sample["sign"] = sign_payload(sample, user.get("api_secret", ""))
    items = sorted((k, v) for k, v in sample.items() if k != "sign" and v is not None and v != "")
    return {"payload": sample, "sign_string": "&".join(f"{k}={canon(v)}" for k, v in items),
            "algorithm": "HMAC-SHA256(api_secret, sign_string) -> hex"}


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
@api_router.get("/audit-logs")
async def list_audit_logs(user: dict = Depends(require_roles("admin")), action: Optional[str] = None,
                          actor: Optional[str] = None, actor_id: Optional[str] = None, step_up: bool = False,
                          limit: int = Query(200, le=1000)):
    q: dict = {}
    if action:
        q["action"] = {"$regex": f"^{re.escape(action[:64])}", "$options": "i"}
    if actor:
        q["actor_email"] = {"$regex": re.escape(actor[:64]), "$options": "i"}
    if actor_id:
        q["actor_id"] = actor_id
    if step_up:
        q["step_up"] = {"$exists": True}
    logs = await db.audit_logs.find(q).sort("created_at", -1).to_list(limit)
    return [serialize(l) for l in logs]


@api_router.get("/operators")
async def list_operators(user: dict = Depends(require_roles("admin"))):
    ops = await db.users.find({"role": "operator"}).sort("created_at", -1).to_list(200)
    result = []
    for o in ops:
        oid = str(o["_id"])
        count = await db.audit_logs.count_documents({"actor_id": oid})
        last = await db.audit_logs.find({"actor_id": oid}).sort("created_at", -1).limit(1).to_list(1)
        result.append({
            "id": oid, "name": o["name"], "email": o["email"],
            "status": o.get("status", "active"), "permissions": o.get("permissions", []),
            "totp_enabled": bool(o.get("totp_enabled")), "totp_required": bool(o.get("totp_required")),
            "action_count": count, "last_action_at": last[0]["created_at"] if last else None,
        })
    return result


@api_router.get("/auth/lockouts")
async def list_lockouts(user: dict = Depends(require_roles("admin"))):
    recs = await db.login_attempts.find().sort("last_fail_at", -1).to_list(200)
    now = iso(now_utc())
    return [{**serialize(r), "locked": bool(r.get("locked_until") and r["locked_until"] > now)} for r in recs]


@api_router.delete("/auth/lockouts/{identifier:path}")
async def clear_lockout(identifier: str, request: Request, user: dict = Depends(require_roles("admin"))):
    await db.login_attempts.delete_one({"identifier": identifier})
    await audit(user, "auth.unlock", "login", identifier, {}, request)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Channels
# ---------------------------------------------------------------------------
@api_router.get("/channels")
async def list_channels(user: dict = Depends(get_current_user)):
    channels = await db.channels.find().sort("created_at", -1).to_list(200)
    return [await channel_view(c) for c in channels]


def validate_wallet(network: str, address: str):
    if not address:
        return
    if not (address.startswith("T") and len(address) == 34):
        raise HTTPException(status_code=400, detail="TRC20 地址格式不正确（T 开头 34 位）")


def normalize_addresses(network: str, addrs: Optional[List[str]], single: Optional[str]) -> List[str]:
    raw = list(addrs or []) + ([single] if single else [])
    out: List[str] = []
    for a in raw:
        a = (a or "").strip()
        if a and a not in out:
            validate_wallet(network, a)
            out.append(a)
    return out


async def channel_pending_counts(ch: dict) -> dict:
    addrs = channel_addresses(ch)
    if not addrs:
        return {}
    pipeline = [{"$match": {"status": "pending", "wallet_address": {"$in": addrs}}},
                {"$group": {"_id": "$wallet_address", "n": {"$sum": 1}}}]
    return {r["_id"]: r["n"] async for r in db.orders.aggregate(pipeline)}


async def channel_view(ch: dict) -> dict:
    v = serialize(ch)
    v["wallet_addresses"] = channel_addresses(ch)
    v["wallet_address"] = v["wallet_addresses"][0] if v["wallet_addresses"] else ""
    v["pending_by_address"] = await channel_pending_counts(ch)
    return v


@api_router.post("/channels")
async def create_channel(data: ChannelCreate, request: Request, user: dict = Depends(require_roles("admin"))):
    if data.network not in NETWORKS:
        raise HTTPException(status_code=400, detail="不支持的网络")
    addrs = normalize_addresses(data.network, data.wallet_addresses, data.wallet_address)
    doc = data.model_dump()
    doc["wallet_addresses"] = addrs
    doc["wallet_address"] = addrs[0] if addrs else ""
    doc["success_rate"] = round(random.uniform(95, 99.5), 1)
    doc["wallet_balance"] = round(random.uniform(10000, 80000), 2)
    doc["created_at"] = iso(now_utc())
    res = await db.channels.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(user, "channel.create", "channel", res.inserted_id,
                {"name": doc["name"], "network": doc["network"], "wallet_addresses": addrs}, request)
    return await channel_view(doc)


@api_router.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate, request: Request,
                         user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="无更新内容")
    old = await db.channels.find_one({"_id": ObjectId(channel_id)})
    if not old:
        raise HTTPException(status_code=404, detail="通道不存在")
    if "wallet_addresses" in upd or "wallet_address" in upd:
        addrs = normalize_addresses(old["network"], upd.pop("wallet_addresses", None), upd.pop("wallet_address", None))
        upd["wallet_addresses"] = addrs
        upd["wallet_address"] = addrs[0] if addrs else ""
    await db.channels.update_one({"_id": ObjectId(channel_id)}, {"$set": upd})
    c = await db.channels.find_one({"_id": ObjectId(channel_id)})
    await audit(user, "channel.update", "channel", channel_id,
                {"name": old["name"], "changes": upd, "before": {k: old.get(k) for k in upd}}, request)
    return await channel_view(c)


@api_router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    ch = await db.channels.find_one({"_id": ObjectId(channel_id)})
    if not ch:
        raise HTTPException(status_code=404, detail="通道不存在")
    pending = await channel_pending_counts(ch)
    total_pending = sum(pending.values())
    if total_pending > 0:
        raise HTTPException(status_code=409,
                            detail=f"该通道仍有 {total_pending} 笔待付款订单，无法删除；请等待订单完成/过期或迁移地址后再试")
    await db.channels.delete_one({"_id": ch["_id"]})
    await audit(user, "channel.delete", "channel", channel_id,
                {"name": ch.get("name"), "network": ch.get("network")}, request)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Accounts (merchants & agents)
# ---------------------------------------------------------------------------
@api_router.get("/accounts")
async def list_accounts(user: dict = Depends(get_current_user), role: Optional[str] = None):
    q: dict = {}
    if user["role"] == "admin":
        q["role"] = role if role else {"$in": ["agent", "merchant", "operator"]}
    elif user["role"] == "operator":
        q["role"] = role if role in ("agent", "merchant") else {"$in": ["agent", "merchant"]}
    elif user["role"] == "agent":
        q = {"role": "merchant", "parent_agent_id": str(user["_id"])}
    else:
        raise HTTPException(status_code=403, detail="无权限")
    accounts = await db.users.find(q).sort("created_at", -1).to_list(500)
    return [clean_user(a) for a in accounts]


@api_router.patch("/accounts/me/ip-whitelist")
async def update_my_ip_whitelist(data: IpWhitelist, request: Request, user: dict = Depends(require_roles("merchant"))):
    import ipaddress
    ips: List[str] = []
    for raw in data.ips:
        s = raw.strip()
        if not s:
            continue
        try:
            ipaddress.ip_address(s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"IP 格式不正确: {s}")
        if s not in ips:
            ips.append(s)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"ip_whitelist": ips}})
    await audit(user, "merchant.ip_whitelist", "user", user["_id"], {"ips": ips}, request)
    return {"ip_whitelist": ips, "your_ip": client_ip(request)}


@api_router.get("/accounts/me/ip")
async def my_ip(request: Request, user: dict = Depends(get_current_user)):
    return {"ip": client_ip(request)}


@api_router.patch("/accounts/me/notify")
async def update_my_notify(data: NotifySettings, request: Request, user: dict = Depends(require_roles("merchant"))):
    url = (data.notify_url or "").strip()
    if url and not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="回调地址必须以 http:// 或 https:// 开头")
    if url and is_private_host(urlparse(url).hostname or ""):
        raise HTTPException(status_code=400, detail="回调地址不能指向内网或本机地址")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"notify_url": url}})
    await audit(user, "merchant.notify_url", "user", user["_id"], {"notify_url": url}, request)
    return {"notify_url": url}


@api_router.post("/accounts")
async def create_account(data: AccountCreate, request: Request, user: dict = Depends(require_roles("admin", "agent")),
                         _su: dict = Depends(verify_step_up_dep)):
    if data.role not in ["agent", "merchant", "operator"]:
        raise HTTPException(status_code=400, detail="角色不合法")
    if user["role"] == "agent" and data.role != "merchant":
        raise HTTPException(status_code=403, detail="代理只能创建商户")
    if data.role == "operator":
        bad = [p for p in (data.permissions or []) if p not in OPERATOR_PERMS]
        if bad:
            raise HTTPException(status_code=400, detail=f"未知权限: {bad}")
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="邮箱已存在")

    parent = data.parent_agent_id
    if user["role"] == "agent":
        parent = str(user["_id"])

    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "rate": data.rate,
        "parent_agent_id": parent,
        "balance": 0.0,
        "frozen_balance": 0.0,
        "status": "active",
        "created_at": iso(now_utc()),
    }
    if data.role == "merchant":
        doc["api_key"] = gen_api_key()
        doc["api_secret"] = gen_api_secret()
    if data.role == "operator":
        doc["permissions"] = data.permissions or []
        doc["rate"] = 0
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(user, "account.create", "user", res.inserted_id,
                {"email": email, "role": data.role, "name": data.name, "rate": data.rate, "permissions": doc.get("permissions")}, request)
    return clean_user(doc)


@api_router.get("/accounts/permissions")
async def list_permissions(user: dict = Depends(require_roles("admin"))):
    return OPERATOR_PERMS


@api_router.patch("/accounts/{account_id}/permissions")
async def update_permissions(account_id: str, data: PermissionsUpdate, request: Request, user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id), "role": "operator"})
    if not acc:
        raise HTTPException(status_code=404, detail="操作员不存在")
    bad = [p for p in data.permissions if p not in OPERATOR_PERMS]
    if bad:
        raise HTTPException(status_code=400, detail=f"未知权限: {bad}")
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"permissions": data.permissions}})
    await audit(user, "account.permissions", "user", account_id, {"target_email": acc["email"], "permissions": data.permissions}, request)
    return {"permissions": data.permissions}


@api_router.get("/accounts/{account_id}")
async def get_account(account_id: str, user: dict = Depends(get_current_user)):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    if user["role"] == "agent" and acc.get("parent_agent_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="无权限")
    if user["role"] == "merchant" and acc["_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="无权限")
    return clean_user(acc)


@api_router.post("/accounts/{account_id}/adjust")
async def adjust_balance(account_id: str, data: BalanceAdjust, request: Request,
                         user: dict = Depends(require_roles("admin")), _su: dict = Depends(verify_step_up_dep)):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    amt = round(data.amount, 4)
    if data.action == "credit":
        await db.users.update_one({"_id": acc["_id"]}, {"$inc": {"balance": amt}})
    elif data.action == "debit":
        await db.users.update_one({"_id": acc["_id"]}, {"$inc": {"balance": -amt}})
    elif data.action == "freeze":
        await db.users.update_one({"_id": acc["_id"]},
                                  {"$inc": {"balance": -amt, "frozen_balance": amt}})
    elif data.action == "unfreeze":
        await db.users.update_one({"_id": acc["_id"]},
                                  {"$inc": {"balance": amt, "frozen_balance": -amt}})
    else:
        raise HTTPException(status_code=400, detail="非法操作")
    await db.balance_logs.insert_one({
        "account_id": account_id, "action": data.action, "amount": amt,
        "remark": data.remark, "operator": user["email"], "created_at": iso(now_utc()),
    })
    updated = await db.users.find_one({"_id": acc["_id"]})
    _cat = {"credit": "adjust_credit", "debit": "adjust_debit", "freeze": "adjust_freeze", "unfreeze": "adjust_unfreeze"}[data.action]
    _delta = {"credit": amt, "debit": -amt, "freeze": -amt, "unfreeze": amt}[data.action]
    await record_ledger(account_id, _cat, _delta, updated.get("balance", 0), updated.get("frozen_balance", 0),
                        "adjust", None, remark=data.remark or "", operator=user["email"])
    await audit(user, f"balance.{data.action}", "user", account_id,
                {"target_email": acc["email"], "amount": amt, "remark": data.remark,
                 "balance_before": round(acc.get("balance", 0), 4), "balance_after": round(updated.get("balance", 0), 4)}, request)
    return clean_user(updated)


@api_router.post("/accounts/{account_id}/toggle-status")
async def toggle_status(account_id: str, request: Request, user: dict = Depends(require_roles("admin")),
                        _su: dict = Depends(verify_step_up_dep)):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    new_status = "frozen" if acc.get("status") == "active" else "active"
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"status": new_status}})
    await audit(user, "account.freeze" if new_status == "frozen" else "account.unfreeze", "user", account_id,
                {"target_email": acc["email"]}, request)
    return {"status": new_status}


@api_router.post("/accounts/{account_id}/reset-api-key")
async def reset_api_key(account_id: str, request: Request, user: dict = Depends(require_roles("admin", "agent")),
                        _su: dict = Depends(verify_step_up_dep)):
    acc = await db.users.find_one({"_id": ObjectId(account_id), "role": "merchant"})
    if not acc:
        raise HTTPException(status_code=404, detail="商户不存在")
    if user["role"] == "agent" and acc.get("parent_agent_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="无权限")
    key, sec = gen_api_key(), gen_api_secret()
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"api_key": key, "api_secret": sec}})
    await audit(user, "account.reset_api_key", "user", account_id, {"target_email": acc["email"]}, request)
    return {"api_key": key, "api_secret": sec}


@api_router.get("/accounts/{account_id}/credentials")
async def reveal_credentials(account_id: str, request: Request, user: dict = Depends(require_roles("admin", "agent")),
                             _su: dict = Depends(verify_step_up_dep)):
    acc = await db.users.find_one({"_id": ObjectId(account_id), "role": "merchant"})
    if not acc:
        raise HTTPException(status_code=404, detail="商户不存在")
    if user["role"] == "agent" and acc.get("parent_agent_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="无权限")
    await audit(user, "account.reveal_secret", "user", account_id, {"target_email": acc["email"]}, request)
    return {"api_key": acc.get("api_key", ""), "api_secret": acc.get("api_secret", "")}


@api_router.post("/accounts/{account_id}/require-2fa")
async def set_require_2fa(account_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    if acc["role"] not in ("admin", "operator"):
        raise HTTPException(status_code=400, detail="仅管理员/操作员账户支持强制两步验证")
    new_val = not acc.get("totp_required")
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"totp_required": new_val}})
    await audit(user, "account.require_2fa" if new_val else "account.unrequire_2fa", "user", account_id,
                {"target_email": acc["email"], "required": new_val}, request)
    return {"totp_required": new_val}


@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, request: Request, user: dict = Depends(require_roles("admin")),
                         _su: dict = Depends(verify_step_up_dep)):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    if acc["role"] not in ("operator", "merchant"):
        raise HTTPException(status_code=400, detail="仅可删除操作员或商户账户")
    if str(acc["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail="不能删除自己的账户")
    if acc["role"] == "merchant":
        if round(acc.get("balance", 0), 2) != 0 or round(acc.get("frozen_balance", 0), 2) != 0:
            raise HTTPException(status_code=409, detail="商户仍有可用/冻结余额，无法删除；请先结清余额")
        active_orders = await db.orders.count_documents(
            {"merchant_id": str(acc["_id"]), "status": {"$in": ["pending", "confirming"]}})
        if active_orders:
            raise HTTPException(status_code=409, detail=f"商户仍有 {active_orders} 笔进行中订单，无法删除")
        pending_payouts = await db.payouts.count_documents({"merchant_id": str(acc["_id"]), "status": "pending"})
        if pending_payouts:
            raise HTTPException(status_code=409, detail=f"商户仍有 {pending_payouts} 笔待处理提现，无法删除")
    await db.users.delete_one({"_id": acc["_id"]})
    await audit(user, "account.delete", "user", account_id,
                {"target_email": acc["email"], "role": acc["role"], "name": acc.get("name")}, request)
    return {"ok": True}


@api_router.post("/accounts/cleanup-test-merchants")
async def cleanup_test_merchants(request: Request, user: dict = Depends(require_roles("admin"))):
    """One-click removal of leftover demo/test merchants (test_*@test.com,
    *@citest.com, or name TEST_M). Accounts with in-flight orders or pending
    payouts are skipped. Real demo merchants (@demo.com) are never matched."""
    q = {"role": "merchant", "$or": [
        {"email": {"$regex": r"^test_.*@test\.com$", "$options": "i"}},
        {"email": {"$regex": r"@citest\.com$", "$options": "i"}},
        {"name": "TEST_M"},
    ]}
    cands = await db.users.find(q).to_list(2000)
    removed, skipped = [], []
    for m in cands:
        mid = str(m["_id"])
        active = await db.orders.count_documents({"merchant_id": mid, "status": {"$in": ["pending", "confirming"]}})
        pend_po = await db.payouts.count_documents({"merchant_id": mid, "status": "pending"})
        if active or pend_po:
            skipped.append({"email": m["email"], "reason": f"进行中订单 {active} / 待处理提现 {pend_po}"})
            continue
        await db.users.delete_one({"_id": m["_id"]})
        removed.append(m["email"])
    await audit(user, "accounts.cleanup_test", "user", "batch",
                {"removed": len(removed), "skipped": len(skipped)}, request)
    return {"ok": True, "removed_count": len(removed), "skipped_count": len(skipped),
            "removed": removed, "skipped": skipped}


# ---------------------------------------------------------------------------
# Settlements / reconciliation
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Reports (xlsx)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Balance ledger (merchant / agent running statement)
# ---------------------------------------------------------------------------
async def resolve_ledger_account(user: dict, account_id: Optional[str]) -> ObjectId:
    if user["role"] == "merchant":
        return user["_id"]
    if user["role"] == "agent":
        if not account_id:
            return user["_id"]
        acc = await db.users.find_one({"_id": ObjectId(account_id)})
        if not acc or (acc["_id"] != user["_id"] and acc.get("parent_agent_id") != str(user["_id"])):
            raise HTTPException(status_code=403, detail="无权限查看该账户")
        return acc["_id"]
    # admin / operator
    if not account_id:
        raise HTTPException(status_code=400, detail="请选择账户")
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    return acc["_id"]


@api_router.get("/balance/ledger")
async def balance_ledger(account_id: Optional[str] = None, category: Optional[str] = None,
                         month: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
                         limit: int = Query(300, le=2000),
                         user: dict = Depends(get_current_user)):
    acc_id = await resolve_ledger_account(user, account_id)
    q: dict = {"account_id": str(acc_id)}
    if category:
        q["category"] = category
    if start and end:
        try:
            ds = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            de = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        q["created_at"] = {"$gte": iso(ds), "$lt": iso(de)}
    elif month:
        try:
            ms = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="month 格式应为 YYYY-MM")
        me = (ms.replace(year=ms.year + 1, month=1) if ms.month == 12 else ms.replace(month=ms.month + 1))
        q["created_at"] = {"$gte": iso(ms), "$lt": iso(me)}
    rows = await db.balance_ledger.find(q).sort("created_at", -1).to_list(limit)
    acc = await db.users.find_one({"_id": acc_id})
    return {
        "account": {"id": str(acc_id), "name": acc.get("name"), "email": acc.get("email"),
                    "role": acc.get("role"), "balance": acc.get("balance", 0),
                    "frozen_balance": acc.get("frozen_balance", 0)},
        "entries": [serialize(r) for r in rows],
    }


LEDGER_CAT_LABELS = {
    "order_credit": "收款入账", "commission": "代理分润", "payout_freeze": "提现冻结",
    "payout_done": "提现完成", "payout_reject": "提现驳回退回", "adjust_credit": "人工加款",
    "adjust_debit": "人工扣款", "adjust_freeze": "冻结", "adjust_unfreeze": "解冻",
}


ORDER_STATUS_LABELS = {"pending": "待支付", "confirming": "确认中", "paid": "已支付", "expired": "超时未付", "rejected": "已驳回"}


EXPORT_KINDS = {"orders", "snapshots", "ledger"}
LEDGER_CAT = {
    "order_credit": "收款入账", "commission": "代理分润", "payout_freeze": "提现冻结", "payout_done": "提现完成",
    "payout_reject": "提现驳回退回", "adjust_credit": "人工加款", "adjust_debit": "人工扣款",
    "adjust_freeze": "冻结", "adjust_unfreeze": "解冻",
}


# ---------------------------------------------------------------------------
# Background export jobs (large exports -> async job + download link)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Scheduled automated exports (admin-configured, run by platform cron)
# ---------------------------------------------------------------------------


@api_router.get("/profit-snapshots/trend")
async def profit_trend(days: int = Query(30, ge=7, le=90), merchant_id: Optional[str] = None,
                       user: dict = Depends(require_roles("admin"))):
    today = now_utc()
    start_day = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    q: dict = {"status": "paid", "paid_at": {"$gte": start_day + "T00:00:00"}}
    if merchant_id:
        q["merchant_id"] = merchant_id
    buckets: dict = {}
    async for o in db.orders.find(q):
        d = (o.get("paid_at") or "")[:10]
        if not d:
            continue
        b = buckets.setdefault(d, {"platform": 0.0, "commission": 0.0, "amount": 0.0, "orders": 0})
        b["platform"] += o.get("platform_profit", 0); b["commission"] += o.get("agent_commission", 0)
        b["amount"] += o.get("amount_usdt", 0); b["orders"] += 1
    out = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        b = buckets.get(d, {"platform": 0, "commission": 0, "amount": 0, "orders": 0})
        out.append({"date": d, "platform_profit": round(b["platform"], 2),
                    "agent_commission": round(b["commission"], 2), "amount": round(b["amount"], 2), "orders": b["orders"]})
    return out


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.chain_txs.create_index("tx_id", unique=True)
    await db.audit_logs.create_index([("created_at", -1)])
    await db.callbacks.create_index([("status", 1), ("next_at", 1)])
    await db.login_attempts.create_index("identifier")
    await db.api_nonces.create_index("created_at", expireAfterSeconds=600)
    await db.api_nonces.create_index([("api_key", 1), ("nonce", 1)])
    await db.orders.create_index([("status", 1), ("wallet_address", 1), ("pay_amount", 1)])
    await db.orders.create_index([("wallet_address", 1), ("pay_amount", 1)], name="uniq_pending_pay_amount", unique=True,
                                 partialFilterExpression={"status": "pending", "live": True})
    await db.orders.create_index([("merchant_id", 1), ("out_trade_no", 1)])
    await db.orders.create_index("order_no")
    await db.orders.create_index([("status", 1), ("expires_at", 1)])
    await db.orders.create_index([("merchant_id", 1), ("created_at", -1)])
    await db.orders.create_index([("created_at", -1)])
    await db.alerts.create_index([("read", 1), ("created_at", -1)])
    await db.balance_ledger.create_index([("account_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("actor_id", 1), ("created_at", -1)])
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = await db.users.find_one({"email": admin_email})
    if admin is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "平台管理员", "role": "admin", "balance": 0.0,
            "frozen_balance": 0.0, "status": "active", "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, admin["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.channels.count_documents({}) == 0:
        base = [
            {"name": "TRC20 极速通道", "network": "TRC20", "fee_rate": 0.02, "weight": 50,
             "min_amount": 10, "max_amount": 50000, "status": "active"},
        ]
        for c in base:
            c["success_rate"] = round(random.uniform(96, 99.5), 1)
            c["wallet_balance"] = round(random.uniform(20000, 90000), 2)
            c["created_at"] = iso(now_utc())
        await db.channels.insert_many(base)

    # demo agent + merchants + fake orders (only when SEED_DEMO_DATA=true)
    if os.environ.get("SEED_DEMO_DATA", "false").lower() == "true" and await db.users.count_documents({"role": "agent"}) == 0:
        agent_res = await db.users.insert_one({
            "email": "agent@demo.com", "password_hash": hash_password("agent888"),
            "name": "华东一级代理", "role": "agent", "rate": 0.015,
            "parent_agent_id": None, "balance": 0.0, "frozen_balance": 0.0,
            "status": "active", "created_at": iso(now_utc()),
        })
        agent_id = str(agent_res.inserted_id)
        merchants = [
            {"email": "merchant@demo.com", "name": "星辰科技", "rate": 0.03, "parent": agent_id},
            {"email": "shop2@demo.com", "name": "云端商城", "rate": 0.028, "parent": agent_id},
            {"email": "shop3@demo.com", "name": "极光支付", "rate": 0.035, "parent": None},
        ]
        m_ids = []
        for m in merchants:
            r = await db.users.insert_one({
                "email": m["email"], "password_hash": hash_password("merchant888"),
                "name": m["name"], "role": "merchant", "rate": m["rate"],
                "parent_agent_id": m["parent"], "balance": 0.0, "frozen_balance": 0.0,
                "status": "active", "api_key": gen_api_key(), "api_secret": gen_api_secret(),
                "created_at": iso(now_utc()),
            })
            m_ids.append((str(r.inserted_id), m["name"]))

        # demo orders across last 7 days
        channels = await db.channels.find({"status": "active"}).to_list(10)
        for _ in range(120):
            mid, mname = random.choice(m_ids)
            ch = random.choice(channels)
            amount = round(random.uniform(50, 3000), 2)
            created = now_utc() - timedelta(days=random.randint(0, 6),
                                            hours=random.randint(0, 23),
                                            minutes=random.randint(0, 59))
            paid = random.random() < 0.8
            order = {
                "order_no": gen_order_no(), "merchant_id": mid, "merchant_name": mname,
                "amount_usdt": amount, "network": ch["network"],
                "wallet_address": gen_wallet_address(ch["network"]), "tx_id": None,
                "status": "pending", "channel_id": str(ch["_id"]), "channel_name": ch["name"],
                "remark": "", "created_at": iso(created), "paid_at": None,
                "expires_at": iso(created + timedelta(minutes=15)),
            }
            res = await db.orders.insert_one(order)
            order["_id"] = res.inserted_id
            if paid:
                await mark_paid(order, notify=False)
            elif random.random() < 0.5:
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "expired"}})
    # one-time backfill of balance ledger from existing paid orders
    if await db.balance_ledger.count_documents({}) == 0 and await db.orders.count_documents({"status": "paid"}) > 0:
        merchants = await db.users.find({"role": "merchant"}).to_list(1000)
        m_agent = {str(m["_id"]): m.get("parent_agent_id") for m in merchants}
        paid = await db.orders.find({"status": "paid"}).sort("paid_at", 1).to_list(100000)
        running: dict = {}
        for o in paid:
            ts = o.get("paid_at") or o.get("created_at") or iso(now_utc())
            mid = o["merchant_id"]
            net = round(o.get("merchant_receive", 0), 4)
            running[mid] = round(running.get(mid, 0.0) + net, 4)
            await db.balance_ledger.insert_one({
                "account_id": str(mid), "category": "order_credit", "amount": net,
                "balance_after": running[mid], "frozen_after": 0.0, "ref_type": "order",
                "ref_id": o.get("order_no"), "remark": f"{o.get('network', '')} 收款 {o.get('amount_usdt')} USDT，手续费 {o.get('fee', 0)}",
                "operator": None, "created_at": ts,
            })
            comm = round(o.get("agent_commission", 0), 4)
            aid = m_agent.get(str(mid))
            if comm > 0 and aid:
                running[aid] = round(running.get(aid, 0.0) + comm, 4)
                await db.balance_ledger.insert_one({
                    "account_id": str(aid), "category": "commission", "amount": comm,
                    "balance_after": running[aid], "frozen_after": 0.0, "ref_type": "order",
                    "ref_id": o.get("order_no"), "remark": f"订单 {o.get('order_no')} 代理分润",
                    "operator": None, "created_at": ts,
                })

    logger.info("Seed complete.")


@app.on_event("startup")
async def on_startup():
    await seed()
    asyncio.create_task(chain_listener())
    asyncio.create_task(callback_worker())
    asyncio.create_task(balance_refresher())


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api_router)

# Extracted domain routers (late import avoids circular dependency with server defs)
from routes.dev import router as dev_router  # noqa: E402
app.include_router(dev_router)
from routes.auth import router as auth_router  # noqa: E402
app.include_router(auth_router)
from routes.orders import router as orders_router  # noqa: E402
app.include_router(orders_router)
from routes.settlements import router as settlements_router  # noqa: E402
app.include_router(settlements_router)
from routes.notify import router as notify_router  # noqa: E402
app.include_router(notify_router)
from routes.alerts import router as alerts_router  # noqa: E402
app.include_router(alerts_router)
from routes.chain import router as chain_router  # noqa: E402
app.include_router(chain_router)
from routes.reports import router as reports_router  # noqa: E402
app.include_router(reports_router)
from routes.support import router as support_router  # noqa: E402
app.include_router(support_router)


RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "300"))
RATE_LIMIT_WINDOW = 60
_rl_bucket: dict = {}


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    ip = client_ip(request) or "unknown"
    path = request.url.path
    if path.startswith("/api") and request.method != "OPTIONS":
        now = now_utc().timestamp()
        bucket = _rl_bucket.get(ip)
        if not bucket or now - bucket["start"] >= RATE_LIMIT_WINDOW:
            _rl_bucket[ip] = {"start": now, "count": 1}
        else:
            bucket["count"] += 1
            if bucket["count"] > RATE_LIMIT_MAX:
                return JSONResponse(status_code=429, content={"detail": "请求过于频繁，请稍后再试"})
        if len(_rl_bucket) > 5000:
            cutoff = now - RATE_LIMIT_WINDOW
            for k in [k for k, v in _rl_bucket.items() if v["start"] < cutoff]:
                _rl_bucket.pop(k, None)
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["X-XSS-Protection"] = "1; mode=block"
    resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return resp


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)
