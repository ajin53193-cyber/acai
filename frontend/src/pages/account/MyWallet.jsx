import { useEffect, useState } from "react";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone, Bitcoin, Check } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";

const PRESETS = [10, 20, 50, 100, 200, 500];
const METHODS = [["card", "信用卡 / Visa / Master", CreditCard], ["applepay", "Apple Pay / Google Pay", Smartphone], ["crypto", "加密貨幣 USDT", Bitcoin]];

export default function MyWallet() {
  const callApi = useApi();
  const { format } = useCurrency();
  const [data, setData] = useState({ balance_usd: 0, transactions: [] });
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState("card");
  const [busy, setBusy] = useState(false);

  const load = () => callApi({ method: "GET", url: "/me/wallet" }).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [callApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = custom ? Number(custom) || 0 : amount;
  const totalIn = data.transactions.filter((t) => t.amount_usd > 0).reduce((a, t) => a + t.amount_usd, 0);
  const totalOut = -data.transactions.filter((t) => t.amount_usd < 0).reduce((a, t) => a + t.amount_usd, 0);

  const topup = async () => {
    if (!value || value < 1) return toast.error("請輸入充值金額");
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      const r = await callApi({ method: "POST", url: "/me/wallet/topup", data: { amount_usd: value, method } });
      toast.success(`充值成功（測試），餘額 ${format(r.data.balance_usd)}`);
      setCustom(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "充值失敗"); }
    setBusy(false);
  };

  return (
    <Panel title="我的錢包" testId="wallet-page">
      {/* Balance banner */}
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

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        {/* Top-up */}
        <div className="rounded-2xl bg-slate-50 p-6" data-testid="wallet-topup-card">
          <div className="font-semibold text-slate-900">錢包充值</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {PRESETS.map((v) => (
              <button key={v} data-testid={`topup-preset-${v}`} onClick={() => { setAmount(v); setCustom(""); }} className={`h-14 rounded-xl text-base font-bold transition-colors ${!custom && amount === v ? "bg-orange-500 text-white shadow" : "bg-white text-slate-700 hover:bg-orange-50"}`}>USD$ {v}</button>
            ))}
          </div>
          <div className="relative mt-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">USD$</span>
            <input data-testid="topup-custom" type="number" min="1" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="自訂金額" className="w-full h-12 rounded-xl bg-white pl-14 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
          </div>

          <div className="mt-5 text-sm font-semibold text-slate-900">付款方式</div>
          <div className="mt-2 space-y-2">
            {METHODS.map(([id, label, Icon]) => (
              <button key={id} data-testid={`topup-method-${id}`} onClick={() => setMethod(id)} className={`w-full h-12 px-4 rounded-xl flex items-center gap-3 text-sm transition-colors ${method === id ? "bg-white ring-2 ring-orange-400 text-slate-900" : "bg-white text-slate-600 hover:bg-orange-50"}`}>
                <Icon className="h-4 w-4 text-slate-500" /><span className="flex-1 text-left">{label}</span>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center ${method === id ? "bg-orange-500 text-white" : "border border-slate-300"}`}>{method === id && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">充值金額</div>
            <div className="font-head text-2xl font-extrabold text-orange-500" data-testid="topup-amount">{format(value)}</div>
          </div>
          <button data-testid="topup-submit" onClick={topup} disabled={busy} className="mt-3 w-full h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            <Plus className="h-4 w-4" />{busy ? "處理中…" : "立即充值"}
          </button>
          <div className="mt-2 text-center text-[11px] text-slate-400">目前為測試支付，充值後即時入帳</div>
        </div>

        {/* Transactions */}
        <div className="rounded-2xl bg-slate-50 p-6" data-testid="wallet-transactions">
          <div className="font-semibold text-slate-900">交易紀錄</div>
          {data.transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm" data-testid="wallet-empty">尚無交易紀錄</div>
          ) : (
            <div className="mt-2 divide-y divide-slate-200/70 max-h-[520px] overflow-y-auto pr-1">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3 text-sm">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
