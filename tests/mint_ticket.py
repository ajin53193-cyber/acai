"""Mint a one-time Clerk sign-in ticket for browser automation."""
import os, sys, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]
H = {"Authorization": f"Bearer {SK}", "User-Agent": "gogo589-test/1.0", "Content-Type": "application/json"}
uid = sys.argv[1]
r = requests.post("https://api.clerk.com/v1/sign_in_tokens", headers=H, json={"user_id": uid, "expires_in_seconds": 3600})
r.raise_for_status()
print(r.json()["token"])
