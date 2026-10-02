import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

OUT_DIR = Path("/app/frontend/public/images/projects")
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE = (
    "Luxury 3D render, polished champagne gold metallic objects, deep midnight navy blue background color #0A1228, "
    "soft golden rim lighting and glow, floating gold particle sparkles, cinematic studio lighting, premium fintech wealth aesthetic, "
    "centered composition with generous dark empty space, no text, no words, no letters, no watermark"
)

JOBS = [
    ("project-1.png", f"A miniature golden 3D solar panel array on a glowing dark platform with a small golden sun above, symbolizing a community photovoltaic power station. {STYLE}"),
    ("project-2.png", f"A golden 3D AI microchip with a glowing brain hologram and circuit light lines floating above it, symbolizing an AI data platform. {STYLE}"),
    ("project-3.png", f"A golden 3D shopping basket filled with small golden parcels and fresh product boxes on a dark podium, symbolizing community group buying retail. {STYLE}"),
    ("project-4.png", f"A golden 3D wheat sprout growing from a hexagonal golden planter with glowing soil particles, symbolizing ecological agriculture. {STYLE}"),
    ("project-5.png", f"A golden 3D electric vehicle charging station with a glowing lightning bolt symbol, on a dark podium with orbit rings, symbolizing EV charging network. {STYLE}"),
    ("project-6.png", f"A golden 3D globe with a small golden cargo plane flying around it on a glowing orbit path with parcel boxes, symbolizing cross-border e-commerce. {STYLE}"),
    ("project-7.png", f"A golden 3D security camera with a glowing lens eye and shield, floating above a dark podium, symbolizing AI smart security systems. {STYLE}"),
    ("project-8.png", f"A golden 3D heart with a glowing pulse line running through it and a small medical cross, on a dark podium, symbolizing community health care chain. {STYLE}"),
    ("project-9.png", f"A golden 3D refrigerated delivery truck with a glowing snowflake symbol and cool light trail, on a dark podium, symbolizing cold chain logistics. {STYLE}"),
    ("news-1.png", f"A golden 3D megaphone next to a glowing golden policy document scroll on a dark podium, symbolizing industry policy news. {STYLE}"),
    ("news-2.png", f"A golden 3D rising bar chart with an upward glowing arrow and floating coins, symbolizing market trend analysis. {STYLE}"),
    ("news-3.png", f"A golden 3D trophy on a glowing podium with celebration light rays and particles, symbolizing platform milestone achievement. {STYLE}"),
]


async def generate(name: str, prompt: str) -> bool:
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"proj-img-{name}",
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
