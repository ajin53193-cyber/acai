import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Crown } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Table, Modal, Field, useLoad, TONES, toneCls, toneSolid } from "./ui";

const empty = { name: "", min_spend_usd: 0, discount_percent: 0, color: "slate" };

export function UserLevelsAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/member-levels");
  const [edit, setEdit] = useState(null);

  const save = async () => {
    if (!edit.name.trim()) return toast.error(tr("請輸入等級名稱"));
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/member-levels/${edit.id}`, data: edit });
      else await callApi({ method: "POST", url: "/admin/member-levels", data: edit });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (l) => { if (!window.confirm(tr("刪除等級「{0}」？", l.name))) return; await callApi({ method: "DELETE", url: `/admin/member-levels/${l.id}` }); load(); };

  return (
    <div data-testid="levels-admin">
      <Head title={tr("用戶等級")} sub={tr("依會員累計消費自動升級；可設定每級門檻與專屬折扣")} right={<Btn data-testid="level-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增等級")}</Btn>} />
      <Table testId="levels-table" cols={[tr("等級"), tr("升級門檻（累計消費 ≥）"), tr("專屬折扣"), tr("會員數"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("暫無等級")} rows={list || []} render={(l) => (
        <tr key={l.id} data-testid={`level-row-${l.id}`} className="hover:bg-orange-50/30">
          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${toneCls(l.color)}`}><Crown className="h-3.5 w-3.5" />{l.name}</span></td>
          <td className="px-4 py-3 font-head font-bold text-slate-900">USD$ {Number(l.min_spend_usd).toFixed(0)}</td>
          <td className="px-4 py-3 text-slate-700">{l.discount_percent > 0 ? `${l.discount_percent}%` : <span className="text-slate-400">{tr("無")}</span>}</td>
          <td className="px-4 py-3 text-slate-600">{l.member_count}</td>
          <td className="px-4 py-3"><div className="flex gap-1.5"><Btn kind="ghost" data-testid={`level-edit-${l.id}`} onClick={() => setEdit({ ...l })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`level-del-${l.id}`} onClick={() => del(l)}><Trash2 className="h-3.5 w-3.5" /></Btn></div></td>
        </tr>
      )} />
      {edit && (
        <Modal testId="level-modal" title={edit.id ? tr("編輯等級") : tr("新增等級")} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="level-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("等級名稱")}><Input data-testid="level-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("例如 黃金會員")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("升級門檻 USD")}><Input data-testid="level-min" type="number" className="w-full" value={edit.min_spend_usd} onChange={(e) => setEdit({ ...edit, min_spend_usd: +e.target.value })} /></Field>
            <Field label={tr("專屬折扣 %")}><Input data-testid="level-discount" type="number" className="w-full" value={edit.discount_percent} onChange={(e) => setEdit({ ...edit, discount_percent: +e.target.value })} /></Field>
          </div>
          <Field label={tr("顏色")}><div className="flex flex-wrap gap-2">{TONES.map((c) => <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={`h-8 w-8 rounded-full ${toneSolid(c)} ${edit.color === c ? "ring-2 ring-offset-2 ring-slate-800" : ""}`} />)}</div></Field>
          <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">{tr("升級禮包（升到此等級時自動發放）")}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("贈送積分")}><Input data-testid="level-reward-points" type="number" className="w-full" value={edit.reward_points || 0} onChange={(e) => setEdit({ ...edit, reward_points: +e.target.value })} /></Field>
            <Field label={tr("贈送優惠券碼")}><Input data-testid="level-reward-coupon" className="w-full" value={edit.reward_coupon_code || ""} onChange={(e) => setEdit({ ...edit, reward_coupon_code: e.target.value.toUpperCase() })} placeholder={tr("選填，如 GLOBAL2026")} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
