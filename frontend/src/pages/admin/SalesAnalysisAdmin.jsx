import { tr } from "@/i18n";
import { Head, Table, Card, useLoad, Pill } from "./ui";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}

export function SalesAnalysisAdmin({ callApi }) {
  const [d] = useLoad(callApi, "/admin/analytics/sales?days=30");
  if (!d) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const max = Math.max(1, ...(d.top_products || []).map((p) => p.amount));
  return (
    <div data-testid="sales-analysis-admin">
      <Head title={tr("銷售分析")} sub={tr("近 30 天熱銷商品與充值渠道佔比")} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">{tr("熱銷商品 Top 15（按銷售額）")}</div>
          <div className="space-y-2" data-testid="sales-top">
            {(d.top_products || []).map((p, i) => (
              <div key={i} data-testid={`sales-top-${i}`} className="flex items-center gap-2">
                <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                <span className="w-32 truncate text-sm text-slate-700">{p.name}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded"><div className="h-5 rounded bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${(p.amount / max) * 100}%` }} /></div>
                <span className="w-20 text-right text-xs font-semibold text-orange-600">${p.amount}</span>
                <span className="w-12 text-right text-[11px] text-slate-400">×{p.qty}</span>
              </div>
            ))}
            {(d.top_products || []).length === 0 && <div className="text-center text-slate-400 text-sm py-6">{tr("暫無銷售數據")}</div>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">{tr("充值渠道佔比")}</div>
          <Table testId="sales-channels" cols={[tr("渠道"), tr("筆數"), tr("金額")]} rows={d.channels || []} empty={tr("暫無充值")} render={(c, i) => (
            <tr key={i} data-testid={`sales-channel-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2.5"><Pill tone="sky">{c.provider}</Pill></td><td className="px-4 py-2.5">{c.count}</td><td className="px-4 py-2.5 font-semibold text-emerald-600">${c.amount}</td></tr>
          )} />
        </Card>
      </div>
    </div>
  );
}
