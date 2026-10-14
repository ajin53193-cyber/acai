"""CMS: editable site config (banners, texts, logo) + activities (articles) management."""
import re
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from translate import to_traditional
from admin_api import current_admin

router = APIRouter(prefix="/api")
db = None
upload_b64 = None
new_id = None

DEFAULT_CONFIG = {
    "logo": {"image": "/gogo589-logo.png"},
    "top_promo": {"enabled": True, "image": "/banners/top-ai-promo.png", "link": "https://www.dbto.ai/zh-CN?-affi-100506", "alt": "最強 AI 免費試用，價格超實惠 立即體驗"},
    "hero": {
        "kicker": "(UTC+8) 限時活動", "title": "低價氪金 戰力超神", "subtitle": "神券在手 下單省最高", "highlight": "7%",
        "pills": [{"label": "手遊", "link": "/category/games"}, {"label": "端遊", "link": "/category/games"}, {"label": "點卡官方速充", "link": "/category/pointcard"}],
        "image": "https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/2ad58532ad0f875a0c9c030d9069119b5960735a7e1383d2f707ce6813e0bc05.jpeg",
    },
    "announcement": {"enabled": True, "text": "gogo589 介面升級公告：全新繁中介面上線，人工極速發貨，祝您購物愉快！", "text_mobile": "gogo589 用戶界面升級公告", "link": "/article"},
    "promo_banners": [
        {"image": "https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b55a2354a230f99b_image.png", "link": "/sign-up", "alt": "新版上線有禮 5% OFF"},
        {"image": "https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/3673631df7a58fe1_image.png", "link": "/activities", "alt": "精選活動合集 優惠一站搞定"},
    ],
    "detail_banners": {
        "mobile": [
            {"image": "/banners/detail-promo.png", "link": "/sign-up", "action": "", "alt": "低價氪金 戰力超神 神券在手 下單省最高 7%"},
            {"image": "/banners/detail-a2hs.png", "link": "", "action": "a2hs", "alt": "添加 GOGO589 到桌面 快捷下單超方便"},
            {"image": "/banners/detail-register.jpg", "link": "/sign-up", "action": "", "alt": "註冊送新客優惠包 下單最高省 9%"},
        ],
        "pc": [
            {"image": "/banners/detail-promo-pc.png", "link": "/sign-up", "action": "", "alt": "低價氪金 戰力超神 神券在手 下單省最高 7%"},
            {"image": "/banners/detail-register-pc.png", "link": "/sign-up", "action": "", "alt": "註冊送新客優惠包 下單最高省 9%"},
        ],
    },
    "features": {
        "tagline": "全球應用內購服務",
        "mobile_image": "/banners/features-mobile.png",
        "items": [
            {"title": "正版安全", "desc": "涵蓋 500+ 款全球正版 APP 內購服務"},
            {"title": "自動化極速出貨", "desc": "90% 以上產品及服務線上自動秒發"},
            {"title": "7x24 多語言服務", "desc": "全世界線上呼叫中心提供服務"},
            {"title": "天天平價折扣不停", "desc": "享受每日全類目產品特價促銷"},
            {"title": "全球 APP 發行", "desc": "為 APP 開發者提供全球用戶發行服務"},
        ],
    },
    "register": {
        "enabled": True, "percent": "9%", "bar_text": "新用戶註冊最高領", "bar_suffix": "優惠券", "button": "立即註冊",
        "title": "新用戶註冊，最高領 9% 優惠券", "subtitle": "註冊即享首單優惠，海量正版 App 充值等你來！",
        "mobile_image": "/banners/register-mobile.png",
    },
    "hero_slides": [],
    "home_layout": [
        {"key": "flash_sale", "label": "限時秒殺", "visible": True},
        {"key": "lottery_entry", "label": "積分抽獎入口", "visible": True},
        {"key": "combos", "label": "超值套餐", "visible": True},
        {"key": "quick_order", "label": "快捷下單", "visible": True},
        {"key": "hot_products", "label": "熱門產品", "visible": True},
        {"key": "promo_banners", "label": "促銷橫幅", "visible": True},
        {"key": "hot_categories", "label": "熱門分類", "visible": True},
    ],
}
IMG_KEYS = ("image", "mobile_image", "cover")
TEXT_SKIP_KEYS = ("link", "image", "mobile_image", "action", "cover", "id")


def _merge(base: Any, over: Any) -> Any:
    if isinstance(base, dict) and isinstance(over, dict):
        return {k: _merge(base.get(k), over[k]) if k in over else base[k] for k in {**base, **over}}
    return base if over is None else over


async def _process(node: Any, prefix: str, key: str = "") -> Any:
    if isinstance(node, dict):
        return {k: await _process(v, prefix, k) for k, v in node.items()}
    if isinstance(node, list):
        return [await _process(v, prefix, key) for v in node]
    if isinstance(node, str):
        if node.startswith("data:image"):
            return await upload_b64(prefix, node, "upload.png", max_mb=4)
        if key not in TEXT_SKIP_KEYS and re.search(r"[\u4e00-\u9fff]", node):
            return to_traditional(node)
    return node


@router.get("/site-config")
async def get_site_config():
    doc = await db.site_config.find_one({"_id": "site"}, {"_id": 0}) or {}
    return _merge(DEFAULT_CONFIG, doc)


@router.put("/admin/site-config")
async def put_site_config(body: Dict[str, Any], admin: dict = Depends(current_admin)):
    clean = {k: v for k, v in body.items() if k in DEFAULT_CONFIG}
    clean = await _process(clean, "gogo589/cms")
    await db.site_config.update_one({"_id": "site"}, {"$set": clean}, upsert=True)
    return await get_site_config()


@router.post("/admin/site-config/reset")
async def reset_site_config(body: Dict[str, str], admin: dict = Depends(current_admin)):
    section = body.get("section")
    if section not in DEFAULT_CONFIG:
        raise HTTPException(status_code=400, detail="unknown section")
    await db.site_config.update_one({"_id": "site"}, {"$unset": {section: ""}}, upsert=True)
    return await get_site_config()


# ----------------------------- Activities / articles -----------------------------
ARTICLE_TYPES = ("promo", "tutorial", "news")


class ArticleIn(BaseModel):
    title: str
    type: str = "promo"
    summary: str = ""
    cover: str = ""
    content_html: str = ""
    link: str = ""
    keywords: str = ""
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    published_at: Optional[str] = None
    sort_order: int = 0
    active: bool = True


class ImageIn(BaseModel):
    image_b64: str
    image_name: str = "image.png"


def _now():
    return datetime.now(timezone.utc).isoformat()


def article_visible_query() -> dict:
    now = _now()
    return {
        "active": True, "page": {"$ne": True},
        "$and": [
            {"$or": [{"start_at": None}, {"start_at": {"$exists": False}}, {"start_at": ""}, {"start_at": {"$lte": now}}]},
            {"$or": [{"end_at": None}, {"end_at": {"$exists": False}}, {"end_at": ""}, {"end_at": {"$gt": now}}]},
        ],
    }


def _status(a: dict) -> str:
    now = _now()
    if not a.get("active"):
        return "inactive"
    if a.get("start_at") and a["start_at"] > now:
        return "scheduled"
    if a.get("end_at") and a["end_at"] <= now:
        return "expired"
    return "live"


async def _prep(body: ArticleIn) -> dict:
    d = body.model_dump()
    if d["type"] not in ARTICLE_TYPES:
        raise HTTPException(status_code=400, detail="invalid type")
    if not d["title"].strip():
        raise HTTPException(status_code=400, detail="標題不可為空")
    if d["cover"].startswith("data:image"):
        d["cover"] = await upload_b64("gogo589/articles", d["cover"], "cover.png", max_mb=4)
    for k in ("title", "summary", "content_html", "keywords"):
        d[k] = to_traditional(d[k]) if d[k] else d[k]
    if not d["published_at"]:
        d["published_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return d


@router.get("/admin/articles")
async def admin_list_articles(q: str = "", type: str = "", page: int = 1, size: int = 20, admin: dict = Depends(current_admin)):
    cond: dict = {"page": {"$ne": True}}
    if type:
        cond["type"] = type
    if q:
        cond["title"] = {"$regex": re.escape(q), "$options": "i"}
    total = await db.articles.count_documents(cond)
    rows = await db.articles.find(cond, {"_id": 0, "content_html": 0}).sort([("sort_order", 1), ("published_at", -1)]).skip((page - 1) * size).to_list(size)
    for r in rows:
        r["status"] = _status(r)
    return {"total": total, "rows": rows}


@router.get("/admin/articles/{article_id}")
async def admin_get_article(article_id: str, admin: dict = Depends(current_admin)):
    a = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="not found")
    return a


@router.post("/admin/articles")
async def admin_create_article(body: ArticleIn, admin: dict = Depends(current_admin)):
    d = await _prep(body)
    d.update({"id": new_id(), "view_count": 0, "created_at": _now(), "source_id": None})
    await db.articles.insert_one({**d})
    d["status"] = _status(d)
    return d


@router.put("/admin/articles/{article_id}")
async def admin_update_article(article_id: str, body: ArticleIn, admin: dict = Depends(current_admin)):
    d = await _prep(body)
    d["updated_at"] = _now()
    res = await db.articles.update_one({"id": article_id}, {"$set": d})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="not found")
    a = await db.articles.find_one({"id": article_id}, {"_id": 0, "content_html": 0})
    a["status"] = _status(a)
    return a


@router.delete("/admin/articles/{article_id}")
async def admin_delete_article(article_id: str, admin: dict = Depends(current_admin)):
    res = await db.articles.delete_one({"id": article_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@router.post("/admin/articles/upload")
async def admin_upload_image(body: ImageIn, admin: dict = Depends(current_admin)):
    return {"url": await upload_b64("gogo589/articles", body.image_b64, body.image_name, max_mb=4)}
