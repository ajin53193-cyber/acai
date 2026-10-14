import { useEffect, useState } from "react";
import { Zap, Gift, Package, ListChecks } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Table, Pill, fmt } from "./ui";

const TABS = [
  { key: "all", label: tr("全部"), icon: ListChecks },
  { key: "seckill", label: tr("秒殺"), icon: Zap },
  { key: "lottery", label: tr("抽獎"), icon: Gift },
  { key: "combo", label: tr("套餐"), icon: Package },
];
const TYPE_META = {
  seckill: { label: tr("秒殺"), tone: "rose", Icon: Zap },
  lottery: { label: tr("抽獎"), tone: "orange", Icon: Gift },
  combo: { label: tr("套餐"), tone: "violet", Icon: Package },
};

const SERIES = [
  { key: "seckill", label: tr("秒殺"), color: "#f43f5e" },
  { key: "lottery", label: tr("抽獎"), color: "#f97316" },
  { key: "combo", label: tr("套餐"), color: "#8b5cf6" },
];

function TrendChart({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.seckill, d.lottery, d.combo]));
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5" data-testid="activity-trend">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">{tr("近 7 日活動趨勢")}</div>
        <div className="flex gap-3">{SERIES.map((s) => <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
      </div>
      <div className="flex items-end gap-2 h-32">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1" data-testid={`trend-day-${d.date}`}>
            <div className="flex items-end gap-0.5 h-24 w-full justify-center">
              {SERIES.map((s) => (
                <div key={s.key} className="w-2 sm:w-2.5 rounded-t transition-all" title={`${s.label} ${d[s.key]}`}
                  style={{ height: `${Math.max(2, (d[s.key] / max) * 96)}px`, background: s.color }} />
              ))}
            </div>
            <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityRecordsAdmin({ callApi }) {
  const [type, setType] = useState("all");
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/activity-stats" }).then((r) => setStats(r.data)).catch(() => {}); }, [callApi]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/activity-trend?days=7" }).then((r) => setTrend(r.data)).catch(() => {}); }, [callApi]);
  useEffect(() => {
    setRows(null);
    callApi({ method: "GET", url: `/admin/activity-records?type=${type}&limit=300` }).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [type, callApi]);

  const Stat = ({ icon: Ic, tone, label, value, sub }) => (
    <div className="flex-1 min-w-[150px] bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold text-${tone}-600 mb-1.5`}><Ic className="h-4 w-4" />{label}</div>
      <div className="font-head text-2xl font-extrabold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div data-testid="activity-records-admin">
      <Head title={tr("活動記錄")} sub={tr("統一查看秒殺搶購、積分抽獎、套餐下單的全部記錄")} />
      {stats && (
        <div className="flex flex-wrap gap-3 mb-5" data-testid="activity-stats">
          <Stat icon={Zap} tone="rose" label={tr("今日秒殺")} value={`${stats.seckill.units} ${tr("件")}`} sub={`$${stats.seckill.revenue_usd.toFixed(2)}`} />
          <Stat icon={Gift} tone="orange" label={tr("今日抽獎")} value={`${stats.lottery.draws} ${tr("次")}`} sub={tr("中真實獎 {0} 次", stats.lottery.real_wins)} />
          <Stat icon={Package} tone="violet" label={tr("今日套餐")} value={`${stats.combo.orders} ${tr("單")}`} sub={`$${stats.combo.revenue_usd.toFixed(2)} · ${tr("省")} $${stats.combo.saved_usd.toFixed(2)}`} />
        </div>
      )}
      {trend.length > 0 && <TrendChart data={trend} />}
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} data-testid={`act-tab-${t.key}`} onClick={() => setType(t.key)}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors ${type === t.key ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      <Table testId="act-table" cols={[tr("時間"), tr("類型"), tr("帳戶ID"), tr("用戶"), tr("內容"), tr("明細"), tr("金額"), tr("狀態")]}
        empty={rows === null ? tr("載入中…") : tr("暫無記錄")} rows={rows || []} render={(r, i) => {
          const m = TYPE_META[r.type] || {};
          const Ic = m.Icon || ListChecks;
          return (
            <tr key={i} data-testid={`act-row-${i}`} className="hover:bg-orange-50/30">
              <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
              <td className="px-4 py-2"><Pill tone={m.tone || "slate"}><Ic className="h-3 w-3 mr-1 inline" />{m.label || r.type}</Pill></td>
              <td className="px-4 py-2 text-xs font-mono text-slate-600">{r.account_no}</td>
              <td className="px-4 py-2 text-xs text-slate-600 truncate max-w-[150px]">{r.user_label}</td>
              <td className="px-4 py-2 text-sm text-slate-800 truncate max-w-[220px]">{r.title}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{r.detail}</td>
              <td className="px-4 py-2 font-head font-semibold text-orange-600">{r.amount_usd != null ? `$${Number(r.amount_usd).toFixed(2)}` : "-"}</td>
              <td className="px-4 py-2"><span className="text-xs text-slate-500">{r.ref || r.status}</span></td>
            </tr>
          );
        }} />
    </div>
  );
}
