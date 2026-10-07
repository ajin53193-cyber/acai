import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, Copy, Share2 } from "lucide-react";
import { sourceLabel } from "@/lib/source";

const PRESETS = ["pyq", "gzh", "haibao", "xhs", "dy"];

export default function PosterAdmin() {
  const [channel, setChannel] = useState("pyq");
  const [custom, setCustom] = useState("");
  const canvasRef = useRef(null);
  const effective = (custom.trim() || channel).slice(0, 50);
  const trackedUrl = `${window.location.origin}/?from=${encodeURIComponent(effective)}`;

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    await document.fonts.ready;
    const W = 900;
    const H = 1200;

    // 深蓝底 + 顶部金色光晕
    ctx.fillStyle = "#060B18";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(450, 380, 40, 450, 380, 520);
    glow.addColorStop(0, "rgba(212,175,55,0.22)");
    glow.addColorStop(1, "rgba(212,175,55,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 双层金色边框
    ctx.strokeStyle = "rgba(212,175,55,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = "rgba(212,175,55,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // Logo
    try {
      const logo = new Image();
      logo.src = "/favicon.svg";
      await logo.decode();
      ctx.drawImage(logo, 450 - 44, 92, 88, 88);
    } catch { /* logo 加载失败则跳过 */ }

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFE896";
    ctx.font = '700 54px "Noto Serif SC", serif';
    ctx.fillText("合赢项目社", 450, 252);
    ctx.font = '400 18px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "rgba(229,193,88,0.75)";
    ctx.fillText("HEYING PROJECT CLUB", 450, 292);

    // 金色分隔线 + 菱形
    ctx.strokeStyle = "rgba(212,175,55,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(300, 330);
    ctx.lineTo(442, 330);
    ctx.moveTo(458, 330);
    ctx.lineTo(600, 330);
    ctx.stroke();
    ctx.save();
    ctx.translate(450, 330);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#D4AF37";
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();

    ctx.font = '700 38px "Noto Serif SC", serif';
    ctx.fillStyle = "#F5E7C1";
    ctx.fillText("聚力项目 · 合作共赢", 450, 398);
    ctx.font = '400 21px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("每月发布优质稳定项目 · 平台不收取任何费用", 450, 444);

    // 二维码白卡 + 金框
    const qrData = await QRCode.toDataURL(trackedUrl, {
      margin: 0,
      width: 460,
      color: { dark: "#060B18", light: "#FFFFFF" },
    });
    const qrImg = new Image();
    qrImg.src = qrData;
    await qrImg.decode();
    const qx = 250;
    const qy = 496;
    const qs = 400;
    ctx.beginPath();
    ctx.roundRect(qx, qy, qs, qs, 24);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.drawImage(qrImg, qx + 20, qy + 20, qs - 40, qs - 40);

    // 渠道标签 + 底部说明
    ctx.font = '700 24px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#E5C158";
    ctx.fillText(`推广渠道：${sourceLabel(effective)}`, 450, 960);
    ctx.font = '400 20px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#8B9BB8";
    ctx.fillText("长按识别二维码 · 了解项目合作详情", 450, 1060);
    ctx.font = '400 17px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#55617A";
    ctx.fillText(window.location.host, 450, 1108);
  }, [effective, trackedUrl]);

  useEffect(() => {
    draw().catch(() => {});
  }, [draw]);

  const download = () => {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `合赢项目社-渠道海报-${effective}.png`;
    a.click();
    toast.success("海报已下载，可印刷或转发");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackedUrl);
      toast.success("追踪链接已复制");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2" data-testid="admin-poster">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-gold-gradient">
          <Share2 size={17} /> 渠道海报生成
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          选择渠道后自动生成带追踪参数的二维码海报，扫码进来的访客会在「访问统计 → 来源渠道」和客服会话中标记来源
        </p>
        <div className="mt-5">
          <label className="mb-2 block text-xs tracking-widest text-slate-400">选择渠道</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`poster-channel-${c}`}
                onClick={() => { setChannel(c); setCustom(""); }}
                className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                  !custom && channel === c
                    ? "border-[#D4AF37] bg-amber-500/15 font-bold text-[#E5C158]"
                    : "border-amber-500/20 text-slate-400 hover:border-amber-500/50"
                }`}
              >
                {sourceLabel(c)}（{c}）
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="或自定义渠道代号（字母/数字/中文均可，如：电梯广告）"
            className="mt-3 w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/60"
            data-testid="poster-custom-channel"
          />
        </div>
        <div className="mt-5">
          <label className="mb-2 block text-xs tracking-widest text-slate-400">追踪链接（海报二维码内容）</label>
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-xs text-[#E5C158]" data-testid="poster-tracked-url">{trackedUrl}</span>
            <button type="button" onClick={copyLink} data-testid="poster-copy-link-btn" className="shrink-0 text-slate-400 transition-colors hover:text-[#E5C158]" aria-label="复制链接">
              <Copy size={15} />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={download}
          data-testid="poster-download-btn"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-3 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Download size={15} /> 下载海报 PNG（900×1200）
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-600">提示：在正式站 eztyv.com 的后台生成，二维码才会指向正式域名</p>
      </div>
      <div className="glass-card flex items-start justify-center rounded-2xl p-6">
        <canvas ref={canvasRef} width={900} height={1200} className="w-full max-w-sm rounded-2xl border border-amber-500/15" data-testid="poster-canvas" />
      </div>
    </div>
  );
}
