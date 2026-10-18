import { useCallback, useEffect, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Calendar, RefreshCw } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Table, Card, Btn, Pill } from "./ui";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const QUICK = [
  ["today", "今日", () => { const t = new Date(); return [ymd(t), ymd(t)]; }],
  ["yesterday", "昨日", () => { const t = new Date(); t.setDate(t.getDate() - 1); return [ymd(t), ymd(t)]; }],
  ["week", "本週", () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return [ymd(s), ymd(t)]; }],
  ["month", "本月", () => { const t = new Date(); return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)]; }],
  ["30d", "近 30 天", () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - 29); return [ymd(s), ymd(t)]; }],
];
const STATUS_LABEL = { pending: "待支付", pending_payment: "待支付", paid: "已支付", processing: "充值中", shipped: "已發貨", completed: "已完成", cancelled: "已取消", failed: "異常", refunded: "已退款" };
const dateInp = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";

function Stat({ label, value, raw, prev, tone = "slate", testId }) {
  const cur = raw ?? value;
  const diff = prev !== undefined && prev !== null && Number(prev) > 0 ? ((Number(cur) - Number(prev)) / Number(prev)) * 100 : null;
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-head text-2xl font-extrabold mt-1 ${tone}`}>{value}</div>
      {diff !== null && <div className={`text-[11px] mt-1 ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}% {tr("較上期")}</div>}
      {diff === null && prev !== undefined && <div className="text-[11px] mt-1 text-slate-400">{tr("上期無數據")}</div>}
    </Card>
  );
}

export function SalesAnalysisAdmin({ callApi }) {
  const [quick, setQuick] = useState("today");
  const [[from, to], setRange] = useState(() => QUICK[0][2]());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f, t) => {
    setLoading(true);
    try {
      const r = await callApi({ method: "GET", url: "/admin/analytics/sales", params: { date_from: f, date_to: t, tz_offset: -480 } });
      setD(r.data);
    } catch { setD(null); }
    setLoading(false);
  }, [callApi]);
  useEffect(() => { load(from, to); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k) => { const q = QUICK.find((x) => x[0] === k); const [f, t] = q[2](); setQuick(k); setRange([f, t]); load(f, t); };
  const query = () => { if (!from || !to) return; setQuick(""); load(from, to); };

  const s = d?.summary || {};
  const p = d?.prev || {};
  const max = Math.max(1, ...(d?.top_products || []).map((x) => x.amount));
  const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div data-testid="sales-analysis-admin">
      <Head title={tr("銷售分析")} sub={d ? `${d.date_from} ~ ${d.date_to}（${tr("共 {0} 天", d.days)}）` : tr("載入中…")} right={<Btn kind="ghost" data-testid="sales-refresh" onClick={() => load(from, to)}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Btn>} />

      <Card className="p-3 mb-5 flex flex-wrap items-center gap-2" data-testid="sales-filter">
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK.map(([k, l]) => <button key={k} data-testid={`sales-quick-${k}`} onClick={() => pick(k)} className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors ${quick === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tr(l)}</button>)}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="h-4 w-4 text-orange-500" />
          <input data-testid="sales-from" type="date" value={from} max={to || undefined} onChange={(e) => setRange([e.target.value, to])} className={dateInp} />
          <span className="text-slate-400">—</span>
          <input data-testid="sales-to" type="date" value={to} min={from || undefined} onChange={(e) => setRange([from, e.target.value])} className={dateInp} />
          <Btn data-testid="sales-query" onClick={query}>{tr("查詢")}</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5" data-testid="sales-stats">
        <Stat testId="sales-stat-revenue" label={tr("訂單營收 (USD)")} value={money(s.revenue_usd)} raw={s.revenue_usd} prev={p.revenue_usd} tone="text-orange-600" />
        <Stat testId="sales-stat-orders" label={tr("訂單數")} value={s.orders ?? 0} prev={p.orders} tone="text-slate-900" />
        <Stat testId="sales-stat-paid" label={tr("已付款訂單")} value={s.paid_orders ?? 0} tone="text-emerald-600" />
        <Stat testId="sales-stat-avg" label={tr("客單價 (USD)")} value={money(s.avg_order_usd)} tone="text-slate-900" />
        <Stat testId="sales-stat-topup" label={tr("充值到帳 (USD)")} value={money(s.topup_usd)} raw={s.topup_usd} prev={p.topup_usd} tone="text-sky-600" />
        <Stat testId="sales-stat-users" label={tr("新增用戶")} value={s.new_users ?? 0} prev={p.new_users} tone="text-violet-600" />
      </div>

      <Card className="p-4 mb-5" data-testid="sales-chart">
        <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold text-slate-700">{tr("營收 / 充值 / 訂單走勢")}</div><div className="text-[11px] text-slate-400">{d?.hourly ? tr("按小時") : tr("按日")}</div></div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={d?.series || []} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
            <YAxis yAxisId="usd" tick={{ fontSize: 11, fill: "#64748b" }} width={56} tickFormatter={(v) => `$${v}`} />
            <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} width={32} allowDecimals={false} />
            <Tooltip formatter={(v, n) => [n.includes("USD") ? money(v) : v, n]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="usd" dataKey="revenue_usd" name={tr("訂單營收 USD")} fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="usd" dataKey="topup_usd" name={tr("充值到帳 USD")} fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Line yAxisId="n" type="linear" dataKey="orders" name={tr("訂單數")} stroke="#0f172a" strokeWidth={2} dot={false} />
            <Line yAxisId="n" type="linear" dataKey="new_users" name={tr("新增用戶")} stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-700 mb-3">{tr("熱銷商品 Top 15（按銷售額）")}</div>
          <div className="space-y-2" data-testid="sales-top">
            {(d?.top_products || []).map((x, i) => (
              <div key={i} data-testid={`sales-top-${i}`} className="flex items-center gap-2">
                <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                <span className="w-36 truncate text-sm text-slate-700" title={x.name}>{x.name}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded"><div className="h-5 rounded bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${(x.amount / max) * 100}%` }} /></div>
                <span className="w-24 text-right text-xs font-semibold text-orange-600">{money(x.amount)}</span>
                <span className="w-12 text-right text-[11px] text-slate-400">×{x.qty}</span>
              </div>
            ))}
            {(d?.top_products || []).length === 0 && <div className="text-center text-slate-400 text-sm py-6">{tr("暫無銷售數據")}</div>}
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">{tr("訂單狀態分佈")}</div>
            <div className="space-y-1.5" data-testid="sales-status">
              {(d?.status_dist || []).map((x, i) => <div key={i} className="flex items-center justify-between text-sm"><span className="text-slate-600">{tr(STATUS_LABEL[x.status] || x.status)}</span><span className="font-head font-bold text-slate-900">{x.count}</span></div>)}
              {(d?.status_dist || []).length === 0 && <div className="text-center text-slate-400 text-sm py-4">{tr("暫無訂單")}</div>}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">{tr("充值渠道佔比")}</div>
            <Table testId="sales-channels" cols={[tr("渠道"), tr("筆數"), tr("金額")]} rows={d?.channels || []} empty={tr("暫無充值")} render={(c, i) => (
              <tr key={i} data-testid={`sales-channel-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2.5"><Pill tone="sky">{c.provider}</Pill></td><td className="px-4 py-2.5">{c.count}</td><td className="px-4 py-2.5 font-semibold text-emerald-600">{money(c.amount)}</td></tr>
            )} />
          </Card>
        </div>
      </div>
    </div>
  );
}
