import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Send, X } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { getSource, getVisitorId } from "@/lib/source";
import { registerCSWidget, setCSEnabled, csSessionId } from "@/lib/csWidget";

const slugFromPath = () => {
  const m = window.location.pathname.match(/\/(?:p|t)\/([^/]+)/);
  return m ? m[1] : "";
};

export const CSWidget = () => {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sid = useRef(csSessionId());
  const lastTs = useRef("");
  const pollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/cs/config`).then((r) => setCSEnabled(r.data.enabled)).catch(() => {});
    registerCSWidget(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          const incomingTexts = new Set(incoming.map((m) => `${m.sender}|${m.text}`));
          // 丢弃已被真实消息覆盖的乐观占位（tmp-）
          const cleaned = prev.filter((m) => !(String(m.id).startsWith("tmp-") && incomingTexts.has(`${m.sender}|${m.text}`)));
          return [...cleaned, ...incoming];
        });
      }
    } catch { /* ignore */ }
  }, []);

  const start = useCallback(async () => {
    try {
      const r = await axios.post(`${API}/cs/start`, {
        session_id: sid.current,
        slug: slugFromPath(),
        source: getSource(),
        referrer: document.referrer || "",
        visitor_id: getVisitorId(),
      });
      if (r.data.enabled === false) { setCSEnabled(false); return; }
      setAgent(r.data.agent);
      setStarted(true);
      await poll();
      pollRef.current = setInterval(poll, 2000);
    } catch { /* ignore */ }
  }, [poll]);

  useEffect(() => {
    if (open && !started) start();
    if (!open && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [open, started, start]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, sender: "visitor", text, created_at: new Date().toISOString() };
    setMessages((p) => [...p, optimistic]);
    setInput("");
    try {
      await axios.post(`${API}/cs/${sid.current}/message`, { text });
      await poll();
    } catch { /* ignore */ } finally { setSending(false); }
  };

  if (!open) return null;

  return (
    <div
      data-testid="cs-widget"
      className="fixed bottom-24 right-4 z-[60] flex h-[480px] max-h-[75vh] w-[92vw] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:bottom-28 lg:right-8"
    >
      <div className="flex items-center justify-between bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-4 py-3 text-[#1B1403]">
        <div className="flex items-center gap-2.5">
          {agent?.avatar ? (
            <img src={toFullUrl(agent.avatar)} alt={agent.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-sm font-bold">客服</div>
          )}
          <div>
            <div className="text-sm font-bold" data-testid="cs-widget-agent-name">{agent?.name || "在线客服"}</div>
            <div className="flex items-center gap-1 text-[11px] opacity-80"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" /> 在线</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="关闭" data-testid="cs-widget-close" className="rounded-full p-1 transition-colors hover:bg-black/10"><X size={18} /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4" data-testid="cs-widget-messages">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.sender === "visitor" ? "rounded-br-sm bg-[#D4AF37] text-[#1B1403]" : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 bg-white p-2.5">
        <input
          data-testid="cs-widget-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="输入消息…"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
        />
        <button onClick={send} disabled={sending} data-testid="cs-widget-send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white transition-transform active:scale-90 disabled:opacity-50">
          <Send size={17} />
        </button>
      </div>
    </div>
  );
};
