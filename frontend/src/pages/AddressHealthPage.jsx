import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, fmtDate, NETWORK_COLORS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, ExternalLink, Activity, AlertTriangle, CheckCircle2, CircleDashed, Plus, Pause, Play, Trash2, Snowflake, Tag, History, Search, Link2 } from "lucide-react";
import { ChainTxDialog } from "@/components/ChainTxDialog";

const ST = {
  ok: { label: "正常", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", Icon: CheckCircle2 },
  error: { label: "异常", cls: "text-red-400 bg-red-400/10 border-red-400/30", Icon: AlertTriangle },
  idle: { label: "待同步", cls: "text-slate-400 bg-slate-400/10 border-slate-500/30", Icon: CircleDashed },
};
const inputCls = "bg-slate-900/60 border-slate-700";

function AddDialog({ open, onClose, channels, onDone }) {
  const [channelId, setChannelId] = useState("");
  const [addrs, setAddrs] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const list = addrs.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
      const { data } = await api.post("/chain/addresses", { channel_id: channelId, addresses: list, label });
      toast.success(`已添加，通道现有 ${data.wallet_addresses.length} 个地址`); setAddrs(""); setLabel(""); onDone(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-slate-700" data-testid="add-address-dialog">
        <DialogHeader><DialogTitle>添加收款地址</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>所属通道</Label>
            <Select value={channelId} onValueChange={setChannelId}><SelectTrigger data-testid="add-address-channel" className={inputCls}><SelectValue placeholder="选择通道" /></SelectTrigger>
              <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.network} · {c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>地址（每行一个）</Label><textarea value={addrs} onChange={(e) => setAddrs(e.target.value)} rows={4} data-testid="add-address-input" className="w-full rounded-md bg-slate-900/60 border border-slate-700 font-mono text-xs p-2 text-slate-200 focus:outline-none focus:border-cyan-500" /></div>
          <div className="space-y-1.5"><Label>备注标签（可选）</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="add-address-label" className={inputCls} placeholder="如：热钱包A / 交易所子账户" /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy || !channelId || !addrs.trim()} data-testid="add-address-submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "添加"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SweepDialog({ row, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [cold, setCold] = useState("");
  const [tx, setTx] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (row) setAmount(row.balance != null ? String(row.balance) : ""); }, [row]);
  if (!row) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/chain/sweeps", { address: row.address, network: row.network, amount: Number(amount), cold_wallet: cold, tx_id: tx, note });
      toast.success("已标记归集至冷钱包"); onDone(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-slate-700" data-testid="sweep-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Snowflake className="w-4 h-4 text-cyan-400" />标记归集至冷钱包</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs font-mono text-slate-400 break-all">{row.network} · {row.address}</div>
          <div className="space-y-1.5"><Label>归集金额 (USDT)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="sweep-amount-input" className={`${inputCls} font-mono`} /></div>
          <div className="space-y-1.5"><Label>冷钱包地址（可选）</Label><Input value={cold} onChange={(e) => setCold(e.target.value)} data-testid="sweep-cold-input" className={`${inputCls} font-mono text-xs`} /></div>
          <div className="space-y-1.5"><Label>归集交易 TxID（可选）</Label><Input value={tx} onChange={(e) => setTx(e.target.value)} data-testid="sweep-tx-input" className={`${inputCls} font-mono text-xs`} /></div>
          <div className="space-y-1.5"><Label>备注</Label><Input value={note} onChange={(e) => setNote(e.target.value)} data-testid="sweep-note-input" className={inputCls} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy || !amount} data-testid="sweep-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认归集"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ row, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { if (row) api.get("/chain/sweeps", { params: { address: row.address } }).then((r) => setRows(r.data)); }, [row]);
  if (!row) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-slate-700 max-w-2xl" data-testid="sweep-history-dialog">
        <DialogHeader><DialogTitle>归集记录</DialogTitle></DialogHeader>
        <div className="text-xs font-mono text-slate-400 break-all">{row.address}</div>
        {!rows ? <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto my-6" /> : rows.length === 0 ? <div className="py-6 text-center text-xs text-slate-500">暂无归集记录</div> : (
          <table className="w-full text-xs mt-2"><thead><tr className="text-slate-500 text-left border-b border-slate-800"><th className="py-2">时间</th><th>金额</th><th>冷钱包</th><th>TxID</th><th>操作人</th><th>备注</th></tr></thead>
            <tbody>{rows.map((s) => <tr key={s.id} className="border-b border-slate-800/50" data-testid={`sweep-row-${s.id}`}><td className="py-2 font-mono text-slate-400">{fmtDate(s.created_at)}</td><td className="font-mono text-cyan-300">{fmtUSDT(s.amount)}</td><td className="font-mono text-slate-400 max-w-[120px] truncate" title={s.cold_wallet}>{s.cold_wallet || "—"}</td><td className="font-mono text-slate-400 max-w-[120px] truncate" title={s.tx_id}>{s.tx_id || "—"}</td><td className="text-slate-400">{s.operator}</td><td className="text-slate-400">{s.note || "—"}</td></tr>)}</tbody></table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AddressHealthPage() {
  const [data, setData] = useState({ total_balance: 0, total_swept: 0, by_network: {}, addresses: [] });
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sweepRow, setSweepRow] = useState(null);
  const [histRow, setHistRow] = useState(null);
  const [chainRow, setChainRow] = useState(null);
  const [editLabel, setEditLabel] = useState(null);
  const [labelVal, setLabelVal] = useState("");
  const [q, setQ] = useState("");
  const [netFilter, setNetFilter] = useState("all");

  const load = () => Promise.all([api.get("/chain/addresses"), api.get("/channels")]).then(([a, c]) => { setData(a.data); setChannels(c.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const run = async (kind) => {
    setBusy(kind);
    try {
      const { data: d } = await api.post(kind === "balance" ? "/chain/addresses/refresh" : "/chain/sync");
      const errs = d.errors || [];
      if (kind === "balance") toast[errs.length ? "warning" : "success"](`余额刷新 ${d.ok} 个成功${errs.length ? `，${errs.length} 个失败` : ""}`);
      else toast[errs.length ? "warning" : "success"](`扫描 ${d.addresses} 个地址 / ${d.scanned} 笔转账，匹配 ${d.matched} 笔${errs.length ? `，${errs.length} 个地址失败` : ""}`);
      errs.slice(0, 3).forEach((e) => toast.error(e, { duration: 7000 }));
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(null); }
  };
  const togglePause = async (r) => {
    try { await api.patch(`/chain/addresses/${r.address}`, { status: r.paused ? "active" : "paused" }); toast.success(r.paused ? "已恢复分配" : "已暂停分配新订单"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const remove = async (r) => {
    if (!window.confirm(`确认从通道「${r.channel_name}」移除地址 ${r.address}？`)) return;
    try { await api.delete(`/chain/addresses/${r.channel_id}/${r.address}`); toast.success("地址已移除"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveLabel = async () => {
    try { await api.patch(`/chain/addresses/${editLabel.address}`, { label: labelVal }); toast.success("标签已保存"); setEditLabel(null); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const rows = data.addresses.filter((r) => (netFilter === "all" || r.network === netFilter) && (!q || r.address.toLowerCase().includes(q.toLowerCase()) || (r.label || "").includes(q) || r.channel_name.includes(q)));
  const summary = { total: data.addresses.length, ok: data.addresses.filter((r) => r.status === "ok").length, err: data.addresses.filter((r) => r.status === "error").length,
    paused: data.addresses.filter((r) => r.paused).length, pending: data.addresses.reduce((s, r) => s + r.pending, 0) };

  return (
    <div className="space-y-6" data-testid="address-health-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">收款地址管理</h1>
          <p className="text-sm text-slate-400 mt-1">地址池增删 / 暂停分配 / 标签备注 / 链上余额与同步巡检 / 冷钱包归集记录（余额每 5 分钟自动刷新）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run("balance")} disabled={!!busy} data-testid="refresh-balance-btn" className="border-slate-700">{busy === "balance" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" />刷新余额</>}</Button>
          <Button variant="outline" onClick={() => run("sync")} disabled={!!busy} data-testid="sync-all-btn" className="border-slate-700">{busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Activity className="w-4 h-4 mr-1" />扫描到账</>}</Button>
          <Button onClick={() => setAddOpen(true)} data-testid="add-address-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus className="w-4 h-4 mr-1" />添加地址</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="glass rounded-xl p-4 md:col-span-2" data-testid="total-balance-card"><div className="text-[11px] text-slate-500">所有地址链上余额总和（待归集）</div><div className="font-mono text-2xl font-bold text-cyan-400">{fmtUSDT(data.total_balance)} <span className="text-xs text-slate-500 font-normal">USDT</span></div>
          <div className="flex gap-3 mt-1 text-[10px] font-mono text-slate-500">{Object.entries(data.by_network || {}).map(([n, v]) => <span key={n}>{n} {fmtUSDT(v)}</span>)}</div></div>
        {[["累计已归集", fmtUSDT(data.total_swept), "text-emerald-400"], ["地址总数", summary.total, "text-slate-100"], ["正常 / 异常", `${summary.ok} / ${summary.err}`, summary.err ? "text-red-400" : "text-emerald-400"], ["已暂停", summary.paused, "text-amber-400"]].map(([k, v, c]) => (
          <div key={k} className="glass rounded-xl p-4"><div className="text-[11px] text-slate-500">{k}</div><div className={`font-mono text-xl font-bold ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="glass rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索地址 / 标签 / 通道" data-testid="address-search-input" className={`pl-9 ${inputCls}`} /></div>
        <span className="text-xs text-slate-500 font-mono">{rows.length} 个地址 · TRC20</span>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="py-3 px-3 font-medium">地址 / 标签</th><th className="py-3 px-3 font-medium">网络 / 通道</th><th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium text-right">链上余额</th><th className="py-3 px-3 font-medium text-center">待付</th><th className="py-3 px-3 font-medium text-right">累计到账</th><th className="py-3 px-3 font-medium text-right">已归集</th>
              <th className="py-3 px-3 font-medium">最近同步</th><th className="py-3 px-3 font-medium text-right">操作</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-slate-500">暂无地址，点击「添加地址」为通道配置收款地址</td></tr>
              : rows.map((r) => { const s = ST[r.status]; return (
                <tr key={r.network + r.address} className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${r.paused ? "opacity-60" : ""}`} data-testid={`addr-row-${r.address}`}>
                  <td className="py-3 px-3"><div className="font-mono text-xs text-slate-200">{r.address}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {editLabel?.address === r.address ? (<><Input value={labelVal} onChange={(e) => setLabelVal(e.target.value)} data-testid={`label-input-${r.address}`} className="h-6 text-[11px] w-40 bg-slate-900/60 border-slate-700" /><button onClick={saveLabel} data-testid={`label-save-${r.address}`} className="text-emerald-400 text-[11px]">保存</button><button onClick={() => setEditLabel(null)} className="text-slate-500 text-[11px]">取消</button></>)
                        : (<button onClick={() => { setEditLabel(r); setLabelVal(r.label || ""); }} data-testid={`label-edit-${r.address}`} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400"><Tag className="w-3 h-3" />{r.label || "添加标签"}</button>)}
                      {r.paused && <span className="text-[10px] px-1.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30" data-testid={`paused-badge-${r.address}`}>已暂停</span>}
                      {r.last_swept_at && <span className="text-[10px] px-1.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/30" title={`最近归集 ${fmtDate(r.last_swept_at)}`}>已归集 {r.swept_count} 次</span>}
                    </div></td>
                  <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${NETWORK_COLORS[r.network]}`}>{r.network}</span><div className="text-[11px] text-slate-500 mt-0.5">{r.channel_name}</div></td>
                  <td className="py-3 px-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${s.cls}`} data-testid={`addr-status-${r.address}`}><s.Icon className="w-3 h-3" />{s.label}</span>{(r.sync_error || r.balance_error) && <div className="text-[10px] text-red-400 max-w-[160px] truncate mt-0.5" title={r.sync_error || r.balance_error}>{r.sync_error || r.balance_error}</div>}</td>
                  <td className="py-3 px-3 text-right font-mono">{r.balance == null ? <span className="text-slate-600">—</span> : <span className="text-cyan-300 font-semibold">{fmtUSDT(r.balance)}</span>}{r.balance_at && <div className="text-[10px] text-slate-600">{fmtDate(r.balance_at)}</div>}</td>
                  <td className="py-3 px-3 text-center font-mono"><span className={r.pending ? "text-amber-400" : "text-slate-500"}>{r.pending}</span></td>
                  <td className="py-3 px-3 text-right font-mono text-xs"><div className="text-emerald-400">{fmtUSDT(r.paid_volume)}</div><div className="text-slate-500">{r.paid_count} 笔</div></td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">{fmtUSDT(r.swept_total)}</td>
                  <td className="py-3 px-3 text-xs font-mono text-slate-500">{r.last_sync_at ? fmtDate(r.last_sync_at) : "—"}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button onClick={() => setSweepRow(r)} data-testid={`sweep-btn-${r.address}`} className="p-1.5 rounded text-cyan-400 hover:bg-cyan-400/10" title="标记归集"><Snowflake className="w-4 h-4" /></button>
                    <button onClick={() => setHistRow(r)} data-testid={`history-btn-${r.address}`} className="p-1.5 rounded text-slate-400 hover:text-slate-100" title="归集记录"><History className="w-4 h-4" /></button>
                    <button onClick={() => setChainRow(r)} data-testid={`chaintx-btn-${r.address}`} className="p-1.5 rounded text-cyan-400 hover:bg-cyan-400/10" title="链上到账记录"><Link2 className="w-4 h-4" /></button>
                    <button onClick={() => togglePause(r)} data-testid={`pause-btn-${r.address}`} className="p-1.5 rounded text-amber-400 hover:bg-amber-400/10" title={r.paused ? "恢复分配" : "暂停分配"}>{r.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>
                    <a href={r.explorer} target="_blank" rel="noreferrer" className="p-1.5 inline-block rounded text-slate-400 hover:text-cyan-400" title="区块浏览器"><ExternalLink className="w-4 h-4" /></a>
                    <button onClick={() => remove(r)} data-testid={`remove-btn-${r.address}`} className="p-1.5 rounded text-red-400 hover:bg-red-400/10" title="移除地址"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </div>

      <AddDialog open={addOpen} onClose={() => setAddOpen(false)} channels={channels} onDone={load} />
      <SweepDialog row={sweepRow} onClose={() => setSweepRow(null)} onDone={load} />
      <HistoryDialog row={histRow} onClose={() => setHistRow(null)} />
      <ChainTxDialog open={!!chainRow} onClose={() => setChainRow(null)} title="收款地址链上到账记录" params={chainRow ? { address: chainRow.address } : null} />
    </div>
  );
}
