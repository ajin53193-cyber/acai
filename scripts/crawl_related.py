import asyncio, os, sys
import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
H = {"User-Agent": "Mozilla/5.0", "Accept": "application/json", "languageid": "9", "currency": "USD", "clientid": "2615", "siteid": "2615", "Referer": "https://www.kavip.com/zh-tw"}
B = "https://www.kavip.com/pro-api/openapi/product/get-product-related-recommend/"


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    q = {"related_ids": {"$exists": False}} if "--all" not in sys.argv else {}
    ids = [(p["id"], p.get("source_id") or p["id"]) async for p in db.products.find(q, {"_id": 0, "id": 1, "source_id": 1})]
    print("todo", len(ids), flush=True)
    sem = asyncio.Semaphore(6)
    done = 0
    async with httpx.AsyncClient(headers=H, timeout=25) as client:
        async def work(pid, sid):
            nonlocal done
            async with sem:
                try:
                    r = await client.get(B + str(sid))
                    data = r.json().get("data") or []
                    await db.products.update_one({"id": pid}, {"$set": {"related_ids": [str(x["productId"]) for x in data]}})
                except Exception as e:
                    print("ERR", pid, e, flush=True)
                done += 1
                if done % 100 == 0:
                    print("done", done, flush=True)
        await asyncio.gather(*(work(*i) for i in ids))
    print("finished", flush=True)

asyncio.run(main())
