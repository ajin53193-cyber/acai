import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, fmtDate, NETWORK_COLORS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, ExternalLink, Activity, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

const ST = {
  ok: { label: "正常", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", Icon: CheckCircle2 },
  error: { label: "异常", cls: "text-red-400 bg-red-400/10 border-red-400/30", Icon: AlertTriangle },
  idle: { label: "待同步", cls: "text-slate-400 bg-slate-400/10 border-slate-500/30", Icon: CircleDashed },
};

export default function AddressHealthPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/chain/addresses").then((r) => { setRows(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const run = async (kind) => {
    setBusy(kind);
    try {
      const { data } = await api.post(kind === "balance" ? "/chain/addresses/refresh" : "/chain/sync");
      const errs = data.errors || [];
      if (kind === "balance") toast[errs.length ? "warning" : "success"](`余额刷新 ${data.ok} 个成功${errs.length ? `，${errs.length} 个失败` : ""}`);
      else toast[errs.length ? "warning" : "success"](`扫描 ${data.addresses} 个地址 / ${data.scanned} 笔转账，匹配 ${data.matched} 笔${errs.length ? `，${errs.length} 个地址失败` : ""}`);
      errs.slice(0, 3).forEach((e) => toast.error(e, { duration: 7000 }));
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(null); }
  };

  const summary = { total: rows.length, ok: rows.filter((r) => r.status === "ok").length, err: rows.filter((r) => r.status === "error").length,
    bal: rows.reduce((s, r) => s + (r.balance || 0), 0), pending: rows.reduce((s, r) => s + r.pending, 0) };

  return (
    <div className="space-y-6" data-testid="address-health-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">地址健康巡检</h1>
          <p className="text-sm text-slate-400 mt-1">各收款地址链上余额、同步状态与待付负载，快速发现失效地址（余额每 5 分钟自动刷新）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run("balance")} disabled={!!busy} data-testid="refresh-balance-btn" className="border-slate-700">{busy === "balance" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" />刷新余额</>}</Button>
          <Button onClick={() => run("sync")} disabled={!!busy} data-testid="sync-all-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Activity className="w-4 h-4 mr-1" />立即扫描到账</>}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[["地址总数", summary.total, "text-slate-100"], ["正常", summary.ok, "text-emerald-400"], ["异常", summary.err, "text-red-400"], ["链上总余额", fmtUSDT(summary.bal), "text-cyan-400"], ["待付订单", summary.pending, "text-amber-400"]].map(([k, v, c]) => (
          <div key={k} className="glass rounded-xl p-4"><div className="text-[11px] text-slate-500">{k}</div><div className={`font-mono text-xl font-bold ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="py-3 px-3 font-medium">地址</th><th className="py-3 px-3 font-medium">网络 / 通道</th><th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium text-right">链上余额</th><th className="py-3 px-3 font-medium text-center">待付</th><th className="py-3 px-3 font-medium text-right">累计到账</th>
              <th className="py-3 px-3 font-medium">最近同步</th><th className="py-3 px-3 font-medium">错误</th><th className="py-3 px-3"></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-slate-500">暂无已配置的收款地址，请在「通道路由」中为通道添加地址</td></tr>
              : rows.map((r) => { const s = ST[r.status]; return (
                <tr key={r.network + r.address} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`addr-row-${r.address}`}>
                  <td className="py-3 px-3 font-mono text-xs text-slate-200">{r.address}</td>
                  <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${NETWORK_COLORS[r.network]}`}>{r.network}</span><div className="text-[11px] text-slate-500 mt-0.5">{r.channel_name}</div></td>
                  <td className="py-3 px-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${s.cls}`} data-testid={`addr-status-${r.address}`}><s.Icon className="w-3 h-3" />{s.label}</span></td>
                  <td className="py-3 px-3 text-right font-mono">{r.balance == null ? <span className="text-slate-600">—</span> : <span className="text-cyan-300 font-semibold">{fmtUSDT(r.balance)}</span>}{r.balance_at && <div className="text-[10px] text-slate-600">{fmtDate(r.balance_at)}</div>}</td>
                  <td className="py-3 px-3 text-center font-mono"><span className={r.pending ? "text-amber-400" : "text-slate-500"}>{r.pending}</span></td>
                  <td className="py-3 px-3 text-right font-mono text-xs"><div className="text-emerald-400">{fmtUSDT(r.paid_volume)}</div><div className="text-slate-500">{r.paid_count} 笔</div></td>
                  <td className="py-3 px-3 text-xs font-mono text-slate-500">{r.last_sync_at ? fmtDate(r.last_sync_at) : "—"}</td>
                  <td className="py-3 px-3 text-[11px] text-red-400 max-w-[220px] truncate" title={r.sync_error || r.balance_error || ""}>{r.sync_error || r.balance_error || ""}</td>
                  <td className="py-3 px-3 text-right"><a href={r.explorer} target="_blank" rel="noreferrer" className="p-1.5 inline-block rounded text-slate-400 hover:text-cyan-400" title="区块浏览器"><ExternalLink className="w-4 h-4" /></a></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
