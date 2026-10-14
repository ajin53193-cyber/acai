import { useCallback, useEffect, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Calendar, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Head, Table, Card, Btn } from "./ui";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const QUICK = [
  ["today", "今日", () => { const t = new Date(); return [ymd(t), ymd(t)]; }],
  ["yesterday", "昨日", () => { const t = new Date(); t.setDate(t.getDate() - 1); return [ymd(t), ymd(t)]; }],
  ["week", "本週", () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return [ymd(s), ymd(t)]; }],
  ["month", "本月", () => { const t = new Date(); return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)]; }],
  ["30d", "近 30 天", () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - 29); return [ymd(s), ymd(t)]; }],
];
const dateInp = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Stat = ({ label, value, sub, tone = "text-slate-900", testId }) => (
  <Card className="p-4" data-testid={testId}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`font-head text-2xl font-extrabold mt-1 ${tone}`}>{value}</div>
    {sub && <div className="text-[11px] mt-1 text-slate-400">{sub}</div>}
  </Card>
);

export function GiftCardReportAdmin({ callApi }) {
  const [quick, setQuick] = useState("today");
  const [[from, to], setRange] = useState(() => QUICK[0][2]());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f, t) => {
    setLoading(true);
    try {
      const r = await callApi({ method: "GET", url: "/admin/giftcard/report", params: { date_from: f, date_to: t, tz_offset: new Date().getTimezoneOffset() } });
      setD(r.data);
    } catch { setD(null); toast.error(tr("載入失敗")); }
    setLoading(false);
  }, [callApi]);
  useEffect(() => { load(from, to); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k) => { const q = QUICK.find((x) => x[0] === k); const [f, t] = q[2](); setQuick(k); setRange([f, t]); load(f, t); };
  const query = () => { if (!from || !to) return; setQuick(""); load(from, to); };
  const exportCsv = async () => {
    try {
      const r = await callApi({ method: "GET", url: "/admin/giftcard/report/export", params: { date_from: from, date_to: to, tz_offset: new Date().getTimezoneOffset() }, responseType: "blob" });
      const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = `giftcard_audit_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error(tr("匯出失敗")); }
  };

  const s = d?.summary || {};
  const rows = d?.rows || [];
  const chart = rows.map((r) => ({ ...r, label: r.date.slice(5) }));
  const rate = s.completed && s.redeemed ? ((s.redeemed / Math.max(1, s.completed)) * 100).toFixed(1) : null;

  return (
    <div data-testid="giftcard-report-admin">
      <Head title={tr("禮品卡稽核報表")} sub={d ? `${d.date_from} ~ ${d.date_to}（${tr("共 {0} 天", d.days)}）· ${tr("金額以 USD 計")}` : tr("載入中…")}
        right={<><Btn kind="ghost" data-testid="gcr-export" onClick={exportCsv}><Download className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("匯出 CSV")}</Btn><Btn kind="ghost" data-testid="gcr-refresh" onClick={() => load(from, to)}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Btn></>} />

      <Card className="p-3 mb-5 flex flex-wrap items-center gap-2" data-testid="gcr-filter">
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK.map(([k, l]) => <button key={k} data-testid={`gcr-quick-${k}`} onClick={() => pick(k)} className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors ${quick === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tr(l)}</button>)}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="h-4 w-4 text-orange-500" />
          <input data-testid="gcr-from" type="date" value={from} max={to || undefined} onChange={(e) => setRange([e.target.value, to])} className={dateInp} />
          <span className="text-slate-400">—</span>
          <input data-testid="gcr-to" type="date" value={to} min={from || undefined} onChange={(e) => setRange([from, e.target.value])} className={dateInp} />
          <Btn data-testid="gcr-query" onClick={query}>{tr("查詢")}</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5" data-testid="gcr-stats">
        <Stat testId="gcr-stat-sold" label={tr("售出")} value={`${s.sold ?? 0} ${tr("筆")}`} sub={money(s.sold_usd)} tone="text-orange-600" />
        <Stat testId="gcr-stat-completed" label={tr("轉贈完成")} value={`${s.completed ?? 0} ${tr("筆")}`} sub={money(s.completed_usd)} tone="text-emerald-600" />
        <Stat testId="gcr-stat-redeemed" label={tr("已核銷")} value={`${s.redeemed ?? 0} ${tr("筆")}`} sub={`${money(s.redeemed_usd)}${rate ? ` · ${tr("核銷率")} ${rate}%` : ""}`} tone="text-violet-600" />
        <Stat testId="gcr-stat-manual" label={tr("待人工審核（目前）")} value={s.manual_pending ?? 0} sub={tr("未核銷交易號 {0} 個", s.unredeemed ?? 0)} tone={s.manual_pending > 0 ? "text-red-500" : "text-slate-900"} />
      </div>

      <Card className="p-4 mb-5" data-testid="gcr-chart">
        <div className="text-sm font-semibold text-slate-700 mb-3">{tr("每日趨勢")}</div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => (String(n).includes("USD") ? money(v) : v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="sold_usd" name={tr("售出金額 USD")} fill="#fb923c" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="l" dataKey="completed_usd" name={tr("完成金額 USD")} fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="l" dataKey="redeemed_usd" name={tr("核銷金額 USD")} fill="#a78bfa" radius={[4, 4, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="sold" name={tr("售出筆數")} stroke="#f97316" strokeWidth={2} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="redeemed" name={tr("核銷筆數")} stroke="#7c3aed" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Table testId="gcr-table" cols={[tr("日期"), tr("售出筆數"), tr("售出金額"), tr("完成筆數"), tr("完成金額"), tr("核銷筆數"), tr("核銷金額")]} rows={rows} empty={tr("暫無資料")} render={(r) => (
        <tr key={r.date} data-testid={`gcr-row-${r.date}`} className="hover:bg-slate-50">
          <td className="px-4 py-2.5 font-mono text-xs">{r.date}</td>
          <td className="px-4 py-2.5">{r.sold}</td><td className="px-4 py-2.5 text-orange-600 font-semibold">{money(r.sold_usd)}</td>
          <td className="px-4 py-2.5">{r.completed}</td><td className="px-4 py-2.5 text-emerald-600 font-semibold">{money(r.completed_usd)}</td>
          <td className="px-4 py-2.5">{r.redeemed}</td><td className="px-4 py-2.5 text-violet-600 font-semibold">{money(r.redeemed_usd)}</td>
        </tr>
      )} />
      {rows.length > 0 && (
        <Card className="mt-3 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="gcr-total">
          <span className="font-semibold text-slate-700">{tr("合計")}</span>
          <span>{tr("售出")} <b>{s.sold}</b> {tr("筆")} / <b className="text-orange-600">{money(s.sold_usd)}</b></span>
          <span>{tr("完成")} <b>{s.completed}</b> {tr("筆")} / <b className="text-emerald-600">{money(s.completed_usd)}</b></span>
          <span>{tr("核銷")} <b>{s.redeemed}</b> {tr("筆")} / <b className="text-violet-600">{money(s.redeemed_usd)}</b></span>
        </Card>
      )}
    </div>
  );
}
