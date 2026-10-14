import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Zap, Gift, Package, Percent, Users, Wallet, Sparkles, ChevronRight, ArrowLeft, Ticket, Coins, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { tr } from "@/i18n";

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
function useLeft(end) {
  const [left, setLeft] = useState(() => (end ? Math.max(0, new Date(end).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!end) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, new Date(end).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [end]);
  const s = Math.floor(left / 1000);
  return { left, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function HeroCountdown({ end }) {
  const t = useLeft(end);
  if (!end || t.left <= 0) return null;
  const Box = ({ v, l }) => <div className="flex flex-col items-center"><span className="min-w-[44px] h-11 md:min-w-[52px] md:h-12 rounded-xl bg-white text-orange-600 font-head font-extrabold text-xl md:text-2xl flex items-center justify-center shadow">{pad(v)}</span><span className="text-[10px] md:text-xs text-white/85 mt-1">{l}</span></div>;
  return (
    <div className="mt-4 md:mt-5" data-testid="ac-hero-countdown">
      <div className="text-xs text-white/85 mb-1.5">{tr("距活動結束")}</div>
      <div className="flex items-start gap-1.5 md:gap-2 text-white font-extrabold text-xl">
        {t.d > 0 && <><Box v={t.d} l={tr("天")} /><span className="mt-2.5">:</span></>}
        <Box v={t.h} l={tr("小時")} /><span className="mt-2.5">:</span><Box v={t.m} l={tr("分鐘")} /><span className="mt-2.5">:</span><Box v={t.s} l={tr("秒")} />
      </div>
    </div>
  );
}

function MiniCountdown({ end }) {
  const t = useLeft(end);
  if (!end) return null;
  if (t.left <= 0) return <span className="text-xs text-rose-600 font-bold">{tr("已結束")}</span>;
  const B = ({ v }) => <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded bg-rose-500 text-white text-[11px] font-bold px-1 font-mono">{pad(v)}</span>;
  return <span className="inline-flex items-center gap-0.5 text-rose-500 font-bold text-xs" data-testid="ac-flash-countdown">{t.d > 0 && <><B v={t.d} />:</>}<B v={t.h} />:<B v={t.m} />:<B v={t.s} /></span>;
}

const Title = ({ icon: Icon, children, right, testId }) => (
  <div className="flex items-center justify-between mb-3" data-testid={testId}>
    <h2 className="font-head text-base md:text-lg font-extrabold text-slate-900 flex items-center gap-2"><Icon className="h-5 w-5 text-orange-500" />{children}</h2>
    {right}
  </div>
);
const More = ({ to, testId }) => <Link to={to} data-testid={testId} className="text-xs text-orange-500 font-semibold inline-flex items-center gap-0.5">{tr("更多")}<ChevronRight className="h-3.5 w-3.5" /></Link>;

function CouponWall({ promos, claimed, onClaim, busy }) {
  const { format } = useCurrency();
  if (!promos.length) return null;
  return (
    <section className="mt-5 md:mt-6" data-testid="ac-coupon-wall">
      <Title icon={Ticket}>{tr("優惠券專區")}</Title>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {promos.map((p) => {
          const got = claimed.includes(p.code);
          const main = p.discount_type === "percent" ? `${Number(p.value)}%` : format(p.value);
          const sub = p.min_order_usd > 0 ? tr("滿 {0} 可用", format(p.min_order_usd)) : tr("無門檻使用");
          return (
            <div key={p.code} data-testid={`ac-coupon-${p.code}`} className="relative flex rounded-2xl overflow-hidden bg-white border border-orange-100 shadow-sm">
              <div className="flex-1 p-3 md:p-3.5 min-w-0">
                <div className="flex items-baseline gap-1"><span className="font-head text-2xl font-extrabold text-rose-600">{main}</span><span className="text-sm font-bold text-slate-800">{p.discount_type === "percent" ? tr("折扣券") : tr("現金券")}</span></div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">{p.code}</div>
              </div>
              <div className="relative w-[64px] md:w-[72px] shrink-0 border-l border-dashed border-orange-200 flex items-center justify-center">
                <span className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-[#FFF7ED]" /><span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-[#FFF7ED]" />
                {got
                  ? <span className="text-[11px] font-bold text-slate-400 flex flex-col items-center gap-0.5"><Check className="h-4 w-4" />{tr("已領取")}</span>
                  : <button data-testid={`ac-coupon-claim-${p.code}`} disabled={busy === p.code} onClick={() => onClaim(p.code)} className="h-8 px-2.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-bold shadow hover:shadow-md disabled:opacity-60">{busy === p.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tr("立即領取")}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WheelCard({ lottery }) {
  const prizes = lottery?.prizes || [];
  const seg = 360 / (prizes.length || 1);
  const grad = prizes.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");
  return (
    <section data-testid="ac-wheel">
      <Title icon={Gift}>{tr("幸運大轉盤")}</Title>
      <Link to="/lottery" data-testid="ac-wheel-link" className="block rounded-2xl bg-white border border-orange-100 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 md:h-32 md:w-32 shrink-0">
            <div className="h-full w-full rounded-full border-4 border-orange-400 shadow-inner" style={{ background: prizes.length ? `conic-gradient(${grad})` : "#fed7aa" }} />
            <span className="absolute inset-0 m-auto h-11 w-11 rounded-full bg-orange-500 text-white text-[11px] font-extrabold flex items-center justify-center text-center leading-tight shadow">{tr("抽獎")}</span>
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-0 w-0 border-l-[7px] border-r-[7px] border-t-[12px] border-l-transparent border-r-transparent border-t-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head font-extrabold text-slate-900">{tr("積分換好禮，100% 有獎")}</div>
            <div className="text-xs text-slate-500 mt-1">{lottery?.free_daily ? tr("每日 1 次免費抽獎") : tr("每次 {0} 積分", lottery?.cost_points || 0)}{prizes.length ? ` · ${tr("{0} 種獎品", prizes.length)}` : ""}</div>
            <div className="flex flex-wrap gap-1 mt-2">{prizes.slice(0, 4).map((p) => <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">{p.label}</span>)}</div>
            <span className="inline-flex items-center gap-1 mt-3 h-8 px-4 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-bold shadow">{tr("立即抽獎")}<ChevronRight className="h-3.5 w-3.5" /></span>
          </div>
        </div>
      </Link>
    </section>
  );
}

function InviteCard({ info }) {
  const ms = [...(info?.milestones || [])].sort((a, b) => a.count - b.count);
  const invited = info?.invited || 0;
  const maxC = ms.length ? ms[ms.length - 1].count : 0;
  const pct = maxC ? Math.min(100, Math.round((invited / maxC) * 100)) : 0;
  return (
    <section data-testid="ac-invite">
      <Title icon={Users}>{tr("邀請好友")}</Title>
      <Link to="/invite" data-testid="ac-invite-link" className="block rounded-2xl bg-white border border-orange-100 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex gap-3">
          <div className="h-24 w-20 shrink-0 rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 text-white p-2 flex flex-col items-center justify-center text-center shadow">
            <Gift className="h-6 w-6 mb-1" /><div className="font-head font-extrabold text-sm leading-tight">{tr("邀請好友")}</div><div className="text-[10px] text-white/90">{tr("得豪禮")}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head font-extrabold text-slate-900">{tr("邀請得積分，雙方受益")}</div>
            <div className="text-xs text-slate-500 mt-1">{info?.referrer_points ? tr("每邀請 1 位好友首充，得 {0} 積分", info.referrer_points) : tr("分享專屬邀請碼，好友下單你得獎勵")}</div>
            {ms.length > 0 && (
              <div className="mt-2.5">
                <div className="h-2 rounded-full bg-orange-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${Math.max(4, pct)}%` }} /></div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">{ms.slice(0, 4).map((m) => <span key={m.count}>{m.count}{tr("人")}·{m.points}{tr("分")}</span>)}</div>
                <div className="text-[11px] text-slate-500 mt-1">{tr("已邀請 {0} 位好友", invited)}</div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </section>
  );
}

function RechargeBonus({ rows }) {
  const { format } = useCurrency();
  if (!rows.length) return null;
  const val = (r) => r.bonus_type === "fixed_usd" ? tr("送 {0}", format(r.bonus_value)) : r.bonus_type === "percent" ? tr("送 {0}%", r.bonus_value) : tr("送 {0} 積分", r.bonus_value);
  return (
    <section data-testid="ac-recharge">
      <Title icon={Wallet} right={<More to="/account/wallet/topup" testId="ac-recharge-more" />}>{tr("充值有禮")}</Title>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((r, i) => (
          <Link key={r.id} to="/account/wallet/topup" data-testid={`ac-recharge-${i}`} className={`rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow ${i === rows.length - 1 ? "bg-gradient-to-br from-amber-100 to-orange-100 border-orange-200" : "bg-white border-orange-100"}`}>
            <div className="font-head font-extrabold text-slate-900 text-sm leading-tight">{tr("充 {0}", format(r.min_usd))}<span className="text-rose-600"> {val(r)}</span></div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Coins className="h-3 w-3 text-amber-500" />{r.bonus_type === "points" ? tr("積分券") : tr("錢包券")}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FlashSale({ items }) {
  const { format } = useCurrency();
  if (!items.length) return null;
  const end = items.map((i) => i.end_at).filter(Boolean).sort()[0];
  return (
    <section data-testid="ac-flash">
      <Title icon={Zap} right={<MiniCountdown end={end} />}>{tr("限時秒殺")}</Title>
      <div className="grid grid-cols-3 gap-2.5">
        {items.slice(0, 6).map((f) => {
          const pct = f.stock > 0 ? Math.min(100, Math.round((f.sold / f.stock) * 100)) : 0;
          const out = f.remaining <= 0;
          return (
            <Link key={f.id} to={`/product/${f.product_id}`} data-testid={`ac-flash-${f.id}`} className="bg-white rounded-xl border border-rose-100 shadow-sm p-2 hover:shadow-md transition-shadow relative">
              <span className="absolute top-1.5 right-1.5 z-10 text-[9px] font-bold bg-rose-500 text-white rounded px-1 py-0.5">{out ? tr("已搶光") : tr("進行中")}</span>
              <div className="aspect-square rounded-lg overflow-hidden bg-slate-50"><img src={f.image} alt={f.product_name} className="h-full w-full object-cover" /></div>
              <div className="text-[11px] text-slate-700 truncate mt-1.5">{f.product_name}</div>
              <div className="text-[10px] text-slate-400 line-through">{tr("原價")} {format(f.original_price_usd)}</div>
              <div className="text-rose-600 font-head font-extrabold text-sm">{format(f.flash_price_usd)}</div>
              <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden mt-1"><div className="h-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${Math.max(6, pct)}%` }} /></div>
              <div className="text-[10px] text-slate-500 mt-0.5">{tr("已搶 {0}%", pct)}</div>
              <span className="mt-1.5 block text-center h-7 leading-7 rounded-full bg-rose-500 text-white text-[11px] font-bold">{tr("立即搶購")}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Bundles({ combos, cartpromo, onBuy }) {
  const { format } = useCurrency();
  const live = combos.filter((c) => !c.status || c.status === "active");
  if (!live.length && !cartpromo.length) return null;
  const rule = (c) => c.promo_type === "reduce" ? tr("滿 {0} 減 {1}", format(c.threshold_usd), format(c.value)) : tr("滿 {0} 打 {1} 折", format(c.threshold_usd), (10 - c.value / 10).toFixed(1));
  return (
    <section data-testid="ac-bundles">
      <Title icon={Package}>{tr("超值套餐 + 滿減")}</Title>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-2.5">
          {live.slice(0, 3).map((c) => (
            <div key={c.id} data-testid={`ac-combo-${c.id}`} className="rounded-xl bg-white border border-orange-100 shadow-sm p-3 relative">
              <span className="absolute top-0 right-0 text-[9px] font-bold bg-rose-500 text-white rounded-bl-lg px-1.5 py-0.5">{tr("立省 {0}", format(Math.max(0, c.original_total_usd - c.price_usd)))}</span>
              <div className="font-head font-extrabold text-slate-900 text-sm truncate pr-14">{c.title}</div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.items.map((i) => `${i.product_name}×${i.quantity}`).join("、")}</div>
              <div className="flex items-center justify-between mt-2">
                <div><span className="text-rose-600 font-head font-extrabold">{format(c.price_usd)}</span> <span className="text-[10px] text-slate-400 line-through">{format(c.original_total_usd)}</span></div>
                <button data-testid={`ac-combo-buy-${c.id}`} onClick={() => onBuy(c)} className="h-7 px-2.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">{tr("立即搶購")}</button>
              </div>
            </div>
          ))}
          {!live.length && <div className="rounded-xl bg-white border border-dashed border-orange-200 p-3 text-center text-xs text-slate-400">{tr("套餐敬請期待")}</div>}
        </div>
        <div className="space-y-2.5">
          {cartpromo.slice(0, 3).map((c, i) => (
            <Link key={c.id} to="/" data-testid={`ac-cartpromo-${i}`} className="flex items-center gap-3 rounded-xl bg-white border border-orange-100 shadow-sm p-3 hover:shadow-md transition-shadow">
              <span className="h-10 w-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0"><Percent className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="font-head font-extrabold text-slate-900 text-sm leading-tight">{rule(c)}</div><div className="text-[10px] text-slate-500 truncate">{c.title || tr("下單滿額自動立減")}</div></div>
            </Link>
          ))}
          {!cartpromo.length && <div className="rounded-xl bg-white border border-dashed border-orange-200 p-3 text-center text-xs text-slate-400">{tr("滿減敬請期待")}</div>}
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
  const [data, setData] = useState({ flash: [], combos: [], recharge: [], cartpromo: [], lottery: null, promos: [] });
  const [claimed, setClaimed] = useState([]);
  const [refInfo, setRefInfo] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    publicApi.get("/activity-center").then((r) => setCfg(r.data)).catch(() => {});
    const g = (u, d) => publicApi.get(u).then((r) => r.data).catch(() => d);
    Promise.all([g("/flash-sales/public", []), g("/combos/public", []), g("/recharge-bonus/public", []), g("/cart-promotions/public", []), g("/lottery/config", null), g("/promos/public", [])])
      .then(([flash, combos, recharge, cartpromo, lottery, promos]) => setData({ flash, combos, recharge, cartpromo, lottery, promos }));
  }, []);
  useEffect(() => {
    if (!isSignedIn) { setClaimed([]); setRefInfo(null); return; }
    callApi({ method: "GET", url: "/me/coupons" }).then((r) => setClaimed((r.data || []).map((c) => c.code))).catch(() => {});
    callApi({ method: "GET", url: "/me/referral" }).then((r) => setRefInfo(r.data)).catch(() => {});
  }, [isSignedIn, callApi]);

  const claim = async (code) => {
    if (!isSignedIn) return openAuth();
    setBusy(code);
    try { await callApi({ method: "POST", url: "/me/coupons/redeem", data: { code } }); setClaimed((c) => [...c, code]); toast.success(tr("領取成功，已放入我的優惠券")); }
    catch (e) { const msg = e.response?.data?.detail || tr("領取失敗"); if (e.response?.status === 409) setClaimed((c) => [...c, code]); toast.error(msg); }
    setBusy("");
  };
  const buyCombo = (c) => { addCombo(c); navigate("/checkout"); };

  const heroEnd = [...data.flash.map((f) => f.end_at), ...data.combos.filter((c) => !c.status || c.status === "active").map((c) => c.end_at), ...data.cartpromo.map((c) => c.end_at)].filter((e) => e && new Date(e).getTime() > Date.now()).sort()[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 md:py-8" data-testid="activity-center">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 md:gap-6 items-start">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 px-5 md:px-8 py-6 md:py-8 text-white shadow-lg" data-testid="ac-hero">
            <Sparkles className="absolute -right-6 -top-6 h-40 w-40 text-white/10" /><Gift className="absolute right-8 top-6 h-10 w-10 text-white/30 rotate-12" /><Zap className="absolute left-6 bottom-6 h-9 w-9 text-white/25 -rotate-12" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <Link to="/" data-testid="activity-center-back" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回首頁")}</Link>
                <span className="font-head font-extrabold text-lg tracking-tight">gogo589</span>
              </div>
              <h1 className="font-head text-3xl md:text-5xl font-extrabold drop-shadow mt-5 md:mt-6 text-center">{cfg.header_title || tr("活動中心")}</h1>
              {cfg.header_subtitle && <p className="text-white/90 text-sm md:text-lg mt-2 text-center">{cfg.header_subtitle}</p>}
              <div className="flex justify-center"><HeroCountdown end={heroEnd} /></div>
            </div>
          </div>

          <CouponWall promos={data.promos} claimed={claimed} onClaim={claim} busy={busy} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 md:mt-6">
            <WheelCard lottery={data.lottery} />
            <InviteCard info={refInfo} />
          </div>
        </div>

        <div className="space-y-5 md:space-y-6">
          <RechargeBonus rows={data.recharge} />
          <FlashSale items={data.flash} />
          <Bundles combos={data.combos} cartpromo={data.cartpromo} onBuy={buyCombo} />
        </div>
      </div>
    </div>
  );
}
