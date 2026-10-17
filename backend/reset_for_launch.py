"""正式上線前清除測試數據。用法: python reset_for_launch.py --yes  (不加 --yes 只預覽)"""
import asyncio, json, os, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).with_name(".env"))

WIPE = [
    "orders", "topup_orders", "wallet_transactions", "point_transactions", "user_coupons", "user_logs", "events",
    "chat_sessions", "chat_messages", "giftcard_txns", "giftcard_numbers", "lottery_draws", "referral_visits",
    "referral_weekly_awards", "phone_accounts", "email_codes", "verifications", "feedback", "notification_logs",
    "admin_logs", "hub_logs", "hub_order_notes", "hub_chat_assign", "cron_runs",
]
PARTIAL = {
    "users": {"role": {"$ne": "admin"}},
    "gift_cards": {"$or": [{"source_order": {"$nin": [None, ""]}}, {"sold_to": {"$nin": [None, ""]}}, {"redeemed_by": {"$nin": [None, ""]}}]},
}


async def main(do_it: bool):
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    existing = set(await db.list_collection_names())
    targets = [(c, {}) for c in WIPE if c in existing] + [(c, q) for c, q in PARTIAL.items() if c in existing]
    plan = [(c, q, await db[c].count_documents(q)) for c, q in targets]
    print("將清除：")
    for c, _, n in plan:
        print(f"  {c:<26}{n:>6} 筆")
    if not do_it:
        print("\n預覽模式，未做任何修改。確認無誤請加 --yes 執行。")
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    bak = Path(__file__).with_name(f"backup_before_launch_{stamp}.zip")
    with zipfile.ZipFile(bak, "w", zipfile.ZIP_DEFLATED) as z:
        for c, q, n in plan:
            if n:
                docs = await db[c].find(q, {"_id": 0}).to_list(None)
                z.writestr(f"{c}.json", json.dumps(docs, ensure_ascii=False, default=str))
    print(f"\n備份完成：{bak}")
    for c, q, n in plan:
        if n:
            r = await db[c].delete_many(q)
            print(f"  已清除 {c}: {r.deleted_count}")
    await db.users.update_many({}, {"$set": {"wallet_balance_usd": 0, "points": 0}})
    print("\n完成。管理員帳號、商品、分類、評價、設定均已保留。")


if __name__ == "__main__":
    asyncio.run(main("--yes" in sys.argv))
