import asyncio, os, re, sys, html
import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "zh-TW,zh;q=0.9"}
TAB_RE = re.compile(r'<div class="new-tabs[^"]*"[^>]*>(.*?)</div>', re.S)
A_RE = re.compile(r'href="/zh-tw/detail/(\d+)"[^>]*>.*?<span[^>]*>(.*?)</span>', re.S)


async def fetch_group(client, pid):
    try:
        r = await client.get(f"https://www.kavip.com/zh-tw/detail/{pid}", timeout=25)
        if r.status_code != 200:
            return None
        m = TAB_RE.search(r.text)
        if not m:
            return []
        return [{"id": i, "label": html.unescape(re.sub(r"<[^>]+>", "", l)).strip()} for i, l in A_RE.findall(m.group(1))]
    except Exception as e:
        print("ERR", pid, e, flush=True)
        return None


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    q = {"group": {"$exists": False}} if "--all" not in sys.argv else {}
    ids = [p["source_id"] or p["id"] async for p in db.products.find(q, {"_id": 0, "id": 1, "source_id": 1})]
    print("todo", len(ids), flush=True)
    sem = asyncio.Semaphore(6)
    done = 0
    async with httpx.AsyncClient(headers=H, follow_redirects=True) as client:
        async def work(pid):
            nonlocal done
            async with sem:
                g = await fetch_group(client, pid)
                if g is not None:
                    await db.products.update_one({"$or": [{"id": pid}, {"source_id": pid}]}, {"$set": {"group": g}})
                done += 1
                if done % 50 == 0:
                    print("done", done, flush=True)
        await asyncio.gather(*(work(i) for i in ids))
    print("finished", flush=True)

asyncio.run(main())
