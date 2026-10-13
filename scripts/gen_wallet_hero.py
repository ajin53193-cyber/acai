import asyncio, os, base64
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")
import sys
OUT = sys.argv[1]

PROMPTS = {
 "topup": "A cute glossy 3D cartoon illustration of an orange leather wallet, slightly open, with shiny gold coins and a few small banknotes "
          "spilling out, one coin floating above with a sparkle, soft studio lighting, warm orange and gold palette, isolated on a plain solid "
          "flat orange background color #F39A3E with no gradient, no text, no shadows on the background, centered, square 1024x1024.",
 "badge": "A flat vector-style illustration of a gold award rosette medal badge with a scalloped circular edge, concentric gold rings in the center, and two dark navy ribbon tails hanging below, clean minimal design, soft shading, isolated on a plain solid flat light peach background color #FFF1E3, no gradient background, no text, no shadows on the background, centered, square 1024x1024.",
 "topup2": "A cute glossy 3D cartoon illustration of a smiling orange wallet with gold coins popping out and a glowing plus sign above it, soft studio lighting, warm orange and gold palette, isolated on a plain solid flat light peach background color #FFF1E3, no gradient, no text, no background shadows, centered, square 1024x1024.",
 "transactions": "A cute glossy 3D cartoon illustration of a white paper receipt with orange list lines, a small magnifying glass leaning on it, and a few gold coins at the base, soft studio lighting, warm orange and gold palette, isolated on a plain solid flat light peach background color #FFF1E3, no gradient, no text, no background shadows, centered, square 1024x1024.",
}
PROMPT = PROMPTS[sys.argv[2]]


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
