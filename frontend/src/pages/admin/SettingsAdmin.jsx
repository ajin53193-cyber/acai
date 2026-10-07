import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { API, DEFAULT_SETTINGS, formatDetail, invalidateSettings } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";

export default function SettingsAdmin({ token, onUnauthorized }) {
  const [contact, setContact] = useState(DEFAULT_SETTINGS.contact);
  const [stats, setStats] = useState(DEFAULT_SETTINGS.stats);
  const [categories, setCategories] = useState(DEFAULT_SETTINGS.categories);
  const [chatCfg, setChatCfg] = useState(DEFAULT_SETTINGS.chat);
  const [tiers, setTiers] = useState(DEFAULT_SETTINGS.tiers);
  const [edges, setEdges] = useState(DEFAULT_SETTINGS.edges);
  const [milestones, setMilestones] = useState(DEFAULT_SETTINGS.milestones);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((res) => {
        setContact({ ...DEFAULT_SETTINGS.contact, ...(res.data.contact || {}) });
        if (res.data.stats && res.data.stats.length) setStats(res.data.stats);
        if (res.data.categories && res.data.categories.length) setCategories(res.data.categories);
        const chatMerged = { ...DEFAULT_SETTINGS.chat, ...(res.data.chat || {}) };
        chatMerged.questions = (chatMerged.questions || []).map((q) => (typeof q === "string" ? { text: q, image: "" } : q));
        setChatCfg(chatMerged);
        if (res.data.tiers && res.data.tiers.length) setTiers(res.data.tiers);
        if (res.data.edges && res.data.edges.length) setEdges(res.data.edges);
        if (res.data.milestones && res.data.milestones.length) setMilestones(res.data.milestones);
      })
      .catch(() => {});
  }, []);

  const setContactField = (key) => (e) => setContact({ ...contact, [key]: e.target.value });
  const setStat = (i, key) => (e) =>
    setStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: e.target.value } : s)));
  const setCategory = (i) => (e) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)));
  const setTier = (i, key) => (e) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: e.target.value } : t)));
  const setEdge = (i, key) => (e) =>
    setEdges((prev) => prev.map((x, idx) => (idx === i ? { ...x, [key]: e.target.value } : x)));
  const setMilestone = (i, key) => (e) =>
    setMilestones((prev) => prev.map((x, idx) => (idx === i ? { ...x, [key]: e.target.value } : x)));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, { contact, stats, categories: categories.map((c) => c.trim()).filter(Boolean), chat: { ...chatCfg, questions: (chatCfg.questions || []).map((q) => ({ text: (q.text || "").trim(), image: q.image || "" })).filter((q) => q.text) }, tiers: tiers.filter((t) => t.count.trim() && t.income.trim()), edges: edges.filter((x) => x.title.trim()), milestones: milestones.filter((x) => x.year.trim() && x.title.trim()) }, { headers });
      invalidateSettings();
      toast.success("设置已保存，前台页面已同步更新");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-3xl p-7" data-testid="settings-contact-card">
        <h3 className="font-display text-lg font-bold text-gold-gradient">联系方式</h3>
        <p className="mt-1 text-xs text-slate-500">显示在「联系我们」页面与全站页脚</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">工作时间</label>
            <input data-testid="settings-hours-input" value={contact.hours} onChange={setContactField("hours")} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">邮箱</label>
            <input data-testid="settings-email-input" value={contact.email} onChange={setContactField("email")} className={inputCls} />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-stats-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">平台数据</h3>
            <p className="mt-1 text-xs text-slate-500">显示在首页首屏与「关于我们」数据墙，前 3 项会出现在首页</p>
          </div>
          <button
            data-testid="settings-stats-add-btn"
            onClick={() => setStats([...stats, { num: "", suffix: "+", label: "" }])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加数据
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`settings-stat-row-${i}`}>
              <div className="flex-1 min-w-[90px]">
                <label className="mb-1 block text-[10px] tracking-widest text-slate-500">数值</label>
                <input data-testid={`settings-stat-num-${i}`} value={s.num} onChange={setStat(i, "num")} placeholder="36" className={inputCls} />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-[10px] tracking-widest text-slate-500">后缀</label>
                <input data-testid={`settings-stat-suffix-${i}`} value={s.suffix} onChange={setStat(i, "suffix")} placeholder="+ / 分钟内" className={inputCls} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="mb-1 block text-[10px] tracking-widest text-slate-500">标签</label>
                <input data-testid={`settings-stat-label-${i}`} value={s.label} onChange={setStat(i, "label")} placeholder="优质项目" className={inputCls} />
              </div>
              <button
                data-testid={`settings-stat-remove-${i}`}
                onClick={() => setStats(stats.filter((_, idx) => idx !== i))}
                className="mt-4 rounded-full border border-red-500/30 p-2.5 text-red-300 transition-colors hover:bg-red-500/10"
                aria-label="删除数据"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-categories-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">项目分类</h3>
            <p className="mt-1 text-xs text-slate-500">前台项目中心的筛选标签与后台新建项目时的可选项</p>
          </div>
          <button
            data-testid="settings-category-add-btn"
            onClick={() => setCategories([...categories, ""])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加分类
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {categories.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-full border border-amber-500/15 bg-[#060B18]/50 py-1.5 pl-4 pr-1.5" data-testid={`settings-category-row-${i}`}>
              <input
                data-testid={`settings-category-input-${i}`}
                value={c}
                onChange={setCategory(i)}
                placeholder="分类名称"
                className="w-28 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
              <button
                data-testid={`settings-category-remove-${i}`}
                onClick={() => setCategories(categories.filter((_, idx) => idx !== i))}
                className="rounded-full p-1.5 text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
                aria-label="删除分类"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-600">注意：删除分类不会删除已有项目，这些项目仍保留原分类标签。</p>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-chat-card">
        <h3 className="font-display text-lg font-bold text-gold-gradient">在线客服</h3>
        <p className="mt-1 text-xs text-slate-500">配置访客打开聊天窗时看到的欢迎语，以及 AI 自动回复</p>
        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">欢迎语</label>
            <textarea
              data-testid="settings-chat-welcome-textarea"
              value={chatCfg.welcome}
              onChange={(e) => setChatCfg({ ...chatCfg, welcome: e.target.value })}
              rows={2}
              placeholder="您好，欢迎来到合赢项目社！…"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">常见问题卡片</label>
            <p className="mb-2 text-xs text-slate-600">显示在欢迎语下方，访客点击卡片即可一键提问；配上图片后，点击卡片还会自动发出该图（如项目海报、收益图）</p>
            <div className="space-y-3">
              {(chatCfg.questions || []).map((q, i) => (
                <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-3" data-testid={`settings-chat-question-row-${i}`}>
                  <div className="flex items-center gap-2">
                    <input
                      data-testid={`settings-chat-question-input-${i}`}
                      value={q.text}
                      onChange={(e) => setChatCfg({ ...chatCfg, questions: chatCfg.questions.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)) })}
                      placeholder={`问题 ${i + 1}`}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      data-testid={`settings-chat-question-remove-${i}`}
                      onClick={() => setChatCfg({ ...chatCfg, questions: chatCfg.questions.filter((_, idx) => idx !== i) })}
                      className="shrink-0 rounded-full p-2 text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      aria-label="删除问题"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="shrink-0 text-[10px] text-slate-500">配图(可选)</span>
                    <ImageUpload
                      token={token}
                      value={q.image}
                      onChange={(url) => setChatCfg({ ...chatCfg, questions: chatCfg.questions.map((x, idx) => (idx === i ? { ...x, image: url } : x)) })}
                      testid={`settings-chat-question-image-${i}`}
                    />
                    {q.image && (
                      <button
                        type="button"
                        data-testid={`settings-chat-question-image-clear-${i}`}
                        onClick={() => setChatCfg({ ...chatCfg, questions: chatCfg.questions.map((x, idx) => (idx === i ? { ...x, image: "" } : x)) })}
                        className="shrink-0 text-[10px] text-slate-500 underline hover:text-red-300"
                      >
                        移除配图
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                data-testid="settings-chat-question-add-btn"
                onClick={() => setChatCfg({ ...chatCfg, questions: [...(chatCfg.questions || []), { text: "", image: "" }] })}
                className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
              >
                <Plus size={13} /> 添加问题
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4">
            <div>
              <div className="text-sm font-medium text-slate-200">AI 自动回复</div>
              <div className="mt-0.5 text-xs text-slate-500">开启后，访客消息会先由 AI 客服自动回复，人工客服可随时在「在线客服」版块接管</div>
            </div>
            <button
              type="button"
              data-testid="settings-chat-ai-toggle"
              onClick={() => setChatCfg({ ...chatCfg, ai_enabled: !chatCfg.ai_enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${chatCfg.ai_enabled ? "bg-gold-gradient" : "bg-slate-700"}`}
              aria-label="AI自动回复开关"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${chatCfg.ai_enabled ? "left-6" : "left-1"}`}
              />
            </button>
          </div>
          <div className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4">
            <div className="text-sm font-medium text-slate-200">微信群二维码</div>
            <div className="mb-3 mt-0.5 text-xs text-slate-500">访客询问怎么合作/怎么加入/联系方式/人工客服时，聊天窗会自动发送此二维码引导进群；同时显示在联系我们页</div>
            <ImageUpload
              token={token}
              value={chatCfg.qr_image}
              onChange={(url) => setChatCfg({ ...chatCfg, qr_image: url })}
              testid="settings-chat-qr-upload"
            />
            {chatCfg.qr_image && <QrExpiryNotice updatedAt={chatCfg.qr_updated_at} />}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-tiers-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">团长收益体系</h3>
            <p className="mt-1 text-xs text-slate-500">显示在「合作共赢」页的收益卡片，可设置一档为热门</p>
          </div>
          <button
            data-testid="settings-tier-add-btn"
            onClick={() => setTiers([...tiers, { count: "", income: "", featured: false }])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加档位
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {tiers.map((t, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`settings-tier-row-${i}`}>
              <div className="flex-1 min-w-[120px]">
                <label className="mb-1 block text-[10px] tracking-widest text-slate-500">团队规模</label>
                <input data-testid={`settings-tier-count-${i}`} value={t.count} onChange={setTier(i, "count")} placeholder="10人团队" className={inputCls} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="mb-1 block text-[10px] tracking-widest text-slate-500">月入参考</label>
                <input data-testid={`settings-tier-income-${i}`} value={t.income} onChange={setTier(i, "income")} placeholder="2-3万" className={inputCls} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  data-testid={`settings-tier-featured-${i}`}
                  checked={!!t.featured}
                  onChange={(e) => setTiers((prev) => prev.map((x, idx) => (idx === i ? { ...x, featured: e.target.checked } : x)))}
                  className="h-4 w-4 accent-amber-500"
                />
                热门
              </label>
              <button
                data-testid={`settings-tier-remove-${i}`}
                onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))}
                className="mb-0.5 rounded-full border border-red-500/30 p-2.5 text-red-300 transition-colors hover:bg-red-500/10"
                aria-label="删除档位"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-edges-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">我们的优势</h3>
            <p className="mt-1 text-xs text-slate-500">显示在首页「我们的优势」版块，标题、介绍、配图都可修改</p>
          </div>
          <button
            data-testid="settings-edge-add-btn"
            onClick={() => setEdges([...edges, { title: "", desc: "", image: "" }])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加优势
          </button>
        </div>
        <div className="mt-6 space-y-5">
          {edges.map((ed, i) => (
            <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`settings-edge-row-${i}`}>
              <div className="flex flex-wrap items-center gap-4">
                <ImageUpload
                  token={token}
                  value={ed.image}
                  onChange={(url) => setEdges((prev) => prev.map((x, idx) => (idx === i ? { ...x, image: url } : x)))}
                  testid={`settings-edge-image-${i}`}
                />
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <input data-testid={`settings-edge-title-${i}`} value={ed.title} onChange={setEdge(i, "title")} placeholder="标题，如：专业项目审核" className={inputCls} />
                  <input data-testid={`settings-edge-desc-${i}`} value={ed.desc} onChange={setEdge(i, "desc")} placeholder="一句话介绍" className={inputCls} />
                </div>
                <button
                  data-testid={`settings-edge-remove-${i}`}
                  onClick={() => setEdges(edges.filter((_, idx) => idx !== i))}
                  className="rounded-full border border-red-500/30 p-2.5 text-red-300 transition-colors hover:bg-red-500/10"
                  aria-label="删除优势"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-7" data-testid="settings-milestones-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">平台发展历程</h3>
            <p className="mt-1 text-xs text-slate-500">显示在「关于我们」页面的发展历程时间轴，按年份排列</p>
          </div>
          <button
            data-testid="settings-milestone-add-btn"
            onClick={() => setMilestones([...milestones, { year: "", title: "", desc: "" }])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加节点
          </button>
        </div>
        <div className="mt-6 space-y-5">
          {milestones.map((m, i) => (
            <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`settings-milestone-row-${i}`}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid flex-1 gap-3 sm:grid-cols-[110px_1fr_1.4fr]">
                  <input data-testid={`settings-milestone-year-${i}`} value={m.year} onChange={setMilestone(i, "year")} placeholder="年份，如：2024" className={inputCls} />
                  <input data-testid={`settings-milestone-title-${i}`} value={m.title} onChange={setMilestone(i, "title")} placeholder="节点标题，如：平台创立" className={inputCls} />
                  <input data-testid={`settings-milestone-desc-${i}`} value={m.desc} onChange={setMilestone(i, "desc")} placeholder="一句话介绍" className={inputCls} />
                </div>
                <button
                  data-testid={`settings-milestone-remove-${i}`}
                  onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}
                  className="rounded-full border border-red-500/30 p-2.5 text-red-300 transition-colors hover:bg-red-500/10"
                  aria-label="删除节点"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        data-testid="settings-save-btn"
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 rounded-full bg-gold-gradient px-10 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all hover:shadow-[0_0_32px_rgba(255,232,150,0.55)] disabled:opacity-60"
      >
        <Save size={15} /> {saving ? "保存中…" : "保存全部设置"}
      </button>
    </div>
  );
}

const QrExpiryNotice = ({ updatedAt }) => {
  if (!updatedAt) {
    return (
      <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-slate-500" data-testid="qr-upload-time">
        上传时间未知（历史二维码），建议重新上传一次以开启防过期提醒
      </div>
    );
  }
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  const timeText = new Date(updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (days >= 6) {
    return (
      <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-400" data-testid="qr-expiry-warning">
        已上传 {days} 天 · 微信群二维码 7 天过期，请立即重新上传换码！
      </div>
    );
  }
  if (days >= 5) {
    return (
      <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400" data-testid="qr-expiry-warning">
        上传于 {timeText}（第 {days + 1} 天）· 即将过期，建议尽快换码
      </div>
    );
  }
  return (
    <div className="mt-2 text-[11px] text-slate-500" data-testid="qr-upload-time">
      上传于 {timeText}（第 {days + 1} 天）· 微信群二维码 7 天有效，到期前此处会标红提醒
    </div>
  );
};
