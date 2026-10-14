import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Layers } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Modal, Field, Card, Pill } from "./ui";

const emptyRow = () => ({ label: "", price_usd: 0, sale_price_usd: null, badge: "", in_stock: true });
const empty = { name: "", specs: [emptyRow()] };

export function SpecTemplatesAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/spec-templates" }).then((r) => setList(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi]);
  useEffect(() => { load(); }, [load]);

  const setRow = (i, k, v) => setEdit((s) => ({ ...s, specs: s.specs.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const save = async () => {
    if (!edit.name.trim()) return toast.error(tr("請輸入模板名稱"));
    const specs = edit.specs.filter((s) => s.label.trim()).map((s) => ({ ...s, price_usd: +s.price_usd || 0, sale_price_usd: s.sale_price_usd ? +s.sale_price_usd : null }));
    if (!specs.length) return toast.error(tr("請至少新增一條規格"));
    try { if (edit.id) await callApi({ method: "PUT", url: `/admin/spec-templates/${edit.id}`, data: { ...edit, specs } }); else await callApi({ method: "POST", url: "/admin/spec-templates", data: { ...edit, specs } }); toast.success(tr("已儲存")); setEdit(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (t) => { if (!window.confirm(tr("刪除模板「{0}」？", t.name))) return; await callApi({ method: "DELETE", url: `/admin/spec-templates/${t.id}` }); load(); };

  return (
    <div data-testid="spec-templates-admin">
      <Head title={tr("規格管理")} sub={tr("建立可復用的規格模板（如常用面額），新增商品時可一鍵套用")} right={<Btn data-testid="spectpl-add" onClick={() => setEdit({ ...empty, specs: [emptyRow()] })}><Plus className="h-4 w-4" />{tr("新增模板")}</Btn>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="spectpl-grid">
        {(list || []).map((t) => (
          <Card key={t.id} data-testid={`spectpl-${t.id}`} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-head font-bold text-slate-800 flex items-center gap-1.5"><Layers className="h-4 w-4 text-orange-500" />{t.name}</div>
              <div className="flex gap-1.5"><Btn kind="ghost" data-testid={`spectpl-edit-${t.id}`} onClick={() => setEdit({ ...t, specs: t.specs.length ? t.specs : [emptyRow()] })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`spectpl-del-${t.id}`} onClick={() => del(t)}><Trash2 className="h-3.5 w-3.5" /></Btn></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{(t.specs || []).slice(0, 8).map((s, i) => <Pill key={i} tone="sky">{s.label} ${s.price_usd}</Pill>)}</div>
            <div className="text-[11px] text-slate-400 mt-2">{tr("{0} 條規格", (t.specs || []).length)}</div>
          </Card>
        ))}
        {list !== null && list.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-10">{tr("暫無規格模板")}</div>}
      </div>

      {edit && (
        <Modal testId="spectpl-modal" title={edit.id ? tr("編輯規格模板") : tr("新增規格模板")} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="spectpl-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("模板名稱")}><Input data-testid="spectpl-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("如：通用面額、月卡季卡")} /></Field>
          <div className="mt-2 space-y-2">
            {edit.specs.map((s, i) => (
              <div key={i} className="flex items-center gap-2" data-testid={`spectpl-row-${i}`}>
                <Input className="flex-1" data-testid={`spectpl-label-${i}`} value={s.label} onChange={(e) => setRow(i, "label", e.target.value)} placeholder={tr("規格名稱，如 100 元")} />
                <Input type="number" className="w-24" data-testid={`spectpl-price-${i}`} value={s.price_usd} onChange={(e) => setRow(i, "price_usd", e.target.value)} placeholder={tr("售價")} />
                <Input className="w-28" data-testid={`spectpl-badge-${i}`} value={s.badge} onChange={(e) => setRow(i, "badge", e.target.value)} placeholder={tr("角標")} />
                <button data-testid={`spectpl-row-del-${i}`} onClick={() => setEdit({ ...edit, specs: edit.specs.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <Btn kind="ghost" data-testid="spectpl-row-add" onClick={() => setEdit({ ...edit, specs: [...edit.specs, emptyRow()] })}><Plus className="h-4 w-4" />{tr("新增一條")}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
