import asyncio
import base64
import io
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

OUT_DIR = Path("/app/frontend/public/images/logo-concepts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE = (
    "Luxury brand logo emblem, polished champagne gold metallic material, deep midnight navy blue solid background color #060B18, "
    "soft golden rim lighting, subtle gold particle sparkles, cinematic studio lighting, premium fintech wealth aesthetic, "
    "perfectly centered composition, generous dark empty space around the emblem, crisp edges, vector-like clean silhouette, "
    "no text, no words, no letters, no watermark, square format"
)

JOBS = [
    ("logo-1.png", f"A hexagonal golden badge emblem with a 3D geometric abstract symbol inside formed by a roof-shaped chevron on top and a rectangular base below, inspired by the Chinese character '合' meaning unity, gold gradient metal with glowing edges. {STYLE}"),
    ("logo-2.png", f"A circular golden emblem with two interlocking abstract ribbon shapes forming a unity knot in the center, resembling two hands joining, surrounded by a thin glowing orbit ring, luxurious minimal mark. {STYLE}"),
    ("logo-3.png", f"A 3D golden ingot-shaped seal stamp emblem with an embossed abstract geometric mark combining a triangle roof and a square mouth shape, oriental luxury minimalism, floating above a subtle golden reflection. {STYLE}"),
    ("logo-4.png", f"A shield-hexagon hybrid golden emblem with a radiant star-diamond core in the center and fine gold line rays, symmetric, ultra premium wealth-club insignia, flat icon style with subtle 3D depth. {STYLE}"),
]


async def generate(name: str, prompt: str) -> bool:
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"logo-{name}",
            system_message="You are a world-class luxury brand logo designer.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if images:
            data = base64.b64decode(images[0]["data"])
            img = Image.open(io.BytesIO(data)).convert("RGB")
            img.save(OUT_DIR / name.replace(".png", ".webp"), "WEBP", quality=90)
            print(f"OK {name} {img.size}", flush=True)
            return True
        print(f"EMPTY {name}: {text[:80]}", flush=True)
    except Exception as e:
        print(f"FAIL {name}: {str(e)[:120]}", flush=True)
    return False


async def main():
    for name, prompt in JOBS:
        ok = await generate(name, prompt)
        if not ok:
            await asyncio.sleep(5)
            await generate(name, prompt)
    print("ALL DONE", flush=True)


asyncio.run(main())
