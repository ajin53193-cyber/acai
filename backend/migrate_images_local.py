#!/usr/bin/env python3
"""一次性迁移：把 Emergent 对象存储里所有现有图片下载到本地磁盘。

用途：切换到本地图片存储（LOCAL_STORAGE_DIR）前，趁 EMERGENT_LLM_KEY 仍有效，
把数据库里引用到的所有图片（商品/分类/收款码/支付logo/评价/KYC证件等）
从对象存储全部拉到本地目录，之后即可彻底脱离对象存储。

运行（在后端服务器，venv 已装好依赖）：
    source venv/bin/activate
    python migrate_images_local.py
或直接用包装脚本： bash migrate_images.sh

读取 backend/.env 的：MONGO_URL / DB_NAME / EMERGENT_LLM_KEY / LOCAL_STORAGE_DIR
注意：本脚本始终直连对象存储下载，不受 LOCAL_STORAGE_DIR 影响（可在已设好本地目录时运行）。
"""
import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
KEY = os.environ.get("EMERGENT_LLM_KEY")
LOCAL_DIR = (os.environ.get("LOCAL_STORAGE_DIR") or "").strip()
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

# 匹配 /api/img/ 后的对象路径，以及裸的 gogo589/ 路径（KYC 证件）
IMG_IN_URL = re.compile(r"/api/img/(gogo589/[^\s\"'<>)\]]+)")
RAW_PATH = re.compile(r"^gogo589/[A-Za-z0-9_\-./]+\.(?:png|jpe?g|gif|webp|svg|bmp)$", re.IGNORECASE)


def fail(msg: str):
    print(f"\033[0;31m✘ {msg}\033[0m", file=sys.stderr)
    sys.exit(1)


def collect_paths(value, found: set):
    if isinstance(value, str):
        for m in IMG_IN_URL.findall(value):
            found.add(m)
        if RAW_PATH.match(value.strip()):
            found.add(value.strip())
    elif isinstance(value, dict):
        for v in value.values():
            collect_paths(v, found)
    elif isinstance(value, list):
        for v in value:
            collect_paths(v, found)


def init_storage_key() -> str:
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": KEY}, timeout=30)
    resp.raise_for_status()
    return resp.json()["storage_key"]


def download(path: str, storage_key: str):
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": storage_key}, timeout=60)
    return resp


def main():
    if not MONGO_URL or not DB_NAME:
        fail("backend/.env 缺少 MONGO_URL / DB_NAME")
    if not LOCAL_DIR:
        fail("backend/.env 未设置 LOCAL_STORAGE_DIR（本地图片目录），请先设置再运行")
    if not KEY:
        fail("backend/.env 的 EMERGENT_LLM_KEY 为空——没有它无法从对象存储下载老图片")

    base = Path(LOCAL_DIR)
    base.mkdir(parents=True, exist_ok=True)

    print(f"➤ 连接数据库 {DB_NAME} ...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    client.admin.command("ping")

    found = set()
    for coll in db.list_collection_names():
        n = 0
        for doc in db[coll].find({}):
            collect_paths(doc, found)
            n += 1
        print(f"  · 扫描 {coll}: {n} 条")
    print(f"➤ 共发现 {len(found)} 个图片对象路径")

    if not found:
        print("没有发现任何对象存储图片，无需迁移。")
        return

    print("➤ 初始化对象存储连接 ...")
    try:
        storage_key = init_storage_key()
    except Exception as e:
        fail(f"对象存储初始化失败（EMERGENT_LLM_KEY 可能已失效）：{e}")

    ok = skip = miss = err = 0
    for path in sorted(found):
        dest = base / path
        if dest.is_file() and dest.stat().st_size > 0:
            skip += 1
            continue
        try:
            resp = download(path, storage_key)
            if resp.status_code == 404:
                try:
                    storage_key = init_storage_key()
                    resp = download(path, storage_key)
                except Exception:
                    pass
            if resp.status_code == 404:
                miss += 1
                print(f"  ⚠ 对象不存在(404): {path}")
                continue
            resp.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            ok += 1
            if ok % 20 == 0:
                print(f"  ... 已下载 {ok}")
        except Exception as e:
            err += 1
            print(f"  ✘ 下载失败 {path}: {e}")

    print("\n\033[0;32m✔ 迁移完成\033[0m")
    print(f"  新下载: {ok}  |  已存在跳过: {skip}  |  对象缺失404: {miss}  |  失败: {err}")
    print(f"  本地目录: {base.resolve()}")
    if err:
        print("\033[1;33m⚠ 有下载失败项，可重跑本脚本（已下载的会自动跳过）。\033[0m")


if __name__ == "__main__":
    main()
