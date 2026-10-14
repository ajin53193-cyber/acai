import { tr } from "@/i18n";
import { Head, Table, Card, useLoad, Pill } from "./ui";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}

export function UserReportsAdmin({ callApi }) {
  const [d] = useLoad(callApi, "/admin/user-reports?days=30");
  if (!d) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  return (
    <div data-testid="user-reports-admin">
      <Head title={tr("用戶報表統計")} sub={tr("用戶規模與消費排行")} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label={tr("總用戶數")} value={d.total_users} tone="orange" />
        <Stat label={tr("近30天新增")} value={d.new_users} tone="emerald" />
        <Stat label={tr("封禁用戶")} value={d.banned} tone="red" />
      </div>
      <div className="grid grid-cols-1 gap-5">
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">{tr("消費排行 Top 15")}</div>
          <Table testId="ur-spenders" cols={[tr("排名"), tr("帳號"), tr("消費額"), tr("訂單數")]} rows={d.top_spenders || []} empty={tr("暫無數據")} render={(r, i) => (
            <tr key={i} data-testid={`ur-spender-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2.5">{i + 1}</td><td className="px-4 py-2.5 text-slate-500">#{r.account}</td><td className="px-4 py-2.5 font-semibold text-orange-600">${r.spent}</td><td className="px-4 py-2.5">{r.orders}</td></tr>
          )} />
        </Card>
      </div>
    </div>
  );
}
