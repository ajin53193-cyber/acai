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
    "soft golden rim lighting and glow, floating gold particle sparkles, cinematic studio lighting, premium fintech wealth aesthetic, "
    "centered composition with generous dark empty space, no text, no words, no letters, no watermark"
)

JOBS = [
    ("about-intro.png", f"A golden 3D city skyline miniature with a glowing hexagonal landmark building at the center, on a dark reflective platform, symbolizing a thriving business platform. {STYLE}"),
    ("value-open.png", f"A golden 3D open gate door with bright warm light rays streaming out, on a dark podium, symbolizing openness and opportunity. {STYLE}"),
    ("value-trust.png", f"A golden 3D shield with a glowing check mark emblem at its center, floating above a dark podium with orbit rings, symbolizing trust and credibility. {STYLE}"),
    ("value-win.png", f"Two golden 3D gears interlocked and glowing, with a small golden laurel wreath, on a dark podium, symbolizing win-win cooperation. {STYLE}"),
]


async def generate(name: str, prompt: str) -> bool:
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"about-img-{name}",
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
