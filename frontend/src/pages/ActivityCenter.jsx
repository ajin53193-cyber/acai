import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Zap, Gift, Percent, Users, Wallet, ArrowLeft, Coins, Loader2, UserPlus, Trophy, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { tr } from "@/i18n";

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
const endOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(); };
function useLeft(end) {
  const [left, setLeft] = useState(() => (end ? Math.max(0, new Date(end).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!end) return undefined;
    setLeft(Math.max(0, new Date(end).getTime() - Date.now()));
    const t = setInterval(() => setLeft(Math.max(0, new Date(end).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [end]);
  const s = Math.floor(left / 1000);
  return { left, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/* ---------- section title: Chinese + small uppercase English caption ---------- */
const Title = ({ en, children, right, testId }) => (
  <div className="flex items-end justify-between mb-3" data-testid={testId}>
    <div><div className="text-[10px] font-bold tracking-[0.18em] text-orange-400 uppercase">{en}</div><h2 className="font-head text-lg md:text-xl font-extrabold text-slate-900 leading-tight">{children}</h2></div>
    {right}
  </div>
);
const Tag = ({ children }) => <span className="absolute top-0 right-0 z-10 text-[9px] font-bold bg-rose-500 text-white rounded-bl-lg rounded-tr-xl px-1.5 py-0.5">{children}</span>;
const Empty = ({ children }) => <div className="rounded-xl bg-white/70 border border-dashed border-orange-200 p-4 text-center text-xs text-slate-400">{children}</div>;

/* ---------- HERO ---------- */
function Hero({ cfg, end, maxPct }) {
  const t = useLeft(end);
  const Box = ({ v, l }) => <div className="flex flex-col items-center"><span className="min-w-[46px] h-12 md:min-w-[56px] md:h-14 rounded-xl bg-white text-slate-900 font-head font-extrabold text-2xl md:text-3xl flex items-center justify-center shadow-md">{pad(v)}</span><span className="text-[11px] text-white/90 mt-1">{l}</span></div>;
  const Colon = () => <span className="text-white font-extrabold text-2xl mt-2.5">:</span>;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-orange-400 px-5 md:px-8 pt-5 pb-7 md:pb-9 text-white shadow-lg" data-testid="ac-hero">
      <Gift className="absolute right-10 top-8 h-10 w-10 text-white/35 rotate-12" /><Zap className="absolute left-8 bottom-20 h-9 w-9 text-amber-200/70 -rotate-12" /><PartyPopper className="absolute right-6 bottom-10 h-9 w-9 text-amber-200/60" />
      {[["10%", "18%", "rotate-45", "bg-rose-400"], ["85%", "12%", "-rotate-12", "bg-amber-300"], ["78%", "70%", "rotate-12", "bg-pink-300"], ["18%", "82%", "rotate-45", "bg-yellow-300"], ["50%", "8%", "-rotate-45", "bg-rose-300"]].map(([l, tp, r, bg], i) => <span key={i} className={`absolute h-2 w-5 rounded-sm ${bg} ${r} opacity-80`} style={{ left: l, top: tp }} />)}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="font-head font-extrabold text-xl tracking-tight">gogo589</span>
          <Link to="/" data-testid="activity-center-back" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回首頁")}</Link>
        </div>
        <h1 className="font-head text-3xl md:text-5xl font-extrabold drop-shadow mt-5 text-center tracking-wide">{cfg.header_title || tr("活動中心")}</h1>
        <p className="text-white/95 text-base md:text-xl mt-3 text-center font-semibold">{tr("最高立省")} <span className="text-amber-300 font-head font-extrabold text-2xl md:text-3xl">{maxPct}%</span></p>
        {cfg.header_subtitle && <p className="text-white/85 text-xs md:text-sm mt-1 text-center">{cfg.header_subtitle}</p>}
        <div className="mt-5 flex flex-col items-center" data-testid="ac-hero-countdown">
          <div className="text-xs text-white/90 mb-2">{tr("活動倒計時")}</div>
          <div className="flex items-start gap-2"><Box v={t.d} l={tr("天")} /><Colon /><Box v={t.h} l={tr("小時")} /><Colon /><Box v={t.m} l={tr("分鐘")} /><Colon /><Box v={t.s} l={tr("秒")} /></div>
        </div>
      </div>
    </div>
  );
}

/* ---------- COUPON WALL ---------- */
function CouponWall({ promos, claimed, onClaim, busy }) {
  const { format } = useCurrency();
  return (
    <section className="mt-6" data-testid="ac-coupon-wall">
      <Title en="Coupon Wall">{tr("優惠券專區")}</Title>
      {promos.length === 0 ? <Empty>{tr("暫無可領取優惠券")}</Empty> : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {promos.map((p) => {
            const got = claimed.includes(p.code);
            const main = p.discount_type === "percent" ? `${Number(p.value)}%` : format(p.value);
            const sub = p.min_order_usd > 0 ? tr("滿 {0} 可用", format(p.min_order_usd)) : tr("無門檻 · 全站通用");
            return (
              <div key={p.code} data-testid={`ac-coupon-${p.code}`} className={`snap-start shrink-0 w-[210px] md:w-[230px] relative flex rounded-2xl overflow-hidden shadow-sm ${got ? "bg-slate-50 border border-slate-200" : "bg-white border border-orange-200"}`}>
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-baseline gap-1"><span className={`font-head text-2xl font-extrabold ${got ? "text-slate-400" : "text-rose-600"}`}>{main}</span><span className={`text-sm font-bold ${got ? "text-slate-400" : "text-slate-800"}`}>{tr("優惠券")}</span></div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>
                  {got
                    ? <span className="mt-2 inline-block h-7 px-3 leading-7 rounded-full bg-slate-200 text-slate-400 text-[11px] font-bold">{tr("已領取")}</span>
                    : <button data-testid={`ac-coupon-claim-${p.code}`} disabled={busy === p.code} onClick={() => onClaim(p.code)} className="mt-2 h-7 px-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-bold shadow hover:shadow-md disabled:opacity-60 inline-flex items-center">{busy === p.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tr("立即領取")}</button>}
                </div>
                <div className={`relative w-9 shrink-0 border-l border-dashed flex items-center justify-center ${got ? "border-slate-300 bg-slate-100" : "border-orange-200 bg-gradient-to-b from-rose-500 to-orange-500"}`}>
                  <span className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-[#FFF7ED]" /><span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-[#FFF7ED]" />
                  <span className={`text-[11px] font-bold tracking-widest ${got ? "text-slate-400" : "text-white"}`} style={{ writingMode: "vertical-rl" }}>{got ? tr("已領取") : tr("領券")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- LUCKY WHEEL ---------- */
function WheelCard({ lottery, status, winners, signedIn }) {
  const prizes = lottery?.prizes || [];
  const seg = 360 / (prizes.length || 1);
  const grad = prizes.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");
  const remain = status ? (status.daily_free_available ? 1 : 0) + (status.bonus_draws || 0) : null;
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (winners.length < 2) return undefined; const t = setInterval(() => setIdx((i) => (i + 1) % winners.length), 2500); return () => clearInterval(t); }, [winners.length]);
  const w = winners[idx];
  return (
    <section data-testid="ac-wheel">
      <Title en="Lucky Wheel">{tr("幸運大轉盤")}</Title>
      <Link to="/lottery" data-testid="ac-wheel-link" className="block rounded-2xl bg-white border border-orange-100 shadow-sm p-4 hover:shadow-md transition-shadow relative overflow-hidden">
        {remain !== null && <span className="absolute top-3 right-3 text-[11px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5" data-testid="ac-wheel-remaining">{tr("剩餘次數 {0}", remain)}</span>}
        {!signedIn && <span className="absolute top-3 right-3 text-[11px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{lottery?.free_daily ? tr("每日免費 1 次") : tr("{0} 積分/次", lottery?.cost_points || 0)}</span>}
        <div className="flex flex-col items-center pt-3">
          <div className="relative h-44 w-44 md:h-48 md:w-48">
            <div className="h-full w-full rounded-full border-[6px] border-orange-400 shadow-[0_8px_24px_rgba(249,115,22,0.35)]" style={{ background: prizes.length ? `conic-gradient(${grad})` : "#fed7aa" }} />
            {prizes.map((p, i) => <span key={p.id} className="absolute left-1/2 top-1/2 text-[9px] font-bold text-slate-800/80 whitespace-nowrap" style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-62px) rotate(-${i * seg + seg / 2}deg) translate(-50%,-50%)` }}>{p.label.length > 6 ? p.label.slice(0, 6) + "…" : p.label}</span>)}
            <span className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-white text-xs font-extrabold flex items-center justify-center text-center leading-tight shadow-lg ring-4 ring-white">{tr("立即")}<br />{tr("抽獎")}</span>
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-0 w-0 border-l-[9px] border-r-[9px] border-t-[16px] border-l-transparent border-r-transparent border-t-rose-600 drop-shadow" />
            {Array.from({ length: 12 }).map((_, i) => <span key={i} className="absolute h-2 w-2 rounded-full bg-amber-200 shadow" style={{ left: `calc(50% + ${Math.cos((i / 12) * Math.PI * 2) * 86}px - 4px)`, top: `calc(50% + ${Math.sin((i / 12) * Math.PI * 2) * 86}px - 4px)` }} />)}
          </div>
          <div className="w-28 h-4 -mt-1 rounded-b-xl bg-gradient-to-b from-orange-400 to-orange-600" /><div className="w-44 h-3 rounded-full bg-orange-300/70" />
          <div className="mt-3 w-full rounded-xl bg-orange-50 border border-orange-100 px-3 py-2 text-xs text-slate-700 text-center truncate" data-testid="ac-wheel-winner">
            {w ? <><Trophy className="inline h-3.5 w-3.5 text-amber-500 -mt-0.5 mr-1" />{tr("恭喜用戶 {0} 抽中 {1}", w.account, w.prize)}</> : <>{tr("積分換好禮，100% 有獎")}</>}
          </div>
        </div>
      </Link>
    </section>
  );
}

/* ---------- INVITE (poster + steps + progress) ---------- */
function InvitePoster({ pub, info }) {
  const ms = [...(pub?.milestones || [])].sort((a, b) => a.count - b.count);
  const invited = info?.invited || 0;
  const maxC = ms.length ? ms[ms.length - 1].count : 0;
  const pct = maxC ? Math.min(100, Math.round((invited / maxC) * 100)) : 0;
  return (
    <section data-testid="ac-invite">
      <Title en="Invite Friends">{tr("邀請好友")}</Title>
      <Link to="/invite" data-testid="ac-invite-link" className="block rounded-2xl bg-white border border-orange-100 shadow-sm p-4 hover:shadow-md transition-shadow relative overflow-hidden">
        <Tag>{tr("進行中")}</Tag>
        <div className="flex gap-3">
          <div className="h-32 w-24 shrink-0 rounded-xl overflow-hidden shadow bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 text-white flex flex-col items-center justify-center text-center p-2">
            {pub?.poster_image ? <img src={pub.poster_image} alt="" className="h-full w-full object-cover" /> : <><Gift className="h-7 w-7 mb-1" /><div className="font-head font-extrabold text-sm leading-tight">{tr("邀請好友")}</div><div className="text-[10px] text-white/90">{tr("得豪禮")}</div></>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head font-extrabold text-slate-900">{pub?.poster_title || tr("邀請好友 得豪禮")}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{pub?.referrer_points ? tr("好友首充後你得 {0} 積分，好友得 {1} 積分", pub.referrer_points, pub.referee_points) : tr("分享專屬邀請碼，好友下單你得獎勵")}</div>
            <div className="mt-2 flex items-end gap-1.5 h-16">
              {(ms.length ? ms.slice(0, 3) : [{ count: 1 }, { count: 2 }, { count: 3 }]).map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end">
                  <Gift className="h-4 w-4 text-rose-500 mb-0.5" />
                  <div className="w-full rounded-t-md bg-gradient-to-t from-orange-200 to-orange-50 border border-orange-100 text-[9px] text-orange-700 font-bold text-center" style={{ height: `${24 + i * 12}px` }}>{m.count}{tr("人")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-orange-50 border border-orange-100 p-3" data-testid="ac-invite-progress">
          <div className="flex items-center justify-between text-xs"><span className="font-bold text-slate-800">{tr("邀請進度")}</span><span className="text-slate-500 inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-orange-500" />{tr("已邀請 {0} 人", invited)}</span></div>
          <div className="mt-2 h-2.5 rounded-full bg-white overflow-hidden border border-orange-100"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${Math.max(3, pct)}%` }} /></div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0</span>{ms.slice(0, 4).map((m) => <span key={m.count}>{m.count}{tr("人")}·{m.type === "points" ? `${m.value}${tr("分")}` : tr("券")}</span>)}</div>
        </div>
      </Link>
    </section>
  );
}

/* ---------- INVITE (milestone chart, right column) ---------- */
function InviteChart({ pub, info }) {
  const ms = [...(pub?.milestones || [])].sort((a, b) => a.count - b.count).slice(0, 3);
  const invited = info?.invited || 0;
  const maxC = ms.length ? ms[ms.length - 1].count : 1;
  const pct = Math.min(100, Math.round((invited / maxC) * 100));
  return (
    <section data-testid="ac-invite-chart">
      <Title en="Invite Friends">{tr("邀請有禮")}</Title>
      <Link to="/invite" data-testid="ac-invite-chart-link" className="block rounded-2xl bg-white border border-orange-100 shadow-sm p-4 hover:shadow-md transition-shadow relative overflow-hidden">
        <Tag>{tr("進行中")}</Tag>
        <div className="flex gap-3">
          <div className="h-24 w-20 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-rose-500 to-orange-400 text-white flex flex-col items-center justify-center text-center p-1.5">
            {pub?.poster_image ? <img src={pub.poster_image} alt="" className="h-full w-full object-cover" /> : <><UserPlus className="h-6 w-6 mb-1" /><div className="font-head font-extrabold text-[12px] leading-tight">{tr("邀請好友")}</div><div className="text-[10px]">{tr("得豪禮")}</div></>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head font-extrabold text-slate-900 text-sm">{tr("邀請好友 得豪禮")}</div>
            <div className="relative mt-2 h-16 rounded-lg bg-orange-50 border border-orange-100 overflow-hidden">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><polyline points="4,34 36,26 68,16 96,6" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" /></svg>
              {ms.map((m, i) => { const x = [36, 68, 96][i]; const y = [26, 16, 6][i]; return <span key={m.count} className="absolute -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-amber-400 text-[8px] text-white font-bold flex items-center justify-center ring-2 ring-white shadow" style={{ left: `${x}%`, top: `${y * 2.5}%` }}><Coins className="h-3 w-3" /></span>; })}
              <div className="absolute inset-x-0 bottom-0 flex justify-between px-2 text-[9px] text-slate-500">{ms.map((m) => <span key={m.count}>{m.type === "points" ? `${m.value}${tr("分")}` : tr("券")}</span>)}</div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span className="shrink-0">{tr("好友首充完成進度")}</span><div className="flex-1 h-1.5 rounded-full bg-orange-100 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${Math.max(4, pct)}%` }} /></div></div>
          </div>
        </div>
      </Link>
    </section>
  );
}

/* ---------- RECHARGE BONUS ---------- */
function RechargeBonus({ rows }) {
  const { format } = useCurrency();
  const val = (r) => r.bonus_type === "fixed_usd" ? format(r.bonus_value) : r.bonus_type === "percent" ? `${r.bonus_value}%` : `${r.bonus_value}${tr("積分")}`;
  return (
    <section data-testid="ac-recharge">
      <Title en="Recharge Bonus">{tr("充值有禮")}</Title>
      {rows.length === 0 ? <Empty>{tr("充值活動敬請期待")}</Empty> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
          {rows.map((r, i) => (
            <Link key={r.id} to="/account/wallet/topup" data-testid={`ac-recharge-${i}`} className={`rounded-xl p-2.5 border shadow-sm hover:shadow-md transition-shadow text-center ${i === rows.length - 1 ? "bg-gradient-to-br from-amber-100 to-orange-100 border-orange-200" : "bg-white border-orange-100"}`}>
              <div className="font-head font-extrabold text-slate-900 text-[13px] leading-tight">{tr("充")}{format(r.min_usd)}<br /><span className="text-rose-600">{tr("送")}{val(r)}</span></div>
              <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-center gap-1"><Wallet className="h-3 w-3 text-amber-500" />{r.bonus_type === "points" ? tr("積分券") : tr("錢包券")}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- FLASH SALE ---------- */
function FlashCountdown({ end }) {
  const t = useLeft(end);
  if (!end) return null;
  const B = ({ v }) => <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded bg-rose-500 text-white text-[11px] font-bold px-1 font-mono">{pad(v)}</span>;
  return <span className="inline-flex items-center gap-0.5 text-rose-500 font-bold text-xs" data-testid="ac-flash-countdown">{t.d > 0 && <><B v={t.d} />:</>}<B v={t.h} />:<B v={t.m} />:<B v={t.s} /></span>;
}
function FlashSale({ items }) {
  const { format } = useCurrency();
  const end = items.map((i) => i.end_at).filter(Boolean).sort()[0];
  return (
    <section data-testid="ac-flash">
      <Title en="Flash Sale" right={<FlashCountdown end={end} />}>{tr("限時秒殺")}</Title>
      {items.length === 0 ? <Empty>{tr("暫無進行中的秒殺，敬請期待")}</Empty> : (
        <div className="grid grid-cols-3 gap-2">
          {items.slice(0, 6).map((f) => {
            const pct = f.stock > 0 ? Math.min(100, Math.round((f.sold / f.stock) * 100)) : 0;
            const out = f.remaining <= 0;
            return (
              <Link key={f.id} to={`/product/${f.product_id}`} data-testid={`ac-flash-${f.id}`} className="bg-white rounded-xl border border-rose-100 shadow-sm p-2 hover:shadow-md transition-shadow relative overflow-hidden">
                <Tag>{out ? tr("已搶光") : tr("進行中")}</Tag>
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-50 mt-2"><img src={f.image} alt={f.product_name} className="h-full w-full object-cover" /></div>
                <div className="text-[10px] text-slate-400 mt-1.5">{tr("原價")} <s>{format(f.original_price_usd)}</s></div>
                <div className="text-rose-600 font-head font-extrabold text-sm leading-tight"><span className="text-[10px] font-normal">{tr("秒價")} </span>{format(f.flash_price_usd)}</div>
                <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden mt-1"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${Math.max(6, pct)}%` }} /></div>
                <div className="text-[10px] text-slate-500 mt-0.5">{tr("已搶 {0}%", pct)}</div>
                <span className="mt-1.5 block text-center h-7 leading-7 rounded-full bg-rose-500 text-white text-[11px] font-bold">{tr("立即搶購")}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- VALUE BUNDLES + 滿減 ---------- */
function Bundles({ combos, cartpromo, onBuy }) {
  const { format } = useCurrency();
  const live = combos.filter((c) => !c.status || c.status === "active");
  const rule = (c) => c.promo_type === "reduce" ? tr("滿{0}減{1}", format(c.threshold_usd), format(c.value)) : tr("滿{0}打{1}折", format(c.threshold_usd), (10 - c.value / 10).toFixed(1));
  return (
    <section data-testid="ac-bundles">
      <Title en="Value Bundles">{tr("超值套餐 + 滿減")}</Title>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {live.slice(0, 3).map((c) => (
            <div key={c.id} data-testid={`ac-combo-${c.id}`} className="rounded-xl bg-white border border-orange-100 shadow-sm p-2.5 relative overflow-hidden">
              <Tag>{tr("進行中")}</Tag>
              <div className="font-head font-extrabold text-slate-900 text-[13px] truncate pr-10">{c.title}</div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.items.map((i) => `${i.product_name}×${i.quantity}`).join("、")}</div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="leading-tight"><span className="text-rose-600 font-head font-extrabold text-sm">{format(c.price_usd)}</span><br /><span className="text-[10px] text-slate-400 line-through">{format(c.original_total_usd)}</span></div>
                <button data-testid={`ac-combo-buy-${c.id}`} onClick={() => onBuy(c)} className="h-6 px-2 rounded-full bg-rose-500 text-white text-[10px] font-bold">{tr("立即搶購")}</button>
              </div>
            </div>
          ))}
          {!live.length && <Empty>{tr("套餐敬請期待")}</Empty>}
        </div>
        <div className="space-y-2">
          {cartpromo.slice(0, 3).map((c, i) => (
            <Link key={c.id} to="/" data-testid={`ac-cartpromo-${i}`} className="flex items-center gap-2.5 rounded-xl bg-white border border-orange-100 shadow-sm p-2.5 hover:shadow-md transition-shadow min-h-[64px]">
              <span className="h-9 w-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0"><Percent className="h-4 w-4" /></span>
              <div className="min-w-0"><div className="font-head font-extrabold text-slate-900 text-[13px] leading-tight">{rule(c)}</div><div className="text-[10px] text-slate-500 truncate">{c.title || tr("下單滿額自動立減")}</div></div>
            </Link>
          ))}
          {!cartpromo.length && <Empty>{tr("滿減敬請期待")}</Empty>}
        </div>
      </div>
    </section>
  );
}

export default function ActivityCenter() {
  const callApi = useApi();
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuthModal();
  const { addCombo } = useCart();
  const [cfg, setCfg] = useState({ header_title: tr("活動中心"), header_subtitle: "" });
  const [data, setData] = useState({ flash: [], combos: [], recharge: [], cartpromo: [], lottery: null, promos: [], winners: [], refPub: null });
  const [claimed, setClaimed] = useState([]);
  const [refInfo, setRefInfo] = useState(null);
  const [lotStatus, setLotStatus] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    publicApi.get("/activity-center").then((r) => setCfg(r.data)).catch(() => {});
    const g = (u, d) => publicApi.get(u).then((r) => r.data).catch(() => d);
    Promise.all([g("/flash-sales/public", []), g("/combos/public", []), g("/recharge-bonus/public", []), g("/cart-promotions/public", []), g("/lottery/config", null), g("/promos/public", []), g("/lottery/recent-winners", []), g("/referral/public", null)])
      .then(([flash, combos, recharge, cartpromo, lottery, promos, winners, refPub]) => setData({ flash, combos, recharge, cartpromo, lottery, promos, winners, refPub }));
  }, []);
  useEffect(() => {
    if (!isSignedIn) { setClaimed([]); setRefInfo(null); setLotStatus(null); return; }
    callApi({ method: "GET", url: "/me/coupons" }).then((r) => setClaimed((r.data || []).map((c) => c.code))).catch(() => {});
    callApi({ method: "GET", url: "/me/referral" }).then((r) => setRefInfo(r.data)).catch(() => {});
    callApi({ method: "GET", url: "/lottery/my-status" }).then((r) => setLotStatus(r.data)).catch(() => {});
  }, [isSignedIn, callApi]);

  const claim = async (code) => {
    if (!isSignedIn) return openAuth();
    setBusy(code);
    try { await callApi({ method: "POST", url: "/me/coupons/redeem", data: { code } }); setClaimed((c) => [...c, code]); toast.success(tr("領取成功，已放入我的優惠券")); }
    catch (e) { if (e.response?.status === 409) setClaimed((c) => [...c, code]); toast.error(e.response?.data?.detail || tr("領取失敗")); }
    setBusy("");
  };
  const buyCombo = (c) => { addCombo(c); navigate("/checkout"); };

  const timed = [...data.flash.map((f) => f.end_at), ...data.combos.filter((c) => !c.status || c.status === "active").map((c) => c.end_at), ...data.cartpromo.map((c) => c.end_at)].filter((e) => e && new Date(e).getTime() > Date.now()).sort();
  const heroEnd = timed[0] || endOfMonth();
  const pcts = [...data.promos.filter((p) => p.discount_type === "percent").map((p) => Number(p.value)), ...data.recharge.filter((r) => r.bonus_type === "percent").map((r) => Number(r.bonus_value)), ...data.recharge.filter((r) => r.bonus_type === "fixed_usd" && r.min_usd > 0).map((r) => Math.round((r.bonus_value / r.min_usd) * 100))];
  const maxPct = pcts.length ? Math.max(...pcts) : 9;

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 md:py-8" data-testid="activity-center">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 md:gap-6 items-start">
        <div className="min-w-0">
          <Hero cfg={cfg} end={heroEnd} maxPct={maxPct} />
          <CouponWall promos={data.promos} claimed={claimed} onClaim={claim} busy={busy} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
            <WheelCard lottery={data.lottery} status={lotStatus} winners={data.winners} signedIn={isSignedIn} />
            <InvitePoster pub={data.refPub} info={refInfo} />
          </div>
        </div>
        <div className="space-y-6">
          <InviteChart pub={data.refPub} info={refInfo} />
          <RechargeBonus rows={data.recharge} />
          <FlashSale items={data.flash} />
          <Bundles combos={data.combos} cartpromo={data.cartpromo} onBuy={buyCombo} />
        </div>
      </div>
    </div>
  );
}
