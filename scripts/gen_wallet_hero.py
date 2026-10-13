import asyncio, os, base64
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")
OUT = "/app/frontend/public/banners/wallet-hero.png"

PROMPT = ("A cute glossy 3D cartoon illustration of an orange leather wallet, slightly open, with shiny gold coins and a few small banknotes "
          "spilling out, one coin floating above with a sparkle, soft studio lighting, warm orange and gold palette, isolated on a plain solid "
          "flat orange background color #F39A3E with no gradient, no text, no shadows on the background, centered, square 1024x1024.")


async def main():
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id="wallet-hero", system_message="You are a 3D icon illustrator.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    if not images:
        print("NO IMAGE", (text or "")[:200]); return
    with open(OUT, "wb") as f:
        f.write(base64.b64decode(images[0]["data"]))
    print("saved", images[0]["mime_type"])

asyncio.run(main())
