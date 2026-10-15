"""One-off: generate the mobile 'add to home screen' popup poster via Fal (Universal Key). Run: python scripts/gen_a2hs_poster.py"""
import os, sys, time, requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
KEY = os.environ["EMERGENT_LLM_KEY"]
# Fal Universal Key supports queue inference through Emergent proxy, not Platform APIs.
BASE = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
H = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

PROMPT = (
    "Vertical 3:4 mobile app promo poster illustration, cute premium 3D render style, soft warm orange and cream palette "
    "(#F0872E, #FFB45C, #FFF4EA), glossy pastel. Center: a modern smartphone standing upright showing a home screen, with a "
    "glowing rounded orange app icon being placed onto it, a hand finger tapping, sparkles and small floating gift boxes, "
    "coupon tickets and coins around, soft studio lighting, clean background with light dotted pattern, lots of empty space "
    "in the TOP 30% of the image for a headline, and empty space at the BOTTOM 15% for a button. No text, no letters, no logos, no watermark."
)

def main(out="/app/frontend/public/banners/a2hs-popup.png"):
    r = requests.post(f"{BASE}/proxy", headers={**H, "X-Fal-Target-Url": "https://queue.fal.run/fal-ai/nano-banana-pro"},
                      json={"prompt": PROMPT, "aspect_ratio": "3:4", "resolution": "1K", "output_format": "png", "num_images": 1}, timeout=60)
    if r.status_code == 402:
        sys.exit("Insufficient Universal Key credits")
    r.raise_for_status()
    sub = r.json()
    deadline = time.time() + 600
    while time.time() < deadline:
        st = requests.get(sub["status_url"], headers=H, timeout=30).json()
        s = (st.get("status") or "").upper()
        if s in ("COMPLETED", "OK"):
            res = requests.get(sub["response_url"], headers=H, timeout=60).json()
            url = res["images"][0]["url"]
            img = requests.get(url, timeout=120).content
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, "wb").write(img)
            print("saved", out, len(img))
            return
        if s in ("FAILED", "CANCELLED", "CANCELED", "ERROR"):
            sys.exit(f"failed: {st}")
        time.sleep(3)
    sys.exit("timeout")

if __name__ == "__main__":
    main(*sys.argv[1:])
