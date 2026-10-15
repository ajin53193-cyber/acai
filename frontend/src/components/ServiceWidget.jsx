import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Headphones, X, MessageCircle, Clock, ChevronRight, ArrowUpToLine, ImagePlus, Send, Loader2 } from "lucide-react";
import axios from "axios";
import { publicApi, API } from "@/lib/api";
import { useScrollLock } from "@/lib/useScrollLock";
import { tr, API_LANG } from "@/i18n";

export const openService = (session) => window.dispatchEvent(new CustomEvent("open-service", { detail: session ? { session } : null }));

const guestId = () => { let g = localStorage.getItem("chat_guest_id"); if (!g) { g = `g${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; localStorage.setItem("chat_guest_id", g); } return g; };
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function Bubble({ m }) {
  const mine = m.sender === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-bubble-${m.id}`}>
      {!mine && <span className="h-7 w-7 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mr-2 shrink-0 self-end"><Headphones className="h-3.5 w-3.5" /></span>}
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-gradient-to-r from-[#F0872E] to-[#E8792A] text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md"}`}>
        {m.image && <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} alt="" className="rounded-lg max-h-48 mb-1 object-contain" /></a>}
        {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
        <div className={`text-[10px] mt-0.5 text-right ${mine ? "text-orange-100" : "text-slate-400"}`}>{hhmm(m.created_at)}</div>
      </div>
    </div>
  );
}

export default function ServiceWidget() {
  const { getToken, isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({ whatsapp_link: "https://wa.me/", cs_label: tr("WhatsApp 掃碼聯繫客服") });
  const [showTop, setShowTop] = useState(false);
  const [session, setSession] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [quick, setQuick] = useState([]);
  const [status, setStatus] = useState({ online: true });
  const lastRef = useRef("");
  const openRef = useRef(false); openRef.current = open;
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const [vv, setVv] = useState(null);
  useScrollLock(open && window.innerWidth < 768);

  // iOS keyboard: fixed panels don't shrink for the on-screen keyboard; track the visual viewport so the input stays visible.
  useEffect(() => {
    const vvp = window.visualViewport;
    if (!open || !vvp || window.innerWidth >= 768) { setVv(null); return; }
    const update = () => { setVv({ top: vvp.offsetTop, height: vvp.height }); bottomRef.current?.scrollIntoView({ block: "end" }); };
    update();
    vvp.addEventListener("resize", update);
    vvp.addEventListener("scroll", update);
    return () => { vvp.removeEventListener("resize", update); vvp.removeEventListener("scroll", update); setVv(null); };
  }, [open]);

  // Floating window: on mobile, keep it above the on-screen keyboard and the launcher button.
  const panelStyle = vv ? { bottom: Math.max(window.innerHeight - (vv.top + vv.height) + 12, 12), maxHeight: vv.height - 24 } : undefined;

  const call = useCallback(async (cfg) => {
    const token = isSignedIn ? await getToken().catch(() => null) : null;
    return axios({ ...cfg, url: `${API}${cfg.url}`, headers: { "X-Lang": API_LANG, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getToken, isSignedIn]);

  const ensureSession = useCallback(async () => {
    const r = await call({ method: "POST", url: "/chat/sessions", data: { guest_id: guestId() } });
    setSession(r.data);
    return r.data;
  }, [call]);

  const poll = useCallback(async (s, incremental) => {
    if (!s) return;
    const after = incremental && lastRef.current ? `&after=${encodeURIComponent(lastRef.current)}` : "";
    const r = await call({ method: "GET", url: `/chat/sessions/${s.id}/messages?guest_id=${guestId()}${after}` });
    const list = r.data.messages;
    if (!list.length) return;
    lastRef.current = list[list.length - 1].created_at;
    setMsgs((m) => (incremental ? [...m, ...list.filter((x) => !m.some((y) => y.id === x.id))] : list));
    const fresh = list.filter((x) => x.sender === "admin").length;
    if (incremental && fresh && !openRef.current) setUnread((u) => u + fresh);
  }, [call]);

  useEffect(() => {
    const on = (e) => { const s = e.detail?.session; if (s) { setSession(s); setMsgs([]); lastRef.current = ""; } setOpen(true); };
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("open-service", on);
    window.addEventListener("scroll", onScroll, { passive: true });
    publicApi.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    publicApi.get("/chat/quick-replies").then((r) => setQuick(r.data)).catch(() => {});
    publicApi.get("/chat/status").then((r) => setStatus(r.data)).catch(() => {});
    return () => { window.removeEventListener("open-service", on); window.removeEventListener("scroll", onScroll); };
  }, []);

  // Returning visitor with an existing conversation: keep listening for replies in the background.
  useEffect(() => {
    if (!localStorage.getItem("chat_guest_id")) return;
    let s = null; let id;
    ensureSession().then((x) => { s = x; return poll(s, false); }).then(() => { id = setInterval(() => { if (!openRef.current) poll(s, true).catch(() => {}); }, 20000); }).catch(() => {});
    return () => clearInterval(id);
  }, [ensureSession, poll]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    let id;
    (session ? Promise.resolve(session) : ensureSession()).then((s) => { poll(s, !!lastRef.current).catch(() => {}); id = setInterval(() => poll(s, true).catch(() => {}), 3000); }).catch(() => {});
    return () => clearInterval(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, open]);

  const send = async (quickIdx = -1) => {
    if (quickIdx < 0 && ((!text.trim() && !file) || busy)) return;
    if (busy) return;
    setBusy(true);
    try {
      const s = session || (await ensureSession());
      const data = quickIdx >= 0 ? { guest_id: guestId(), quick: quickIdx } : { guest_id: guestId(), text, ...(file ? await readFile(file) : {}) };
      const r = await call({ method: "POST", url: `/chat/sessions/${s.id}/messages`, data });
      const { reply, ...mine } = r.data;
      setMsgs((m) => [...m, mine, ...(reply ? [reply] : [])]); lastRef.current = (reply || mine).created_at;
      if (quickIdx < 0) { setText(""); setFile(null); inputRef.current?.focus(); }
    } catch {}
    setBusy(false);
  };

  const closeWidget = useCallback(() => {
    if (session?.id) call({ method: "POST", url: `/chat/sessions/${session.id}/close`, data: { guest_id: guestId() } }).catch(() => {});
    setOpen(false);
  }, [session, call]);

  const endSession = async () => {
    if (busy) return;
    if (session?.id) await call({ method: "POST", url: `/chat/sessions/${session.id}/end`, data: { guest_id: guestId() } }).catch(() => {});
    setSession(null); setMsgs([]); lastRef.current = ""; setUnread(0);
  };

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-40 md:hidden bg-black/30" onClick={closeWidget} />
          <div data-testid="service-widget-panel" style={panelStyle} className="fixed z-50 bg-white flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-orange-100 left-3 right-3 bottom-[5.5rem] h-[72vh] max-h-[34rem] md:left-auto md:right-6 md:bottom-24 md:w-[380px] md:h-[560px] md:max-h-[calc(100vh-7rem)]">
            <div className="bg-gradient-to-r from-[#F0872E] to-[#E8792A] text-white px-4 py-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-head font-bold flex items-center gap-2"><Headphones className="h-4 w-4" />{tr("線上客服")}</span>
                <div className="flex items-center gap-1.5">
                  <a data-testid="service-widget-whatsapp" href={settings.whatsapp_link} target="_blank" rel="noreferrer" title={settings.cs_label} className="h-7 px-2.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold flex items-center gap-1 hover:brightness-95"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                  {session?.id && msgs.length > 0 && <button data-testid="service-widget-end" onClick={endSession} title={tr("結束並清除此對話")} className="h-7 px-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold flex items-center">{tr("結束")}</button>}
                  <button data-testid="service-widget-close" onClick={closeWidget} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="text-xs text-white/85 mt-1 flex items-center gap-1" data-testid="service-chat-status">
                {status.online ? <><span className="h-2 w-2 rounded-full bg-emerald-300 inline-block" />{tr("客服在線 · 7×24 小時人工客服，充值問題即時處理")}</> : <><Clock className="h-3 w-3" />{tr("非工作時段（客服時間 {0}–{1}），留言後上線即回覆", status.start, status.end)}</>}
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5" data-testid="service-chat-messages">
              <div className="flex justify-start">
                <span className="h-7 w-7 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mr-2 shrink-0 self-end"><Headphones className="h-3.5 w-3.5" /></span>
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 px-3 py-2 text-sm">
                  <div>{tr("您好！請直接在此留言，客服會盡快回覆您。也可以點選下方常見問題：")}</div>
                  <div className="mt-2 space-y-1">
                    {quick.map((it, i) => <button key={i} data-testid={`service-chat-quick-${i}`} onClick={() => send(i)} disabled={busy} className="w-full flex items-center justify-between text-left text-xs bg-white text-slate-700 rounded-lg px-2.5 py-1.5 hover:bg-orange-50 hover:text-orange-600 transition-colors disabled:opacity-60">{it.q}<ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" /></button>)}
                  </div>
                </div>
              </div>
              {msgs.map((m) => <Bubble key={m.id} m={m} />)}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-slate-100 p-2.5 shrink-0 bg-white">
              {file && <div className="flex items-center gap-2 mb-2 text-xs text-slate-600"><img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="truncate flex-1">{file.name}</span><button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500 px-1">✕</button></div>}
              <div className="flex items-end gap-2">
                <label className="h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500 shrink-0" title={tr("發送圖片")}><ImagePlus className="h-5 w-5" /><input data-testid="service-chat-image" type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
                <textarea ref={inputRef} data-testid="service-chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={tr("輸入訊息…")} className="flex-1 min-h-[40px] max-h-28 rounded-2xl bg-slate-100 px-3.5 py-2.5 text-base md:text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
                <button data-testid="service-chat-send" onClick={() => send()} disabled={busy || (!text.trim() && !file)} className="h-10 w-10 rounded-full bg-gradient-to-r from-[#F0872E] to-[#E8792A] text-white flex items-center justify-center disabled:opacity-50 shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {showTop && (
        <button data-testid="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[9.5rem] right-4 md:bottom-24 md:right-6 z-40 h-14 w-14 safe-bottom-offset rounded-full bg-white/90 shadow-xl flex items-center justify-center text-orange-500 hover:bg-white">
          <ArrowUpToLine className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}
      <button
        data-testid="service-widget-trigger"
        onClick={() => (open ? closeWidget() : setOpen(true))}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-14 w-14 safe-bottom-offset rounded-full bg-white/90 md:bg-gradient-to-br md:from-[#F0872E] md:to-[#E8792A] text-orange-500 md:text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
        {!open && unread > 0 && <span data-testid="service-widget-unread" className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">{unread}</span>}
      </button>
    </>
  );
}
