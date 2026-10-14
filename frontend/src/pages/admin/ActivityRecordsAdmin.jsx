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

export function ActivityRecordsAdmin({ callApi }) {
  const [type, setType] = useState("all");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    callApi({ method: "GET", url: `/admin/activity-records?type=${type}&limit=300` }).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [type, callApi]);

  return (
    <div data-testid="activity-records-admin">
      <Head title={tr("活動記錄")} sub={tr("統一查看秒殺搶購、積分抽獎、套餐下單的全部記錄")} />
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
