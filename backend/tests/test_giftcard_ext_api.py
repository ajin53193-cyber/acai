"""External gift-card redemption API tests (iteration 38).

Covers POST {BASE}/api/ext/txn/redeem.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
URL = f"{BASE}/api/ext/txn/redeem"
HDRS_UA = {"User-Agent": "gogo589-test/1.0", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def mongo():
    cli = MongoClient(os.environ["MONGO_URL"])
    return cli[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def api_key(mongo):
    s = mongo.settings.find_one({"key": "giftcard"})
    key = (s or {}).get("value", {}).get("api_key")
    assert key, "no api key in settings"
    return key


@pytest.fixture(scope="module")
def seed_txn(mongo):
    # trade no must be all digits — _redeem strips non-digits before lookup
    import random
    trade_no = "20261014" + "".join(random.choices("0123456789", k=24))
    doc = {
        "id": uuid.uuid4().hex,
        "trade_no": trade_no,
        "order_id": "TEST_order_" + uuid.uuid4().hex[:8],
        "order_no": "TESTGT" + uuid.uuid4().hex[:6].upper(),
        "user_id": "TEST_user",
        "product_name": "新地商場禮品卡 (HKD)",
        "spec_label": "HKD 1000",
        "amount": 1000.0,
        "currency": "HKD",
        "phone": "98777777",
        "recipient_name": "測試",
        "redeemed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.giftcard_txns.insert_one(doc)
    yield doc
    mongo.giftcard_txns.delete_one({"trade_no": trade_no})


def _post(key, body):
    h = {**HDRS_UA, "X-API-Key": key}
    return requests.post(URL, headers=h, json=body, timeout=15)


class TestExtRedeem:
    def test_wrong_api_key_returns_401(self, seed_txn):
        r = _post("bad_key", {"transactionNo": seed_txn["trade_no"], "phone": "98777777", "amount": 1000})
        assert r.status_code == 401, r.text
        assert "API" in r.json().get("detail", "")

    def test_unknown_txn_returns_code_404(self, api_key):
        r = _post(api_key, {"transactionNo": "00000000" + "f" * 24, "phone": "98777777", "amount": 1000})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["code"] == 404 and "查無" in j["message"]

    def test_phone_mismatch_returns_422(self, api_key, seed_txn):
        r = _post(api_key, {"transactionNo": seed_txn["trade_no"], "phone": "60000001", "amount": 1000})
        assert r.status_code == 200
        j = r.json()
        assert j["code"] == 422

    def test_amount_mismatch_returns_422(self, api_key, seed_txn):
        r = _post(api_key, {"transactionNo": seed_txn["trade_no"], "phone": "98777777", "amount": 500})
        assert r.status_code == 200
        j = r.json()
        assert j["code"] == 422

    def test_success_then_duplicate_409(self, api_key, seed_txn):
        r = _post(api_key, {"transactionNo": seed_txn["trade_no"], "phone": "98777777", "amount": 1000})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["code"] == 0, j
        assert j["data"]["transactionNo"] == seed_txn["trade_no"]
        assert j["data"]["amount"] == 1000
        assert j["data"]["currency"] == "HKD"
        # second time → 409
        r2 = _post(api_key, {"transactionNo": seed_txn["trade_no"], "phone": "98777777", "amount": 1000})
        j2 = r2.json()
        assert j2["code"] == 409, j2
