import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Percent, Tag } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, useLoad } from "./ui";

const empty = { title: "", promo_type: "reduce", threshold_usd: 100, value: 10, active: true, start_at: "", end_at: "" };
const TYPE_LABEL = { reduce: tr("滿額減（固定金額）"), percent: tr("滿額折（百分比）") };

export function CartPromoAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/cart-promotions");
  const [edit, setEdit] = useState(null);

  const save = async () => {
    if (!edit.threshold_usd || edit.threshold_usd <= 0) return toast.error(tr("請輸入門檻金額"));
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/cart-promotions/${edit.id}`, data: edit });
      else await callApi({ method: "POST", url: "/admin/cart-promotions", data: edit });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (c) => { if (!window.confirm(tr("刪除此活動？"))) return; await callApi({ method: "DELETE", url: `/admin/cart-promotions/${c.id}` }); load(); };
  const rule = (c) => c.promo_type === "reduce" ? tr("滿 USD$ {0} 減 USD$ {1}", Number(c.threshold_usd).toFixed(0), Number(c.value).toFixed(2)) : tr("滿 USD$ {0} 打 {1} 折", Number(c.threshold_usd).toFixed(0), (10 - c.value / 10).toFixed(1));

  return (
    <div data-testid="cartpromo-admin">
      <Head title={tr("滿減 / 滿折活動")} sub={tr("訂單滿額自動優惠，結算頁即時生效；多檔取優惠最大的一檔")} right={<Btn data-testid="cp-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增活動")}</Btn>} />
      <Table testId="cp-table" cols={[tr("活動名稱"), tr("類型"), tr("規則"), tr("狀態"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("暫無活動")} rows={list || []} render={(c) => (
        <tr key={c.id} data-testid={`cp-row-${c.id}`} className={`hover:bg-orange-50/30 ${c.active ? "" : "opacity-60"}`}>
          <td className="px-4 py-3 font-semibold text-slate-800">{c.title || <span className="text-slate-400">{tr("未命名")}</span>}</td>
          <td className="px-4 py-3"><Pill tone={c.promo_type === "reduce" ? "emerald" : "orange"}>{c.promo_type === "reduce" ? tr("滿減") : tr("滿折")}</Pill></td>
          <td className="px-4 py-3 font-head font-bold text-orange-600">{rule(c)}</td>
          <td className="px-4 py-3">{c.active ? <Pill tone="emerald">{tr("啟用中")}</Pill> : <Pill tone="slate">{tr("已停用")}</Pill>}</td>
          <td className="px-4 py-3"><div className="flex gap-1.5"><Btn kind="ghost" data-testid={`cp-edit-${c.id}`} onClick={() => setEdit({ ...c })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`cp-del-${c.id}`} onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5" /></Btn></div></td>
        </tr>
      )} />
      {edit && (
        <Modal testId="cp-modal" title={<span className="flex items-center gap-2"><Percent className="h-4 w-4 text-orange-500" />{edit.id ? tr("編輯活動") : tr("新增滿減滿折")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="cp-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("活動名稱（選填）")}><Input data-testid="cp-title" className="w-full" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder={tr("如 全場滿減")} /></Field>
          <Field label={tr("活動類型")}>
            <select data-testid="cp-type" value={edit.promo_type} onChange={(e) => setEdit({ ...edit, promo_type: e.target.value })} className="w-full h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("訂單滿 USD$")}><Input data-testid="cp-threshold" type="number" className="w-full" value={edit.threshold_usd} onChange={(e) => setEdit({ ...edit, threshold_usd: +e.target.value })} /></Field>
            <Field label={edit.promo_type === "reduce" ? tr("減 USD$") : tr("折扣 %（如 20 = 8折）")}><Input data-testid="cp-value" type="number" className="w-full" value={edit.value} onChange={(e) => setEdit({ ...edit, value: +e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("開始時間（選填）")}><Input type="datetime-local" className="w-full" value={edit.start_at} onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} /></Field>
            <Field label={tr("結束時間（選填）")}><Input type="datetime-local" className="w-full" value={edit.end_at} onChange={(e) => setEdit({ ...edit, end_at: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid="cp-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用此活動")}</label>
        </Modal>
      )}
    </div>
  );
}
