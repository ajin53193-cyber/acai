"""在自托管服务器运行（backend venv）：
    python scripts\\import_data.py D:\\path\\gogo589_data.zip
导入 MongoDB 全库（覆盖同名集合）并把图片复制到 LOCAL_STORAGE_DIR。"""
import os, sys, zipfile, shutil, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from dotenv import load_dotenv
load_dotenv(ROOT / "backend" / ".env")
from pymongo import MongoClient
from bson import decode_file_iter

if len(sys.argv) < 2:
    sys.exit("用法: python scripts/import_data.py <gogo589_data.zip>")
zip_path = Path(sys.argv[1])
local_dir = (os.environ.get("LOCAL_STORAGE_DIR") or "").strip()
if not local_dir:
    sys.exit("请先在 backend/.env 中设置 LOCAL_STORAGE_DIR")

tmp = Path(tempfile.mkdtemp())
with zipfile.ZipFile(zip_path) as z:
    z.extractall(tmp)

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
for f in sorted((tmp / "db").glob("*.bson")):
    name = f.stem
    with open(f, "rb") as fh:
        docs = list(decode_file_iter(fh))
    db[name].drop()
    if docs:
        db[name].insert_many(docs, ordered=False)
    print(f"{name}: {len(docs)}")

src = tmp / "storage"
n = 0
for p in src.rglob("*"):
    if p.is_file():
        dst = Path(local_dir) / p.relative_to(src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)
        n += 1
print(f"images copied: {n} -> {local_dir}")
shutil.rmtree(tmp, ignore_errors=True)
print("DONE")
