"""Round 39 — Review reply templates, bad-review notifications, A2HS tracking & stats."""
import os
import subprocess
import sys
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


def _fe_url():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("no url")


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _fe_url()).rstrip("/")
UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
UA = "gogo589-r39/1.0"
UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def _mint_jwt():
    out = subprocess.run([sys.executable, "/app/tests/mint_token.py", UID],
                         capture_output=True, text=True, check=True)
    return out.stdout.strip()


def _mint_xat():
    sys.path.insert(0, "/app/backend")
    import admin_api
    return admin_api._sign({"uid": UID}, 3600)


@pytest.fixture(scope="session")
def headers():
    return {"Authorization": f"Bearer {_mint_jwt()}", "X-Admin-Token": _mint_xat(),
            "User-Agent": UA, "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def product_id():
    r = requests.get(f"{BASE_URL}/api/products", headers={"User-Agent": UA}, timeout=20)
    assert r.status_code == 200
    return r.json()[0]["id"]


# ====================== Templates ======================
def test_templates_get_default(headers):
    # Ensure a clean baseline (no override)
    r = requests.put(f"{BASE_URL}/api/admin/reviews/templates", headers=headers,
                     json={"items": []}, timeout=20)
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/admin/reviews/templates", headers=headers, timeout=20)
    assert g.status_code == 200
    data = g.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) == 5  # default list has 5


def test_templates_put_then_get(headers):
    new_items = ["TEST_tpl A", "TEST_tpl B", "TEST_tpl C"]
    r = requests.put(f"{BASE_URL}/api/admin/reviews/templates", headers=headers,
                     json={"items": new_items}, timeout=20)
    assert r.status_code == 200
    assert r.json()["items"] == new_items
    g = requests.get(f"{BASE_URL}/api/admin/reviews/templates", headers=headers, timeout=20)
    assert g.json()["items"] == new_items
    # Restore to default (empty -> default fallback)
    requests.put(f"{BASE_URL}/api/admin/reviews/templates", headers=headers,
                 json={"items": []}, timeout=20)


# ====================== Bad reviews flow ======================
@pytest.fixture(scope="module")
def bad_review(product_id):
    hdr = {"Authorization": f"Bearer {_mint_jwt()}", "X-Admin-Token": _mint_xat(),
           "User-Agent": UA, "Content-Type": "application/json"}
    body = {"product_id": product_id, "author": "TEST_bad_r39", "rating": 1,
            "content": "測試差評", "visible": True}
    r = requests.post(f"{BASE_URL}/api/admin/reviews", headers=hdr, json=body, timeout=20)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    yield rid
    requests.delete(f"{BASE_URL}/api/admin/reviews/{rid}", headers=hdr, timeout=20)


def _counts(headers):
    r = requests.get(f"{BASE_URL}/api/admin/reviews", headers=headers, timeout=20)
    return r.json()["counts"]


def test_bad_count_increments(headers, product_id):
    before = _counts(headers)["bad"]
    body = {"product_id": product_id, "author": "TEST_bad_tmp", "rating": 2,
            "content": "測試差評 tmp", "visible": True}
    r = requests.post(f"{BASE_URL}/api/admin/reviews", headers=headers, json=body, timeout=20)
    rid = r.json()["id"]
    try:
        assert _counts(headers)["bad"] == before + 1
    finally:
        requests.delete(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers, timeout=20)


def test_bad_filter(headers, bad_review):
    r = requests.get(f"{BASE_URL}/api/admin/reviews?bad=1", headers=headers, timeout=20)
    assert r.status_code == 200
    items = r.json()["items"]
    assert bad_review in [i["id"] for i in items]
    for it in items:
        assert it["rating"] <= 2
        assert not it.get("reply")
        assert it.get("handled") is not True


def test_badges(headers, bad_review):
    r = requests.get(f"{BASE_URL}/api/admin/badges", headers=headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "giftcard-orders" in data and "reviews" in data
    bad_counts = _counts(headers)["bad"]
    assert data["reviews"] == bad_counts


def test_dashboard_totals_bad_reviews(headers, bad_review):
    r = requests.get(f"{BASE_URL}/api/admin/dashboard?days=30", headers=headers, timeout=20)
    assert r.status_code == 200
    totals = r.json().get("totals", {})
    assert "bad_reviews" in totals
    badges = requests.get(f"{BASE_URL}/api/admin/badges", headers=headers, timeout=20).json()
    assert totals["bad_reviews"] == badges["reviews"]


def test_patch_handled_removes_from_bad(headers, bad_review):
    before = _counts(headers)["bad"]
    r = requests.patch(f"{BASE_URL}/api/admin/reviews/{bad_review}", headers=headers,
                       json={"handled": True}, timeout=20)
    assert r.status_code == 200
    assert r.json().get("handled") is True
    assert _counts(headers)["bad"] == before - 1
    # revert
    r2 = requests.patch(f"{BASE_URL}/api/admin/reviews/{bad_review}", headers=headers,
                        json={"handled": False}, timeout=20)
    assert r2.status_code == 200
    assert _counts(headers)["bad"] == before


def test_patch_reply_removes_from_bad(headers, bad_review):
    before = _counts(headers)["bad"]
    r = requests.patch(f"{BASE_URL}/api/admin/reviews/{bad_review}", headers=headers,
                       json={"reply": "已處理"}, timeout=20)
    assert r.status_code == 200
    assert _counts(headers)["bad"] == before - 1
    # revert reply
    requests.patch(f"{BASE_URL}/api/admin/reviews/{bad_review}", headers=headers,
                   json={"reply": ""}, timeout=20)


# ====================== Track API ======================
def test_track_unknown_event():
    r = requests.post(f"{BASE_URL}/api/track", json={"event": "bogus"},
                      headers={"User-Agent": UA}, timeout=20)
    assert r.status_code == 400


@pytest.mark.parametrize("evt", ["a2hs_tip_shown", "a2hs_tip_open", "a2hs_tip_close",
                                 "a2hs_dialog_open", "pwa_launch"])
def test_track_known_events(evt):
    r = requests.post(f"{BASE_URL}/api/track",
                      json={"event": evt, "source": "pytest", "path": "/", "standalone": False},
                      headers={"User-Agent": UA_IPHONE}, timeout=20)
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ====================== A2HS stats ======================
def test_a2hs_stats(headers):
    # fire a bunch of track events to generate deltas
    for evt in ["a2hs_tip_shown", "a2hs_tip_shown", "a2hs_tip_open"]:
        requests.post(f"{BASE_URL}/api/track",
                      json={"event": evt, "source": "tip", "path": "/", "standalone": False},
                      headers={"User-Agent": UA_IPHONE}, timeout=10)
    requests.post(f"{BASE_URL}/api/track",
                  json={"event": "a2hs_dialog_open", "source": "tip", "path": "/", "standalone": False},
                  headers={"User-Agent": UA_IPHONE}, timeout=10)
    time.sleep(0.3)
    r = requests.get(f"{BASE_URL}/api/admin/a2hs/stats?days=30", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("tip_shown", "tip_open", "tip_close", "tip_ctr", "dialog_open",
              "pwa_launch", "by_platform", "by_source", "series"):
        assert k in d, k
    assert len(d["series"]) == 30
    for row in d["series"]:
        assert "date" in row and "dialog_open" in row and "pwa_launch" in row
    assert d["tip_shown"] > 0
    assert d["tip_open"] > 0
    # tip_ctr == tip_open/tip_shown*100 rounded(1)
    expected = round(d["tip_open"] / d["tip_shown"] * 100, 1)
    assert d["tip_ctr"] == expected
    # iOS UA recorded
    assert d["by_platform"].get("ios", 0) >= 1


def test_a2hs_stats_requires_admin():
    r = requests.get(f"{BASE_URL}/api/admin/a2hs/stats?days=30",
                     headers={"User-Agent": UA}, timeout=10)
    assert r.status_code in (401, 403)
