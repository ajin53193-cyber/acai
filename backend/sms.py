import logging
import os

import httpx

logger = logging.getLogger("sms")
XSEND_URL = "https://api-v4.mysubmail.com/internationalsms/xsend.json"


def sms_supported(phone: str) -> bool:
    return phone.startswith("+") and not phone.startswith("+86")


async def send_sms_code(phone: str, code: str, minutes: int = 10):
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
