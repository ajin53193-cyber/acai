"""One-time cleanup: remove all non-TRC20 data (ERC20/BEP20) and seed Telegram bot token.
Run once: python cleanup_non_trc20.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
TG_BOT_TOKEN = os.environ.get("SEED_TELEGRAM_BOT_TOKEN", "")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    not_trc = {"network": {"$ne": "TRC20"}}

    report = {}
    for coll in ("channels", "orders", "chain_txs", "address_health", "alerts", "sweeps"):
        res = await db[coll].delete_many(not_trc)
        report[coll] = res.deleted_count

    # seed telegram bot token into notify settings (chat_id still required by admin)
    if TG_BOT_TOKEN:
        await db.settings.update_one(
            {"_id": "notify"},
            {"$set": {"telegram_bot_token": TG_BOT_TOKEN}},
            upsert=True,
        )
        report["telegram_bot_token"] = "set"

    print("cleanup report:", report)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
