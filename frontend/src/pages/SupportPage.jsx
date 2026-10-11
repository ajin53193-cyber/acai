import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, RefreshCw, CheckCircle2, RotateCcw, Copy, Volume2, VolumeX, Trash2, Eraser } from "lucide-react";

const STATUS_LABEL = { pending: "待支付", paid: "已支付", expired: "已过期", confirming: "确认中", rejected: "已驳回" };
const FILTERS = [["all", "全部"], ["open", "待处理"], ["resolved", "已解决"]];

export default function SupportPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(searchParams.get("mine") === "1");
  const [active, setActive] = useState(null);
  const [convo, setConvo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [seats, setSeats] = useState([]);
  const [maxSeat, setMaxSeat] = useState(null);
  const endRef = useRef(null);
  const imgUrl = (p) => (p && !p.startsWith("http") && !p.startsWith("data:")) ? (process.env.REACT_APP_BACKEND_URL || "") + p : p;
  const fmtDur = (s) => s == null ? "—" : s < 60 ? `${s}秒` : s < 3600 ? `${Math.round(s / 60)}分` : `${(s / 3600).toFixed(1)}时`;
  const onlineByName = Object.fromEntries(seats.map((s) => [s.name, s.online]));
  const onlineById = Object.fromEntries(seats.map((s) => [s.id, s.online]));
  const canRefund = user.role === "admin" || (user.permissions || []).includes("orders.manual_callback");
  const [lightbox, setLightbox] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [bulkResolved, setBulkResolved] = useState(true);
  const [bulkStaleOn, setBulkStaleOn] = useState(false);
  const [bulkStaleHours, setBulkStaleHours] = useState(24);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("support_sound") !== "0");
  const [tone, setTone] = useState(() => localStorage.getItem("support_tone") || "dingdong");
  const [totalUnread, setTotalUnread] = useState(0);
  const prevUnreadRef = useRef(null);
  const baseTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const audioCtxRef = useRef(null);
  const TONES = {
    dingdong: { label: "叮咚", notes: [[880, 0], [1180, 0.18]] },
    crisp: { label: "清脆", notes: [[1568, 0], [2093, 0.1]] },
    soft: { label: "柔和", notes: [[523, 0], [659, 0.22]] },
    urgent: { label: "急促", notes: [[1046, 0], [1046, 0.12], [1046, 0.24]] },
    bell: { label: "铃声", notes: [[1318, 0], [1046, 0.14], [1568, 0.28]] },
  };
  const playBeep = useCallback((toneKey) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || (audioCtxRef.current = new Ctx());
      if (ctx.state === "suspended") ctx.resume();
      const mk = (freq, start) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.28);
        o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + 0.3);
      };
      const key = toneKey || localStorage.getItem("support_tone") || "dingdong";
      (TONES[key] || TONES.dingdong).notes.forEach(([f, s]) => mk(f, s));
    } catch (e) { /* ignore */ }
  }, []);
  const notify = useCallback((n) => {
    toast(`🔔 收到 ${n} 条新客户消息`, { duration: 4000 });
    if (soundOn) playBeep();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("在线客服 · 新消息", { body: `有 ${n} 条新的客户消息待处理` });
      }
    } catch (e) { /* ignore */ }
  }, [soundOn, playBeep]);
  const toggleSound = () => {
    setSoundOn((v) => {
      const nv = !v;
      localStorage.setItem("support_sound", nv ? "1" : "0");
      if (nv) { playBeep(); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }
      return nv;
    });
  };
  const chooseTone = (k) => { setTone(k); localStorage.setItem("support_tone", k); playBeep(k); };

  const loadThreads = useCallback(async () => {
    try {
      const r = await api.get("/support/threads", { params: { status: filter } });
      const data = r.data;
      const total = data.reduce((s, t) => s + (t.unread || 0), 0);
      if (prevUnreadRef.current !== null && total > prevUnreadRef.current) notify(total - prevUnreadRef.current);
      prevUnreadRef.current = total;
      setTotalUnread(total);
      setThreads(data);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [filter, notify]);

  const loadConvo = useCallback(async (orderNo) => {
    if (!orderNo) return;
    try { const r = await api.get(`/support/threads/${orderNo}`); setConvo(r.data); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { api.get("/support/templates").then((r) => setTemplates(r.data.templates || [])).catch(() => {}); }, []);
  useEffect(() => { if (user.role === "admin") api.get("/support/settings").then((r) => setMaxSeat(r.data.max_per_seat)).catch(() => {}); }, [user.role]);
  useEffect(() => { const f = () => { api.get("/support/stats").then((r) => setStats(r.data)).catch(() => {}); api.get("/support/seats").then((r) => setSeats(r.data)).catch(() => {}); }; f(); const i = setInterval(f, 8000); return () => clearInterval(i); }, []);
  useEffect(() => { prevUnreadRef.current = null; }, [filter]);
  useEffect(() => {
    const base = baseTitleRef.current;
    if (totalUnread <= 0) { document.title = base; return; }
    let flip = false;
    const tick = () => { document.title = flip ? base : `(${totalUnread}) 新消息`; flip = !flip; };
    tick();
    const id = setInterval(tick, 1000);
    return () => { clearInterval(id); document.title = base; };
  }, [totalUnread]);
  useEffect(() => { loadThreads(); const i = setInterval(loadThreads, 5000); return () => clearInterval(i); }, [loadThreads]);
  useEffect(() => {
    if (!active) return;
    loadConvo(active);
    const i = setInterval(() => loadConvo(active), 3000);
    return () => clearInterval(i);
  }, [active, loadConvo]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convo?.messages?.length]);

  const openThread = (orderNo) => { setActive(orderNo); setConvo(null); loadThreads(); };
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("已复制"); };

  const [mc, setMc] = useState(false);
  const [mcTx, setMcTx] = useState("");
  const [mcAmt, setMcAmt] = useState("");
  const [mcBusy, setMcBusy] = useState(false);
  const [mcArr, setMcArr] = useState(null);
  const openMc = () => {
    if (!convo?.order_id) return;
    setMc(true); setMcTx(""); setMcAmt(String(convo.pay_amount ?? convo.amount_usdt ?? "")); setMcArr(null);
    api.get(`/orders/${convo.order_id}/recent-arrivals`).then((r) => setMcArr(r.data)).catch(() => setMcArr([]));
  };
  const submitMc = async () => {
    if (!mcTx.trim() || !mcAmt) { toast.error("请填写交易哈希和金额"); return; }
    setMcBusy(true);
    try {
      const { data } = await api.post(`/orders/${convo.order_id}/manual-callback`, { tx_id: mcTx.trim(), amount: Number(mcAmt) });
      toast.success(`核对成功：实际到账 ${data.amount} USDT，已确认并回调`);
      setMc(false); loadConvo(active); loadThreads();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setMcBusy(false); }
  };

  const saveMax = async () => {
    const v = parseInt(maxSeat, 10);
    if (!v || v < 1) return;
    try { const { data } = await api.put("/support/settings", { max_per_seat: v }); setMaxSeat(data.max_per_seat); toast.success(`已设置每坐席上限为 ${data.max_per_seat}`); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending || !active) return;
    setSending(true);
    try { await api.post(`/support/threads/${active}`, { text: msg }); setText(""); await loadConvo(active); loadThreads(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSending(false); }
  };

  const assign = async (id) => {
    if (!id) return;
    try { const { data } = await api.patch(`/support/threads/${active}/assign`, { assigned_id: id }); toast.success(`已转交给 ${data.assigned_to}`); loadConvo(active); loadThreads(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const setStatus = async (status) => {
    try {
      const { data } = await api.patch(`/support/threads/${active}/status`, { status });
      if (data.deleted) { toast.success("订单已完成，会话已结束并清除数据"); setActive(null); setConvo(null); }
      else { toast.success(status === "resolved" ? "已标记为已解决" : "已重新打开"); loadConvo(active); }
      loadThreads();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const endThread = async () => {
    if (!active) return;
    if (!window.confirm("结束并删除该会话？记录将从列表移除且不可恢复，该坐席名额随即释放。")) return;
    try {
      await api.delete(`/support/threads/${active}`);
      toast.success("会话已结束并删除");
      setActive(null); setConvo(null); loadThreads();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const submitBulk = async () => {
    setBulkBusy(true);
    try {
      const { data } = await api.post("/support/threads/bulk-end", { resolved: bulkResolved, stale_hours: bulkStaleOn ? Number(bulkStaleHours) : null });
      toast.success(`已清理 ${data.purged} 个会话`);
      setBulk(false); setActive(null); setConvo(null); loadThreads();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBulkBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="support-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-cyan-400" /> 在线客服</h1>
          <p className="text-sm text-slate-400 mt-1">实时回复付款人咨询（转错金额、未到账等问题）</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden" data-testid="support-filter">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} data-testid={`support-filter-${k}`}
                className={`px-3 py-1.5 text-xs ${filter === k ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setMineOnly((v) => !v)} data-testid="support-filter-mine"
            className={`px-3 py-1.5 text-xs rounded-lg border ${mineOnly ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" : "text-slate-400 border-slate-700 hover:text-slate-200"}`}>仅我负责</button>
          {user.role === "admin" && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400" data-testid="support-max-config">
              每坐席上限
              <input type="number" min="1" max="100" value={maxSeat ?? ""}
                onChange={(e) => setMaxSeat(e.target.value)} onBlur={saveMax} onKeyDown={(e) => e.key === "Enter" && saveMax()}
                data-testid="support-max-input"
                className="w-14 h-7 px-2 rounded bg-slate-800 border border-slate-600 text-slate-200 outline-none focus:border-cyan-500" />
            </div>
          )}
          <button onClick={toggleSound} data-testid="support-sound-toggle" title={soundOn ? "新消息声音提醒：开（点击静音）" : "新消息声音提醒：关"} className={`flex items-center gap-1.5 text-sm ${soundOn ? "text-cyan-400" : "text-slate-500"} hover:text-cyan-300`}>
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} {soundOn ? "提醒开" : "已静音"}
          </button>
          <select value={tone} onChange={(e) => chooseTone(e.target.value)} disabled={!soundOn} data-testid="support-tone-select" title="新消息提示音效"
            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 outline-none focus:border-cyan-500 disabled:opacity-40">
            {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => setBulk(true)} data-testid="support-bulk-open" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400"><Eraser className="w-4 h-4" /> 批量清理</button>
          <button onClick={loadThreads} data-testid="support-refresh" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400"><RefreshCw className="w-4 h-4" /> 刷新</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="support-stats">
          <div className="glass rounded-xl p-3"><div className="text-xs text-slate-400">待处理</div><div className="text-2xl font-bold text-amber-400">{stats.open}</div></div>
          <div className="glass rounded-xl p-3"><div className="text-xs text-slate-400">已解决</div><div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div></div>
          <div className="glass rounded-xl p-3"><div className="text-xs text-slate-400">会话总数</div><div className="text-2xl font-bold text-slate-200">{stats.total}</div></div>
          <div className="glass rounded-xl p-3 overflow-hidden"><div className="text-xs text-slate-400 mb-1">坐席平均响应</div>
            {stats.by_seat.length === 0 ? <div className="text-slate-500 text-sm">暂无</div> : stats.by_seat.slice(0, 3).map((s) => (
              <div key={s.name} className="flex items-center justify-between text-[11px]"><span className="text-slate-300 truncate">{s.name}</span><span className="text-cyan-400 font-mono shrink-0">{fmtDur(s.avg_seconds)}·{s.replies}条</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 210px)" }}>
        {/* Threads list */}
        <div className="glass rounded-xl overflow-y-auto" data-testid="support-threads">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : (mineOnly ? threads.filter((t) => t.assigned_to === user.name) : threads).length === 0 ? (
            <div className="text-center text-slate-500 py-20 text-sm">暂无会话</div>
          ) : (mineOnly ? threads.filter((t) => t.assigned_to === user.name) : threads).map((th) => (
            <button key={th.order_no} onClick={() => openThread(th.order_no)} data-testid={`support-thread-${th.order_no}`}
              className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${active === th.order_no ? "bg-slate-800/60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                  {th.status === "resolved" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}{th.merchant_name}
                </span>
                {th.unread > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center" data-testid={`thread-unread-${th.order_no}`}>{th.unread}</span>}
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate">{th.order_no}</div>
              {th.assigned_to && <div className="text-[10px] text-cyan-400/80 truncate flex items-center gap-1"><Dot online={onlineByName[th.assigned_to]} />负责：{th.assigned_to}</div>}
              <div className="text-[12px] text-slate-400 truncate mt-0.5">{th.last_sender === "agent" ? "我：" : ""}{th.last_text}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{fmtDate(th.last_at)}</div>
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div className="glass rounded-xl lg:col-span-2 flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">选择左侧会话开始回复</div>
          ) : !convo ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-800 space-y-2" data-testid="support-order-detail">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-200 flex items-center gap-2">{convo.merchant_name}
                    {convo.assigned_to && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex items-center gap-1" data-testid="support-assigned"><Dot online={onlineById[convo.assigned_id]} />负责：{convo.assigned_to}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select onChange={(e) => { assign(e.target.value); e.target.value = ""; }} data-testid="support-assign-select" className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300">
                      <option value="">转交坐席…</option>
                      {seats.map((s) => <option key={s.id} value={s.id}>{s.online ? "🟢" : "⚪"} {s.name}</option>)}
                    </select>
                    {convo.status === "resolved"
                      ? <button onClick={() => setStatus("open")} data-testid="support-reopen" className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700"><RotateCcw className="w-3.5 h-3.5" /> 重新打开</button>
                      : <button onClick={() => setStatus("resolved")} data-testid="support-resolve" className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle2 className="w-3.5 h-3.5" /> 标记已解决</button>}
                    <button onClick={endThread} data-testid="support-end" className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> 结束会话</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <Detail k="订单号" v={convo.order_no} onCopy={copy} />
                  <Detail k="状态" v={STATUS_LABEL[convo.order_status] || convo.order_status} />
                  <Detail k="金额" v={`${convo.amount_usdt} USDT`} />
                  <Detail k="应付金额" v={`${convo.pay_amount || convo.amount_usdt} USDT`} />
                  <Detail k="网络" v={convo.network} />
                  <Detail k="创建时间" v={fmtDate(convo.created_at)} />
                  {convo.out_trade_no && <Detail k="商户单号" v={convo.out_trade_no} onCopy={copy} />}
                  {convo.tx_id && <Detail k="交易哈希" v={convo.tx_id} onCopy={copy} />}
                  <div className="col-span-2"><Detail k="收款地址" v={convo.wallet_address} onCopy={copy} mono /></div>
                  {convo.order_id && canRefund && ["pending", "confirming", "expired"].includes(convo.order_status) && (
                    <button onClick={openMc} data-testid="support-mc-open" className="col-span-2 mt-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />核对到账 / 手动补单
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="support-convo-messages">
                {convo.messages.length === 0 && <div className="text-center text-slate-500 text-sm py-8">暂无消息</div>}
                {convo.messages.map((m) => m.sender === "system" ? (
                  <div key={m.id} className="flex justify-center" data-testid="support-system-msg"><div className="text-[11px] text-slate-500 bg-slate-800/50 rounded-full px-3 py-1">{m.text}</div></div>
                ) : (
                  <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[14px] whitespace-pre-wrap break-words ${m.sender === "agent" ? "bg-cyan-500 text-slate-950 rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
                      <div className="text-[11px] opacity-70 mb-0.5">{m.sender === "agent" ? (m.sender_name || "客服") : "访客"} · {fmtDate(m.created_at)}</div>
                      {m.image && <img src={imgUrl(m.image)} alt="attach" onClick={() => setLightbox(imgUrl(m.image))} data-testid="support-msg-image" className="max-w-[220px] rounded-lg mb-1 block cursor-zoom-in" />}
                      {m.text}
                    </div>
                  </div>
                ))}
                {convo.customer_typing && <div className="text-xs text-slate-400 italic" data-testid="support-typing">访客正在输入…</div>}
                <div ref={endRef} />
              </div>
              {templates.length > 0 && (
                <div className="flex gap-2 px-3 pt-2 overflow-x-auto" data-testid="support-templates">
                  {templates.map((tp, i) => (
                    <button key={i} onClick={() => setText((v) => (v ? v + " " : "") + tp)} data-testid={`support-template-${i}`}
                      className="shrink-0 text-[12px] px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300">{tp.length > 16 ? tp.slice(0, 16) + "…" : tp}</button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 p-3 border-t border-slate-800">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="输入回复…" data-testid="support-reply-input"
                  className="flex-1 h-11 px-3 rounded-xl bg-slate-900/60 border border-slate-700 text-[15px] outline-none text-slate-100" />
                <button onClick={send} disabled={sending || !text.trim()} data-testid="support-reply-send"
                  className="h-11 px-4 rounded-xl bg-cyan-500 text-slate-950 font-semibold flex items-center justify-center disabled:opacity-40 shrink-0">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {bulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="support-bulk-dialog" onClick={(e) => e.target === e.currentTarget && setBulk(false)}>
          <div className="w-full max-w-md glass border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-slate-100">批量清理会话</h3><button onClick={() => setBulk(false)} data-testid="support-bulk-close" className="text-slate-400 hover:text-slate-200">✕</button></div>
            <label className="flex items-center gap-2 text-sm text-slate-200 mb-3 cursor-pointer">
              <input type="checkbox" checked={bulkResolved} onChange={(e) => setBulkResolved(e.target.checked)} data-testid="support-bulk-resolved" className="w-4 h-4 accent-cyan-500" />
              清理所有「已解决」会话
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200 mb-2 cursor-pointer flex-wrap">
              <input type="checkbox" checked={bulkStaleOn} onChange={(e) => setBulkStaleOn(e.target.checked)} data-testid="support-bulk-stale" className="w-4 h-4 accent-cyan-500" />
              清理超过
              <input type="number" min="1" value={bulkStaleHours} onChange={(e) => setBulkStaleHours(e.target.value)} data-testid="support-bulk-hours" className="w-16 h-8 px-2 rounded bg-slate-900/60 border border-slate-700 text-slate-100 outline-none focus:border-cyan-500" />
              小时无活动的会话
            </label>
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 my-3">注意：清理即删除会话记录，不可恢复，并立即释放对应坐席名额。</p>
            <button onClick={submitBulk} disabled={bulkBusy || (!bulkResolved && !bulkStaleOn)} data-testid="support-bulk-submit" className="w-full h-10 rounded-lg bg-red-500 text-white font-semibold disabled:opacity-40 flex items-center justify-center">{bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "执行清理"}</button>
          </div>
        </div>
      )}
      {mc && convo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="support-mc-dialog" onClick={(e) => e.target === e.currentTarget && setMc(false)}>
          <div className="w-full max-w-md glass border border-slate-700 rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-slate-100">核对到账 / 手动补单</h3><button onClick={() => setMc(false)} data-testid="support-mc-close" className="text-slate-400 hover:text-slate-200">✕</button></div>
            <div className="text-xs text-slate-400 mb-1">订单 <span className="font-mono text-slate-200">{convo.order_no}</span></div>
            <div className="text-xs text-slate-400 break-all mb-3">收款地址 <span className="font-mono text-slate-300">{convo.wallet_address}</span></div>
            <label className="text-xs text-slate-400">交易哈希 TxID</label>
            <input value={mcTx} onChange={(e) => setMcTx(e.target.value)} data-testid="support-mc-tx" placeholder="链上转账哈希" className="w-full mb-2 mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500" />
            <label className="text-xs text-slate-400">到账金额 USDT</label>
            <input type="number" value={mcAmt} onChange={(e) => setMcAmt(e.target.value)} data-testid="support-mc-amt" className="w-full mb-2 mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-slate-100 outline-none focus:border-cyan-500" />
            {mcArr === null ? <div className="text-xs text-slate-500 py-2">加载最近到账…</div> : mcArr.length === 0 ? <div className="text-xs text-slate-500 py-2">该地址暂无最近链上到账</div> : (
              <div className="mb-2">
                <div className="text-xs text-slate-400 mb-1">最近到账（点击带入，已占用不可选）</div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {mcArr.map((a) => (
                    <button key={a.tx_id} disabled={a.used} onClick={() => { setMcTx(a.tx_id); setMcAmt(String(a.amount)); }} data-testid={`support-mc-arrival-${a.tx_id}`}
                      className={`w-full text-left text-xs rounded border px-2 py-1.5 flex items-center justify-between gap-2 ${a.used ? "border-slate-800 text-slate-600 cursor-not-allowed" : "border-slate-700 hover:border-cyan-500/50 text-slate-300"}`}>
                      <span className="font-mono truncate">{a.tx_id.slice(0, 10)}…{a.tx_id.slice(-6)}</span>
                      <span className="flex items-center gap-2 shrink-0"><span className="font-mono text-emerald-400">{a.amount}</span>{a.used ? <span className="text-[10px] text-slate-500">已占用</span> : <span className="text-[10px] text-emerald-500">可用</span>}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={submitMc} disabled={mcBusy || !mcTx.trim() || !mcAmt} data-testid="support-mc-submit" className="w-full h-10 rounded-lg bg-emerald-500 text-slate-950 font-semibold disabled:opacity-40 flex items-center justify-center">{mcBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "核对并确认"}</button>
          </div>
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4" data-testid="support-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="预览" className="max-w-[92vw] max-h-[82vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="mt-3 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <a href={lightbox} download data-testid="support-lightbox-download" className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-semibold">下载</a>
            <button onClick={() => setLightbox(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ online }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${online ? "bg-emerald-400" : "bg-slate-500"}`} title={online ? "在线" : "离线"} />;
}

function Detail({ k, v, onCopy, mono }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-slate-500 shrink-0">{k}：</span>
      <span className={`text-slate-200 truncate ${mono ? "font-mono" : ""}`}>{v}</span>
      {onCopy && <button onClick={() => onCopy(v)} className="text-cyan-400 shrink-0"><Copy className="w-3 h-3" /></button>}
    </div>
  );
}
