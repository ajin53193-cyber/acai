"""Pre-translate short DB content (products minus content_html, categories, articles title/abstract, payment methods, currencies) into `translations`."""
import asyncio, os, re, sys
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
from translate import translate_batch, CJK  # noqa: E402

SKIP_FIELDS = {"content_html", "content", "image", "image_source", "id", "source_id", "related_ids"}
MAX_LEN = 600


def collect(v, out, key=""):
    if key in SKIP_FIELDS:
        return
    if isinstance(v, str):
        if CJK.search(v) and len(v) <= MAX_LEN:
            out.add(v)
    elif isinstance(v, list):
        for x in v:
            collect(x, out, key)
    elif isinstance(v, dict):
        for k, x in v.items():
            collect(x, out, k)


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    srcs = set()
    for coll, q in [("products", {"active": True}), ("categories", {}), ("articles", {}), ("payment_methods", {}), ("currencies", {}), ("promos", {}), ("payment_logos", {})]:
        async for d in db[coll].find(q, {"_id": 0}):
            collect(d, srcs)
    have = {d["src"] async for d in db.translations.find({}, {"_id": 0, "src": 1})}
    todo = sorted(srcs - have, key=len)
    print("total", len(srcs), "todo", len(todo), flush=True)
    sem = asyncio.Semaphore(8)
    done = 0

    async def run(batch):
        nonlocal done
        async with sem:
            for attempt in range(2):
                try:
                    res = await translate_batch(batch, context="Product names, specs (e.g. 100鑽石 = 100 Diamonds), brand names, form field labels and tips of a game/app top-up store.")
                    if res:
                        await db.translations.bulk_write([__import__("pymongo").UpdateOne({"src": s}, {"$set": {"en": e}}, upsert=True) for s, e in res.items()])
                    done += len(batch)
                    if done % 400 < len(batch):
                        print("done", done, flush=True)
                    return
                except Exception as e:
                    print("fail", attempt, str(e)[:100], flush=True)
                    await asyncio.sleep(3)

    size = 50
    await asyncio.gather(*[run(todo[i:i + size]) for i in range(0, len(todo), size)])
    print("finished", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
