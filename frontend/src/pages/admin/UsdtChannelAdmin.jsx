import { useEffect, useState, useCallback } from "react";
import { Loader2, Clock, FileSearch, CheckCircle2, XCircle, Ban, Copy, Wallet, Settings2, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Card, Head } from "./ui";
import PaymentMethodsAdmin from "@/pages/admin/PaymentMethodsAdmin";

const ST = {
  pending: [tr("待付款"), "text-amber-600 bg-amber-50 border-amber-200", Clock],
  reviewing: [tr("審核中"), "text-sky-600 bg-sky-50 border-sky-200", FileSearch],
  paid: [tr("已到賬"), "text-emerald-600 bg-emerald-50 border-emerald-200", CheckCircle2],
  expired: [tr("已過期"), "text-slate-500 bg-slate-50 border-slate-200", XCircle],
  rejected: [tr("已駁回"), "text-red-600 bg-red-50 border-red-200", Ban],
};
const copy = (v) => { navigator.clipboard?.writeText(v); toast.success(tr("已複製")); };
const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "-";
const fmtTime = (s) => s ? new Date(s).toLocaleString() : "-";

export function UsdtChannelAdmin({ callApi }) {
  const [tab, setTab] = useState("data");
  const TABS = [["data", tr("收款數據"), BarChart3], ["config", tr("通道配置"), Settings2]];
  return (
    <div data-testid="usdt-channel-admin">
      <Head title={tr("USDT 收款通道")} sub={tr("自有錢包多地址收款：系統自動分配地址與唯一金額，並定時掃鏈自動到賬（用戶關閉頁面也能入帳）。")} />
      <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4" data-testid="usdt-tabs">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} data-testid={`usdt-tab-${k}`} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${tab === k ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            <Icon className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
      {tab === "data" ? <UsdtData callApi={callApi} /> : <PaymentMethodsAdmin callApi={callApi} scope="crypto" />}
    </div>
  );
}

function UsdtData({ callApi }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/usdt/overview" }).then((r) => setD(r.data)).catch(() => setD({ summary: {}, per_address: [], recent: [] })), [callApi]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Loader2 className="h-6 w-6 animate-spin text-orange-500" />;
  const s = d.summary || {};
  const cards = [
    [tr("待付款"), s.pending, "amber"],
    [tr("審核中"), s.reviewing, "sky"],
    [tr("已到賬"), s.paid, "emerald"],
    [tr("已過期"), s.expired, "slate"],
  ];
  const tone = { amber: "from-amber-400 to-orange-500", sky: "from-sky-400 to-sky-600", emerald: "from-emerald-400 to-emerald-600", slate: "from-slate-400 to-slate-500" };
  return (
    <div className="space-y-5" data-testid="usdt-data">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-slate-500">{tr("共 {0} 個收款地址 · 掃鏈週期 {1} 秒", d.address_count || 0, d.scan_seconds || 90)}</div>
        <button data-testid="usdt-refresh" onClick={load} className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition-colors"><RefreshCw className="h-3.5 w-3.5" />{tr("刷新")}</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="usdt-summary">
        {cards.map(([label, v, c]) => (
          <div key={label} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${tone[c]} text-white text-[11px] font-bold px-2.5 py-1`}>{label}</div>
            <div className="mt-3 font-head text-2xl font-extrabold text-slate-900">{v?.count ?? 0}<span className="text-sm font-semibold text-slate-400 ml-1">{tr("筆")}</span></div>
            <div className="text-[12px] text-slate-500 mt-0.5">USD$ {(v?.amount ?? 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-800"><Wallet className="h-4 w-4 text-orange-500" />{tr("地址收款統計")}</div>
        {(d.per_address || []).length === 0 ? <div className="p-8 text-center text-sm text-slate-400">{tr("尚未配置收款地址")}</div> : (
          <table className="w-full text-sm" data-testid="usdt-per-address">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">
              <th className="px-5 py-2.5 font-semibold">{tr("收款地址")}</th>
              <th className="px-5 py-2.5 font-semibold text-center">{tr("待付中")}</th>
              <th className="px-5 py-2.5 font-semibold text-center">{tr("到賬筆數")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{tr("累計到賬")}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.per_address.map((p) => (
                <tr key={p.address} data-testid={`usdt-addr-${p.address.slice(-6)}`} className="hover:bg-orange-50/30">
                  <td className="px-5 py-3 font-mono text-[13px] text-slate-700"><button onClick={() => copy(p.address)} className="inline-flex items-center gap-1.5 hover:text-orange-600">{short(p.address)}<Copy className="h-3.5 w-3.5 opacity-60" /></button></td>
                  <td className="px-5 py-3 text-center"><span className="inline-flex rounded-full bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5">{p.pending_count}</span></td>
                  <td className="px-5 py-3 text-center font-semibold text-slate-700">{p.paid_count}</td>
                  <td className="px-5 py-3 text-right font-head font-bold text-emerald-600">USD$ {p.paid_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">{tr("最近充值記錄")}</div>
        {(d.recent || []).length === 0 ? <div className="p-8 text-center text-sm text-slate-400">{tr("尚無數據")}</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="usdt-recent">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">
              <th className="px-5 py-2.5 font-semibold">{tr("時間")}</th>
              <th className="px-5 py-2.5 font-semibold">{tr("訂單號")}</th>
              <th className="px-5 py-2.5 font-semibold">{tr("用戶ID")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{tr("金額")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{tr("到賬金額")}</th>
              <th className="px-5 py-2.5 font-semibold">{tr("收款地址")}</th>
              <th className="px-5 py-2.5 font-semibold text-center">{tr("狀態")}</th>
              <th className="px-5 py-2.5 font-semibold">TXID</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.recent.map((t) => {
                const [lbl, cls, Icon] = ST[t.status] || [t.status, "text-slate-500 bg-slate-50 border-slate-200", Clock];
                const ono = t.order_no || t.out_trade_no || "-";
                return (
                  <tr key={t.id} data-testid={`usdt-recent-${t.id}`} className="hover:bg-orange-50/30">
                    <td className="px-5 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmtTime(t.created_at)}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-700 whitespace-nowrap"><button onClick={() => copy(ono)} className="inline-flex items-center gap-1 hover:text-orange-600">{ono}<Copy className="h-3 w-3 opacity-60" /></button></td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-500 whitespace-nowrap"><button onClick={() => copy(t.user_id)} className="inline-flex items-center gap-1 hover:text-orange-600" title={t.user_id}>{short(t.user_id)}<Copy className="h-3 w-3 opacity-60" /></button></td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700">${t.amount_usd}</td>
                    <td className="px-5 py-3 text-right font-mono text-[13px] text-slate-600">{t.pay_amount} U</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{short(t.wallet_address)}</td>
                    <td className="px-5 py-3 text-center"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}><Icon className="h-3 w-3" />{lbl}</span></td>
                    <td className="px-5 py-3 font-mono text-[12px]">{t.tx_id ? <a href={`https://tronscan.org/#/transaction/${t.tx_id}`} target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">{short(t.tx_id)}</a> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
