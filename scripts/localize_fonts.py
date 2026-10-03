#!/usr/bin/env python3
"""Self-host Google Fonts: download css2 + woff2 splits, rewrite URLs to local."""
import re
import os
import hashlib
import requests

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}
CSS_URL = "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=Noto+Serif+SC:wght@600;700;900&display=swap"
OUT_DIR = "/app/frontend/public/fonts"
os.makedirs(OUT_DIR, exist_ok=True)

css = requests.get(CSS_URL, headers=UA, timeout=30).text
urls = sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css)))
print(f"font files to download: {len(urls)}")

mapping = {}
for i, u in enumerate(urls):
    name = u.split("/")[-1]
    local = f"{i:03d}-{name}"
    dest = os.path.join(OUT_DIR, local)
    if not os.path.exists(dest):
        r = requests.get(u, headers=UA, timeout=30)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
    mapping[u] = f"/fonts/{local}"
    if i % 25 == 0:
        print(f"  {i}/{len(urls)}")

for u, local in mapping.items():
    css = css.replace(u, local)

with open(os.path.join(OUT_DIR, "fonts.css"), "w") as f:
    f.write(css)

total = sum(os.path.getsize(os.path.join(OUT_DIR, x)) for x in os.listdir(OUT_DIR))
print(f"done. total size: {total/1024/1024:.1f}MB, files: {len(os.listdir(OUT_DIR))}")
