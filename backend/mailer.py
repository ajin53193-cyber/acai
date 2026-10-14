import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger("mailer")

PURPOSE_TITLES = {
    "login": "登录验证码",
    "register": "注册验证码",
    "reset": "重置密码验证码",
    "change_password": "修改密码验证码",
    "bind_email": "绑定邮箱验证码",
}


def _send_sync(to: str, subject: str, html: str, text: str):
    host = os.environ["SMTP_HOST"]
    port = int(os.environ["SMTP_PORT"])
    msg = EmailMessage()
    msg["From"] = formataddr((os.environ.get("MAIL_FROM_NAME", "GOGO589"), os.environ["MAIL_FROM"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(host, port, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        s.send_message(msg)


async def send_mail(to: str, subject: str, html: str, text: str):
    await asyncio.to_thread(_send_sync, to, subject, html, text)


def otp_email(code: str, purpose: str, minutes: int = 10) -> tuple:
    title = PURPOSE_TITLES.get(purpose, "验证码")
    subject = f"【GOGO589】{title}：{code}"
    text = f"您的 GOGO589 {title}为 {code}，{minutes} 分钟内有效。如非本人操作，请忽略此邮件。"
    html = f"""<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px rgba(249,115,22,.10);">
<tr><td style="background:#f97316;padding:22px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:.5px;">gogo589</td></tr>
<tr><td style="padding:28px 28px 8px;color:#0f172a;font-size:18px;font-weight:700;">{title}</td></tr>
<tr><td style="padding:0 28px;color:#475569;font-size:14px;line-height:1.7;">您好，您正在进行「{title.replace('验证码','')}」操作，请在页面中输入以下验证码：</td></tr>
<tr><td style="padding:22px 28px;"><div style="display:inline-block;background:#fff7ed;border:2px dashed #fdba74;border-radius:14px;padding:14px 28px;font-size:34px;font-weight:800;letter-spacing:10px;color:#ea580c;">{code}</div></td></tr>
<tr><td style="padding:0 28px 8px;color:#64748b;font-size:13px;line-height:1.7;">验证码 <b>{minutes} 分钟</b>内有效，请勿泄露给他人。若非本人操作，请忽略此邮件。</td></tr>
<tr><td style="padding:22px 28px 28px;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;">此邮件由系统自动发送，请勿直接回复。<br>GOGO589 跨境充值商城 · www.gogo589.com</td></tr>
</table></td></tr></table></body></html>"""
    return subject, html, text
