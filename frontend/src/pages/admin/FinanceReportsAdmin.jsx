import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Download } from "lucide-react";
import { useAuth } from "@clerk/react";
import { tr } from "@/i18n";
import { Btn, Card, Head, Table, useLoad } from "./ui";
import { API } from "@/lib/api";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}

export function FinanceReportsAdmin({ callApi }) {
  const [days, setDays] = useState(30);
  const { getToken } = useAuth();
  const [data] = useLoad(callApi, `/admin/reports?days=${days}`, [days]);
  const exportCsv = async () => {
    const token = await getToken();
    const r = await fetch(`${API}/admin/reports?days=${days}&format=csv`, { headers: { Authorization: `Bearer ${token}`, "X-Admin-Token": sessionStorage.getItem("admin_token") || "" } });
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `finance_report_${days}d.csv`; a.click();
  };
  if (!data) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const t = data.totals;
  const rows = (data.rows || []).map((r) => ({ ...r, d: r.date.slice(5) }));
  return (
    <div data-testid="finance-reports-admin">
      <Head title={tr("財務報表")} sub={tr("每日營收、訂單與充值走勢，支持匯出 CSV")} right={<>
        {[7, 30, 90].map((n) => <Btn key={n} kind={days === n ? "primary" : "ghost"} data-testid={`fin-days-${n}`} onClick={() => setDays(n)}>{tr("近 {0} 天", n)}</Btn>)}
        <Btn kind="ghost" data-testid="fin-export" onClick={exportCsv}><Download className="h-4 w-4" />{tr("匯出 CSV")}</Btn>
      </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={tr("營收 (USD)")} value={`$${(t.revenue_usd || 0).toLocaleString()}`} tone="orange" />
        <Stat label={tr("已付款訂單")} value={t.paid_orders} tone="emerald" />
        <Stat label={tr("充值入帳 (USD)")} value={`$${(t.topup_usd || 0).toLocaleString()}`} tone="sky" />
        <Stat label={tr("新增會員")} value={t.new_users} tone="amber" />
      </div>
      <Card className="p-4" data-testid="fin-chart">
        <div className="text-sm font-semibold text-slate-700 mb-3">{tr("每日營收 vs 充值")}</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="d" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
            <Tooltip /><Legend />
            <Bar dataKey="revenue_usd" name={tr("營收")} fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="topup_usd" name={tr("充值")} fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div className="mt-4">
        <Table testId="fin-table" cols={[tr("日期"), tr("營收"), tr("訂單"), tr("已付款"), tr("充值"), tr("新會員")]} rows={rows} empty={tr("暫無數據")} render={(r, i) => (
          <tr key={i} data-testid={`fin-row-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2 text-slate-600">{r.date}</td><td className="px-4 py-2 font-semibold text-orange-600">${r.revenue_usd}</td><td className="px-4 py-2">{r.orders}</td><td className="px-4 py-2">{r.paid_orders}</td><td className="px-4 py-2 text-emerald-600">${r.topup_usd}</td><td className="px-4 py-2">{r.new_users}</td></tr>
        )} />
      </div>
    </div>
  );
}
