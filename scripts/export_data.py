"""在 Emergent 环境运行：导出 MongoDB 全库 + 对象存储图片 → /app/export/gogo589_data.zip"""
import os, re, sys, json, zipfile, shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient
from bson import json_util, BSON
import storage

OUT = Path("/app/export")
DB_DIR, IMG_DIR = OUT / "db", OUT / "storage"
shutil.rmtree(OUT, ignore_errors=True)
DB_DIR.mkdir(parents=True)

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
paths = set()
for c in db.list_collection_names():
    docs = list(db[c].find({}))
    with open(DB_DIR / f"{c}.bson", "wb") as f:
        for d in docs:
            f.write(BSON.encode(d))
            paths.update(re.findall(r"/api/img/([\w\-./]+)", json_util.dumps(d)))
    print(f"{c}: {len(docs)}")

print(f"images: {len(paths)}")
failed = []

def fetch(p):
    try:
        data, _ = storage.get_object(p)
        dst = IMG_DIR / p
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
    except Exception as e:
        failed.append((p, str(e)))

with ThreadPoolExecutor(16) as ex:
    list(ex.map(fetch, sorted(paths)))
print(f"images failed: {len(failed)}", failed[:5])

zip_path = OUT / "gogo589_data.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for p in list(DB_DIR.rglob("*")) + list(IMG_DIR.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(OUT))
print("zip:", zip_path, round(zip_path.stat().st_size / 1024 / 1024, 1), "MB")
