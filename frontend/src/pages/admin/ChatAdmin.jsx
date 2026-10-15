import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Headphones, ImagePlus, Send, CheckCircle2, RotateCcw, Search, User, Smartphone, Loader2, MessageSquareText } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Pill, fmt, Modal, Btn, Input } from "./ui";

const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const who = (s) => s.name || s.contact || `${tr("訪客")} ${(s.guest_id || "").slice(0, 6)}`;
const timeAgo = (iso) => { const d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return tr("剛剛"); if (d < 3600) return tr("{0} 分鐘前", Math.floor(d / 60)); if (d < 86400) return tr("{0} 小時前", Math.floor(d / 3600)); return fmt(iso); };

function SessionItem({ s, active, onClick }) {
  return (
    <button data-testid={`chat-session-${s.id}`} onClick={onClick} className={`w-full text-left px-3.5 py-3 border-b border-slate-100 transition-colors ${active ? "bg-orange-50" : "hover:bg-slate-50"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${s.user_id ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-500"}`}>{s.user_id ? <User className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800 truncate">{who(s)}</span><span className="text-[10px] text-slate-400 shrink-0">{timeAgo(s.last_at)}</span></div>
          <div className="flex items-center justify-between gap-2 mt-0.5"><span className={`text-xs truncate ${s.unread_admin ? "text-slate-800 font-medium" : "text-slate-500"}`}>{s.last_sender === "admin" ? tr("[我] ") : ""}{s.last_message || tr("（新會話）")}</span>
            {s.unread_admin > 0 && <span data-testid={`chat-unread-${s.id}`} className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{s.unread_admin}</span>}</div>
        </div>
      </div>
    </button>
  );
}

function Bubble({ m }) {
  const mine = m.sender === "admin";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-bubble-${m.id}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "bg-orange-500 text-white rounded-br-md" : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"}`}>
        {m.image && <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} alt="" className="rounded-lg max-h-56 mb-1.5 object-contain" /></a>}
        {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
        <div className={`text-[10px] mt-1 ${mine ? "text-orange-100" : "text-slate-400"}`}>{mine && m.admin_name ? `${m.admin_name} · ` : ""}{fmt(m.created_at).slice(5)}</div>
      </div>
    </div>
  );
}

function QuickRepliesModal({ callApi, onClose, onSaved }) {
  const [items, setItems] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: "/admin/chat/quick-replies" }).then((r) => setItems(r.data)).catch(() => setItems([])); }, [callApi]);
  const upd = (i, k, v) => setItems((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    try { const r = await callApi({ method: "PUT", url: "/admin/chat/quick-replies", data: { items } }); toast.success(tr("已儲存")); onSaved(r.data); onClose(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };
  return (
    <Modal title={tr("快捷回覆設定")} onClose={onClose} testId="chat-quick-modal" footer={<><Btn kind="ghost" onClick={onClose}>{tr("取消")}</Btn><Btn data-testid="chat-quick-save" onClick={save} disabled={!items}>{tr("儲存")}</Btn></>}>
      <div className="text-xs text-slate-500">{tr("前台客服視窗會顯示這些問題；用戶點選後系統自動回覆對應答案，不會打擾客服。答案也可作為客服回覆時的快捷模板。")}</div>
      {!items && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline text-orange-500" /></div>}
      {items?.map((it, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid={`chat-quick-item-${i}`}>
          <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-orange-500">Q{i + 1}</span><Input data-testid={`chat-quick-q-${i}`} value={it.q} onChange={(e) => upd(i, "q", e.target.value)} placeholder={tr("問題（顯示給用戶點選）")} className="flex-1" /><button data-testid={`chat-quick-remove-${i}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">✕</button></div>
          <textarea data-testid={`chat-quick-a-${i}`} value={it.a} onChange={(e) => upd(i, "a", e.target.value)} rows={3} placeholder={tr("自動回覆內容")} className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
        </div>
      ))}
      {items && items.length < 12 && <Btn kind="ghost" data-testid="chat-quick-add" onClick={() => setItems((l) => [...l, { q: "", a: "" }])}>+ {tr("新增一條")}</Btn>}
    </Modal>
  );
}

function Thread({ callApi, session, onChanged, quick }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const lastRef = useRef("");
  const changedRef = useRef(onChanged); changedRef.current = onChanged;
  const sid = session.id;

  const load = useCallback(async (incremental) => {
    const r = await callApi({ method: "GET", url: `/admin/chat/sessions/${sid}/messages${incremental && lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : ""}` });
    const list = r.data.messages;
    if (!list.length) return;
    lastRef.current = list[list.length - 1].created_at;
    setMsgs((m) => (incremental ? [...m, ...list.filter((x) => !m.some((y) => y.id === x.id))] : list));
    if (incremental && list.some((x) => x.sender === "user")) changedRef.current();
  }, [callApi, sid]);

  useEffect(() => { setMsgs([]); lastRef.current = ""; load(false).then(() => changedRef.current()).catch(() => {}); const id = setInterval(() => load(true).catch(() => {}), 3000); return () => clearInterval(id); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      const data = { text, ...(file ? await readFile(file) : {}) };
      const r = await callApi({ method: "POST", url: `/admin/chat/sessions/${sid}/messages`, data });
      setMsgs((m) => [...m, r.data]); lastRef.current = r.data.created_at; setText(""); setFile(null); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || tr("發送失敗")); }
    setBusy(false);
  };
  const setStatus = async (status) => { await callApi({ method: "PATCH", url: `/admin/chat/sessions/${sid}`, data: { status } }); toast.success(status === "handled" ? tr("已標記為已處理") : tr("已重新開啟")); onChanged(); };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 truncate" data-testid="chat-thread-title">{who(session)}</div>
          <div className="text-[11px] text-slate-500 truncate">{session.contact && <span className="mr-2">{session.contact}</span>}{session.user_id ? <Pill tone="sky">{tr("會員")}</Pill> : <Pill>{tr("訪客")}</Pill>}<span className="ml-2">{tr("開始於")} {fmt(session.created_at)}</span></div>
        </div>
        {session.status === "open"
          ? <button data-testid="chat-mark-handled" onClick={() => setStatus("handled")} className="h-9 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{tr("標記已處理")}</button>
          : <button data-testid="chat-reopen" onClick={() => setStatus("open")} className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><RotateCcw className="h-4 w-4" />{tr("重新開啟")}</button>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-4 space-y-3" data-testid="chat-thread-messages">
        {msgs.length === 0 && <div className="text-center text-xs text-slate-400 py-10">{tr("尚無訊息")}</div>}
        {msgs.map((m) => <Bubble key={m.id} m={m} />)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3">
        {quick.length > 0 && <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1" data-testid="chat-admin-quick-chips">{quick.map((it, i) => <button key={i} data-testid={`chat-admin-quick-${i}`} onClick={() => setText(it.a)} title={it.a} className="shrink-0 h-7 px-2.5 rounded-full bg-orange-50 text-orange-600 text-[11px] font-semibold hover:bg-orange-100 whitespace-nowrap">{it.q}</button>)}</div>}
        {file && <div className="flex items-center gap-2 mb-2 text-xs text-slate-600"><img src={URL.createObjectURL(file)} alt="" className="h-12 w-12 rounded-lg object-cover" /><span className="truncate flex-1">{file.name}</span><button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">✕</button></div>}
        <div className="flex items-end gap-2">
          <label className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500 shrink-0" title={tr("發送圖片")}><ImagePlus className="h-5 w-5" /><input data-testid="chat-admin-image" type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          <textarea data-testid="chat-admin-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={tr("輸入回覆，Enter 發送，Shift+Enter 換行")} className="flex-1 min-h-[40px] max-h-32 rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
          <button data-testid="chat-admin-send" onClick={send} disabled={busy || (!text.trim() && !file)} className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{tr("發送")}</button>
        </div>
      </div>
    </div>
  );
}

export function ChatAdmin({ callApi }) {
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ items: [], counts: {} });
  const [activeId, setActiveId] = useState(null);
  const [quick, setQuick] = useState([]);
  const [showQuick, setShowQuick] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/admin/chat/quick-replies" }).then((r) => setQuick(r.data)).catch(() => {}); }, [callApi]);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/chat/sessions?status=${status}&q=${encodeURIComponent(q)}` }).then((r) => setData(r.data)).catch(() => {}), [callApi, status, q]);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  const refresh = useCallback(() => { load(); window.dispatchEvent(new Event("admin-badge-refresh")); }, [load]);
  const active = data.items.find((s) => s.id === activeId) || null;
  const c = data.counts;
  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[520px]">
      <Head title={tr("客服會話")} sub={tr("前台「線上客服」實時聊天；新訊息會有聲音提醒。")} right={<><Pill tone="orange">{tr("處理中 {0}", c.open || 0)}</Pill><Pill tone="red">{tr("未讀 {0}", c.unread || 0)}</Pill><Pill tone="emerald">{tr("已處理 {0}", c.handled || 0)}</Pill><Btn kind="ghost" data-testid="chat-quick-manage" onClick={() => setShowQuick(true)} className="flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" />{tr("快捷回覆設定")}</Btn></>} />
      {showQuick && <QuickRepliesModal callApi={callApi} onClose={() => setShowQuick(false)} onSaved={setQuick} />}
      <Card className="flex-1 min-h-0 flex overflow-hidden" data-testid="chat-admin">
        <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {[["open", tr("處理中")], ["handled", tr("已處理")], ["all", tr("全部")]].map(([k, l]) => <button key={k} data-testid={`chat-filter-${k}`} onClick={() => setStatus(k)} className={`flex-1 h-8 rounded-md text-xs font-semibold ${status === k ? "bg-white shadow text-orange-600" : "text-slate-500"}`}>{l}</button>)}
            </div>
            <div className="relative"><Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" /><input data-testid="chat-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("搜尋姓名 / 聯絡方式 / 內容")} className="w-full h-9 rounded-lg bg-slate-100 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto" data-testid="chat-session-list">
            {data.items.length === 0 && <div className="text-center text-xs text-slate-400 py-10">{tr("暫無會話")}</div>}
            {data.items.map((s) => <SessionItem key={s.id} s={s} active={s.id === activeId} onClick={() => setActiveId(s.id)} />)}
          </div>
        </div>
        <div className="flex-1 min-w-0 min-h-0">
          {active ? <Thread key={active.id} callApi={callApi} session={active} onChanged={refresh} quick={quick} />
            : <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2"><Headphones className="h-10 w-10 text-slate-300" /><span className="text-sm">{tr("選擇左側會話開始回覆")}</span></div>}
        </div>
      </Card>
    </div>
  );
}
