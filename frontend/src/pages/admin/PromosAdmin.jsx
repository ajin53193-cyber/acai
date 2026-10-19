import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Link2, ExternalLink } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload, toFullUrl } from "@/components/ImageUpload";
import { SharePoster } from "@/components/SharePoster";
import { inputCls, FieldLabel } from "./copyFields";
import { BLOCK_TYPES, BlockEditor, copyText } from "./blockEditor";

const EMPTY = { title: "", subtitle: "", cover: "", blocks: [], tool_slugs: [], published: true };
const shareUrl = (slug) => `${window.location.origin}/p/${slug}`;

export default function PromosAdmin({ token, onUnauthorized }) {
  const [promos, setPromos] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/promos`, { headers });
      setPromos(res.data.promos);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
    }
  };
  useEffect(() => {
    load();
    axios.get(`${API}/admin/tools`, { headers }).then((r) => setAllTools(r.data.tools || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!editing.title.trim()) return toast.error("请填写标题");
    setSaving(true);
    try {
      const body = { title: editing.title, subtitle: editing.subtitle, cover: editing.cover, blocks: editing.blocks, tool_slugs: editing.tool_slugs || [], published: editing.published !== false };
      if (editing.id) await axios.put(`${API}/admin/promos/${editing.id}`, body, { headers });
      else {
        const res = await axios.post(`${API}/admin/promos`, body, { headers });
        await copyText(shareUrl(res.data.slug));
        toast.success("已创建，分享链接已复制到剪贴板");
      }
      if (editing.id) toast.success("已保存");
      setEditing(null);
      load();
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (p) => {
    const next = p.published === false;
    await axios.patch(`${API}/admin/promos/${p.id}/publish`, { published: next }, { headers }).catch(() => toast.error("操作失败"));
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, published: next } : x)));
  };

  const remove = async (p) => {
    if (!window.confirm(`确定删除「${p.title}」？链接将立即失效。`)) return;
    await axios.delete(`${API}/admin/promos/${p.id}`, { headers }).catch(() => toast.error("删除失败"));
    setPromos((prev) => prev.filter((x) => x.id !== p.id));
  };

  const addBlock = (type) => setEditing((e) => ({ ...e, blocks: [...e.blocks, { type, text: "", image: "", link: type === "button" ? "/tutorials/join-group" : "" }] }));  const updateBlock = (i, b) => setEditing((e) => ({ ...e, blocks: e.blocks.map((x, idx) => (idx === i ? b : x)) }));
  const removeBlock = (i) => setEditing((e) => ({ ...e, blocks: e.blocks.filter((_, idx) => idx !== i) }));
  const moveBlock = (i, dir) => setEditing((e) => {
    const arr = [...e.blocks];
    const j = i + dir;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...e, blocks: arr };
  });

  const toggleTool = (slug) => setEditing((e) => {
    const cur = e.tool_slugs || [];
    return { ...e, tool_slugs: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] };
  });

  if (editing) {
    return (
      <div className="space-y-5" data-testid="promo-editor">
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl px-7 py-5">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">{editing.id ? "编辑推广图文" : "新建推广图文"}</h3>
            <p className="mt-1 text-xs text-slate-500">白底图文页，适合微信转发；可自由组合小标题、文字、图片与跳转按钮</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-amber-500/30 px-5 py-2 text-sm text-slate-300 hover:bg-amber-500/10" data-testid="promo-cancel-btn">取消</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-full bg-gold-gradient px-6 py-2 text-sm font-bold text-[#060B18] disabled:opacity-60" data-testid="promo-save-btn">{saving ? "保存中…" : editing.id ? "保存" : "创建并复制链接"}</button>
          </div>
        </div>

        <div className="glass-card space-y-4 rounded-3xl p-7">
          <div>
            <FieldLabel>标题</FieldLabel>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} data-testid="promo-title-input" />
          </div>
          <div>
            <FieldLabel>副标题 / 导语（可选）</FieldLabel>
            <textarea value={editing.subtitle} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} rows={2} className={`${inputCls} resize-y`} data-testid="promo-subtitle-input" />
          </div>
          <div>
            <FieldLabel>封面图（可选）</FieldLabel>
            <div className="flex flex-wrap items-start gap-3">
              <ImageUpload token={token} value={editing.cover} onChange={(v) => setEditing({ ...editing, cover: v })} testid="promo-cover-upload" />
              <input value={editing.cover} onChange={(e) => setEditing({ ...editing, cover: e.target.value })} placeholder="或粘贴图片地址" className={`${inputCls} min-w-[200px] flex-1`} data-testid="promo-cover-url" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-base font-bold text-slate-100">内容区块</h4>
            <div className="flex flex-wrap gap-2">
              {BLOCK_TYPES.map((b) => (
                <button key={b.type} type="button" onClick={() => addBlock(b.type)} className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 px-3.5 py-1.5 text-xs text-[#FFE896] hover:bg-[#D4AF37]/10" data-testid={`promo-add-${b.type}`}>
                  <Plus size={12} /> <b.icon size={12} /> {b.label}
                </button>
              ))}
            </div>
          </div>
          {editing.blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-500/20 py-10 text-center text-xs text-slate-500">点击上方按钮添加第一个区块</div>
          ) : (
            <div className="space-y-4">
              {editing.blocks.map((b, i) => (
                <BlockEditor key={i} block={b} index={i} total={editing.blocks.length} token={token} onChange={(nb) => updateBlock(i, nb)} onRemove={() => removeBlock(i)} onMove={(d) => moveBlock(i, d)} />
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-7" data-testid="promo-tools-picker">
          <h4 className="font-display text-base font-bold text-slate-100">底部展示的热门工具</h4>
          <p className="mt-1 text-xs text-slate-500">勾选要在本篇推广页底部展示的工具；不勾选则展示全部已上线工具</p>
          {allTools.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-amber-500/20 py-8 text-center text-xs text-slate-500">还没有工具，请先在「热门工具」Tab 添加</div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {allTools.map((t) => {
                const checked = (editing.tool_slugs || []).includes(t.slug);
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => toggleTool(t.slug)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${checked ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-amber-500/15 hover:bg-amber-500/5"}`}
                    data-testid={`promo-tool-pick-${t.slug}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-[#D4AF37] bg-gold-gradient text-[#060B18]" : "border-slate-500"}`}>{checked ? "✓" : ""}</span>
                    {t.icon ? <img src={toFullUrl(t.icon)} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-gradient text-xs font-black text-[#060B18]">{t.name.slice(0, 1)}</span>}
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{t.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="promos-admin">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">共 {promos.length} 篇推广图文 · 链接格式 <span className="font-mono text-xs text-[#E5C158]">{window.location.origin}/p/xxxx</span></div>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-6 py-2.5 text-sm font-bold text-[#060B18] transition-transform hover:scale-105" data-testid="promo-new-btn">
          <Plus size={16} /> 新建推广图文
        </button>
      </div>

      {promos.length === 0 && <div className="glass-card rounded-3xl py-16 text-center text-sm text-slate-500">还没有推广图文，点击右上角新建</div>}

      <div className="space-y-3">
        {promos.map((p, i) => {
          const live = p.published !== false;
          return (
            <div key={p.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4" data-testid={`promo-item-${i}`}>
              {p.cover ? (
                <img src={toFullUrl(p.cover)} alt="" className="h-14 w-20 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-amber-500/15 text-xs text-slate-600">无封面</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold text-slate-50">{p.title}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>{live ? "已上线" : "已下线"}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><Eye size={11} /> {p.views || 0} 次浏览</span>
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500" data-testid={`promo-link-${i}`}>{shareUrl(p.slug)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={async () => { await copyText(shareUrl(p.slug)); toast.success("分享链接已复制"); }} className="flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-xs font-bold text-[#060B18]" data-testid={`promo-copy-${i}`}>
                  <Link2 size={13} /> 复制链接
                </button>
                <a href={shareUrl(p.slug)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" data-testid={`promo-preview-${i}`}>
                  <ExternalLink size={13} /> 预览
                </a>
                <SharePoster url={shareUrl(p.slug)} title={p.title} subtitle={p.subtitle} badge="推广图文" className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" label="海报" />
                <button type="button" onClick={() => togglePublish(p)} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" data-testid={`promo-toggle-${i}`}>
                  {live ? <><EyeOff size={13} /> 下线</> : <><Eye size={13} /> 上线</>}
                </button>
                <button type="button" onClick={() => setEditing({ ...EMPTY, ...p, blocks: p.blocks || [] })} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] hover:bg-amber-500/10" data-testid={`promo-edit-${i}`}>
                  <Pencil size={13} /> 编辑
                </button>
                <button type="button" onClick={() => remove(p)} className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-xs text-red-300 hover:bg-red-500/10" data-testid={`promo-delete-${i}`}>
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
