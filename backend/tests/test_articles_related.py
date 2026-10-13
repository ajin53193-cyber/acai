"""Backend tests for Articles API and Product related items (iteration 6)."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


class TestArticles:
    def test_list_page1(self, s):
        r = s.get(f"{BASE_URL}/api/articles", params={"page": 1, "size": 15}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 51, f"expected total=51 got {data['total']}"
        assert len(data["rows"]) == 15
        row = data["rows"][0]
        for k in ("id", "title", "cover", "published_at"):
            assert k in row, f"missing {k}"
        assert "content_html" not in row, "content_html must be excluded in list"

    def test_list_page4_remaining(self, s):
        r = s.get(f"{BASE_URL}/api/articles", params={"page": 4, "size": 15}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # 51 - 45 = 6 remaining
        assert len(data["rows"]) == 6

    def test_detail_and_view_count_increments(self, s):
        lr = s.get(f"{BASE_URL}/api/articles", params={"page": 1, "size": 15}, timeout=15).json()
        aid = lr["rows"][0]["id"]
        r1 = s.get(f"{BASE_URL}/api/articles/{aid}", timeout=15)
        assert r1.status_code == 200
        d1 = r1.json()
        assert "content_html" in d1
        assert "prev" in d1 and "next" in d1
        v1 = d1["view_count"]
        r2 = s.get(f"{BASE_URL}/api/articles/{aid}", timeout=15)
        v2 = r2.json()["view_count"]
        assert v2 > v1, f"view_count did not increment ({v1} -> {v2})"

    def test_detail_unknown_404(self, s):
        r = s.get(f"{BASE_URL}/api/articles/nope-nonexistent-id", timeout=15)
        assert r.status_code == 404

    def test_no_kavip_mention(self, s):
        rx = re.compile(r"kavip", re.IGNORECASE)
        # Walk all pages
        page = 1
        found = []
        while True:
            data = s.get(f"{BASE_URL}/api/articles", params={"page": page, "size": 15}, timeout=15).json()
            if not data["rows"]:
                break
            for row in data["rows"]:
                detail = s.get(f"{BASE_URL}/api/articles/{row['id']}", timeout=15).json()
                for field in ("title", "summary", "content_html"):
                    v = detail.get(field) or ""
                    if rx.search(v):
                        found.append(f"article {row['id']} field {field}")
            if page * 15 >= data["total"]:
                break
            page += 1
        assert not found, f"'kavip' mentions found: {found[:5]}"


class TestProductRelated:
    def test_product_7814_related_8(self, s):
        r = s.get(f"{BASE_URL}/api/products/7814", timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert "related" in p, "related missing"
        assert len(p["related"]) == 8, f"expected 8 related, got {len(p['related'])}"
        for rel in p["related"]:
            for k in ("id", "name", "image"):
                assert k in rel, f"related item missing {k}"
