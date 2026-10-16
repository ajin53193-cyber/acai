"""Auto reviews: historical seeding, daily auto 5-star additions (gift card), 3-day auto review for completed orders, user order reviews."""
import asyncio
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import admin_api
from clerk_auth import require_user

db = None
upload_b64 = None
router = APIRouter(prefix="/api")

HKT = timezone(timedelta(hours=8))
KEY = "review_auto"
DEFAULTS = {"enabled": True, "daily_min": 30, "daily_max": 100, "product_id": "", "seed_total": 1849, "seed_from": "2025-01-01",
            "auto_after_days": 3, "last_daily_date": "", "today_plan": [], "today_done": 0,
            "other_enabled": True, "other_pct": 30, "other_min": 1, "other_max": 2, "other_text_pct": 50, "other_date": "", "other_plan": [], "other_done": 0}

AREAS = [("香港", "HK", "zh-TW", 852, 8, 34), ("澳門", "MO", "zh-TW", 853, 8, 6), ("中國台灣", "TW", "zh-TW", 886, 9, 20),
         ("中國", "CN", "zh-CN", 86, 11, 18), ("馬來西亞", "MY", "en", 60, 9, 12), ("新加坡", "SG", "en", 65, 8, 10)]
DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.hk", "yahoo.com.tw", "icloud.com", "qq.com", "163.com", "live.hk"]
TEXTS = {
    "zh-TW": ["到帳好快，讚！", "第二次購買了，一樣順利", "幾分鐘就收到交易號，方便", "客服回覆很快，推薦", "價格比門市划算，會再買", "操作簡單，長輩都會用", "轉贈成功，朋友很開心", "穩定可靠，已回購多次", "付款後很快完成，好評", "很好用，下次還會再來", "一直都在這裡買，從沒出過問題", "速度快服務好，五星"],
    "zh-CN": ["到账很快，好评！", "已经买过好几次了，一直很稳", "几分钟就搞定，方便", "客服态度好，回复快", "比线下便宜，划算", "流程简单，推荐", "转赠成功，朋友很满意", "靠谱，回购中", "付款后秒到，赞", "好用，下次还来"],
    "en": ["Fast delivery, thanks!", "Received within minutes, great service", "Second time buying, smooth as always", "Good price and quick support", "Easy to use, highly recommended", "Worked perfectly, will buy again", "Reliable seller, 5 stars", "Quick and hassle-free"],
}
TEXTS_GENERIC = {
    "zh-TW": ["充值秒到，讚！", "到帳很快，價格也划算", "第二次買了，一樣順利", "客服回覆很快，推薦", "比官方便宜不少，會再回購", "操作簡單，幾分鐘搞定", "一直在這裡充，從沒出過問題", "速度快服務好，五星", "付款後很快到帳，好評", "很好用，下次還會再來", "朋友推薦來的，果然靠譜", "匯率實惠，到帳及時"],
    "zh-CN": ["充值秒到，好评！", "到账很快，价格也划算", "已经买过好几次了，一直很稳", "客服态度好，回复快", "比官方便宜，省了不少", "流程简单，几分钟搞定", "靠谱，回购中", "付款后秒到，赞", "好用，下次还来", "朋友推荐的，确实不错", "汇率合适，到账及时"],
    "en": ["Top-up arrived within minutes, thanks!", "Fast and reliable, great price", "Second time buying, smooth as always", "Quick support, highly recommended", "Cheaper than official, will buy again", "Easy process, worked perfectly", "Reliable seller, 5 stars", "Quick and hassle-free", "Good rate and instant delivery"],
}
LETTERS = "abcdefghijklmnopqrstuvwxyz"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_cfg() -> dict:
    doc = await db.settings.find_one({"key": KEY}, {"_id": 0})
    cfg = {**DEFAULTS, **((doc or {}).get("value") or {})}
    if not cfg["product_id"]:
        p = await db.products.find_one({"is_giftcard": True, "name": {"$regex": "新地"}}, {"_id": 0, "id": 1}) or await db.products.find_one({"is_giftcard": True}, {"_id": 0, "id": 1})
        cfg["product_id"] = (p or {}).get("id", "")
    return cfg


async def save_cfg(cfg: dict):
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "value": cfg}}, upsert=True)


def mask_email(email: str) -> str:
    local, _, dom = (email or "").partition("@")
    if not dom:
        return email
    return f"{local[0]}****{local[-1]}@{dom}" if len(local) > 1 else f"{local}****@{dom}"


def mask_phone(phone: str, cc: Optional[int] = None) -> str:
    d = re.sub(r"\D", "", phone or "")
    if not d:
        return ""
    if cc is None:
        for _, _, _, c, n, _ in AREAS:
            if d.startswith(str(c)) and len(d) == len(str(c)) + n:
                cc = c
                break
    body = d[len(str(cc)):] if cc and d.startswith(str(cc)) else d
    masked = body[0] + "*" * max(1, len(body) - 4) + body[-3:] if len(body) > 4 else body[0] + "***"
    return f"{cc} {masked}" if cc else masked


def fake_author(cc: int, ndigits: int) -> str:
    if random.random() < 0.6:
        local = "".join(random.choice(LETTERS) for _ in range(random.randint(4, 9))) + (str(random.randint(1, 999)) if random.random() < 0.6 else "")
        return mask_email(f"{local}@{random.choice(DOMAINS)}")
    first = random.choice({852: "569", 853: "6", 886: "9", 86: "1", 60: "1", 65: "89"}[cc])
    return mask_phone(str(cc) + first + "".join(random.choice("0123456789") for _ in range(ndigits - 1)), cc)


def gen_review(product_id: str, at: datetime, text_pct: float = 25, texts: dict = TEXTS) -> dict:
    area, country, lang, cc, nd, _ = random.choices(AREAS, weights=[a[5] for a in AREAS])[0]
    if lang == "en" and random.random() < 0.4:
        lang = "zh-CN"
    content = random.choice(texts[lang]) if random.random() * 100 < text_pct else ""
    return {"id": uuid.uuid4().hex, "product_id": product_id, "author": fake_author(cc, nd), "rating": 5 if random.random() < 0.94 else 4, "content": content,
            "images": [], "visible": True, "reply": "", "area": area, "country": country, "lang": lang,
            "buy_count": random.choices([1, 2, 3, 5], weights=[70, 18, 8, 4])[0], "auto": True, "created_at": at.astimezone(timezone.utc).isoformat()}


def _rand_time_on(day: datetime) -> datetime:
    secs = int(random.triangular(8 * 3600, 23.5 * 3600, 20 * 3600))
    return day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(seconds=secs)


# ----------------------------- seeding -----------------------------
async def seed_history(cfg: dict, force: bool = False) -> int:
    pid = cfg["product_id"]
    if not pid:
        raise HTTPException(status_code=400, detail="未找到禮品卡商品")
    have = await db.reviews.count_documents({"product_id": pid, "seed": True})
    if have >= int(cfg["seed_total"]) and not force:
        raise HTTPException(status_code=409, detail=f"已補齊 {have} 筆歷史好評")
    if force:
        await db.reviews.delete_many({"product_id": pid, "seed": True})
        have = 0
    start = datetime.strptime(cfg["seed_from"], "%Y-%m-%d").replace(tzinfo=HKT)
    end = datetime.now(HKT) - timedelta(days=1)
    span = max(1, (end - start).days)
    docs = []
    for _ in range(int(cfg["seed_total"]) - have):
        day = start + timedelta(days=random.randint(0, span))
        docs.append({**gen_review(pid, _rand_time_on(day)), "seed": True})
    if docs:
        await db.reviews.insert_many(docs)
    return len(docs)


# ----------------------------- daily auto -----------------------------
async def daily_tick(cfg: dict) -> bool:
    if not cfg["enabled"] or not cfg["product_id"]:
        return False
    now = datetime.now(HKT)
    today = now.strftime("%Y-%m-%d")
    changed = False
    if cfg.get("last_daily_date") != today:
        lo, hi = sorted((int(cfg["daily_min"]), int(cfg["daily_max"])))
        n = random.randint(lo, hi)
        cfg.update({"last_daily_date": today, "today_done": 0, "today_plan": sorted(_rand_time_on(now).isoformat() for _ in range(n))})
        changed = True
    plan, done = cfg.get("today_plan") or [], int(cfg.get("today_done") or 0)
    due = [t for t in plan[done:] if datetime.fromisoformat(t) <= now]
    if due:
        await db.reviews.insert_many([{**gen_review(cfg["product_id"], datetime.fromisoformat(t)), "daily": True} for t in due])
        cfg["today_done"] = done + len(due)
        changed = True
    return changed


# ----------------------------- 3-day auto review for completed orders -----------------------------
def _order_author(order: dict, user: dict) -> str:
    vals = [v for f in (order.get("delivery_info") or {}).values() for v in (f or {}).values()]
    phone = next((re.sub(r"\D", "", str(v)) for v in vals if len(re.sub(r"\D", "", str(v))) >= 8), "")
    email = (user or {}).get("email") or order.get("user_email") or ""
    if email and (not phone or random.random() < 0.6):
        return mask_email(email)
    return mask_phone(phone) if phone else mask_email(email) or "匿名用戶"


async def order_auto_tick(cfg: dict):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=int(cfg.get("auto_after_days") or 3))).isoformat()
    cur = db.orders.find({"status": "completed", "reviewed": {"$ne": True}, "completed_at": {"$lte": cutoff}}, {"_id": 0, "id": 1, "user_id": 1, "items": 1, "delivery_info": 1, "completed_at": 1}).limit(200)
    async for o in cur:
        user = await db.users.find_one({"user_id": o.get("user_id", "")}, {"_id": 0, "email": 1, "is_test": 1})
        if (user or {}).get("is_test"):
            await db.orders.update_one({"id": o["id"]}, {"$set": {"reviewed": True, "review_skipped": True}})
            continue
        author = _order_author(o, user)
        at = datetime.fromisoformat(o["completed_at"].replace("Z", "+00:00")) + timedelta(days=int(cfg.get("auto_after_days") or 3))
        ids = []
        for pid in {it.get("product_id") for it in o.get("items", []) if it.get("product_id")}:
            r = {"id": uuid.uuid4().hex, "product_id": pid, "author": author, "rating": 5, "content": "", "images": [], "visible": True, "reply": "", "area": "",
                 "lang": "zh-TW", "buy_count": 1, "auto": True, "order_id": o["id"], "user_id": o.get("user_id", ""), "created_at": at.isoformat()}
            await db.reviews.insert_one(r)
            ids.append(r["id"])
        await db.orders.update_one({"id": o["id"]}, {"$set": {"reviewed": True, "review_auto": True, "review": {"rating": 5, "content": "", "images": [], "created_at": at.isoformat(), "auto": True}, "review_ids": ids}})


async def other_tick(cfg: dict) -> bool:
    if not cfg.get("other_enabled"):
        return False
    now = datetime.now(HKT)
    today = now.strftime("%Y-%m-%d")
    changed = False
    if cfg.get("other_date") != today:
        pids = [p["id"] async for p in db.products.find({"is_giftcard": {"$ne": True}, "active": {"$ne": False}, "id": {"$ne": cfg.get("product_id")}}, {"_id": 0, "id": 1})]
        k = round(len(pids) * max(0, min(100, float(cfg.get("other_pct") or 0))) / 100)
        lo, hi = sorted((int(cfg.get("other_min") or 1), int(cfg.get("other_max") or 2)))
        plan = [[_rand_time_on(now).isoformat(), pid] for pid in random.sample(pids, k) for _ in range(random.randint(lo, hi))]
        plan.sort(key=lambda x: x[0])
        cfg.update({"other_date": today, "other_done": 0, "other_plan": plan})
        changed = True
    plan, done = cfg.get("other_plan") or [], int(cfg.get("other_done") or 0)
    due = [x for x in plan[done:] if datetime.fromisoformat(x[0]) <= now]
    if due:
        tp = float(cfg.get("other_text_pct") or 50)
        await db.reviews.insert_many([{**gen_review(pid, datetime.fromisoformat(t), tp, TEXTS_GENERIC), "daily_other": True} for t, pid in due])
        cfg["other_done"] = done + len(due)
        changed = True
    return changed


async def tick():
    cfg = await get_cfg()
    changed = await daily_tick(cfg)
    changed = await other_tick(cfg) or changed
    if changed:
        await save_cfg(cfg)
    await order_auto_tick(cfg)


async def loop():
    while True:
        try:
            await tick()
        except Exception as e:  # noqa: BLE001
            import logging
            logging.getLogger("review_auto").warning(f"review auto tick failed: {e}")
        await asyncio.sleep(60)


# ----------------------------- admin endpoints -----------------------------
class CfgIn(BaseModel):
    enabled: bool = True
    daily_min: int = 30
    daily_max: int = 100
    product_id: str = ""
    seed_total: int = 1849
    seed_from: str = "2025-01-01"
    auto_after_days: int = 3
    other_enabled: bool = True
    other_pct: int = 30
    other_min: int = 1
    other_max: int = 2
    other_text_pct: int = 50


async def _stats(cfg: dict) -> dict:
    pid = cfg["product_id"]
    today = datetime.now(HKT).strftime("%Y-%m-%d")
    return {"seeded": await db.reviews.count_documents({"product_id": pid, "seed": True}) if pid else 0,
            "daily_total": await db.reviews.count_documents({"product_id": pid, "daily": True}) if pid else 0,
            "today_planned": len(cfg.get("today_plan") or []) if cfg.get("last_daily_date") == today else 0,
            "today_done": int(cfg.get("today_done") or 0) if cfg.get("last_daily_date") == today else 0,
            "other_planned": len(cfg.get("other_plan") or []) if cfg.get("other_date") == today else 0,
            "other_done": int(cfg.get("other_done") or 0) if cfg.get("other_date") == today else 0,
            "other_total": await db.reviews.count_documents({"daily_other": True}),
            "other_products": await db.products.count_documents({"is_giftcard": {"$ne": True}, "active": {"$ne": False}}),
            "order_auto": await db.reviews.count_documents({"auto": True, "order_id": {"$exists": True}}),
            "user_reviews": await db.reviews.count_documents({"order_id": {"$exists": True}, "auto": {"$ne": True}})}


def _public(cfg: dict) -> dict:
    return {k: cfg[k] for k in ("enabled", "daily_min", "daily_max", "product_id", "seed_total", "seed_from", "auto_after_days", "last_daily_date",
                                "other_enabled", "other_pct", "other_min", "other_max", "other_text_pct", "other_date")}


@router.get("/admin/reviews/auto")
async def auto_get(admin: dict = Depends(admin_api.current_admin)):
    cfg = await get_cfg()
    return {**_public(cfg), "stats": await _stats(cfg)}


@router.put("/admin/reviews/auto")
async def auto_put(body: CfgIn, admin: dict = Depends(admin_api.current_admin)):
    cfg = await get_cfg()
    lo, hi = sorted((max(0, body.daily_min), max(0, body.daily_max)))
    try:
        datetime.strptime(body.seed_from, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式錯誤")
    if body.product_id and body.product_id != cfg["product_id"]:
        cfg.update({"last_daily_date": "", "today_plan": [], "today_done": 0})
    olo, ohi = sorted((max(0, body.other_min), max(0, body.other_max)))
    cfg.update({"enabled": body.enabled, "daily_min": lo, "daily_max": hi, "product_id": body.product_id or cfg["product_id"], "seed_total": max(0, body.seed_total),
                "seed_from": body.seed_from, "auto_after_days": max(0, body.auto_after_days),
                "other_enabled": body.other_enabled, "other_pct": max(0, min(100, body.other_pct)), "other_min": olo, "other_max": ohi, "other_text_pct": max(0, min(100, body.other_text_pct))})
    await save_cfg(cfg)
    return {**_public(cfg), "stats": await _stats(cfg)}


@router.post("/admin/reviews/auto/seed")
async def auto_seed(force: bool = False, admin: dict = Depends(admin_api.current_admin)):
    cfg = await get_cfg()
    n = await seed_history(cfg, force)
    await admin_api.record_admin_log("", admin.get("email", ""), "REVIEWS", f"一鍵補齊歷史好評 {n} 筆", 200)
    return {"added": n, "stats": await _stats(cfg)}


@router.post("/admin/reviews/auto/run-now")
async def auto_run_now(admin: dict = Depends(admin_api.current_admin)):
    await tick()
    cfg = await get_cfg()
    return {"stats": await _stats(cfg)}


# ----------------------------- user order review -----------------------------
class ImgIn(BaseModel):
    image_b64: str
    image_name: str = "img.jpg"


class OrderReviewIn(BaseModel):
    rating: int = 5
    content: str = ""
    images: List[ImgIn] = []


@router.post("/orders/{order_id}/review")
async def order_review(order_id: str, body: OrderReviewIn, user: dict = Depends(require_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o.get("status") != "completed":
        raise HTTPException(status_code=400, detail="訂單完成後才能評價")
    if o.get("reviewed"):
        raise HTTPException(status_code=409, detail="此訂單已評價")
    rating = min(5, max(1, int(body.rating)))
    content = (body.content or "").strip()[:500]
    urls = [await upload_b64("gogo589/reviews", im.image_b64, im.image_name, max_mb=5) for im in body.images[:3]]
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "email": 1})
    author = _order_author(o, u)
    at = now_iso()
    ids = []
    for pid in {it.get("product_id") for it in o.get("items", []) if it.get("product_id")}:
        r = {"id": uuid.uuid4().hex, "product_id": pid, "author": author, "rating": rating, "content": content, "images": urls, "visible": True, "reply": "", "area": "",
             "lang": "zh-TW", "buy_count": 1, "order_id": o["id"], "user_id": user["user_id"], "created_at": at}
        await db.reviews.insert_one(r)
        ids.append(r["id"])
    review = {"rating": rating, "content": content, "images": urls, "created_at": at, "auto": False}
    await db.orders.update_one({"id": order_id}, {"$set": {"reviewed": True, "review": review, "review_ids": ids}})
    return {"ok": True, "review": review}
