function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapMono(ctx, text, maxWidth) {
  const lines = [];
  let cur = "";
  for (const ch of String(text)) {
    const t = cur + ch;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = ch; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draws the gift-card share image on a canvas (reliable everywhere, no foreignObject).
export async function makeGiftShareBlob(g, labels, imgUrl = "/giftbox-disc.png") {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([
      document.fonts.load("24px 'ZCOOL KuaiLe'"),
      document.fonts.load("18px 'ZCOOL KuaiLe'"),
      document.fonts.load("17px 'JetBrains Mono'"),
    ]);
  } catch (e) { /* ignore */ }

  const img = new Image();
  img.src = imgUrl;
  try { await img.decode(); } catch (e) { /* ignore */ }

  const W = 380, pad = 24, scale = 2;
  const tmp = document.createElement("canvas").getContext("2d");
  tmp.font = "17px 'JetBrains Mono', monospace";
  const tradeLines = wrapMono(tmp, g.trade_no || "", W - 2 * pad - 36);

  const blessing = (labels.blessing || "").trim();
  let blessLines = [];
  if (blessing) {
    tmp.font = "16px 'ZCOOL KuaiLe', sans-serif";
    blessLines = wrapMono(tmp, `“${blessing}”`, W - 2 * pad - 28);
  }

  const titleY = 46, discTop = 72, discSize = 112;
  const subY = discTop + discSize + 30;
  const tnoTop = subY + 16, lineH = 28;
  const tnoH = tradeLines.length * lineH + 24;
  const meta = [g.product_name, g.spec_label].filter(Boolean).join(" ");
  const metaY = tnoTop + tnoH + 24;

  const blessLineH = 25;
  const blessTop = metaY + (meta ? 14 : -4);
  const blessH = blessing ? blessLines.length * blessLineH + 24 : 0;

  const noteY = (blessing ? blessTop + blessH + 24 : metaY + (meta ? 28 : 6));
  const H = noteY + 30;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#FFE6CC");
  grad.addColorStop(0.55, "#FFF1E2");
  grad.addColorStop(1, "#ffffff");
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ea7a1f";
  ctx.font = "24px 'ZCOOL KuaiLe', sans-serif";
  ctx.fillText(labels.brand, W / 2, titleY);

  const cx = W / 2, cy = discTop + discSize / 2, r = discSize / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img.width) {
    const s = Math.max(discSize / img.width, discSize / img.height) * 1.08;
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#fdba74";
    ctx.fillRect(cx - r, cy - r, discSize, discSize);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#f97316";
  ctx.font = "18px 'ZCOOL KuaiLe', sans-serif";
  ctx.fillText(labels.sub, W / 2, subY);

  roundRect(ctx, pad, tnoTop, W - 2 * pad, tnoH, 16);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.font = "17px 'JetBrains Mono', monospace";
  tradeLines.forEach((ln, i) => ctx.fillText(ln, W / 2, tnoTop + 24 + i * lineH));

  if (meta) {
    ctx.fillStyle = "#64748b";
    ctx.font = "13px 'Noto Sans TC', sans-serif";
    ctx.fillText(meta, W / 2, metaY);
  }

  if (blessing) {
    roundRect(ctx, pad, blessTop, W - 2 * pad, blessH, 14);
    ctx.fillStyle = "rgba(249,115,22,0.08)";
    ctx.fill();
    ctx.fillStyle = "#c2410c";
    ctx.font = "16px 'ZCOOL KuaiLe', sans-serif";
    blessLines.forEach((ln, i) => ctx.fillText(ln, W / 2, blessTop + 24 + i * blessLineH));
  }

  ctx.fillStyle = "rgba(124,45,18,0.55)";
  ctx.font = "14px 'ZCOOL KuaiLe', sans-serif";
  ctx.fillText(labels.note, W / 2, noteY);

  return await new Promise((res) => canvas.toBlob(res, "image/png"));
}
