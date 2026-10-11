"""清除测试/演示数据，保留：管理员账号、系统设置(settings)、通道(channels)与收款地址配置。
用法:  python reset_data.py --yes [--keep-operators]
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

BUSINESS_COLLECTIONS = [
    "orders", "chain_txs", "chain_usage", "balance_ledger", "balance_logs", "payouts",
    "callbacks", "callback_inbox", "api_nonces", "support_messages", "support_threads",
    "support_files", "audit_logs", "alerts", "export_jobs", "export_schedules",
    "exports.files", "exports.chunks", "profit_snapshots", "cron_runs", "login_attempts",
    "ip_geo", "sweeps", "address_health",
]


async def reset(db, keep_operators: bool = False) -> dict:
    report = {}
    for c in BUSINESS_COLLECTIONS:
        r = await db[c].delete_many({})
        report[c] = r.deleted_count
    roles = ["merchant", "agent"] + ([] if keep_operators else ["operator"])
    r = await db.users.delete_many({"role": {"$in": roles}})
    report["users_removed"] = r.deleted_count
    await db.users.update_many({"role": "admin"}, {"$set": {"balance": 0.0, "frozen_balance": 0.0},
                                                   "$unset": {"login_ips": "", "login_cities": ""}})
    await db.address_meta.update_many({}, {"$set": {"pending_count": 0}})
    await db.channels.update_many({}, {"$set": {"wallet_balance": 0.0}})
    return report


async def main():
    if "--yes" not in sys.argv:
        print("此操作将删除所有业务数据（订单/流水/提现/客服/审计/商户/代理/操作员）。确认请加 --yes")
        sys.exit(1)
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    report = await reset(db, keep_operators="--keep-operators" in sys.argv)
    for k, v in report.items():
        print(f"{k:28s} {v}")
    print("完成：测试数据已清除，管理员/设置/通道/地址已保留。")


if __name__ == "__main__":
    asyncio.run(main())
