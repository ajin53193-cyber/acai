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


async def _send_mxt(phone: str, content: str):
    """Mainland China (+86) via 麦讯通 HttpSendSM (text response: 'ts,status\\nmsgid', status 0 = ok)."""
    data = {"account": os.environ["MXT_ACCOUNT"], "pswd": os.environ["MXT_PSWD"], "mobile": phone[3:], "msg": content, "needstatus": "true"}
    url = os.environ.get("MXT_GATEWAY", "https://www.weiwebs.cn").rstrip("/") + "/msg/HttpSendSM"
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
    text = (r.text or "").strip()
    first = text.splitlines()[0] if text else ""
    status = first.split(",")[-1].strip() if "," in first else first
    if status != "0":
        logger.error("mxt sms failed: %s", text)
        raise RuntimeError(f"sms failed ({status or 'no response'})")
    return {"status": "success", "raw": text}


def _mainland_gateway() -> str:
    return "mxt" if os.environ.get("MXT_ACCOUNT") else "dagou"


def _mxt_sign() -> str:
    return os.environ.get("MXT_SIGN", "").strip() or "【澄迈瑜庆】"



async def send_sms_text(phone: str, content: str):
    """Free-form notification SMS: +86 via 麦讯通 (if configured), others via SUBMAIL send.json."""
    if phone.startswith("+86"):
        if _mainland_gateway() != "mxt":
            raise RuntimeError("中國大陸號碼暫不支援通知簡訊")
        return await _send_mxt(phone, f"{_mxt_sign()}{content}")
    data = {"appid": os.environ["SUBMAIL_APPID"], "to": phone, "content": content, "signature": os.environ["SUBMAIL_APPKEY"]}
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post("https://api-v4.mysubmail.com/internationalsms/send.json", data=data)
    res = r.json()
    if res.get("status") != "success":
        logger.error("submail send failed: %s", res)
        raise RuntimeError(res.get("msg") or "sms failed")
    return res


async def send_sms_code(phone: str, code: str, minutes: int = 10):
    if phone.startswith("+86"):
        if _mainland_gateway() == "mxt":
            # 已報備模板：【澄迈瑜庆】您的验证码是：137336，五分钟内有效！
            return await _send_mxt(phone, f"{_mxt_sign()}您的验证码是：{code}，五分钟内有效！")
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
