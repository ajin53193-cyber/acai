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
        chatMerged.questions = (chatMerged.questions || []).map((q) => (typeof q === "string" ? { text: q, image: "", answer: "", link: "" } : { answer: "", link: "", ...q }));
        setChatCfg(chatMerged);
        if (res.data.tiers && res.data.tiers.length) setTiers(res.data.tiers);
        if (res.data.edges && res.data.edges.length) setEdges(res.data.edges);
        if (res.data.milestones && res.data.milestones.length) setMilestones(res.data.milestones);
      })
      .catch(() => {});
  }, []);

  const [qrPushStats, setQrPushStats] = useState([]);
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API}/admin/chat/qr-stats`, { headers })
      .then((res) => setQrPushStats(res.data.by_image || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const pushCountOf = (img) => qrPushStats.find((p) => p.image === img)?.count || 0;

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
      await axios.put(`${API}/admin/settings`, { contact, stats, categories: categories.map((c) => c.trim()).filter(Boolean), chat: { ...chatCfg, welcome_tutorial_label: (chatCfg.welcome_tutorial_label || "").trim(), welcome_tutorial_link: (chatCfg.welcome_tutorial_link || "").trim(), welcome_group_label: (chatCfg.welcome_group_label || "").trim(), questions: (chatCfg.questions || []).map((q) => ({ text: (q.text || "").trim(), image: q.image || "", answer: (q.answer || "").trim(), link: (q.link || "").trim() })).filter((q) => q.text) }, tiers: tiers.filter((t) => t.count.trim() && t.income.trim()), edges: edges.filter((x) => x.title.trim()), milestones: milestones.filter((x) => x.year.trim() && x.title.trim()) }, { headers });
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
        <p className="mt-1 text-xs text-slate-500">访客打开聊天窗即收到欢迎语 + 微信群二维码；点击常见问题卡片回复固定文案；其余留言由 AI 客服自动回答（可关闭），人工可随时在「在线客服」版块接管</p>
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4">
            <div>
              <div className="text-sm font-medium text-slate-200">AI 自动回复（GPT-5.4-mini）</div>
              <div className="mt-0.5 text-xs text-slate-500">开启后，访客自由留言会由 AI 根据网站项目、合作方式、收益档位与常见问题答案自动回复；关闭则只提示访客留下联系方式等待人工</div>
            </div>
            <button
              type="button"
              data-testid="settings-chat-ai-toggle"
              onClick={() => setChatCfg({ ...chatCfg, ai_enabled: !chatCfg.ai_enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${chatCfg.ai_enabled ? "bg-gold-gradient" : "bg-slate-700"}`}
              aria-label="AI自动回复开关"
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${chatCfg.ai_enabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
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
            <p className="mb-2 mt-3 text-xs text-slate-600">欢迎语下方显示两个按钮：「查看教程」跳转到指定页面，「加入微信群」点击后发送当前群二维码</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
              <input
                data-testid="settings-chat-welcome-tutorial-label"
                value={chatCfg.welcome_tutorial_label || ""}
                onChange={(e) => setChatCfg({ ...chatCfg, welcome_tutorial_label: e.target.value })}
                placeholder="教程按钮文字，如：了解最新项目 · 点击查看教程"
                className={inputCls}
              />
              <input
                data-testid="settings-chat-welcome-tutorial-link"
                value={chatCfg.welcome_tutorial_link || ""}
                onChange={(e) => setChatCfg({ ...chatCfg, welcome_tutorial_link: e.target.value })}
                placeholder="教程按钮链接，如 /tutorials/gift-card（留空则不显示）"
                className={inputCls}
              />
              <input
                data-testid="settings-chat-welcome-group-label"
                value={chatCfg.welcome_group_label || ""}
                onChange={(e) => setChatCfg({ ...chatCfg, welcome_group_label: e.target.value })}
                placeholder="群按钮文字"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">常见问题卡片</label>
            <p className="mb-2 text-xs text-slate-600">显示在欢迎语下方，访客点击卡片即可一键提问并收到自动回复；可配回答文案和图片（如项目海报、收益图），都不填则仅记录点击</p>
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
                  <textarea
                    data-testid={`settings-chat-question-answer-${i}`}
                    value={q.answer || ""}
                    onChange={(e) => setChatCfg({ ...chatCfg, questions: chatCfg.questions.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)) })}
                    placeholder="自动回复文案（可选）：访客点击此问题时自动发送这段文字"
                    rows={2}
                    className={`${inputCls} mt-2.5 resize-none`}
                  />
                  <input
                    data-testid={`settings-chat-question-link-${i}`}
                    value={q.link || ""}
                    onChange={(e) => setChatCfg({ ...chatCfg, questions: chatCfg.questions.map((x, idx) => (idx === i ? { ...x, link: e.target.value } : x)) })}
                    placeholder="跳转链接（可选）：如 /tutorials/gift-card，访客点击此问题后自动打开该页面"
                    className={`${inputCls} mt-2.5`}
                  />
                </div>
              ))}
              <button
                type="button"
                data-testid="settings-chat-question-add-btn"
                onClick={() => setChatCfg({ ...chatCfg, questions: [...(chatCfg.questions || []), { text: "", image: "", answer: "", link: "" }] })}
                className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
              >
                <Plus size={13} /> 添加问题
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4">
            <div className="text-sm font-medium text-slate-200">微信群二维码（活码管理）</div>
            <div className="mb-3 mt-0.5 text-xs text-slate-500">可上传多个群二维码，访客询问怎么合作/怎么加入/联系方式/人工客服时，自动发送当前启用的群二维码引导进群，同时显示在联系我们页；群快满 200 人或码快过期时会标红提醒换群</div>
            <div className="space-y-3">
              {(chatCfg.qr_codes || []).map((q, i) => (
                <div key={i} className="rounded-xl border border-amber-500/10 bg-[#060B18]/40 p-3" data-testid={`qr-code-row-${i}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <ImageUpload
                      token={token}
                      value={q.image}
                      onChange={(url) => setChatCfg({ ...chatCfg, qr_codes: chatCfg.qr_codes.map((x, idx) => (idx === i ? { ...x, image: url } : x)) })}
                      testid={`qr-code-upload-${i}`}
                    />
                    <div className="min-w-[160px] flex-1 space-y-2">
                      <input
                        value={q.label}
                        onChange={(e) => setChatCfg({ ...chatCfg, qr_codes: chatCfg.qr_codes.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)) })}
                        placeholder="群序号，如：3群"
                        className={inputCls}
                        data-testid={`qr-code-label-${i}`}
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={!!q.active}
                          onChange={(e) => setChatCfg({ ...chatCfg, qr_codes: chatCfg.qr_codes.map((x, idx) => (idx === i ? { ...x, active: e.target.checked } : x)) })}
                          data-testid={`qr-code-active-${i}`}
                          className="h-3.5 w-3.5 accent-[#D4AF37]"
                        />
                        启用此群（访客将收到该群二维码）
                      </label>
                      {q.image && <QrExpiryNotice updatedAt={q.uploaded_at} pushCount={pushCountOf(q.image)} />}
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatCfg({ ...chatCfg, qr_codes: chatCfg.qr_codes.filter((_, idx) => idx !== i) })}
                      data-testid={`qr-code-del-${i}`}
                      className="rounded-lg border border-red-500/30 p-2 text-red-400 transition-colors hover:bg-red-500/10"
                      aria-label="删除该群二维码"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setChatCfg({ ...chatCfg, qr_codes: [...(chatCfg.qr_codes || []), { image: "", label: `${(chatCfg.qr_codes || []).length + 1}群`, uploaded_at: "", active: true }] })}
              data-testid="qr-code-add-btn"
              className="mt-3 flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
            >
              <Plus size={13} /> 添加群二维码
            </button>
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

const QrExpiryNotice = ({ updatedAt, pushCount = 0 }) => {
  const items = [];
  if (updatedAt) {
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
    const timeText = new Date(updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    if (days >= 6) items.push({ level: "red", text: `已上传 ${days} 天 · 微信群二维码 7 天过期，请立即重新上传换码！` });
    else if (days >= 5) items.push({ level: "amber", text: `上传于 ${timeText}（第 ${days + 1} 天）· 即将过期，建议尽快换码` });
    else items.push({ level: "normal", text: `上传于 ${timeText}（第 ${days + 1} 天）· 7 天有效，到期前此处会标红提醒` });
  } else {
    items.push({ level: "normal", text: "上传时间未知（历史二维码），建议重新上传一次以开启防过期提醒" });
  }
  if (pushCount >= 180) items.push({ level: "red", text: `已推送 ${pushCount} 次 · 群满 200 人后扫码失效，请立即新建群并换码！` });
  else if (pushCount >= 150) items.push({ level: "amber", text: `已推送 ${pushCount} 次 · 接近 200 人满群，请提前准备新群二维码` });
  else if (pushCount > 0) items.push({ level: "normal", text: `已推送 ${pushCount} 次 · 群满 200 人后需换群` });
  const cls = {
    red: "border-red-500/40 bg-red-500/10 font-bold text-red-400",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    normal: "border-amber-500/15 bg-amber-500/5 text-slate-500",
  };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className={`rounded-lg border px-3 py-1.5 text-[11px] ${cls[it.level]}`} data-testid={it.level === "normal" ? "qr-upload-time" : "qr-expiry-warning"}>
          {it.text}
        </div>
      ))}
    </div>
  );
};
