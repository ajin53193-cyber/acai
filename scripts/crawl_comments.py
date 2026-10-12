import json, os, time, asyncio, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from opencc import OpenCC
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
OUT = "/app/scripts/kavip_comments.json"
H = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Accept": "application/json", "languageid": "9", "currency": "USD",
     "clientid": "2615", "siteid": "2615", "Referer": "https://www.kavip.com/zh-tw", "firstreferer": "https://www.kavip.com"}
API = "https://www.kavip.com/pro-api/openapi/product-comment/list"
import threading
_tl = threading.local()
def sess():
    if not hasattr(_tl, "s"):
        _tl.s = requests.Session()
    return _tl.s
t2s, s2tw = OpenCC("t2s"), OpenCC("s2twp")

ZH_TW = {"TW", "HK", "MO", "MY", "SG", None, ""}
ZH_CN = {"CN"}
DOMAINS_BY_LANG = {"zh-CN": ["qq.com", "163.com", "126.com", "gmail.com"], "zh-TW": ["gmail.com", "yahoo.com.tw", "hotmail.com", "outlook.com", "icloud.com"],
                   "en": ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"]}


def lang_for(country):
    if country in ZH_CN:
        return "zh-CN"
    if country in ZH_TW:
        return "zh-TW"
    return "en"


def masked_email(account, lang, uid):
    acc = (account or "user").replace("*", "")
    first, last = (acc[0] if acc else "u"), (acc[-1] if len(acc) > 1 else "x")
    doms = DOMAINS_BY_LANG[lang]
    dom = doms[int(hashlib.md5(str(uid).encode()).hexdigest(), 16) % len(doms)]
    return f"{first}****{last}@{dom}"


def fetch(pid):
    for i in range(3):
        try:
            r = sess().post(API, headers=H, json={"productId": int(pid), "pager": {"pageNum": 1, "pageSize": 200}}, timeout=(5, 15))
            d = r.json()["data"] or {}
            dl = d.get("dataList") or {}
            rows = dl.get("rows") or []
            total = dl.get("total") or 0
            page = 2
            while len(rows) < total and page < 10:
                r = sess().post(API, headers=H, json={"productId": int(pid), "pager": {"pageNum": page, "pageSize": 200}}, timeout=15)
                new = r.json()["data"]["dataList"]["rows"]
                if not new:
                    break
                rows += new
                page += 1
            return pid, {"count": d.get("count"), "score": d.get("score"), "rows": rows}
        except Exception:
            time.sleep(1 + i)
    return pid, None


async def translate_en(texts):
    """Translate list of Chinese texts to natural English via Emergent LLM."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    out = {}
    key = os.environ["EMERGENT_LLM_KEY"]
    batch = 40
    for i in range(0, len(texts), batch):
        chunk = texts[i:i + batch]
        chat = LlmChat(api_key=key, session_id=f"tr-{i}", system_message="You translate short e-commerce customer reviews from Chinese to natural, casual English. Reply ONLY with a JSON object mapping each input index (string) to the English translation. Keep emojis and punctuation style.").with_model("openai", "gpt-5.4-mini")
        payload = json.dumps({str(j): t for j, t in enumerate(chunk)}, ensure_ascii=False)
        for attempt in range(3):
            try:
                resp = await chat.send_message(UserMessage(text=payload))
                txt = resp.strip()
                txt = txt[txt.find("{"): txt.rfind("}") + 1]
                m = json.loads(txt)
                for j, t in enumerate(chunk):
                    out[t] = m.get(str(j), t)
                break
            except Exception as e:
                print("translate retry", attempt, str(e)[:100], flush=True)
                time.sleep(2)
        print("translated", min(i + batch, len(texts)), "/", len(texts), flush=True)
    return out


def main():
    data = json.load(open("/app/scripts/kavip_data.json"))
    pids = list(data["products"].keys())
    state = json.load(open(OUT)) if os.path.exists(OUT) else {}
    todo = [p for p in pids if state.get(p) is None]
    print("products", len(pids), "todo", len(todo), flush=True)
    with ThreadPoolExecutor(max_workers=6) as ex:
        for n, f in enumerate(as_completed([ex.submit(fetch, p) for p in todo]), 1):
            pid, res = f.result()
            state[pid] = res
            if n % 200 == 0:
                json.dump(state, open(OUT, "w"), ensure_ascii=False)
                print("progress", n, flush=True)
    json.dump(state, open(OUT, "w"), ensure_ascii=False)
    all_rows = [r for v in state.values() if v for r in v["rows"]]
    print("comments total", len(all_rows), "with text", sum(1 for r in all_rows if (r.get("commentText") or "").strip()), flush=True)

    # translation for English-region reviews
    en_texts = sorted({r["commentText"].strip() for r in all_rows if (r.get("commentText") or "").strip() and lang_for(r.get("commentCountry")) == "en"})
    print("to translate", len(en_texts), flush=True)
    cache_path = "/app/scripts/kavip_translations.json"
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    missing = [t for t in en_texts if t not in cache]
    if missing:
        cache.update(asyncio.run(translate_en(missing)))
        json.dump(cache, open(cache_path, "w"), ensure_ascii=False)

    reviews = []
    for pid, v in state.items():
        if not v:
            continue
        for r in v["rows"]:
            country = r.get("commentCountry")
            lang = lang_for(country)
            text = (r.get("commentText") or "").strip()
            if text:
                text = t2s.convert(text) if lang == "zh-CN" else cache.get(text, text) if lang == "en" else s2tw.convert(text)
            reply = (r.get("replyText") or "").strip()
            reviews.append({
                "id": f"kv-{r['id']}", "product_id": str(pid), "author": masked_email(r.get("userAccount"), lang, r.get("userId")),
                "rating": int(r.get("commentScore") or 5), "content": text, "reply": s2tw.convert(reply) if reply else "",
                "country": country or "", "area": r.get("commentArea") or "", "lang": lang, "buy_count": r.get("buyCount") or 1,
                "created_at": (r.get("commentTime") or "2026-01-01 00:00:00").replace(" ", "T") + "+08:00", "images": [], "visible": True,
            })
    json.dump(reviews, open("/app/scripts/kavip_reviews_final.json", "w"), ensure_ascii=False)
    print("final reviews", len(reviews), flush=True)


if __name__ == "__main__":
    main()
