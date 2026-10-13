import os, re, sys, html, time, hashlib
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
import storage as objstore

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
H = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Accept": "application/json", "languageid": "9", "currency": "USD", "clientid": "2615", "siteid": "2615", "Referer": "https://www.kavip.com/zh-tw"}
B = "https://www.kavip.com/pro-api"
MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}
BRAND = [(re.compile(r"https?://(www\.)?kavip\.com/zh-tw/detail/(\d+)"), r"/product/\2"),
         (re.compile(r"https?://(www\.)?kavip\.com/zh-tw/article/detail/([A-Za-z0-9]+)"), r"/article/\2"),
         (re.compile(r"https?://(www\.)?kavip\.com[^\s\"'<>)]*"), "https://www.gogo589.com"),
         (re.compile(r"www\.kavip\.com", re.I), "www.gogo589.com"),
         (re.compile(r"kavip\.com", re.I), "gogo589.com"),
         (re.compile(r"KAVIP"), "GOGO589"), (re.compile(r"Kavip"), "Gogo589"), (re.compile(r"kavip"), "gogo589")]


def rebrand(s):
    if not s:
        return s
    for rx, rep in BRAND:
        s = rx.sub(rep, s)
    return s


def mirror(url):
    if not url or not url.startswith("http"):
        return url
    key = hashlib.md5(url.encode()).hexdigest()[:16]
    ext = url.rsplit(".", 1)[-1].lower().split("?")[0]
    if "135editor.com" in url:
        return url
    for i in range(3):
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.kavip.com/"})
            if r.status_code != 200:
                time.sleep(1); continue
            ct = r.headers.get("Content-Type", "").split(";")[0] or MIME.get(ext, "image/png")
            if ext not in MIME:
                ext = {"image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}.get(ct, "png")
            res = objstore.put_object(f"gogo589/articles/{key}.{ext}", r.content, ct)
            return f"/api/img/{res['path']}"
        except Exception as e:
            print("img fail", url, e, flush=True); time.sleep(1 + i)
    return url


def main():
    objstore.init_storage()
    rows = requests.post(B + "/openapi/news/getSiteNewsList", headers=H, json={"pager": {"pageNum": 1, "pageSize": 200}}, timeout=30).json()["data"]["rows"]
    print("articles", len(rows), flush=True)
    for idx, row in enumerate(rows):
        info = requests.get(f"{B}/openapi/news/info/{row['newsId']}", headers=H, timeout=30).json()["data"]
        content = info.get("newsContent") or ""
        content = re.sub(r"<img([^>]*?)\sstyle=\"[^\"]*\"", r"<img\1", content)
        content = re.sub(r'\s(width|height)="\d+"', "", content)
        srcs = set(re.findall(r'<img[^>]+src="([^"]+)"', content))
        for s in srcs:
            content = content.replace(s, mirror(s))
        doc = {
            "id": info.get("newsCode") or str(info["newsId"]),
            "source_id": str(info["newsId"]),
            "title": rebrand(html.unescape(info["title"])),
            "summary": rebrand(info.get("keyWordExtend") or ""),
            "keywords": rebrand(info.get("keyWord") or ""),
            "cover": mirror(info.get("newsCover")),
            "content_html": rebrand(content),
            "published_at": info.get("publishTime") or "",
            "view_count": info.get("viewCount") or 0,
            "sort_order": idx,
            "active": True,
        }
        db.articles.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        print(idx, doc["id"], doc["title"], flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
