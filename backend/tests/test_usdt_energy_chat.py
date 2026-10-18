"""Direct-logic test: energy_url passthrough on own-wallet USDT top-up + chat notify on settle."""
import asyncio
import sys
sys.path.insert(0, "/app/backend")
import server
from server import db, TopUpIn

TEST_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"  # tester member
PM_ID = "test-crypto-energy"
ADDR = "TTestEnergyWallet000000000000000000"
ENERGY = "TFxQpLU6XF7JReMXcNXJdK3spT6WKwFkxy"


async def main():
    ok = True
    # seed a crypto payment method with energy_url
    await db.payment_methods.delete_one({"id": PM_ID})
    await db.payment_methods.insert_one({
        "id": PM_ID, "name": "USDT 測試", "category": "usdt", "provider": "crypto", "active": True,
        "min_usd": 50, "max_usd": 10000, "sort_order": 9,
        "config": {"wallet_address": ADDR, "network": "TRC20", "wallet_note": "測試", "energy_trx_address": ENERGY},
        "created_at": server.now_iso(),
    })

    # 1) create own-wallet top-up via the real endpoint function
    doc = await server.wallet_topup_usdt(TopUpIn(amount_usd=100, method_id=PM_ID), None, {"user_id": TEST_UID})
    tid = doc["id"]
    print("created topup:", tid, "pay_amount=", doc.get("pay_amount"), "energy=", doc.get("energy_trx_address"))
    assert doc.get("energy_trx_address") == ENERGY, "energy_trx_address not stored on topup"
    assert 100.01 <= float(doc["pay_amount"]) <= 100.99, "pay_amount should carry a decimal tail"
    assert doc.get("own_wallet") is True
    print("PASS: energy_url + unique decimal amount on topup")

    # 2) settle -> wallet credited + chat system message
    before_bal = await server._wallet(TEST_UID)
    await db.chat_messages.delete_many({"session_id": {"$exists": True}, "text": {"$regex": "USDT 已到賬"}})
    t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
    r = await server._usdt_settle(t, {"paid_at": server.now_iso(), "tx_id": "TESTTX123"})
    await asyncio.sleep(2.5)  # let create_task'd notify/chat tasks run
    print("settle status:", r.get("status"))
    assert r.get("status") == "paid"

    after_bal = await server._wallet(TEST_UID)
    print("wallet:", before_bal, "->", after_bal)
    assert round(after_bal - before_bal, 2) == 100.0, "wallet not credited by amount_usd"

    msg = await db.chat_messages.find_one({"text": {"$regex": "USDT 已到賬"}, "sender": "admin"}, sort=[("created_at", -1)])
    print("chat msg:", (msg or {}).get("text"))
    assert msg, "no chat system_notify message inserted"
    sess = await db.chat_sessions.find_one({"id": msg["session_id"]}, {"_id": 0})
    assert sess["user_id"] == TEST_UID and sess.get("unread_user", 0) >= 1, "chat session unread not bumped"
    print("PASS: wallet credited + chat notify inserted (unread_user=%s)" % sess.get("unread_user"))

    # cleanup
    await db.topup_orders.delete_one({"id": tid})
    await db.payment_methods.delete_one({"id": PM_ID})
    await db.wallet_transactions.delete_many({"ref": doc.get("out_trade_no", "___")})
    print("ALL PASS" if ok else "FAIL")


asyncio.run(main())
