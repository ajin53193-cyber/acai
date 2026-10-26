import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { tr } from "@/i18n";
import { Btn, Card, Head, Table, useLoad } from "./ui";
import { API } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function ReportsAdmin({ callApi }) {
  const [days, setDays] = useState(30);
  const { getToken } = useAuth();
  const [data] = useLoad(callApi, `/admin/reports?days=${days}`);
  const exportCsv = async () => {
    const token = await getToken();
    const r = await fetch(`${API}/admin/reports?days=${days}&format=csv`, { headers: { Authorization: `Bearer ${token}`, "X-Admin-Token": localStorage.getItem("admin_token") || "" } });
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `report_${days}d.csv`; a.click();
  };
  if (!data) return null;
  const t = data.totals;
  const cards = [[tr("營收 (USD)"), `$${t.revenue_usd.toLocaleString()}`], [tr("訂單數"), t.orders], [tr("已付款訂單"), t.paid_orders], [tr("USDT 充值 (USD)"), `$${t.topup_usd.toLocaleString()}`], [tr("充值筆數"), t.topups], [tr("新增會員"), t.new_users]];
  const rows = data.rows.map((r) => ({ ...r, d: r.date.slice(5) }));
  return (
    <div>
      <Head title={tr("數據報表")} sub={tr("每日營收 / 訂單 / 充值 / 新會員統計")} right={<>
        {[7, 30, 90].map((n) => <Btn key={n} kind={days === n ? "primary" : "ghost"} data-testid={`report-days-${n}`} onClick={() => setDays(n)}>{tr("近 {0} 天", n)}</Btn>)}
        <Btn kind="ghost" data-testid="report-export" onClick={exportCsv}>{tr("匯出 CSV")}</Btn>
      </>} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">{cards.map(([l, v]) => <Card key={l} className="p-4"><div className="font-head text-xl font-extrabold text-slate-900">{v}</div><div className="text-[11px] text-slate-500 mt-1">{l}</div></Card>)}</div>
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {[[tr("每日營收 (USD)"), "revenue_usd", "#f97316"], [tr("每日訂單數"), "orders", "#0ea5e9"], [tr("每日 USDT 充值 (USD)"), "topup_usd", "#10b981"], [tr("每日新增會員"), "new_users", "#8b5cf6"]].map(([title, key, color]) => (
          <Card key={key} className="p-4" data-testid={`chart-${key}`}>
            <div className="text-sm font-semibold text-slate-800 mb-2">{title}</div>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ left: -20, right: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={days > 30 ? 9 : days > 7 ? 4 : 0} /><YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey={key} fill={color} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Card>
        ))}
      </div>
      <Table testId="report-table" cols={[tr("日期"), tr("訂單數"), tr("已付款"), tr("營收 USD"), tr("充值筆數"), tr("充值 USD"), tr("新會員")]} rows={[...data.rows].reverse()} render={(r) => (
        <tr key={r.date} className="hover:bg-slate-50/60"><td className="px-4 py-2.5 text-slate-700">{r.date}</td><td className="px-4 py-2.5">{r.orders}</td><td className="px-4 py-2.5">{r.paid_orders}</td><td className="px-4 py-2.5 font-semibold text-slate-900">${r.revenue_usd.toFixed(2)}</td><td className="px-4 py-2.5">{r.topups}</td><td className="px-4 py-2.5">${r.topup_usd.toFixed(2)}</td><td className="px-4 py-2.5">{r.new_users}</td></tr>
      )} />
    </div>
  );
}
