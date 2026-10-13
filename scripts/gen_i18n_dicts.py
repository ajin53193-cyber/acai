"""Generate frontend dictionaries: zh-CN via OpenCC, en via LLM (Emergent key). Usage: python3 gen_i18n_dicts.py [en|cn|all]"""
import asyncio, json, os, re, sys
from dotenv import load_dotenv
from opencc import OpenCC

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
from translate import translate_batch  # noqa: E402

KEYS = json.load(open("/app/scripts/i18n_keys.json"))
OUT = "/app/frontend/src/i18n"
cc = OpenCC("tw2sp")


def gen_cn():
    d = {k: cc.convert(k) for k in KEYS}
    json.dump(d, open(f"{OUT}/zh-CN.json", "w"), ensure_ascii=False, indent=1)
    print("zh-CN", len(d))


async def gen_en():
    path = f"{OUT}/en.json"
    d = json.load(open(path)) if os.path.exists(path) else {}
    todo = [k for k in KEYS if k not in d]
    print("en todo", len(todo))
    sem = asyncio.Semaphore(6)

    async def run(batch):
        async with sem:
            try:
                res = await translate_batch(batch, context="UI labels/buttons/messages of a game top-up e-commerce website. Keep {0},{1} placeholders exactly. Be concise like real website UI copy.")
                d.update(res)
            except Exception as e:
                print("batch failed", e)

    await asyncio.gather(*[run(todo[i:i + 40]) for i in range(0, len(todo), 40)])
    json.dump(d, open(path, "w"), ensure_ascii=False, indent=1)
    print("en", len(d), "missing", len([k for k in KEYS if k not in d]))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in ("cn", "all"):
        gen_cn()
    if mode in ("en", "all"):
        asyncio.run(gen_en())
