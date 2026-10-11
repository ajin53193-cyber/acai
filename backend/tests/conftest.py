"""Shared pytest fixtures for parallel-safe CI.

Goals:
- Make REACT_APP_BACKEND_URL available at module-import time (several legacy
  test modules read os.environ at import), so collection never errors under CI.
- Provide per-worker isolated accounts + unique data ids so tests can run in
  parallel (``-n N``) without stepping on shared state (admin lockout, shared
  operator 2FA, etc.).
"""
import os
import uuid

import pytest
import requests


def _resolve_backend_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        url = ln.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            url = ""
    url = (url or "").rstrip("/")
    if url:
        os.environ["REACT_APP_BACKEND_URL"] = url
    return url


BASE_URL = _resolve_backend_url()
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "ajin53193@gmail.com"
ADMIN_PASS = "admin888"


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def worker_id():
    """xdist worker id (``gw0``…) or ``main`` when running serially."""
    return os.environ.get("PYTEST_XDIST_WORKER", "main")


@pytest.fixture
def uid(worker_id):
    """Factory for per-worker unique identifiers (safe for parallel data)."""
    def _make(prefix="ci"):
        return f"{prefix}_{worker_id}_{uuid.uuid4().hex[:10]}"
    return _make


@pytest.fixture(scope="session")
def shared_admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def make_operator(shared_admin_token, worker_id):
    """Create throwaway operator account(s), isolated per worker, auto-cleaned.

    Pass ``enable_2fa=True`` to enroll TOTP and receive the secret — lets
    destructive 2FA flows run without ever touching the shared admin account.
    """
    import pyotp
    created = []

    def _make(permissions=None, enable_2fa=False):
        email = f"ci_op_{worker_id}_{uuid.uuid4().hex[:8]}@citest.com"
        password = "CiTest888!"
        r = requests.post(f"{API}/accounts", headers=_hdr(shared_admin_token), json={
            "email": email, "password": password, "name": f"CI-{worker_id}",
            "role": "operator", "permissions": permissions or ["orders.view"]}, timeout=15)
        assert r.status_code == 200, f"create operator failed: {r.text}"
        info = {"id": r.json()["id"], "email": email, "password": password, "secret": None}
        rl = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
        assert rl.status_code == 200, rl.text
        info["token"] = rl.json()["token"]
        if enable_2fa:
            rs = requests.post(f"{API}/auth/2fa/setup", headers=_hdr(info["token"]), timeout=15)
            assert rs.status_code == 200, rs.text
            secret = rs.json()["secret"]
            re_ = requests.post(f"{API}/auth/2fa/enable", headers=_hdr(info["token"]),
                                json={"code": pyotp.TOTP(secret).now()}, timeout=15)
            assert re_.status_code == 200, re_.text
            info["secret"] = secret
        created.append(info)
        return info

    yield _make
    for info in created:
        requests.delete(f"{API}/auth/lockouts/{info['email']}", headers=_hdr(shared_admin_token), timeout=15)
