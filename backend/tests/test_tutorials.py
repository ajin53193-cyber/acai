"""Backend tests for tutorials, admin tutorials CRUD, video upload with Range, and chat link card."""
import os
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://corporate-web-95.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": "admin", "password": "Heying@2026"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Public tutorials ---
class TestPublicTutorials:
    def test_list_tutorials_contains_giftcard_no_steps(self):
        r = requests.get(f"{API}/tutorials", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "tutorials" in data
        slugs = [t.get("slug") for t in data["tutorials"]]
        assert "gift-card" in slugs
        gc = next(t for t in data["tutorials"] if t["slug"] == "gift-card")
        assert "steps" not in gc

    def test_get_giftcard_tutorial(self):
        r = requests.get(f"{API}/tutorials/gift-card", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == "gift-card"
        assert d["title"] == "礼品卡项目教程"
        assert "summary" in d
        assert "video_url" in d
        assert isinstance(d.get("steps"), list)
        assert len(d["steps"]) == 5

    def test_get_nonexistent_tutorial_404(self):
        r = requests.get(f"{API}/tutorials/not-exist-xyz", timeout=15)
        assert r.status_code == 404


# --- Admin tutorials CRUD ---
class TestAdminTutorialsCRUD:
    created_id = None
    slug = f"test-abc-{uuid.uuid4().hex[:6]}"

    def test_01_create_invalid_slug(self, auth):
        r = requests.post(f"{API}/admin/tutorials", headers=auth, json={
            "title": "Invalid Slug", "slug": "Bad_Slug!", "summary": "", "steps": [],
        }, timeout=15)
        assert r.status_code == 422  # pydantic pattern validation

    def test_02_create_success(self, auth):
        r = requests.post(f"{API}/admin/tutorials", headers=auth, json={
            "title": "TEST 教程",
            "slug": self.__class__.slug,
            "summary": "测试教程",
            "video_url": "https://www.w3schools.com/html/mov_bbb.mp4",
            "steps": [{"title": "s1", "text": "t1", "image": ""}, {"title": "s2", "text": "t2", "image": ""}],
        }, timeout=15)
        assert r.status_code == 201, r.text
        self.__class__.created_id = r.json()["id"]

    def test_03_create_duplicate_slug_400(self, auth):
        r = requests.post(f"{API}/admin/tutorials", headers=auth, json={
            "title": "Dup", "slug": self.__class__.slug, "summary": "", "steps": [],
        }, timeout=15)
        assert r.status_code == 400

    def test_04_get_persisted(self):
        r = requests.get(f"{API}/tutorials/{self.__class__.slug}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST 教程"
        assert len(d["steps"]) == 2
        assert d["video_url"].endswith(".mp4")

    def test_05_update(self, auth):
        r = requests.put(f"{API}/admin/tutorials/{self.__class__.created_id}", headers=auth, json={
            "title": "TEST 教程 Updated",
            "slug": self.__class__.slug,
            "summary": "updated",
            "video_url": "",
            "steps": [{"title": "s1", "text": "t1", "image": ""}],
        }, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/tutorials/{self.__class__.slug}", timeout=15).json()
        assert g["title"] == "TEST 教程 Updated"
        assert len(g["steps"]) == 1

    def test_06_unpublish_hides_from_public(self, auth):
        r = requests.patch(f"{API}/admin/tutorials/{self.__class__.created_id}/publish", headers=auth, json={"published": False}, timeout=15)
        assert r.status_code == 200
        pub = requests.get(f"{API}/tutorials/{self.__class__.slug}", timeout=15)
        assert pub.status_code == 404
        # admin list still contains it
        al = requests.get(f"{API}/admin/tutorials", headers=auth, timeout=15).json()
        slugs = [t["slug"] for t in al["tutorials"]]
        assert self.__class__.slug in slugs

    def test_07_delete(self, auth):
        r = requests.delete(f"{API}/admin/tutorials/{self.__class__.created_id}", headers=auth, timeout=15)
        assert r.status_code == 200
        # verify gone from admin list
        al = requests.get(f"{API}/admin/tutorials", headers=auth, timeout=15).json()
        slugs = [t["slug"] for t in al["tutorials"]]
        assert self.__class__.slug not in slugs


def _make_tiny_mp4() -> bytes:
    """Minimal mp4 (ftyp box + mdat) just to pass size/content type checks."""
    def box(name: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", 8 + len(payload)) + name + payload
    ftyp = box(b"ftyp", b"isom\x00\x00\x02\x00isomiso2mp41")
    # 200KB payload
    mdat = box(b"mdat", b"\x00" * (200 * 1024))
    return ftyp + mdat


# --- Video upload & range ---
class TestVideoUpload:
    uploaded_url = None

    def test_01_upload_non_video_rejected(self, auth):
        png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
        files = {"file": ("x.png", png, "image/png")}
        r = requests.post(f"{API}/admin/upload-video", headers=auth, files=files, timeout=30)
        assert r.status_code == 400

    def test_02_upload_mp4(self, auth):
        data = _make_tiny_mp4()
        files = {"file": ("tiny.mp4", data, "video/mp4")}
        r = requests.post(f"{API}/admin/upload-video", headers=auth, files=files, timeout=60)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["url"].startswith("/api/files/")
        self.__class__.uploaded_url = d["url"]

    def test_03_range_206(self):
        assert self.__class__.uploaded_url
        full = BASE_URL + self.__class__.uploaded_url
        r = requests.get(full, headers={"Range": "bytes=0-99"}, timeout=30)
        assert r.status_code == 206
        cr = r.headers.get("Content-Range", "")
        assert cr.startswith("bytes 0-99/")
        assert len(r.content) == 100


# --- Chat link via question card ---
class TestChatLink:
    def test_card_click_returns_link(self):
        sid = f"TEST-{uuid.uuid4().hex[:12]}"
        s = requests.post(f"{API}/chat/start", json={"session_id": sid, "name": "TEST_tester", "source": "test"}, timeout=15)
        assert s.status_code == 200
        m = requests.post(f"{API}/chat/{sid}/messages", json={"text": "礼品卡项目教程"}, timeout=15)
        assert m.status_code == 201
        msgs = requests.get(f"{API}/chat/{sid}/messages", timeout=15).json()["messages"]
        admin_msgs = [x for x in msgs if x["sender"] == "admin"]
        assert admin_msgs, "no admin reply"
        last = admin_msgs[-1]
        assert last.get("via") == "auto"
        assert last.get("link") == "/tutorials/gift-card"
