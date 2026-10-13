import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Plus, ReceiptText, ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F0872E] to-[#F7A94A] text-white px-7 py-6 flex flex-col sm:flex-row sm:items-center gap-6">
      <Wallet className="absolute -right-6 -bottom-8 h-40 w-40 text-white/10" strokeWidth={1} />
      <div className="flex-1">
        <div className="text-sm text-white/85">錢包餘額（USD）</div>
        <div className="font-head text-4xl font-extrabold mt-1 tracking-tight" data-testid="wallet-balance">{format(data.balance_usd)}</div>
      </div>
      <div className="flex gap-8 sm:border-l sm:border-white/25 sm:pl-8 text-sm">
        <div><div className="text-white/75">累計充值</div><div className="font-semibold text-lg mt-0.5">{format(totalIn)}</div></div>
        <div><div className="text-white/75">累計消費</div><div className="font-semibold text-lg mt-0.5">{format(totalOut)}</div></div>
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
  ["/account/wallet/topup", "錢包充值", "立即充值", Plus, "wallet-go-topup", "from-[#F0872E] to-[#F7A94A]"],
  ["/account/wallet/transactions", "交易紀錄", "查看明細", ReceiptText, "wallet-go-transactions", "from-[#F7A94A] to-[#FFC56E]"],
];

export default function MyWallet() {
  const { data } = useWallet();
  const last = data.transactions[0];
  return (
    <Panel title="我的錢包" testId="wallet-page">
      <BalanceBanner data={data} />
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ACTIONS.map(([to, title, cta, Icon, tid, grad]) => (
          <Link key={to} to={to} data-testid={tid} className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center hover:shadow-md transition-all">
            <div className={`relative w-[64%] aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${grad} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
              <Wallet className="absolute -right-4 -bottom-4 h-20 w-20 text-white/15" strokeWidth={1.5} />
              <Icon className="h-12 w-12 text-white relative" strokeWidth={2.2} />
            </div>
            <h3 className="font-semibold text-[15px] text-slate-800 mt-3 group-hover:text-orange-600">{title}</h3>
            <span className="mt-3 text-xs font-bold text-orange-600 bg-orange-100 group-hover:bg-orange-500 group-hover:text-white rounded-full px-5 py-1.5 transition-colors">{cta}</span>
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
