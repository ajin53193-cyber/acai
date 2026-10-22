import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Volume2, VolumeX, Lock } from "lucide-react";
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

  useEffect(() => { document.title = "在线客服 | 合赢项目社"; }, []);
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
    <div className="flex h-[100dvh] flex-col bg-[#eef4fc]" data-testid="visitor-chat">
      {/* 玻璃拟态头部 */}
      <header className="flex items-center gap-3 border-b border-blue-200/50 bg-white/90 px-5 py-3.5 backdrop-blur-md shadow-[0_6px_22px_-16px_rgba(59,130,246,0.5)]">
        <div className="relative">
          {agent?.avatar ? (
            <img src={toFullUrl(agent.avatar)} alt={agent.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-blue-300/70 shadow" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-sm font-bold text-white shadow">客服</div>
          )}
          <span className="cs-online-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-slate-800" data-testid="visitor-chat-agent">{agent?.name || "在线客服"}</div>
          <div className="flex items-center gap-1 text-xs text-green-600"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" /> 在线为您服务</div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-600 ring-1 ring-blue-100 sm:flex">
          <Lock size={12} /> 安全加密
        </div>
      </header>

      {!enabled ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">客服暂时不在线，请稍后再试。</div>
      ) : (
        <>
          <div className="cs-scroll-light mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-6" data-testid="visitor-chat-messages">
            {messages.length === 0 && (
              <div className="mt-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg">
                  <Lock size={24} />
                </div>
                <p className="text-sm font-medium text-slate-600">您好，欢迎咨询合赢项目社</p>
                <p className="mt-1 text-xs text-slate-400">请描述您的需求，我们将第一时间为您服务</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isVisitor = m.sender === "visitor";
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
          <div className="border-t border-blue-200/50 bg-white/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} data-testid="visitor-chat-file" />
                <input data-testid="visitor-chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="在这里输入消息" className="flex-1 rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400" />
                <motion.button whileTap={{ scale: 0.85 }} onClick={send} disabled={sending || !input.trim()} data-testid="visitor-chat-send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-50 disabled:opacity-40"><Send size={22} /></motion.button>
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
