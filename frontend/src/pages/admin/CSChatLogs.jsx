import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "sonner";
import { MessagesSquare, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

const fmtTime = (iso) => { try { return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const fmtClock = (iso) => { try { return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const isoDay = (n) => { const d = new Date(Date.now() + 8 * 3600 * 1000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const inputCls = "rounded-lg border border-amber-500/20 bg-[#060B18]/70 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-[#D4AF37]/60 [color-scheme:dark]";

function ChatViewer({ token, sessionId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${API}/admin/cs/sessions/${sessionId}/messages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setData(r.data)).catch((e) => { toast.error(formatDetail(e.response?.data?.detail) || "加载失败"); onClose(); });
  }, [sessionId, token, onClose]);
  const s = data?.session;
  // glass-card 的 backdrop-filter 会让 fixed 定位失效，故挂到 body
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} data-testid="cs-chat-viewer">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-[#0b1226] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100"><MessagesSquare size={15} className="text-[#E5C158]" /> {s?.region || s?.ip || "访客"} <span className="text-xs font-normal text-slate-500">· 坐席 {data?.agent?.name || "—"}</span></div>
            {s && <div className="mt-1 text-[11px] text-slate-500">IP {s.ip || "—"}｜来源 {s.source || "—"}｜推文 {s.slug || "—"}｜开始 {fmtTime(s.created_at)}｜最后 {fmtTime(s.last_message_at)}</div>}
          </div>
          <button onClick={onClose} data-testid="cs-chat-viewer-close" className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="cs-scroll-dark flex-1 space-y-3 overflow-y-auto px-5 py-4" data-testid="cs-chat-viewer-messages">
          {!data && <div className="py-10 text-center text-xs text-slate-500">加载中…</div>}
          {data?.messages.map((m) => {
            const mine = m.sender === "agent";
            if (m.via === "system") return <div key={m.id} className="flex justify-center py-1"><span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-400">{m.text}</span></div>;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-slate-400">访</div>}
                <div className="flex max-w-[75%] flex-col">
                  <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${m.image ? "rounded-xl p-1" : "px-3 py-2"} ${mine ? "rounded-2xl rounded-br-md bg-[#D4AF37]/20 text-[#f3e3b0]" : "rounded-2xl rounded-bl-md bg-white/10 text-slate-200"}`}>
                    {m.image ? <a href={toFullUrl(m.image)} target="_blank" rel="noreferrer"><img src={toFullUrl(m.image)} alt="图片" className="max-h-56 rounded-lg" /></a> : m.text}
                  </div>
                  <span className={`mt-0.5 px-1 text-[10px] text-slate-500 ${mine ? "text-right" : ""}`}>{fmtClock(m.created_at)}{m.via === "faq" && " · 常见问题自动回复"}{String(m.id).startsWith("welcome-") && " · 欢迎语"}</span>
                </div>
                {mine && (data.agent?.avatar ? <img src={toFullUrl(data.agent.avatar)} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" /> : <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/30 text-[10px] text-[#E5C158]">客</div>)}
              </div>
            );
          })}
          {data && data.messages.length === 0 && <div className="py-10 text-center text-xs text-slate-500">该会话暂无消息</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function CSChatLogs({ token, agents }) {
  const [filter, setFilter] = useState({ agent_id: "", start: isoDay(6), end: isoDay(0), q: "" });
  const [res, setRes] = useState({ sessions: [], total: 0, page: 1, size: 30 });
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(null);

  const query = useCallback(async (f, page = 1) => {
    setLoading(true);
    try { const r = await axios.get(`${API}/admin/cs/sessions`, { headers: { Authorization: `Bearer ${token}` }, params: { ...f, page, size: 30 } }); setRes(r.data); }
    catch (e) { toast.error(formatDetail(e.response?.data?.detail) || "查询失败"); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { query({ agent_id: "", start: isoDay(6), end: isoDay(0), q: "" }); }, [query]);

  const pages = Math.max(1, Math.ceil(res.total / res.size));
  return (
    <div className="glass-card rounded-2xl p-6" data-testid="cs-chat-logs">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-gold-gradient"><MessagesSquare size={16} /> 坐席聊天记录</h3>
        <p className="mt-1 text-xs text-slate-500">查看每位坐席与访客的完整对话（含欢迎语、常见问题自动回复、图片）。聊天数据保留 3 天后自动清理。</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-testid="cs-chat-filter">
        <select data-testid="cs-chat-agent" value={filter.agent_id} onChange={(e) => setFilter({ ...filter, agent_id: e.target.value })} className={inputCls}>
          <option value="">全部坐席</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" data-testid="cs-chat-start" value={filter.start} max={filter.end} onChange={(e) => setFilter({ ...filter, start: e.target.value })} className={inputCls} />
        <span className="text-xs text-slate-500">至</span>
        <input type="date" data-testid="cs-chat-end" value={filter.end} min={filter.start} onChange={(e) => setFilter({ ...filter, end: e.target.value })} className={inputCls} />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input data-testid="cs-chat-q" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") query(filter); }} placeholder="地区 / IP / 最后消息 / 来源" className={`${inputCls} w-56 pl-7`} />
        </div>
        <button onClick={() => query(filter)} disabled={loading} data-testid="cs-chat-query" className="rounded-lg bg-gold-gradient px-4 py-1.5 text-xs font-bold text-[#060B18] disabled:opacity-50">{loading ? "查询中…" : "查询"}</button>
        <span className="ml-auto text-xs text-slate-400" data-testid="cs-chat-total">共 {res.total} 个会话</span>
      </div>

      {res.sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">该条件下没有会话记录</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-amber-500/10 text-left text-xs tracking-widest text-slate-500">
              <th className="py-2.5 pr-3">最后时间</th><th className="py-2.5 pr-3">坐席</th><th className="py-2.5 pr-3">访客</th><th className="py-2.5 pr-3">来源</th><th className="py-2.5 pr-3">消息数</th><th className="py-2.5 pr-3">最后消息</th><th className="py-2.5 text-right">操作</th>
            </tr></thead>
            <tbody>
              {res.sessions.map((s) => (
                <tr key={s.id} className="border-b border-amber-500/5 hover:bg-white/[0.02]" data-testid={`cs-chat-row-${s.id}`}>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-slate-400">{fmtTime(s.last_message_at)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-200">{s.agent_name}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3"><div className="text-slate-200">{s.region || "—"}</div><div className="font-mono text-[10px] text-slate-500">{s.ip}</div></td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-slate-400">{s.source || "—"}{s.slug ? ` / ${s.slug}` : ""}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs"><span className="font-bold text-[#E5C158]">{s.msg_total}</span><span className="text-slate-500">（访客 {s.msg_visitor}）</span></td>
                  <td className="max-w-[260px] truncate py-2.5 pr-3 text-xs text-slate-400">{s.last_message || "—"}</td>
                  <td className="py-2.5 text-right"><button onClick={() => setViewing(s.id)} data-testid={`cs-chat-view-${s.id}`} className="rounded-full border border-amber-500/30 px-3 py-1 text-xs text-[#E5C158] hover:bg-amber-500/10">查看对话</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button disabled={res.page <= 1} onClick={() => query(filter, res.page - 1)} data-testid="cs-chat-prev" className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={15} /></button>
          <span>第 {res.page} / {pages} 页</span>
          <button disabled={res.page >= pages} onClick={() => query(filter, res.page + 1)} data-testid="cs-chat-next" className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30"><ChevronRight size={15} /></button>
        </div>
      )}
      {viewing && <ChatViewer token={token} sessionId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
