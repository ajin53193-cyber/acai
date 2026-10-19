import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Link2, ExternalLink, Download } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload, toFullUrl } from "@/components/ImageUpload";
import { inputCls, FieldLabel } from "./copyFields";
import { BLOCK_TYPES, BlockEditor, copyText } from "./blockEditor";

const EMPTY = { name: "", icon: "", tagline: "", download_link: "", download_text: "立即下载", blocks: [], published: true, sort: 0 };
const listUrl = () => `${window.location.origin}/tools`;
const toolUrl = (slug) => `${window.location.origin}/tools/${slug}`;

export default function ToolsAdmin({ token, onUnauthorized }) {
  const [tools, setTools] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/tools`, { headers });
      setTools(res.data.tools);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!editing.name.trim()) return toast.error("请填写工具名称");
    setSaving(true);
    try {
      const body = { name: editing.name, icon: editing.icon, tagline: editing.tagline, download_link: editing.download_link, download_text: editing.download_text || "立即下载", blocks: editing.blocks, published: editing.published !== false, sort: Number(editing.sort) || 0 };
      if (editing.id) {
        await axios.put(`${API}/admin/tools/${editing.id}`, body, { headers });
        toast.success("已保存");
      } else {
        const res = await axios.post(`${API}/admin/tools`, body, { headers });
        await copyText(toolUrl(res.data.slug));
        toast.success("已创建，该工具的分享链接已复制");
      }
      setEditing(null);
      load();
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (t) => {
    const next = t.published === false;
    await axios.patch(`${API}/admin/tools/${t.id}/publish`, { published: next }, { headers }).catch(() => toast.error("操作失败"));
    setTools((prev) => prev.map((x) => (x.id === t.id ? { ...x, published: next } : x)));
  };

  const remove = async (t) => {
    if (!window.confirm(`确定删除「${t.name}」？`)) return;
    await axios.delete(`${API}/admin/tools/${t.id}`, { headers }).catch(() => toast.error("删除失败"));
    setTools((prev) => prev.filter((x) => x.id !== t.id));
  };

  const addBlock = (type) => setEditing((e) => ({ ...e, blocks: [...e.blocks, { type, text: "", image: "", link: "" }] }));
  const updateBlock = (i, b) => setEditing((e) => ({ ...e, blocks: e.blocks.map((x, idx) => (idx === i ? b : x)) }));
  const removeBlock = (i) => setEditing((e) => ({ ...e, blocks: e.blocks.filter((_, idx) => idx !== i) }));
  const moveBlock = (i, dir) => setEditing((e) => {
    const arr = [...e.blocks];
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    return { ...e, blocks: arr };
  });

  if (editing) {
    return (
      <div className="space-y-5" data-testid="tool-editor">
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl px-7 py-5">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">{editing.id ? "编辑工具" : "新建工具"}</h3>
            <p className="mt-1 text-xs text-slate-500">App 图标 + 名称 + 下载按钮 + 图文使用教程，白底页面适合微信转发</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-amber-500/30 px-5 py-2 text-sm text-slate-300 hover:bg-amber-500/10" data-testid="tool-cancel-btn">取消</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-full bg-gold-gradient px-6 py-2 text-sm font-bold text-[#060B18] disabled:opacity-60" data-testid="tool-save-btn">{saving ? "保存中…" : editing.id ? "保存" : "创建并复制链接"}</button>
          </div>
        </div>

        <div className="glass-card grid gap-4 rounded-3xl p-7 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>App 图标</FieldLabel>
            <div className="flex flex-wrap items-start gap-3">
              <ImageUpload token={token} value={editing.icon} onChange={(v) => setEditing({ ...editing, icon: v })} testid="tool-icon-upload" />
              <input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} placeholder="或粘贴图标地址" className={`${inputCls} min-w-[200px] flex-1`} data-testid="tool-icon-url" />
            </div>
          </div>
          <div>
            <FieldLabel>工具名称</FieldLabel>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} data-testid="tool-name-input" />
          </div>
          <div>
            <FieldLabel>排序（数字越小越靠前）</FieldLabel>
            <input type="number" value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: e.target.value })} className={inputCls} data-testid="tool-sort-input" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>一句话简介</FieldLabel>
            <input value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} className={inputCls} data-testid="tool-tagline-input" />
          </div>
          <div>
            <FieldLabel>下载地址</FieldLabel>
            <input value={editing.download_link} onChange={(e) => setEditing({ ...editing, download_link: e.target.value })} placeholder="https://…（留空则不显示下载按钮）" className={inputCls} data-testid="tool-download-link-input" />
          </div>
          <div>
            <FieldLabel>下载按钮文字</FieldLabel>
            <input value={editing.download_text} onChange={(e) => setEditing({ ...editing, download_text: e.target.value })} className={inputCls} data-testid="tool-download-text-input" />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-base font-bold text-slate-100">图文教学</h4>
            <div className="flex flex-wrap gap-2">
              {BLOCK_TYPES.map((b) => (
                <button key={b.type} type="button" onClick={() => addBlock(b.type)} className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 px-3.5 py-1.5 text-xs text-[#FFE896] hover:bg-[#D4AF37]/10" data-testid={`tool-add-${b.type}`}>
                  <Plus size={12} /> <b.icon size={12} /> {b.label}
                </button>
              ))}
            </div>
          </div>
          {editing.blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-500/20 py-10 text-center text-xs text-slate-500">点击上方按钮添加教学步骤（小标题 / 文字 / 截图 / 跳转按钮）</div>
          ) : (
            <div className="space-y-4">
              {editing.blocks.map((b, i) => (
                <BlockEditor key={i} block={b} index={i} total={editing.blocks.length} token={token} onChange={(nb) => updateBlock(i, nb)} onRemove={() => removeBlock(i)} onMove={(d) => moveBlock(i, d)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="tools-admin">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-3xl px-7 py-5">
        <div>
          <h3 className="font-display text-lg font-bold text-gold-gradient">热门工具分享页</h3>
          <div className="mt-1 font-mono text-xs text-slate-500" data-testid="tools-list-url">{listUrl()}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async () => { await copyText(listUrl()); toast.success("工具列表分享链接已复制"); }} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-bold text-[#060B18]" data-testid="tools-copy-list-btn">
            <Link2 size={15} /> 复制列表链接
          </button>
          <a href={listUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 px-5 py-2.5 text-sm text-[#E5C158] hover:bg-amber-500/10" data-testid="tools-preview-list-btn">
            <ExternalLink size={15} /> 预览
          </a>
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-bold text-[#FFE896] hover:bg-[#D4AF37]/10" data-testid="tool-new-btn">
            <Plus size={16} /> 新建工具
          </button>
        </div>
      </div>

      {tools.length === 0 && <div className="glass-card rounded-3xl py-16 text-center text-sm text-slate-500">还没有工具，点击「新建工具」添加</div>}

      <div className="space-y-3">
        {tools.map((t, i) => {
          const live = t.published !== false;
          return (
            <div key={t.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4" data-testid={`tool-item-${i}`}>
              {t.icon ? (
                <img src={toFullUrl(t.icon)} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold-gradient text-lg font-black text-[#060B18]">{t.name.slice(0, 1)}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold text-slate-50">{t.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>{live ? "已上线" : "已下线"}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><Eye size={11} /> {t.views || 0}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><Download size={11} /> {t.downloads || 0}</span>
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500" data-testid={`tool-link-${i}`}>{toolUrl(t.slug)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={async () => { await copyText(toolUrl(t.slug)); toast.success("工具链接已复制"); }} className="flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-xs font-bold text-[#060B18]" data-testid={`tool-copy-${i}`}>
                  <Link2 size={13} /> 复制链接
                </button>
                <button type="button" onClick={() => togglePublish(t)} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" data-testid={`tool-toggle-${i}`}>
                  {live ? <><EyeOff size={13} /> 下线</> : <><Eye size={13} /> 上线</>}
                </button>
                <button type="button" onClick={() => setEditing({ ...EMPTY, ...t, blocks: t.blocks || [] })} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" data-testid={`tool-edit-${i}`}>
                  <Pencil size={13} /> 编辑
                </button>
                <button type="button" onClick={() => remove(t)} className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-xs text-red-300 hover:bg-red-500/10" data-testid={`tool-delete-${i}`}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
