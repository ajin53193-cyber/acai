import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, Users, X } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

const emptyAgent = { name: "", avatar: "", username: "", password: "", weight: 1, enabled: true, remark: "" };
const inputCls = "w-full rounded-xl border border-amber-500/20 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]/60";

function AgentForm({ token, editing, onClose, onSaved }) {
  const [form, setForm] = useState(editing ? { ...editing, password: "" } : emptyAgent);
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) return toast.error("请填写名称和登录账号");
    setSaving(true);
    try {
      if (editing) await axios.put(`${API}/admin/cs/agents/${editing.id}`, form, { headers });
      else await axios.post(`${API}/admin/cs/agents`, form, { headers });
      toast.success("已保存"); onSaved();
    } catch (err) { toast.error(formatDetail(err.response?.data?.detail) || "保存失败"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" data-testid="cs-agent-form">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#0B1120] p-6">
        <div className="mb-5 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-gold-gradient">{editing ? "编辑坐席" : "新增坐席"}</h3><button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button></div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <ImageUpload token={token} value={form.avatar} onChange={(v) => setForm({ ...form, avatar: v })} round testid="cs-agent-avatar" />
            <div className="flex-1">
              <label className="mb-1.5 block text-xs tracking-widest text-slate-400">坐席名称</label>
              <input data-testid="cs-agent-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="如 客服小海" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs tracking-widest text-slate-400">登录账号</label><input data-testid="cs-agent-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputCls} /></div>
            <div><label className="mb-1.5 block text-xs tracking-widest text-slate-400">{editing ? "新密码（留空不改）" : "登录密码"}</label><input data-testid="cs-agent-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs tracking-widest text-slate-400">权重（接待占比）</label><input data-testid="cs-agent-weight" type="number" min={1} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 1 })} className={inputCls} /></div>
            <div className="flex items-end gap-2 pb-1">
              <button type="button" data-testid="cs-agent-enabled" onClick={() => setForm({ ...form, enabled: !form.enabled })} className={`relative h-7 w-12 rounded-full transition-colors ${form.enabled ? "bg-gold-gradient" : "bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${form.enabled ? "left-6" : "left-1"}`} /></button>
              <span className="text-sm text-slate-400">{form.enabled ? "启用" : "停用"}</span>
            </div>
          </div>
          <div><label className="mb-1.5 block text-xs tracking-widest text-slate-400">备注</label><input data-testid="cs-agent-remark" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className={inputCls} /></div>
        </div>
        <button onClick={save} disabled={saving} data-testid="cs-agent-save" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFE896] py-3 font-bold text-[#1B1403] active:scale-95 disabled:opacity-50"><Save size={16} /> 保存</button>
      </div>
    </div>
  );
}

export default function CSAdmin({ token, onUnauthorized }) {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState([]);
  const [cfg, setCfg] = useState({ welcome: "", enabled: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([
        axios.get(`${API}/admin/cs/agents`, { headers }),
        axios.get(`${API}/admin/cs/config`, { headers }),
        axios.get(`${API}/admin/cs/stats?days=30`, { headers }),
      ]);
      setAgents(a.data.agents || []);
      setCfg(c.data);
      setStats(s.data.agents || []);
    } catch (err) { if (err.response?.status === 401) onUnauthorized?.(); }
    // eslint-disable-next-line
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveCfg = async () => {
    try { await axios.put(`${API}/admin/cs/config`, cfg, { headers }); toast.success("客服设置已保存"); }
    catch { toast.error("保存失败"); }
  };
  const del = async (id) => {
    if (!window.confirm("确定删除该坐席？该坐席的历史会话仍保留。")) return;
    try { await axios.delete(`${API}/admin/cs/agents/${id}`, { headers }); toast.success("已删除"); load(); } catch { toast.error("删除失败"); }
  };
  const statFor = (id) => stats.find((s) => s.id === id) || { sessions: 0, replies: 0 };

  return (
    <div data-testid="cs-admin" className="space-y-6">
      {/* 客服系统设置 */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-gold-gradient">客服系统设置</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{cfg.enabled ? "已启用（推文页用站内客服）" : "已停用（推文页用外链）"}</span>
            <button data-testid="cs-config-enabled" onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })} className={`relative h-7 w-12 rounded-full transition-colors ${cfg.enabled ? "bg-gold-gradient" : "bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${cfg.enabled ? "left-6" : "left-1"}`} /></button>
          </div>
        </div>
        <label className="mb-1.5 block text-xs tracking-widest text-slate-400">欢迎语（访客打开聊天窗自动发送，支持换行与表情）</label>
        <textarea data-testid="cs-config-welcome" rows={6} value={cfg.welcome} onChange={(e) => setCfg({ ...cfg, welcome: e.target.value })} className={inputCls} />
        <button onClick={saveCfg} data-testid="cs-config-save" className="mt-3 rounded-xl bg-[#D4AF37]/20 px-5 py-2.5 text-sm font-bold text-[#E5C158] hover:bg-[#D4AF37]/30">保存设置</button>
        <p className="mt-3 text-xs text-slate-600">坐席工作台地址：<span className="text-[#E5C158]">你的域名/cs</span>（坐席用下方分配的账号密码登录）。快捷回复由每位坐席在工作台里自行添加。</p>
      </div>

      {/* 坐席列表 */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-gold-gradient"><Users size={16} /> 坐席管理（近30天接待量）</h3>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="cs-add-agent" className="flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-sm font-bold text-[#060B18] active:scale-95"><Plus size={15} /> 新增坐席</button>
        </div>
        {agents.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">还没有坐席，点「新增坐席」添加第一个客服账号</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-amber-500/10 text-left text-xs tracking-widest text-slate-500">
                <th className="py-2.5 pr-3">坐席</th><th className="py-2.5 pr-3">账号</th><th className="py-2.5 pr-3">权重</th><th className="py-2.5 pr-3">状态</th><th className="py-2.5 pr-3">接待会话</th><th className="py-2.5 pr-3">回复数</th><th className="py-2.5 pr-3">备注</th><th className="py-2.5 pr-3 text-right">操作</th>
              </tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-amber-500/5" data-testid={`cs-agent-row-${a.id}`}>
                    <td className="py-2.5 pr-3"><div className="flex items-center gap-2">{a.avatar ? <img src={a.avatar.startsWith("/api/") ? `${process.env.REACT_APP_BACKEND_URL}${a.avatar}` : a.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs">{a.name?.[0] || "客"}</div>}<span className="text-slate-200">{a.name}</span></div></td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{a.username}</td>
                    <td className="py-2.5 pr-3 text-slate-300">{a.weight}</td>
                    <td className="py-2.5 pr-3">{a.enabled ? <span className="text-green-400">启用</span> : <span className="text-slate-500">停用</span>}</td>
                    <td className="py-2.5 pr-3 font-bold text-[#E5C158]">{statFor(a.id).sessions}</td>
                    <td className="py-2.5 pr-3 text-slate-300">{statFor(a.id).replies}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{a.remark || "—"}</td>
                    <td className="py-2.5 pr-3"><div className="flex justify-end gap-2"><button onClick={() => { setEditing(a); setFormOpen(true); }} data-testid={`cs-edit-${a.id}`} className="text-slate-400 hover:text-[#E5C158]"><Pencil size={15} /></button><button onClick={() => del(a.id)} data-testid={`cs-del-${a.id}`} className="text-slate-400 hover:text-red-400"><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && <AgentForm token={token} editing={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />}
    </div>
  );
}
