import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_payment_logos(api):
    r = api.get(f"{BASE_URL}/api/payment-logos", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)


def test_settings(api):
    r = api.get(f"{BASE_URL}/api/settings", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "whatsapp_link" in data
    assert "cs_label" in data


def test_products_home(api):
    r = api.get(f"{BASE_URL}/api/products/home", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("quick", "hot", "by_category"):
        assert key in data, f"missing {key}"
    assert isinstance(data["by_category"], (list, dict))


def test_products_suggest(api):
    r = api.get(f"{BASE_URL}/api/products/suggest", params={"q": "抖音"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 8
    if data:
        item = data[0]
        for k in ("id", "name", "image"):
            assert k in item, f"missing key {k} in {item}"


def test_product_detail_known(api):
    # Verify known product ids exist for frontend test
    for pid in ("7814", "9440", "15507"):
        r = api.get(f"{BASE_URL}/api/products/{pid}", timeout=20)
        assert r.status_code == 200, f"product {pid}: {r.status_code} {r.text[:200]}"
