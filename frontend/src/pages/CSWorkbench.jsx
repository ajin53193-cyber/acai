import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Send, LogOut, Plus, Trash2, Headphones, MessageSquare, ImagePlus, Zap } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

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

function QuickReplies({ token, initial, onInsert }) {
  const [replies, setReplies] = useState(initial || []);
  const [draft, setDraft] = useState("");
  const headers = { Authorization: `Bearer ${token}` };
  const save = async (list) => {
    setReplies(list);
    try { await axios.put(`${API}/cs/agent/quick-replies`, { replies: list }, { headers }); } catch { toast.error("保存失败"); }
  };
  const add = () => { const t = draft.trim(); if (!t) return; save([...replies, t]); setDraft(""); };
  return (
    <div data-testid="cs-quick-replies">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-[#9a7a16]"><Zap size={13} /> 快捷回复（点一下即发送）</div>
      <div className="space-y-2">
        {replies.map((r, i) => (
          <div key={i} className="group flex items-start gap-2 rounded-xl border border-amber-900/10 bg-white p-2.5 text-sm text-slate-600 shadow-sm transition-colors hover:border-[#D4AF37]/50">
            <button onClick={() => onInsert(r)} data-testid={`cs-qr-${i}`} className="flex-1 text-left leading-relaxed transition-colors hover:text-[#9a7a16]">{r}</button>
            <button onClick={() => save(replies.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-300 transition-colors hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
        {replies.length === 0 && <div className="rounded-xl border border-dashed border-amber-900/15 px-3 py-4 text-center text-xs text-slate-400">暂无常用语，添加后一键发送</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input data-testid="cs-qr-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="添加常用语…" className="flex-1 rounded-lg border border-amber-900/15 bg-[#faf8f2] px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#D4AF37]" />
        <button onClick={add} data-testid="cs-qr-add" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4AF37]/20 text-[#9a7a16] transition-colors hover:bg-[#D4AF37]/35"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function Workbench({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visitor, setVisitor] = useState(null);
  const [input, setInput] = useState("");
  const lastTs = useRef("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { axios.get(`${API}/cs/agent/me`, { headers }).then((r) => setMe(r.data)).catch(() => onLogout()); /* eslint-disable-next-line */ }, []);

  const loadSessions = useCallback(async () => {
    try { const r = await axios.get(`${API}/cs/agent/sessions`, { headers }); setSessions(r.data.sessions || []); }
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

  const activeSession = sessions.find((s) => s.id === active);

  return (
    <div className="flex h-[100dvh] bg-[#f6f2e9] text-slate-700" data-testid="cs-workbench">
      {/* 会话列表 */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-amber-900/10 bg-[#fbf9f3]">
        <div className="flex items-center justify-between border-b border-amber-900/10 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              {me?.avatar ? <img src={toFullUrl(me.avatar)} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-[#D4AF37]/50" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE896] to-[#D4AF37] text-xs font-bold text-[#6b5410]">客服</div>}
              <span className="cs-online-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-bold text-slate-800" data-testid="cs-wb-me">{me?.name || "客服"}</span>
              <span className="text-[10px] text-green-600">在线接待中</span>
            </div>
          </div>
          <button onClick={onLogout} data-testid="cs-wb-logout" className="text-slate-400 transition-colors hover:text-red-500"><LogOut size={16} /></button>
        </div>
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
        {me && <QuickReplies token={token} initial={me.quick_replies} onInsert={(t) => (active ? send(t) : toast.info("请先选择一个会话"))} />}
      </aside>
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
