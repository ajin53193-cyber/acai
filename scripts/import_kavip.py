import asyncio, json, os, re, hashlib, html as htmlmod
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import sys
sys.path.insert(0, "/app/scripts")
from nuxt_decode import decode_nuxt
from opencc import OpenCC
_cc = OpenCC("s2twp")
def tw(x):
    return _cc.convert(x) if isinstance(x, str) else x

load_dotenv("/app/backend/.env")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

TYPE_MAP = {1: "text", 7: "select", 11: "text", 3: "password", 4: "textarea"}
CAT_ICONS = {"livestream": "/icons/live.png", "games": "/icons/game.png", "social": "/icons/social.png", "video-music": "/icons/music.png",
             "play": "/icons/voice.png", "voice": "/icons/voice.png", "life": "/icons/giftcard.png", "pointcard": "/icons/point.png",
             "literary": "/icons/reading.png", "accelerator": "/icons/point.png", "ai": "/icons/ai.png"}


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return htmlmod.unescape(s).strip()


def clean_html(s):
    s = re.sub(r"<script.*?</script>", "", s or "", flags=re.S | re.I)
    s = re.sub(r"\son\w+=\"[^\"]*\"", "", s)
    return s


def stable_int(key, lo, hi):
    h = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    return lo + h % (hi - lo)


async def main():
    data = json.load(open("/app/scripts/kavip_data.json"))
    home = decode_nuxt(open("/app/scripts/kavip_home.html").read())["data"]
    quick_ids = [str(p["productId"]) for p in home.get("quick-product") or []]
    hot_ids = [str(p["productId"]) for p in home.get("hot-product") or []]
    hot_volume = {str(p["productId"]): p.get("saleVolume") for p in home.get("hot-product") or []}

    cats = data["categories"]
    await db.categories.delete_many({})
    await db.categories.insert_many([
        {"id": c["categoryCode"], "name": c["categoryName"].replace("Al", "AI"), "icon": "", "image": CAT_ICONS.get(c["categoryCode"], "/icons/point.png"), "sort_order": c.get("sort") or i + 1}
        for i, c in enumerate(cats)
    ])

    products, reviews = [], []
    order = 0
    for pid, row in data["products"].items():
        det = data["details"].get(pid)
        if not det or not det["specs"]:
            continue
        order += 1
        specs = []
        for s in det["specs"]:
            price = s.get("specialPrice") if s.get("specialPrice") not in (None, 0) else s.get("salePrice")
            if price is None:
                continue
            specs.append({"id": f"{pid}-{s['specId']}", "label": tw(s["name"] or ""), "price_usd": float(price),
                          "sale_price_usd": float(s["salePrice"]) if s.get("salePrice") not in (None, 0) and float(s["salePrice"]) > float(price) else None,
                          "badge": tw(s.get("badge") or ""),
                          "in_stock": True})
        if not specs:
            continue
        fields = []
        for f in det["delivery"]:
            if not f.get("name"):
                continue
            fields.append({"code": f.get("code") or "account", "name": tw(f["name"]), "required": bool(f.get("required", 1)),
                           "placeholder": tw(f.get("placeholder") or ""), "tips": tw(f.get("tips") or ""), "type": TYPE_MAP.get(f.get("type"), "text"),
                           "options": [tw(o) for o in (f.get("options") or []) if o]})
        if not fields:
            fields = [{"code": "account", "name": "充值帳號 / ID", "required": True, "placeholder": "", "tips": "", "type": "text", "options": []}]
        name = det.get("productName") or row.get("productName")
        is_quick = pid in quick_ids
        is_hot = pid in hot_ids or is_quick
        tags = (["快速下單"] if is_quick else []) + (["熱銷"] if is_hot else [])
        if row.get("badgeText"):
            tags.append(row["badgeText"])
        sales = hot_volume.get(pid) or (stable_int(pid, 300000, 1500000) if is_hot else stable_int(pid, 800, 90000))
        rating = det.get("commentScore") or 5.0
        rank = quick_ids.index(pid) if is_quick else (100 + hot_ids.index(pid) if pid in hot_ids else 1000 + order)
        products.append({
            "id": pid, "source_id": pid, "name": name, "category": det.get("categoryCode") or row.get("categoryCode"),
            "brand": det.get("productAliasName") or name, "subtitle": det.get("productSubtitle") or row.get("productSubtitle") or "",
            "image": det.get("pcImage") or row.get("pcImage") or "", "description": det.get("productDesc") or row.get("productDesc") or "",
            "content_html": clean_html(det.get("productContent") or ""), "tutorial": "",
            "account_field_label": fields[0]["name"], "account_field_hint": fields[0].get("tips") or "", "delivery_fields": fields,
            "specs": specs, "tags": tags, "sales_count": int(sales), "rating": float(rating), "sort_order": rank, "active": True,
            "created_at": "2026-06-12T00:00:00+00:00",
        })
        for c in det.get("comments") or []:
            if c.get("text"):
                reviews.append({"id": f"{pid}-{hashlib.md5((c.get('user') or '') .encode() + (c.get('time') or '').encode()).hexdigest()[:8]}",
                                "product_id": pid, "author": c.get("user") or "匿名", "rating": int(c.get("score") or 5), "content": tw(c["text"]), "images": [],
                                "created_at": (c.get("time") or "2026-01-01 00:00:00").replace(" ", "T") + "+08:00", "visible": True})

    await db.products.delete_many({})
    for i in range(0, len(products), 500):
        await db.products.insert_many(products[i:i + 500])
    await db.reviews.delete_many({})
    if reviews:
        for i in range(0, len(reviews), 500):
            await db.reviews.insert_many(reviews[i:i + 500])
    await db.meta.update_one({"_id": "seed"}, {"$set": {"version": 9, "kavip_import": True}}, upsert=True)
    print("imported products", len(products), "reviews", len(reviews), "quick", len(quick_ids), "hot", len(hot_ids))


asyncio.run(main())
