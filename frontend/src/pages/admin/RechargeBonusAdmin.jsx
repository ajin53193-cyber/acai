import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, useLoad } from "./ui";

const empty = { min_usd: 10, bonus_type: "fixed_usd", bonus_value: 1, active: true };
const TYPE_LABEL = { fixed_usd: tr("送固定金額 USD"), percent: tr("按比例贈送 %"), points: tr("贈送積分") };
const TYPE_TONE = { fixed_usd: "emerald", percent: "orange", points: "amber" };

export function RechargeBonusAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/recharge-bonus");
  const [edit, setEdit] = useState(null);

  const save = async () => {
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/recharge-bonus/${edit.id}`, data: edit });
      else await callApi({ method: "POST", url: "/admin/recharge-bonus", data: edit });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (r) => { if (!window.confirm(tr("刪除此充值贈送規則？"))) return; await callApi({ method: "DELETE", url: `/admin/recharge-bonus/${r.id}` }); load(); };
  const valLabel = (r) => r.bonus_type === "fixed_usd" ? `+USD$ ${Number(r.bonus_value).toFixed(2)}` : r.bonus_type === "percent" ? `+${r.bonus_value}%` : `+${r.bonus_value} ${tr("積分")}`;

  return (
    <div data-testid="recharge-bonus-admin">
      <Head title={tr("充值活動（充值贈送）")} sub={tr("用戶充值達門檻時自動贈送錢包金額或積分；取最高符合的規則發放")} right={<Btn data-testid="rb-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增規則")}</Btn>} />
      <Table testId="rb-table" cols={[tr("充值門檻（≥ USD$）"), tr("贈送類型"), tr("贈送內容"), tr("狀態"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("暫無規則")} rows={list || []} render={(r) => (
        <tr key={r.id} data-testid={`rb-row-${r.id}`} className={`hover:bg-emerald-50/30 ${r.active ? "" : "opacity-60"}`}>
          <td className="px-4 py-3 font-head font-bold text-slate-900">USD$ {Number(r.min_usd).toFixed(2)}</td>
          <td className="px-4 py-3"><Pill tone={TYPE_TONE[r.bonus_type]}>{TYPE_LABEL[r.bonus_type]}</Pill></td>
          <td className="px-4 py-3 font-semibold text-emerald-600">{valLabel(r)}</td>
          <td className="px-4 py-3">{r.active ? <Pill tone="emerald">{tr("啟用中")}</Pill> : <Pill tone="slate">{tr("已停用")}</Pill>}</td>
          <td className="px-4 py-3"><div className="flex gap-1.5"><Btn kind="ghost" data-testid={`rb-edit-${r.id}`} onClick={() => setEdit({ ...r })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`rb-del-${r.id}`} onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Btn></div></td>
        </tr>
      )} />
      {edit && (
        <Modal testId="rb-modal" title={<span className="flex items-center gap-2"><Gift className="h-4 w-4 text-emerald-500" />{edit.id ? tr("編輯充值贈送") : tr("新增充值贈送")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="rb-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("充值門檻 USD$（達到即可享）")}><Input data-testid="rb-min" type="number" className="w-full" value={edit.min_usd} onChange={(e) => setEdit({ ...edit, min_usd: +e.target.value })} /></Field>
          <Field label={tr("贈送類型")}>
            <select data-testid="rb-type" value={edit.bonus_type} onChange={(e) => setEdit({ ...edit, bonus_type: e.target.value })} className="w-full h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label={edit.bonus_type === "fixed_usd" ? tr("贈送金額 USD$") : edit.bonus_type === "percent" ? tr("贈送比例 %") : tr("贈送積分數")}><Input data-testid="rb-value" type="number" className="w-full" value={edit.bonus_value} onChange={(e) => setEdit({ ...edit, bonus_value: +e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid="rb-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用此規則")}</label>
        </Modal>
      )}
    </div>
  );
}
