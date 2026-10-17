"""正式上線前清除測試數據。用法: python reset_for_launch.py --yes  (不加 --yes 只預覽)"""
import asyncio, json, os, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path

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


async def plan(db, keep_admin_emails=None):
    existing = set(await db.list_collection_names())
    targets = [(c, {}) for c in WIPE if c in existing] + [(c, q) for c, q in PARTIAL.items() if c in existing]
    if keep_admin_emails:
        targets = [(c, {"email": {"$nin": keep_admin_emails}} if c == "users" else q) for c, q in targets]
    return [(c, q, await db[c].count_documents(q)) for c, q in targets]


async def execute(db, items):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    bak = Path(__file__).with_name(f"backup_before_launch_{stamp}.zip")
    with zipfile.ZipFile(bak, "w", zipfile.ZIP_DEFLATED) as z:
        for c, q, n in items:
            if n:
                z.writestr(f"{c}.json", json.dumps(await db[c].find(q, {"_id": 0}).to_list(None), ensure_ascii=False, default=str))
    deleted = {}
    for c, q, n in items:
        if n:
            deleted[c] = (await db[c].delete_many(q)).deleted_count
    uids = [u["user_id"] async for u in db.users.find({}, {"_id": 0, "user_id": 1})]
    await db.admin_2fa.delete_many({"user_id": {"$nin": uids}})
    await db.users.update_many({}, {"$set": {"wallet_balance_usd": 0, "points": 0}})
    return {"backup": str(bak), "deleted": deleted}


async def main(do_it: bool):
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv(Path(__file__).with_name(".env"))
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    items = await plan(db)
    print("將清除：")
    for c, _, n in items:
        print(f"  {c:<26}{n:>6} 筆")
    if not do_it:
        print("\n預覽模式，未做任何修改。確認無誤請加 --yes 執行。")
        return
    r = await execute(db, items)
    print(f"\n備份完成：{r['backup']}")
    for c, n in r["deleted"].items():
        print(f"  已清除 {c}: {n}")
    print("\n完成。管理員帳號、商品、分類、評價、設定均已保留。")


if __name__ == "__main__":
    asyncio.run(main("--yes" in sys.argv))
