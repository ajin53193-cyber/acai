import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Sparkles, Gift, ArrowLeft, Loader2, Coins, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { tr } from "@/i18n";

export default function Lottery() {
  const callApi = useApi();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuthModal();
  const [cfg, setCfg] = useState(null);
  const [points, setPoints] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);
  const wheelRef = useRef(null);

  useEffect(() => { callApi({ method: "GET", url: "/lottery/config" }).then((r) => setCfg(r.data)).catch(() => {}); }, [callApi]);
  const loadMe = () => { callApi({ method: "GET", url: "/me/profile" }).then((r) => setPoints(r.data.points ?? 0)).catch(() => {}); };
  const loadStatus = () => { callApi({ method: "GET", url: "/lottery/my-status" }).then((r) => { setStatus(r.data); setPoints(r.data.points); }).catch(() => {}); };
  const loadHist = () => { callApi({ method: "GET", url: "/lottery/my-draws" }).then((r) => setHistory(r.data)).catch(() => {}); };
  useEffect(() => { if (isSignedIn) { loadStatus(); loadHist(); } }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const prizes = cfg?.prizes || [];
  const n = prizes.length || 1;
  const seg = 360 / n;
  const grad = prizes.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");
  const freeAvail = status?.free_available;
  const bonus = status?.bonus_draws || 0;

  const share = async () => {
    if (!isSignedIn) return openAuth();
    const url = window.location.origin + "/lottery";
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    if (navigator.share) { try { await navigator.share({ title: tr("積分幸運大轉盤"), text: tr("來 gogo589 玩積分抽獎，100% 有獎！"), url }); } catch { /* cancelled */ } }
    try {
      const r = await callApi({ method: "POST", url: "/lottery/share" });
      if (r.data.granted) toast.success(r.data.message || tr("分享成功，獲得 1 次免費抽獎！"));
      else toast.info(r.data.message || tr("今日分享獎勵已領取"));
      loadStatus();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };

  const draw = async (count = 1) => {
    if (!isSignedIn) return openAuth();
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    try {
      const r = await callApi({ method: "POST", url: "/lottery/draw", data: { count } });
      const idx = Math.max(0, prizes.findIndex((p) => p.id === r.data.prize_id));
      const target = 360 * 6 - (idx * seg + seg / 2);
      const base = rotation - (rotation % 360);
      setRotation(base + target);
      setTimeout(() => {
        setSpinning(false);
        setResult(r.data);
        setPoints(r.data.points_balance);
        setStatus((s) => s ? { ...s, free_available: r.data.free_available, bonus_draws: r.data.bonus_draws ?? s.bonus_draws } : s);
        loadHist();
      }, 4200);
    } catch (e) {
      setSpinning(false);
      toast.error(e.response?.data?.detail || tr("抽獎失敗"));
      loadStatus();
    }
  };

  if (cfg && !cfg.enabled) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Gift className="h-12 w-12 text-orange-300" />
      <p>{tr("抽獎活動暫未開啟")}</p>
      <Link to="/" className="text-orange-500 text-sm">{tr("返回首頁")}</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 via-orange-400 to-amber-300 pb-16" data-testid="lottery-page">
      <div className="max-w-3xl mx-auto px-4 pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回首頁")}</Link>
        <div className="text-center mt-4">
          <h1 className="font-head text-3xl sm:text-4xl font-extrabold text-white drop-shadow flex items-center justify-center gap-2"><Sparkles className="h-7 w-7 text-amber-100" />{tr("積分幸運大轉盤")}</h1>
          <p className="text-white/90 text-sm mt-2">{tr("每次消耗 {0} 積分，100% 有獎！", cfg?.cost_points ?? "…")}</p>
          <div className="inline-flex items-center gap-1.5 mt-3 bg-white/20 backdrop-blur rounded-full px-4 py-1.5 text-white font-semibold" data-testid="lottery-points"><Coins className="h-4 w-4 text-amber-100" />{tr("我的積分")}：{points ?? (isSignedIn ? "…" : 0)}</div>
        </div>

        {/* Wheel */}
        <div className="relative mx-auto mt-7 w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]">
          {/* pointer */}
          <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-rose-600 drop-shadow" />
          <div ref={wheelRef} className="absolute inset-0 rounded-full shadow-2xl border-[6px] border-white"
            style={{ background: `conic-gradient(${grad || "#fb923c 0deg 360deg"})`, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.2,1)" : "none" }} data-testid="lottery-wheel">
            {prizes.map((p, i) => (
              <div key={p.id} className="absolute left-1/2 top-1/2 origin-top" style={{ transform: `rotate(${i * seg + seg / 2}deg)`, height: "46%" }}>
                <span className="block -translate-x-1/2 text-[11px] sm:text-xs font-bold text-white drop-shadow max-w-[70px] text-center leading-tight" style={{ transform: "translateY(8px)" }}>{p.label}</span>
              </div>
            ))}
          </div>
          {/* center button */}
          <button data-testid="lottery-draw-btn" onClick={() => draw(1)} disabled={spinning}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 h-[86px] w-[86px] rounded-full bg-white text-orange-600 font-head font-extrabold text-lg shadow-[0_6px_0_rgba(0,0,0,0.12)] active:translate-y-[-48%] disabled:opacity-80 flex flex-col items-center justify-center border-4 border-amber-200">
            {spinning ? <Loader2 className="h-6 w-6 animate-spin" /> : <>{tr("抽獎")}<span className="text-[10px] font-semibold text-slate-400">{freeAvail ? tr("今日免費") : `${cfg?.cost_points}${tr("積分")}`}</span></>}
          </button>
        </div>

        <div className="text-center mt-6 flex flex-wrap items-center justify-center gap-3">
          <button data-testid="lottery-draw-btn-2" onClick={() => draw(1)} disabled={spinning} className="h-12 px-8 rounded-full bg-white text-orange-600 font-bold text-base shadow-lg hover:bg-orange-50 disabled:opacity-70">
            {spinning ? tr("抽獎中…") : (!isSignedIn ? tr("登入後抽獎") : freeAvail ? tr("免費抽 1 次") : tr("抽 1 次（{0} 積分）", cfg?.cost_points))}
          </button>
          {isSignedIn && (
            <button data-testid="lottery-draw-btn-10" onClick={() => draw(10)} disabled={spinning} className="h-12 px-8 rounded-full bg-amber-900/90 text-white font-bold text-base shadow-lg hover:bg-amber-900 disabled:opacity-70">
              {tr("連抽十次（{0} 積分）", (cfg?.cost_points || 0) * 10)}
            </button>
          )}
          <button data-testid="lottery-share-btn" onClick={share} disabled={spinning} className="h-12 px-6 rounded-full bg-white/20 backdrop-blur text-white font-bold text-base border border-white/40 hover:bg-white/30 inline-flex items-center gap-1.5">
            <Share2 className="h-4 w-4" />{tr("分享得抽獎次數")}
          </button>
        </div>
        {isSignedIn && (freeAvail || bonus > 0) && (
          <div className="text-center mt-2 text-white/90 text-sm" data-testid="lottery-free-badge">
            🎁 {bonus > 0 ? tr("你有 {0} 次分享免費抽獎機會！", bonus) : tr("今日有 1 次免費抽獎機會！")}
          </div>
        )}

        {/* History */}
        {isSignedIn && (
          <div className="mt-8 bg-white/95 rounded-2xl p-4" data-testid="lottery-history">
            <h2 className="font-head font-bold text-slate-800 mb-3 flex items-center gap-1.5"><Gift className="h-4 w-4 text-orange-500" />{tr("我的中獎記錄")}</h2>
            {history.length === 0 ? <p className="text-sm text-slate-400 py-3 text-center">{tr("還沒有抽獎記錄，快來試試手氣吧！")}</p> : (
              <div className="divide-y divide-slate-100">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2 text-sm" data-testid={`lottery-hist-${h.id}`}>
                    <span className="text-slate-700 font-medium">{h.prize_label}</span>
                    <span className="text-xs text-slate-400">{(h.created_at || "").slice(0, 16).replace("T", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setResult(null)} data-testid="lottery-result">
          <div className="bg-white rounded-3xl p-7 max-w-xs w-full text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {result.count > 1 ? (
              <>
                <div className="text-5xl mb-2">🎉</div>
                <div className="font-head text-xl font-extrabold text-slate-900">{tr("連抽 {0} 次結果", result.count)}</div>
                <div className="mt-3 max-h-56 overflow-y-auto divide-y divide-slate-100 text-left">
                  {result.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-500">{i + 1}</span><span className={`font-semibold ${r.prize_type === "none" ? "text-slate-400" : "text-orange-600"}`}>{r.prize_label}</span></div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">{result.prize_type === "none" ? "🙏" : "🎉"}</div>
                <div className="font-head text-xl font-extrabold text-slate-900">{result.prize_type === "none" ? tr("謝謝惠顧") : tr("恭喜中獎！")}</div>
                <div className="mt-2 text-lg font-bold text-orange-600">{result.prize_label}</div>
                {result.prize_type === "physical" && <div className="text-xs text-slate-500 mt-2">{tr("實物獎品將由客服聯繫您發放")}</div>}
                {result.prize_type === "coupon" && <div className="text-xs text-slate-500 mt-2">{tr("優惠券已發放至「我的優惠券」")}</div>}
                {(result.prize_type === "points" || result.prize_type === "balance") && <div className="text-xs text-slate-500 mt-2">{tr("獎勵已自動到帳")}</div>}
              </>
            )}
            <button data-testid="lottery-result-close" onClick={() => setResult(null)} className="mt-5 h-11 w-full rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600">{tr("知道了")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
