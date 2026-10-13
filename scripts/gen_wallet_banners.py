import asyncio, os, base64, sys
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv("/app/backend/.env")
OUT = "/app/frontend/public/banners"
os.makedirs(OUT, exist_ok=True)

with open("/tmp/promo1.png", "rb") as f:
    REF = base64.b64encode(f.read()).decode()

STYLE = ("Match this reference banner's exact art style: wide 650x220 promotional banner, bright orange-to-peach gradient background, soft 3D cute "
         "cartoon illustration, glossy rounded elements, subtle sparkles, flat white rounded card with bold orange text. No brand names, no logos. "
         "Traditional Chinese text must be perfectly legible and spelled exactly as given. Leave clean margins. Output exactly 650x220 landscape.")

BANNERS = {
    "topup": "Headline big bold Traditional Chinese text「錢包充值」on the left, smaller sub text「多種支付方式 · 即時入帳」below it, "
             "and a white pill button reading「立即充值」. On the right, a cute 3D orange wallet overflowing with gold coins and a floating glowing plus sign.",
    "transactions": "Headline big bold Traditional Chinese text「交易紀錄」on the left, smaller sub text「充值 · 付款 · 明細一目了然」below it, "
                    "and a white pill button reading「查看明細」. On the right, a cute 3D paper receipt with list lines, a small magnifying glass and a few gold coins.",
}


async def gen(name, prompt):
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"banner-{name}", system_message="You are a banner designer.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=f"{STYLE}\n\n{prompt}", file_contents=[ImageContent(REF)]))
    if not images:
        print(name, "NO IMAGE", (text or "")[:200]); return
    with open(f"{OUT}/wallet-{name}.png", "wb") as f:
        f.write(base64.b64decode(images[0]["data"]))
    print(name, "saved", images[0]["mime_type"])


async def main():
    names = sys.argv[1:] or list(BANNERS)
    await asyncio.gather(*(gen(n, BANNERS[n]) for n in names))

asyncio.run(main())
