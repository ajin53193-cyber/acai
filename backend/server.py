import os
import re
import uuid
import asyncio
import json
import base64
import hashlib
import hmac
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response, PlainTextResponse
from fastapi.concurrency import run_in_threadpool
import storage as objstore
from translate import Translator, to_simplified, to_traditional
import email_auth
import admin_api
import cms_api
import payments_api
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

try:
    from backend.clerk_auth import clerk_router, require_user
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----------------------------- Roles -----------------------------
ROLES = ["admin", "member"]
DEFAULT_ROLE = "member"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def _is_admin_email(user_id: str) -> bool:
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    if not admins:
        return False
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    return any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
               for e in r.json()["email_addresses"])


def _clerk_user_info(user_id: str) -> dict:
    try:
        r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                         headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
        r.raise_for_status()
        d = r.json()
        emails = d.get("email_addresses", [])
        email = emails[0]["email_address"] if emails else ""
        name = " ".join(x for x in [d.get("first_name"), d.get("last_name")] if x) or email
        return {"email": email, "name": name}
    except Exception:
        return {"email": "", "name": ""}


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        role = "admin" if _is_admin_email(uid) else DEFAULT_ROLE
        info = _clerk_user_info(uid)
        await db.users.update_one(
            {"user_id": uid, "role": {"$in": [None, ""]}},
            {"$set": {"role": role, "email": info["email"], "name": info["name"]}},
        )
        member = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "email": info["email"], "name": info["name"],
                              "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_role(*roles: str):
    async def check(request: Request, member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        if member.get("banned"):
            raise HTTPException(status_code=403, detail="帳號已被停用")
        if "admin" in roles and request.url.path.startswith("/api/admin"):
            await admin_api.admin_guard(request, member)
        return member
    return check


# ----------------------------- Models -----------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


class Spec(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str
    price_usd: float
    sale_price_usd: Optional[float] = None
    giftcard_value_usd: Optional[float] = None
    badge: str = ""
    in_stock: bool = True
    limit: str = ""
    limit_count: int = 1


class DeliveryField(BaseModel):
    code: str = "account"
    name: str
    required: bool = True
    placeholder: str = ""
    tips: str = ""
    type: str = "text"  # text | select | password | textarea
    options: List[str] = []


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str
    brand: str = ""
    subtitle: str = ""
    image: str = ""
    description: str = ""
    content_html: str = ""
    tutorial: str = ""
    account_field_label: str = "充值帳號"
    account_field_hint: str = ""
    delivery_fields: List[DeliveryField] = []
    source_id: str = ""
    specs: List[Spec] = []
    tags: List[str] = []
    is_giftcard: bool = False
    sales_count: int = 0
    rating: float = 5.0
    sort_order: int = 0
    active: bool = True
    created_at: str = Field(default_factory=now_iso)


class ProductIn(BaseModel):
    name: str
    category: str
    brand: str = ""
    subtitle: str = ""
    image: str = ""
    description: str = ""
    content_html: str = ""
    tutorial: str = ""
    account_field_label: str = "充值帳號"
    account_field_hint: str = ""
    delivery_fields: List[DeliveryField] = []
    specs: List[Spec] = []
    tags: List[str] = []
    is_giftcard: bool = False
    sales_count: int = 0
    rating: float = 5.0
    sort_order: int = 0
    active: bool = True
    related_ids: List[str] = []


class CategoryIn(BaseModel):
    id: str = ""
    name: str
    image: str = ""
    icon: str = ""
    sort_order: int = 0
    active: bool = True


class Currency(BaseModel):
    code: str
    symbol: str
    name: str
    flag: str = ""
    rate_to_usd: float
    active: bool = True
    auto_rate: Optional[bool] = None


class Review(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    author: str
    rating: int = 5
    content: str
    images: List[str] = []
    visible: bool = True
    created_at: str = Field(default_factory=now_iso)


class ReviewIn(BaseModel):
    product_id: str
    author: str
    rating: int = 5
    content: str
    images: List[str] = []
    visible: bool = True


class Promo(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    discount_type: str = "percent"  # percent | fixed_usd
    value: float = 0
    min_order_usd: float = 0
    active: bool = True
    expires_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class PromoIn(BaseModel):
    code: str
    discount_type: str = "percent"
    value: float = 0
    min_order_usd: float = 0
    active: bool = True
    expires_at: Optional[str] = None


class OrderItemIn(BaseModel):
    product_id: str
    spec_id: str
    quantity: int = 1
    combo_id: Optional[str] = None


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    currency: str = "USD"
    recharge_account: str
    recharge_note: str = ""
    contact: str = ""
    delivery_info: Dict[str, Dict[str, str]] = {}
    promo_code: Optional[str] = None
    use_points: int = 0


class StatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None


ORDER_STATUSES = ["pending_payment", "paid", "processing", "shipped", "completed", "exception", "cancelled"]
STATUS_LABELS = {
    "pending_payment": "待支付", "paid": "已支付", "processing": "充值中",
    "shipped": "已發貨", "completed": "已完成", "exception": "異常",
}


# ----------------------------- Public endpoints -----------------------------
@api_router.get("/")
async def root():
    return {"message": "GlobalTopUp API"}


@api_router.get("/currencies")
async def get_currencies():
    return await db.currencies.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)


@api_router.get("/categories")
async def get_categories():
    return await db.categories.find({"active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1).to_list(100)


@api_router.get("/admin/categories")
async def admin_list_categories(admin: dict = Depends(require_role("admin"))):
    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    counts = {r["_id"]: r["n"] for r in await db.products.aggregate([{"$group": {"_id": "$category", "n": {"$sum": 1}}}]).to_list(200)}
    for c in cats:
        c["product_count"] = counts.get(c["id"], 0)
        c.setdefault("active", True)
    return cats


async def _prep_category(body: CategoryIn) -> dict:
    d = body.model_dump()
    d["name"] = to_traditional(d["name"].strip())
    if not d["name"]:
        raise HTTPException(status_code=400, detail="分類名稱不可為空")
    if d["image"].startswith("data:image"):
        d["image"] = await _upload_b64("gogo589/categories", d["image"], "cat.png", max_mb=2)
    return d


@api_router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, admin: dict = Depends(require_role("admin"))):
    d = await _prep_category(body)
    cid = re.sub(r"[^a-z0-9-]", "", (d["id"] or "").lower().replace(" ", "-")) or re.sub(r"[^a-z0-9]", "", uuid.uuid4().hex[:8])
    if await db.categories.find_one({"id": cid}):
        raise HTTPException(status_code=409, detail="分類 ID 已存在")
    d["id"] = cid
    await db.categories.insert_one({**d})
    d["product_count"] = 0
    return d


@api_router.put("/admin/categories/{cid}")
async def admin_update_category(cid: str, body: CategoryIn, admin: dict = Depends(require_role("admin"))):
    d = await _prep_category(body)
    d.pop("id", None)
    r = await db.categories.find_one_and_update({"id": cid}, {"$set": d}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    r["product_count"] = await db.products.count_documents({"category": cid})
    return r


@api_router.delete("/admin/categories/{cid}")
async def admin_delete_category(cid: str, admin: dict = Depends(require_role("admin"))):
    n = await db.products.count_documents({"category": cid})
    if n:
        raise HTTPException(status_code=409, detail=f"此分類下仍有 {n} 件商品，請先移動或刪除商品")
    r = await db.categories.delete_one({"id": cid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.get("/products")
async def get_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {"active": True}
    if category:
        query["category"] = category
    if q:
        ql = q.lower()
        names = [src for src, en in translator.en.items() if ql in en.lower() and len(src) <= 80]
        query["$or"] = [{"name": {"$regex": re.escape(v), "$options": "i"}} for v in {q, to_simplified(q), to_traditional(q)}]
        if names:
            query["$or"].append({"name": {"$in": names[:500]}})
    proj = {"_id": 0, "content_html": 0, "delivery_fields": 0, "description": 0, "tutorial": 0}
    return await db.products.find(query, proj).sort([("sort_order", 1), ("sales_count", -1)]).to_list(3000)


_img_cache: Dict[str, tuple] = {}


@api_router.get("/img/{path:path}")
async def serve_image(path: str):
    if path not in _img_cache:
        try:
            data, ct = await run_in_threadpool(objstore.get_object, path)
        except Exception:
            raise HTTPException(status_code=404, detail="圖片不存在")
        if len(_img_cache) > 4000:
            _img_cache.clear()
        _img_cache[path] = (data, ct)
    data, ct = _img_cache[path]
    return Response(content=data, media_type=ct, headers={"Cache-Control": "public, max-age=2592000, immutable"})


@api_router.get("/products/suggest")
async def suggest_products(q: str = ""):
    q = q.strip()
    if len(q) < 1:
        return []
    import re as _re
    rx = {"$regex": _re.escape(q), "$options": "i"}
    proj = {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1, "subtitle": 1}
    rows = await db.products.find({"active": True, "$or": [{"name": rx}, {"brand": rx}, {"subtitle": rx}]}, proj).sort([("sort_order", 1), ("sales_count", -1)]).to_list(8)
    return rows


@api_router.get("/products/home")
async def get_home_products():
    proj = {"_id": 0, "content_html": 0, "delivery_fields": 0, "description": 0, "tutorial": 0}
    quick = await db.products.find({"active": True, "tags": "快速下單"}, proj).sort("sort_order", 1).to_list(12)
    hot = await db.products.find({"active": True, "tags": "熱銷"}, proj).sort("sort_order", 1).to_list(16)
    cats = await db.categories.find({"active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    by_category = {}
    for c in cats:
        by_category[c["id"]] = await db.products.find({"active": True, "category": c["id"]}, proj).sort([("sort_order", 1), ("sales_count", -1)]).to_list(20)
    return {"quick": quick, "hot": hot, "by_category": by_category}


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    rel_ids = p.pop("related_ids", None) or []
    if rel_ids:
        proj = {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1, "tags": 1, "sales_count": 1, "rating": 1}
        docs = await db.products.find({"id": {"$in": rel_ids}, "active": True}, proj).to_list(20)
        order = {i: n for n, i in enumerate(rel_ids)}
        docs = sorted(docs, key=lambda d: order.get(d["id"], 99))
        if len(docs) < 8:
            seen = {d["id"] for d in docs} | {product_id}
            extra = await db.products.find({"category": p.get("category"), "active": True, "id": {"$nin": list(seen)}}, proj).sort("sales_count", -1).to_list(8 - len(docs))
            docs += extra
        p["related"] = docs
    else:
        proj = {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1, "tags": 1, "sales_count": 1, "rating": 1}
        p["related"] = await db.products.find({"category": p.get("category"), "active": True, "id": {"$ne": product_id}}, proj).sort("sales_count", -1).to_list(8)
    return p


@api_router.get("/articles")
async def list_articles(page: int = 1, size: int = 15, type: str = ""):
    q = cms_api.article_visible_query()
    if type:
        q["type"] = type
    total = await db.articles.count_documents(q)
    proj = {"_id": 0, "content_html": 0}
    rows = await db.articles.find(q, proj).sort([("sort_order", 1), ("published_at", -1)]).skip((page - 1) * size).to_list(size)
    return {"total": total, "rows": rows}


@api_router.get("/articles/{article_id}")
async def get_article(article_id: str):
    a = await db.articles.find_one_and_update({"id": article_id, "active": True}, {"$inc": {"view_count": 1}}, projection={"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    rows = [] if a.get("page") else await db.articles.find(cms_api.article_visible_query(), {"_id": 0, "id": 1, "title": 1, "sort_order": 1}).sort([("sort_order", 1), ("published_at", -1)]).to_list(500)
    idx = next((i for i, r in enumerate(rows) if r["id"] == article_id), -1)
    a["prev"] = rows[idx - 1] if idx > 0 else None
    a["next"] = rows[idx + 1] if 0 <= idx < len(rows) - 1 else None
    return a


@api_router.get("/reviews")
async def get_reviews(product_id: Optional[str] = None):
    query = {"visible": True}
    if product_id:
        query["product_id"] = product_id
    return await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/promos/public")
async def public_promos():
    docs = await db.promos.find({"active": True}, {"_id": 0, "code": 1, "discount_type": 1, "value": 1, "min_order_usd": 1, "expires_at": 1}).to_list(50)
    now = now_iso()
    return [d for d in docs if not d.get("expires_at") or d["expires_at"] > now]


@api_router.get("/recharge-bonus/public")
async def public_recharge_bonus():
    return await db.recharge_bonus_rules.find({"active": True}, {"_id": 0}).sort("min_usd", 1).to_list(50)


@api_router.get("/cart-promotions/public")
async def public_cart_promotions():
    nowi = now_iso()
    rows = await db.cart_promotions.find({"active": True}, {"_id": 0}).sort("threshold_usd", 1).to_list(50)
    return [c for c in rows if (not c.get("start_at") or c["start_at"] <= nowi) and (not c.get("end_at") or c["end_at"] >= nowi)]


@api_router.get("/flash-sales/public")
async def public_flash_sales():
    nowi = now_iso()
    rows = await db.flash_sales.find({"active": True}, {"_id": 0}).sort("end_at", 1).to_list(100)
    out = []
    for fs in rows:
        if fs.get("start_at") and fs["start_at"] > nowi:
            continue
        if fs.get("end_at") and fs["end_at"] < nowi:
            continue
        stock = int(fs.get("stock") or 0)
        sold = int(fs.get("sold") or 0)
        if sold >= stock:
            continue
        p = await db.products.find_one({"id": fs["product_id"], "active": True}, {"_id": 0, "name": 1, "image": 1, "specs": 1})
        if not p:
            continue
        spec = next((s for s in p.get("specs", []) if s["id"] == fs["spec_id"]), None)
        if not spec:
            continue
        out.append({
            "id": fs["id"], "title": fs.get("title") or p["name"], "product_id": fs["product_id"], "spec_id": fs["spec_id"],
            "product_name": p["name"], "image": p.get("image", ""), "spec_label": spec["label"],
            "flash_price_usd": round(float(fs["flash_price_usd"]), 2), "original_price_usd": round(float(spec["price_usd"]), 2),
            "stock": stock, "sold": sold, "remaining": max(0, stock - sold), "end_at": fs.get("end_at", ""), "start_at": fs.get("start_at", ""),
        })
    return out


@api_router.get("/lottery/config")
async def lottery_config_public():
    cfg = await admin_api.get_lottery_cfg()
    prizes = [{"id": p["id"], "label": p["label"], "color": p.get("color", "#fb923c"), "type": p.get("type", "none")} for p in cfg.get("prizes", [])]
    return {"enabled": bool(cfg.get("enabled")), "cost_points": int(cfg.get("cost_points") or 0), "free_daily": bool(cfg.get("free_daily")), "prizes": prizes}


async def _free_draw_used_today(uid: str) -> bool:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return bool(await db.lottery_draws.find_one({"user_id": uid, "free": True, "created_at": {"$regex": f"^{today}"}}, {"_id": 1}))


@api_router.get("/lottery/my-status")
async def lottery_my_status(member: dict = Depends(current_member)):
    cfg = await admin_api.get_lottery_cfg()
    u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "points": 1}) or {}
    free_available = bool(cfg.get("free_daily")) and not await _free_draw_used_today(member["user_id"])
    return {"points": int(u.get("points") or 0), "cost_points": int(cfg.get("cost_points") or 0),
            "free_daily": bool(cfg.get("free_daily")), "free_available": free_available, "enabled": bool(cfg.get("enabled"))}


async def _pick_and_grant(uid: str, cfg: dict, points_bal: int, exclude_none: bool = False):
    """Weighted pick from current config + apply reward. Returns (win, new_points, wallet_usd)."""
    import random
    pool = [p for p in cfg.get("prizes", []) if int(p.get("weight") or 0) > 0 and int(p.get("stock", -1)) != 0]
    if exclude_none:
        real = [p for p in pool if p.get("type") != "none"]
        if real:
            pool = real
    if not pool:
        raise HTTPException(status_code=400, detail="暫無可抽獎品，請稍後再試")
    total = sum(int(p["weight"]) for p in pool)
    r = random.uniform(0, total)
    acc = 0.0
    win = pool[-1]
    for p in pool:
        acc += int(p["weight"])
        if r <= acc:
            win = p
            break
    if int(win.get("stock", -1)) >= 0:
        await db.settings.update_one({"key": "lottery"}, {"$inc": {"value.prizes.$[e].stock": -1}}, array_filters=[{"e.id": win["id"], "e.stock": {"$gt": 0}}])
    wallet_usd = None
    ptype = win.get("type", "none")
    pval = win.get("value")
    if ptype == "points":
        add = int(float(pval or 0))
        if add > 0:
            points_bal += add
            await db.users.update_one({"user_id": uid}, {"$set": {"points": points_bal}})
            await db.point_transactions.insert_one({"id": new_id(), "user_id": uid, "delta": add, "balance_after": points_bal,
                                                    "source": "lottery_prize", "reason": f"抽獎中獎 {win['label']}", "ref": win["id"], "created_at": now_iso()})
    elif ptype == "balance":
        amt = round(float(pval or 0), 2)
        if amt > 0:
            wallet_usd = await _wallet_tx(uid, "lottery", amt, f"抽獎中獎 {win['label']}")
    elif ptype == "coupon":
        code = str(pval or "").strip().upper()
        if code and await db.promos.find_one({"code": code, "active": True}, {"_id": 1}):
            await db.user_coupons.insert_one({"id": new_id(), "user_id": uid, "code": code, "claimed_at": now_iso(), "source": "lottery"})
    return win, points_bal, wallet_usd


@api_router.post("/lottery/draw")
async def lottery_draw(body: dict = None, member: dict = Depends(current_member)):
    uid = member["user_id"]
    cfg = await admin_api.get_lottery_cfg()
    if not cfg.get("enabled"):
        raise HTTPException(status_code=400, detail="抽獎活動未開啟")
    count = int((body or {}).get("count") or 1)
    count = 10 if count >= 10 else 1
    cost = int(cfg.get("cost_points") or 0)
    # free daily draw applies only to a single draw
    use_free = count == 1 and bool(cfg.get("free_daily")) and not await _free_draw_used_today(uid)
    charge = 0 if use_free else cost * count
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "points": 1}) or {}
    bal = int(u.get("points") or 0)
    if bal < charge:
        raise HTTPException(status_code=400, detail=f"積分不足，本次抽獎需 {charge} 積分")
    bal -= charge
    await db.users.update_one({"user_id": uid}, {"$set": {"points": bal}})
    if charge > 0:
        await db.point_transactions.insert_one({"id": new_id(), "user_id": uid, "delta": -charge, "balance_after": bal,
                                                "source": "lottery", "reason": f"抽獎消耗積分 x{count}", "ref": "", "created_at": now_iso()})
    results = []
    wallet_usd = None
    import random as _rnd
    has_real = any(p.get("type") != "none" and int(p.get("weight") or 0) > 0 for p in cfg.get("prizes", []))
    guaranteed_idx = _rnd.randint(0, count - 1) if (count >= 10 and has_real) else -1
    for k in range(count):
        win, bal, w = await _pick_and_grant(uid, cfg, bal, exclude_none=(k == guaranteed_idx))
        if w is not None:
            wallet_usd = w
        draw = {"id": new_id(), "user_id": uid, "prize_id": win["id"], "prize_label": win["label"], "prize_type": win.get("type", "none"),
                "prize_value": win.get("value"), "cost_points": (charge if count == 1 else cost), "free": bool(use_free and k == 0), "fulfilled": False, "created_at": now_iso()}
        await db.lottery_draws.insert_one(dict(draw))
        results.append({"prize_id": win["id"], "prize_label": win["label"], "prize_type": win.get("type", "none")})
    await log_user(uid, "lottery", "抽獎", f"x{count} 中獎：" + "、".join(r["prize_label"] for r in results))
    first = results[0]
    return {"results": results, "count": count, "free_used": use_free,
            "prize_id": first["prize_id"], "prize_label": first["prize_label"], "prize_type": first["prize_type"],
            "points_balance": bal, "balance_usd": wallet_usd,
            "free_available": bool(cfg.get("free_daily")) and not await _free_draw_used_today(uid)}


@api_router.get("/lottery/my-draws")
async def lottery_my_draws(member: dict = Depends(current_member)):
    return await db.lottery_draws.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)


@api_router.get("/combos/public")
async def public_combos():
    rows = await db.combos.find({"active": True}, {"_id": 0}).sort([("sort_order", 1)]).to_list(50)
    out = []
    for c in rows:
        items = []
        orig = 0.0
        ok = True
        for ci in c.get("items", []):
            p = await db.products.find_one({"id": ci["product_id"], "active": True}, {"_id": 0, "name": 1, "image": 1, "specs": 1})
            if not p:
                ok = False
                break
            spec = next((s for s in p.get("specs", []) if s["id"] == ci["spec_id"]), None)
            if not spec:
                ok = False
                break
            qty = int(ci.get("quantity") or 1)
            orig += float(spec["price_usd"]) * qty
            items.append({"product_id": ci["product_id"], "spec_id": ci["spec_id"], "product_name": p["name"], "image": p.get("image", ""), "spec_label": spec["label"], "quantity": qty, "price_usd": round(float(spec["price_usd"]), 2)})
        if not ok or not items:
            continue
        out.append({"id": c["id"], "title": c["title"], "image": c.get("image", ""), "price_usd": round(float(c["price_usd"]), 2),
                    "original_total_usd": round(orig, 2), "items": items})
    return out


class RedeemGiftCardIn(BaseModel):
    code: str


@api_router.post("/me/redeem-giftcard")
async def redeem_giftcard(body: RedeemGiftCardIn, member: dict = Depends(current_member)):
    code = (body.code or "").strip().upper()
    card = await db.gift_cards.find_one({"code": code}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="禮品卡不存在，請檢查卡號")
    if card["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="此禮品卡已被使用")
    if card["status"] != "active":
        raise HTTPException(status_code=400, detail="此禮品卡已停用")
    r = await db.gift_cards.find_one_and_update({"id": card["id"], "status": "active"},
                                                {"$set": {"status": "redeemed", "redeemed_by": member["user_id"], "redeemed_at": now_iso(), "redeemed_via": "member"}})
    if not r:
        raise HTTPException(status_code=400, detail="此禮品卡已被使用")
    bal = await _wallet_tx(member["user_id"], "giftcard", float(card["face_value_usd"]), f"禮品卡充值 {code}", card["id"])
    asyncio.create_task(log_user(member["user_id"], "topup", "禮品卡充值", f"{code} · USD$ {float(card['face_value_usd']):.2f}"))
    return {"ok": True, "amount_usd": card["face_value_usd"], "balance_usd": bal}


@api_router.post("/giftcard/redeem")
async def external_redeem_giftcard(body: RedeemGiftCardIn, request: Request):
    key = request.headers.get("x-api-key", "")
    doc = await db.settings.find_one({"key": "giftcard_api"}, {"_id": 0})
    valid = ((doc or {}).get("value") or {}).get("api_key")
    if not valid or key != valid:
        raise HTTPException(status_code=401, detail="invalid api key")
    code = (body.code or "").strip().upper()
    r = await db.gift_cards.find_one_and_update({"code": code, "status": "active"},
                                                {"$set": {"status": "redeemed", "redeemed_at": now_iso(), "redeemed_via": "api"}})
    if not r:
        raise HTTPException(status_code=400, detail="card not found or already used")
    return {"valid": True, "code": code, "face_value_usd": r["face_value_usd"]}


@api_router.post("/promo/validate")
async def validate_promo(payload: dict):
    code = (payload.get("code") or "").strip().upper()
    subtotal_usd = float(payload.get("subtotal_usd") or 0)
    promo = await db.promos.find_one({"code": code, "active": True}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="優惠碼無效")
    if promo.get("expires_at"):
        try:
            if datetime.fromisoformat(promo["expires_at"]) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="優惠碼已過期")
        except ValueError:
            pass
    if subtotal_usd < promo.get("min_order_usd", 0):
        raise HTTPException(status_code=400, detail=f"訂單需滿 ${promo['min_order_usd']:.2f} 方可使用")
    discount = promo["value"] / 100 * subtotal_usd if promo["discount_type"] == "percent" else promo["value"]
    discount = min(discount, subtotal_usd)
    return {"code": code, "discount_usd": round(discount, 2), "discount_type": promo["discount_type"], "value": promo["value"]}


# ----------------------------- Helpers -----------------------------
async def _flash_for(product_id: str, spec_id: str):
    nowi = now_iso()
    fs = await db.flash_sales.find_one({"product_id": product_id, "spec_id": spec_id, "active": True}, {"_id": 0})
    if not fs:
        return None
    if fs.get("start_at") and fs["start_at"] > nowi:
        return None
    if fs.get("end_at") and fs["end_at"] < nowi:
        return None
    if int(fs.get("sold") or 0) >= int(fs.get("stock") or 0):
        return None
    return fs


async def _user_flash_bought(user_id: str, flash_id: str) -> int:
    rows = await db.orders.find({"user_id": user_id, "status": {"$ne": "cancelled"}, "items.flash_id": flash_id}, {"_id": 0, "items": 1}).to_list(200)
    n = 0
    for o in rows:
        for it in o.get("items", []):
            if it.get("flash_id") == flash_id:
                n += int(it.get("quantity") or 0)
    return n


async def dispatch_giftcards(order: dict):
    """On payment of a gift-card product, generate a fresh card code per unit and attach to the order."""
    if order.get("giftcards_dispatched"):
        return
    codes = []
    for it in order.get("items", []):
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0, "is_giftcard": 1, "specs": 1})
        if not p or not p.get("is_giftcard"):
            continue
        spec = next((s for s in p.get("specs", []) if s["id"] == it["spec_id"]), {})
        fv = spec.get("giftcard_value_usd") or spec.get("price_usd") or it.get("unit_price_usd") or 0
        fv = round(float(fv), 2)
        for _ in range(int(it.get("quantity") or 1)):
            code = admin_api._gen_card_code()
            await db.gift_cards.insert_one({"id": uuid.uuid4().hex[:12], "code": code, "face_value_usd": fv, "status": "active",
                                            "batch_no": "ORDER", "note": f"訂單 {order.get('order_no', '')} 自動發卡", "source_order": order["id"],
                                            "sold_to": order["user_id"], "created_at": now_iso(), "redeemed_by": None, "redeemed_at": None, "redeemed_via": None})
            codes.append({"code": code, "face_value_usd": fv, "product_name": it.get("product_name", "")})
    if codes:
        await db.orders.update_one({"id": order["id"]}, {"$set": {"giftcards_dispatched": True, "giftcard_codes": codes}})
    return codes


async def _compute_order(order: OrderIn, member_ctx: dict = None):
    items_out = []
    subtotal_usd = 0.0
    for it in order.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="商品不存在")
        spec = next((s for s in p["specs"] if s["id"] == it.spec_id), None)
        if not spec:
            raise HTTPException(status_code=404, detail="規格不存在")
        qty = max(1, int(it.quantity))
        flash = await _flash_for(it.product_id, it.spec_id)
        unit = round(float(flash["flash_price_usd"]), 2) if flash else spec["price_usd"]
        line = unit * qty
        subtotal_usd += line
        items_out.append({
            "product_id": p["id"], "product_name": p["name"], "image": p.get("image", ""),
            "spec_id": spec["id"], "spec_label": spec["label"],
            "unit_price_usd": unit, "quantity": qty, "line_usd": round(line, 2),
            "flash_id": flash["id"] if flash else None, "flash": bool(flash),
            "combo_id": it.combo_id,
        })
    # combo (套餐) bundle pricing — collapse grouped items to the package price
    combo_discount_usd = 0.0
    combo_titles = []
    groups = {}
    for x in items_out:
        if x.get("combo_id"):
            groups.setdefault(x["combo_id"], []).append(x)
    for cid, its in groups.items():
        combo = await db.combos.find_one({"id": cid, "active": True}, {"_id": 0})
        if not combo:
            continue
        gtotal = sum(v["line_usd"] for v in its)
        disc = round(max(0.0, gtotal - float(combo["price_usd"])), 2)
        if disc > 0:
            combo_discount_usd += disc
            combo_titles.append(combo["title"])
    discount_usd = 0.0
    promo_code = None
    if order.promo_code:
        res = await validate_promo({"code": order.promo_code, "subtotal_usd": subtotal_usd})
        discount_usd = res["discount_usd"]
        promo_code = res["code"]
    remaining = max(0.0, subtotal_usd - combo_discount_usd - discount_usd)
    # cart-level promotion (滿減/滿折) — auto-apply best eligible tier
    cart_discount_usd = 0.0
    cart_promo_title = None
    cps = await db.cart_promotions.find({"active": True}, {"_id": 0}).to_list(100)
    nowi = now_iso()
    elig = [c for c in cps if subtotal_usd + 1e-9 >= (c.get("threshold_usd") or 0) and (not c.get("start_at") or c["start_at"] <= nowi) and (not c.get("end_at") or c["end_at"] >= nowi)]
    if elig:
        def _cd(c):
            return float(c.get("value") or 0) if c.get("promo_type") == "reduce" else round(remaining * float(c.get("value") or 0) / 100, 2)
        best = max(elig, key=_cd)
        cart_discount_usd = round(min(_cd(best), remaining), 2)
        cart_promo_title = best.get("title") or ("滿減" if best.get("promo_type") == "reduce" else "滿折")
        remaining = max(0.0, round(remaining - cart_discount_usd, 2))
    level_discount_usd = 0.0
    level_name = None
    level_pct = 0
    points_used = 0
    points_discount_usd = 0.0
    if member_ctx:
        lv = member_ctx.get("level") or {}
        level_name = lv.get("name")
        level_pct = lv.get("discount_percent", 0) or 0
        level_discount_usd = round(remaining * level_pct / 100, 2)
        remaining = max(0.0, round(remaining - level_discount_usd, 2))
        if order.use_points and int(order.use_points) > 0:
            cfg = await get_points_config()
            if cfg.get("redeem_enabled"):
                per = float(cfg.get("points_per_usd_redeem") or 100) or 100
                min_r = float(cfg.get("min_redeem") or 0)
                avail = int(member_ctx.get("points") or 0)
                want = min(int(order.use_points), avail)
                if want >= min_r and want > 0:
                    usd = min(round(want / per, 2), remaining)
                    points_used = int(round(usd * per))
                    points_discount_usd = round(points_used / per, 2)
                    remaining = max(0.0, round(remaining - points_discount_usd, 2))
    total_usd = round(remaining, 2)
    extras = {"level_discount_usd": round(level_discount_usd, 2), "level_name": level_name, "level_discount_percent": level_pct,
              "cart_discount_usd": cart_discount_usd, "cart_promo_title": cart_promo_title,
              "combo_discount_usd": round(combo_discount_usd, 2), "combo_title": "、".join(combo_titles),
              "points_used": points_used, "points_discount_usd": round(points_discount_usd, 2)}
    return items_out, round(subtotal_usd, 2), round(discount_usd, 2), total_usd, promo_code, extras


async def _member_context(user_id: str) -> dict:
    agg = await db.orders.aggregate([{"$match": {"user_id": user_id}}, {"$group": {"_id": None, "spent": {"$sum": "$total_usd"}}}]).to_list(1)
    spent = round((agg[0]["spent"] if agg else 0) or 0, 2)
    levels = await admin_api._levels()
    lv = admin_api._level_of(spent, levels)
    nxt = None
    for L in levels:
        if (L.get("min_spend_usd") or 0) > spent:
            nxt = {"name": L["name"], "min_spend_usd": L["min_spend_usd"], "remaining": round(L["min_spend_usd"] - spent, 2)}
            break
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points": 1}) or {}
    return {"spent": spent, "level": lv, "next_level": nxt, "points": int(u.get("points") or 0)}


LIMIT_KINDS = ("daily", "weekly", "monthly", "lifetime", "newcomer")
LIMIT_LABEL = {"daily": "每日", "weekly": "每週", "monthly": "每月", "lifetime": "終生"}
LIMIT_WINDOW = {"daily": timedelta(hours=24), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}


def _limit_kind(badge: str):
    b = badge or ""
    if "每月一單" in b:
        return "monthly"
    if "每日一單" in b:
        return "daily"
    if "新客" in b or "新用戶" in b or "新使用者" in b:
        return "newcomer"
    return None


def _spec_limit(spec: dict):
    """(kind, count) — explicit spec.limit wins; empty falls back to badge inference; 'none' disables."""
    lim = (spec.get("limit") or "").strip()
    if lim == "none":
        return None, 0
    kind = lim if lim in LIMIT_KINDS else _limit_kind(spec.get("badge"))
    if not kind:
        return None, 0
    return kind, max(1, int(spec.get("limit_count") or 1))


async def _daily_limited_specs(user_id: str, product_ids: List[str]):
    """Return {spec_id: [created_at_iso, ...]} for this user's non-cancelled orders."""
    cur = db.orders.find({"user_id": user_id, "status": {"$ne": "cancelled"}, "items.product_id": {"$in": product_ids}}, {"_id": 0, "items.spec_id": 1, "items.quantity": 1, "created_at": 1})
    used: Dict[str, list] = {}
    async for o in cur:
        for it in o.get("items", []):
            used.setdefault(it["spec_id"], []).extend([o["created_at"]] * max(1, int(it.get("quantity") or 1)))
    return used


def _used_in_window(kind: str, stamps: Optional[list]) -> int:
    if not stamps:
        return 0
    if kind == "lifetime":
        return len(stamps)
    cutoff = datetime.now(timezone.utc) - LIMIT_WINDOW[kind]
    return sum(1 for s in stamps if datetime.fromisoformat(s) > cutoff)


def _is_locked(kind: str, stamps, count: int = 1) -> bool:
    return _used_in_window(kind, stamps) >= count


async def _check_daily_limit(order: OrderIn, user_id: str):
    pids = [it.product_id for it in order.items]
    used = await _daily_limited_specs(user_id, pids)
    has_orders = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}}) > 0
    in_cart: Dict[str, int] = {}
    for it in order.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0, "specs": 1, "name": 1})
        spec = next((s for s in p["specs"] if s["id"] == it.spec_id), None)
        if not spec:
            continue
        kind, count = _spec_limit(spec)
        if not kind:
            continue
        qty = int(it.quantity)
        if kind == "newcomer":
            if has_orders or qty > count or in_cart.get(it.spec_id, 0) + qty > count:
                raise HTTPException(status_code=409, detail=f"「{p['name']} {spec['label']}」為新用戶專享規格，僅限首單購買 {count} 份，請選擇其他規格")
        else:
            remaining = count - _used_in_window(kind, used.get(it.spec_id)) - in_cart.get(it.spec_id, 0)
            if qty > remaining:
                unit = LIMIT_LABEL[kind]
                raise HTTPException(status_code=409, detail=f"「{p['name']} {spec['label']}」為{unit}限購規格，每個帳號{unit}限購 {count} 份，請稍後再來或選擇其他規格")
        in_cart[it.spec_id] = in_cart.get(it.spec_id, 0) + qty


@api_router.get("/products/{product_id}/daily-limit")
async def product_daily_limit(product_id: str, member: dict = Depends(current_member)):
    used = await _daily_limited_specs(member["user_id"], [product_id])
    p = await db.products.find_one({"id": product_id}, {"_id": 0, "specs": 1}) or {"specs": []}
    locked, remaining = [], {}
    for s in p["specs"]:
        kind, count = _spec_limit(s)
        if kind and kind != "newcomer":
            left = count - _used_in_window(kind, used.get(s["id"]))
            remaining[s["id"]] = max(0, left)
            if left <= 0:
                locked.append(s["id"])
    has_orders = await db.orders.count_documents({"user_id": member["user_id"], "status": {"$ne": "cancelled"}}) > 0
    return {"used_spec_ids": locked, "remaining": remaining, "is_new_customer": not has_orders}


# ----------------------------- Site settings -----------------------------
DEFAULT_SETTINGS = {"whatsapp_number": "", "whatsapp_link": "https://wa.me/", "cs_label": "WhatsApp 掃碼聯繫客服"}


@api_router.get("/settings")
async def get_settings():
    doc = await db.site_settings.find_one({"_id": "site"}, {"_id": 0}) or {}
    out = {**DEFAULT_SETTINGS, **doc}
    if out.get("whatsapp_number") and not doc.get("whatsapp_link"):
        out["whatsapp_link"] = "https://wa.me/" + "".join(ch for ch in out["whatsapp_number"] if ch.isdigit())
    return out


@api_router.put("/admin/settings")
async def put_settings(body: Dict[str, str], admin: dict = Depends(require_role("admin"))):
    allowed = {k: v for k, v in body.items() if k in DEFAULT_SETTINGS}
    await db.site_settings.update_one({"_id": "site"}, {"$set": allowed}, upsert=True)
    return await get_settings()


# ----------------------------- Payment logos -----------------------------
class PaymentLogoIn(BaseModel):
    name: str = ""
    image_b64: str = ""
    image_name: str = "logo.png"
    sort_order: Optional[int] = None
    active: Optional[bool] = None


async def _upload_b64(prefix: str, image_b64: str, image_name: str, max_mb: int = 2) -> str:
    raw = base64.b64decode(image_b64.split(",")[-1])
    if len(raw) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"圖片大小需在 {max_mb}M 以內")
    ext = (image_name.rsplit(".", 1)[-1] or "png").lower()
    mimes = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml"}
    if ext not in mimes:
        raise HTTPException(status_code=400, detail="僅支援 PNG / JPG / GIF / WEBP / SVG")
    res = await run_in_threadpool(objstore.put_object, f"{prefix}/{uuid.uuid4().hex}.{ext}", raw, mimes[ext])
    return f"/api/img/{res['path']}"


@api_router.get("/payment-logos")
async def list_payment_logos():
    return await db.payment_logos.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(50)


@api_router.get("/admin/payment-logos")
async def admin_payment_logos(admin: dict = Depends(require_role("admin"))):
    return await db.payment_logos.find({}, {"_id": 0}).sort("sort_order", 1).to_list(50)


@api_router.post("/admin/payment-logos")
async def create_payment_logo(body: PaymentLogoIn, admin: dict = Depends(require_role("admin"))):
    if not body.image_b64:
        raise HTTPException(status_code=400, detail="請上傳 Logo 圖片")
    count = await db.payment_logos.count_documents({})
    doc = {"id": new_id(), "name": body.name.strip(), "image": await _upload_b64("gogo589/payments", body.image_b64, body.image_name),
           "sort_order": body.sort_order if body.sort_order is not None else count + 1, "active": True if body.active is None else body.active, "created_at": now_iso()}
    await db.payment_logos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/payment-logos/{lid}")
async def update_payment_logo(lid: str, body: PaymentLogoIn, admin: dict = Depends(require_role("admin"))):
    upd = {}
    if body.name:
        upd["name"] = body.name.strip()
    if body.sort_order is not None:
        upd["sort_order"] = body.sort_order
    if body.active is not None:
        upd["active"] = body.active
    if body.image_b64:
        upd["image"] = await _upload_b64("gogo589/payments", body.image_b64, body.image_name)
    r = await db.payment_logos.find_one_and_update({"id": lid}, {"$set": upd}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="不存在")
    return r


@api_router.delete("/admin/payment-logos/{lid}")
async def delete_payment_logo(lid: str, admin: dict = Depends(require_role("admin"))):
    await db.payment_logos.delete_one({"id": lid})
    return {"ok": True}


# ----------------------------- Payment methods (wallet top-up) -----------------------------
PM_CATEGORIES = ("usdt", "card", "ewallet", "bank")
PM_PROVIDERS = ("manual", "stripe", "paypal", "alipay", "wechat", "crypto", "other")
PM_SECRET_KEYS = ("api_key", "api_secret", "webhook_secret")


class PaymentMethodIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    config: Optional[Dict[str, str]] = None
    min_usd: Optional[float] = None
    max_usd: Optional[float] = None
    fee_percent: Optional[float] = None
    image_b64: str = ""
    image_name: str = "logo.png"
    sort_order: Optional[int] = None
    active: Optional[bool] = None


DEFAULT_PAYMENT_METHODS = [
    {"name": "USDT 加密貨幣", "category": "usdt", "provider": "crypto", "image": "/payments/usdt.svg", "description": "支援 TRC20 網路 USDT，請依收銀台顯示的精確金額轉帳，鏈上確認後自動入帳。"},
    {"name": "信用卡 / VISA / MasterCard", "category": "card", "provider": "stripe", "image": "/payments/visa-mastercard.svg", "description": "支援 VISA、MasterCard、JCB、American Express，付款後即時入帳。"},
    {"name": "Apple Pay / Google Pay", "category": "ewallet", "provider": "stripe", "image": "/payments/apple-google-pay.svg", "description": "使用 Apple Pay 或 Google Pay 快速付款，即時入帳。"},
    {"name": "PayPal", "category": "ewallet", "provider": "paypal", "image": "/payments/paypal.svg", "description": "跳轉 PayPal 完成付款，手續費依 PayPal 規定。"},
    {"name": "銀行轉帳", "category": "bank", "provider": "manual", "image": "/payments/bank.svg", "description": "轉帳後請聯繫客服提供轉帳憑證，人工核對後入帳（約 10–30 分鐘）。"},
]


async def _ensure_payment_methods():
    if await db.payment_methods.count_documents({}) == 0:
        for i, m in enumerate(DEFAULT_PAYMENT_METHODS):
            await db.payment_methods.insert_one({"id": new_id(), **m, "config": {}, "min_usd": 50, "max_usd": 10000, "fee_percent": 0, "sort_order": i + 1, "active": True, "created_at": now_iso()})
        return
    for i, m in enumerate(DEFAULT_PAYMENT_METHODS):
        upd = {"sort_order": i + 1}
        if m["category"] == "usdt":
            upd["category"] = "usdt"
        await db.payment_methods.update_one({"name": m["name"], "image": {"$in": ["", None]}}, {"$set": {"image": m["image"], **upd}})
    await db.payment_methods.update_many({"provider": "crypto", "category": "ewallet"}, {"$set": {"category": "usdt"}})


def _channel_no(mid: str) -> str:
    return "CH" + str(10000 + (int(hashlib.md5((mid or "").encode()).hexdigest()[:5], 16) % 90000)) if mid else "-"


def _pm_public(m: dict) -> dict:
    return {k: v for k, v in m.items() if k != "config"}


def _pm_admin(m: dict) -> dict:
    cfg = dict(m.get("config") or {})
    for k in PM_SECRET_KEYS:
        if cfg.get(k):
            cfg[k] = cfg[k][:4] + "••••" + cfg[k][-2:] if len(cfg[k]) > 6 else "••••"
    return {**m, "config": cfg, "channel_no": _channel_no(m.get("id"))}


@api_router.get("/payment-methods")
async def list_payment_methods():
    await _ensure_payment_methods()
    ms = await db.payment_methods.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return [_pm_public(m) for m in ms]


@api_router.get("/admin/payment-methods")
async def admin_payment_methods(admin: dict = Depends(require_role("admin"))):
    await _ensure_payment_methods()
    ms = await db.payment_methods.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return [_pm_admin(m) for m in ms]


async def _pm_updates(body: PaymentMethodIn, existing: Optional[dict] = None) -> dict:
    upd = {}
    if body.name is not None:
        upd["name"] = body.name.strip()
    if body.category is not None:
        if body.category not in PM_CATEGORIES:
            raise HTTPException(status_code=400, detail="分類不正確")
        upd["category"] = body.category
    if body.provider is not None:
        if body.provider not in PM_PROVIDERS:
            raise HTTPException(status_code=400, detail="對接方式不正確")
        upd["provider"] = body.provider
    if body.description is not None:
        upd["description"] = body.description
    if body.config is not None:
        old = (existing or {}).get("config") or {}
        merged = {k: v for k, v in body.config.items() if v is not None}
        for k in PM_SECRET_KEYS:
            if "••" in merged.get(k, "") and old.get(k):
                merged[k] = old[k]
        upd["config"] = merged
    for k in ("min_usd", "max_usd", "fee_percent", "sort_order"):
        if getattr(body, k) is not None:
            upd[k] = getattr(body, k)
    if body.active is not None:
        upd["active"] = body.active
    if body.image_b64:
        upd["image"] = await _upload_b64("gogo589/payment-methods", body.image_b64, body.image_name)
    return upd


@api_router.post("/admin/payment-methods")
async def create_payment_method(body: PaymentMethodIn, admin: dict = Depends(require_role("admin"))):
    if not (body.name or "").strip():
        raise HTTPException(status_code=400, detail="請輸入支付方式名稱")
    count = await db.payment_methods.count_documents({})
    doc = {"id": new_id(), "category": "card", "provider": "manual", "description": "", "image": "", "config": {}, "min_usd": 50, "max_usd": 10000, "fee_percent": 0,
           "sort_order": count + 1, "active": True, "created_at": now_iso()}
    doc.update(await _pm_updates(body))
    await db.payment_methods.insert_one(doc)
    doc.pop("_id", None)
    return _pm_admin(doc)


@api_router.put("/admin/payment-methods/{mid}")
async def update_payment_method(mid: str, body: PaymentMethodIn, admin: dict = Depends(require_role("admin"))):
    existing = await db.payment_methods.find_one({"id": mid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="不存在")
    upd = await _pm_updates(body, existing)
    r = await db.payment_methods.find_one_and_update({"id": mid}, {"$set": upd}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    return _pm_admin(r)


@api_router.delete("/admin/payment-methods/{mid}")
async def delete_payment_method(mid: str, admin: dict = Depends(require_role("admin"))):
    await db.payment_methods.delete_one({"id": mid})
    return {"ok": True}


# ----------------------------- Wallet -----------------------------
class TopUpIn(BaseModel):
    amount_usd: float
    method: str = "card"
    method_id: str = ""


class OrderInfoIn(BaseModel):
    delivery_info: Dict[str, Dict[str, str]] = {}
    recharge_note: str = ""
    contact: str = ""


async def _wallet(user_id: str) -> float:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "wallet_balance_usd": 1}) or {}
    return float(u.get("wallet_balance_usd") or 0)


async def _wallet_tx(user_id: str, kind: str, amount_usd: float, note: str, ref: str = ""):
    bal = await _wallet(user_id)
    new_bal = round(bal + amount_usd, 2)
    if new_bal < -1e-9:
        raise HTTPException(status_code=402, detail="錢包餘額不足，請先充值")
    await db.users.update_one({"user_id": user_id}, {"$set": {"wallet_balance_usd": new_bal}}, upsert=True)
    await db.wallet_transactions.insert_one({"id": new_id(), "user_id": user_id, "kind": kind, "amount_usd": round(amount_usd, 2), "balance_after_usd": new_bal, "note": note, "ref": ref, "created_at": now_iso()})
    return new_bal


POINTS_DEFAULT = {"earn_enabled": True, "earn_per_usd": 1, "order_enabled": True, "topup_enabled": True, "redeem_enabled": False, "points_per_usd_redeem": 100, "min_redeem": 500}


async def get_points_config() -> dict:
    doc = await db.settings.find_one({"key": "points"}, {"_id": 0}) or {}
    return {**POINTS_DEFAULT, **(doc.get("value") or {})}


async def award_points(user_id: str, usd: float, source: str, ref: str = "", note: str = ""):
    cfg = await get_points_config()
    if not cfg.get("earn_enabled"):
        return
    if source == "order" and not cfg.get("order_enabled"):
        return
    if source == "topup" and not cfg.get("topup_enabled"):
        return
    pts = int(float(usd) * float(cfg.get("earn_per_usd") or 0))
    if pts <= 0:
        return
    if ref and await db.point_transactions.find_one({"user_id": user_id, "source": source, "ref": ref}, {"_id": 1}):
        return  # idempotent
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points": 1}) or {}
    new_bal = int(u.get("points") or 0) + pts
    await db.users.update_one({"user_id": user_id}, {"$set": {"points": new_bal}}, upsert=True)
    await db.point_transactions.insert_one({"id": new_id(), "user_id": user_id, "delta": pts, "balance_after": new_bal, "source": source,
                                            "reason": note or ("消費獲得積分" if source == "order" else "充值獲得積分"), "ref": ref, "created_at": now_iso()})
    return new_bal


async def log_user(user_id: str, type_: str, action: str, detail: str = "", ip: str = ""):
    try:
        await db.user_logs.insert_one({"id": new_id(), "user_id": user_id, "type": type_, "action": action, "detail": detail, "ip": ip, "created_at": now_iso()})
    except Exception as e:
        logger.warning("log_user failed: %s", e)


async def apply_recharge_bonus(user_id: str, amount_usd: float, ref: str):
    """On top-up settle, grant the best-matching recharge bonus (extra wallet or points)."""
    rules = await db.recharge_bonus_rules.find({"active": True}, {"_id": 0}).to_list(100)
    elig = [r for r in rules if amount_usd + 1e-9 >= (r.get("min_usd") or 0)]
    if not elig:
        return
    r = max(elig, key=lambda x: x.get("min_usd") or 0)
    bt = r.get("bonus_type")
    bv = float(r.get("bonus_value") or 0)
    if bv <= 0:
        return
    if bt == "fixed_usd":
        await _wallet_tx(user_id, "topup_bonus", round(bv, 2), f"充值贈送 USD$ {bv:.2f}", ref)
    elif bt == "percent":
        amt = round(amount_usd * bv / 100, 2)
        if amt > 0:
            await _wallet_tx(user_id, "topup_bonus", amt, f"充值贈送 {bv:.0f}%（USD$ {amt:.2f}）", ref)
    elif bt == "points":
        pts = int(bv)
        uu = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points": 1}) or {}
        nb = int(uu.get("points") or 0) + pts
        await db.users.update_one({"user_id": user_id}, {"$set": {"points": nb}})
        await db.point_transactions.insert_one({"id": new_id(), "user_id": user_id, "delta": pts, "balance_after": nb, "source": "recharge_bonus", "reason": f"充值贈送 {pts} 積分", "ref": ref, "created_at": now_iso()})
    await log_user(user_id, "topup", "充值贈送", r.get("bonus_type"))


async def check_levelup(user_id: str):
    """Detect a membership upgrade (spend-based) and grant the level's reward points / coupon once."""
    agg = await db.orders.aggregate([{"$match": {"user_id": user_id}}, {"$group": {"_id": None, "spent": {"$sum": "$total_usd"}}}]).to_list(1)
    spent = round((agg[0]["spent"] if agg else 0) or 0, 2)
    levels = await admin_api._levels()
    cur = admin_api._level_of(spent, levels)
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "level_name": 1}) or {}
    prev = u.get("level_name")
    if cur["name"] == prev:
        return
    idx = {lv["name"]: i for i, lv in enumerate(levels)}
    await db.users.update_one({"user_id": user_id}, {"$set": {"level_name": cur["name"]}})
    if prev is None or idx.get(cur["name"], 0) <= idx.get(prev, -1):
        return  # baseline set or not an upgrade
    lvl = next((lv for lv in levels if lv["name"] == cur["name"]), {})
    pts = int(lvl.get("reward_points") or 0)
    if pts > 0:
        uu = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points": 1}) or {}
        nb = int(uu.get("points") or 0) + pts
        await db.users.update_one({"user_id": user_id}, {"$set": {"points": nb}})
        await db.point_transactions.insert_one({"id": new_id(), "user_id": user_id, "delta": pts, "balance_after": nb, "source": "levelup", "reason": f"升級至{cur['name']}贈送", "ref": cur["name"], "created_at": now_iso()})
    code = (lvl.get("reward_coupon_code") or "").strip().upper()
    granted_coupon = False
    if code and await db.promos.find_one({"code": code, "active": True}, {"_id": 1}) and not await db.user_coupons.find_one({"user_id": user_id, "code": code}):
        await db.user_coupons.insert_one({"id": new_id(), "user_id": user_id, "code": code, "claimed_at": now_iso(), "source": "levelup"})
        granted_coupon = True
    reward_bits = []
    if pts > 0:
        reward_bits.append(f"{pts} 積分")
    if granted_coupon:
        reward_bits.append(f"專屬優惠券 {code}")
    reward_txt = ("升級禮包（" + "、".join(reward_bits) + "）") if reward_bits else "升級禮包"
    await log_user(user_id, "level", f"升級至{cur['name']}", (f"贈 {pts} 積分" if pts else "") + (f" + 優惠券 {code}" if granted_coupon else ""))
    asyncio.create_task(admin_api.notify_user(user_id, "level_up", {"level": cur["name"], "reward": (reward_txt + " ") if reward_bits else ""}))


@api_router.get("/me/wallet")
async def get_wallet(member: dict = Depends(current_member)):
    txs = await db.wallet_transactions.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    order_ids = [t["ref"] for t in txs if t.get("kind") == "payment" and t.get("ref")]
    if order_ids:
        orders = {o["id"]: o async for o in db.orders.find({"id": {"$in": order_ids}}, {"_id": 0, "id": 1, "order_no": 1, "status": 1, "items": 1})}
        for t in txs:
            o = orders.get(t.get("ref"))
            if o:
                t["order"] = {"id": o["id"], "order_no": o.get("order_no"), "status": o.get("status"),
                              "items": [{"product_name": i.get("product_name"), "spec_label": i.get("spec_label"), "quantity": i.get("quantity"), "image": i.get("image")} for i in o.get("items", [])]}
    u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "last_payment_method_id": 1}) or {}
    return {"balance_usd": await _wallet(member["user_id"]), "transactions": txs, "last_method_id": u.get("last_payment_method_id", "")}


@api_router.post("/me/wallet/topup")
async def wallet_topup(body: TopUpIn, member: dict = Depends(current_member)):
    label, pm = body.method, None
    if body.method_id:
        pm = await db.payment_methods.find_one({"id": body.method_id, "active": True}, {"_id": 0})
        if not pm:
            raise HTTPException(status_code=400, detail="支付方式無效或已停用")
        label = pm["name"]
        lo, hi = float(pm.get("min_usd") or 1), float(pm.get("max_usd") or 10000)
        if body.amount_usd < lo or body.amount_usd > hi:
            raise HTTPException(status_code=400, detail=f"此支付方式單次充值金額需介於 USD${lo:g} ~ USD${hi:g}")
    elif body.amount_usd < 50 or body.amount_usd > 10000:
        raise HTTPException(status_code=400, detail="單次充值金額需介於 USD$50 ~ USD$10,000")
    bal = await _wallet_tx(member["user_id"], "topup", float(body.amount_usd), f"錢包充值（{label}，測試支付）", ref=body.method_id)
    if pm:
        await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"last_payment_method_id": pm["id"]}})
    return {"balance_usd": bal}


# ----------------------------- USDT (TRC20) gateway -----------------------------
def _usdt_fmt(v) -> str:
    if isinstance(v, bool):
        return str(v).lower()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def _usdt_sign(params: dict, secret: str) -> str:
    items = sorted((k, _usdt_fmt(v)) for k, v in params.items() if k != "sign" and v is not None and v != "")
    s = "&".join(f"{k}={v}" for k, v in items)
    return hmac.new(secret.encode(), s.encode(), hashlib.sha256).hexdigest()


def _usdt_creds(pm: Optional[dict]) -> tuple:
    cfg = (pm or {}).get("config") or {}
    key = cfg.get("api_key") or os.environ.get("USDT_PAY_API_KEY", "")
    secret = cfg.get("api_secret") or os.environ.get("USDT_PAY_API_SECRET", "")
    base = (cfg.get("base_url") or os.environ.get("USDT_PAY_BASE_URL", "")).rstrip("/")
    if not (key and secret and base):
        raise HTTPException(status_code=503, detail="USDT 支付尚未設定")
    return key, secret, base


async def _usdt_call(path: str, payload: dict, key: str, secret: str, base: str) -> dict:
    payload = {"api_key": key, "timestamp": int(datetime.now(timezone.utc).timestamp()), "nonce": uuid.uuid4().hex, **payload}
    payload["sign"] = _usdt_sign(payload, secret)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{base}{path}", json=payload)
        data = r.json()
    except Exception as e:
        logger.warning("usdt gateway error: %s", e)
        raise HTTPException(status_code=502, detail="USDT 支付網關暫時無法連線，請稍後再試")
    if data.get("code") not in (0, "0"):
        raise HTTPException(status_code=502, detail=f"USDT 網關錯誤：{data.get('msg') or data.get('detail') or r.status_code}")
    return data.get("data") or {}


async def _usdt_settle(topup: dict, gw: dict) -> dict:
    r = await db.topup_orders.find_one_and_update({"id": topup["id"], "status": "pending"},
        {"$set": {"status": "paid", "paid_at": gw.get("paid_at") or now_iso(), "tx_id": gw.get("tx_id", ""), "pay_amount": gw.get("pay_amount", topup.get("pay_amount"))}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if r:
        label = topup.get("method_name") or f"USDT {topup.get('network', 'TRC20')}"
        bal = await _wallet_tx(topup["user_id"], "topup", float(topup["amount_usd"]), f"錢包充值（{label}）", ref=topup.get("order_no") or topup.get("out_trade_no", ""))
        await db.users.update_one({"user_id": topup["user_id"]}, {"$set": {"last_payment_method_id": topup.get("method_id", "")}})
        asyncio.create_task(admin_api.notify_user(topup["user_id"], "topup_paid", {"amount": f"USD$ {float(topup['amount_usd']):.2f}", "balance": f"USD$ {bal:.2f}"}))
        asyncio.create_task(award_points(topup["user_id"], float(topup["amount_usd"]), "topup", topup["id"]))
        asyncio.create_task(apply_recharge_bonus(topup["user_id"], float(topup["amount_usd"]), topup["id"]))
        asyncio.create_task(log_user(topup["user_id"], "topup", "錢包充值到賬", f"USD$ {float(topup['amount_usd']):.2f}（{label}）"))
        return r
    return await db.topup_orders.find_one({"id": topup["id"]}, {"_id": 0})


@api_router.post("/me/wallet/topup/usdt")
async def wallet_topup_usdt(body: TopUpIn, request: Request, member: dict = Depends(current_member)):
    pm = await db.payment_methods.find_one({"id": body.method_id, "active": True, "provider": "crypto"}, {"_id": 0})
    if not pm:
        raise HTTPException(status_code=400, detail="USDT 支付方式無效或已停用")
    lo, hi = float(pm.get("min_usd") or 1), float(pm.get("max_usd") or 10000)
    if body.amount_usd < lo or body.amount_usd > hi:
        raise HTTPException(status_code=400, detail=f"此支付方式單次充值金額需介於 USD${lo:g} ~ USD${hi:g}")
    key, secret, base = _usdt_creds(pm)
    public = (os.environ.get("APP_PUBLIC_URL") or request.headers.get("origin") or "").rstrip("/")
    tid = new_id()
    out_trade_no = f"TU{tid[:12].upper()}"
    amount = round(float(body.amount_usd), 2)
    gw = await _usdt_call("/api/v1/orders", {"amount_usdt": amount, "network": "TRC20", "out_trade_no": out_trade_no,
                                             "notify_url": f"{public}/api/payments/usdt/notify", "remark": f"gogo589 wallet {member['user_id'][-6:]}"}, key, secret, base)
    doc = {"id": tid, "user_id": member["user_id"], "method_id": pm["id"], "amount_usd": amount, "status": "pending", "out_trade_no": out_trade_no,
           "order_no": gw.get("order_no", ""), "pay_amount": gw.get("pay_amount", amount), "network": gw.get("network", "TRC20"),
           "wallet_address": gw.get("wallet_address", ""), "pay_url": gw.get("pay_url", ""), "expires_at": gw.get("expires_at", ""), "created_at": now_iso()}
    await db.topup_orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/me/wallet/topups")
async def wallet_topups(member: dict = Depends(current_member)):
    items = await db.topup_orders.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    now = now_iso()
    for t in items:
        if t["status"] == "pending" and t.get("expires_at") and t["expires_at"] < now:
            t["status"] = "expired"
            await db.topup_orders.update_one({"id": t["id"], "status": "pending"}, {"$set": {"status": "expired"}})
    return items


@api_router.get("/me/wallet/topup/{tid}")
async def wallet_topup_status(tid: str, request: Request, member: dict = Depends(current_member)):
    t = await db.topup_orders.find_one({"id": tid, "user_id": member["user_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="充值單不存在")
    if t["status"] == "pending" and t.get("provider") and t["provider"] != "crypto":
        t = await payments_api.refresh_status(t, request)
    elif t["status"] == "pending":
        pm = await db.payment_methods.find_one({"id": t.get("method_id")}, {"_id": 0})
        try:
            key, secret, base = _usdt_creds(pm)
            gw = await _usdt_call("/api/v1/orders/query", {"out_trade_no": t["out_trade_no"]}, key, secret, base)
            if gw.get("status") == "paid":
                t = await _usdt_settle(t, gw)
            elif gw.get("status") in ("expired", "cancelled", "closed", "failed"):
                await db.topup_orders.update_one({"id": tid, "status": "pending"}, {"$set": {"status": gw["status"]}})
                t["status"] = gw["status"]
        except HTTPException:
            pass
    t["balance_usd"] = await _wallet(member["user_id"])
    return t


@api_router.post("/payments/usdt/notify")
async def usdt_notify(request: Request):
    try:
        body = await request.json()
    except Exception:
        return PlainTextResponse("bad request", status_code=400)
    t = await db.topup_orders.find_one({"out_trade_no": body.get("out_trade_no", "")}, {"_id": 0})
    if not t:
        return PlainTextResponse("order not found", status_code=404)
    pm = await db.payment_methods.find_one({"id": t.get("method_id")}, {"_id": 0})
    cfg = (pm or {}).get("config") or {}
    secret = cfg.get("api_secret") or os.environ.get("USDT_PAY_API_SECRET", "")
    if not secret or not hmac.compare_digest(_usdt_sign(body, secret), str(body.get("sign", ""))):
        logger.warning("usdt notify bad sign for %s", body.get("out_trade_no"))
        return PlainTextResponse("invalid sign", status_code=400)
    if body.get("status") == "paid":
        await _usdt_settle(t, body)
    return PlainTextResponse("success")


def _info_complete(o: dict, products: Dict[str, dict]) -> bool:
    for it in o.get("items", []):
        p = products.get(it["product_id"]) or {}
        fields = p.get("delivery_fields") or []
        vals = (o.get("delivery_info") or {}).get(it["product_id"]) or {}
        for f in fields:
            if f.get("required") and not (vals.get(f["name"]) or "").strip():
                return False
        if not fields and not (o.get("recharge_account") or "").strip() and not vals:
            return False
    return True


@api_router.post("/orders/{order_id}/pay-wallet")
async def pay_order_wallet(order_id: str, member: dict = Depends(current_member)):
    o = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o["status"] != "pending_payment":
        return o
    await _wallet_tx(member["user_id"], "payment", -float(o["total_usd"]), f"訂單付款 {o['order_no']}", o["id"])
    prods = {it["product_id"]: (await db.products.find_one({"id": it["product_id"]}, {"_id": 0, "delivery_fields": 1}) or {}) for it in o["items"]}
    complete = _info_complete(o, prods)
    tl = o.get("timeline", []) + [{"status": "paid", "at": now_iso()}]
    upd = {"status": "paid", "paid_at": now_iso(), "timeline": tl, "payment_method": "wallet", "info_submitted": complete}
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    for it in o["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"sales_count": it["quantity"]}})
    asyncio.create_task(admin_api.notify_user(o["user_id"], "order_paid", admin_api.order_ctx(o)))
    asyncio.create_task(award_points(o["user_id"], float(o["total_usd"]), "order", o["id"]))
    asyncio.create_task(log_user(o["user_id"], "order", "訂單付款", f"{o['order_no']} · USD$ {float(o['total_usd']):.2f}（錢包支付）"))
    asyncio.create_task(check_levelup(o["user_id"]))
    await dispatch_giftcards({**o, **upd})
    return {**o, **upd}


@api_router.post("/orders/{order_id}/info")
async def submit_order_info(order_id: str, body: OrderInfoIn, member: dict = Depends(current_member)):
    o = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o["status"] not in ("paid", "pending_payment"):
        raise HTTPException(status_code=400, detail="此訂單已在處理中，無法修改資料")
    if o.get("info_submitted") and not o.get("info_rejected"):
        raise HTTPException(status_code=400, detail="充值資料已提交，如需修改請聯繫客服，待平台駁回後再重新填寫")
    merged = {**(o.get("delivery_info") or {}), **body.delivery_info}
    prods = {it["product_id"]: (await db.products.find_one({"id": it["product_id"]}, {"_id": 0, "delivery_fields": 1}) or {}) for it in o["items"]}
    tmp = {**o, "delivery_info": merged}
    if not _info_complete(tmp, prods):
        raise HTTPException(status_code=400, detail="請填寫所有必填的充值資料")
    first = next(iter(merged.values()), {})
    acct = next(iter(first.values()), o.get("recharge_account", ""))
    upd = {"delivery_info": merged, "recharge_account": acct, "info_submitted": True, "info_submitted_at": now_iso(), "info_rejected": False,
           "recharge_note": body.recharge_note or o.get("recharge_note", ""), "contact": body.contact or o.get("contact", "")}
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    return {**o, **upd}


class RejectInfoIn(BaseModel):
    reason: str = ""


@api_router.post("/admin/orders/{order_id}/reject-info")
async def admin_reject_info(order_id: str, body: RejectInfoIn, admin: dict = Depends(require_role("admin"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o["status"] not in ("paid", "processing"):
        raise HTTPException(status_code=400, detail="僅已付款 / 處理中的訂單可駁回充值資料")
    tl = o.get("timeline", []) + [{"status": "info_rejected", "at": now_iso(), "by": admin.get("email", "admin"), "note": body.reason}]
    upd = {"status": "paid", "info_submitted": False, "info_rejected": True, "info_reject_reason": body.reason.strip() or "充值帳號有誤，請重新填寫", "info_rejected_at": now_iso(), "timeline": tl}
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    asyncio.create_task(admin_api.notify_user(o["user_id"], "order_rejected", admin_api.order_ctx(o, reason=upd["info_reject_reason"])))
    return {**o, **upd}


@api_router.post("/admin/orders/{order_id}/confirm")
async def admin_confirm_topup(order_id: str, admin: dict = Depends(require_role("admin"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o["status"] not in ("paid", "processing", "shipped"):
        raise HTTPException(status_code=400, detail="訂單尚未付款或已完成")
    tl = o.get("timeline", []) + [{"status": "completed", "at": now_iso(), "by": admin.get("email", "admin")}]
    upd = {"status": "completed", "completed_at": now_iso(), "timeline": tl, "confirmed_by": admin.get("email", "")}
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    asyncio.create_task(admin_api.notify_user(o["user_id"], "order_completed", admin_api.order_ctx(o)))
    return {**o, **upd}


# ----------------------------- Member center -----------------------------
class ProfileIn(BaseModel):
    name: str = ""
    gender: str = ""
    contact_type: str = "微信"
    contact: str = ""


class VerificationIn(BaseModel):
    kind: str = "identity"  # identity | card
    doc_type: str = "護照"
    name: str
    image_b64: str = ""
    image_name: str = "doc.jpg"


class FeedbackIn(BaseModel):
    kind: str = "suggestion"  # suggestion | complaint | restock
    topic: str = ""
    content: str
    contact: str


@api_router.get("/me/profile")
async def get_profile(member: dict = Depends(current_member)):
    u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0}) or {}
    ctx = await _member_context(member["user_id"])
    return {"user_id": member["user_id"], "email": member.get("email", ""), "role": member["role"], "profile": u.get("profile") or {},
            "points": ctx["points"], "level": ctx["level"], "next_level": ctx["next_level"], "spent_usd": ctx["spent"],
            "account_no": str(100000000 + (int(hashlib.md5(member["user_id"].encode()).hexdigest()[:6], 16) % 900000000))}


@api_router.put("/me/profile")
async def put_profile(body: ProfileIn, member: dict = Depends(current_member)):
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"profile": body.model_dump()}}, upsert=True)
    return body


@api_router.get("/me/verifications")
async def my_verifications(member: dict = Depends(current_member)):
    return await db.verifications.find({"user_id": member["user_id"]}, {"_id": 0, "image_path": 0}).sort("created_at", -1).to_list(50)


@api_router.post("/me/verifications")
async def create_verification(body: VerificationIn, member: dict = Depends(current_member)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="請輸入姓名")
    if not body.image_b64:
        raise HTTPException(status_code=400, detail="請上傳證件圖片")
    raw = base64.b64decode(body.image_b64.split(",")[-1])
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="圖片大小需在 2M 以內")
    ext = (body.image_name.rsplit(".", 1)[-1] or "jpg").lower()
    if ext not in ("jpg", "jpeg", "png", "gif", "bmp"):
        raise HTTPException(status_code=400, detail="僅支援 JPG / PNG / GIF / BMP")
    path = f"gogo589/kyc/{member['user_id']}/{uuid.uuid4().hex}.{ext}"
    res = await run_in_threadpool(objstore.put_object, path, raw, {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "bmp": "image/bmp"}[ext])
    doc = {"id": new_id(), "user_id": member["user_id"], "user_email": member.get("email", ""), "kind": body.kind, "doc_type": body.doc_type, "name": body.name.strip(),
           "image_path": res["path"], "status": "reviewing", "admin_note": "", "created_at": now_iso()}
    await db.verifications.insert_one(doc)
    doc.pop("_id", None); doc.pop("image_path", None)
    return doc


@api_router.get("/admin/verifications")
async def admin_verifications(admin: dict = Depends(require_role("admin"))):
    return await db.verifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


class VerificationUpdate(BaseModel):
    status: str
    admin_note: str = ""


@api_router.put("/admin/verifications/{vid}")
async def admin_update_verification(vid: str, body: VerificationUpdate, admin: dict = Depends(require_role("admin"))):
    if body.status not in ("pending", "reviewing", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="狀態不正確")
    r = await db.verifications.find_one_and_update({"id": vid}, {"$set": {"status": body.status, "admin_note": body.admin_note}}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="不存在")
    return r


@api_router.get("/me/coupons")
async def my_coupons(member: dict = Depends(current_member)):
    claimed = await db.user_coupons.find({"user_id": member["user_id"]}, {"_id": 0}).to_list(100)
    codes = [c["code"] for c in claimed]
    promos = await db.promos.find({"code": {"$in": codes}}, {"_id": 0}).to_list(100)
    pm = {p["code"]: p for p in promos}
    used = {o.get("promo_code") async for o in db.orders.find({"user_id": member["user_id"], "promo_code": {"$in": codes}}, {"_id": 0, "promo_code": 1})}
    out = []
    for c in claimed:
        p = pm.get(c["code"])
        if not p:
            continue
        out.append({**{k: p.get(k) for k in ("code", "discount_type", "value", "min_order_usd", "expires_at", "active")}, "claimed_at": c["claimed_at"], "used": c["code"] in used,
                    "title": p.get("title") or ("新客專享" if "WELCOME" in p["code"] else "全站儲值優惠")})
    return out


class RedeemIn(BaseModel):
    code: str


@api_router.post("/me/coupons/redeem")
async def redeem_coupon(body: RedeemIn, member: dict = Depends(current_member)):
    code = body.code.strip().upper()
    p = await db.promos.find_one({"code": code, "active": True}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="優惠券碼無效")
    if p.get("expires_at") and p["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="優惠券已過期")
    if await db.user_coupons.find_one({"user_id": member["user_id"], "code": code}):
        raise HTTPException(status_code=409, detail="您已領取過此優惠券")
    await db.user_coupons.insert_one({"id": new_id(), "user_id": member["user_id"], "code": code, "claimed_at": now_iso()})
    return {"ok": True, "code": code}


@api_router.post("/me/feedback")
async def create_feedback(body: FeedbackIn, member: dict = Depends(current_member)):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="請輸入內容")
    if not body.contact.strip():
        raise HTTPException(status_code=400, detail="請填寫聯繫資訊")
    doc = {"id": new_id(), "user_id": member["user_id"], "user_email": member.get("email", ""), **body.model_dump(), "status": "open", "created_at": now_iso()}
    await db.feedback.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/admin/feedback")
async def admin_feedback(admin: dict = Depends(require_role("admin"))):
    return await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


class FeedbackUpdate(BaseModel):
    status: str
    admin_note: str = ""


@api_router.put("/admin/feedback/{fid}")
async def admin_update_feedback(fid: str, body: FeedbackUpdate, admin: dict = Depends(require_role("admin"))):
    if body.status not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="狀態不正確")
    r = await db.feedback.find_one_and_update({"id": fid}, {"$set": {"status": body.status, "admin_note": body.admin_note, "handled_by": admin.get("email", ""), "handled_at": now_iso()}},
                                              projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="不存在")
    return r


@api_router.get("/admin/verifications/{vid}/image")
async def admin_verification_image(vid: str, admin: dict = Depends(require_role("admin"))):
    v = await db.verifications.find_one({"id": vid}, {"_id": 0, "image_path": 1})
    if not v or not v.get("image_path"):
        raise HTTPException(status_code=404, detail="圖片不存在")
    try:
        data, ct = await run_in_threadpool(objstore.get_object, v["image_path"])
    except Exception:
        raise HTTPException(status_code=404, detail="圖片不存在")
    return {"data_url": f"data:{ct};base64,{base64.b64encode(data).decode()}"}


# ----------------------------- Admin wallet management -----------------------------
@api_router.get("/admin/wallets")
async def admin_wallets(q: str = "", admin: dict = Depends(require_role("admin"))):
    people = await db.users.find(IN_ENV, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "wallet_balance_usd": 1, "role": 1}).to_list(2000)
    agg = db.wallet_transactions.aggregate([{"$group": {"_id": "$user_id",
                                                         "total_in": {"$sum": {"$cond": [{"$gt": ["$amount_usd", 0]}, "$amount_usd", 0]}},
                                                         "total_out": {"$sum": {"$cond": [{"$lt": ["$amount_usd", 0]}, "$amount_usd", 0]}},
                                                         "tx_count": {"$sum": 1}}}])
    stats = {a["_id"]: a async for a in agg}
    out = []
    ql = q.strip().lower()
    for p in people:
        if ql and ql not in (p.get("email") or "").lower() and ql not in (p.get("name") or "").lower() and ql not in p["user_id"].lower():
            continue
        s = stats.get(p["user_id"], {})
        out.append({"user_id": p["user_id"], "email": p.get("email", ""), "name": p.get("name", ""), "role": effective_role(p.get("role")),
                    "balance_usd": round(float(p.get("wallet_balance_usd") or 0), 2), "total_in_usd": round(float(s.get("total_in", 0)), 2),
                    "total_out_usd": round(abs(float(s.get("total_out", 0))), 2), "tx_count": int(s.get("tx_count", 0))})
    out.sort(key=lambda x: -x["balance_usd"])
    return out


@api_router.get("/admin/wallets/{user_id}/transactions")
async def admin_wallet_transactions(user_id: str, admin: dict = Depends(require_role("admin"))):
    return await db.wallet_transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


class WalletAdjustIn(BaseModel):
    kind: str  # credit | debit | refund
    amount_usd: float
    note: str = ""


@api_router.post("/admin/wallets/{user_id}/adjust")
async def admin_wallet_adjust(user_id: str, body: WalletAdjustIn, admin: dict = Depends(require_role("admin"))):
    if body.kind not in ("credit", "debit", "refund"):
        raise HTTPException(status_code=400, detail="類型不正確")
    if body.amount_usd <= 0 or body.amount_usd > 100000:
        raise HTTPException(status_code=400, detail="金額需大於 0 且不超過 USD$100,000")
    if not await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1}):
        raise HTTPException(status_code=404, detail="用戶不存在")
    label = {"credit": "平台加款", "debit": "平台扣款", "refund": "平台退款"}[body.kind]
    signed = -float(body.amount_usd) if body.kind == "debit" else float(body.amount_usd)
    note = f"{label}" + (f"：{body.note.strip()}" if body.note.strip() else "")
    bal = await _wallet_tx(user_id, f"admin_{body.kind}", signed, note, ref=admin.get("email", ""))
    return {"user_id": user_id, "balance_usd": bal}


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, member: dict = Depends(current_member)):
    r = await db.orders.delete_one({"id": order_id, "user_id": member["user_id"], "status": "pending_payment"})
    if r.deleted_count == 0:
        raise HTTPException(status_code=400, detail="僅能刪除未付款訂單")
    return {"ok": True}


# ----------------------------- User (auth) endpoints -----------------------------
@api_router.get("/me")
async def get_me(member: dict = Depends(current_member)):
    return {"user_id": member["user_id"], "role": member["role"], "email": member.get("email", ""), "name": member.get("name", "")}


@api_router.post("/orders")
async def create_order(order: OrderIn, member: dict = Depends(current_member)):
    if not order.items:
        raise HTTPException(status_code=400, detail="購物車為空")
    ctx = await _member_context(member["user_id"])
    items, subtotal_usd, discount_usd, total_usd, promo_code, extras = await _compute_order(order, ctx)
    await _check_daily_limit(order, member["user_id"])
    # flash sale: per-user limit + atomic stock reservation
    flash_qty: Dict[str, int] = {}
    for it in items:
        fid = it.get("flash_id")
        if fid:
            flash_qty[fid] = flash_qty.get(fid, 0) + int(it["quantity"])
    for fid, qty in flash_qty.items():
        fs = await db.flash_sales.find_one({"id": fid}, {"_id": 0})
        if not fs or not fs.get("active"):
            raise HTTPException(status_code=409, detail="秒殺活動已結束")
        lim = int(fs.get("per_user_limit") or 0)
        if lim > 0 and (await _user_flash_bought(member["user_id"], fid)) + qty > lim:
            raise HTTPException(status_code=409, detail=f"此秒殺商品每人限購 {lim} 件")
        r = await db.flash_sales.find_one_and_update(
            {"id": fid, "$expr": {"$lte": [{"$add": [{"$ifNull": ["$sold", 0]}, qty]}, "$stock"]}},
            {"$inc": {"sold": qty}})
        if not r:
            raise HTTPException(status_code=409, detail="秒殺商品庫存不足，已被搶完")
    cur = await db.currencies.find_one({"code": order.currency, "active": True}, {"_id": 0}) or \
        {"code": "USD", "symbol": "$", "rate_to_usd": 1.0}
    order_no = "GT" + datetime.now(timezone.utc).strftime("%y%m%d") + uuid.uuid4().hex[:6].upper()
    doc = {
        "id": new_id(),
        "order_no": order_no,
        "user_id": member["user_id"],
        "user_email": member.get("email", ""),
        "items": items,
        "currency": cur["code"],
        "currency_symbol": cur["symbol"],
        "rate_to_usd": cur["rate_to_usd"],
        "subtotal_usd": subtotal_usd,
        "discount_usd": discount_usd,
        "level_discount_usd": extras["level_discount_usd"],
        "level_name": extras["level_name"],
        "level_discount_percent": extras["level_discount_percent"],
        "cart_discount_usd": extras["cart_discount_usd"],
        "cart_promo_title": extras["cart_promo_title"],
        "combo_discount_usd": extras["combo_discount_usd"],
        "combo_title": extras["combo_title"],
        "points_used": extras["points_used"],
        "points_discount_usd": extras["points_discount_usd"],
        "total_usd": total_usd,
        "promo_code": promo_code,
        "recharge_account": order.recharge_account,
        "recharge_note": order.recharge_note,
        "contact": order.contact,
        "delivery_info": order.delivery_info,
        "status": "pending_payment",
        "admin_note": "",
        "timeline": [{"status": "pending_payment", "at": now_iso()}],
        "created_at": now_iso(),
        "paid_at": None,
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    if extras["points_used"] > 0:
        u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "points": 1}) or {}
        new_pts = max(0, int(u.get("points") or 0) - extras["points_used"])
        await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"points": new_pts}})
        await db.point_transactions.insert_one({"id": new_id(), "user_id": member["user_id"], "delta": -extras["points_used"], "balance_after": new_pts,
                                                "source": "redeem", "reason": f"下單抵現 {order_no}", "ref": doc["id"], "created_at": now_iso()})
    asyncio.create_task(log_user(member["user_id"], "order", "創建訂單", f"{doc['order_no']} · USD$ {float(doc['total_usd']):.2f}"))
    return doc


@api_router.post("/orders/quote")
async def order_quote(order: OrderIn, member: dict = Depends(current_member)):
    ctx = await _member_context(member["user_id"])
    items, subtotal_usd, discount_usd, total_usd, promo_code, extras = await _compute_order(order, ctx)
    cfg = await get_points_config()
    return {"subtotal_usd": subtotal_usd, "discount_usd": discount_usd, "total_usd": total_usd, "promo_code": promo_code, **extras,
            "points_available": ctx["points"], "level": ctx["level"], "redeem_enabled": bool(cfg.get("redeem_enabled")),
            "points_per_usd_redeem": cfg.get("points_per_usd_redeem"), "min_redeem": cfg.get("min_redeem")}


@api_router.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, member: dict = Depends(current_member)):
    o = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    if o["status"] != "pending_payment":
        return o
    tl = o.get("timeline", [])
    tl.append({"status": "paid", "at": now_iso()})
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "paid", "paid_at": now_iso(), "timeline": tl}})
    o["status"] = "paid"
    o["paid_at"] = now_iso()
    o["timeline"] = tl
    for it in o["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"sales_count": it["quantity"]}})
    asyncio.create_task(admin_api.notify_user(o["user_id"], "order_paid", admin_api.order_ctx(o)))
    asyncio.create_task(award_points(o["user_id"], float(o["total_usd"]), "order", o["id"]))
    asyncio.create_task(log_user(o["user_id"], "order", "訂單付款", f"{o['order_no']} · USD$ {float(o['total_usd']):.2f}"))
    asyncio.create_task(check_levelup(o["user_id"]))
    await dispatch_giftcards(o)
    return o


@api_router.get("/orders")
async def my_orders(status: Optional[str] = None, member: dict = Depends(current_member)):
    query = {"user_id": member["user_id"]}
    if status == "awaiting_info":
        query.update({"status": "paid", "info_submitted": False})
    elif status == "waiting":
        query.update({"$or": [{"status": "paid", "info_submitted": {"$ne": False}}, {"status": {"$in": ["processing", "shipped"]}}]})
    elif status and status != "all":
        query["status"] = status
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, member: dict = Depends(current_member)):
    scope = {} if member["role"] == "admin" else {"user_id": member["user_id"]}
    o = await db.orders.find_one({"id": order_id, **scope}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="訂單不存在")
    return o


# ----------------------------- Admin endpoints -----------------------------
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_role("admin"))):
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    revenue = sum(o["total_usd"] for o in orders if o["status"] in ("paid", "processing", "shipped", "completed"))
    by_status = {s: 0 for s in ORDER_STATUSES}
    for o in orders:
        by_status[o["status"]] = by_status.get(o["status"], 0) + 1
    pending_dispatch = by_status.get("paid", 0) + by_status.get("processing", 0)
    product_count = await db.products.count_documents({})
    user_count = await db.users.count_documents(IN_ENV)
    return {
        "revenue_usd": round(revenue, 2),
        "order_count": len(orders),
        "by_status": by_status,
        "pending_dispatch": pending_dispatch,
        "product_count": product_count,
        "user_count": user_count,
    }


PRODUCT_TEXT_KEYS = ("name", "brand", "subtitle", "description", "content_html", "tutorial", "account_field_label", "account_field_hint")


async def _prep_product(body: "ProductIn") -> dict:
    d = body.model_dump()
    if d["image"].startswith("data:image"):
        d["image"] = await _upload_b64("gogo589/products", d["image"], "product.png", max_mb=4)
    for k in PRODUCT_TEXT_KEYS:
        if d.get(k):
            d[k] = to_traditional(d[k])
    d["tags"] = [to_traditional(t.strip()) for t in d["tags"] if t.strip()]
    for s in d["specs"]:
        s["label"] = to_traditional(s["label"])
        s["badge"] = to_traditional(s["badge"] or "").strip()
        if not s.get("id") or s["id"].startswith("new-"):
            s["id"] = new_id()
    for f in d["delivery_fields"]:
        for k in ("name", "placeholder", "tips"):
            f[k] = to_traditional(f[k] or "")
        f["options"] = [to_traditional(o) for o in f["options"] if o.strip()]
    if d["delivery_fields"]:
        d["account_field_label"] = d["delivery_fields"][0]["name"]
        d["account_field_hint"] = d["delivery_fields"][0]["tips"]
    return d


@api_router.get("/admin/products")
async def admin_list_products(q: str = "", category: str = "", active: str = "", ids: str = "", page: int = 1, size: int = 30, admin: dict = Depends(require_role("admin"))):
    cond: dict = {}
    if ids:
        cond["id"] = {"$in": [i for i in ids.split(",") if i]}
    if category:
        cond["category"] = category
    if active in ("true", "false"):
        cond["active"] = active == "true"
    if q:
        pats = [{"name": {"$regex": re.escape(v), "$options": "i"}} for v in {q, to_simplified(q), to_traditional(q)}]
        cond["$or"] = pats + [{"brand": {"$regex": re.escape(q), "$options": "i"}}, {"id": q}]
    total = await db.products.count_documents(cond)
    proj = {"_id": 0, "content_html": 0, "description": 0, "tutorial": 0, "delivery_fields": 0, "group": 0, "related_ids": 0}
    rows = await db.products.find(cond, proj).sort([("sort_order", 1), ("sales_count", -1)]).skip((page - 1) * size).to_list(size)
    return {"total": total, "rows": rows}


@api_router.get("/admin/products/badges")
async def admin_product_badges(admin: dict = Depends(require_role("admin"))):
    agg = db.products.aggregate([{"$unwind": "$specs"}, {"$match": {"specs.badge": {"$nin": ["", " ", None]}}}, {"$group": {"_id": "$specs.badge", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 40}])
    return [r["_id"].strip() for r in await agg.to_list(40)]


@api_router.get("/admin/products/{product_id}")
async def admin_get_product(product_id: str, admin: dict = Depends(require_role("admin"))):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    rel = p.get("related_ids") or []
    if rel:
        docs = await db.products.find({"id": {"$in": rel}}, {"_id": 0, "id": 1, "name": 1, "image": 1}).to_list(50)
        order = {i: n for n, i in enumerate(rel)}
        p["related"] = sorted(docs, key=lambda d: order.get(d["id"], 99))
    return p


@api_router.post("/admin/products")
async def admin_create_product(body: ProductIn, admin: dict = Depends(require_role("admin"))):
    d = await _prep_product(body)
    p = Product(**{k: v for k, v in d.items() if k != "related_ids"}).model_dump()
    p["related_ids"] = d["related_ids"]
    await db.products.insert_one({**p})
    return p


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, admin: dict = Depends(require_role("admin"))):
    d = await _prep_product(body)
    r = await db.products.find_one_and_update(
        {"id": product_id}, {"$set": d},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r


class BulkIn(BaseModel):
    ids: List[str]
    action: str
    value: object = None


@api_router.post("/admin/products/bulk")
async def admin_bulk_products(body: BulkIn, admin: dict = Depends(require_role("admin"))):
    if not body.ids:
        raise HTTPException(status_code=400, detail="未選擇商品")
    q = {"id": {"$in": body.ids}}
    a, v = body.action, body.value
    if a == "set_active":
        r = await db.products.update_many(q, {"$set": {"active": bool(v)}})
    elif a == "set_category":
        if not v or not await db.categories.find_one({"id": str(v)}):
            raise HTTPException(status_code=400, detail="分類不存在")
        r = await db.products.update_many(q, {"$set": {"category": str(v)}})
    elif a in ("add_tags", "remove_tags"):
        tags = [to_traditional(t.strip()) for t in (v if isinstance(v, list) else str(v or "").split(",")) if t.strip()]
        if not tags:
            raise HTTPException(status_code=400, detail="請輸入標籤")
        r = await db.products.update_many(q, {"$addToSet": {"tags": {"$each": tags}}} if a == "add_tags" else {"$pull": {"tags": {"$in": tags}}})
    elif a == "delete":
        r = await db.products.delete_many(q)
        return {"ok": True, "count": r.deleted_count}
    else:
        raise HTTPException(status_code=400, detail="未知操作")
    return {"ok": True, "count": r.modified_count}


@api_router.patch("/admin/products/{product_id}")
async def admin_patch_product(product_id: str, body: Dict[str, object], admin: dict = Depends(require_role("admin"))):
    allowed = {k: v for k, v in body.items() if k in ("active", "sort_order", "sales_count", "tags")}
    if not allowed:
        raise HTTPException(status_code=400, detail="nothing to update")
    r = await db.products.find_one_and_update({"id": product_id}, {"$set": allowed}, projection={"_id": 0, "content_html": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.products.delete_one({"id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


def _orders_query(status: Optional[str], q: str, date_from: str, date_to: str, info: str = "") -> dict:
    query: dict = {}
    if status and status != "all":
        if status == "awaiting_info":
            query.update({"status": "paid", "info_submitted": False})
        else:
            query["status"] = status
    if info == "rejected":
        query["info_rejected"] = True
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from if "T" in date_from else f"{date_from}T00:00:00"
    if date_to:
        query.setdefault("created_at", {})["$lt"] = date_to if "T" in date_to else f"{date_to}T23:59:59.999999"
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        ors = [{"order_no": rx}, {"user_email": rx}, {"recharge_account": rx}, {"contact": rx}, {"items.product_name": rx}, {"user_id": q.strip()}]
        for v in {to_simplified(q), to_traditional(q)} - {q}:
            ors.append({"items.product_name": {"$regex": re.escape(v), "$options": "i"}})
        query["$or"] = ors
    return query


@api_router.get("/admin/orders")
async def admin_list_orders(status: Optional[str] = None, q: str = "", date_from: str = "", date_to: str = "", info: str = "", page: int = 1, size: int = 30, admin: dict = Depends(require_role("admin"))):
    query = _orders_query(status, q, date_from, date_to, info)
    total = await db.orders.count_documents(query)
    rows = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * max(1, size)).to_list(max(1, min(size, 200)))
    agg = await db.orders.aggregate([{"$match": query}, {"$group": {"_id": None, "total_usd": {"$sum": "$total_usd"}, "paid_usd": {"$sum": {"$cond": [{"$in": ["$status", ["paid", "processing", "shipped", "completed"]]}, "$total_usd", 0]}}}}]).to_list(1)
    counts = {r["_id"]: r["n"] for r in await db.orders.aggregate([{"$match": {k: v for k, v in query.items() if k != "status" and k != "info_submitted"}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(20)}
    summary = {"total_usd": round((agg[0]["total_usd"] if agg else 0) or 0, 2), "paid_usd": round((agg[0]["paid_usd"] if agg else 0) or 0, 2), "by_status": counts}
    return {"total": total, "rows": rows, "summary": summary}


@api_router.get("/admin/orders/export")
async def admin_export_orders(status: Optional[str] = None, q: str = "", date_from: str = "", date_to: str = "", info: str = "", admin: dict = Depends(require_role("admin"))):
    import csv
    import io
    from fastapi.responses import StreamingResponse
    query = _orders_query(status, q, date_from, date_to, info)
    rows = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(20000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["訂單編號", "建立時間", "狀態", "用戶信箱", "用戶ID", "商品", "充值帳號", "填寫資料", "聯絡資訊", "幣別", "小計USD", "折扣USD", "總額USD", "優惠碼", "客服備註", "付款時間", "完成時間"])
    for o in rows:
        items = "；".join(f"{i.get('product_name', '')} {i.get('spec_label', '')}×{i.get('quantity', 1)}" for i in o.get("items", []))
        info_txt = "；".join(f"{k}:{v}" for f in (o.get("delivery_info") or {}).values() for k, v in f.items())
        w.writerow([o.get("order_no"), (o.get("created_at") or "")[:19].replace("T", " "), STATUS_LABELS.get(o.get("status"), o.get("status")), o.get("user_email", ""), o.get("user_id", ""), items,
                    o.get("recharge_account", ""), info_txt, o.get("contact", ""), o.get("currency", ""), o.get("subtotal_usd", ""), o.get("discount_usd", ""), o.get("total_usd", ""), o.get("promo_code") or "",
                    o.get("admin_note", ""), (o.get("paid_at") or "")[:19].replace("T", " "), (o.get("completed_at") or "")[:19].replace("T", " ")])
    fname = f"orders_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(iter([("\ufeff" + buf.getvalue()).encode("utf-8")]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, body: StatusUpdate, admin: dict = Depends(require_role("admin"))):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Not found")
    tl = o.get("timeline", [])
    if not tl or tl[-1]["status"] != body.status:
        tl.append({"status": body.status, "at": now_iso()})
    update = {"status": body.status, "timeline": tl}
    if body.admin_note is not None:
        update["admin_note"] = body.admin_note
    if body.status == "cancelled" and o.get("status") in ("paid", "processing", "shipped", "exception") and o.get("payment_method") == "wallet" and not o.get("refunded_at"):
        await _wallet_tx(o["user_id"], "refund", float(o.get("total_usd") or 0), f"訂單取消退款 {o.get('order_no') or o['id']}", o["id"])
        update["refunded_at"] = now_iso()
        update["refund_usd"] = float(o.get("total_usd") or 0)
    if body.status == "cancelled" and o.get("status") != "cancelled" and int(o.get("points_used") or 0) > 0 and not await db.point_transactions.find_one({"source": "redeem_refund", "ref": o["id"]}, {"_id": 1}):
        u = await db.users.find_one({"user_id": o["user_id"]}, {"_id": 0, "points": 1}) or {}
        new_pts = int(u.get("points") or 0) + int(o["points_used"])
        await db.users.update_one({"user_id": o["user_id"]}, {"$set": {"points": new_pts}})
        await db.point_transactions.insert_one({"id": new_id(), "user_id": o["user_id"], "delta": int(o["points_used"]), "balance_after": new_pts,
                                                "source": "redeem_refund", "reason": f"訂單取消退回積分 {o.get('order_no') or o['id']}", "ref": o["id"], "created_at": now_iso()})
    await db.orders.update_one({"id": order_id}, {"$set": update})
    if body.status == "cancelled" and o.get("status") != "cancelled" and not o.get("flash_released"):
        fq: Dict[str, int] = {}
        for it in o.get("items", []):
            fid = it.get("flash_id")
            if fid:
                fq[fid] = fq.get(fid, 0) + int(it.get("quantity") or 0)
        for fid, qty in fq.items():
            await db.flash_sales.update_one({"id": fid}, {"$inc": {"sold": -qty}})
        if fq:
            await db.orders.update_one({"id": order_id}, {"$set": {"flash_released": True}})
    if body.status == "completed" and o.get("status") != "completed":
        asyncio.create_task(admin_api.notify_user(o["user_id"], "order_completed", admin_api.order_ctx(o)))
    elif body.status == "cancelled" and o.get("status") != "cancelled":
        reason = f"取消原因：{body.admin_note}。" if body.admin_note else ""
        asyncio.create_task(admin_api.notify_user(o["user_id"], "order_cancelled", admin_api.order_ctx(o, reason=reason, refunded="是" if update.get("refunded_at") else "否")))
    return {**o, **update}


@api_router.get("/admin/currencies")
async def admin_list_currencies(admin: dict = Depends(require_role("admin"))):
    return await db.currencies.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)


@api_router.put("/admin/currencies/{code}")
async def admin_update_currency(code: str, body: Currency, admin: dict = Depends(require_role("admin"))):
    upd = body.model_dump()
    if body.auto_rate is None:
        upd.pop("auto_rate")
    await db.currencies.update_one({"code": code}, {"$set": upd}, upsert=True)
    return await db.currencies.find_one({"code": code}, {"_id": 0})


@api_router.post("/admin/currencies/refresh")
async def admin_refresh_rates(admin: dict = Depends(require_role("admin"))):
    return await refresh_rates()


@api_router.post("/cron/refresh-rates")
async def cron_refresh_rates(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    run_id = request.headers.get("x-webhook-id") or uuid.uuid4().hex
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"ok": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "refresh-rates", "created_at": now_iso()})
    asyncio.create_task(refresh_rates())
    return {"ok": True}


@api_router.get("/admin/promos")
async def admin_list_promos(admin: dict = Depends(require_role("admin"))):
    return await db.promos.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/promos")
async def admin_create_promo(body: PromoIn, admin: dict = Depends(require_role("admin"))):
    data = body.model_dump()
    data["code"] = data["code"].strip().upper()
    p = Promo(**data)
    await db.promos.insert_one(p.model_dump())
    return p.model_dump()


@api_router.put("/admin/promos/{promo_id}")
async def admin_update_promo(promo_id: str, body: PromoIn, admin: dict = Depends(require_role("admin"))):
    data = body.model_dump()
    data["code"] = data["code"].strip().upper()
    r = await db.promos.find_one_and_update({"id": promo_id}, {"$set": data},
                                            projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@api_router.delete("/admin/promos/{promo_id}")
async def admin_delete_promo(promo_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.promos.delete_one({"id": promo_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.get("/admin/reviews")
async def admin_list_reviews(admin: dict = Depends(require_role("admin"))):
    return await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/reviews")
async def admin_create_review(body: ReviewIn, admin: dict = Depends(require_role("admin"))):
    r = Review(**body.model_dump())
    await db.reviews.insert_one(r.model_dump())
    return r.model_dump()


@api_router.put("/admin/reviews/{review_id}")
async def admin_update_review(review_id: str, body: ReviewIn, admin: dict = Depends(require_role("admin"))):
    r = await db.reviews.find_one_and_update({"id": review_id}, {"$set": body.model_dump()},
                                             projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.reviews.delete_one({"id": review_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.get("/users")
async def list_users(admin: dict = Depends(require_role("admin"))):
    people = await db.users.find(IN_ENV, {"_id": 0}).to_list(2000)
    for p in people:
        p["order_count"] = await db.orders.count_documents({"user_id": p["user_id"]})
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


class RoleIn(BaseModel):
    role: str


@api_router.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_role("admin"))):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    return {"user_id": user_id, "role": body.role}


@api_router.get("/status-labels")
async def status_labels():
    return STATUS_LABELS


# ----------------------------- Seed -----------------------------
DEFAULT_CURRENCIES = [
    {"code": "USD", "symbol": "$", "name": "美元", "flag": "🇺🇸", "rate_to_usd": 1.00},
    {"code": "CNY", "symbol": "¥", "name": "人民幣", "flag": "🇨🇳", "rate_to_usd": 7.25},
    {"code": "HKD", "symbol": "HK$", "name": "港幣", "flag": "🇭🇰", "rate_to_usd": 7.82},
    {"code": "TWD", "symbol": "NT$", "name": "新台幣", "flag": "🇹🇼", "rate_to_usd": 32.20},
    {"code": "SGD", "symbol": "S$", "name": "新加坡幣", "flag": "🇸🇬", "rate_to_usd": 1.35},
    {"code": "MYR", "symbol": "RM", "name": "馬來西亞令吉", "flag": "🇲🇾", "rate_to_usd": 4.70},
    {"code": "THB", "symbol": "฿", "name": "泰銖", "flag": "🇹🇭", "rate_to_usd": 36.50},
    {"code": "JPY", "symbol": "¥", "name": "日圓", "flag": "🇯🇵", "rate_to_usd": 155.40},
    {"code": "KRW", "symbol": "₩", "name": "韓元", "flag": "🇰🇷", "rate_to_usd": 1380.0},
    {"code": "EUR", "symbol": "€", "name": "歐元", "flag": "🇪🇺", "rate_to_usd": 0.92},
    {"code": "GBP", "symbol": "£", "name": "英鎊", "flag": "🇬🇧", "rate_to_usd": 0.79},
    {"code": "AUD", "symbol": "A$", "name": "澳幣", "flag": "🇦🇺", "rate_to_usd": 1.52},
    {"code": "CAD", "symbol": "C$", "name": "加幣", "flag": "🇨🇦", "rate_to_usd": 1.37},
    {"code": "PHP", "symbol": "₱", "name": "菲律賓披索", "flag": "🇵🇭", "rate_to_usd": 57.0},
    {"code": "IDR", "symbol": "Rp", "name": "印尼盾", "flag": "🇮🇩", "rate_to_usd": 16200.0},
    {"code": "VND", "symbol": "₫", "name": "越南盾", "flag": "🇻🇳", "rate_to_usd": 25400.0},
    {"code": "INR", "symbol": "₹", "name": "印度盧比", "flag": "🇮🇳", "rate_to_usd": 83.5},
    {"code": "AED", "symbol": "د.إ", "name": "阿聯酋迪拉姆", "flag": "🇦🇪", "rate_to_usd": 3.67},
]


async def refresh_rates() -> dict:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get("https://open.er-api.com/v6/latest/USD")
        rates = r.json().get("rates") or {}
    except Exception as e:
        logger.warning("rate refresh failed: %s", e)
        return {"updated": 0, "error": str(e)}
    n = 0
    async for c in db.currencies.find({"auto_rate": {"$ne": False}}, {"_id": 0, "code": 1}):
        if rates.get(c["code"]):
            await db.currencies.update_one({"code": c["code"]}, {"$set": {"rate_to_usd": round(float(rates[c["code"]]), 6), "rate_updated_at": now_iso()}})
            n += 1
    logger.info("rates refreshed: %d", n)
    return {"updated": n}


async def seed():
    for i, c in enumerate(DEFAULT_CURRENCIES):
        await db.currencies.update_one({"code": c["code"]}, {"$setOnInsert": {**c, "active": True}, "$set": {"sort_order": i}}, upsert=True)
        await db.currencies.update_one({"code": c["code"], "auto_rate": {"$exists": False}}, {"$set": {"auto_rate": True}})
    IMG = "https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/"
    ICONS = {
        "shortvideo": "/icons/shortvideo.png",
        "live": "/icons/live.png",
        "game": "/icons/game.png",
        "music": "/icons/music.png",
        "social": "/icons/social.png",
        "voice": "/icons/voice.png",
        "reading": "/icons/reading.png",
        "ai": "/icons/ai.png",
        "giftcard": "/icons/giftcard.png",
        "point": "/icons/point.png",
    }
    SEED_VERSION = 9
    meta = await db.meta.find_one({"_id": "seed"})
    if not meta or meta.get("version") != SEED_VERSION:
        await db.categories.delete_many({})
        await db.products.delete_many({})
        await db.reviews.delete_many({})
        await db.promos.delete_many({})
        await db.meta.update_one({"_id": "seed"}, {"$set": {"version": SEED_VERSION}}, upsert=True)

    CATS = [
        ("livestream", "直播平臺", ICONS["live"]),
        ("games", "遊戲充值", ICONS["game"]),
        ("social", "社交平臺", ICONS["social"]),
        ("video-music", "視頻音訊", ICONS["music"]),
        ("play", "陪玩陪聊", ICONS["voice"]),
        ("voice", "語音交友", ICONS["voice"]),
        ("literary", "文學動漫", ICONS["reading"]),
        ("pointcard", "平臺點卡", ICONS["point"]),
        ("life", "生活日常", ICONS["giftcard"]),
        ("accelerator", "加速工具", ICONS["point"]),
        ("ai", "人工智慧 AI", ICONS["ai"]),
    ]
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([
            {"id": cid, "name": name, "icon": "", "image": icon, "sort_order": i + 1}
            for i, (cid, name, icon) in enumerate(CATS)
        ])
    if await db.products.count_documents({}) == 0:
        def specs(pairs):
            return [{"id": new_id(), "label": l, "price_usd": p, "in_stock": True} for l, p in pairs]
        COIN = [("60 幣", 0.99), ("300 幣", 4.99), ("980 幣", 14.99), ("1980 幣", 29.99), ("3280 幣", 49.99)]
        VIP = [("1 個月", 8.99), ("3 個月", 24.99), ("12 個月", 89.99)]
        CARD = [("US$10", 10.49), ("US$25", 25.49), ("US$50", 49.99), ("US$100", 98.99)]
        CATALOG = {
            "livestream": (ICONS["shortvideo"], COIN, ["抖音抖幣充值", "快幣", "bilibili直播 電池", "Bigo Live 鑽石", "虎牙幣", "陌陌幣", "YY直播 Y幣", "映客鑽石", "花椒直播 花椒豆", "一直播 粒子", "酷狗直播 星幣", "繁星直播 星鑽", "六間房 六幣", "NOW直播 玫瑰", "來瘋直播 來瘋幣", "章魚直播 魚丸", "龍珠直播 龍珠", "17LIVE 鑽石", "Uplive 金幣", "Twitch Bits"]),
            "games": (ICONS["game"], COIN, ["王者榮耀 點券", "和平精英 點券", "原神 創世結晶", "PUBG Mobile UC", "火影忍者 點券", "三角洲行動", "蛋仔派對 蛋幣", "逆水寒 金幣", "崩壞星穹鐵道 星瓊", "絕區零 菲林", "陰陽師 勾玉", "第五人格 回聲", "明日方舟 合成玉", "夢幻西遊 仙玉", "傳說對決 鑽石", "Free Fire 鑽石", "Mobile Legends 鑽石", "金鏟鏟之戰 點券", "光遇 創作蠟燭", "元夢之星 星鑽"]),
            "social": (ICONS["social"], COIN, ["小紅書 薯幣", "QQ 黃鑽", "Soul Soul幣", "探探 會員", "Lofter 樂乎幣", "盒島 充值", "Weplay 充值", "HelloTalk HT幣", "微博 會員", "積目 會員", "伊對 玫瑰", "青藤之戀 會員", "Summer 充值", "一周CP 會員", "Tinder 會員", "Bumble 會員", "他趣 金幣", "回聲 充值", "陌陌 陌陌幣", "心動 充值"]),
            "video-music": (ICONS["music"], VIP, ["貓耳FM 鑽石", "全民K歌 K幣", "bilibili 大會員", "騰訊視頻 VIP", "愛奇藝 VIP", "網易雲音樂 會員", "芒果TV 會員", "QQ音樂 綠鑽", "優酷 VIP", "酷狗音樂 會員", "酷我音樂 會員", "咪咕音樂 會員", "喜馬拉雅 會員", "蜻蜓FM 會員", "荔枝FM 充值", "懶人聽書 會員", "番茄暢聽 會員", "唱吧 K幣", "西瓜視頻 充值", "Spotify 會員"]),
            "play": (ICONS["voice"], COIN, ["TT語音 T豆", "比心 鑽石", "KOOK 充值", "撈月狗 狗糧", "Wefun 充值", "可樂語音", "不二開黑 金幣", "Yoho 充值", "魚泡泡 充值", "嗨皮 充值", "開黑啦 充值", "咪呀 充值", "魚耳 充值", "大神 充值", "暴雞電競 充值", "猴急 充值", "戰吼 充值", "玩吧 金幣", "一起玩 金幣", "螃蟹電競 充值"]),
            "voice": (ICONS["voice"], COIN, ["他ta星球 星幣", "咕咕語音 鑽石", "氧氣語音 金幣", "MOMI 金幣", "微光 光點", "知聊 聊幣", "SUSU 充值", "西柚語音 CUCU", "嗨吧語音 充值", "糖果語音 充值", "一耳語音 充值", "遇見語音 充值", "音遇 音符", "吱呀 充值", "遞爪 充值", "克拉克拉 充值", "貓耳語音 充值", "心遇 充值", "連信 金幣", "伴伴 充值"]),
            "literary": (ICONS["reading"], VIP, ["騰訊動漫 會員", "晉江文學城", "起點讀書", "知乎鹽選 會員", "bilibili 漫畫", "快看漫畫 VIP", "QQ閱讀 書幣", "刺蝟貓 充值"]),
            "pointcard": (ICONS["giftcard"], CARD, ["蘋果 iTunes 中國區", "Steam 錢包", "Google Play 點數", "Netflix 禮品卡", "Spotify Premium", "PSN 點數卡", "Razer Gold", "Xbox 禮品卡"]),
            "life": (ICONS["giftcard"], COIN, ["美團 充值", "餓了麼 會員", "滴滴出行 券", "高德打車", "瑞幸咖啡 券", "盒馬 充值", "叮咚買菜", "順豐寄件"]),
            "accelerator": (ICONS["point"], VIP, ["奇遊加速器", "UU 加速器", "雷神加速器", "迅遊加速器", "Biubiu 加速器", "AK 加速器", "薯條加速器", "輕蜂加速"]),
            "ai": (ICONS["ai"], VIP, ["ChatGPT Plus", "Claude Pro", "文心一言 會員", "Midjourney", "通義千問 會員", "Kimi 會員", "豆包 會員", "妙鴨相機"]),
        }
        hot = {"抖音抖幣充值", "快幣", "王者榮耀 點券", "原神 創世結晶", "小紅書 薯幣", "貓耳FM 鑽石", "Bigo Live 鑽石", "Netflix 禮品卡", "ChatGPT Plus", "全民K歌 K幣"}
        products = []
        order = 0
        for cat, _cname, _ in CATS:
            icon, tmpl, names = CATALOG[cat]
            for idx, pname in enumerate(names):
                order += 1
                tags = ["熱銷"] if pname in hot else []
                sales = (1600 - idx * 150) * 600 + order * 97
                products.append(Product(
                    name=pname, category=cat, brand=pname.split(" ")[0][:8], image=icon,
                    description=f"{pname} 海外代充服務，支援全球帳號，由人工極速處理，安全到帳。虛擬商品完成後不可退款，請確認帳號無誤後再下單。",
                    tutorial="1. 選擇規格與數量\n2. 填寫充值帳號 / ID\n3. 完成付款（本期為測試支付）\n4. 客服人工充值並更新訂單狀態\n5. 於「我的訂單」查看進度",
                    account_field_label="充值帳號 / ID", account_field_hint="請填寫正確的帳號 ID，部分商品需於備註附上區服 / 伺服器資訊",
                    specs=specs(tmpl), tags=tags, sales_count=sales,
                    rating=5.0 if idx % 3 else 4.9, sort_order=order,
                ).model_dump())
        await db.products.insert_many(products)
        all_products = await db.products.find({}, {"_id": 0, "id": 1}).to_list(300)
        samples = [
            ("張**明", 5, "充值超快，下單 2 分鐘就到帳，客服態度很好！"),
            ("Chen***", 5, "海外帳號也能充，價格比官方便宜，推薦。"),
            ("小***花", 4, "整體不錯，就是晚上客服回覆稍慢一點。"),
            ("Wong**", 5, "第三次購買了，穩定靠譜，會回購。"),
            ("林***", 5, "介面清楚，繁中操作很順手，讚！"),
        ]
        reviews = []
        for prod in all_products[:16]:
            for a, r, c in samples:
                reviews.append(Review(product_id=prod["id"], author=a, rating=r, content=c).model_dump())
        await db.reviews.insert_many(reviews)
    if False:
        def specs(pairs):
            return [{"id": new_id(), "label": l, "price_usd": p, "in_stock": True} for l, p in pairs]
        products = [
            Product(name="抖音 DOU+ 加熱幣", category="douyin", brand="抖音",
                    image="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="抖音 DOU+ 官方加熱服務，提升影片曝光與互動。充值後由人工極速處理，24 小時內到帳。",
                    tutorial="1. 選擇幣值規格\n2. 填寫抖音帳號 ID\n3. 完成付款後客服人工充值\n4. 於「我的訂單」查看進度",
                    account_field_label="抖音帳號 ID", account_field_hint="請填寫抖音號（非暱稱），例如 douyin888",
                    specs=specs([("300 幣", 4.99), ("500 幣", 7.99), ("1000 幣", 14.99), ("3000 幣", 42.99), ("5000 幣", 69.99)]),
                    tags=["熱銷", "24H極速"], sales_count=1820, rating=4.9, sort_order=1),
            Product(name="TikTok Coins 抖幣", category="live", brand="TikTok",
                    image="https://images.unsplash.com/photo-1633412802994-5c058f151b66?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="TikTok 直播打賞抖幣充值，支援全球帳號。人工發貨安全可靠。",
                    tutorial="填寫 TikTok 帳號後下單，客服人工為您充值。",
                    account_field_label="TikTok 帳號", account_field_hint="請填寫 @username",
                    specs=specs([("70 幣", 1.09), ("350 幣", 4.99), ("700 幣", 9.99), ("1400 幣", 18.99), ("3500 幣", 45.99)]),
                    tags=["熱銷"], sales_count=1320, rating=4.8, sort_order=2),
            Product(name="Bigo Live 鑽石", category="live", brand="Bigo",
                    image="https://images.unsplash.com/photo-1598550476439-6847785fcea6?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="Bigo Live 直播鑽石充值，主播打賞必備。",
                    tutorial="填寫 Bigo ID 後下單。",
                    account_field_label="Bigo ID", account_field_hint="個人資料頁的數字 ID",
                    specs=specs([("100 鑽", 1.59), ("500 鑽", 7.49), ("1000 鑽", 14.49), ("5000 鑽", 69.99)]),
                    tags=[], sales_count=760, rating=4.7, sort_order=3),
            Product(name="原神 創世結晶", category="game", brand="miHoYo",
                    image="https://images.unsplash.com/photo-1542751371-adc38448a05e?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="原神創世結晶直充，支援國際服。人工代充安全到帳。",
                    tutorial="提供遊戲 UID 與伺服器後下單。",
                    account_field_label="遊戲 UID", account_field_hint="請同時於備註填寫伺服器（亞服/歐服/美服）",
                    specs=specs([("60 結晶", 0.99), ("300+30 結晶", 4.99), ("980+110 結晶", 14.99), ("1980+260 結晶", 29.99), ("3280+600 結晶", 49.99)]),
                    tags=["熱銷", "直充"], sales_count=2450, rating=4.9, sort_order=4),
            Product(name="Netflix 禮品卡", category="giftcard", brand="Netflix",
                    image="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="Netflix 官方禮品卡，自動發碼。",
                    tutorial="下單後於訂單詳情與客服取得兌換碼。",
                    account_field_label="收件 Email", account_field_hint="用於接收兌換碼",
                    specs=specs([("US$15", 15.49), ("US$30", 30.49), ("US$60", 59.99), ("US$100", 98.99)]),
                    tags=["禮品卡"], sales_count=540, rating=4.8, sort_order=5),
            Product(name="Disney+ 會員 VIP", category="vip", brand="Disney+",
                    image="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="Disney+ 影音會員充值，多時長可選。",
                    tutorial="填寫帳號後人工開通。",
                    account_field_label="Disney+ 帳號", account_field_hint="登入用 Email",
                    specs=specs([("1 個月", 8.99), ("3 個月", 24.99), ("12 個月", 89.99)]),
                    tags=["VIP"], sales_count=410, rating=4.7, sort_order=6),
            Product(name="Spotify Premium", category="vip", brand="Spotify",
                    image="https://images.unsplash.com/photo-1614680376593-902f74cf0d41?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="Spotify Premium 會員充值。",
                    tutorial="填寫帳號後人工開通。",
                    account_field_label="Spotify 帳號", account_field_hint="登入用 Email",
                    specs=specs([("1 個月", 9.99), ("3 個月", 27.99), ("6 個月", 52.99)]),
                    tags=["VIP"], sales_count=380, rating=4.6, sort_order=7),
            Product(name="快手 快幣", category="live", brand="快手",
                    image="https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                    description="快手直播快幣充值，人工極速到帳。",
                    tutorial="填寫快手帳號後下單。",
                    account_field_label="快手帳號", account_field_hint="快手 ID",
                    specs=specs([("60 快幣", 0.99), ("300 快幣", 4.99), ("980 快幣", 15.99), ("3000 快幣", 46.99)]),
                    tags=[], sales_count=620, rating=4.7, sort_order=8),
        ]
        await db.products.insert_many([p.model_dump() for p in products])
        all_products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        reviews = []
        samples = [
            ("張**明", 5, "充值超快，下單 2 分鐘就到帳，客服態度很好！"),
            ("Chen***", 5, "海外帳號也能充，價格比官方便宜，推薦。"),
            ("小***花", 4, "整體不錯，就是晚上客服回覆稍慢一點。"),
            ("Wong**", 5, "第三次購買了，穩定靠譜，會回購。"),
            ("林***", 5, "介面清楚，繁中操作很順手，讚！"),
        ]
        for prod in all_products[:6]:
            for a, r, c in samples:
                reviews.append(Review(product_id=prod["id"], author=a, rating=r, content=c).model_dump())
        await db.reviews.insert_many(reviews)
    if await db.promos.count_documents({}) == 0:
        await db.promos.insert_many([
            Promo(code="GLOBAL2026", discount_type="percent", value=10, min_order_usd=0,
                  expires_at=(datetime.now(timezone.utc) + timedelta(days=365)).isoformat()).model_dump(),
            Promo(code="WELCOME5", discount_type="fixed_usd", value=5, min_order_usd=30,
                  expires_at=(datetime.now(timezone.utc) + timedelta(days=365)).isoformat()).model_dump(),
        ])


translator = Translator(db)
LOCALIZE_SKIP = ("/api/auth/email", "/api/admin", "/api/img", "/api/payments", "/api/webhook", "/api/cron", "/api/me/wallet/topup", "/api/i18n")


@api_router.get("/i18n/stats")
async def i18n_stats():
    return {"cached": len(translator.en), "pending": len(translator.pending)}


email_auth.db = db
admin_api.db = db
admin_api.translator = translator
admin_api.require_role = require_role
admin_api._wallet_tx = _wallet_tx
admin_api._usdt_settle = _usdt_settle
admin_api._usdt_call = _usdt_call
admin_api._usdt_creds = _usdt_creds
admin_api.award_points = award_points
admin_api.log_user = log_user
admin_api.get_points_config = get_points_config
cms_api.db = db
cms_api.upload_b64 = _upload_b64
cms_api.new_id = new_id
app.include_router(cms_api.router)
payments_api.db = db
payments_api.current_member = current_member
payments_api.settle = _usdt_settle
payments_api.wallet = _wallet
payments_api.upload_b64 = _upload_b64
payments_api.new_id = new_id
payments_api.now_iso = now_iso
app.include_router(payments_api.router)
app.include_router(admin_api.router)
app.include_router(api_router)
app.include_router(clerk_router)
app.include_router(email_auth.router)


@app.middleware("http")
async def localize_response(request: Request, call_next):
    response = await call_next(request)
    lang = request.headers.get("x-lang", "")
    path = request.url.path
    if lang not in ("zh-CN", "en") or not path.startswith("/api") or path.startswith(LOCALIZE_SKIP) \
            or response.status_code >= 300 or "application/json" not in (response.headers.get("content-type") or ""):
        return response
    body = b"".join([chunk async for chunk in response.body_iterator])
    try:
        data = json.loads(body)
    except Exception:
        return Response(content=body, status_code=response.status_code, headers=dict(response.headers), media_type="application/json")
    data = translator.localize(data, lang, allow_long=isinstance(data, dict))
    out = json.dumps(data, ensure_ascii=False).encode()
    headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
    headers["content-length"] = str(len(out))
    return Response(content=out, status_code=response.status_code, headers=headers, media_type="application/json")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def init_objstore():
    try:
        await run_in_threadpool(objstore.init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("startup")
async def on_startup():
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    await seed()
    await translator.load()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
