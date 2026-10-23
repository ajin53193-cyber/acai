"""采集 315som.com 文章到「图文推广」（草稿）。

服务器上（自动读取 backend/.env 里的后台账号，无需输密码）：
  cd /www/wwwroot/heying && backend/.venv/bin/python backend/scripts/import_315som.py <url1> <url2> ...
手动指定站点/账号：
  API_BASE=https://你的域名 ADMIN_USERNAME=admin ADMIN_PASSWORD=xxx python3 backend/scripts/import_315som.py <url...>

文字段落 → text 块，正文图片下载后上传为站内图片 → image 块，首图作为封面。默认不发布，后台审核后再上线。"""
import os
import re
import sys
import html
from pathlib import Path

import requests

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
env = {}
if ENV_FILE.is_file():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

USER = os.environ.get("ADMIN_USERNAME") or env.get("ADMIN_USERNAME", "admin")
PWD = os.environ.get("ADMIN_PASSWORD") or env.get("ADMIN_PASSWORD", "")
URLS = [a for a in sys.argv[1:] if a.startswith("http")]
if not URLS:
    sys.exit("请在命令后面跟上要采集的文章链接")


def find_api_and_login():
    """优先用 API_BASE；否则在本机常用端口 + .env 的域名里逐个尝试登录。
    同一台服务器可能跑着别的 FastAPI 站点（/api/admin/login 返回 404），要跳过。"""
    candidates = [os.environ.get("API_BASE", "")]
    candidates += [f"http://127.0.0.1:{p}" for p in (8011, 8001, 8002, 8003, 8010, 8012)]
    candidates += [o.strip() for o in env.get("CORS_ORIGINS", "").split(",")]
    tried = []
    for base in [c.rstrip("/") for c in candidates if c]:
        try:
            r = requests.post(f"{base}/api/admin/login", json={"username": USER, "password": PWD}, timeout=8, allow_redirects=False)
        except requests.RequestException:
            continue
        if r.status_code == 404 or not r.headers.get("content-type", "").startswith("application/json"):
            tried.append(f"{base}（不是本站后端）")
            continue
        if r.ok:
            return base, r.json()
        sys.exit(f"登录 {base} 失败（{r.status_code}）：{r.text[:120]}\n请检查 backend/.env 里的 ADMIN_USERNAME / ADMIN_PASSWORD 是否与后台登录密码一致")
    sys.exit("找不到本站后端，请用 API_BASE=https://你的域名 指定。已尝试：" + "，".join(tried))


API, tok = find_api_and_login()
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
H = {"Authorization": f"Bearer {tok.get('token') or tok.get('access_token')}"}
print(f"已登录 {API}，开始采集 {len(URLS)} 篇 ...")


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
