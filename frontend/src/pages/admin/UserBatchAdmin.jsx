import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Pill } from "./ui";

export function UserBatchAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  const [action, setAction] = useState("add_points");
  const [value, setValue] = useState("");
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/members?q=${encodeURIComponent(q)}&limit=200` }).then((r) => { setRows(r.data); setSel([]); }).catch(() => toast.error(tr("載入失敗"))), [callApi, q]);
  useEffect(() => { load(); }, [load]);
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const all = rows && rows.length > 0 && sel.length === rows.length;
  const run = async () => {
    if (!sel.length) return toast.error(tr("請選擇用戶"));
    if ((action === "add_points" || action === "add_tag") && !value.trim()) return toast.error(tr("請填寫數值 / 標籤"));
    try { const r = await callApi({ method: "POST", url: "/admin/users/batch", data: { user_ids: sel, action, value } }); toast.success(tr("已對 {0} 位用戶執行", r.data.count)); setValue(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  return (
    <div data-testid="user-batch-admin">
      <Head title={tr("用戶批量操作")} sub={tr("勾選用戶後批量封禁/解封、打標籤或發放積分")} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="ub-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={tr("搜尋信箱 / 手機 / 帳號")} className="pl-8 w-60" /></div>
        <select data-testid="ub-action" value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
          <option value="add_points">{tr("發放積分")}</option><option value="add_tag">{tr("添加標籤")}</option><option value="ban">{tr("封禁")}</option><option value="unban">{tr("解封")}</option>
        </select>
        {(action === "add_points" || action === "add_tag") && <Input data-testid="ub-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={action === "add_points" ? tr("積分數量") : tr("標籤名")} className="w-32" />}
        <Btn data-testid="ub-run" onClick={run}>{tr("執行 ({0})", sel.length)}</Btn>
      </div>
      <Table testId="ub-table" cols={[<input key="a" type="checkbox" data-testid="ub-all" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.user_id))} className="h-4 w-4 accent-orange-500" />, tr("用戶"), tr("帳號"), tr("積分"), tr("狀態")]}
        empty={rows === null ? tr("載入中…") : tr("暫無用戶")} rows={rows || []} render={(u, i) => (
          <tr key={u.user_id} data-testid={`ub-row-${i}`} className="hover:bg-orange-50/30">
            <td className="px-4 py-2.5"><input type="checkbox" data-testid={`ub-check-${i}`} checked={sel.includes(u.user_id)} onChange={() => toggle(u.user_id)} className="h-4 w-4 accent-orange-500" /></td>
            <td className="px-4 py-2.5 text-slate-700">{u.email || u.phone || "-"}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs">#{u.account || (u.user_id || "").slice(-8)}</td>
            <td className="px-4 py-2.5">{u.points ?? 0}</td>
            <td className="px-4 py-2.5">{u.banned ? <Pill tone="red">{tr("已封禁")}</Pill> : <Pill tone="emerald">{tr("正常")}</Pill>}</td>
          </tr>
        )} />
    </div>
  );
}
