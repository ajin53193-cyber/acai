import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";
import { MessageCircle, X, Send, Loader2, ImagePlus } from "lucide-react";

const compress = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1280; let w = img.width, h = img.height;
      if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = rej; img.src = r.result;
  };
  r.onerror = rej; r.readAsDataURL(file);
});

export function SupportChat({ orderNo, t, open, setOpen }) {
  const [data, setData] = useState(null);
  const [fabUnread, setFabUnread] = useState(0);
  const [text, setText] = useState("");
  const [pendingImg, setPendingImg] = useState(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const typingRef = useRef(0);
  const imgUrl = (p) => (p && !p.startsWith("http") && !p.startsWith("data:")) ? (process.env.REACT_APP_BACKEND_URL || "") + p : p;
  const onType = (e) => {
    setText(e.target.value);
    const n = Date.now();
    if (n - typingRef.current > 2500) { typingRef.current = n; api.post(`/support/public/${orderNo}/typing`).catch(() => {}); }
  };

  const load = useCallback(async () => {
    try { const r = await api.get(`/support/public/${orderNo}`); setData(r.data); } catch (e) { /* ignore */ }
  }, [orderNo]);

  useEffect(() => { if (!open) return; load(); const i = setInterval(load, 3000); return () => clearInterval(i); }, [open, load]);
  useEffect(() => {
    if (open) { setFabUnread(0); return; }
    const f = () => api.get(`/support/public/${orderNo}/unread`).then((r) => setFabUnread(r.data.unread || 0)).catch(() => {});
    f(); const i = setInterval(f, 8000); return () => clearInterval(i);
  }, [open, orderNo]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data, open]);

  const onPick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setPendingImg(await compress(f)); } catch (_) { /* ignore */ }
    e.target.value = "";
  };

  const send = async () => {
    const msg = text.trim();
    if ((!msg && !pendingImg) || sending) return;
    setSending(true);
    try { await api.post(`/support/public/${orderNo}`, { text: msg, image: pendingImg }); setText(""); setPendingImg(null); await load(); }
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
        {fabUnread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white" data-testid="support-fab-unread">{fabUnread}</span>}
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
                    {m.image && <a href={imgUrl(m.image)} target="_blank" rel="noreferrer"><img src={imgUrl(m.image)} alt="attach" className="max-w-[200px] rounded-lg mb-1 block" /></a>}
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {enabled ? (
              <div className="border-t border-slate-100">
                {pendingImg && (
                  <div className="px-3 pt-2 flex items-center gap-2" data-testid="support-pending-img">
                    <img src={pendingImg} alt="preview" className="w-12 h-12 rounded object-cover" />
                    <button onClick={() => setPendingImg(null)} className="text-slate-400 text-xs">移除</button>
                  </div>
                )}
                <div className="flex items-center gap-2 p-3">
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" data-testid="support-file-input" />
                  <button onClick={() => fileRef.current?.click()} data-testid="support-attach" className="h-11 w-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><ImagePlus className="w-5 h-5" /></button>
                  <input value={text} onChange={onType} onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={t.supportInput} data-testid="support-input"
                    className="flex-1 h-11 px-3 rounded-xl bg-slate-100 text-[15px] outline-none text-slate-800" />
                  <button onClick={send} disabled={sending || (!text.trim() && !pendingImg)} data-testid="support-send"
                    className="h-11 w-11 rounded-xl text-white flex items-center justify-center disabled:opacity-40 shrink-0" style={{ background: "var(--accent)" }}>
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
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
