import { useEffect, useState, useCallback } from "react";
import { Loader2, Clock, FileSearch, CheckCircle2, XCircle, Ban, Copy, Wallet, Settings2, BarChart3, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Card, Head } from "./ui";
import PaymentMethodsAdmin from "@/pages/admin/PaymentMethodsAdmin";
import { UserInfoDialog } from "@/pages/admin/UserInfoDialog";
import { AddressChainDialog } from "@/pages/admin/AddressChainDialog";

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
  const [viewUid, setViewUid] = useState("");
  const [viewAddr, setViewAddr] = useState("");
  const [range, setRange] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bal, setBal] = useState(null);
  const load = useCallback((rng, df = "", dt = "") => {
    setD(null);
    callApi({ method: "GET", url: `/admin/usdt/overview?range=${rng}&date_from=${df}&date_to=${dt}` }).then((r) => setD(r.data)).catch(() => setD({ summary: {}, per_address: [], recent: [] }));
  }, [callApi]);
  const loadBal = useCallback(() => { setBal("loading"); callApi({ method: "GET", url: "/admin/usdt/balances" }).then((r) => setBal(r.data)).catch(() => setBal({ balances: {}, total: 0, ok: false })); }, [callApi]);
  useEffect(() => { load("today"); loadBal(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (rng) => { setRange(rng); if (rng !== "custom") load(rng); };
  if (!d) return <Loader2 className="h-6 w-6 animate-spin text-orange-500" />;
  const s = d.summary || {};
  const RANGES = [["today", tr("今日")], ["yesterday", tr("昨日")], ["week", tr("本週")], ["month", tr("本月")], ["lastmonth", tr("上月")], ["all", tr("全部")], ["custom", tr("自定義")]];
  const cards = [
    [tr("待付款"), s.pending, "amber"],
    [tr("審核中"), s.reviewing, "sky"],
    [tr("已到賬"), s.paid, "emerald"],
    [tr("已過期"), s.expired, "slate"],
  ];
  const tone = { amber: "from-amber-400 to-orange-500", sky: "from-sky-400 to-sky-600", emerald: "from-emerald-400 to-emerald-600", slate: "from-slate-400 to-slate-500" };
  return (
    <div className="space-y-5" data-testid="usdt-data">
      <div className="flex flex-wrap items-center gap-2" data-testid="usdt-range">
        {RANGES.map(([k, l]) => (
          <button key={k} data-testid={`usdt-range-${k}`} onClick={() => pick(k)}
            className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors ${range === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
        {range === "custom" && (
          <span className="flex items-center gap-1.5">
            <input type="date" data-testid="usdt-from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs" />
            <span className="text-slate-400 text-xs">~</span>
            <input type="date" data-testid="usdt-to" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs" />
            <button data-testid="usdt-query" onClick={() => load("custom", from, to)} className="h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold">{tr("查詢")}</button>
          </span>
        )}
        <button data-testid="usdt-refresh" onClick={() => { load(range, from, to); loadBal(); }} className="ml-auto h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition-colors"><RefreshCw className="h-3.5 w-3.5" />{tr("刷新")}</button>
      </div>
      <div className="text-[12px] text-slate-400">{tr("共 {0} 個收款地址 · 掃鏈週期 {1} 秒", d.address_count || 0, d.scan_seconds || 90)}</div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm p-4" data-testid="usdt-success-rate">
          <div className="text-[12px] text-white/80 font-semibold">{tr("支付成功率")}</div>
          <div className="mt-1 font-head text-3xl font-extrabold">{d.success_rate ?? 0}%</div>
          <div className="text-[11px] text-white/70 mt-0.5">{tr("已到賬 ÷（到賬+過期+駁回）")}</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm p-4" data-testid="usdt-chain-total">
          <div className="text-[12px] text-white/70 font-semibold flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />{tr("錢包鏈上總餘額")}</div>
          <div className="mt-1 font-head text-3xl font-extrabold">{bal === "loading" || bal === null ? <span className="text-lg text-white/60">{tr("查詢中…")}</span> : <>{(bal.total ?? 0).toLocaleString()} <span className="text-base font-semibold text-white/60">USDT</span></>}</div>
          <div className="text-[11px] text-white/60 mt-0.5">{bal && bal !== "loading" && !bal.ok ? tr("部分地址查詢失敗（請配置 TRONGRID_API_KEY）") : tr("TRC20 鏈上實時餘額")}</div>
        </div>
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
              <th className="px-5 py-2.5 font-semibold text-right">{tr("鏈上餘額")}</th>
              <th className="px-5 py-2.5 font-semibold text-center">{tr("待付中")}</th>
              <th className="px-5 py-2.5 font-semibold text-center">{tr("到賬筆數")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{tr("累計到賬")}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.per_address.map((p) => {
                const b = bal && bal !== "loading" ? bal.balances?.[p.address] : undefined;
                return (
                <tr key={p.address} data-testid={`usdt-addr-${p.address.slice(-6)}`} className="hover:bg-orange-50/30">
                  <td className="px-5 py-3 font-mono text-[13px] text-slate-700"><div className="flex items-center gap-2"><button onClick={() => copy(p.address)} className="inline-flex items-center gap-1.5 hover:text-orange-600">{short(p.address)}<Copy className="h-3.5 w-3.5 opacity-60" /></button><button data-testid={`usdt-addr-chain-${p.address.slice(-6)}`} onClick={() => setViewAddr(p.address)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-700 px-2 py-0.5 text-[11px] font-semibold transition-colors"><Search className="h-3 w-3" />{tr("查鏈")}</button></div></td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] text-slate-700">{bal === "loading" || bal === null ? "…" : b == null ? <span className="text-slate-300">—</span> : `${b.toLocaleString()} U`}</td>
                  <td className="px-5 py-3 text-center"><span className="inline-flex rounded-full bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5">{p.pending_count}</span></td>
                  <td className="px-5 py-3 text-center font-semibold text-slate-700">{p.paid_count}</td>
                  <td className="px-5 py-3 text-right font-head font-bold text-emerald-600">USD$ {p.paid_amount.toLocaleString()}</td>
                </tr>
                );
              })}
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
              <th className="px-5 py-2.5 font-semibold">{tr("帳戶ID")}</th>
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
                    <td className="px-5 py-3 font-mono text-[13px] text-slate-700 whitespace-nowrap"><button onClick={() => setViewUid(t.user_id)} data-testid={`usdt-user-${t.account_id}`} className="inline-flex items-center gap-1 font-bold text-orange-600 hover:underline" title={tr("查看用戶信息")}>{t.account_id || short(t.user_id)}</button></td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700">${t.amount_usd}</td>
                    <td className="px-5 py-3 text-right font-mono text-[13px] text-slate-600">{t.pay_amount} U</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{t.wallet_address ? <button data-testid={`usdt-recent-chain-${t.id}`} onClick={() => setViewAddr(t.wallet_address)} className="inline-flex items-center gap-1 hover:text-orange-600 group"><span className="group-hover:underline">{short(t.wallet_address)}</span><Search className="h-3 w-3 opacity-50 group-hover:opacity-100" /></button> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-center"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}><Icon className="h-3 w-3" />{lbl}</span></td>
                    <td className="px-5 py-3 font-mono text-[12px]">{t.tx_id ? <a href={`https://tronscan.org/#/transaction/${t.tx_id}`} target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">{short(t.tx_id)}</a> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
      <UserInfoDialog uid={viewUid} callApi={callApi} onClose={() => setViewUid("")} />
      <AddressChainDialog address={viewAddr} callApi={callApi} onClose={() => setViewAddr("")} />
    </div>
  );
}
