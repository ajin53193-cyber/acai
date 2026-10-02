import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { MessageCircle, X, Send } from "lucide-react";
import { API } from "@/lib/api";

const SID_KEY = "hy_chat_sid";
const NAME_KEY = "hy_chat_name";

const getSessionId = () => {
  let sid = localStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SID_KEY, sid);
  }
  return sid;
};

export const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [started, setStarted] = useState(() => !!localStorage.getItem(NAME_KEY));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const sid = useRef(getSessionId());

  const load = useCallback(async () => {
    if (!started) return;
    try {
      const res = await axios.get(`${API}/chat/${sid.current}/messages`);
      setMessages(res.data.messages);
    } catch { /* session not created yet */ }
  }, [started]);

  useEffect(() => {
    if (!open) return;
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [open, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const start = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    try {
      await axios.post(`${API}/chat/start`, { session_id: sid.current, name: name.trim() });
    } catch { /* retry on send */ }
    setStarted(true);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/chat/start`, { session_id: sid.current, name: name.trim() || "访客" });
      await axios.post(`${API}/chat/${sid.current}/messages`, { text: text.trim() });
      setText("");
      load();
    } catch {
      /* keep text on failure */
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        data-testid="chat-widget-btn"
        onClick={() => setOpen(!open)}
        aria-label="在线客服"
        className="fixed bottom-24 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-gold-gradient p-3.5 text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95 lg:bottom-8 lg:right-8"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="glass-card fixed bottom-40 right-4 z-50 flex h-[440px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl lg:bottom-24 lg:right-8"
          >
            <div className="border-b border-amber-500/15 bg-[#0A1228]/90 px-5 py-4">
              <div className="font-display font-bold text-gold-gradient">在线客服</div>
              <div className="mt-0.5 text-xs text-slate-500">工作时间 9:00 - 21:00，留言后客服会尽快回复</div>
            </div>

            {!started ? (
              <form onSubmit={start} className="flex flex-1 flex-col items-center justify-center gap-4 p-6" data-testid="chat-start-form">
                <p className="text-center text-sm text-slate-400">请输入您的称呼，开始咨询</p>
                <input
                  data-testid="chat-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="您的称呼"
                  className="w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/60"
                />
                <button
                  type="submit"
                  data-testid="chat-start-btn"
                  className="w-full rounded-full bg-gold-gradient py-3 text-sm font-bold text-[#060B18] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  开始咨询
                </button>
              </form>
            ) : (
              <>
                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="chat-messages">
                  {messages.length === 0 && (
                    <p className="py-10 text-center text-xs text-slate-500">您好 {name}，请描述您想咨询的问题</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.sender === "visitor"
                            ? "rounded-br-sm bg-gold-gradient text-[#060B18]"
                            : "rounded-bl-sm border border-amber-500/20 bg-[#111D3C] text-slate-200"
                        }`}
                      >
                        {m.sender === "admin" && <div className="mb-0.5 text-[10px] font-bold text-[#D4AF37]">客服</div>}
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={send} className="flex gap-2 border-t border-amber-500/15 p-3">
                  <input
                    data-testid="chat-message-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="输入消息…"
                    className="flex-1 rounded-full border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/60"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    data-testid="chat-send-btn"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-[#060B18] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                    aria-label="发送"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
