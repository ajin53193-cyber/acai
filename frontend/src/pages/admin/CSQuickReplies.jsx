import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, FolderPen, X } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload, toFullUrl } from "@/components/ImageUpload";

const inputCls = "w-full rounded-xl border border-amber-500/20 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]/60";
const empty = { group: "默认", text: "", image: "" };

function QRForm({ token, editing, groups, defaultGroup, onClose, onSaved }) {
  const [form, setForm] = useState(editing ? { group: editing.group, text: editing.text, image: editing.image } : { ...empty, group: defaultGroup || "默认" });
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const save = async () => {
    if (!form.text.trim() && !form.image) return toast.error("话术文本和图片至少填写一项");
    setSaving(true);
    try {
      if (editing) await axios.put(`${API}/admin/cs/quick-replies/${editing.id}`, form, { headers });
      else await axios.post(`${API}/admin/cs/quick-replies`, form, { headers });
      toast.success("话术已保存"); onSaved(); onClose();
    } catch (err) { toast.error(formatDetail(err.response?.data?.detail) || "保存失败"); } finally { setSaving(false); }
  };
  return (
    <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#0b1226] p-5" data-testid="cs-qr-form">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#E5C158]">{editing ? "编辑话术" : "新增话术"}</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">分组（可输入新分组名）</label>
          <input list="cs-qr-groups" data-testid="cs-qr-form-group" maxLength={30} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={inputCls} placeholder="例如：开场白 / 项目介绍" />
          <datalist id="cs-qr-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          <label className="mt-4 mb-1.5 block text-xs tracking-widest text-slate-400">图片（可选，点一下即发送）</label>
          <ImageUpload token={token} value={form.image} onChange={(url) => setForm({ ...form, image: url })} testid="cs-qr-form-image" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">话术文本（可选，支持换行）</label>
          <textarea data-testid="cs-qr-form-text" rows={7} maxLength={1000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className={inputCls} placeholder="例如：您好，我是合赢项目社的客服，很高兴为您服务～" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
        <button onClick={save} disabled={saving} data-testid="cs-qr-form-save" className="rounded-xl bg-gold-gradient px-5 py-2 text-sm font-bold text-[#060B18] disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
      </div>
    </div>
  );
}

export default function CSQuickReplies({ token }) {
  const [list, setList] = useState([]);
  const [group, setGroup] = useState("全部");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/admin/cs/quick-replies`, { headers }); setList(r.data.replies || []); } catch { /* ignore */ }
    // eslint-disable-next-line
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = [...new Set(list.map((r) => r.group))];
  const shown = group === "全部" ? list : list.filter((r) => r.group === group);

  const del = async (id) => {
    if (!window.confirm("确定删除这条话术？")) return;
    try { await axios.delete(`${API}/admin/cs/quick-replies/${id}`, { headers }); toast.success("已删除"); load(); } catch { toast.error("删除失败"); }
  };
  const renameGroup = async () => {
    const name = window.prompt("输入新的分组名称", group);
    if (!name || !name.trim() || name.trim() === group) return;
    try { await axios.put(`${API}/admin/cs/quick-replies/group`, { old: group, new: name.trim() }, { headers }); toast.success("分组已重命名"); setGroup(name.trim()); load(); }
    catch { toast.error("重命名失败"); }
  };

  return (
    <div className="glass-card rounded-2xl p-6" data-testid="cs-qr-admin">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-gold-gradient"><Zap size={16} /> 快捷回复话术库</h3>
          <p className="mt-1 text-xs text-slate-500">所有坐席共用，支持分组与图片；坐席在工作台点一下即可发送。</p>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="cs-qr-add" className="flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-sm font-bold text-[#060B18] active:scale-95"><Plus size={15} /> 新增话术</button>
      </div>

      {/* 分组 Tab */}
      <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="cs-qr-groups">
        {["全部", ...groups].map((g) => (
          <button key={g} onClick={() => setGroup(g)} data-testid={`cs-qr-group-${g}`} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${group === g ? "bg-[#D4AF37]/25 text-[#E5C158] ring-1 ring-[#D4AF37]/50" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
            {g} <span className="opacity-60">{g === "全部" ? list.length : list.filter((r) => r.group === g).length}</span>
          </button>
        ))}
        {group !== "全部" && <button onClick={renameGroup} data-testid="cs-qr-rename-group" className="ml-1 flex items-center gap-1 text-xs text-slate-400 hover:text-[#E5C158]"><FolderPen size={13} /> 重命名分组</button>}
      </div>

      {formOpen && <div className="mb-4"><QRForm token={token} editing={editing} groups={groups} defaultGroup={group === "全部" ? "默认" : group} onClose={() => setFormOpen(false)} onSaved={load} /></div>}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">暂无话术，点「新增话术」添加</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <div key={r.id} data-testid={`cs-qr-item-${r.id}`} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {r.image && <a href={toFullUrl(r.image)} target="_blank" rel="noreferrer" className="shrink-0"><img src={toFullUrl(r.image)} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-[#D4AF37]/30" /></a>}
              <div className="min-w-0 flex-1">
                <span className="mb-1 inline-block rounded-md bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold text-[#E5C158]">{r.group}</span>
                {r.created_by_name && <span className="ml-1.5 text-[10px] text-slate-500">坐席「{r.created_by_name}」添加</span>}
                <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-300">{r.text || <span className="italic text-slate-500">（仅图片）</span>}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => { setEditing(r); setFormOpen(true); }} data-testid={`cs-qr-edit-${r.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-[#E5C158]"><Pencil size={14} /></button>
                <button onClick={() => del(r.id)} data-testid={`cs-qr-del-${r.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
