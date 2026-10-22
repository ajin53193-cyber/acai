import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Send, LogOut, Plus, Trash2, Headphones, MessageSquare, ImagePlus, Zap, X, Power, Clock } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { StatusLogTable } from "@/components/StatusLogTable";

const TOKEN_KEY = "hy_cs_agent_token";
const timeShort = (iso) => { try { return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

function Login({ onLogin }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await axios.post(`${API}/cs/agent/login`, { username, password });
      localStorage.setItem(TOKEN_KEY, r.data.token);
      onLogin(r.data.token);
    } catch (err) { toast.error(formatDetail(err.response?.data?.detail) || "登录失败"); } finally { setLoading(false); }
  };
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f6f2e9] px-4" data-testid="cs-login">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#D4AF37]/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#B8860B]/8 blur-3xl" />
      <motion.form
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-3xl border border-amber-900/10 bg-white/90 p-8 shadow-[0_30px_80px_-35px_rgba(184,134,11,0.5)] backdrop-blur-xl"
      >
        <div className="mb-1 flex items-center gap-2.5 text-[#9a7a16]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE896] to-[#D4AF37] text-[#6b5410]"><Headphones size={20} /></div>
          <h1 className="font-display text-xl font-bold text-slate-800">客服工作台</h1>
        </div>
        <p className="mb-7 text-xs tracking-wide text-slate-400">合赢项目社 · 坐席登录</p>
        <label className="mb-1.5 block text-xs tracking-widest text-slate-500">坐席账号</label>
        <input data-testid="cs-login-username" value={username} onChange={(e) => setU(e.target.value)} className="mb-4 w-full rounded-xl border border-amber-900/15 bg-[#faf8f2] px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20" />
        <label className="mb-1.5 block text-xs tracking-widest text-slate-500">密码</label>
        <input data-testid="cs-login-password" type="password" value={password} onChange={(e) => setP(e.target.value)} className="mb-6 w-full rounded-xl border border-amber-900/15 bg-[#faf8f2] px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20" />
        <motion.button whileTap={{ scale: 0.97 }} data-testid="cs-login-submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFE896] py-3 font-bold text-[#1B1403] shadow-lg shadow-[#D4AF37]/25 transition-opacity disabled:opacity-50">{loading ? "登录中…" : "登录"}</motion.button>
      </motion.form>
    </div>
  );
}

function QRAddForm({ token, groups, defaultGroup, onSaved, onClose }) {
  const [group, setGroup] = useState(defaultGroup || "我的常用语");
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };
  const upload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { const fd = new FormData(); fd.append("file", file); const up = await axios.post(`${API}/cs/agent/upload`, fd, { headers }); setImage(up.data.url); }
    catch { toast.error("图片上传失败"); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!text.trim() && !image) return toast.error("话术文本和图片至少填写一项");
    setBusy(true);
    try { await axios.post(`${API}/cs/agent/quick-replies`, { group: group.trim() || "我的常用语", text, image }, { headers }); toast.success("话术已添加"); onSaved(); onClose(); }
    catch (err) { toast.error(formatDetail(err.response?.data?.detail) || "添加失败"); } finally { setBusy(false); }
  };
  return (
    <div className="mb-3 rounded-xl border border-[#D4AF37]/40 bg-white p-3 shadow-sm" data-testid="cs-qrlib-form">
      <input list="cs-qrlib-groups" data-testid="cs-qrlib-form-group" maxLength={30} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="分组（可输入新分组名）" className="mb-2 w-full rounded-lg border border-amber-900/15 bg-[#faf8f2] px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#D4AF37]" />
      <datalist id="cs-qrlib-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <textarea data-testid="cs-qrlib-form-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="话术文本（支持换行）" className="mb-2 w-full rounded-lg border border-amber-900/15 bg-[#faf8f2] px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#D4AF37]" />
      <div className="mb-2 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="cs-qrlib-form-file" />
        <button onClick={() => fileRef.current?.click()} disabled={busy} data-testid="cs-qrlib-form-image-btn" className="flex items-center gap-1 rounded-lg border border-amber-900/15 px-2.5 py-1.5 text-xs text-slate-500 hover:border-[#D4AF37] hover:text-[#9a7a16] disabled:opacity-50"><ImagePlus size={13} /> {image ? "更换图片" : "添加图片"}</button>
        {image && <div className="relative"><img src={toFullUrl(image)} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-amber-900/10" /><button onClick={() => setImage("")} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white"><X size={10} /></button></div>}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">取消</button>
        <button onClick={save} disabled={busy} data-testid="cs-qrlib-form-save" className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FFE896] px-4 py-1.5 text-xs font-bold text-[#1B1403] disabled:opacity-50">{busy ? "保存中…" : "保存"}</button>
      </div>
    </div>
  );
}

function QRLibrary({ token, onSend }) {
  const [list, setList] = useState([]);
  const [me, setMe] = useState("");
  const [group, setGroup] = useState("全部");
  const [adding, setAdding] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const load = useCallback(() => axios.get(`${API}/cs/agent/quick-replies`, { headers }).then((r) => { setList(r.data.replies || []); setMe(r.data.me || ""); }).catch(() => {}), [token]); // eslint-disable-line
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]); // 后台改了话术，坐席端一分钟内同步
  const groups = [...new Set(list.map((r) => r.group))];
  const shown = group === "全部" ? list : list.filter((r) => r.group === group);
  const del = async (id) => {
    if (!window.confirm("确定删除这条话术？")) return;
    try { await axios.delete(`${API}/cs/agent/quick-replies/${id}`, { headers }); load(); }
    catch (err) { toast.error(formatDetail(err.response?.data?.detail) || "删除失败"); }
  };
  return (
    <div data-testid="cs-qr-library">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-[#9a7a16]"><Zap size={13} /> 快捷回复（点一下即发送）</div>
        <button onClick={() => setAdding((v) => !v)} data-testid="cs-qrlib-add" aria-label="添加话术" className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4AF37]/20 text-[#9a7a16] transition-colors hover:bg-[#D4AF37]/35"><Plus size={15} /></button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5" data-testid="cs-qrlib-groups">
        {["全部", ...groups].map((g) => (
          <button key={g} onClick={() => setGroup(g)} data-testid={`cs-qrlib-group-${g}`} className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${group === g ? "bg-[#D4AF37]/25 text-[#9a7a16] ring-1 ring-[#D4AF37]/40" : "bg-amber-900/5 text-slate-500 hover:bg-amber-900/10"}`}>{g}</button>
        ))}
      </div>
      {adding && <QRAddForm token={token} groups={groups} defaultGroup={group === "全部" ? "我的常用语" : group} onSaved={load} onClose={() => setAdding(false)} />}
      <div className="space-y-2">
        {shown.length === 0 && <div className="rounded-xl border border-dashed border-amber-900/15 px-3 py-4 text-center text-xs text-slate-400">暂无话术，点右上角 + 添加</div>}
        {shown.map((r) => (
          <div key={r.id} className="group flex items-start gap-2 rounded-xl border border-amber-900/10 bg-white p-2.5 text-sm text-slate-600 shadow-sm transition-colors hover:border-[#D4AF37]/50">
            <button onClick={() => onSend(r)} data-testid={`cs-qrlib-${r.id}`} className="flex min-w-0 flex-1 items-start gap-2 text-left transition-colors hover:text-[#9a7a16]">
              {r.image && <img src={toFullUrl(r.image)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-amber-900/10" />}
              <span className="line-clamp-3 min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">{r.text || <span className="italic text-slate-400">[图片]</span>}</span>
            </button>
            {r.created_by === me && <button onClick={() => del(r.id)} data-testid={`cs-qrlib-del-${r.id}`} aria-label="删除" className="shrink-0 text-slate-300 transition-colors hover:text-red-400"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusLogModal({ token, onClose }) {
  const day = (n) => { const d = new Date(Date.now() + 8 * 3600 * 1000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const [range, setRange] = useState({ start: day(13), end: day(0) });
  const [rows, setRows] = useState(null);
  const query = (r = range) => {
    setRows(null);
    axios.get(`${API}/cs/agent/status-log`, { headers: { Authorization: `Bearer ${token}` }, params: { start: r.start, end: r.end } }).then((res) => setRows(res.data.days || [])).catch(() => setRows([]));
  };
  useEffect(() => { query(); }, [token]); // eslint-disable-line
  const dateCls = "rounded-lg border border-amber-900/15 bg-[#faf8f2] px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#D4AF37]";
  const total = (rows || []).reduce((a, r) => a + r.online_minutes, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose} data-testid="cs-status-log-modal">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800"><Clock size={16} className="text-[#9a7a16]" /> 我的上下线记录</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="cs-mylog-filter">
          <input type="date" data-testid="cs-mylog-start" value={range.start} max={range.end} onChange={(e) => setRange({ ...range, start: e.target.value })} className={dateCls} />
          <span className="text-xs text-slate-400">至</span>
          <input type="date" data-testid="cs-mylog-end" value={range.end} min={range.start} onChange={(e) => setRange({ ...range, end: e.target.value })} className={dateCls} />
          <button onClick={() => query()} data-testid="cs-mylog-query" className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FFE896] px-4 py-1.5 text-xs font-bold text-[#1B1403]">查询</button>
          {[7, 14, 30].map((n) => <button key={n} onClick={() => { const r = { start: day(n - 1), end: day(0) }; setRange(r); query(r); }} className="rounded-full bg-amber-900/5 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-amber-900/10">近{n}天</button>)}
          <span className="ml-auto text-xs text-slate-400">合计在线 {Math.floor(total / 60)} 小时 {total % 60} 分</span>
        </div>
        {rows === null ? <div className="py-8 text-center text-xs text-slate-400">加载中…</div> : <StatusLogTable rows={rows} />}
      </motion.div>
    </div>
  );
}

function Workbench({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [online, setOnline] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visitor, setVisitor] = useState(null);
  const [input, setInput] = useState("");
  const lastTs = useRef("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { axios.get(`${API}/cs/agent/me`, { headers }).then((r) => { setMe(r.data); setOnline(!!r.data.online); }).catch(() => onLogout()); /* eslint-disable-next-line */ }, []);

  const toggleOnline = async () => {
    const next = !online;
    try { await axios.post(`${API}/cs/agent/status`, { online: next }, { headers }); setOnline(next); toast.success(next ? "已上线，开始接待新访客" : "已下线，新访客不再分配给你"); }
    catch { toast.error("操作失败"); }
  };

  const loadSessions = useCallback(async () => {
    try { const r = await axios.get(`${API}/cs/agent/sessions`, { headers }); setSessions(r.data.sessions || []); if (typeof r.data.online === "boolean") setOnline(r.data.online); }
    catch (e) { if (e.response?.status === 401) onLogout(); }
    // eslint-disable-next-line
  }, []);

  useEffect(() => { loadSessions(); const t = setInterval(loadSessions, 3000); return () => clearInterval(t); }, [loadSessions]);
  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const pollMessages = useCallback(async (sid) => {
    try {
      const r = await axios.get(`${API}/cs/agent/sessions/${sid}/messages`, { headers, params: lastTs.current ? { after: lastTs.current } : {} });
      if (r.data.visitor) setVisitor(r.data.visitor);
      const list = r.data.messages || [];
      if (list.length) {
        lastTs.current = list[list.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const incoming = list.filter((m) => !seen.has(m.id));
          const incomingTexts = new Set(incoming.map((m) => `${m.sender}|${m.text}`));
          const cleaned = prev.filter((m) => !(String(m.id).startsWith("tmp-") && incomingTexts.has(`${m.sender}|${m.text}`)));
          return [...cleaned, ...incoming];
        });
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!active) return;
    setMessages([]); lastTs.current = "";
    pollMessages(active);
    const t = setInterval(() => pollMessages(active), 2000);
    axios.post(`${API}/cs/agent/sessions/${active}/read`, {}, { headers }).catch(() => {});
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [active, pollMessages]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || !active) return;
    setMessages((p) => [...p, { id: `tmp-${Date.now()}`, sender: "agent", text: t, created_at: new Date().toISOString() }]);
    setInput("");
    try { await axios.post(`${API}/cs/agent/sessions/${active}/reply`, { text: t }, { headers }); await pollMessages(active); loadSessions(); }
    catch { toast.error("发送失败"); }
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await axios.post(`${API}/cs/agent/upload`, fd, { headers });
      await axios.post(`${API}/cs/agent/sessions/${active}/reply`, { text: "", image: up.data.url }, { headers });
      await pollMessages(active); loadSessions();
    } catch { toast.error("图片发送失败"); }
  };

  const sendLibrary = async (r) => {
    if (!active) return toast.info("请先选择一个会话");
    try {
      if (r.image) {
        setMessages((p) => [...p, { id: `tmp-${Date.now()}-img`, sender: "agent", text: "", image: r.image, created_at: new Date().toISOString() }]);
        await axios.post(`${API}/cs/agent/sessions/${active}/reply`, { text: "", image: r.image }, { headers });
      }
      if (r.text) await send(r.text);
      else { await pollMessages(active); loadSessions(); }
    } catch { toast.error("发送失败"); }
  };

  const activeSession = sessions.find((s) => s.id === active);

  return (
    <div className="flex h-[100dvh] bg-[#f6f2e9] text-slate-700" data-testid="cs-workbench">
      {/* 会话列表 */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-amber-900/10 bg-[#fbf9f3]">
        <div className="flex items-center justify-between border-b border-amber-900/10 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              {me?.avatar ? <img src={toFullUrl(me.avatar)} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-[#D4AF37]/50" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE896] to-[#D4AF37] text-xs font-bold text-[#6b5410]">客服</div>}
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? "cs-online-dot bg-green-500" : "bg-slate-400"}`} />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-bold text-slate-800" data-testid="cs-wb-me">{me?.name || "客服"}</span>
              <span className={`text-[10px] ${online ? "text-green-600" : "text-slate-400"}`} data-testid="cs-wb-status-text">{online ? "在线接待中" : "已下线"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowLog(true)} data-testid="cs-wb-log-btn" title="我的上下线记录" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-900/5 hover:text-[#9a7a16]"><Clock size={15} /></button>
            <button onClick={onLogout} data-testid="cs-wb-logout" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-red-500"><LogOut size={15} /></button>
          </div>
        </div>
        <button onClick={toggleOnline} data-testid="cs-wb-toggle-online" className={`mx-3 mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${online ? "bg-white text-slate-600 ring-1 ring-amber-900/10 hover:ring-red-300" : "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25"}`}>
          <span className="flex items-center gap-2"><Power size={15} /> {online ? "点击下线" : "点击上线接待"}</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${online ? "bg-green-500" : "bg-white/40"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${online ? "left-[18px]" : "left-0.5"}`} /></span>
        </button>
        <div className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-widest text-slate-400">访客会话 · {sessions.length}</div>
        <div className="cs-scroll-light flex-1 overflow-y-auto px-2 pb-2" data-testid="cs-wb-sessions">
          {sessions.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">暂无访客会话</div>
          ) : sessions.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} data-testid={`cs-wb-session-${s.id}`} className={`mb-1 flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${active === s.id ? "bg-gradient-to-r from-[#D4AF37]/18 to-transparent ring-1 ring-[#D4AF37]/35" : "hover:bg-amber-900/5"}`}>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs ${active === s.id ? "bg-[#D4AF37]/25 text-[#9a7a16]" : "bg-amber-900/8 text-slate-400"}`}><MessageSquare size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-medium text-slate-700">{s.region || s.ip || "访客"}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{timeShort(s.last_message_at)}</span>
                </div>
                <div className="truncate text-xs text-slate-400">{s.last_message || "—"}</div>
              </div>
              {s.unread_agent > 0 && <span className="cs-online-dot mt-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{s.unread_agent}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* 聊天区 */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-[#faf8f2]">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-amber-900/10 bg-white/70 px-5 py-3 backdrop-blur-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-900/8 text-slate-500"><MessageSquare size={16} /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800">{visitor?.region || activeSession?.region || "访客"}</div>
                <div className="truncate text-xs text-slate-400">来源渠道：{visitor?.source || "—"}｜IP：{visitor?.ip || "—"}</div>
              </div>
            </div>
            <div className="cs-scroll-light flex-1 space-y-3.5 overflow-y-auto px-5 py-5" data-testid="cs-wb-messages">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className={`flex items-end gap-2 ${m.sender === "agent" ? "justify-end" : "justify-start"}`}
                  >
                    {m.sender !== "agent" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-900/8 text-[10px] text-slate-500">访</div>}
                    <div className="flex max-w-[70%] flex-col">
                      <div className={`overflow-hidden whitespace-pre-wrap break-words text-sm leading-relaxed shadow-sm ${m.image ? "rounded-2xl p-1" : "px-3.5 py-2"} ${m.sender === "agent" ? "rounded-2xl rounded-br-md bg-gradient-to-br from-[#E5C158] to-[#D4AF37] text-[#1B1403]" : "rounded-2xl rounded-bl-md border border-amber-900/10 bg-white text-slate-700"}`}>
                        {m.image ? <a href={toFullUrl(m.image)} target="_blank" rel="noreferrer"><img src={toFullUrl(m.image)} alt="图片" className="max-h-60 rounded-xl" /></a> : m.text}
                      </div>
                      <span className={`mt-1 px-1 text-[10px] text-slate-400 ${m.sender === "agent" ? "text-right" : "text-left"}`}>{timeShort(m.created_at)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-amber-900/10 bg-white/70 p-3 backdrop-blur-md">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} data-testid="cs-wb-file" />
              <button onClick={() => fileRef.current?.click()} aria-label="发送图片" data-testid="cs-wb-image-btn" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-amber-900/5 hover:text-[#9a7a16]"><ImagePlus size={19} /></button>
              <input data-testid="cs-wb-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="输入回复…" className="flex-1 rounded-full border border-amber-900/15 bg-[#faf8f2] px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-[#D4AF37]" />
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => send()} data-testid="cs-wb-send" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#E5C158] to-[#B8860B] text-white shadow-md"><Send size={17} /></motion.button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-900/5 text-slate-300"><MessageSquare size={28} /></div>
            <div className="text-sm">← 选择左侧会话开始接待</div>
          </div>
        )}
      </main>

      {/* 快捷回复 */}
      <aside className="cs-scroll-light hidden w-72 shrink-0 overflow-y-auto border-l border-amber-900/10 bg-[#fbf9f3] p-4 lg:block">
        {me && <QRLibrary token={token} onSend={sendLibrary} />}
      </aside>

      {showLog && <StatusLogModal token={token} onClose={() => setShowLog(false)} />}
    </div>
  );
}

export default function CSWorkbench() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setToken(""); };
  useEffect(() => {
    document.title = "客服工作台 | 合赢项目社";
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "#f6f2e9");
    const html = document.documentElement, body = document.body;
    const prevHtmlBg = html.style.backgroundColor, prevBodyBg = body.style.backgroundColor, prevScheme = html.style.colorScheme;
    html.style.backgroundColor = "#f6f2e9"; body.style.backgroundColor = "#f6f2e9"; html.style.colorScheme = "light";
    return () => {
      if (meta && prev) meta.setAttribute("content", prev);
      html.style.backgroundColor = prevHtmlBg; body.style.backgroundColor = prevBodyBg; html.style.colorScheme = prevScheme;
    };
  }, []);
  return token ? <Workbench token={token} onLogout={logout} /> : <Login onLogin={setToken} />;
}
