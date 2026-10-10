"""Transactional security emails via Emergent-managed Resend integration.

Self-contained module (no app imports) to keep the dependency graph acyclic.
"""
import os
import re
import ipaddress
import logging
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from typing import Optional

import httpx

logger = logging.getLogger("sifang.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "四方收款平台")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        raise RuntimeError("EMERGENT_EMAIL_KEY not configured")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    async with httpx.AsyncClient(timeout=30) as hc:
        resp = await hc.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                             headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    resp.raise_for_status()
    return resp.json().get("id")


SEC_EVENTS = {
    "enable": ("已开启两步验证", "您的账户刚刚成功开启了两步验证 (2FA)。今后登录需要输入验证器 App 的动态验证码。"),
    "disable": ("已关闭两步验证", "您的账户刚刚关闭了两步验证 (2FA)。账户将仅靠密码保护，如非本人操作请立即修改密码。"),
    "fail": ("两步验证失败提醒", "刚刚有一次登录在两步验证环节失败。如果不是您本人操作，请尽快修改密码并检查账户安全。"),
    "login_new_device": ("检测到新设备 / 新 IP 登录", "您的账户刚刚从一个新的 IP 地址成功登录。如果是您本人可忽略此邮件；若非本人操作，请立即修改密码并开启两步验证。"),
}


async def notify_security(user: dict, event: str, ip: Optional[str] = None):
    try:
        if not EMAIL_KEY or not user.get("email") or event not in SEC_EVENTS:
            return
        title, body = SEC_EVENTS[event]
        when = _now_utc().strftime("%Y-%m-%d %H:%M UTC")
        link = os.environ.get("FRONTEND_URL", "").rstrip("/") + "/security"
        safe_name = escape(user.get("name") or user.get("email"))
        html = (
            '<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif">'
            '<tr><td style="padding:24px;background:#0B1120;color:#e2e8f0;border-radius:12px">'
            '<h2 style="margin:0 0 8px;color:#22d3ee">四方收款平台 · 安全提醒</h2>'
            f'<p style="margin:0 0 4px;font-weight:bold">{escape(title)}</p>'
            f'<p style="margin:12px 0;color:#cbd5e1">您好 {safe_name}，{escape(body)}</p>'
            f'<p style="margin:12px 0;font-size:13px;color:#94a3b8">时间：{when}'
            + (f'<br>来源 IP：{escape(str(ip))}' if ip else '') + '</p>'
            + (f'<p style="margin:16px 0"><a href="{link}" style="color:#22d3ee">前往安全设置</a></p>' if link.startswith("https://") else '')
            + '<p style="font-size:12px;color:#64748b;margin-top:16px">本邮件由四方收款平台自动发送。我们绝不会通过邮件向您索要密码或验证码。</p>'
            '</td></tr></table>'
        )
        await send_email(to=user["email"], subject=f"【四方收款平台】{title}", html=html)
    except httpx.HTTPStatusError as e:
        lvl = logging.DEBUG if e.response.status_code == 429 else logging.WARNING
        logger.log(lvl, f"security email skipped ({event}): HTTP {e.response.status_code}")
    except Exception as e:
        logger.warning(f"security email failed ({event}): {e}")
