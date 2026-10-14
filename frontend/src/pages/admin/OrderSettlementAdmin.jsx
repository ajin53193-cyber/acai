import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Head, Btn, Table, Pill, Card, fmt } from "./ui";
import { StatusBadge } from "@/lib/status";

function Stat({ label, value, tone = "slate" }) {
  return <Card className="p-4"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div></Card>;
}

export function OrderSettlementAdmin({ callApi }) {
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState("no");
  const [data, setData] = useState(null);
  const [sel, setSel] = useState([]);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/finance/settlement?days=${days}&settled=${filter}` }).then((r) => { setData(r.data); setSel([]); }).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, days, filter]);
  useEffect(() => { load(); }, [load]);
  const rows = data?.rows || [];
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const allChecked = rows.length > 0 && sel.length === rows.length;
  const settle = async (unsettle) => {
    if (!sel.length) return toast.error(tr("請選擇訂單"));
    try { await callApi({ method: "POST", url: "/admin/finance/settle", data: { order_ids: sel, unsettle } }); toast.success(unsettle ? tr("已取消結算") : tr("已標記結算")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  return (
    <div data-testid="order-settlement-admin">
      <Head title={tr("訂單結算")} sub={tr("勾選已完成訂單標記為已結算，掌握待結算金額")} right={<>
        {[7, 30, 90].map((n) => <Btn key={n} kind={days === n ? "primary" : "ghost"} data-testid={`settle-days-${n}`} onClick={() => setDays(n)}>{tr("近 {0} 天", n)}</Btn>)}
      </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={tr("訂單總額 (USD)")} value={`$${data?.total_amount ?? 0}`} tone="slate" />
        <Stat label={tr("已結算 (USD)")} value={`$${data?.settled_amount ?? 0}`} tone="emerald" />
        <Stat label={tr("待結算 (USD)")} value={`$${data?.unsettled_amount ?? 0}`} tone="orange" />
        <Stat label={tr("待結算筆數")} value={data?.unsettled_count ?? 0} tone="amber" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <select data-testid="settle-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
          <option value="no">{tr("待結算")}</option><option value="yes">{tr("已結算")}</option><option value="">{tr("全部")}</option>
        </select>
        <Btn kind="ok" data-testid="settle-mark" onClick={() => settle(false)}>{tr("標記結算 ({0})", sel.length)}</Btn>
        <Btn kind="ghost" data-testid="settle-unmark" onClick={() => settle(true)}>{tr("取消結算")}</Btn>
      </div>
      <Table testId="settlement-table" cols={[<input key="a" type="checkbox" data-testid="settle-select-all" checked={allChecked} onChange={() => setSel(allChecked ? [] : rows.map((r) => r.id))} className="h-4 w-4 accent-orange-500" />, tr("訂單號"), tr("帳號"), tr("金額"), tr("狀態"), tr("結算"), tr("時間")]}
        empty={data === null ? tr("載入中…") : tr("暫無訂單")} rows={rows} render={(r, i) => (
          <tr key={r.id} data-testid={`settle-row-${i}`} className="hover:bg-orange-50/30">
            <td className="px-4 py-2.5"><input type="checkbox" data-testid={`settle-check-${i}`} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-orange-500" /></td>
            <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">{r.id.slice(-10)}</td>
            <td className="px-4 py-2.5 text-slate-500">#{r.account}</td>
            <td className="px-4 py-2.5 font-semibold text-slate-800">${r.total_usd}</td>
            <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-2.5">{r.settled ? <Pill tone="emerald">{tr("已結算")}</Pill> : <Pill tone="amber">{tr("待結算")}</Pill>}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs">{fmt(r.created_at)}</td>
          </tr>
        )} />
    </div>
  );
}
