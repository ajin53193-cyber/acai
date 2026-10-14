import { useState } from "react";
import { toast } from "sonner";
import { Search, ShieldBan, RotateCcw } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Table, fmt, useLoad } from "./ui";

export function BlacklistAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [list, load] = useLoad(callApi, `/admin/blacklist?q=${encodeURIComponent(qq)}`); // eslint-disable-line

  const unban = async (u) => {
    if (!window.confirm(tr("解除封禁此會員？"))) return;
    try { await callApi({ method: "POST", url: `/admin/members/${u.user_id}/unban` }); toast.success(tr("已解除封禁")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };

  return (
    <div data-testid="blacklist-admin">
      <Head title={tr("黑名單管理")} sub={tr("被封禁的會員將無法登入與下單；可在此解除封禁。封禁操作在「用戶列表 → 會員詳情」中進行")} />
      <Card className="p-3 mb-4 flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-red-400 ml-1" />
        <div className="relative flex-1 max-w-md"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" /><input data-testid="blacklist-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("信箱 / 手機 / 姓名")} className="w-full h-9 rounded-lg bg-slate-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></div>
        <Btn data-testid="blacklist-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
      </Card>
      <Table testId="blacklist-table" cols={[tr("帳戶ID"), tr("會員"), tr("封禁原因"), tr("封禁時間"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("黑名單為空")} rows={list || []} render={(u) => (
        <tr key={u.user_id} data-testid={`blacklist-row-${u.user_id}`} className="hover:bg-red-50/30">
          <td className="px-4 py-3 font-head font-bold text-slate-900">{u.account_no}</td>
          <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">{u.email || u.phone || u.name || "-"}</td>
          <td className="px-4 py-3 text-slate-600">{u.ban_reason || <span className="text-slate-400">{tr("未填寫")}</span>}</td>
          <td className="px-4 py-3 text-slate-500">{fmt(u.banned_at)}</td>
          <td className="px-4 py-3"><Btn kind="ok" data-testid={`blacklist-unban-${u.user_id}`} onClick={() => unban(u)}><RotateCcw className="h-3.5 w-3.5" />{tr("解封")}</Btn></td>
        </tr>
      )} />
    </div>
  );
}
