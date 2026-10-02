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
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then((res) => {
        setContact({ ...DEFAULT_SETTINGS.contact, ...(res.data.contact || {}) });
        if (res.data.team && res.data.team.length) setTeam(res.data.team);
      })
      .catch(() => {});
  }, []);

  const setContactField = (key) => (e) => setContact({ ...contact, [key]: e.target.value });
  const setMember = (i, key) => (e) =>
    setTeam((prev) => prev.map((m, idx) => (idx === i ? { ...m, [key]: e.target.value } : m)));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, { contact, team }, { headers });
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
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">客服热线</label>
            <input data-testid="settings-hotline-input" value={contact.hotline} onChange={setContactField("hotline")} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-widest text-slate-400">微信客服</label>
            <input data-testid="settings-wechat-input" value={contact.wechat} onChange={setContactField("wechat")} className={inputCls} />
          </div>
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
