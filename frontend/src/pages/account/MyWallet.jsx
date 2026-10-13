import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowDownToLine, ShoppingBag } from "lucide-react";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";

export function useWallet() {
  const callApi = useApi();
  const [data, setData] = useState({ balance_usd: 0, transactions: [], last_method_id: "" });
  const load = () => callApi({ method: "GET", url: "/me/wallet" }).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [callApi]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, load };
}

export function BalanceBanner({ data }) {
  const { format } = useCurrency();
  const totalIn = data.transactions.filter((t) => t.amount_usd > 0).reduce((a, t) => a + t.amount_usd, 0);
  const totalOut = -data.transactions.filter((t) => t.amount_usd < 0).reduce((a, t) => a + t.amount_usd, 0);
  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#ED8D37] text-white shadow-[0_14px_30px_-16px_rgba(237,141,55,0.8)]" data-testid="wallet-hero-card">
      <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-[#E8762A] to-transparent" />
      <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <div className="absolute left-24 -bottom-20 h-40 w-40 rounded-full bg-white/[0.07]" />
      <img src="/banners/wallet-hero.webp" alt="" className="absolute -right-2 md:right-4 top-1/2 -translate-y-1/2 h-[92%] md:h-[118%] w-auto max-w-none pointer-events-none select-none" style={{ WebkitMaskImage: "linear-gradient(to right, transparent, #000 30%)", maskImage: "linear-gradient(to right, transparent, #000 30%)" }} />
      <div className="relative px-5 py-5 md:px-8 md:py-7">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] md:text-xs font-medium"><Wallet className="h-3.5 w-3.5" />錢包餘額（USD）</div>
        <div className="font-head text-[34px] md:text-5xl font-extrabold mt-2 tracking-tight leading-none drop-shadow-sm" data-testid="wallet-balance">{format(data.balance_usd)}</div>
        <div className="mt-4 md:mt-6 flex gap-2.5 md:gap-3">
          <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 md:px-4 md:py-2.5 min-w-[108px]">
            <div className="flex items-center gap-1 text-[11px] md:text-xs text-white/80"><ArrowDownToLine className="h-3 w-3" />累計充值</div>
            <div className="font-head font-bold text-[15px] md:text-lg mt-0.5">{format(totalIn)}</div>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 md:px-4 md:py-2.5 min-w-[108px]">
            <div className="flex items-center gap-1 text-[11px] md:text-xs text-white/80"><ShoppingBag className="h-3 w-3" />累計消費</div>
            <div className="font-head font-bold text-[15px] md:text-lg mt-0.5">{format(totalOut)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TxRow({ t }) {
  const { format } = useCurrency();
  return (
    <div className="flex items-center gap-3 py-3 text-sm" data-testid={`tx-row-${t.id}`}>
      <span className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${t.amount_usd >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"}`}>{t.amount_usd >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
      <div className="flex-1 min-w-0">
        <div className="text-slate-800 truncate">{t.note}</div>
        <div className="text-xs text-slate-400">{t.created_at?.slice(0, 16).replace("T", " ")}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-bold ${t.amount_usd >= 0 ? "text-emerald-600" : "text-slate-800"}`}>{t.amount_usd >= 0 ? "+" : "-"}{format(Math.abs(t.amount_usd))}</div>
        <div className="text-[11px] text-slate-400">餘額 {format(t.balance_after_usd)}</div>
      </div>
    </div>
  );
}

const ACTIONS = [
  ["/account/wallet/topup", "錢包充值 — 多種支付方式 · 即時入帳", "/banners/wallet-topup.jpg", "wallet-go-topup"],
  ["/account/wallet/transactions", "交易紀錄 — 充值 · 付款 · 明細一目了然", "/banners/wallet-transactions.jpg", "wallet-go-transactions"],
];

export default function MyWallet() {
  const { data } = useWallet();
  const last = data.transactions[0];
  return (
    <Panel title="我的錢包" testId="wallet-page">
      <BalanceBanner data={data} />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACTIONS.map(([to, alt, src, tid]) => (
          <Link key={to} to={to} data-testid={tid} className="group block overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
            <img src={src} alt={alt} className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          </Link>
        ))}
      </div>
      {last && (
        <div className="mt-6 rounded-2xl bg-slate-50 px-6 py-3" data-testid="wallet-last-tx">
          <div className="text-xs text-slate-400">最近一筆</div>
          <TxRow t={last} />
        </div>
      )}
    </Panel>
  );
}
