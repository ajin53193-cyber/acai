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
  const [team, setTeam] = useState(DEFAULT_SETTINGS.team);
  const [stats, setStats] = useState(DEFAULT_SETTINGS.stats);
  const [categories, setCategories] = useState(DEFAULT_SETTINGS.categories);
  const [chatCfg, setChatCfg] = useState(DEFAULT_SETTINGS.chat);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((res) => {
        setContact({ ...DEFAULT_SETTINGS.contact, ...(res.data.contact || {}) });
        if (res.data.team && res.data.team.length) setTeam(res.data.team);
        if (res.data.stats && res.data.stats.length) setStats(res.data.stats);
        if (res.data.categories && res.data.categories.length) setCategories(res.data.categories);
        setChatCfg({ ...DEFAULT_SETTINGS.chat, ...(res.data.chat || {}) });
      })
      .catch(() => {});
  }, []);

  const setContactField = (key) => (e) => setContact({ ...contact, [key]: e.target.value });
  const setMember = (i, key) => (e) =>
    setTeam((prev) => prev.map((m, idx) => (idx === i ? { ...m, [key]: e.target.value } : m)));
  const setStat = (i, key) => (e) =>
    setStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: e.target.value } : s)));
  const setCategory = (i) => (e) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, { contact, team, stats, categories: categories.map((c) => c.trim()).filter(Boolean), chat: chatCfg }, { headers });
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

      <div className="glass-card rounded-3xl p-7" data-testid="settings-team-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gold-gradient">核心团队</h3>
            <p className="mt-1 text-xs text-slate-500">显示在「关于我们」页面，点击按钮直接上传形象照</p>
          </div>
          <button
            data-testid="settings-team-add-btn"
            onClick={() => setTeam([...team, { role: "", person: "", image: "" }])}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <Plus size={13} /> 添加成员
          </button>
        </div>
        <div className="mt-6 space-y-5">
          {team.map((m, i) => (
            <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`settings-team-row-${i}`}>
              <div className="flex flex-wrap items-center gap-4">
                <ImageUpload
                  token={token}
                  value={m.image}
                  onChange={(url) => setTeam((prev) => prev.map((x, idx) => (idx === i ? { ...x, image: url } : x)))}
                  round
                  testid={`settings-team-image-${i}`}
                />
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <input data-testid={`settings-team-person-${i}`} value={m.person} onChange={setMember(i, "person")} placeholder="姓名，如：陈志远" className={inputCls} />
                  <input data-testid={`settings-team-role-${i}`} value={m.role} onChange={setMember(i, "role")} placeholder="职务，如：项目负责人" className={inputCls} />
                </div>
                <button
                  data-testid={`settings-team-remove-${i}`}
                  onClick={() => setTeam(team.filter((_, idx) => idx !== i))}
                  className="rounded-full border border-red-500/30 p-2.5 text-red-300 transition-colors hover:bg-red-500/10"
                  aria-label="删除成员"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
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
