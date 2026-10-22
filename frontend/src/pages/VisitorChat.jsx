import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Volume2, VolumeX, Lock, MessageCircle, X, Info } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { getVisitorId } from "@/lib/source";
import { csSessionId } from "@/lib/csWidget";

const timeShort = (iso) => { try { return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const SOUND_KEY = "hy_cs_sound_on";

// 轻量提示音（Web Audio，无需外部音频文件）
let _ac = null;
const playPing = () => {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = "sine"; o.frequency.setValueAtTime(880, _ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, _ac.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, _ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + 0.3);
    o.start(); o.stop(_ac.currentTime + 0.32);
  } catch { /* ignore */ }
};

// 独立客服聊天窗口页（通过 window.open 打开），参数来自 URL：slug / src（来源渠道）/ ref（来源网站）
export default function VisitorChat() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "";
  const source = params.get("src") || "";
  const referrer = params.get("ref") || document.referrer || "";

  const [agent, setAgent] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) !== "0");
  const sid = useRef(csSessionId());
  const lastTs = useRef("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const soundRef = useRef(soundOn);
  const firstLoad = useRef(true);

  useEffect(() => {
    document.title = "在线客服 | 合赢项目社";
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "#ffffff");
    // iOS Safari 的状态栏与底部工具栏取色自 html/body 背景，主站是深色，这里强制切白
    const html = document.documentElement, body = document.body;
    const prevHtmlBg = html.style.backgroundColor, prevBodyBg = body.style.backgroundColor, prevScheme = html.style.colorScheme;
    html.style.backgroundColor = "#ffffff"; body.style.backgroundColor = "#ffffff"; html.style.colorScheme = "light";
    return () => {
      if (meta && prev) meta.setAttribute("content", prev);
      html.style.backgroundColor = prevHtmlBg; body.style.backgroundColor = prevBodyBg; html.style.colorScheme = prevScheme;
    };
  }, []);
  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { soundRef.current = soundOn; localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); }, [soundOn]);

  const poll = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/cs/${sid.current}/messages`, { params: lastTs.current ? { after: lastTs.current } : {} });
      if (r.data.agent) setAgent(r.data.agent);
      const list = r.data.messages || [];
      if (list.length) {
        lastTs.current = list[list.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const incoming = list.filter((m) => !seen.has(m.id));
          const texts = new Set(incoming.map((m) => `${m.sender}|${m.text}`));
          const cleaned = prev.filter((m) => !(String(m.id).startsWith("tmp-") && texts.has(`${m.sender}|${m.text}`)));
          if (!firstLoad.current && soundRef.current && incoming.some((m) => m.sender === "agent")) playPing();
          return [...cleaned, ...incoming];
        });
        firstLoad.current = false;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let timer;
    (async () => {
      try {
        const r = await axios.post(`${API}/cs/start`, { session_id: sid.current, slug, source, referrer, visitor_id: getVisitorId() });
        if (r.data.enabled === false) { setEnabled(false); return; }
        setAgent(r.data.agent);
        await poll();
        timer = setInterval(poll, 2000);
      } catch { /* ignore */ }
    })();
    return () => { if (timer) clearInterval(timer); };
    // eslint-disable-next-line
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setMessages((p) => [...p, { id: `tmp-${Date.now()}`, sender: "visitor", text, created_at: new Date().toISOString() }]);
    setInput("");
    try { await axios.post(`${API}/cs/${sid.current}/message`, { text }); await poll(); }
    catch { /* ignore */ } finally { setSending(false); }
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSending(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await axios.post(`${API}/cs/${sid.current}/upload`, fd);
      await axios.post(`${API}/cs/${sid.current}/message`, { text: "", image: up.data.url });
      await poll();
    } catch { /* ignore */ } finally { setSending(false); }
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-t-xl border-[5px] border-[#3aa6f2] bg-white" data-testid="visitor-chat">
      {/* 顶部蓝色条（参照模版） */}
      <header className="flex items-center justify-between bg-[#3aa6f2] px-3 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
          <span className="text-[15px] font-bold tracking-wide" data-testid="visitor-chat-agent">在线聊天</span>
        </div>
        <button onClick={() => { try { window.close(); } catch { /* ignore */ } }} aria-label="关闭" data-testid="visitor-chat-close" className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"><X size={22} strokeWidth={2.5} /></button>
      </header>

      {!enabled ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">客服暂时不在线，请稍后再试。</div>
      ) : (
        <>
          <div className="cs-scroll-light mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-5" data-testid="visitor-chat-messages">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isVisitor = m.sender === "visitor";
                const isWelcome = String(m.id).startsWith("welcome-");
                if (isWelcome) {
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full"
                      data-testid="visitor-chat-welcome"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <Info size={14} className="text-[#4a9fe8]" />
                        <span>{timeShort(m.created_at)}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700">{m.text}</div>
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className={`flex items-end gap-2 ${isVisitor ? "justify-end" : "justify-start"}`}
                  >
                    {!isVisitor && (agent?.avatar
                      ? <img src={toFullUrl(agent.avatar)} alt={agent?.name || "客服"} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-blue-200" />
                      : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">客服</div>)}
                    <div className="flex max-w-[76%] flex-col">
                      <div className={`overflow-hidden whitespace-pre-wrap break-words text-sm leading-relaxed shadow-sm ${m.image ? "rounded-2xl p-1" : "px-4 py-2.5"} ${isVisitor
                        ? "rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-blue-600 text-white"
                        : "rounded-2xl rounded-bl-md border border-blue-100 bg-white text-slate-700"}`}>
                        {m.image
                          ? <a href={toFullUrl(m.image)} target="_blank" rel="noreferrer"><img src={toFullUrl(m.image)} alt="图片" className="max-h-72 rounded-xl" /></a>
                          : m.text}
                      </div>
                      <span className={`mt-1 px-1 text-[10px] text-slate-400 ${isVisitor ? "text-right" : "text-left"}`}>{timeShort(m.created_at)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {/* 输入区（参照样式：两行布局） */}
          <div className="bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} data-testid="visitor-chat-file" />
                <input data-testid="visitor-chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="在这里输入消息" className="w-0 min-w-0 flex-1 rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400" />
                <motion.button whileTap={{ scale: 0.85 }} onClick={send} disabled={sending || !input.trim()} data-testid="visitor-chat-send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#3aa6f2] transition-colors hover:bg-blue-50"><Send size={26} /></motion.button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => fileRef.current?.click()} disabled={sending} aria-label="发送图片" data-testid="visitor-chat-image-btn" className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"><Paperclip size={18} /></button>
                  <button onClick={() => setSoundOn((v) => !v)} aria-label={soundOn ? "关闭提示音" : "开启提示音"} title={soundOn ? "新消息提示音：开" : "新消息提示音：关"} data-testid="visitor-chat-sound-btn" className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-blue-50 ${soundOn ? "text-blue-500" : "text-slate-300"}`}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-blue-400"><Lock size={13} /> 安全加密</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
