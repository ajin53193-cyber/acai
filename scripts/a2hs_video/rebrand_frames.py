import cv2, numpy as np, sys
from PIL import Image, ImageDraw, ImageFont

FR = "/app/scripts/a2hs_video"
LOGO = Image.open("/app/frontend/public/gogo589-logo.png").convert("RGBA")
ICON = Image.open("/app/frontend/public/icons/apple-touch-icon.png").convert("RGBA")
FONT_R = "/usr/share/fonts/truetype/freefont/FreeSans.ttf"
FONT_B = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"


def tight(img, box, pred):
    x0, y0, x1, y1 = box
    reg = np.array(img.crop(box).convert("RGB")).astype(int)
    m = pred(reg)
    ys, xs = np.where(m)
    if len(xs) == 0:
        return box
    return (x0 + xs.min() - 2, y0 + ys.min() - 2, x0 + xs.max() + 3, y0 + ys.max() + 3)


is_orange = lambda r: (r[..., 0] > 200) & (r[..., 1] > 90) & (r[..., 1] < 190) & (r[..., 2] < 110)
is_dark = lambda r: (r.sum(axis=2) < 450)

base = {n: {t: Image.open(f"{FR}/f_{n}_{t}.png").convert("RGB") for t in ["1.5", "4.5", "7.5", "10.5"]} for n in ["ios", "android"]}
s1 = base["ios"]["1.5"]; s2 = base["ios"]["4.5"]; s4 = base["ios"]["10.5"]
T_LOGO = s1.crop(tight(s1, (264, 750, 460, 840), is_orange))
T_URL = s1.crop(tight(s1, (400, 2125, 680, 2180), is_dark))
T_ICON = s4.crop((165, 1245, 360, 1455))
T_ICON = s4.crop(tight(s4, (165, 1245, 360, 1455), is_orange))
T_BOLD = s2.crop(tight(s2, (320, 740, 440, 790), is_dark))
for k, t in [("logo", T_LOGO), ("url", T_URL), ("icon", T_ICON), ("bold", T_BOLD)]:
    t.save(f"{FR}/tpl_{k}.png"); print(k, t.size)


def find(img, tpl, scales, thr, min_h=8):
    g = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
    tg = cv2.cvtColor(np.array(tpl), cv2.COLOR_RGB2GRAY)
    found = []
    for s in scales:
        w, h = int(tpl.width * s), int(tpl.height * s)
        if h < min_h or w < 8 or w >= g.shape[1] or h >= g.shape[0]:
            continue
        r = cv2.matchTemplate(g, cv2.resize(tg, (w, h), interpolation=cv2.INTER_AREA), cv2.TM_CCOEFF_NORMED)
        for y, x in zip(*np.where(r >= thr)):
            found.append((float(r[y, x]), x, y, w, h))
    found.sort(reverse=True)
    out = []
    for sc, x, y, w, h in found:
        if all(abs(x - ox) > ow * 0.5 or abs(y - oy) > oh * 0.5 for _, ox, oy, ow, oh in out):
            out.append((sc, x, y, w, h))
    return out


def bg_color(img, x, y, w, h):
    px = np.array(img)
    pts = [px[max(y - 3, 0), max(x - 3, 0)], px[min(y + h + 3, px.shape[0] - 1), min(x + w + 3, px.shape[1] - 1)], px[max(y - 3, 0), min(x + w + 3, px.shape[1] - 1)]]
    return tuple(int(v) for v in np.median(np.array(pts), axis=0))


def fill(img, x, y, w, h, pad=2):
    ImageDraw.Draw(img).rectangle((x - pad, y - pad, x + w + pad, y + h + pad), fill=bg_color(img, x, y, w, h))


def draw_text(img, x, y, w, h, text, bold, color, maxw=1.35):
    f = ImageFont.truetype(FONT_B if bold else FONT_R, max(8, int(h * 1.05)))
    d = ImageDraw.Draw(img)
    tw = d.textlength(text, font=f)
    if tw > w * maxw:
        f = ImageFont.truetype(FONT_B if bold else FONT_R, max(8, int(h * 1.05 * w * maxw / tw)))
    d.text((x, y + h / 2), text, font=f, fill=color, anchor="lm")


def text_color(img, x, y, w, h):
    reg = np.array(img.crop((x, y, x + w, y + h))).reshape(-1, 3)
    return tuple(int(v) for v in reg[reg.sum(axis=1).argmin()])


def paste_logo(img, x, y, w, h):
    lw = int(LOGO.width * h / LOGO.height); lh = h
    if lw > w * 1.1:
        lw = int(w * 1.1); lh = int(LOGO.height * lw / LOGO.width)
    lg = LOGO.resize((lw, lh), Image.LANCZOS)
    img.paste(lg, (x, y + (h - lh) // 2), lg)


ORANGE = (240, 138, 60)
SKIP_URL = {("android", "4.5")}
MANUAL = {
    ("ios", "4.5"): [((330, 795, 495, 816), "url")],
    ("ios", "7.5"): [((315, 1014, 530, 1035), "url")],
    ("ios", "10.5"): [((630, 555, 780, 600), "orange"), ((210, 1446, 315, 1485), "label")],
    ("android", "1.5"): [((315, 765, 510, 786), "url")],
    ("android", "4.5"): [((180, 870, 345, 936), "logo")],
    ("android", "7.5"): [((240, 876, 435, 936), "logo"), ((264, 1290, 360, 1311), "bold"), ((264, 1326, 435, 1347), "url"), ((309, 762, 510, 786), "url"), ((171, 1434, 264, 1458), "small")],
    ("android", "10.5"): [((630, 555, 780, 600), "orange"), ((216, 912, 300, 933), "label")],
}


def apply_manual(img, n, t):
    for (x0, y0, x1, y1), kind in MANUAL.get((n, t), []):
        w, h = x1 - x0, y1 - y0
        if kind == "logo":
            box = tight(img, (x0, y0, x1, y1), is_orange); fill(img, box[0], box[1], box[2] - box[0], box[3] - box[1]); paste_logo(img, box[0], box[1], box[2] - box[0], box[3] - box[1])
        elif kind == "orange":
            box = tight(img, (x0, y0, x1, y1), is_orange); bw, bh = box[2] - box[0], box[3] - box[1]
            fill(img, box[0], box[1], bw, bh); draw_text(img, box[0], box[1], bw, bh, "GOGO589", True, ORANGE, 1.0)
        else:
            box = tight(img, (x0, y0, x1, y1), lambda r: np.abs(r - np.median(r.reshape(-1, 3), axis=0)).sum(axis=2) > 60)
            bw, bh = box[2] - box[0], box[3] - box[1]
            c = text_color(img, *box[:2], bw, bh) if kind != "label" else None
            reg = np.array(img.crop(box)).reshape(-1, 3)
            if kind == "label":
                c = tuple(int(v) for v in reg[reg.sum(axis=1).argmax()])
            fill(img, box[0], box[1], bw, bh)
            draw_text(img, box[0], box[1], bw, bh, {"url": "www.gogo589.com", "bold": "GOGO589", "small": "GOGO589", "label": "gogo589"}[kind], kind == "bold", c)


SCALES = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.8, 2.1, 2.5]
for n in ["ios", "android"]:
    for t, img in base[n].items():
        img = img.copy()
        icons = find(img, T_ICON, SCALES, 0.78, 20)
        for sc, x, y, w, h in icons:
            fill(img, x, y, w, h, 1)
            ic = ICON.resize((w, h), Image.LANCZOS)
            mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=int(w * 0.22), fill=255)
            img.paste(ic, (x, y), mask)
        logos = find(img, T_LOGO, SCALES, 0.72, 10)
        for sc, x, y, w, h in logos:
            fill(img, x, y, w, h)
            paste_logo(img, x, y, w, h)
        urls = [] if (n, t) in SKIP_URL else find(img, T_URL, SCALES, 0.7, 10)
        for sc, x, y, w, h in urls:
            c = text_color(img, x, y, w, h); fill(img, x, y, w, h); draw_text(img, x, y, w, h, "www.gogo589.com", False, c)
        bolds = find(img, T_BOLD, SCALES, 0.75, 10)
        for sc, x, y, w, h in bolds:
            c = text_color(img, x, y, w, h); fill(img, x, y, w, h); draw_text(img, x, y, w, h, "GOGO589", True, c)
        apply_manual(img, n, t)
        print(n, t, "icons", len(icons), "logos", len(logos), "urls", len(urls), "bold", len(bolds))
        img.save(f"{FR}/g_{n}_{t}.png")
