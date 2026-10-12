import os, sys, json, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
import storage as objstore

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}


def migrate(p):
    url = p.get("image") or ""
    if not url.startswith("http"):
        return p["id"], "skip"
    for i in range(3):
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code != 200:
                time.sleep(1); continue
            ext = url.rsplit(".", 1)[-1].lower().split("?")[0]
            ct = r.headers.get("Content-Type", "").split(";")[0] or MIME.get(ext, "image/png")
            if ext not in MIME:
                ext = {"image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}.get(ct, "png")
            path = f"gogo589/products/{p['id']}.{ext}"
            res = objstore.put_object(path, r.content, ct)
            db.products.update_one({"id": p["id"]}, {"$set": {"image": f"/api/img/{res['path']}", "image_source": url}})
            return p["id"], "ok"
        except Exception as e:
            err = str(e)[:80]
            time.sleep(1 + i)
    return p["id"], f"fail {err}"


def main():
    objstore.init_storage()
    prods = list(db.products.find({"image": {"$regex": "^http"}}, {"_id": 0, "id": 1, "image": 1}))
    print("to migrate", len(prods), flush=True)
    stats = {"ok": 0, "fail": 0, "skip": 0}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(migrate, p) for p in prods]
        for n, f in enumerate(as_completed(futs), 1):
            pid, st = f.result()
            stats[st.split()[0]] += 1
            if st.startswith("fail"):
                print(pid, st, flush=True)
            if n % 100 == 0:
                print("progress", n, stats, flush=True)
    print("DONE", stats, flush=True)


if __name__ == "__main__":
    main()
