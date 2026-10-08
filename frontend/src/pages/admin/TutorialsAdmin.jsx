import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload, toFullUrl } from "@/components/ImageUpload";
import { VideoUpload } from "@/components/VideoUpload";

const EMPTY_STEP = { title: "", text: "", image: "", video_url: "", buttons: [] };
const normalizeStep = (st) => {
  const buttons = [...(st.buttons || [])];
  if (st.button_link && !buttons.some((b) => b.link === st.button_link)) buttons.unshift({ label: st.button_label || "", link: st.button_link });
  return { ...EMPTY_STEP, ...st, buttons, button_label: undefined, button_link: undefined };
};
const EMPTY_FORM = { title: "", slug: "", summary: "", cover: "", video_url: "", steps: [{ ...EMPTY_STEP }], cta_label: "", cta_link: "", back_label: "返回首页", back_link: "/" };

const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";
const labelCls = "mb-1.5 block text-xs tracking-widest text-slate-400";

export default function TutorialsAdmin({ token, onUnauthorized }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/tutorials`, { headers });
      setList(res.data.tutorials);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("加载教程失败");
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

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      title: t.title,
      slug: t.slug,
      summary: t.summary || "",
      cover: t.cover || "",
      video_url: t.video_url || "",
      steps: t.steps?.length ? t.steps.map(normalizeStep) : [{ ...EMPTY_STEP }],
      cta_label: t.cta_label || "",
      cta_link: t.cta_link || "",
      back_label: t.back_label || "返回首页",
      back_link: t.back_link || "/",
    });
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setStep = (i, patch) => setForm({ ...form, steps: form.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const moveStep = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= form.steps.length) return;
    const steps = [...form.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setForm({ ...form, steps });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("请填写教程标题");
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) return toast.error("链接标识只能用小写字母、数字和短横线，如 gift-card");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      cover: form.cover,
      video_url: form.video_url.trim(),
      steps: form.steps
        .map((s) => ({
          title: s.title.trim(),
          text: s.text.trim(),
          image: s.image || "",
          video_url: (s.video_url || "").trim(),
          buttons: (s.buttons || []).map((b) => ({ label: (b.label || "").trim(), link: (b.link || "").trim() })).filter((b) => b.link),
        }))
        .filter((s) => s.title || s.text || s.image || s.video_url || s.buttons.length),
      cta_label: form.cta_label.trim(),
      cta_link: form.cta_link.trim(),
      back_label: form.back_label.trim() || "返回首页",
      back_link: form.back_link.trim() || "/",
    };
    try {
      if (editing) {
        await axios.put(`${API}/admin/tutorials/${editing.id}`, payload, { headers });
        toast.success("教程已更新");
      } else {
        await axios.post(`${API}/admin/tutorials`, payload, { headers });
        toast.success("教程已发布");
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

  const togglePublish = async (t) => {
    const next = t.published === false;
    try {
      await axios.patch(`${API}/admin/tutorials/${t.id}/publish`, { published: next }, { headers });
      setList((prev) => prev.map((x) => (x.id === t.id ? { ...x, published: next } : x)));
      toast.success(next ? "教程已上架" : "教程已下架");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("操作失败");
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`确定删除教程「${t.title}」吗？此操作不可恢复。`)) return;
    try {
      await axios.delete(`${API}/admin/tutorials/${t.id}`, { headers });
      setList((prev) => prev.filter((x) => x.id !== t.id));
      toast.success("教程已删除");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("删除失败");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500" data-testid="admin-tutorials-count">共 {list.length} 篇教程</p>
          <p className="mt-1 text-xs text-slate-500">教程页地址：/tutorials/链接标识 —— 在「站点设置 → 在线客服」给常见问题填上这个地址，访客点击即可跳转</p>
        </div>
        <button
          data-testid="admin-tutorial-create-btn"
          onClick={() => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={15} /> 新建教程
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <div className="space-y-4" data-testid="admin-tutorials-list">
          {list.map((t, i) => {
            const live = t.published !== false;
            return (
              <div key={t.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4" data-testid={`admin-tutorial-row-${i}`}>
                {t.cover ? (
                  <img src={toFullUrl(t.cover)} alt="" loading="lazy" decoding="async" className="h-14 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-amber-500/15 text-xs text-slate-600">无封面</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-slate-50">{t.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>{live ? "已上架" : "已下架"}</span>
                    {t.video_url && <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">含视频</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-500">
                    <a href={`/tutorials/${t.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#E5C158] hover:underline" data-testid={`admin-tutorial-link-${i}`}>
                      /tutorials/{t.slug} <ExternalLink size={11} />
                    </a>
                    · {t.steps?.length || 0} 个步骤
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button data-testid={`admin-tutorial-toggle-${i}`} onClick={() => togglePublish(t)} className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs transition-colors ${live ? "border-slate-500/40 text-slate-300 hover:bg-slate-500/10" : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"}`}>
                    {live ? <><EyeOff size={13} /> 下架</> : <><Eye size={13} /> 上架</>}
                  </button>
                  <button data-testid={`admin-tutorial-edit-${i}`} onClick={() => openEdit(t)} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10">
                    <Pencil size={13} /> 编辑
                  </button>
                  <button data-testid={`admin-tutorial-delete-${i}`} onClick={() => remove(t)} className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10">
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
            data-testid="tutorial-form-modal"
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
                <h3 className="font-display text-xl font-bold text-gold-gradient">{editing ? "编辑教程" : "新建教程"}</h3>
                <button type="button" data-testid="tutorial-form-close-btn" onClick={closeModal} className="rounded-full border border-amber-500/30 p-2 text-[#E5C158] hover:bg-amber-500/10" aria-label="关闭">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
                  <div>
                    <label className={labelCls}>教程标题 *</label>
                    <input data-testid="tutorial-title-input" value={form.title} onChange={set("title")} placeholder="如：礼品卡项目教程" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>链接标识 *</label>
                    <input data-testid="tutorial-slug-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="gift-card" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>一句话简介</label>
                  <input data-testid="tutorial-summary-input" value={form.summary} onChange={set("summary")} placeholder="显示在标题下方" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>教程视频</label>
                  <VideoUpload token={token} value={form.video_url} onChange={(url) => setForm({ ...form, video_url: url })} testid="tutorial-video-upload" />
                </div>
                <div>
                  <label className={labelCls}>封面图（无视频时显示在顶部）</label>
                  <ImageUpload token={token} value={form.cover} onChange={(url) => setForm({ ...form, cover: url })} testid="tutorial-cover-upload" />
                </div>

                <div className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4">
                  <label className={labelCls}>页面按钮</label>
                  <p className="mb-3 text-[11px] text-slate-500">「跳转按钮」显示在教程底部（如：立即报名 → 报名表单链接，填了链接才显示）；「返回按钮」显示在页面左上角</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input data-testid="tutorial-cta-label-input" value={form.cta_label} onChange={set("cta_label")} placeholder="跳转按钮名称，如：立即加入" className={inputCls} />
                    <input data-testid="tutorial-cta-link-input" value={form.cta_link} onChange={set("cta_link")} placeholder="跳转链接，如 /cooperation 或 https://..." className={inputCls} />
                    <input data-testid="tutorial-back-label-input" value={form.back_label} onChange={set("back_label")} placeholder="返回按钮名称，如：返回首页" className={inputCls} />
                    <input data-testid="tutorial-back-link-input" value={form.back_link} onChange={set("back_link")} placeholder="返回链接，如 / 或 /projects" className={inputCls} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs tracking-widest text-slate-400">图文步骤</label>
                    <button type="button" data-testid="tutorial-add-step-btn" onClick={() => setForm({ ...form, steps: [...form.steps, { ...EMPTY_STEP }] })} className="flex items-center gap-1 rounded-full border border-amber-500/30 px-3 py-1.5 text-xs text-[#E5C158] hover:bg-amber-500/10">
                      <Plus size={12} /> 添加步骤
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.steps.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`tutorial-step-editor-${i}`}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient text-[11px] font-black text-[#060B18]">{i + 1}</span>
                          <input data-testid={`tutorial-step-title-${i}`} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="步骤标题，如：第一步 开通账号" className={inputCls} />
                          <button type="button" onClick={() => moveStep(i, -1)} className="rounded-full border border-amber-500/20 p-1.5 text-slate-400 hover:text-[#E5C158]" aria-label="上移"><ArrowUp size={13} /></button>
                          <button type="button" onClick={() => moveStep(i, 1)} className="rounded-full border border-amber-500/20 p-1.5 text-slate-400 hover:text-[#E5C158]" aria-label="下移"><ArrowDown size={13} /></button>
                          <button type="button" data-testid={`tutorial-step-remove-${i}`} onClick={() => setForm({ ...form, steps: form.steps.filter((_, idx) => idx !== i) })} className="rounded-full border border-red-500/30 p-1.5 text-red-300 hover:bg-red-500/10" aria-label="删除步骤"><Trash2 size={13} /></button>
                        </div>
                        <textarea data-testid={`tutorial-step-text-${i}`} value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} rows={3} placeholder="步骤说明文字，支持换行" className={`${inputCls} resize-y`} />
                        <div className="mt-2">
                          <ImageUpload token={token} value={s.image} onChange={(url) => setStep(i, { image: url })} testid={`tutorial-step-image-${i}`} />
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 text-[11px] tracking-widest text-slate-500">本步骤视频（可选）</div>
                          <VideoUpload token={token} value={s.video_url || ""} onChange={(url) => setStep(i, { video_url: url })} testid={`tutorial-step-video-${i}`} />
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] tracking-widest text-slate-500">本步骤按钮（可选，可加多个，填了链接才显示）</span>
                            <button type="button" data-testid={`tutorial-step-add-button-${i}`} onClick={() => setStep(i, { buttons: [...(s.buttons || []), { label: "", link: "" }] })} className="flex items-center gap-1 rounded-full border border-amber-500/30 px-2.5 py-1 text-[11px] text-[#E5C158] hover:bg-amber-500/10">
                              <Plus size={11} /> 添加按钮
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(s.buttons || []).map((b, bi) => (
                              <div key={bi} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]" data-testid={`tutorial-step-button-${i}-${bi}`}>
                                <input data-testid={`tutorial-step-button-label-${i}-${bi}`} value={b.label} onChange={(e) => setStep(i, { buttons: s.buttons.map((x, idx) => (idx === bi ? { ...x, label: e.target.value } : x)) })} placeholder="按钮名称，如：注册商城账户" className={inputCls} />
                                <input data-testid={`tutorial-step-button-link-${i}-${bi}`} value={b.link} onChange={(e) => setStep(i, { buttons: s.buttons.map((x, idx) => (idx === bi ? { ...x, link: e.target.value } : x)) })} placeholder="跳转链接，如 https://www.lpk-888.com 或 /tutorials/okx-usdt" className={inputCls} />
                                <button type="button" data-testid={`tutorial-step-remove-button-${i}-${bi}`} onClick={() => setStep(i, { buttons: s.buttons.filter((_, idx) => idx !== bi) })} className="rounded-full border border-red-500/30 px-3 text-red-300 hover:bg-red-500/10" aria-label="删除按钮"><Trash2 size={13} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-full border border-amber-500/30 px-6 py-2.5 text-sm text-slate-300 hover:bg-amber-500/10">取消</button>
                <button type="submit" data-testid="tutorial-form-submit-btn" disabled={saving} className="rounded-full bg-gold-gradient px-8 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60">
                  {saving ? "保存中…" : editing ? "保存修改" : "发布教程"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
