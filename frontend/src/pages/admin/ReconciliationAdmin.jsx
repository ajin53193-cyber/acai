import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Scale, AlertTriangle } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Table, Pill, Card } from "./ui";
import { StatusBadge } from "@/lib/status";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}
const STONE = { paid: "emerald", pending: "amber", cancelled: "slate", failed: "red", expired: "slate" };

export function ReconciliationAdmin({ callApi }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/finance/reconciliation?days=${days}` }).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, days]);
  useEffect(() => { load(); }, [load]);
  return (
    <div data-testid="reconciliation-admin">
      <Head title={tr("財務對賬")} sub={tr("按支付渠道核對充值入帳與訂單消耗，發現待處理款項")} right={<>
        {[7, 30, 90].map((n) => <Btn key={n} kind={days === n ? "primary" : "ghost"} data-testid={`recon-days-${n}`} onClick={() => setDays(n)}>{tr("近 {0} 天", n)}</Btn>)}
      </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={tr("充值入帳 (USD)")} value={`$${data?.topup_paid ?? 0}`} tone="emerald" />
        <Stat label={tr("待確認充值 (USD)")} value={`$${data?.topup_pending ?? 0}`} tone="amber" />
        <Stat label={tr("待確認筆數")} value={data?.topup_pending_count ?? 0} tone="orange" />
        <Stat label={tr("訂單消耗 (USD)")} value={`$${data?.order_revenue ?? 0}`} tone="slate" />
      </div>
      {(data?.topup_pending_count || 0) > 0 && <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-4" data-testid="recon-alert"><AlertTriangle className="h-4 w-4" />{tr("有 {0} 筆充值待確認，請及時對賬處理", data.topup_pending_count)}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="font-head font-bold text-slate-800 mb-2 flex items-center gap-2"><Scale className="h-4 w-4 text-emerald-500" />{tr("充值流水（按渠道/狀態）")}</div>
          <Table testId="recon-topups" cols={[tr("渠道"), tr("狀態"), tr("筆數"), tr("金額")]} empty={data === null ? tr("載入中…") : tr("暫無充值")} rows={data?.topups || []} render={(r, i) => (
            <tr key={i} data-testid={`recon-topup-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2.5 font-medium text-slate-700">{r.provider}</td><td className="px-4 py-2.5"><Pill tone={STONE[r.status] || "slate"}>{r.status}</Pill></td><td className="px-4 py-2.5">{r.count}</td><td className="px-4 py-2.5 font-semibold">${r.amount}</td></tr>
          )} />
        </div>
        <div>
          <div className="font-head font-bold text-slate-800 mb-2 flex items-center gap-2"><Scale className="h-4 w-4 text-sky-500" />{tr("訂單（按狀態）")}</div>
          <Table testId="recon-orders" cols={[tr("狀態"), tr("筆數"), tr("金額")]} empty={data === null ? tr("載入中…") : tr("暫無訂單")} rows={data?.orders || []} render={(r, i) => (
            <tr key={i} data-testid={`recon-order-${i}`} className="hover:bg-slate-50"><td className="px-4 py-2.5"><StatusBadge status={r.status} /></td><td className="px-4 py-2.5">{r.count}</td><td className="px-4 py-2.5 font-semibold">${r.amount}</td></tr>
          )} />
        </div>
      </div>
    </div>
  );
}
