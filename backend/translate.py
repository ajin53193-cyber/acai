import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from opencc import OpenCC

logger = logging.getLogger("translate")
CJK = re.compile(r"[\u4e00-\u9fff]")
_cc = OpenCC("tw2sp")
_cc_t = OpenCC("s2twp")

GLOSSARY = {
    "每月一單": "Monthly limit 1", "每日一單": "Daily limit 1", "新用戶專享": "New users only", "新用戶": "New user",
    "新客": "New customer", "特價": "Special price", "限時": "Limited time", "充值": "Top-up", "儲值": "Top-up",
    "直充": "Direct top-up", "點卡": "Gift card", "代充": "Agent top-up", "錢包": "Wallet", "優惠券": "Coupon",
}

SYSTEM = (
    "You are a professional e-commerce localization translator. Translate Traditional Chinese (Taiwan) into natural, concise English "
    "for a game/app top-up store website. Keep brand and product names recognizable (transliterate or keep common English names, e.g. 抖音→Douyin, 快手→Kuaishou, 王者榮耀→Honor of Kings, 原神→Genshin Impact). "
    "Preserve numbers, units, currency codes, HTML tags/attributes, line breaks, emoji, and placeholders like {0} {1} exactly. "
    "Never add explanations. Glossary: " + "; ".join(f"{k}→{v}" for k, v in GLOSSARY.items())
)


def to_simplified(s: str) -> str:
    return _cc.convert(s)


def to_traditional(s: str) -> str:
    return _cc_t.convert(s)


async def translate_batch(texts, context: str = "") -> dict:
    """Translate list of Traditional Chinese strings → {src: en}."""
    texts = [t for t in dict.fromkeys(texts) if t and CJK.search(t)]
    if not texts:
        return {}
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"tr-{datetime.now(timezone.utc).timestamp()}", system_message=SYSTEM).with_model("openai", "gpt-4.1-mini")
    prompt = (f"Context: {context}\n" if context else "") + \
        "Translate every string in the JSON array below to English. Reply ONLY with a JSON array of strings, same length and order, no markdown.\n" + \
        json.dumps(texts, ensure_ascii=False)
    raw = await chat.send_message(UserMessage(text=prompt))
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    out = json.loads(raw)
    if not isinstance(out, list) or len(out) != len(texts):
        raise ValueError(f"bad translation response len={len(out) if isinstance(out, list) else 'n/a'} expected={len(texts)}")
    return {s: str(e).strip() for s, e in zip(texts, out) if str(e).strip()}


class Translator:
    """In-memory EN cache backed by Mongo `translations`, with background translation of misses."""

    def __init__(self, db):
        self.db = db
        self.en: dict = {}
        self.pending: set = set()
        self._task = None

    async def load(self):
        async for d in self.db.translations.find({}, {"_id": 0, "src": 1, "en": 1}):
            self.en[d["src"]] = d["en"]
        logger.info("translations loaded: %d", len(self.en))

    def queue(self, s: str):
        if s in self.en or s in self.pending:
            return
        self.pending.add(s)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._worker())

    async def save_many(self, mapping: dict):
        if not mapping:
            return
        now = datetime.now(timezone.utc).isoformat()
        for src, en in mapping.items():
            self.en[src] = en
            await self.db.translations.update_one({"src": src}, {"$set": {"en": en, "updated_at": now}}, upsert=True)

    async def _worker(self):
        await asyncio.sleep(1)
        while self.pending:
            short = [s for s in self.pending if len(s) <= 400][:40]
            batch = short or [sorted(self.pending, key=len)[0]]
            for s in batch:
                self.pending.discard(s)
            try:
                await self.save_many(await translate_batch(batch))
            except Exception as e:
                logger.warning("background translate failed: %s", e)
                await asyncio.sleep(5)

    def localize(self, data, lang: str, allow_long: bool):
        if lang == "zh-CN":
            return self._walk(data, lambda s: to_simplified(s))
        if lang == "en":
            def f(s):
                en = self.en.get(s)
                if en is None:
                    if allow_long or len(s) <= 400:
                        self.queue(s)
                    return to_simplified(s)
                return en
            return self._walk(data, f)
        return data

    def _walk(self, v, f):
        if isinstance(v, str):
            return f(v) if CJK.search(v) else v
        if isinstance(v, list):
            return [self._walk(x, f) for x in v]
        if isinstance(v, dict):
            return {k: self._walk(x, f) for k, x in v.items()}
        return v
