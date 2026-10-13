import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check, Info, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useApi, publicApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";
import { useWallet, BalanceBanner } from "./MyWallet";

const PRESETS = [10, 20, 50, 100, 200, 500];
const CATS = [["all", "全部"], ["usdt", "USDT"], ["card", "卡支付"], ["ewallet", "電子錢包"], ["bank", "銀行轉賬"]];

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
  const [pending, setPending] = useState(null);

  useEffect(() => { publicApi.get("/payment-methods").then((r) => setMethods(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (methodId || methods.length === 0) return;
    setMethodId(methods.find((m) => m.id === data.last_method_id)?.id || methods[0].id);
  }, [methods, data.last_method_id, methodId]);
  useEffect(() => {
    if (!pending || pending.status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const r = await callApi({ method: "GET", url: `/me/wallet/topup/${pending.id}` });
        setPending(r.data);
        if (r.data.status === "paid") { toast.success(`USDT 充值成功，餘額 ${format(r.data.balance_usd)}`); load(); }
        else if (r.data.status !== "pending") toast.error("USDT 充值單已失效，請重新發起");
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [pending, callApi, format, load]);

  const value = custom ? Number(custom) || 0 : amount;
  const shown = methods.filter((m) => cat === "all" || m.category === cat);
  const selected = methods.find((m) => m.id === methodId);
  const isUsdt = selected?.provider === "crypto";

  const topupUsdt = async () => {
    const win = window.open("", "_blank");
    try {
      const r = await callApi({ method: "POST", url: "/me/wallet/topup/usdt", data: { amount_usd: value, method_id: selected.id } });
      setPending(r.data);
      if (win) win.location.href = r.data.pay_url; else window.location.href = r.data.pay_url;
      toast.success("已建立 USDT 充值單，請於收銀台完成轉帳");
    } catch (e) { if (win) win.close(); toast.error(e.response?.data?.detail || "建立 USDT 充值單失敗"); }
  };

  const topup = async () => {
    if (!value || value < 1) return toast.error("請輸入充值金額");
    if (!selected) return toast.error("請選擇支付方式");
    setBusy(true);
    try {
      if (isUsdt) { await topupUsdt(); return; }
      await new Promise((r) => setTimeout(r, 700));
      const r = await callApi({ method: "POST", url: "/me/wallet/topup", data: { amount_usd: value, method_id: selected.id } });
      toast.success(`充值成功（測試），餘額 ${format(r.data.balance_usd)}`);
      setCustom(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "充值失敗"); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="錢包充值" testId="wallet-topup-page" right={<BackLink />}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-6" data-testid="wallet-topup-card">
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
        <div className="mt-3 flex items-center justify-between sm:justify-start gap-1 sm:gap-2" data-testid="pm-category-tabs">
          {CATS.map(([k, l]) => (
            <button key={k} data-testid={`pm-cat-${k}`} onClick={() => setCat(k)} className={`shrink-0 h-9 px-2.5 sm:px-6 rounded-full text-[13px] sm:text-sm whitespace-nowrap transition-colors ${cat === k ? "bg-orange-100 text-orange-500 font-semibold" : "text-slate-600 hover:bg-white"}`}>{l}</button>
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
                  className={`relative min-h-[92px] rounded-xl bg-white border-2 px-3 py-3 flex flex-col items-center justify-center gap-2 transition-colors ${on ? "border-orange-500" : "border-orange-200 hover:border-orange-300"}`}>
                  {m.image && <img src={m.image} alt="" data-testid={`pm-logo-${m.id}`} className="h-9 max-w-[140px] object-contain" />}
                  <span className="text-[13px] font-bold text-slate-800 text-center leading-tight">{m.name}</span>
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

        {pending && pending.status === "pending" && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm" data-testid="usdt-pending-panel">
            <div className="flex items-center gap-2 font-semibold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />USDT 充值單等待付款中（{pending.network}）</div>
            <div className="mt-2 text-slate-700">應付金額：<span className="font-head font-extrabold text-emerald-700" data-testid="usdt-pay-amount">{pending.pay_amount} USDT</span><span className="text-xs text-slate-500 ml-2">請精確轉帳此金額</span></div>
            {pending.wallet_address && <div className="mt-1 text-xs text-slate-600 break-all">收款地址：<span className="font-mono" data-testid="usdt-wallet-address">{pending.wallet_address}</span></div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={pending.pay_url} target="_blank" rel="noreferrer" data-testid="usdt-open-cashier" className="h-9 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center">重新開啟收銀台</a>
              <button data-testid="usdt-cancel-pending" onClick={() => setPending(null)} className="h-9 px-4 rounded-full bg-white border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">關閉</button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">付款完成後系統將自動入帳（每 5 秒自動查詢）</div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm text-slate-600">充值金額</span>
            <span className="font-head text-2xl font-extrabold text-orange-500" data-testid="topup-amount">{format(value)}</span>
            {selected && <span className="text-xs text-slate-400">· {selected.name}</span>}
          </div>
          <button data-testid="topup-submit" onClick={topup} disabled={busy} className="h-12 px-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            <Plus className="h-4 w-4" />{busy ? "處理中…" : isUsdt ? "前往 USDT 收銀台" : "立即充值"}
          </button>
        </div>
        <div className="mt-2 text-right text-[11px] text-slate-400">{isUsdt ? "USDT TRC20 鏈上支付，1 USD = 1 USDT，確認後自動入帳" : "目前為測試支付，充值後即時入帳"}</div>
      </div>
    </Panel>
  );
}
