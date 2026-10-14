import os, sys, time, json, base64, hmac, hashlib, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

SK = os.environ["CLERK_SECRET_KEY"]
BASE = os.environ.get("APP_PUBLIC_URL") or "http://localhost:8001"
# use external ingress
BASE = "https://crossborder-topup.preview.emergentagent.com"
UID = "user_3Kfh24fwfGJl8aUhmiiLZwTc4BL"  # admin@gogo589.com

def sign(payload, ttl):
    body = json.dumps({**payload, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()
    sig = hmac.new(SK.encode(), body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")

H = {"Authorization": f"Bearer {SK}", "User-Agent": "gogo589-test/1.0", "Content-Type": "application/json"}
s = requests.post("https://api.clerk.com/v1/sessions", headers=H, json={"user_id": UID}).json()
jwt = requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", headers=H, json={"expires_in_seconds": 3600}).json()["jwt"]
atok = sign({"uid": UID}, 3600)

hdr = {"Authorization": f"Bearer {jwt}", "X-Admin-Token": atok, "User-Agent": "gogo589-test/1.0"}

endpoints = [
    # Batch 2: products/inventory/specs
    ("GET", "/api/admin/inventory?page=1&size=5", None),
    ("GET", "/api/admin/inventory?only_low=1", None),
    ("GET", "/api/admin/spec-templates", None),
    # Batch 3: finance
    ("GET", "/api/admin/finance/settlement", None),
    ("GET", "/api/admin/finance/reconciliation", None),
    ("GET", "/api/admin/reports", None),
    # Batch 4: dashboard
    ("GET", "/api/admin/analytics/sales", None),
    ("GET", "/api/admin/analytics/realtime", None),
    # Batch 5: users
    ("GET", "/api/admin/user-reports", None),
]

print("BASE:", BASE)
ok = 0
for m, path, body in endpoints:
    try:
        r = requests.request(m, BASE + path, headers=hdr, json=body, timeout=30)
        snippet = r.text[:120].replace("\n", " ")
        status = "OK" if r.status_code == 200 else "FAIL"
        if r.status_code == 200: ok += 1
        print(f"[{status}] {r.status_code} {m} {path} -> {snippet}")
    except Exception as e:
        print(f"[ERR] {m} {path} -> {e}")
print(f"\n{ok}/{len(endpoints)} passed")
