import { useEffect, useState } from "react";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel, OrangeBtn } from "./AccountLayout";

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

  const topup = async () => {
    const amt = custom ? Number(custom) : amount;
    if (!amt || amt < 1) return toast.error("請輸入充值金額");
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      const r = await callApi({ method: "POST", url: "/me/wallet/topup", data: { amount_usd: amt, method } });
      toast.success(`充值成功（測試），餘額 ${format(r.data.balance_usd)}`);
      setCustom(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "充值失敗"); }
    setBusy(false);
  };

  return (
    <Panel title="我的錢包" testId="wallet-page">
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-7 shadow-lg">
          <div className="flex items-center gap-2 text-white/80 text-sm"><Wallet className="h-4 w-4" />錢包餘額</div>
          <div className="font-head text-4xl font-extrabold mt-3" data-testid="wallet-balance">{format(data.balance_usd)}</div>
          <div className="text-xs text-white/70 mt-2">USD$ {Number(data.balance_usd).toFixed(2)} · 可用於全站商品付款</div>
        </div>
        <div className="lg:col-span-3 rounded-3xl bg-slate-50 p-6">
          <div className="font-semibold text-slate-900 mb-4">錢包充值</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESETS.map((v) => (
              <button key={v} data-testid={`topup-preset-${v}`} onClick={() => { setAmount(v); setCustom(""); }} className={`h-12 rounded-xl text-sm font-bold transition-colors ${!custom && amount === v ? "bg-orange-500 text-white" : "bg-white text-slate-700 hover:bg-orange-50"}`}>${v}</button>
            ))}
          </div>
          <input data-testid="topup-custom" type="number" min="1" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="或輸入自訂金額（USD）" className="mt-3 w-full h-12 rounded-xl bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
          <div className="mt-4 grid sm:grid-cols-3 gap-2">
            {METHODS.map(([id, label, Icon]) => (
              <button key={id} data-testid={`topup-method-${id}`} onClick={() => setMethod(id)} className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-semibold ${method === id ? "border-orange-400 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-600"}`}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-slate-600">充值金額：<span className="font-head text-xl font-extrabold text-orange-500" data-testid="topup-amount">{format(custom ? Number(custom) || 0 : amount)}</span></span>
            <OrangeBtn data-testid="topup-submit" onClick={topup} disabled={busy} className="!px-8 flex items-center gap-2"><Plus className="h-4 w-4" />{busy ? "處理中…" : "立即充值（測試支付）"}</OrangeBtn>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="font-semibold text-slate-900 mb-3">交易紀錄</div>
        {data.transactions.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center" data-testid="wallet-empty">尚無交易紀錄</div> : (
          <div className="divide-y divide-slate-100 rounded-2xl bg-slate-50 px-5" data-testid="wallet-transactions">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 py-3 text-sm">
                <span className={`h-9 w-9 rounded-full flex items-center justify-center ${t.amount_usd >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"}`}>{t.amount_usd >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                <div className="flex-1 min-w-0"><div className="text-slate-800 truncate">{t.note}</div><div className="text-xs text-slate-400">{t.created_at?.slice(0, 19).replace("T", " ")}</div></div>
                <div className="text-right"><div className={`font-bold ${t.amount_usd >= 0 ? "text-emerald-600" : "text-slate-800"}`}>{t.amount_usd >= 0 ? "+" : ""}{format(t.amount_usd)}</div><div className="text-xs text-slate-400">餘額 {format(t.balance_after_usd)}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
