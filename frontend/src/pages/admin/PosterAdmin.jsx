import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, Copy, Share2 } from "lucide-react";
import { API } from "@/lib/api";
import { sourceLabel } from "@/lib/source";
import { toFullUrl } from "@/components/ImageUpload";

const PRESETS = ["pyq", "gzh", "haibao", "xhs", "dy"];

const TEMPLATES = [
  { key: "brand", name: "品牌邀请" },
  { key: "income", name: "团队激励" },
  { key: "project", name: "项目推广" },
];

const W = 900;
const H = 1200;

// ---- 画布公共绘制件 ----
const drawBase = async (ctx) => {
  ctx.fillStyle = "#060B18";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(450, 380, 40, 450, 380, 520);
  glow.addColorStop(0, "rgba(212,175,55,0.22)");
  glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(212,175,55,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.strokeStyle = "rgba(212,175,55,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  try {
    const logo = new Image();
    logo.src = "/favicon.svg";
    await logo.decode();
    ctx.drawImage(logo, 450 - 44, 92, 88, 88);
  } catch { /* logo 加载失败则跳过 */ }
  ctx.textAlign = "center";
};

const drawDivider = (ctx, y) => {
  ctx.strokeStyle = "rgba(212,175,55,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(300, y);
  ctx.lineTo(442, y);
  ctx.moveTo(458, y);
  ctx.lineTo(600, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(450, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#D4AF37";
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
};

const drawQR = async (ctx, url, x, y, size) => {
  const qrData = await QRCode.toDataURL(url, { margin: 0, width: 460, color: { dark: "#060B18", light: "#FFFFFF" } });
  const qrImg = new Image();
  qrImg.src = qrData;
  await qrImg.decode();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.drawImage(qrImg, x + 20, y + 20, size - 40, size - 40);
};

const wrapText = (ctx, text, maxWidth) => {
  const lines = [];
  let line = "";
  for (const ch of String(text)) {
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawCover = (ctx, img, x, y, w, h, r) => {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.strokeStyle = "rgba(212,175,55,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

export default function PosterAdmin() {
  const [template, setTemplate] = useState("brand");
  const [channel, setChannel] = useState("pyq");
  const [custom, setCustom] = useState("");
  const [tiers, setTiers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const canvasRef = useRef(null);
  const effective = (custom.trim() || channel).slice(0, 50);
  const trackedUrl = `${window.location.origin}/?from=${encodeURIComponent(effective)}`;

  useEffect(() => {
    axios.get(`${API}/settings`).then((res) => setTiers(res.data.tiers || [])).catch(() => {});
    axios.get(`${API}/projects`).then((res) => {
      const list = res.data.projects || [];
      setProjects(list);
      const featured = list.find((p) => p.featured) || list[0];
      if (featured) setProjectId(featured.id);
    }).catch(() => {});
  }, []);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    await document.fonts.ready;
    await drawBase(ctx);

    if (template === "income") {
      // ---- 团队协作激励模板 ----
      ctx.fillStyle = "#FFE896";
      ctx.font = '700 34px "Noto Serif SC", serif';
      ctx.fillText("合赢项目社", 450, 168);
      ctx.font = '700 44px "Noto Serif SC", serif';
      ctx.fillStyle = "#F5E7C1";
      ctx.fillText("团队协作激励", 450, 250);
      drawDivider(ctx, 282);
      const rows = (tiers.length ? tiers : [
        { count: "10人团队", income: "基础激励", featured: false },
        { count: "20人团队", income: "进阶激励", featured: true },
        { count: "50人团队", income: "合伙激励", featured: false },
      ]).slice(0, 3);
      rows.forEach((t, i) => {
        const y = 322 + i * 128;
        ctx.beginPath();
        ctx.roundRect(130, y, 640, 100, 16);
        ctx.fillStyle = t.featured ? "rgba(212,175,55,0.10)" : "rgba(10,18,40,0.85)";
        ctx.fill();
        ctx.strokeStyle = t.featured ? "#D4AF37" : "rgba(212,175,55,0.25)";
        ctx.lineWidth = t.featured ? 2 : 1;
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.font = '700 26px "Noto Sans SC", sans-serif';
        ctx.fillStyle = "#F5E7C1";
        ctx.fillText(t.count, 170, y + 60);
        if (t.featured) {
          ctx.font = '700 14px "Noto Sans SC", sans-serif';
          const tw = ctx.measureText("热门").width;
          ctx.beginPath();
          ctx.roundRect(170 + ctx.measureText(t.count).width + 18, y + 38, tw + 20, 28, 14);
          ctx.fillStyle = "#D4AF37";
          ctx.fill();
          ctx.fillStyle = "#060B18";
          ctx.fillText("热门", 170 + ctx.measureText(t.count).width + 28, y + 58);
        }
        ctx.textAlign = "right";
        ctx.font = '700 28px "Noto Serif SC", serif';
        ctx.fillStyle = "#FFE896";
        ctx.fillText(t.income, 730, y + 60);
        ctx.textAlign = "center";
      });
      ctx.font = '400 15px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "#55617A";
      ctx.fillText("团队协作激励与团队规模、运营情况相关，不构成任何收益承诺，具体以正式合作协议为准", 450, 736);
      await drawQR(ctx, trackedUrl, 310, 776, 280);
      ctx.font = '700 22px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "#E5C158";
      ctx.fillText(`推广渠道：${sourceLabel(effective)}`, 450, 1102);
      ctx.font = '400 17px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "#7C8AA5";
      ctx.fillText("长按识别二维码 · 抢占团长席位", 450, 1142);
      return;
    }

    if (template === "project") {
      // ---- 项目推广模板 ----
      const p = projects.find((x) => x.id === projectId) || projects[0];
      ctx.fillStyle = "#FFE896";
      ctx.font = '700 34px "Noto Serif SC", serif';
      ctx.fillText("合赢项目社", 450, 168);
      ctx.font = '400 19px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "rgba(229,193,88,0.75)";
      ctx.fillText("优 质 项 目 推 荐", 450, 214);
      if (!p) {
        ctx.font = '400 22px "Noto Sans SC", sans-serif';
        ctx.fillStyle = "#94A3B8";
        ctx.fillText("暂无在架项目，请先在后台发布项目", 450, 500);
      } else {
        ctx.font = '700 38px "Noto Serif SC", serif';
        ctx.fillStyle = "#F5E7C1";
        const titleLines = wrapText(ctx, p.title, 720).slice(0, 2);
        titleLines.forEach((ln, i) => ctx.fillText(ln, 450, 285 + i * 50));
        const metaY = 285 + (titleLines.length - 1) * 50 + 48;
        ctx.font = '400 19px "Noto Sans SC", sans-serif';
        ctx.fillStyle = "#94A3B8";
        ctx.fillText([p.category, p.region, p.investment ? `投入 ${p.investment}` : "", p.status].filter(Boolean).join(" · "), 450, metaY);
        let drewImage = false;
        if (p.image) {
          try {
            const img = new Image();
            img.src = toFullUrl(p.image);
            await img.decode();
            drawCover(ctx, img, 130, metaY + 28, 640, 300, 18);
            drewImage = true;
          } catch { /* 图片加载失败则改用亮点列表 */ }
        }
        if (drewImage) {
          const hl = (p.highlights || [])[0];
          if (hl) {
            ctx.font = '400 18px "Noto Sans SC", sans-serif';
            ctx.fillStyle = "#B8C2D8";
            ctx.fillText(`亮点：${hl}`, 450, metaY + 376);
          }
        } else {
          ctx.font = '400 20px "Noto Sans SC", sans-serif';
          ctx.fillStyle = "#B8C2D8";
          (p.highlights || []).slice(0, 3).forEach((h, i) => ctx.fillText(`· ${h}`, 450, metaY + 56 + i * 40));
        }
      }
      await drawQR(ctx, trackedUrl, 310, 806, 280);
      ctx.font = '700 22px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "#E5C158";
      ctx.fillText(`推广渠道：${sourceLabel(effective)}`, 450, 1128);
      ctx.font = '400 17px "Noto Sans SC", sans-serif';
      ctx.fillStyle = "#7C8AA5";
      ctx.fillText("长按识别二维码 · 查看项目详情", 450, 1160);
      return;
    }

    // ---- 品牌邀请模板（默认） ----
    ctx.fillStyle = "#FFE896";
    ctx.font = '700 54px "Noto Serif SC", serif';
    ctx.fillText("合赢项目社", 450, 252);
    ctx.font = '400 18px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "rgba(229,193,88,0.75)";
    ctx.fillText("HEYING PROJECT CLUB", 450, 292);
    drawDivider(ctx, 330);
    ctx.font = '700 38px "Noto Serif SC", serif';
    ctx.fillStyle = "#F5E7C1";
    ctx.fillText("聚力项目 · 合作共赢", 450, 398);
    ctx.font = '400 21px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("每月发布优质合规项目 · 平台不收取任何费用", 450, 444);
    await drawQR(ctx, trackedUrl, 250, 496, 400);
    ctx.font = '700 24px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#E5C158";
    ctx.fillText(`推广渠道：${sourceLabel(effective)}`, 450, 960);
    ctx.font = '400 20px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#8B9BB8";
    ctx.fillText("长按识别二维码 · 了解项目合作详情", 450, 1060);
    ctx.font = '400 17px "Noto Sans SC", sans-serif';
    ctx.fillStyle = "#55617A";
    ctx.fillText(window.location.host, 450, 1108);
  }, [template, effective, trackedUrl, tiers, projects, projectId]);

  useEffect(() => {
    draw().catch(() => {});
  }, [draw]);

  const download = () => {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    const tName = TEMPLATES.find((t) => t.key === template)?.name || "海报";
    a.download = `合赢项目社-${tName}-${effective}.png`;
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

  const chipCls = (on) =>
    `rounded-full border px-4 py-2 text-xs transition-colors ${
      on ? "border-[#D4AF37] bg-amber-500/15 font-bold text-[#E5C158]" : "border-amber-500/20 text-slate-400 hover:border-amber-500/50"
    }`;

  return (
    <div className="grid gap-5 lg:grid-cols-2" data-testid="admin-poster">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-gold-gradient">
          <Share2 size={17} /> 渠道海报生成
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          选择模板与渠道，自动生成带追踪参数的二维码海报；扫码进来的访客会在「访问统计 → 来源渠道」和客服会话中标记来源
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-xs tracking-widest text-slate-400">海报模板</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button" data-testid={`poster-template-${t.key}`} onClick={() => setTemplate(t.key)} className={chipCls(template === t.key)}>
                {t.name}
              </button>
            ))}
          </div>
          {template === "project" && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              data-testid="poster-project-select"
              className="mt-3 w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none [color-scheme:dark] focus:border-[#D4AF37]/60"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}（{p.category}）</option>
              ))}
            </select>
          )}
          {template === "income" && (
            <p className="mt-3 text-[11px] text-slate-600">激励层级取自「站点设置 → 团队协作激励」，改档位后海报自动同步</p>
          )}
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-xs tracking-widest text-slate-400">选择渠道</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button key={c} type="button" data-testid={`poster-channel-${c}`} onClick={() => { setChannel(c); setCustom(""); }} className={chipCls(!custom && channel === c)}>
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
