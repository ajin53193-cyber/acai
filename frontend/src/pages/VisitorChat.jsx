import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Send, ImagePlus } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { getVisitorId } from "@/lib/source";
import { csSessionId } from "@/lib/csWidget";

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
  const sid = useRef(csSessionId());
  const lastTs = useRef("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { document.title = "在线客服 | 合赢项目社"; }, []);
  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
          return [...cleaned, ...incoming];
        });
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
    <div className="flex h-screen flex-col bg-slate-50" data-testid="visitor-chat">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-5 py-4 text-[#1B1403]">
        {agent?.avatar ? (
          <img src={toFullUrl(agent.avatar)} alt={agent.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-white/60" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-sm font-bold">客服</div>
        )}
        <div>
          <div className="text-base font-bold" data-testid="visitor-chat-agent">{agent?.name || "在线客服"}</div>
          <div className="flex items-center gap-1 text-xs opacity-80"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-700" /> 在线为您服务</div>
        </div>
      </div>

      {!enabled ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">客服暂时不在线，请稍后再试。</div>
      ) : (
        <>
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-5" data-testid="visitor-chat-messages">
            {messages.map((m) => {
              const isVisitor = m.sender === "visitor";
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isVisitor ? "justify-end" : "justify-start"}`}>
                  {!isVisitor && (agent?.avatar
                    ? <img src={toFullUrl(agent.avatar)} alt={agent?.name || "客服"} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                    : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/25 text-[11px] font-bold text-[#8a6d1a]">客服</div>)}
                  <div className={`max-w-[75%] overflow-hidden whitespace-pre-wrap break-words rounded-2xl text-sm leading-relaxed ${m.image ? "p-1" : "px-4 py-2.5"} ${isVisitor ? "rounded-br-sm bg-[#D4AF37] text-[#1B1403]" : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"}`}>
                    {m.image ? <a href={toFullUrl(m.image)} target="_blank" rel="noreferrer"><img src={toFullUrl(m.image)} alt="图片" className="max-h-72 rounded-xl" /></a> : m.text}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-slate-200 bg-white p-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} data-testid="visitor-chat-file" />
            <button onClick={() => fileRef.current?.click()} disabled={sending} aria-label="发送图片" data-testid="visitor-chat-image-btn" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#D4AF37] disabled:opacity-50"><ImagePlus size={20} /></button>
            <input data-testid="visitor-chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="输入消息…" className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#D4AF37]" />
            <button onClick={send} disabled={sending} data-testid="visitor-chat-send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white active:scale-90 disabled:opacity-50"><Send size={18} /></button>
          </div>
        </>
      )}
    </div>
  );
}
