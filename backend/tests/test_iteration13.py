"""Iteration 13: test new features — merchant-stats export, date range, drilldown, ledger range."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "ajin53193@gmail.com", "password": "admin888"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_merchant_stats_single(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/stats/merchants?date=2026-10-10", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "date" in d and "merchants" in d


def test_merchant_stats_range(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/stats/merchants?start=2026-10-09&end=2026-10-11", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "~" in d["date"], d["date"]


def test_merchant_stats_range_invalid(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/stats/merchants?start=2026-10-11&end=2026-10-09", timeout=15)
    assert r.status_code == 400


def test_merchant_stats_export_single(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/reports/merchant-stats?date=2026-10-10", timeout=20)
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "")
    assert len(r.content) > 1000


def test_merchant_stats_export_range(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/reports/merchant-stats?start=2026-10-09&end=2026-10-11", timeout=20)
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "")
    assert len(r.content) > 1000


def test_orders_filter_by_merchant_date(admin_session):
    stats = admin_session.get(f"{BASE_URL}/api/stats/merchants?date=2026-10-10", timeout=15).json()
    merchants = stats.get("merchants") or []
    if not merchants:
        pytest.skip("no merchants in stats")
    mid = merchants[0].get("merchant_id") or merchants[0].get("id")
    r = admin_session.get(f"{BASE_URL}/api/orders?merchant_id={mid}&date=2026-10-10", timeout=15)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    for it in items:
        assert it.get("merchant_id") == mid


def test_orders_filter_by_merchant_range(admin_session):
    stats = admin_session.get(f"{BASE_URL}/api/stats/merchants?start=2026-10-09&end=2026-10-11", timeout=15).json()
    merchants = stats.get("merchants") or []
    if not merchants:
        pytest.skip("no merchants in stats")
    mid = merchants[0].get("merchant_id") or merchants[0].get("id")
    r = admin_session.get(f"{BASE_URL}/api/orders?merchant_id={mid}&start=2026-10-09&end=2026-10-11", timeout=15)
    assert r.status_code == 200


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "merchant@demo.com", "password": "merchant888"}, timeout=15)
    if r.status_code != 200:
        pytest.skip("商户后台登录已按设计禁用（仅 API），此用例已废弃")
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_ledger_range(merchant_session):
    r = merchant_session.get(f"{BASE_URL}/api/balance/ledger?start=2026-10-01&end=2026-10-31", timeout=15)
    assert r.status_code == 200


def test_ledger_export_range(merchant_session):
    r = merchant_session.get(f"{BASE_URL}/api/reports/balance-ledger?start=2026-10-01&end=2026-10-31", timeout=20)
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "")


def test_orders_no_filters(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/orders", timeout=15)
    assert r.status_code == 200
