import hashlib
import logging
import os

import httpx

logger = logging.getLogger("sms")
XSEND_URL = "https://api-v4.mysubmail.com/internationalsms/xsend.json"


def sms_supported(phone: str) -> bool:
    return phone.startswith("+")


def _dagou_sign(params: dict, key: str) -> str:
    s = "&".join(f"{k}={v}" for k, v in sorted(params.items()) if k not in ("sign", "sign_type") and v not in (None, ""))
    return hashlib.md5(f"{s}&key={key}".encode()).hexdigest().upper()


async def _send_dagou(phone: str, code: str):
    """Mainland China (+86) via 大狗短信."""
    params = {"code": code, "to": phone[3:], "uname": os.environ["DAGOU_UNAME"], "area_code": "86"}
    params["sign"] = _dagou_sign(params, os.environ["DAGOU_KEY"])
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(f"{os.environ['DAGOU_GATEWAY'].rstrip('/')}/api/sms", data=params,
                         headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
    res = r.json()
    if str(res.get("status")) != "1":
        logger.error("dagou sms failed: %s", res)
        raise RuntimeError(res.get("msg") or "sms failed")
    return res


async def send_sms_code(phone: str, code: str, minutes: int = 10):
    if phone.startswith("+86"):
        return await _send_dagou(phone, code)
    data = {
        "appid": os.environ["SUBMAIL_APPID"],
        "to": phone,
        "project": os.environ["SUBMAIL_PROJECT"],
        "vars": f'{{"code":"{code}","time":"{minutes} minutes"}}',
        "signature": os.environ["SUBMAIL_APPKEY"],
    }
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(XSEND_URL, data=data)
    res = r.json()
    if res.get("status") != "success":
        logger.error("submail xsend failed: %s", res)
        raise RuntimeError(res.get("msg") or "sms failed")
    return res
