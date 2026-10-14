import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Table, Card, fmt } from "./ui";
import { StatusBadge } from "@/lib/status";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}

export function RealtimeAdmin({ callApi }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/analytics/realtime" }).then((r) => setD(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  return (
    <div data-testid="realtime-admin">
      <Head title={tr("實時監控")} sub={tr("今日實時經營數據（每 15 秒自動刷新）")} right={<Btn kind="ghost" data-testid="rt-refresh" onClick={load}><RefreshCw className="h-4 w-4" />{tr("刷新")}</Btn>} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Stat label={tr("今日訂單")} value={d?.orders_today ?? "—"} tone="orange" />
        <Stat label={tr("今日營收")} value={`$${d?.revenue_today ?? 0}`} tone="emerald" />
        <Stat label={tr("今日充值筆數")} value={d?.topups_today ?? "—"} tone="sky" />
        <Stat label={tr("今日充值額")} value={`$${d?.topup_amount_today ?? 0}`} tone="teal" />
        <Stat label={tr("今日新會員")} value={d?.new_users_today ?? "—"} tone="violet" />
        <Stat label={tr("待確認充值")} value={d?.pending_topups ?? "—"} tone="amber" />
      </div>
      <div className="text-sm font-semibold text-slate-700 mb-2">{tr("最新訂單")}</div>
      <Table testId="rt-orders" cols={[tr("訂單號"), tr("帳號"), tr("金額"), tr("狀態"), tr("時間")]} rows={d?.recent_orders || []} empty={tr("今日暫無訂單")} render={(o, i) => (
        <tr key={o.id} data-testid={`rt-order-${i}`} className="hover:bg-orange-50/30"><td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">{o.id.slice(-10)}</td><td className="px-4 py-2.5 text-slate-500">#{o.account}</td><td className="px-4 py-2.5 font-semibold">${o.total_usd}</td><td className="px-4 py-2.5"><StatusBadge status={o.status} /></td><td className="px-4 py-2.5 text-slate-400 text-xs">{fmt(o.created_at)}</td></tr>
      )} />
    </div>
  );
}
