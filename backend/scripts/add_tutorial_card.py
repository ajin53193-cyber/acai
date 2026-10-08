"""给客服常见问题补一张「礼品卡项目教程」跳转卡片（幂等）。用法：python scripts/add_tutorial_card.py"""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

CARD = {
    "text": "礼品卡项目教程",
    "image": "",
    "answer": "已为您打开《礼品卡项目教程》图文视频页面，看完如有疑问可随时在这里留言，或扫码进群由专人一对一带教。",
    "link": "/tutorials/gift-card",
}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    s = await db.settings.find_one({"key": "site"})
    qs = (s or {}).get("chat", {}).get("questions", [])
    idx = next((i for i, q in enumerate(qs) if (q.get("text") if isinstance(q, dict) else q) == CARD["text"]), None)
    if idx is None:
        qs.insert(0, CARD)
    elif not (isinstance(qs[idx], dict) and qs[idx].get("link")):
        qs[idx] = {**(qs[idx] if isinstance(qs[idx], dict) else {"text": qs[idx]}), "link": CARD["link"], "answer": (qs[idx].get("answer") if isinstance(qs[idx], dict) else "") or CARD["answer"]}
    await db.settings.update_one({"key": "site"}, {"$set": {"chat.questions": qs}})
    print([q.get("text") if isinstance(q, dict) else q for q in qs])


asyncio.run(main())
