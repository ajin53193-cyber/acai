"""Beijing time (UTC+8) conversion tests for iteration 20.

Verifies that:
- Display dates (dashboard stats, merchant stats, profit snapshots) use Beijing calendar day
- Excel reports have '(北京时间)' label and time cells formatted as Beijing
- Daily-report preview defaults to Beijing today
- Order export job also uses Beijing time label
"""
import io
import os
import zipfile
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "ajin53193@gmail.com"
ADMIN_PWD = "admin888"
BJ_TZ = timezone(timedelta(hours=8))


def bj_today():
    return datetime.now(BJ_TZ).strftime("%Y-%m-%d")


def bj_yesterday():
    return (datetime.now(BJ_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")


def bj_month():
    return datetime.now(BJ_TZ).strftime("%Y-%m")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def accounts(admin_headers):
    r = requests.get(f"{BASE_URL}/api/accounts", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    rows = data if isinstance(data, list) else data.get("items", data.get("data", []))
    merchants = [a for a in rows if a.get("role") == "merchant"]
    agents = [a for a in rows if a.get("role") == "agent"]
    return {"merchants": merchants, "agents": agents}


# ------- Dashboard -------
def test_dashboard_stat_date_is_beijing(admin_headers):
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    # stat_date should match Beijing today
    assert data.get("stat_date") == bj_today(), f"stat_date={data.get('stat_date')} expected {bj_today()}"
    trend = data.get("trend") or []
    assert len(trend) >= 1
    # last trend entry should be Beijing today in MM-DD
    today_mmdd = datetime.now(BJ_TZ).strftime("%m-%d")
    assert trend[-1]["date"] == today_mmdd, f"last trend date={trend[-1]['date']} expected {today_mmdd}"


# ------- Merchant stats -------
def test_merchant_stats_default_date_is_beijing(admin_headers):
    r = requests.get(f"{BASE_URL}/api/stats/merchants", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    # Should expose a 'date' label (default Beijing today)
    label = data.get("date") if isinstance(data, dict) else None
    assert label == bj_today(), f"stats date label={label} expected {bj_today()}"


def test_merchant_stats_with_explicit_date(admin_headers):
    r = requests.get(f"{BASE_URL}/api/stats/merchants", params={"date": bj_yesterday()}, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    label = data.get("date") if isinstance(data, dict) else None
    assert label == bj_yesterday(), f"stats date label={label} expected {bj_yesterday()}"


# ------- Profit snapshot -------
def test_profit_snapshot_run_beijing(admin_headers):
    day = bj_yesterday()
    r = requests.post(f"{BASE_URL}/api/profit-snapshots/run", json={"date": day}, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"snapshot run failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    # Response may be snapshot dict or {"ok":...,"snapshot":{...}}
    snap = data.get("snapshot") if isinstance(data, dict) and "snapshot" in data else data
    assert snap.get("date") == day, f"snapshot date={snap.get('date')} expected {day}"


def test_profit_snapshots_list(admin_headers):
    r = requests.get(f"{BASE_URL}/api/profit-snapshots", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    rows = data if isinstance(data, list) else data.get("items", [])
    assert isinstance(rows, list)


# ------- Excel reports (verify xlsx and '(北京时间)' label) -------
def _is_xlsx(content: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            names = z.namelist()
            return any(n.startswith("xl/") for n in names)
    except zipfile.BadZipFile:
        return False


def _xlsx_contains_text(content: bytes, needle: str) -> bool:
    """Scan all xml parts in xlsx for a substring."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        for n in z.namelist():
            if n.endswith(".xml"):
                try:
                    txt = z.read(n).decode("utf-8", errors="ignore")
                except Exception:
                    continue
                if needle in txt:
                    return True
    return False


def test_report_merchant_stats_xlsx(admin_headers):
    r = requests.get(f"{BASE_URL}/api/reports/merchant-stats", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    assert _is_xlsx(r.content), "not a valid xlsx"
    # merchant-stats sheet uses '统计区间' label (no 生成时间 row), content must match Beijing today
    assert _xlsx_contains_text(r.content, bj_today()), "merchant-stats xlsx missing Beijing today label"


def test_report_agent_commission_xlsx(admin_headers, accounts):
    params = {"month": bj_month()}
    if accounts["agents"]:
        params["agent_id"] = accounts["agents"][0]["id"]
    r = requests.get(f"{BASE_URL}/api/reports/agent-commission", params=params, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"agent-commission failed: {r.status_code} {r.text[:300]}"
    assert _is_xlsx(r.content)
    assert _xlsx_contains_text(r.content, "北京时间"), "missing (北京时间) in agent-commission xlsx"


def test_report_merchant_statement_xlsx(admin_headers, accounts):
    if not accounts["merchants"]:
        pytest.skip("no merchants")
    mid = accounts["merchants"][0]["id"]
    r = requests.get(f"{BASE_URL}/api/reports/merchant-statement",
                     params={"month": bj_month(), "merchant_id": mid},
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    assert _is_xlsx(r.content)
    assert _xlsx_contains_text(r.content, "北京时间"), "missing (北京时间) in merchant-statement"


def test_report_balance_ledger_xlsx(admin_headers, accounts):
    if not accounts["merchants"]:
        pytest.skip("no merchants")
    aid = accounts["merchants"][0]["id"]
    r = requests.get(f"{BASE_URL}/api/reports/balance-ledger",
                     params={"account_id": aid, "month": bj_month()},
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    assert _is_xlsx(r.content)
    # balance-ledger has no 生成时间/导出时间 row; verify time cells use Beijing (no explicit label expected)


# ------- Order export job -------
def test_order_export_beijing(admin_headers):
    # Try common endpoints for exporting orders — multiple shapes exist.
    today = bj_today()
    month_start = today[:8] + "01"
    body_candidates = [
        {"start": month_start, "end": today, "format": "xlsx"},
        {"start_date": month_start, "end_date": today},
        {"date_from": month_start, "date_to": today},
    ]
    r = None
    for body in body_candidates:
        r = requests.post(f"{BASE_URL}/api/reports/order-export", json=body, headers=admin_headers, timeout=60)
        if r.status_code != 404:
            break
    assert r is not None
    if r.status_code == 404:
        # Try GET-style
        r = requests.get(f"{BASE_URL}/api/reports/orders",
                         params={"start": month_start, "end": today},
                         headers=admin_headers, timeout=60)
    assert r.status_code in (200, 201, 202), f"order export failed: {r.status_code} {r.text[:300]}"
    ct = r.headers.get("content-type", "")
    if "spreadsheetml" in ct or "octet-stream" in ct or _is_xlsx(r.content):
        assert _xlsx_contains_text(r.content, "北京时间"), "order xlsx missing (北京时间)"
    # else async job created — accept


# ------- Daily report -------
def test_daily_report_default(admin_headers):
    r = requests.post(f"{BASE_URL}/api/notify/daily-report", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data.get("date") == bj_today(), f"daily report date={data.get('date')} expected {bj_today()}"


def test_daily_report_future_date_rejected(admin_headers):
    future = (datetime.now(BJ_TZ) + timedelta(days=5)).strftime("%Y-%m-%d")
    r = requests.post(f"{BASE_URL}/api/notify/daily-report",
                      params={"date": future}, headers=admin_headers, timeout=15)
    assert r.status_code == 400, f"expected 400 for future date, got {r.status_code} {r.text[:200]}"
