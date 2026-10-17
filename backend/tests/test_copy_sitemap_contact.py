"""Tests for site copy admin, settings (hotline/wechat), and dynamic sitemap.xml."""
import os
import copy as _copy
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_USER = "admin"
ADMIN_PASS = "Heying@2026"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"Login did not return token: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- GET /api/settings (copy defaults) ----------
def test_settings_contains_copy_defaults():
    r = requests.get(f"{API}/settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "copy" in data, data.keys()
    c = data["copy"]
    for k in ["compliance_badges", "nav", "home", "cooperation", "about", "contact", "footer"]:
        assert k in c, f"Missing copy key: {k}"
    assert isinstance(c["compliance_badges"], list)
    assert c["home"]["hero_title1"] == "合赢项目社"
    assert data["contact"]["hotline"] == ""
    assert data["contact"]["wechat"] == ""


# ---------- PUT /api/admin/settings/copy ----------
def test_update_site_copy_requires_auth():
    # Fetch current copy, modify a field, and ensure 401 without token
    r = requests.get(f"{API}/settings", timeout=15)
    cur = r.json()["copy"]
    r2 = requests.put(f"{API}/admin/settings/copy", json=cur, timeout=15)
    assert r2.status_code in (401, 403), r2.status_code


def test_update_site_copy_and_restore(auth_headers):
    r = requests.get(f"{API}/settings", timeout=15)
    original = _copy.deepcopy(r.json()["copy"])

    modified = _copy.deepcopy(original)
    modified["home"]["hero_title1"] = "测试标题"
    modified["compliance_badges"] = ["A", "B"]

    r2 = requests.put(f"{API}/admin/settings/copy", json=modified, headers=auth_headers, timeout=15)
    assert r2.status_code == 200, r2.text

    r3 = requests.get(f"{API}/settings", timeout=15)
    got = r3.json()["copy"]
    assert got["home"]["hero_title1"] == "测试标题"
    assert got["compliance_badges"] == ["A", "B"]

    # Restore to defaults expected by the brief
    original["home"]["hero_title1"] = "合赢项目社"
    original["compliance_badges"] = ["平台不收取任何费用", "不承诺收益", "正规合规项目"]
    r4 = requests.put(f"{API}/admin/settings/copy", json=original, headers=auth_headers, timeout=15)
    assert r4.status_code == 200

    r5 = requests.get(f"{API}/settings", timeout=15)
    final = r5.json()["copy"]
    assert final["home"]["hero_title1"] == "合赢项目社"
    assert final["compliance_badges"] == ["平台不收取任何费用", "不承诺收益", "正规合规项目"]


# ---------- PUT /api/admin/settings (hotline/wechat) and copy preservation ----------
def test_update_settings_hotline_wechat_preserves_copy(auth_headers):
    r = requests.get(f"{API}/settings", timeout=15)
    data = r.json()
    copy_before = _copy.deepcopy(data["copy"])

    payload = {
        "contact": {**data["contact"], "hotline": "138-0000-0000", "wechat": "hy_kefu"},
        "team": data.get("team", []),
        "stats": data.get("stats", []),
        "categories": data.get("categories", []),
        "chat": data.get("chat", {}),
        "tiers": data.get("tiers", []),
        "edges": data.get("edges", []),
        "milestones": data.get("milestones", []),
    }
    r2 = requests.put(f"{API}/admin/settings", json=payload, headers=auth_headers, timeout=20)
    assert r2.status_code == 200, r2.text

    r3 = requests.get(f"{API}/settings", timeout=15)
    after = r3.json()
    assert after["contact"]["hotline"] == "138-0000-0000"
    assert after["contact"]["wechat"] == "hy_kefu"
    # copy must not be reset
    assert "copy" in after
    assert after["copy"]["home"]["hero_title1"] == copy_before["home"]["hero_title1"]
    assert after["copy"]["compliance_badges"] == copy_before["compliance_badges"]

    # Restore hotline/wechat empty
    payload["contact"]["hotline"] = ""
    payload["contact"]["wechat"] = ""
    r4 = requests.put(f"{API}/admin/settings", json=payload, headers=auth_headers, timeout=20)
    assert r4.status_code == 200
    r5 = requests.get(f"{API}/settings", timeout=15)
    assert r5.json()["contact"]["hotline"] == ""
    assert r5.json()["contact"]["wechat"] == ""


# ---------- GET /api/sitemap.xml ----------
def test_sitemap_xml():
    # sitemap route is registered without /api? route is inside api_router per server.py line 823
    r = requests.get(f"{API}/sitemap.xml", timeout=15)
    assert r.status_code == 200, r.text
    ctype = r.headers.get("content-type", "")
    assert "xml" in ctype.lower(), ctype
    body = r.text
    for path in ["https://eztyv.com/", "/projects", "/cooperation", "/news", "/about", "/contact", "/tutorials/gift-card"]:
        assert path in body, f"sitemap missing {path}"
