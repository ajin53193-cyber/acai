from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "public")
NAVY = (11, 18, 32, 255)
CYAN = (34, 211, 238, 255)

def draw_icon(px):
    S = px * 4  # supersample
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=NAVY)
    cx = S / 2
    # shield
    top = S * 0.15
    w = S * 0.31
    shoulder = S * 0.30
    bottom = S * 0.87
    pts = [
        (cx, top),
        (cx + w, top + S * 0.11),
        (cx + w, shoulder + S * 0.18),
        (cx, bottom),
        (cx - w, shoulder + S * 0.18),
        (cx - w, top + S * 0.11),
    ]
    d.polygon(pts, fill=CYAN)
    # Tether ₮ symbol drawn as rects (navy on cyan)
    bar_t = max(2, int(S * 0.055))          # bar thickness
    top_bar_w = S * 0.34
    top_y = S * 0.33
    d.rounded_rectangle([cx - top_bar_w / 2, top_y, cx + top_bar_w / 2, top_y + bar_t],
                        radius=bar_t / 2, fill=NAVY)
    # vertical stem
    stem_bottom = S * 0.66
    d.rounded_rectangle([cx - bar_t / 2, top_y, cx + bar_t / 2, stem_bottom],
                        radius=bar_t / 2, fill=NAVY)
    # mid bar (strikethrough) -> gives ₮ look
    mid_w = S * 0.20
    mid_y = top_y + S * 0.085
    d.rounded_rectangle([cx - mid_w / 2, mid_y, cx + mid_w / 2, mid_y + bar_t],
                        radius=bar_t / 2, fill=NAVY)
    return img.resize((px, px), Image.LANCZOS)

for size, name in [(16, "favicon-16x16.png"), (32, "favicon-32x32.png"),
                   (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    draw_icon(size).save(os.path.join(OUT, name))

draw_icon(64).save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("ok")
