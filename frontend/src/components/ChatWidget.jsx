import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { MessageCircle, X, Send, Download } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { getSource } from "@/lib/source";
import { useSettings } from "@/lib/useSettings";

const SID_KEY = "hy_chat_sid";
const NAME_KEY = "hy_chat_name";

const IS_WECHAT = /MicroMessenger/i.test(navigator.userAgent);

const saveImage = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  // 统一转成 PNG，保证微信「相册识别二维码」兼容
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const href = URL.createObjectURL(png || blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "合赢项目社-微信群二维码.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
};

const SaveQrButton = ({ url }) => {
  const [state, setState] = useState("idle");
  if (IS_WECHAT) {
    return <p className="mt-1.5 text-center text-[11px] text-[#E5C158]" data-testid="chat-qr-wechat-hint">长按上方二维码 → 识别图中二维码 即可进群</p>;
  }
  const onClick = async () => {
    setState("saving");
    try {
      await saveImage(url);
      setState("done");
    } catch {
      setState("idle");
      window.open(url, "_blank", "noopener");
    }
  };
  return (
    <button
      type="button"
      data-testid="chat-qr-save-btn"
      onClick={onClick}
      disabled={state === "saving"}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-[#E5C158] transition-colors duration-200 hover:bg-amber-500/20 active:scale-95 disabled:opacity-60"
    >
      <Download size={13} />
      {state === "done" ? "已保存，打开微信扫一扫 → 相册 识别进群" : state === "saving" ? "保存中…" : "保存二维码到相册"}
    </button>
  );
};

const getSessionId = () => {
  let sid = localStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SID_KEY, sid);
  }
  return sid;
};

export const ChatWidget = () => {
  const { chat } = useSettings();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [started, setStarted] = useState(() => !!localStorage.getItem(NAME_KEY));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const listRef = useRef(null);
  const sid = useRef(getSessionId());

  const load = useCallback(async () => {
    if (!started) return;
    try {
      const res = await axios.get(`${API}/chat/${sid.current}/messages`);
      const msgs = res.data.messages || [];
      setMessages(msgs);
      if (msgs.length && msgs[msgs.length - 1].sender === "admin") setAwaitingReply(false);
    } catch { /* session not created yet */ }
  }, [started]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("hy:open-chat", openHandler);
    return () => window.removeEventListener("hy:open-chat", openHandler);
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const timer = setInterval(load, awaitingReply ? 1500 : 3000);
    return () => clearInterval(timer);
  }, [open, load, awaitingReply]);

  useEffect(() => {
    if (!awaitingReply) return;
    const t = setTimeout(() => setAwaitingReply(false), 45000);
    return () => clearTimeout(t);
  }, [awaitingReply]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, awaitingReply]);

  const start = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    try {
      await axios.post(`${API}/chat/start`, { session_id: sid.current, name: name.trim(), source: getSource() });
    } catch { /* retry on send */ }
    setStarted(true);
  };

  const sendText = async (value) => {
    if (!value.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/chat/start`, { session_id: sid.current, name: name.trim() || "访客", source: getSource() });
      await axios.post(`${API}/chat/${sid.current}/messages`, { text: value.trim() });
      setText("");
      const isCard = (chat.questions || []).some((q) => (typeof q === "string" ? q : q.text) === value.trim());
      if (chat.ai_enabled && !isCard) setAwaitingReply(true);
      load();
    } catch {
      /* keep text on failure */
    } finally {
      setSending(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    sendText(text);
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
                        {m.sender === "admin" && (
                          <div className="mb-0.5 text-[10px] font-bold text-[#D4AF37]">{m.via === "ai" ? "AI客服" : m.via === "admin" ? "人工客服" : "客服"}</div>
                        )}
                        <span className="whitespace-pre-line">{m.text}</span>
                        {m.image && (
                          <>
                            <img src={toFullUrl(m.image)} alt="客服图片" loading="lazy" decoding="async" className="mt-2 w-full min-w-44 rounded-xl border border-amber-500/20" data-testid="chat-qr-image" />
                            {m.image === chat.qr_image && <SaveQrButton url={toFullUrl(m.image)} />}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {!messages.some((m) => m.sender === "visitor") && chat.questions?.length > 0 && (
                    <div className="flex flex-wrap gap-2" data-testid="chat-question-cards">
                      {chat.questions.map((q, i) => {
                        const qText = typeof q === "string" ? q : q.text;
                        return (
                          <button
                            key={i}
                            type="button"
                            data-testid={`chat-question-card-${i}`}
                            onClick={() => sendText(qText)}
                            disabled={sending}
                            className="rounded-full border border-amber-500/30 bg-[#0A1228]/80 px-3.5 py-1.5 text-xs text-[#E5C158] transition-colors duration-200 hover:border-[#D4AF37]/70 hover:bg-amber-500/10 active:scale-95 disabled:opacity-50"
                          >
                            {qText}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {awaitingReply && (
                    <div className="flex justify-start" data-testid="chat-typing-indicator">
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-amber-500/20 bg-[#111D3C] px-4 py-2.5 text-sm leading-relaxed text-slate-200">
                        <div className="mb-0.5 text-[10px] font-bold text-[#D4AF37]">AI客服</div>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          正在输入
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#D4AF37]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#D4AF37] [animation-delay:150ms]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#D4AF37] [animation-delay:300ms]" />
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={send} className="flex items-center gap-2 border-t border-amber-500/15 p-3">
                  <input
                    data-testid="chat-message-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="输入消息…"
                    className="min-w-0 flex-1 rounded-full border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/60"
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
