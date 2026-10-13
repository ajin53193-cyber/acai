import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check, Info, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useApi, publicApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";
import { useWallet, BalanceBanner } from "./MyWallet";

const PRESETS = [10, 20, 50, 100, 200, 500];
const CATS = [["all", "全部"], ["card", "卡支付"], ["ewallet", "電子錢包"], ["bank", "銀行轉賬"]];

const BackLink = () => <Link to="/account/wallet" data-testid="wallet-back" className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500"><ChevronLeft className="h-4 w-4" />返回錢包</Link>;

export default function WalletTopUp() {
  const callApi = useApi();
  const { format } = useCurrency();
  const { data, load } = useWallet();
  const [methods, setMethods] = useState([]);
  const [cat, setCat] = useState("all");
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [methodId, setMethodId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { publicApi.get("/payment-methods").then((r) => setMethods(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (methodId || methods.length === 0) return;
    setMethodId(methods.find((m) => m.id === data.last_method_id)?.id || methods[0].id);
  }, [methods, data.last_method_id, methodId]);

  const value = custom ? Number(custom) || 0 : amount;
  const shown = methods.filter((m) => cat === "all" || m.category === cat);
  const selected = methods.find((m) => m.id === methodId);

  const topup = async () => {
    if (!value || value < 1) return toast.error("請輸入充值金額");
    if (!selected) return toast.error("請選擇支付方式");
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      const r = await callApi({ method: "POST", url: "/me/wallet/topup", data: { amount_usd: value, method_id: selected.id } });
      toast.success(`充值成功（測試），餘額 ${format(r.data.balance_usd)}`);
      setCustom(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "充值失敗"); }
    setBusy(false);
  };

  return (
    <Panel title="錢包充值" testId="wallet-topup-page" right={<BackLink />}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-6" data-testid="wallet-topup-card">
        <div className="font-semibold text-slate-900">充值金額</div>
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3">
          {PRESETS.map((v) => (
            <button key={v} data-testid={`topup-preset-${v}`} onClick={() => { setAmount(v); setCustom(""); }} className={`h-12 rounded-xl text-sm font-bold transition-colors ${!custom && amount === v ? "bg-orange-500 text-white shadow" : "bg-white text-slate-700 hover:bg-orange-50"}`}>USD$ {v}</button>
          ))}
        </div>
        <div className="relative mt-3 max-w-xs">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">USD$</span>
          <input data-testid="topup-custom" type="number" min="1" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="自訂金額" className="w-full h-12 rounded-xl bg-white pl-14 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div className="mt-6 font-semibold text-slate-900">支付方式</div>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="pm-category-tabs">
          {CATS.map(([k, l]) => (
            <button key={k} data-testid={`pm-cat-${k}`} onClick={() => setCat(k)} className={`h-9 px-6 rounded-full text-sm transition-colors ${cat === k ? "bg-orange-100 text-orange-500 font-semibold" : "text-slate-600 hover:bg-white"}`}>{l}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="mt-4 py-8 text-center text-sm text-slate-400" data-testid="pm-empty">此分類暫無可用支付方式</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="pm-grid">
            {shown.map((m) => {
              const on = m.id === methodId;
              return (
                <button key={m.id} data-testid={`pm-card-${m.id}`} aria-pressed={on} onClick={() => setMethodId(m.id)}
                  className={`relative h-[68px] rounded-xl bg-white border-2 px-3 flex items-center justify-center transition-colors ${on ? "border-orange-500" : "border-orange-200 hover:border-orange-300"}`}>
                  {m.image ? <img src={m.image} alt={m.name} className="max-h-10 max-w-full object-contain" /> : <span className="text-sm font-bold text-slate-800 text-center leading-tight">{m.name}</span>}
                  {m.id === data.last_method_id && <span data-testid={`pm-recent-${m.id}`} className="absolute -top-2.5 right-2 text-[11px] font-semibold bg-orange-500 text-white rounded-full px-2 py-0.5">最近使用</span>}
                  {on && <span className="absolute -right-px -bottom-px h-6 w-6 rounded-tl-xl rounded-br-[10px] bg-orange-500 text-white flex items-center justify-center"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        )}
        {selected && (
          <div className="mt-4 rounded-xl bg-white border border-orange-100 p-4 text-sm" data-testid="pm-description">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><Info className="h-4 w-4 text-orange-500" />{selected.name} · 付款說明</div>
            <p className="mt-1.5 text-slate-600 whitespace-pre-wrap leading-relaxed">{selected.description || "選擇此方式後點擊「立即充值」完成付款。"}</p>
            <div className="mt-2 text-xs text-slate-400">單次限額 USD$ {selected.min_usd ?? 1} ~ USD$ {selected.max_usd ?? 10000}{selected.fee_percent > 0 && ` · 手續費 ${selected.fee_percent}%`}</div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm text-slate-600">充值金額</span>
            <span className="font-head text-2xl font-extrabold text-orange-500" data-testid="topup-amount">{format(value)}</span>
            {selected && <span className="text-xs text-slate-400">· {selected.name}</span>}
          </div>
          <button data-testid="topup-submit" onClick={topup} disabled={busy} className="h-12 px-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            <Plus className="h-4 w-4" />{busy ? "處理中…" : "立即充值"}
          </button>
        </div>
        <div className="mt-2 text-right text-[11px] text-slate-400">目前為測試支付，充值後即時入帳</div>
      </div>
    </Panel>
  );
}
