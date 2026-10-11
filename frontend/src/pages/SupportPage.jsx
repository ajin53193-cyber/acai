import { useEffect, useRef, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, RefreshCw, CheckCircle2, RotateCcw, Copy } from "lucide-react";

const STATUS_LABEL = { pending: "待支付", paid: "已支付", expired: "已过期", confirming: "确认中", rejected: "已驳回" };
const FILTERS = [["all", "全部"], ["open", "待处理"], ["resolved", "已解决"]];

export default function SupportPage() {
  const [threads, setThreads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);
  const [convo, setConvo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try { const r = await api.get("/support/threads", { params: { status: filter } }); setThreads(r.data); } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [filter]);

  const loadConvo = useCallback(async (orderNo) => {
    if (!orderNo) return;
    try { const r = await api.get(`/support/threads/${orderNo}`); setConvo(r.data); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { api.get("/support/templates").then((r) => setTemplates(r.data.templates || [])).catch(() => {}); }, []);
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

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending || !active) return;
    setSending(true);
    try { await api.post(`/support/threads/${active}`, { text: msg }); setText(""); await loadConvo(active); loadThreads(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSending(false); }
  };

  const setStatus = async (status) => {
    try { await api.patch(`/support/threads/${active}/status`, { status }); toast.success(status === "resolved" ? "已标记为已解决" : "已重新打开"); loadConvo(active); loadThreads(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
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
          <button onClick={loadThreads} data-testid="support-refresh" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400"><RefreshCw className="w-4 h-4" /> 刷新</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 230px)" }}>
        {/* Threads list */}
        <div className="glass rounded-xl overflow-y-auto" data-testid="support-threads">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : threads.length === 0 ? (
            <div className="text-center text-slate-500 py-20 text-sm">暂无会话</div>
          ) : threads.map((th) => (
            <button key={th.order_no} onClick={() => openThread(th.order_no)} data-testid={`support-thread-${th.order_no}`}
              className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${active === th.order_no ? "bg-slate-800/60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                  {th.status === "resolved" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}{th.merchant_name}
                </span>
                {th.unread > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center" data-testid={`thread-unread-${th.order_no}`}>{th.unread}</span>}
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate">{th.order_no}</div>
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
                  <div className="font-medium text-slate-200">{convo.merchant_name}</div>
                  {convo.status === "resolved"
                    ? <button onClick={() => setStatus("open")} data-testid="support-reopen" className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700"><RotateCcw className="w-3.5 h-3.5" /> 重新打开</button>
                    : <button onClick={() => setStatus("resolved")} data-testid="support-resolve" className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle2 className="w-3.5 h-3.5" /> 标记已解决</button>}
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
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="support-convo-messages">
                {convo.messages.length === 0 && <div className="text-center text-slate-500 text-sm py-8">暂无消息</div>}
                {convo.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[14px] whitespace-pre-wrap break-words ${m.sender === "agent" ? "bg-cyan-500 text-slate-950 rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
                      <div className="text-[11px] opacity-70 mb-0.5">{m.sender === "agent" ? (m.sender_name || "客服") : "访客"} · {fmtDate(m.created_at)}</div>
                      {m.image && <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} alt="attach" className="max-w-[220px] rounded-lg mb-1 block" /></a>}
                      {m.text}
                    </div>
                  </div>
                ))}
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
    </div>
  );
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
