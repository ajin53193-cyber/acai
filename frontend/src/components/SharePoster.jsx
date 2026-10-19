import { useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Share2, Download, X } from "lucide-react";

const wrapText = (ctx, text, maxWidth) => {
  const lines = [];
  let line = "";
  for (const ch of (text || "").toString()) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Draws a branded navy/gold share poster with a QR code and returns a PNG data URL.
const buildPoster = async ({ url, title, subtitle, badge }) => {
  const W = 800;
  const H = 1180;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0C1630");
  grad.addColorStop(1, "#060B18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // gold top ribbon
  const gold = ctx.createLinearGradient(0, 0, W, 0);
  gold.addColorStop(0, "#FFE896");
  gold.addColorStop(0.5, "#D4AF37");
  gold.addColorStop(1, "#997316");
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, W, 10);

  // brand
  ctx.textAlign = "center";
  ctx.fillStyle = "#F4D98B";
  ctx.font = "900 46px 'Noto Serif SC', serif";
  ctx.fillText("合赢项目社", W / 2, 110);
  ctx.fillStyle = "#8A93A6";
  ctx.font = "600 20px sans-serif";
  ctx.fillText("HEYING PROJECT CLUB", W / 2, 148);

  // badge pill
  if (badge) {
    ctx.font = "700 24px sans-serif";
    const bw = ctx.measureText(badge).width + 56;
    const bx = (W - bw) / 2;
    const by = 184;
    ctx.fillStyle = "rgba(212,175,55,0.16)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#FFE896";
    ctx.fillText(badge, W / 2, by + 32);
  }

  // title (wrapped)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px sans-serif";
  const titleLines = wrapText(ctx, title, W - 120).slice(0, 3);
  let ty = 300;
  titleLines.forEach((l) => {
    ctx.fillText(l, W / 2, ty);
    ty += 58;
  });

  // subtitle
  if (subtitle) {
    ctx.fillStyle = "#AEB6C6";
    ctx.font = "400 26px sans-serif";
    const subLines = wrapText(ctx, subtitle, W - 160).slice(0, 2);
    ty += 8;
    subLines.forEach((l) => {
      ctx.fillText(l, W / 2, ty);
      ty += 38;
    });
  }

  // white QR card
  const cardSize = 520;
  const cardX = (W - cardSize) / 2;
  const cardY = 560;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardSize, cardSize, 36);
  ctx.fill();

  // QR
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 440, color: { dark: "#0A1228", light: "#FFFFFF" } });
  const qrImg = new Image();
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });
  const qrSize = 440;
  ctx.drawImage(qrImg, (W - qrSize) / 2, cardY + 40, qrSize, qrSize);

  // caption
  ctx.fillStyle = "#F4D98B";
  ctx.font = "700 30px sans-serif";
  ctx.fillText("长按识别二维码 查看详情", W / 2, cardY + cardSize + 64);

  // footer compliance
  ctx.fillStyle = "#6B7488";
  ctx.font = "400 22px sans-serif";
  ctx.fillText("平台不收取任何费用 · 不承诺收益", W / 2, H - 48);

  return canvas.toDataURL("image/png");
};

export const SharePoster = ({ url, title, subtitle = "", badge = "", className = "", label = "生成分享海报" }) => {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await buildPoster({ url, title, subtitle, badge });
      setImg(data);
      setOpen(true);
    } catch (e) {
      toast.error("海报生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = img;
    a.download = `${(title || "share").slice(0, 20)}-分享海报.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className={className || "inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37] px-4 py-2 text-sm font-bold text-[#B8860B] transition-transform active:scale-[0.98] disabled:opacity-60"}
        data-testid="share-poster-trigger"
      >
        <Share2 size={15} /> {loading ? "生成中…" : label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          data-testid="share-poster-modal"
        >
          <div className="flex max-h-[92vh] w-full max-w-sm flex-col items-center overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex w-full items-center justify-between">
              <span className="text-sm font-bold text-slate-900">分享海报</span>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-900" data-testid="share-poster-close"><X size={18} /></button>
            </div>
            {img && <img src={img} alt="分享海报" className="w-full rounded-xl border border-slate-200" data-testid="share-poster-image" />}
            <p className="mt-3 text-center text-xs text-slate-500">手机端可长按图片保存，发到群或朋友圈</p>
            <button
              type="button"
              onClick={download}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FFE896] to-[#D4AF37] py-3 text-sm font-bold text-[#1B1403]"
              data-testid="share-poster-download"
            >
              <Download size={16} /> 保存海报
            </button>
          </div>
        </div>
      )}
    </>
  );
};
