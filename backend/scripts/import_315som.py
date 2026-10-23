"""采集 315som.com 文章到「图文推广」（草稿），用法：
  cd /app/backend && python3 scripts/import_315som.py <API_BASE> <admin_user> <admin_pwd> <url1> <url2> ...
文字段落 → text 块，正文图片下载后上传为站内图片 → image 块，首图作为封面。默认不发布，后台审核后再上线。"""
import re
import sys
import html
import json
import requests

API, USER, PWD, *URLS = sys.argv[1:]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
tok = requests.post(f"{API}/api/admin/login", json={"username": USER, "password": PWD}, timeout=20).json()
H = {"Authorization": f"Bearer {tok.get('token') or tok.get('access_token')}"}


def upload(img_url: str) -> str:
    r = requests.get(img_url, headers={**UA, "Referer": "https://www.315som.com/"}, timeout=30)
    r.raise_for_status()
    name = img_url.rsplit("/", 1)[-1].split("?")[0] or "img.jpg"
    up = requests.post(f"{API}/api/admin/upload", headers=H, files={"file": (name, r.content, r.headers.get("Content-Type", "image/jpeg"))}, timeout=60)
    up.raise_for_status()
    return up.json()["url"]


for url in URLS:
    page = requests.get(url, headers=UA, timeout=30).text
    title = html.unescape(re.search(r'<h1 class="article-title">\s*<a[^>]*>(.*?)</a>', page, re.S).group(1)).strip()
    start = page.index('wp-posts-content">')
    body = page[start:page.index('</div>', start)]
    blocks, cover = [], ""
    for m in re.finditer(r"<p[^>]*>(.*?)</p>", body, re.S):
        inner = m.group(1)
        img = re.search(r'data-full-url="([^"]+)"', inner) or re.search(r'data-src="([^"]+)"', inner)
        if img:
            src = img.group(1)
            try:
                local = upload(src)
            except Exception as e:  # noqa: BLE001
                print("  图片跳过:", src, e)
                continue
            cover = cover or local
            blocks.append({"type": "image", "image": local, "text": ""})
            continue
        text = html.unescape(re.sub(r"<[^>]+>", "", inner)).replace("\xa0", " ").strip()
        if text:
            blocks.append({"type": "text", "text": text})
    doc = {"title": title[:120], "subtitle": "", "cover": cover, "blocks": blocks, "tool_slugs": [], "published": False}
    r = requests.post(f"{API}/api/admin/promos", headers=H, json=doc, timeout=30)
    print(("OK " if r.ok else f"FAIL {r.status_code} ") + title, "| 段落", sum(b["type"] == "text" for b in blocks), "图片", sum(b["type"] == "image" for b in blocks), (r.json().get("slug") if r.ok else r.text[:200]))
