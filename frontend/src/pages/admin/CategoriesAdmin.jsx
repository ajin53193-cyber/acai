import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Btn, Input, Table, Head, ImgField } from "@/pages/admin/ui";
import { tr } from "@/i18n";

const lbl = "block text-xs font-semibold text-slate-500 mb-1";
const EMPTY = { id: "", name: "", image: "", icon: "", sort_order: 0, active: true };

export function CategoriesAdmin({ callApi }) {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/categories" }).then((r) => setList(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing.name.trim()) return toast.error(tr("請輸入分類名稱"));
    setBusy(true);
    try {
      const body = { ...editing, sort_order: +editing.sort_order || 0 };
      delete body.product_count;
      if (editing._new) { delete body._new; await callApi({ method: "POST", url: "/admin/categories", data: body }); }
      else await callApi({ method: "PUT", url: `/admin/categories/${editing.id}`, data: body });
      toast.success(tr("已儲存")); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };
  const toggle = async (c) => { await callApi({ method: "PUT", url: `/admin/categories/${c.id}`, data: { ...c, active: !(c.active !== false) } }); load(); };
  const del = async (c) => {
    if (!window.confirm(tr("確定刪除分類「{0}」？", c.name))) return;
    try { await callApi({ method: "DELETE", url: `/admin/categories/${c.id}` }); toast.success(tr("已刪除")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("刪除失敗")); }
  };

  return (
    <div data-testid="categories-admin">
      <Head title={tr("分類管理")} sub={tr("前台導覽選單、首頁熱門分類與分類頁皆使用此處的分類；隱藏的分類不會在前台顯示。")}
        right={<Btn data-testid="category-add-btn" onClick={() => setEditing({ ...EMPTY, _new: true, sort_order: list.length + 1 })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增分類")}</Btn>} />
      <Table testId="categories-table" cols={[tr("圖示"), tr("名稱"), tr("ID"), tr("商品數"), tr("排序"), tr("顯示"), tr("操作")]} rows={list} render={(c) => (
        <tr key={c.id} data-testid={`category-row-${c.id}`} className="hover:bg-orange-50/40">
          <td className="px-4 py-2"><div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">{c.image && <img src={c.image} alt="" className="h-full w-full object-contain" />}</div></td>
          <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
          <td className="px-4 py-2 text-xs text-slate-500 font-mono">{c.id}</td>
          <td className="px-4 py-2 text-xs text-slate-600">{c.product_count}</td>
          <td className="px-4 py-2 text-xs text-slate-600">{c.sort_order}</td>
          <td className="px-4 py-2"><Switch checked={c.active !== false} onCheckedChange={() => toggle(c)} data-testid={`category-toggle-${c.id}`} /></td>
          <td className="px-4 py-2 whitespace-nowrap">
            <button data-testid={`category-edit-${c.id}`} onClick={() => setEditing({ ...c })} className="p-1.5 text-slate-400 hover:text-orange-500"><Pencil className="h-4 w-4" /></button>
            <button data-testid={`category-delete-${c.id}`} onClick={() => del(c)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </td>
        </tr>
      )} />
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg bg-white" data-testid="category-form">
            <DialogHeader><DialogTitle>{editing._new ? tr("新增分類") : tr("編輯分類")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>{tr("分類名稱")} *</label><Input data-testid="category-name" className="w-full" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><label className={lbl}>{tr("ID（英文小寫，網址使用）")}</label><Input data-testid="category-id" className="w-full" value={editing.id} disabled={!editing._new} onChange={(e) => setEditing({ ...editing, id: e.target.value })} placeholder={tr("留空自動產生")} /></div>
                <div><label className={lbl}>{tr("排序（小在前）")}</label><Input type="number" className="w-full" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> {tr("前台顯示")}</label></div>
              </div>
              <div><label className={lbl}>{tr("分類圖示（方形 PNG，≤2M）")}</label><div className="max-w-[200px]"><ImgField value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} testId="category-image" ratio="aspect-square" /></div></div>
            </div>
            <DialogFooter>
              <Btn kind="ghost" onClick={() => setEditing(null)}>{tr("取消")}</Btn>
              <Btn data-testid="category-save" onClick={save} disabled={busy}>{tr("儲存")}</Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
