import os
import uuid
import base64
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
import storage as objstore
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
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
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
    badge: str = ""
    in_stock: bool = True


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
    sales_count: int = 0
    rating: float = 5.0
    sort_order: int = 0
    active: bool = True


class Currency(BaseModel):
    code: str
    symbol: str
    name: str
    flag: str = ""
    rate_to_usd: float
    active: bool = True


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


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    currency: str = "USD"
    recharge_account: str
    recharge_note: str = ""
    contact: str = ""
    delivery_info: Dict[str, Dict[str, str]] = {}
    promo_code: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None


ORDER_STATUSES = ["pending_payment", "paid", "processing", "shipped", "completed", "exception"]
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
    return await db.currencies.find({"active": True}, {"_id": 0}).to_list(100)


@api_router.get("/categories")
async def get_categories():
    return await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)


@api_router.get("/products")
async def get_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {"active": True}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
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
    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    by_category = {}
    for c in cats:
        by_category[c["id"]] = await db.products.find({"active": True, "category": c["id"]}, proj).sort([("sort_order", 1), ("sales_count", -1)]).to_list(20)
    return {"quick": quick, "hot": hot, "by_category": by_category}


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


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
async def _compute_order(order: OrderIn):
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
        line = spec["price_usd"] * qty
        subtotal_usd += line
        items_out.append({
            "product_id": p["id"], "product_name": p["name"], "image": p.get("image", ""),
            "spec_id": spec["id"], "spec_label": spec["label"],
            "unit_price_usd": spec["price_usd"], "quantity": qty, "line_usd": round(line, 2),
        })
    discount_usd = 0.0
    promo_code = None
    if order.promo_code:
        res = await validate_promo({"code": order.promo_code, "subtotal_usd": subtotal_usd})
        discount_usd = res["discount_usd"]
        promo_code = res["code"]
    total_usd = max(0.0, subtotal_usd - discount_usd)
    return items_out, round(subtotal_usd, 2), round(discount_usd, 2), round(total_usd, 2), promo_code


def _limit_kind(badge: str):
    b = badge or ""
    if "每月一單" in b:
        return "monthly"
    if "每日一單" in b:
        return "daily"
    if "新客" in b or "新用戶" in b or "新使用者" in b:
        return "newcomer"
    return None


async def _daily_limited_specs(user_id: str, product_ids: List[str]):
    """Return {spec_id: last_bought_iso} for this user within 30 days."""
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    cur = db.orders.find({"user_id": user_id, "status": {"$ne": "cancelled"}, "created_at": {"$gte": since}, "items.product_id": {"$in": product_ids}}, {"_id": 0, "items.spec_id": 1, "created_at": 1})
    used = {}
    async for o in cur:
        for it in o.get("items", []):
            used[it["spec_id"]] = max(used.get(it["spec_id"], ""), o["created_at"])
    return used


def _is_locked(kind: str, last_iso: Optional[str]) -> bool:
    if not last_iso:
        return False
    window = timedelta(days=30) if kind == "monthly" else timedelta(hours=24)
    return datetime.fromisoformat(last_iso) > datetime.now(timezone.utc) - window


async def _check_daily_limit(order: OrderIn, user_id: str):
    pids = [it.product_id for it in order.items]
    used = await _daily_limited_specs(user_id, pids)
    has_orders = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}}) > 0
    seen = set()
    for it in order.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0, "specs": 1, "name": 1})
        spec = next((s for s in p["specs"] if s["id"] == it.spec_id), None)
        if not spec:
            continue
        kind = _limit_kind(spec.get("badge"))
        if kind in ("daily", "monthly"):
            if _is_locked(kind, used.get(it.spec_id)) or it.spec_id in seen or int(it.quantity) > 1:
                unit = "每月" if kind == "monthly" else "每日"
                raise HTTPException(status_code=409, detail=f"「{p['name']} {spec['label']}」為{unit}一單特價規格，每個帳號{unit}限購 1 份，請稍後再來或選擇其他規格")
            seen.add(it.spec_id)
        elif kind == "newcomer" and (has_orders or int(it.quantity) > 1):
            raise HTTPException(status_code=409, detail=f"「{p['name']} {spec['label']}」為新用戶專享規格，僅限首單購買 1 份，請選擇其他規格")


@api_router.get("/products/{product_id}/daily-limit")
async def product_daily_limit(product_id: str, member: dict = Depends(current_member)):
    used = await _daily_limited_specs(member["user_id"], [product_id])
    p = await db.products.find_one({"id": product_id}, {"_id": 0, "specs": 1}) or {"specs": []}
    locked = [s["id"] for s in p["specs"] if _limit_kind(s.get("badge")) in ("daily", "monthly") and _is_locked(_limit_kind(s.get("badge")), used.get(s["id"]))]
    has_orders = await db.orders.count_documents({"user_id": member["user_id"], "status": {"$ne": "cancelled"}}) > 0
    return {"used_spec_ids": locked, "is_new_customer": not has_orders}


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
    return {"user_id": member["user_id"], "email": member.get("email", ""), "role": member["role"], "profile": u.get("profile") or {},
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
    items, subtotal_usd, discount_usd, total_usd, promo_code = await _compute_order(order)
    await _check_daily_limit(order, member["user_id"])
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
    return doc


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
    return o


@api_router.get("/orders")
async def my_orders(status: Optional[str] = None, member: dict = Depends(current_member)):
    query = {"user_id": member["user_id"]}
    if status and status != "all":
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


@api_router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(require_role("admin"))):
    return await db.products.find({}, {"_id": 0}).sort("sort_order", 1).to_list(1000)


@api_router.post("/admin/products")
async def admin_create_product(body: ProductIn, admin: dict = Depends(require_role("admin"))):
    p = Product(**body.model_dump())
    await db.products.insert_one(p.model_dump())
    return p.model_dump()


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, admin: dict = Depends(require_role("admin"))):
    r = await db.products.find_one_and_update(
        {"id": product_id}, {"$set": body.model_dump()},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.products.delete_one({"id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.get("/admin/orders")
async def admin_list_orders(status: Optional[str] = None, admin: dict = Depends(require_role("admin"))):
    query = {}
    if status and status != "all":
        query["status"] = status
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)


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
    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {**o, **update}


@api_router.get("/admin/currencies")
async def admin_list_currencies(admin: dict = Depends(require_role("admin"))):
    return await db.currencies.find({}, {"_id": 0}).to_list(100)


@api_router.put("/admin/currencies/{code}")
async def admin_update_currency(code: str, body: Currency, admin: dict = Depends(require_role("admin"))):
    await db.currencies.update_one({"code": code}, {"$set": body.model_dump()}, upsert=True)
    return body.model_dump()


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
async def seed():
    if await db.currencies.count_documents({}) == 0:
        await db.currencies.insert_many([
            {"code": "USD", "symbol": "$", "name": "美元", "flag": "🇺🇸", "rate_to_usd": 1.00, "active": True},
            {"code": "HKD", "symbol": "HK$", "name": "港幣", "flag": "🇭🇰", "rate_to_usd": 7.82, "active": True},
            {"code": "TWD", "symbol": "NT$", "name": "新台幣", "flag": "🇹🇼", "rate_to_usd": 32.20, "active": True},
            {"code": "EUR", "symbol": "€", "name": "歐元", "flag": "🇪🇺", "rate_to_usd": 0.92, "active": True},
            {"code": "JPY", "symbol": "¥", "name": "日圓", "flag": "🇯🇵", "rate_to_usd": 155.40, "active": True},
            {"code": "GBP", "symbol": "£", "name": "英鎊", "flag": "🇬🇧", "rate_to_usd": 0.79, "active": True},
        ])
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


app.include_router(api_router)
app.include_router(clerk_router)

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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
