import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from "lucide-react";
import { API, formatDetail } from "@/lib/api";

const CATEGORIES = ["绿色能源", "科技创新", "商业渠道", "实体产业"];
const STATUSES = ["对接中", "招募团长", "资金筹备"];

const EMPTY_FORM = {
  title: "",
  category: "科技创新",
  status: "对接中",
  investment: "",
  region: "",
  description: "",
  highlightsText: "",
  image: "",
};

const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";

export default function ProjectsAdmin({ token, onUnauthorized }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/projects`, { headers });
      setProjects(res.data.projects);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("加载项目失败");
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

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      title: p.title,
      category: p.category,
      status: p.status,
      investment: p.investment,
      region: p.region,
      description: p.description,
      highlightsText: (p.highlights || []).join("\n"),
      image: p.image,
    });
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("请填写项目名称");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      investment: form.investment.trim(),
      region: form.region.trim() || "全国",
      description: form.description.trim(),
      highlights: form.highlightsText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6),
      image: form.image.trim(),
    };
    try {
      if (editing) {
        await axios.put(`${API}/admin/projects/${editing.id}`, payload, { headers });
        toast.success("项目已更新");
      } else {
        await axios.post(`${API}/admin/projects`, payload, { headers });
        toast.success("项目已发布");
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

  const togglePublish = async (p) => {
    const next = p.published === false;
    try {
      await axios.patch(`${API}/admin/projects/${p.id}/publish`, { published: next }, { headers });
      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, published: next } : x)));
      toast.success(next ? "项目已上架" : "项目已下架");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("操作失败");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`确定删除项目「${p.title}」吗？此操作不可恢复。`)) return;
    try {
      await axios.delete(`${API}/admin/projects/${p.id}`, { headers });
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("项目已删除");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("删除失败");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500" data-testid="admin-projects-count">共 {projects.length} 个项目</p>
        <button
          data-testid="admin-project-create-btn"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={15} /> 新建项目
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <div className="space-y-4" data-testid="admin-projects-list">
          {projects.map((p, i) => {
            const live = p.published !== false;
            return (
              <div key={p.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4" data-testid={`admin-project-row-${i}`}>
                {p.image ? (
                  <img src={p.image} alt="" className="h-14 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-amber-500/15 text-xs text-slate-600">无图</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-slate-50">{p.title}</span>
                    <span className="rounded-full border border-amber-500/30 px-2.5 py-0.5 text-xs text-[#E5C158]">{p.category}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>
                      {live ? "上架中" : "已下架"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{p.region} · {p.investment} · {p.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    data-testid={`admin-project-toggle-${i}`}
                    onClick={() => togglePublish(p)}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs transition-colors ${
                      live ? "border-slate-500/40 text-slate-300 hover:bg-slate-500/10" : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                    }`}
                  >
                    {live ? <><EyeOff size={13} /> 下架</> : <><Eye size={13} /> 上架</>}
                  </button>
                  <button
                    data-testid={`admin-project-edit-${i}`}
                    onClick={() => openEdit(p)}
                    className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
                  >
                    <Pencil size={13} /> 编辑
                  </button>
                  <button
                    data-testid={`admin-project-delete-${i}`}
                    onClick={() => remove(p)}
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
            data-testid="project-form-modal"
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
                <h3 className="font-display text-xl font-bold text-gold-gradient">{editing ? "编辑项目" : "新建项目"}</h3>
                <button type="button" data-testid="project-form-close-btn" onClick={closeModal} className="rounded-full border border-amber-500/30 p-2 text-[#E5C158] hover:bg-amber-500/10" aria-label="关闭">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">项目名称 *</label>
                  <input data-testid="project-form-title-input" value={form.title} onChange={set("title")} placeholder="例如：绿源光伏社区电站" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">项目类别</label>
                  <select data-testid="project-form-category-select" value={form.category} onChange={set("category")} className={`${inputCls} appearance-none`}>
                    {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0A1228]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">状态标签</label>
                  <select data-testid="project-form-status-select" value={form.status} onChange={set("status")} className={`${inputCls} appearance-none`}>
                    {STATUSES.map((s) => <option key={s} value={s} className="bg-[#0A1228]">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">投入区间</label>
                  <input data-testid="project-form-investment-input" value={form.investment} onChange={set("investment")} placeholder="例如：50-200万" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">所在区域</label>
                  <input data-testid="project-form-region-input" value={form.region} onChange={set("region")} placeholder="例如：华东大区 / 全国" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">封面图片链接</label>
                  <input data-testid="project-form-image-input" value={form.image} onChange={set("image")} placeholder="https://…（项目卡片配图）" className={inputCls} />
                  {form.image && <img src={form.image} alt="预览" className="mt-3 h-28 w-full rounded-xl object-cover" />}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">项目描述</label>
                  <textarea data-testid="project-form-description-textarea" value={form.description} onChange={set("description")} rows={3} placeholder="一句话介绍项目亮点与模式" className={`${inputCls} resize-none`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs tracking-widest text-slate-400">项目亮点（每行一条，最多6条）</label>
                  <textarea data-testid="project-form-highlights-textarea" value={form.highlightsText} onChange={set("highlightsText")} rows={3} placeholder={"并网收益保障\n专业运维团队"} className={`${inputCls} resize-none`} />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                data-testid="project-form-save-btn"
                className="mt-6 w-full rounded-full bg-gold-gradient py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all hover:shadow-[0_0_32px_rgba(255,232,150,0.55)] disabled:opacity-60"
              >
                {saving ? "保存中…" : editing ? "保存修改" : "发布项目"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
