import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { QRCodeCanvas } from "qrcode.react";
import { Users, Copy, Gift, ArrowLeft, Check, Image as ImageIcon, Download, Share2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { tr } from "@/i18n";

const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const wrap = (ctx, text, x, y, maxW, lh) => { const chars = [...(text || "")]; let line = ""; let yy = y; for (const ch of chars) { if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; } if (line) ctx.fillText(line, x, yy); return yy; };

export default function Invite() {
  const callApi = useApi();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuthModal();
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [posterUrl, setPosterUrl] = useState("");
  const [building, setBuilding] = useState(false);
  const qrRef = useRef(null);

  const load = () => callApi({ method: "GET", url: "/me/referral" }).then((r) => setInfo(r.data)).catch(() => {});
  useEffect(() => { if (isSignedIn) load(); }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const s = localStorage.getItem("ref_code"); if (s) setCode(s); }, []);

  const link = info ? `${window.location.origin}/?ref=${info.code}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); toast.success(tr("邀請連結已複製")); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: tr("邀請你來 gogo589"), text: tr("用我的邀請碼註冊，首充雙方都得積分！"), url: link }); } catch { /* noop */ } } else copy(); };
  const bind = async () => {
    if (!code.trim()) return toast.error(tr("請輸入邀請碼"));
    try { const r = await callApi({ method: "POST", url: "/me/referral/bind", data: { code: code.trim() } }); toast.success(r.data.message || tr("綁定成功")); localStorage.removeItem("ref_code"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("綁定失敗")); }
  };

  const buildPoster = async () => {
    if (!info) return;
    setBuilding(true);
    try {
      const W = 750, H = 1250;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      const bg = info.posters?.[sel]?.image;
      if (bg) {
        try { const img = await loadImg(bg); const s = Math.max(W / img.width, H / img.height); const dw = img.width * s, dh = img.height * s; ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); }
        catch { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#f97316"); g.addColorStop(1, "#fbbf24"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      } else { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#f97316"); g.addColorStop(1, "#fbbf24"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // top scrim for text legibility
      const scrim = ctx.createLinearGradient(0, 0, 0, 340); scrim.addColorStop(0, "rgba(0,0,0,0.38)"); scrim.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, 340);
      // title / subtitle
      ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 8;
      ctx.font = "800 54px sans-serif"; wrap(ctx, info.poster_title || tr("邀請好友 · 一起賺積分"), W / 2, 110, W - 100, 66);
      ctx.shadowBlur = 4; ctx.font = "500 28px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.95)";
      wrap(ctx, info.poster_subtitle || tr("掃碼註冊並完成首充，雙方立得積分獎勵"), W / 2, 210, W - 140, 40);
      ctx.shadowBlur = 0;
      // bottom white card
      const cx = 50, cy = 800, cw = W - 100, ch = 400;
      ctx.fillStyle = "#ffffff"; roundRect(ctx, cx, cy, cw, ch, 32); ctx.fill();
      // QR right
      const qr = qrRef.current; const qs = 220, qx = cx + cw - qs - 40, qy = cy + 70;
      if (qr) ctx.drawImage(qr, qx, qy, qs, qs);
      ctx.textAlign = "center"; ctx.fillStyle = "#94a3b8"; ctx.font = "500 22px sans-serif"; ctx.fillText(tr("長按/掃碼註冊"), qx + qs / 2, qy + qs + 34);
      // left text
      ctx.textAlign = "left"; const lx = cx + 44;
      ctx.fillStyle = "#94a3b8"; ctx.font = "500 24px sans-serif"; ctx.fillText(tr("我的邀請碼"), lx, cy + 78);
      ctx.fillStyle = "#ea580c"; ctx.font = "800 64px sans-serif"; ctx.fillText(info.code, lx, cy + 150);
      ctx.fillStyle = "#334155"; ctx.font = "600 26px sans-serif"; ctx.fillText(tr("邀請人 +{0} 積分", info.referrer_points), lx, cy + 232);
      ctx.fillStyle = "#334155"; ctx.fillText(tr("好友 +{0} 積分", info.referee_points), lx, cy + 272);
      ctx.fillStyle = "#f97316"; ctx.font = "700 24px sans-serif"; ctx.fillText("gogo589.com", lx, cy + ch - 34);
      setPosterUrl(cv.toDataURL("image/png"));
    } catch (e) { toast.error(tr("海報生成失敗")); }
    setBuilding(false);
  };

  useEffect(() => { if (posterOpen && info) { const t = setTimeout(buildPoster, 120); return () => clearTimeout(t); } }, [posterOpen, sel, info]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePoster = () => {
    if (!posterUrl) return;
    const a = document.createElement("a"); a.href = posterUrl; a.download = `gogo589-invite-${info.code}.png`; document.body.appendChild(a); a.click(); a.remove();
    toast.success(tr("海報已保存"));
  };
  const sharePoster = async () => {
    if (!posterUrl) return;
    try {
      const blob = await (await fetch(posterUrl)).blob();
      const file = new File([blob], `invite-${info.code}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: tr("邀請你來 gogo589"), text: link }); return; }
    } catch { /* noop */ }
    savePoster();
  };

  if (!isSignedIn) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Users className="h-12 w-12 text-orange-300" />
      <p>{tr("登入後查看你的邀請獎勵")}</p>
      <button onClick={openAuth} data-testid="invite-login-btn" className="h-10 px-6 rounded-full bg-orange-500 text-white font-semibold">{tr("登入 / 註冊")}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-amber-400 pb-16" data-testid="invite-page">
      <div className="max-w-xl mx-auto px-4 pt-5">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回帳戶")}</Link>
        <div className="text-center mt-4 text-white">
          <h1 className="font-head text-3xl font-extrabold drop-shadow flex items-center justify-center gap-2"><Users className="h-7 w-7" />{tr("邀請好友返積分")}</h1>
          <p className="text-white/90 text-sm mt-2">{info ? tr("好友用你的邀請碼註冊並完成首次充值，你得 {0} 積分、好友得 {1} 積分", info.referrer_points, info.referee_points) : "…"}</p>
        </div>

        {info && (
          <>
            <div className="bg-white rounded-2xl p-5 mt-6 shadow-lg">
              <div className="text-xs text-slate-400">{tr("我的邀請碼")}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="font-head text-2xl font-extrabold tracking-widest text-orange-600 flex-1" data-testid="invite-code">{info.code}</div>
              </div>
              <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                <input readOnly value={link} className="flex-1 bg-transparent text-xs text-slate-500 outline-none" data-testid="invite-link" />
                <button onClick={copy} data-testid="invite-copy-btn" className="h-8 px-3 rounded-lg bg-orange-100 text-orange-600 text-xs font-bold inline-flex items-center gap-1">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{tr("複製")}</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={share} data-testid="invite-share-btn" className="h-11 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 inline-flex items-center justify-center gap-1.5"><Share2 className="h-4 w-4" />{tr("分享連結")}</button>
                <button onClick={() => { setSel(0); setPosterUrl(""); setPosterOpen(true); }} data-testid="invite-poster-btn" className="h-11 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 inline-flex items-center justify-center gap-1.5"><ImageIcon className="h-4 w-4" />{tr("生成邀請海報")}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-center">
                <div className="bg-orange-50 rounded-xl py-3"><div className="font-head text-xl font-extrabold text-orange-600" data-testid="invite-count">{info.invited}</div><div className="text-[11px] text-slate-400">{tr("成功邀請")}</div></div>
                <div className="bg-amber-50 rounded-xl py-3"><div className="font-head text-xl font-extrabold text-amber-600" data-testid="invite-points">{info.points_earned}</div><div className="text-[11px] text-slate-400">{tr("累計獲得積分")}</div></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 mt-4 shadow-lg" data-testid="invite-bind-card">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2"><Gift className="h-4 w-4 text-rose-500" />{tr("填寫好友的邀請碼")}</div>
              {info.bound ? (
                <div className="text-sm text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2" data-testid="invite-bound">{tr("你已綁定邀請碼，完成首次充值即可獲得獎勵")}</div>
              ) : !info.can_bind ? (
                <div className="text-sm text-slate-400 bg-slate-50 rounded-xl px-3 py-2">{tr("你已完成過充值，無法再綁定邀請碼")}</div>
              ) : (
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={tr("輸入 8 位邀請碼")} data-testid="invite-bind-input"
                    className="flex-1 h-10 rounded-xl bg-slate-100 px-3 text-sm uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-300" maxLength={8} />
                  <button onClick={bind} data-testid="invite-bind-btn" className="h-10 px-5 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600">{tr("綁定")}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* hidden QR for poster compositing */}
      {info && <div style={{ position: "absolute", left: -9999, top: -9999 }}><QRCodeCanvas value={link} size={220} level="M" ref={qrRef} marginSize={2} /></div>}

      {posterOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPosterOpen(false)} data-testid="invite-poster-modal">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-head font-bold text-slate-900">{tr("邀請海報")}</h3>
              <button onClick={() => setPosterOpen(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4">
              <div className="rounded-xl overflow-hidden bg-slate-100 aspect-[3/5] flex items-center justify-center">
                {building ? <Loader2 className="h-7 w-7 animate-spin text-orange-400" /> : posterUrl ? <img src={posterUrl} alt="poster" className="w-full h-full object-contain" data-testid="invite-poster-img" /> : <span className="text-slate-400 text-sm">{tr("生成中…")}</span>}
              </div>
              {info?.posters?.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1" data-testid="invite-poster-templates">
                  {info.posters.map((p, i) => (
                    <button key={p.id} onClick={() => setSel(i)} data-testid={`invite-poster-tpl-${i}`}
                      className={`shrink-0 h-16 w-10 rounded-lg overflow-hidden border-2 ${sel === i ? "border-orange-500" : "border-transparent"}`}>
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={savePoster} disabled={!posterUrl} data-testid="invite-poster-save" className="h-11 rounded-full bg-orange-500 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"><Download className="h-4 w-4" />{tr("保存圖片")}</button>
                <button onClick={sharePoster} disabled={!posterUrl} data-testid="invite-poster-share" className="h-11 rounded-full bg-amber-500 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"><Share2 className="h-4 w-4" />{tr("分享海報")}</button>
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2">{tr("好友掃碼或用邀請碼註冊並首充，雙方都得積分")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
