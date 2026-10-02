import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload, toFullUrl } from "@/components/ImageUpload";

const EMPTY_FORM = { title: "", summary: "", content: "", cover: "" };

const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";

export default function ArticlesAdmin({ token, onUnauthorized }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/articles`, { headers });
      setArticles(res.data.articles);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("加载文章失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, summary: a.summary, content: a.content, cover: a.cover });
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("请填写文章标题");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      cover: form.cover,
    };
    try {
      if (editing) {
        await axios.put(`${API}/admin/articles/${editing.id}`, payload, { headers });
        toast.success("文章已更新");
      } else {
        await axios.post(`${API}/admin/articles`, payload, { headers });
        toast.success("文章已发布");
      }
      closeModal();
      load();
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (a) => {
    const next = a.published === false;
    try {
      await axios.patch(`${API}/admin/articles/${a.id}/publish`, { published: next }, { headers });
      setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, published: next } : x)));
      toast.success(next ? "文章已发布" : "文章已下架");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("操作失败");
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`确定删除文章「${a.title}」吗？此操作不可恢复。`)) return;
    try {
      await axios.delete(`${API}/admin/articles/${a.id}`, { headers });
      setArticles((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("文章已删除");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("删除失败");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500" data-testid="admin-articles-count">共 {articles.length} 篇文章</p>
        <button
          data-testid="admin-article-create-btn"
          onClick={() => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={15} /> 发布文章
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <div className="space-y-4" data-testid="admin-articles-list">
          {articles.map((a, i) => {
            const live = a.published !== false;
            return (
              <div key={a.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4" data-testid={`admin-article-row-${i}`}>
                {a.cover ? (
                  <img src={toFullUrl(a.cover)} alt="" className="h-14 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-amber-500/15 text-xs text-slate-600">无图</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-slate-50">{a.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>
                      {live ? "已发布" : "已下架"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {new Date(a.created_at).toLocaleDateString("zh-CN")} · {a.summary || "无摘要"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    data-testid={`admin-article-toggle-${i}`}
                    onClick={() => togglePublish(a)}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs transition-colors ${
                      live ? "border-slate-500/40 text-slate-300 hover:bg-slate-500/10" : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                    }`}
                  >
                    {live ? <><EyeOff size={13} /> 下架</> : <><Eye size={13} /> 发布</>}
                  </button>
                  <button
                    data-testid={`admin-article-edit-${i}`}
                    onClick={() => openEdit(a)}
                    className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
                  >
                    <Pencil size={13} /> 编辑
                  </button>
                  <button
                    data-testid={`admin-article-delete-${i}`}
                    onClick={() => remove(a)}
                    className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 size={13} /> 删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            data-testid="article-form-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060B18]/85 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.form
              onSubmit={save}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="glass-card max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-gold-gradient">{editing ? "编辑文章" : "发布文章"}</h3>
                <button type="button" data-testid="article-form-close-btn" onClick={closeModal} className="rounded-full border border-amber-500/30 p-2 text-[#E5C158] hover:bg-amber-500/10" aria-label="关闭">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">文章标题 *</label>
                  <input data-testid="article-form-title-input" value={form.title} onChange={set("title")} placeholder="例如：分布式光伏新政落地" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">摘要</label>
                  <input data-testid="article-form-summary-input" value={form.summary} onChange={set("summary")} placeholder="一句话概括，显示在列表卡片上" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">封面图（直接上传）</label>
                  <ImageUpload token={token} value={form.cover} onChange={(url) => setForm({ ...form, cover: url })} testid="article-form-cover-upload" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">正文（空行分段）</label>
                  <textarea data-testid="article-form-content-textarea" value={form.content} onChange={set("content")} rows={8} placeholder="输入文章正文…" className={`${inputCls} resize-y`} />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                data-testid="article-form-save-btn"
                className="mt-6 w-full rounded-full bg-gold-gradient py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all hover:shadow-[0_0_32px_rgba(255,232,150,0.55)] disabled:opacity-60"
              >
                {saving ? "保存中…" : editing ? "保存修改" : "发布文章"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
