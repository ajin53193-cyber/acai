"""IP → 地區（國家/省/市）解析，結果緩存於 db.ip_geo；用戶訪問時節流記錄最後 IP。"""
import asyncio
import ipaddress
import logging
import time

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)
_db = None
_last: dict = {}  # user_id -> (ip, ts)
TOUCH_INTERVAL = 600


def init(db):
    global _db
    _db = db


def client_ip(request: Request) -> str:
    """Proxy-set headers first (Cloudflare / Nginx overwrite these); the client-forgeable first XFF entry is never used."""
    for h in ("cf-connecting-ip", "x-real-ip"):
        v = (request.headers.get(h) or "").strip()
        if v:
            return v
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else ""


def _header_country(request: Request) -> str:
    for h in ("cf-ipcountry", "x-geo-country", "x-country-code"):
        v = (request.headers.get(h) or "").strip().upper()
        if v and v not in ("XX", "T1", "ZZ"):
            return v
    return ""


async def lookup(ip: str, fallback: str = "") -> str:
    if not ip:
        return ""
    try:
        if ipaddress.ip_address(ip).is_private or ipaddress.ip_address(ip).is_loopback:
            return "內網"
    except ValueError:
        return ""
    cached = await _db.ip_geo.find_one({"ip": ip}, {"_id": 0, "region": 1})
    if cached and cached.get("region"):
        return cached["region"]
    region = ""
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"http://ip-api.com/json/{ip}", params={"lang": "zh-CN", "fields": "status,country,regionName,city"})
            d = r.json()
        if d.get("status") == "success":
            parts = [d.get("country", ""), d.get("regionName", ""), d.get("city", "")]
            seen, out = set(), []
            for p in parts:
                if p and p not in seen:
                    seen.add(p)
                    out.append(p)
            region = " ".join(out)
    except Exception as e:
        logger.warning("ipgeo lookup failed %s: %s", ip, e)
    region = region or fallback
    if region:
        await _db.ip_geo.update_one({"ip": ip}, {"$set": {"ip": ip, "region": region, "at": time.time()}}, upsert=True)
    return region


async def _touch(uid: str, ip: str, fallback: str):
    try:
        region = await lookup(ip, fallback)
        from datetime import datetime, timezone
        upd = {"last_ip": ip, "last_ip_region": region, "last_seen_at": datetime.now(timezone.utc).isoformat()}
        await _db.users.update_one({"user_id": uid}, {"$set": upd})
        await _db.users.update_one({"user_id": uid, "register_ip": {"$exists": False}}, {"$set": {"register_ip": ip, "register_ip_region": region}})
    except Exception as e:
        logger.warning("ipgeo touch failed: %s", e)


def touch(uid: str, request: Request):
    ip = client_ip(request)
    if not ip:
        return
    prev = _last.get(uid)
    now = time.time()
    if prev and prev[0] == ip and now - prev[1] < TOUCH_INTERVAL:
        return
    _last[uid] = (ip, now)
    asyncio.create_task(_touch(uid, ip, _header_country(request)))
