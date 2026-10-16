import os
import mimetypes
from pathlib import Path
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "gogo589"
storage_key = None
LOCAL_DIR = (os.environ.get("LOCAL_STORAGE_DIR") or "").strip()


def _local_path(path: str) -> Path:
    p = (Path(LOCAL_DIR) / path.lstrip("/")).resolve()
    if Path(LOCAL_DIR).resolve() not in p.parents:
        raise ValueError("invalid path")
    return p


def init_storage(force: bool = False):
    global storage_key
    if LOCAL_DIR:
        Path(LOCAL_DIR).mkdir(parents=True, exist_ok=True)
        return "local"
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if LOCAL_DIR:
        p = _local_path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return {"path": path}
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    if LOCAL_DIR:
        p = _local_path(path)
        if not p.is_file():
            raise FileNotFoundError(path)
        return p.read_bytes(), mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
