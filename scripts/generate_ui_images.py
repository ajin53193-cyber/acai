import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

OUT_DIR = Path("/app/frontend/public/images/ui")
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE = (
    "Luxury 3D render, polished champagne gold metallic objects, deep midnight navy blue background color #0A1228, "
    "soft golden rim lighting and glow, floating gold particle sparkles, subtle glowing orbit rings, cinematic studio lighting, "
    "premium fintech wealth aesthetic, centered composition with generous dark empty space around the object, no text, no words, no letters, no watermark"
)

JOBS = [
    ("service-publish.png", f"A golden 3D rocket document hybrid launching upward from a glowing hexagonal gold podium, symbolizing project launch. {STYLE}"),
    ("service-link.png", f"Two interlocked golden 3D chain links connected by a glowing light beam, floating above a dark reflective surface, symbolizing resource matching. {STYLE}"),
    ("service-community.png", f"A circle of small abstract golden 3D human figures standing around a glowing golden hexagon on a dark podium, symbolizing community building. {STYLE}"),
    ("service-deal.png", f"A golden 3D handshake floating above a glowing circular gold podium with light rings, symbolizing successful business cooperation. {STYLE}"),
    ("adv-resources.png", f"Neatly stacked golden 3D cubes and gold bars forming a rising staircase on a dark reflective surface, symbolizing abundant project resources. {STYLE}"),
    ("adv-network.png", f"A glowing golden 3D hexagonal network sphere with connected nodes and light lines, floating in dark space, symbolizing a collaboration network. {STYLE}"),
    ("adv-service.png", f"A golden 3D customer service headset with a glowing gold ring around it on a dark podium, symbolizing dedicated concierge service. {STYLE}"),
    ("adv-match.png", f"A golden 3D target with a glowing arrow hitting the center, surrounded by thin golden orbit rings, symbolizing precise efficient matching. {STYLE}"),
    ("cta-banner.png", f"Ultra-wide panoramic abstract background, flowing elegant golden light waves and fine gold particle streams sweeping across a deep midnight navy blue #0A1228 background, gentle glowing curves, luxurious and calm, lots of dark empty space, no text, no objects"),
]


async def generate(name: str, prompt: str) -> bool:
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"ui-img-{name}",
            system_message="You are an expert 3D visual designer.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if images:
            data = base64.b64decode(images[0]["data"])
            (OUT_DIR / name).write_bytes(data)
            print(f"OK {name} ({len(data)//1024}KB)", flush=True)
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
