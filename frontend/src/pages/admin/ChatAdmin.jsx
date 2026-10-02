import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { MessagesSquare, Send } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

export default function ChatAdmin({ token, onUnauthorized }) {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadSessions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/chat/sessions`, { headers });
      setSessions(res.data.sessions);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onUnauthorized]);

  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await axios.get(`${API}/admin/chat/${activeId}/messages`, { headers });
      setMessages(res.data.messages);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, token, onUnauthorized]);

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 6000);
    return () => clearInterval(timer);
  }, [loadSessions]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const reply = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    try {
      await axios.post(`${API}/admin/chat/${activeId}/messages`, { text: text.trim() }, { headers });
      setText("");
      loadMessages();
      loadSessions();
    } catch {
      toast.error("发送失败");
    }
  };

  const active = sessions.find((s) => s.id === activeId);

  return (
    <div className="grid gap-5 lg:grid-cols-3" data-testid="admin-chat">
      <div className="glass-card h-[560px] overflow-y-auto rounded-2xl p-3" data-testid="admin-chat-sessions">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
            <MessagesSquare size={28} className="text-slate-600" />
            暂无访客咨询
          </div>
        ) : (
          sessions.map((s, i) => (
            <button
              key={s.id}
              data-testid={`admin-chat-session-${i}`}
              onClick={() => setActiveId(s.id)}
              className={`mb-2 w-full rounded-xl p-4 text-left transition-colors ${
                activeId === s.id ? "border border-amber-500/40 bg-amber-500/10" : "border border-transparent hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100">{s.name}</span>
                {s.unread_admin && <span className="h-2 w-2 rounded-full bg-[#E5C158] shadow-[0_0_8px_rgba(229,193,88,0.9)]" />}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{s.last_message || "…"}</div>
              <div className="mt-1 text-[10px] text-slate-600">
                {s.last_message_at ? new Date(s.last_message_at).toLocaleString("zh-CN") : ""}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="glass-card flex h-[560px] flex-col overflow-hidden rounded-2xl lg:col-span-2" data-testid="admin-chat-window">
        {!activeId ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">选择左侧会话开始回复</div>
        ) : (
          <>
            <div className="border-b border-amber-500/15 px-5 py-3.5">
              <span className="font-display font-bold text-slate-100">{active?.name || "访客"}</span>
              <span className="ml-3 text-xs text-slate-500">会话 {activeId.slice(0, 8)}</span>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-5" data-testid="admin-chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.sender === "admin"
                        ? "rounded-br-sm bg-gold-gradient text-[#060B18]"
                        : "rounded-bl-sm border border-amber-500/20 bg-[#111D3C] text-slate-200"
                    }`}
                  >
                    {m.sender === "visitor" && <div className="mb-0.5 text-[10px] font-bold text-[#D4AF37]">{active?.name || "访客"}</div>}
                    {m.sender === "admin" && m.via === "ai" && <div className="mb-0.5 text-[10px] font-bold text-[#060B18]/70">AI客服</div>}
                    {m.text}
                    {m.image && (
                      <img src={toFullUrl(m.image)} alt="微信群二维码" className="mt-2 w-32 rounded-xl border border-black/10" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={reply} className="flex items-center gap-2 border-t border-amber-500/15 p-3">
              <input
                data-testid="admin-chat-reply-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入回复内容…"
                className="min-w-0 flex-1 rounded-full border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/60"
              />
              <button
                type="submit"
                data-testid="admin-chat-reply-btn"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-[#060B18] transition-transform hover:scale-105 active:scale-95"
                aria-label="发送回复"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
