import os, sys, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]
H = {"Authorization": f"Bearer {SK}", "User-Agent": "gogo589-test/1.0", "Content-Type": "application/json"}
uid = sys.argv[1]
s = requests.post("https://api.clerk.com/v1/sessions", headers=H, json={"user_id": uid}).json()
t = requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", headers=H, json={"expires_in_seconds": 3600}).json()
print(t["jwt"])
