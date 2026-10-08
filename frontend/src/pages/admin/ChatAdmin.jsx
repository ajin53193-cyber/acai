import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { MessagesSquare, Send, MousePointerClick, QrCode } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { sourceLabel } from "@/lib/source";

export default function ChatAdmin({ token, onUnauthorized }) {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [qStats, setQStats] = useState([]);
  const [qrStats, setQrStats] = useState(null);
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

  const loadQStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/chat/question-stats`, { headers });
      setQStats(res.data.stats);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadQrStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/chat/qr-stats`, { headers });
      setQrStats(res.data);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    loadQStats();
    loadQrStats();
    const timer = setInterval(loadSessions, 6000);
    const statTimer = setInterval(() => {
      loadQStats();
      loadQrStats();
    }, 15000);
    return () => {
      clearInterval(timer);
      clearInterval(statTimer);
    };
  }, [loadSessions, loadQStats, loadQrStats]);

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
    <div data-testid="admin-chat">
      {qStats.length > 0 && (
        <div className="glass-card mb-5 rounded-2xl p-5" data-testid="admin-chat-question-stats">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <MousePointerClick size={16} className="text-[#D4AF37]" />
            问题卡片点击统计
            <span className="text-xs font-normal text-slate-500">访客点击欢迎语下方问题卡片的次数</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {qStats.map((s, i) => (
              <div
                key={s.question}
                data-testid={`question-stat-${i}`}
                className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-[#060B18]/60 px-4 py-3"
              >
                <span className="text-sm text-slate-200">{s.question}</span>
                <span className="font-display text-lg font-black text-gold-gradient">{s.total}</span>
                <span className="text-[10px] text-slate-500">近7天 {s.last7d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {qrStats && qrStats.total > 0 && (
        <div className="glass-card mb-5 rounded-2xl p-5" data-testid="admin-chat-qr-stats">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-100">
            <QrCode size={16} className="text-[#D4AF37]" />
            进群二维码推送统计
            <span className="text-xs font-normal text-slate-500">访客触发海鸥官方群二维码自动推送的次数</span>
            <span className="ml-auto flex items-center gap-4 text-xs font-normal text-slate-400">
              <span>今日 <span className="font-display text-base font-black text-gold-gradient" data-testid="qr-stats-today">{qrStats.today}</span> 次</span>
              <span>累计 <span className="font-display text-base font-black text-gold-gradient" data-testid="qr-stats-total">{qrStats.total}</span> 次</span>
            </span>
          </div>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {qrStats.daily.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                <div className="text-[9px] text-[#E5C158] opacity-0 transition-opacity group-hover:opacity-100">{d.count}</div>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[#997316]/60 to-[#FFE896] transition-all duration-500 group-hover:shadow-[0_0_12px_rgba(212,175,55,0.5)]"
                  style={{ height: `${Math.max(2, (d.count / Math.max(1, ...qrStats.daily.map((x) => x.count))) * 72)}px` }}
                  title={`${d.date}：${d.count} 次推送`}
                />
                <div className="text-[8px] text-slate-600">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
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
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
                  {s.name}
                  {s.ended_at && (
                    <span className="rounded-full border border-slate-500/40 px-1.5 py-0.5 text-[9px] font-normal text-slate-400" data-testid={`chat-session-ended-${i}`}>已结束</span>
                  )}
                  {s.source && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-normal text-[#E5C158]" data-testid={`chat-session-source-${i}`}>
                      {sourceLabel(s.source)}
                    </span>
                  )}
                </span>
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
            </div>            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-5" data-testid="admin-chat-messages">
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
                    {m.sender === "admin" && ["ai", "auto", "auto_fallback"].includes(m.via) && <div className="mb-0.5 text-[10px] font-bold text-[#060B18]/70">{m.via === "ai" ? "AI客服" : "自动回复"}</div>}
                    <span className="whitespace-pre-line">{m.text}</span>
                    {m.image && (
                      <img src={toFullUrl(m.image)} alt="客服图片" loading="lazy" decoding="async" className="mt-2 w-full max-w-[280px] rounded-xl border border-black/10" />
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
    </div>
  );
}
