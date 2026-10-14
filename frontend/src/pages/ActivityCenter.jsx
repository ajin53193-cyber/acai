import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Gift, Users, Copy, Check, Share2, Loader2, Trophy, Ticket } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { tr } from "@/i18n";

const fmtT = (s) => (s ? s.slice(5, 16).replace("T", " ") : "");

export default function ActivityCenter() {
  const callApi = useApi();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuthModal();
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null);
  const [ref, setRef] = useState(null);
  const [history, setHistory] = useState([]);
  const [winners, setWinners] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [wIdx, setWIdx] = useState(0);
  const resultRef = useRef(null);

  useEffect(() => {
    publicApi.get("/lottery/config").then((r) => setCfg(r.data)).catch(() => {});
    publicApi.get("/lottery/recent-winners").then((r) => setWinners(r.data || [])).catch(() => {});
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) localStorage.setItem("ref_code", code.toUpperCase());
  }, []);
  useEffect(() => {
    if (isSignedIn === false && new URLSearchParams(window.location.search).get("ref")) openAuth("register");
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMe = () => {
    callApi({ method: "GET", url: "/lottery/my-status" }).then((r) => setStatus(r.data)).catch(() => {});
    callApi({ method: "GET", url: "/me/referral" }).then((r) => setRef(r.data)).catch(() => {});
    callApi({ method: "GET", url: "/lottery/my-draws" }).then((r) => setHistory(r.data || [])).catch(() => {});
  };
  useEffect(() => {
    if (!isSignedIn) { setStatus(null); setRef(null); setHistory([]); return; }
    const pending = localStorage.getItem("ref_code");
    const bind = pending ? callApi({ method: "POST", url: "/me/referral/bind", data: { code: pending } }).then((r) => { toast.success(r.data.message || tr("綁定成功")); }).catch(() => {}).finally(() => localStorage.removeItem("ref_code")) : Promise.resolve();
    bind.then(loadMe);
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (winners.length < 2) return undefined; const t = setInterval(() => setWIdx((i) => (i + 1) % winners.length), 2500); return () => clearInterval(t); }, [winners.length]);

  const prizes = cfg?.prizes || [];
  const n = prizes.length || 1;
  const seg = 360 / n;
  const grad = prizes.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");
  const draws = status?.bonus_draws || 0;
  const inviteLink = ref?.code ? `${window.location.origin}/activities?ref=${ref.code}` : "";

  const draw = async () => {
    if (!isSignedIn) return openAuth();
    if (spinning) return;
    if (draws <= 0) return toast.error(tr("抽獎次數不足，快去邀請好友吧！"));
    setResult(null); setSpinning(true);
    try {
      const r = await callApi({ method: "POST", url: "/lottery/draw", data: { count: 1 } });
      const idx = Math.max(0, prizes.findIndex((p) => p.id === r.data.prize_id));
      const target = 360 * 6 - (idx * seg + seg / 2);
      const base = rotation - (rotation % 360);
      setRotation(base + target);
      setTimeout(() => { setSpinning(false); setResult(r.data); loadMe(); }, 4200);
    } catch (e) { setSpinning(false); toast.error(e.response?.data?.detail || tr("抽獎失敗")); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(inviteLink); setCopied(true); toast.success(tr("邀請連結已複製")); setTimeout(() => setCopied(false), 1500); } catch { toast.error(tr("複製失敗，請手動複製")); } };
  const share = async () => {
    if (!isSignedIn) return openAuth();
    if (navigator.share) { try { await navigator.share({ title: cfg?.title, text: tr("來 gogo589 一起抽大獎，透過我的連結註冊！"), url: inviteLink }); return; } catch { /* cancelled */ } }
    copy();
  };
  const w = winners[wIdx];

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:py-8" data-testid="activity-center">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 px-5 md:px-8 py-6 md:py-8 text-white shadow-lg" data-testid="ac-hero">
        <Gift className="absolute -right-4 -top-4 h-36 w-36 text-white/10 rotate-12" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <Link to="/" data-testid="activity-center-back" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回首頁")}</Link>
            <span className="text-xs bg-white/20 rounded-full px-2.5 py-1">{tr("活動中心")}</span>
          </div>
          <h1 className="font-head text-3xl md:text-5xl font-extrabold drop-shadow mt-5 text-center">{cfg?.title || tr("邀請好友 · 抽大獎")}</h1>
          {cfg?.subtitle && <p className="text-white/90 text-sm md:text-lg mt-2 text-center">{cfg.subtitle}</p>}
          <div className="mt-4 mx-auto max-w-md rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-xs text-center truncate" data-testid="ac-winner-ticker">
            {w ? <><Trophy className="inline h-3.5 w-3.5 -mt-0.5 mr-1 text-amber-200" />{tr("恭喜用戶 {0} 抽中 {1}", w.account, w.prize)}</> : tr("邀請好友即可參與抽獎，100% 有獎")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 md:gap-6 mt-6 items-start">
        {/* wheel */}
        <div className="rounded-3xl bg-white border border-orange-100 shadow-sm p-5 md:p-7" data-testid="ac-wheel">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-head text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2"><Gift className="h-5 w-5 text-orange-500" />{tr("幸運大轉盤")}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-xs font-bold px-3 py-1" data-testid="ac-draws-left"><Ticket className="h-3.5 w-3.5" />{tr("剩餘抽獎次數")}：{isSignedIn ? draws : "-"}</span>
          </div>
          <div className="flex flex-col items-center mt-5">
            <div className="relative h-64 w-64 md:h-80 md:w-80">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 h-0 w-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-rose-600 drop-shadow" />
              <div className="h-full w-full rounded-full border-[8px] border-orange-400 shadow-[0_10px_30px_rgba(249,115,22,0.35)]" style={{ background: prizes.length ? `conic-gradient(${grad})` : "#fed7aa", transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none" }}>
                {prizes.map((p, i) => <span key={p.id} className="absolute left-1/2 top-1/2 text-[11px] md:text-xs font-bold text-slate-800/85 whitespace-nowrap" style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-${window.innerWidth >= 768 ? 112 : 88}px) rotate(-${i * seg + seg / 2}deg) translate(-50%,-50%)` }}>{p.label.length > 7 ? p.label.slice(0, 7) + "…" : p.label}</span>)}
              </div>
              <button data-testid="ac-draw-btn" onClick={draw} disabled={spinning} className="absolute inset-0 m-auto h-20 w-20 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-white font-head font-extrabold text-sm md:text-base shadow-xl ring-4 ring-white hover:scale-105 active:scale-95 transition-transform disabled:opacity-80 z-10">{spinning ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : <>{tr("立即")}<br />{tr("抽獎")}</>}</button>
            </div>
            <div className="w-40 h-5 -mt-1 rounded-b-2xl bg-gradient-to-b from-orange-400 to-orange-600" /><div className="w-64 h-3 rounded-full bg-orange-200" />
            {result && (
              <div ref={resultRef} data-testid="ac-draw-result" className={`mt-4 w-full max-w-md rounded-2xl px-4 py-3 text-center font-bold ${result.prize_type === "none" ? "bg-slate-100 text-slate-600" : "bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 border border-orange-200"}`}>
                {result.prize_type === "none" ? tr("很遺憾未中獎，再邀請好友試試！") : tr("🎉 恭喜抽中：{0}", result.prize_label)}
              </div>
            )}
            {!isSignedIn && <button data-testid="ac-login-btn" onClick={() => openAuth()} className="mt-4 h-11 px-8 rounded-full bg-orange-500 text-white font-bold shadow hover:bg-orange-600">{tr("登入 / 註冊參加活動")}</button>}
            {isSignedIn && draws <= 0 && !spinning && <div className="mt-3 text-xs text-slate-500">{tr("暫無抽獎次數，每邀請 {0} 位好友註冊可得 {1} 次", 1, cfg?.invite_draws || 1)}</div>}
          </div>
          <div className="mt-6 rounded-2xl bg-orange-50/70 border border-orange-100 p-4" data-testid="ac-rules">
            <div className="text-sm font-bold text-slate-800 mb-1.5">{tr("活動規則")}</div>
            <div className="text-xs text-slate-600 whitespace-pre-line leading-5">{cfg?.rules || tr("邀請好友註冊獲得抽獎次數，消耗次數抽獎。")}</div>
          </div>
        </div>

        {/* invite + history */}
        <div className="space-y-5">
          <div className="rounded-3xl bg-white border border-orange-100 shadow-sm p-5" data-testid="ac-invite">
            <h2 className="font-head text-lg font-extrabold text-slate-900 flex items-center gap-2"><Users className="h-5 w-5 text-orange-500" />{tr("邀請好友")}</h2>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-xl bg-orange-50 p-3 text-center"><div className="text-[11px] text-slate-500">{tr("已邀請")}</div><div className="font-head text-2xl font-extrabold text-orange-600" data-testid="ac-invited">{ref?.invited ?? "-"}</div></div>
              <div className="rounded-xl bg-rose-50 p-3 text-center"><div className="text-[11px] text-slate-500">{tr("可用次數")}</div><div className="font-head text-2xl font-extrabold text-rose-600">{isSignedIn ? draws : "-"}</div></div>
            </div>
            {isSignedIn && ref?.code ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="rounded-xl bg-white border border-orange-100 p-1.5 shrink-0"><QRCodeSVG value={inviteLink} size={88} fgColor="#E8792A" level="M" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-slate-500">{tr("我的邀請碼")}</div>
                    <div className="font-head text-xl font-extrabold tracking-[0.2em] text-slate-900" data-testid="ac-invite-code">{ref.code}</div>
                    <div className="text-[10px] text-slate-400 break-all mt-1 line-clamp-2" data-testid="ac-invite-link">{inviteLink}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button data-testid="ac-copy-btn" onClick={copy} className="h-10 rounded-full bg-orange-500 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-orange-600">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{tr("複製連結")}</button>
                  <button data-testid="ac-share-btn" onClick={share} className="h-10 rounded-full bg-rose-500 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-rose-600"><Share2 className="h-4 w-4" />{tr("分享")}</button>
                </div>
              </>
            ) : (
              <button data-testid="ac-invite-login" onClick={() => openAuth()} className="mt-4 w-full h-10 rounded-full bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">{tr("登入後獲取專屬邀請連結")}</button>
            )}
            <div className="mt-4 grid grid-cols-3 gap-1.5 text-center text-[11px] text-slate-600">
              {[tr("分享連結"), tr("好友註冊"), tr("獲得抽獎")].map((t, i) => <div key={i} className="rounded-lg bg-slate-50 py-2"><div className="font-head font-extrabold text-orange-500">{i + 1}</div>{t}</div>)}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-orange-100 shadow-sm p-5" data-testid="ac-history">
            <h2 className="font-head text-lg font-extrabold text-slate-900 flex items-center gap-2"><Trophy className="h-5 w-5 text-orange-500" />{tr("我的中獎紀錄")}</h2>
            <div className="mt-3 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {history.length === 0 && <div className="text-center text-xs text-slate-400 py-6">{isSignedIn ? tr("尚無抽獎紀錄") : tr("登入後查看")}</div>}
              {history.map((h) => <div key={h.id} data-testid={`ac-history-${h.id}`} className="flex items-center justify-between py-2 text-sm"><span className={h.prize_type === "none" ? "text-slate-500" : "text-orange-600 font-semibold"}>{h.prize_label}</span><span className="text-[11px] text-slate-400">{fmtT(h.created_at)}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
