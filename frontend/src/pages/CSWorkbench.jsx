import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Send, LogOut, Plus, Trash2, Headphones, MessageSquare, ImagePlus } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4" data-testid="cs-login">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-[#0B1120] p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-2 text-[#E5C158]"><Headphones size={22} /><h1 className="font-display text-xl font-bold">客服工作台</h1></div>
        <label className="mb-1.5 block text-xs tracking-widest text-slate-400">坐席账号</label>
        <input data-testid="cs-login-username" value={username} onChange={(e) => setU(e.target.value)} className="mb-4 w-full rounded-xl border border-amber-500/20 bg-[#060B18] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]" />
        <label className="mb-1.5 block text-xs tracking-widest text-slate-400">密码</label>
        <input data-testid="cs-login-password" type="password" value={password} onChange={(e) => setP(e.target.value)} className="mb-6 w-full rounded-xl border border-amber-500/20 bg-[#060B18] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]" />
        <button data-testid="cs-login-submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFE896] py-3 font-bold text-[#1B1403] transition-transform active:scale-95 disabled:opacity-50">{loading ? "登录中…" : "登录"}</button>
      </form>
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
      <div className="mb-3 text-xs tracking-widest text-slate-400">快捷回复（点一下即发送）</div>
      <div className="space-y-2">
        {replies.map((r, i) => (
          <div key={i} className="group flex items-start gap-2 rounded-lg border border-amber-500/15 bg-[#0B1120] p-2.5 text-sm text-slate-300">
            <button onClick={() => onInsert(r)} data-testid={`cs-qr-${i}`} className="flex-1 text-left leading-relaxed hover:text-[#FFE896]">{r}</button>
            <button onClick={() => save(replies.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input data-testid="cs-qr-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="添加常用语…" className="flex-1 rounded-lg border border-amber-500/20 bg-[#060B18] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#D4AF37]" />
        <button onClick={add} data-testid="cs-qr-add" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4AF37]/20 text-[#E5C158] hover:bg-[#D4AF37]/30"><Plus size={16} /></button>
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

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200" data-testid="cs-workbench">
      {/* 会话列表 */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0B1120]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            {me?.avatar ? <img src={toFullUrl(me.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/30 text-xs">客服</div>}
            <span className="text-sm font-bold text-[#E5C158]" data-testid="cs-wb-me">{me?.name || "客服"}</span>
          </div>
          <button onClick={onLogout} data-testid="cs-wb-logout" className="text-slate-500 hover:text-red-400"><LogOut size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="cs-wb-sessions">
          {sessions.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-600">暂无访客会话</div>
          ) : sessions.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} data-testid={`cs-wb-session-${s.id}`} className={`flex w-full items-start gap-2 border-b border-slate-800/60 px-3 py-3 text-left transition-colors ${active === s.id ? "bg-[#D4AF37]/10" : "hover:bg-slate-800/40"}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs"><MessageSquare size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm text-slate-200">{s.region || s.ip || "访客"}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{timeShort(s.last_message_at)}</span>
                </div>
                <div className="truncate text-xs text-slate-500">{s.last_message || "—"}</div>
              </div>
              {s.unread_agent > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{s.unread_agent}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* 聊天区 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="border-b border-slate-800 px-5 py-3 text-sm">
              <span className="font-bold text-slate-200">{visitor?.region || "访客"}</span>
              <span className="ml-3 text-xs text-slate-500">来源渠道：{visitor?.source || "—"}｜IP：{visitor?.ip || "—"}</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-900 px-5 py-4" data-testid="cs-wb-messages">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] overflow-hidden whitespace-pre-wrap break-words rounded-2xl text-sm leading-relaxed ${m.image ? "p-1" : "px-3.5 py-2"} ${m.sender === "agent" ? "rounded-br-sm bg-[#D4AF37] text-[#1B1403]" : "rounded-bl-sm bg-slate-800 text-slate-200"}`}>{m.image ? <a href={toFullUrl(m.image)} target="_blank" rel="noreferrer"><img src={toFullUrl(m.image)} alt="图片" className="max-h-60 rounded-xl" /></a> : m.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-slate-800 p-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} data-testid="cs-wb-file" />
              <button onClick={() => fileRef.current?.click()} aria-label="发送图片" data-testid="cs-wb-image-btn" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#E5C158]"><ImagePlus size={19} /></button>
              <input data-testid="cs-wb-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="输入回复…" className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]" />
              <button onClick={() => send()} data-testid="cs-wb-send" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white active:scale-90"><Send size={17} /></button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-600">← 选择左侧会话开始接待</div>
        )}
      </main>

      {/* 快捷回复 */}
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0B1120] p-4 lg:block">
        {me && <QuickReplies token={token} initial={me.quick_replies} onInsert={(t) => (active ? send(t) : toast.info("请先选择一个会话"))} />}
      </aside>
    </div>
  );
}

export default function CSWorkbench() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setToken(""); };
  useEffect(() => { document.title = "客服工作台 | 合赢项目社"; }, []);
  return token ? <Workbench token={token} onLogout={logout} /> : <Login onLogin={setToken} />;
}
