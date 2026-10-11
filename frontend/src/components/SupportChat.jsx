import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

export function SupportChat({ orderNo, t, open, setOpen }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try { const r = await api.get(`/support/public/${orderNo}`); setData(r.data); } catch (e) { /* ignore */ }
  }, [orderNo]);

  useEffect(() => {
    if (!open) return;
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, [open, load]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data, open]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try { await api.post(`/support/public/${orderNo}`, { text: msg }); setText(""); await load(); }
    catch (e) { /* ignore */ }
    finally { setSending(false); }
  };

  const enabled = data ? data.enabled : true;

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="support-fab" aria-label={t.contactSupport}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: "var(--accent)" }}>
        <MessageCircle className="w-7 h-7" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)} data-testid="support-panel">
          <div className="bg-white w-full max-w-md h-[72vh] sm:h-[560px] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: "var(--accent)" }}>
              <div className="flex items-center gap-2 font-semibold text-[16px]"><MessageCircle className="w-5 h-5" />{t.supportTitle}</div>
              <button onClick={() => setOpen(false)} data-testid="support-close" className="p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50" data-testid="support-messages">
              <div className="text-[13px] text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-100">{data?.welcome || t.supportEmpty}</div>
              {(data?.messages || []).map((m) => (
                <div key={m.id} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`} data-testid={`support-msg-${m.sender}`}>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-[14px] whitespace-pre-wrap break-words ${m.sender === "customer" ? "text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-100 rounded-bl-sm"}`}
                    style={m.sender === "customer" ? { background: "var(--accent)" } : {}}>
                    {m.sender === "agent" && <div className="text-[11px] opacity-70 mb-0.5">{m.sender_name || t.supportTitle}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {enabled ? (
              <div className="flex items-center gap-2 p-3 border-t border-slate-100">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t.supportInput} data-testid="support-input"
                  className="flex-1 h-11 px-3 rounded-xl bg-slate-100 text-[15px] outline-none text-slate-800" />
                <button onClick={send} disabled={sending || !text.trim()} data-testid="support-send"
                  className="h-11 w-11 rounded-xl text-white flex items-center justify-center disabled:opacity-40 shrink-0" style={{ background: "var(--accent)" }}>
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm border-t border-slate-100" data-testid="support-disabled">{t.supportDisabled}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
