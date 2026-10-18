import { useState } from "react";
import { Search, Wallet, Ticket } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Table, useLoad } from "./ui";
import { UserInfoDialog } from "@/pages/admin/UserInfoDialog";

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <Card className="p-4 flex items-center justify-between" data-testid={`asset-stat-${label}`}>
      <div><div className="text-xs text-slate-500">{label}</div><div className="font-head text-2xl font-bold text-slate-900 mt-1">{value}</div></div>
      <span className={`h-11 w-11 rounded-xl flex items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></span>
    </Card>
  );
}

export function MemberAssetsAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [viewUid, setViewUid] = useState("");
  const [data, load] = useLoad(callApi, `/admin/member-assets?q=${encodeURIComponent(qq)}`); // eslint-disable-line
  const d = data || { rows: [], summary: {} };

  return (
    <div data-testid="assets-admin">
      <Head title={tr("會員資產")} sub={tr("用戶餘額、優惠券持有一覽")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Stat icon={Wallet} label={tr("總餘額 USD")} value={`$${(d.summary.total_balance || 0).toFixed(2)}`} tone="bg-orange-50 text-orange-600" />
        <Stat icon={Ticket} label={tr("會員數")} value={d.summary.members || 0} tone="bg-sky-50 text-sky-600" />
      </div>
      <Card className="p-3 mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" /><input data-testid="asset-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("信箱 / 手機 / 姓名")} className="w-full h-9 rounded-lg bg-slate-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></div>
        <Btn data-testid="asset-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
      </Card>
      <Table testId="assets-table" cols={[tr("帳戶ID"), tr("會員"), tr("餘額"), tr("優惠券")]} empty={data === null ? tr("載入中…") : tr("暫無資料")} rows={d.rows} render={(r) => (
        <tr key={r.user_id} data-testid={`asset-row-${r.user_id}`} className="hover:bg-orange-50/30">
          <td className="px-4 py-3"><button data-testid={`asset-user-${r.user_id}`} onClick={() => setViewUid(r.user_id)} className="font-head font-bold text-orange-600 hover:underline" title={tr("查看用戶信息")}>{r.account_no}</button></td>
          <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">{r.email || r.phone || r.name || "-"}</td>
          <td className="px-4 py-3 font-head font-bold text-orange-600">${r.balance_usd.toFixed(2)}</td>
          <td className="px-4 py-3 text-slate-600">{r.coupons}</td>
        </tr>
      )} />
      <UserInfoDialog uid={viewUid} callApi={callApi} onClose={() => setViewUid("")} />
    </div>
  );
}
