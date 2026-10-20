"""補齊 users.created_at（註冊時間）：缺失者從 Clerk 取真實建立時間，取不到則用該會員最早的記錄時間。
用法（後端目錄，啟用 venv）：python backfill_created_at.py
"""
import asyncio
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
CLERK = os.environ.get("CLERK_SECRET_KEY", "")


async def clerk_created(uid: str):
    if not CLERK:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"https://api.clerk.com/v1/users/{uid}", headers={"Authorization": f"Bearer {CLERK}"})
        if r.status_code == 200 and r.json().get("created_at"):
            return datetime.fromtimestamp(r.json()["created_at"] / 1000, tz=timezone.utc).isoformat()
    except Exception:
        pass
    return None


async def earliest_record(uid: str):
    ts = []
    for col in ("phone_accounts", "orders", "topup_orders", "wallet_transactions", "user_logs", "verifications"):
        d = await db[col].find_one({"user_id": uid}, {"_id": 0, "created_at": 1}, sort=[("created_at", 1)])
        if d and d.get("created_at"):
            ts.append(d["created_at"])
    return min(ts) if ts else None


async def main():
    users = await db.users.find({"$or": [{"created_at": {"$exists": False}}, {"created_at": None}, {"created_at": ""}]}, {"_id": 0, "user_id": 1}).to_list(100000)
    print(f"缺註冊時間的會員：{len(users)}")
    fixed = 0
    for u in users:
        uid = u["user_id"]
        ts = await clerk_created(uid) or await earliest_record(uid) or datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"user_id": uid}, {"$set": {"created_at": ts}})
        fixed += 1
        print(f"  {uid} -> {ts}")
    print(f"✔ 已補齊 {fixed} 位")


asyncio.run(main())
