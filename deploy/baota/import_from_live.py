"""
把线上站点（Emergent 部署的 eztyv.com）的内容迁移到自托管数据库 + 本地文件目录。

迁移内容：站点设置（含客服配置、二维码）、项目、新闻文章、教程，以及它们引用的所有上传文件（图片 / 视频）。
不迁移：访问统计、聊天记录（历史数据，可按需放弃）。

用法（在服务器上，backend/.env 已配置好）：
    cd /www/wwwroot/heying
    backend/.venv/bin/python deploy/baota/import_from_live.py
可选环境变量：LIVE_URL（默认 https://eztyv.com）、LIVE_ADMIN_USERNAME / LIVE_ADMIN_PASSWORD（默认取 backend/.env 里的管理员账号）
"""
import os
import re
import sys
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")

LIVE = os.environ.get("LIVE_URL", "https://eztyv.com").rstrip("/")
USERNAME = os.environ.get("LIVE_ADMIN_USERNAME") or os.environ.get("ADMIN_USERNAME", "admin")
PASSWORD = os.environ.get("LIVE_ADMIN_PASSWORD") or os.environ.get("ADMIN_PASSWORD", "")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT / "backend" / "uploads")))

if os.environ.get("LOCAL_STORAGE") != "1":
    print("backend/.env 需设置 LOCAL_STORAGE=1 后再迁移")
    sys.exit(1)

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
FILE_RE = re.compile(r"/api/files/([A-Za-z0-9_\-./]+)")


def login() -> dict:
    r = requests.post(f"{LIVE}/api/admin/login", json={"username": USERNAME, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        print(f"登录线上后台失败（{r.status_code}）：{r.text[:200]}\n请检查 LIVE_ADMIN_USERNAME / LIVE_ADMIN_PASSWORD")
        sys.exit(1)
    return {"Authorization": f"Bearer {r.json()['token']}"}


def get(path: str, headers: dict):
    r = requests.get(f"{LIVE}{path}", headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()


def collect_file_paths(obj, out: set):
    if isinstance(obj, str):
        out.update(FILE_RE.findall(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_file_paths(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_file_paths(v, out)


def download_files(paths: set):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ok = skipped = failed = 0
    for p in sorted(paths):
        dest = UPLOAD_DIR / p
        if dest.is_file() and db.files.find_one({"storage_path": p}):
            skipped += 1
            continue
        try:
            r = requests.get(f"{LIVE}/api/files/{p}", timeout=180)
            r.raise_for_status()
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  下载失败 {p}: {e}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(r.content)
        db.files.update_one(
            {"storage_path": p},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "storage_path": p,
                "original_filename": Path(p).name,
                "content_type": r.headers.get("Content-Type", "application/octet-stream").split(";")[0],
                "size": len(r.content),
                "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        ok += 1
    print(f"  文件：新下载 {ok}，已存在跳过 {skipped}，失败 {failed}")


def replace_collection(name: str, docs: list, key: str = "id"):
    if not docs:
        print(f"  {name}：线上为空，跳过")
        return
    db[name].delete_many({})
    db[name].insert_many([{k: v for k, v in d.items() if k != "_id"} for d in docs])
    print(f"  {name}：已导入 {len(docs)} 条")


def main():
    print(f"从 {LIVE} 迁移数据到 {os.environ['DB_NAME']} ...")
    headers = login()

    settings = get("/api/settings", headers)
    projects = get("/api/admin/projects", headers)["projects"]
    articles = get("/api/admin/articles", headers)["articles"]
    tutorials = get("/api/admin/tutorials", headers)["tutorials"]

    print("写入数据库：")
    db.settings.update_one({"key": "site"}, {"$set": {**settings, "key": "site"}}, upsert=True)
    print("  settings：已更新")
    replace_collection("projects", projects)
    replace_collection("articles", articles)
    replace_collection("tutorials", tutorials)

    paths: set = set()
    for obj in (settings, projects, articles, tutorials):
        collect_file_paths(obj, paths)
    print(f"下载引用的上传文件（{len(paths)} 个）到 {UPLOAD_DIR}：")
    download_files(paths)

    print("\n迁移完成。请打开后台核对：项目 / 新闻 / 教程 / 客服二维码是否正常显示。")


if __name__ == "__main__":
    main()
