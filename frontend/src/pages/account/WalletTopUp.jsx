import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useApi, publicApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";
import { useWallet, BalanceBanner } from "./MyWallet";
import { tr } from "@/i18n";

const PRESETS = [50, 100, 200, 500, 1000, 2000];
const CATS = [["all", tr("全部")], ["usdt", "USDT"], ["card", tr("卡支付")], ["ewallet", tr("電子錢包")], ["bank", tr("銀行轉賬")]];

const BackLink = () => <div className="flex items-center gap-3"><Link to="/account/wallet/topups" data-testid="wallet-topup-records" className="text-sm text-orange-500 font-semibold hover:underline">{tr("充值記錄")}</Link><Link to="/account/wallet" data-testid="wallet-back" className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500"><ChevronLeft className="h-4 w-4" />{tr("返回錢包")}</Link></div>;

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
  const navigate = useNavigate();

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
        if (r.data.status === "paid") { toast.success(tr("USDT 充值成功，餘額 {0}", format(r.data.balance_usd))); load(); }
        else if (r.data.status !== "pending") toast.error(tr("USDT 充值單已失效，請重新發起"));
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
      toast.success(tr("已建立 USDT 充值單，請於收銀台完成轉帳"));
    } catch (e) { if (win) win.close(); toast.error(e.response?.data?.detail || tr("建立 USDT 充值單失敗")); }
  };

  const topup = async () => {
    if (!value || value < 50) return toast.error(tr("最低充值金額為 USD$ 50"));
    if (!selected) return toast.error(tr("請選擇支付方式"));
    setBusy(true);
    try {
      if (isUsdt) { await topupUsdt(); return; }
      const r = await callApi({ method: "POST", url: "/me/wallet/topup/checkout", data: { amount_usd: value, method_id: selected.id, origin_url: window.location.origin } });
      if (["stripe", "paypal"].includes(r.data.provider)) { toast.success(tr("正在前往收銀台…")); window.location.href = r.data.pay_url; return; }
      navigate(`/account/wallet/topups?topup=${r.data.id}`);
    } catch (e) { toast.error(e.response?.data?.detail || tr("充值失敗")); }
    finally { setBusy(false); }
  };

  return (
    <Panel title={tr("錢包充值")} testId="wallet-topup-page" right={<BackLink />}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-6" data-testid="wallet-topup-card">
        <div className="font-semibold text-slate-900">{tr("充值金額")}</div>
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3">
          {PRESETS.map((v) => (
            <button key={v} data-testid={`topup-preset-${v}`} onClick={() => { setAmount(v); setCustom(""); }} className={`h-12 rounded-xl text-sm font-bold transition-colors ${!custom && amount === v ? "bg-orange-500 text-white shadow" : "bg-white text-slate-700 hover:bg-orange-50"}`}>USD$ {v}</button>
          ))}
        </div>
        <div className="relative mt-3 max-w-xs">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">USD$</span>
          <input data-testid="topup-custom" type="number" min="50" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={tr("自訂金額（最低 50）")} className="w-full h-12 rounded-xl bg-white pl-14 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div className="mt-6 font-semibold text-slate-900">{tr("支付方式")}</div>
        <div className="mt-3 flex items-center justify-between sm:justify-start gap-1 sm:gap-2" data-testid="pm-category-tabs">
          {CATS.map(([k, l]) => (
            <button key={k} data-testid={`pm-cat-${k}`} onClick={() => setCat(k)} className={`shrink-0 h-9 px-2.5 sm:px-6 rounded-full text-[13px] sm:text-sm whitespace-nowrap transition-colors ${cat === k ? "bg-orange-100 text-orange-500 font-semibold" : "text-slate-600 hover:bg-white"}`}>{l}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="mt-4 py-8 text-center text-sm text-slate-400" data-testid="pm-empty">{tr("此分類暫無可用支付方式")}</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="pm-grid">
            {shown.map((m) => {
              const on = m.id === methodId;
              return (
                <button key={m.id} data-testid={`pm-card-${m.id}`} aria-pressed={on} onClick={() => setMethodId(m.id)}
                  className={`relative min-h-[92px] rounded-xl bg-white border-2 px-3 py-3 flex flex-col items-center justify-center gap-2 transition-colors ${on ? "border-orange-500" : "border-orange-200 hover:border-orange-300"}`}>
                  {m.image && <img src={m.image} alt="" data-testid={`pm-logo-${m.id}`} className="h-9 max-w-[140px] object-contain" />}
                  <span className="text-[13px] font-bold text-slate-800 text-center leading-tight">{m.name}</span>
                  {m.id === data.last_method_id && <span data-testid={`pm-recent-${m.id}`} className="absolute -top-2.5 right-2 text-[11px] font-semibold bg-orange-500 text-white rounded-full px-2 py-0.5">{tr("最近使用")}</span>}
                  {on && <span className="absolute -right-px -bottom-px h-6 w-6 rounded-tl-xl rounded-br-[10px] bg-orange-500 text-white flex items-center justify-center"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        )}
        {selected && (
          <div className="mt-4 rounded-2xl bg-white border-2 border-orange-200 overflow-hidden" data-testid="pm-description">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-orange-50/70 whitespace-nowrap overflow-hidden">
              {selected.image && <img src={selected.image} alt="" className="hidden sm:block h-6 object-contain shrink-0" />}
              <span className="text-[13px] sm:text-[14px] font-bold text-slate-900 truncate">{selected.name}</span>
              <span className="shrink-0 rounded-full bg-orange-100 text-orange-500 text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 leading-4">{tr("付款說明")}</span>
              {isUsdt && <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-600 text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 leading-4">{tr("鏈上自動入帳")}</span>}
            </div>
            <div className="px-4 py-3 text-sm">
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selected.description || tr("選擇此方式後點擊「立即充值」完成付款。")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-1">{tr("單次限額")} <span className="font-head font-bold text-slate-800">USD$ {selected.min_usd ?? 50} ~ USD$ {selected.max_usd ?? 10000}</span></span>
                <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-1">{tr("手續費")} <span className="font-head font-bold text-orange-500">{selected.fee_percent > 0 ? `${selected.fee_percent}%` : tr("免手續費")}</span></span>
                {isUsdt && <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-1">{tr("匯率")} <span className="font-head font-bold text-slate-800">1 USD = 1 USDT</span></span>}
              </div>
            </div>
          </div>
        )}

        {pending && pending.status === "pending" && (
          <div className="mt-4 rounded-2xl bg-white border-2 border-orange-400 overflow-hidden" data-testid="usdt-pending-panel">
            <div className="flex items-center gap-2 px-4 py-3 bg-orange-50/70">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[14px] font-bold text-slate-900">{tr("USDT 充值單等待付款中")}</span>
              <span className="rounded-full bg-orange-500 text-white text-[11px] font-semibold px-2 py-0.5">{pending.network}</span>
            </div>
            <div className="px-4 py-3 text-sm">
              <div className="flex items-baseline gap-2"><span className="text-slate-600">{tr("應付金額")}</span><span className="font-head text-2xl font-extrabold text-orange-500" data-testid="usdt-pay-amount">{pending.pay_amount} <span className="text-sm">USDT</span></span><span className="text-[11px] text-slate-400">{tr("請精確轉帳此金額")}</span></div>
              {pending.wallet_address && <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600 break-all">{tr("收款地址：")}<span className="font-mono text-slate-800" data-testid="usdt-wallet-address">{pending.wallet_address}</span></div>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={pending.pay_url} target="_blank" rel="noreferrer" data-testid="usdt-open-cashier" className="h-9 px-5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center transition-colors">{tr("重新開啟收銀台")}</a>
                <button data-testid="usdt-cancel-pending" onClick={() => setPending(null)} className="h-9 px-5 rounded-full bg-orange-50 text-orange-500 text-xs font-semibold hover:bg-orange-100 transition-colors">{tr("關閉")}</button>
                <span className="text-[11px] text-slate-400 ml-auto">{tr("付款完成後自動入帳（每 5 秒查詢）")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm text-slate-600">{tr("充值金額")}</span>
            <span className="font-head text-2xl font-extrabold text-orange-500" data-testid="topup-amount">{format(value)}</span>
            {selected && <span className="text-xs text-slate-400">· {selected.name}</span>}
          </div>
          <button data-testid="topup-submit" onClick={topup} disabled={busy} className="h-12 px-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            <Plus className="h-4 w-4" />{busy ? tr("處理中…") : isUsdt ? tr("前往 USDT 收銀台") : tr("立即充值")}
          </button>
        </div>
        {!isUsdt && selected && <div className="mt-2 text-right text-[11px] text-slate-400" data-testid="topup-footnote">{["stripe", "paypal"].includes(selected.provider) ? tr("將跳轉至安全收銀台，付款完成後自動入帳") : tr("轉帳後請於充值記錄上傳憑證，人工核對後入帳")}</div>}
      </div>
    </Panel>
  );
}
