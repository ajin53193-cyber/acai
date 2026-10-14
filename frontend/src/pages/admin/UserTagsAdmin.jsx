import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag as TagIcon } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Modal, Field, useLoad, TONES, toneCls, toneSolid } from "./ui";

const empty = { name: "", color: "sky" };

export function UserTagsAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/user-tags");
  const [edit, setEdit] = useState(null);

  const save = async () => {
    if (!edit.name.trim()) return toast.error(tr("請輸入標籤名稱"));
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/user-tags/${edit.id}`, data: edit });
      else await callApi({ method: "POST", url: "/admin/user-tags", data: edit });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (t) => { if (!window.confirm(tr("刪除標籤「{0}」？會從所有用戶移除", t.name))) return; await callApi({ method: "DELETE", url: `/admin/user-tags/${t.id}` }); load(); };

  return (
    <div data-testid="tags-admin">
      <Head title={tr("用戶標籤")} sub={tr("自定義標籤用於分層運營、定向發券；在會員詳情中為用戶打標籤")} right={<Btn data-testid="tag-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增標籤")}</Btn>} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="tags-grid">
        {(list || []).map((t) => (
          <Card key={t.id} data-testid={`tag-card-${t.id}`} className="p-4 flex items-center justify-between">
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${toneCls(t.color)}`}><TagIcon className="h-3.5 w-3.5" />{t.name}</span>
              <div className="text-[11px] text-slate-400 mt-1.5">{tr("{0} 人使用", t.member_count)}</div>
            </div>
            <div className="flex gap-1"><button data-testid={`tag-edit-${t.id}`} onClick={() => setEdit({ ...t })} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button><button data-testid={`tag-del-${t.id}`} onClick={() => del(t)} className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div>
          </Card>
        ))}
        {list && list.length === 0 && <div className="col-span-full text-center text-sm text-slate-400 py-10">{tr("暫無標籤")}</div>}
      </div>
      {edit && (
        <Modal testId="tag-modal" title={edit.id ? tr("編輯標籤") : tr("新增標籤")} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="tag-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("標籤名稱")}><Input data-testid="tag-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("例如 高價值 / 活躍 / 待挽回")} /></Field>
          <Field label={tr("顏色")}><div className="flex flex-wrap gap-2">{TONES.map((c) => <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={`h-8 w-8 rounded-full ${toneSolid(c)} ${edit.color === c ? "ring-2 ring-offset-2 ring-slate-800" : ""}`} />)}</div></Field>
        </Modal>
      )}
    </div>
  );
}
