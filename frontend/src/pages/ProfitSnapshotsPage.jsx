import { useEffect, useState, useCallback, Fragment } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PieChart, Loader2, Play, ChevronDown, ChevronRight, FileSpreadsheet, Send } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line,
} from "recharts";

export default function ProfitSnapshotsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [compareIds, setCompareIds] = useState([]);
  const [compareData, setCompareData] = useState([]);
  const COLORS = ["#10B981", "#06B6D4", "#F59E0B", "#A78BFA", "#F472B6"];

  useEffect(() => {
    api.get("/dev/merchants").then((r) => setMerchants(r.data)).catch(() => {});
    api.get("/profit-snapshots/trend?days=30")
      .then((r) => setTrend(r.data.map((d) => ({ ...d, label: d.date.slice(5) }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (compareIds.length === 0) { setCompareData([]); return; }
    Promise.all(compareIds.map((id) => api.get(`/profit-snapshots/trend?days=30&merchant_id=${id}`).then((r) => ({ id, data: r.data }))))
      .then((results) => {
        const byDate = {};
        results.forEach(({ id, data }) => data.forEach((d) => {
          byDate[d.date] = byDate[d.date] || { label: d.date.slice(5) };
          byDate[d.date][id] = d.platform_profit;
        }));
        setCompareData(Object.keys(byDate).sort().map((k) => byDate[k]));
      }).catch(() => {});
  }, [compareIds]);

  const toggleCompare = (id) => setCompareIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : (s.length >= 5 ? s : [...s, id])));
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get("/profit-snapshots").then((r) => { setRows(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/profit-snapshots/run?date=${date}`);
      toast.success(`已生成 ${date} 分润快照（${data.order_count} 单${data.backfilled ? `，补偿 ${data.backfilled} 单` : ""}）`);
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const exportSnapshot = async (d) => {
    try {
      const res = await api.get(`/reports/profit-snapshot?date=${d}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `profit_snapshot_${d}.xlsx`; a.click(); URL.revokeObjectURL(url);
      toast.success(`已导出 ${d} 分润对账 Excel`);
    } catch (err) { toast.error("导出失败"); }
  };

  const sendReport = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/notify/daily-report?date=${date}`);
      setReport(data);
      toast.success(data.telegram_configured ? (data.sent ? "日报已推送 Telegram" : "Telegram 推送失败，见下方预览") : "Telegram 未配置，已生成预览");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="profit-snapshots-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><PieChart className="w-6 h-6 text-cyan-400" /> 分润快照</h1>
          <p className="text-sm text-slate-400 mt-1">每日日终自动对账快照（分润实时入账，此处为按商户/代理/平台的日度汇总与兜底补偿）</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="snapshot-date-input" className="w-[150px] bg-slate-900/60 border-slate-700 font-mono" />
          <Button onClick={sendReport} disabled={busy} variant="outline" data-testid="send-daily-report-btn" className="border-slate-700 hover:bg-slate-800">
            <Send className="w-4 h-4 mr-1" /> 发送今日日报
          </Button>
          <Button onClick={async () => { try { await api.post("/export/snapshots", {}); toast.success("已加入后台导出，前往『导出任务』下载"); } catch { toast.error("导出失败"); } }} variant="outline" data-testid="bg-export-snapshots-btn" className="border-slate-700 hover:bg-slate-800">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> 后台导出
          </Button>
          <Button onClick={runNow} disabled={busy} data-testid="snapshot-run-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-1" /> 生成快照</>}
          </Button>
        </div>
      </div>

      {report && (
        <div className="glass rounded-xl p-4" data-testid="daily-report-preview">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-200">Telegram 日报预览 · {report.date}</div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${report.telegram_configured ? (report.sent ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-400/30") : "text-slate-400 border-slate-600"}`}>
              {report.telegram_configured ? (report.sent ? "已推送" : "推送失败") : "未配置 Telegram"}
            </span>
          </div>
          <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap bg-slate-950/60 border border-slate-800 rounded-lg p-3" data-testid="daily-report-text">{report.text.replace(/<\/?b>/g, "")}</pre>
        </div>
      )}

      <div className="glass rounded-xl p-5" data-testid="profit-trend-chart">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-slate-200">近 30 天收益趋势</div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-slate-500">{compareIds.length ? "各商户平台利润对比（USDT）" : "平台利润 vs 代理分润（USDT）"}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3" data-testid="trend-merchant-chips">
          <span className="text-[11px] text-slate-500 self-center mr-1">商户对比:</span>
          {merchants.slice(0, 12).map((m) => (
            <button key={m.id} onClick={() => toggleCompare(m.id)} data-testid={`compare-chip-${m.id}`}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${compareIds.includes(m.id) ? "border-cyan-400 text-cyan-300 bg-cyan-500/10" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
              {m.name}
            </button>
          ))}
          {compareIds.length > 0 && <button onClick={() => setCompareIds([])} data-testid="clear-compare-btn" className="text-[11px] px-2 py-1 text-slate-500 hover:text-slate-300">清除</button>}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          {compareIds.length === 0 ? (
            <AreaChart data={trend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="platGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={4} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0B1120", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="platform_profit" name="平台利润" stroke="#10B981" strokeWidth={2} fill="url(#platGrad)" />
              <Area type="monotone" dataKey="agent_commission" name="代理分润" stroke="#06B6D4" strokeWidth={2} fill="url(#commGrad)" />
            </AreaChart>
          ) : (
            <LineChart data={compareData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={4} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0B1120", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {compareIds.map((id, i) => (<Line key={id} type="monotone" dataKey={id} name={merchants.find((m) => m.id === id)?.name || id} stroke={COLORS[i % 5]} strokeWidth={2} dot={false} />))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">日期</th>
                <th className="py-3 px-3 font-medium text-right">订单数</th>
                <th className="py-3 px-3 font-medium text-right">收款总额</th>
                <th className="py-3 px-3 font-medium text-right">手续费</th>
                <th className="py-3 px-3 font-medium text-right">商户实收</th>
                <th className="py-3 px-3 font-medium text-right">代理分润</th>
                <th className="py-3 px-3 font-medium text-right">平台利润</th>
                <th className="py-3 px-3 font-medium">生成时间</th>
                <th className="py-3 px-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500">暂无快照，点击「生成快照」创建</td></tr>
              ) : rows.map((s) => (
                <Fragment key={s.id}>
                  <tr onClick={() => setExpanded(expanded === s.date ? null : s.date)} className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${s.platform_profit_change_pct != null && Math.abs(s.platform_profit_change_pct) >= 50 ? "bg-amber-500/5" : ""}`} data-testid={`snapshot-row-${s.date}`}>
                    <td className="py-3 px-3 font-mono text-slate-200 flex items-center gap-1">
                      {expanded === s.date ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      {s.date}{s.backfilled > 0 && <span className="ml-1 text-[10px] text-amber-400">补{s.backfilled}</span>}
                      {s.platform_profit_change_pct != null && Math.abs(s.platform_profit_change_pct) >= 50 && (
                        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${s.platform_profit_change_pct > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`} data-testid={`anomaly-${s.date}`} title="平台利润环比异常波动">{s.platform_profit_change_pct > 0 ? "▲" : "▼"} {Math.abs(s.platform_profit_change_pct)}%</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{s.order_count}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">{fmtUSDT(s.total_amount)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">{fmtUSDT(s.total_fee)}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">{fmtUSDT(s.total_merchant_receive)}</td>
                    <td className="py-3 px-3 text-right font-mono text-cyan-400">{fmtUSDT(s.total_agent_commission)}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(s.total_platform_profit)}</td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-500">{s.updated_at ? fmtDate(s.updated_at) : "—"}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); exportSnapshot(s.date); }} data-testid={`snapshot-export-${s.date}`} title="导出 Excel" className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-400/10"><FileSpreadsheet className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  {expanded === s.date && (
                    <tr className="bg-slate-950/40" data-testid={`snapshot-detail-${s.date}`}>
                      <td colSpan={9} className="px-6 py-3">
                        {(s.merchants || []).length === 0 ? <div className="text-xs text-slate-500">当日无商户收款</div> : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-500 text-left"><th className="py-1 pr-3">商户</th><th className="py-1 px-3 text-right">单数</th><th className="py-1 px-3 text-right">收款</th><th className="py-1 px-3 text-right">手续费</th><th className="py-1 px-3 text-right">实收</th><th className="py-1 px-3 text-right">代理分润</th><th className="py-1 px-3 text-right">平台利润</th></tr></thead>
                            <tbody>
                              {s.merchants.map((m) => (
                                <tr key={m.merchant_id} className="border-t border-slate-800/40">
                                  <td className="py-1 pr-3 text-slate-300">{m.merchant_name}</td>
                                  <td className="py-1 px-3 text-right font-mono">{m.orders}</td>
                                  <td className="py-1 px-3 text-right font-mono text-slate-300">{fmtUSDT(m.amount)}</td>
                                  <td className="py-1 px-3 text-right font-mono text-slate-400">{fmtUSDT(m.fee)}</td>
                                  <td className="py-1 px-3 text-right font-mono text-emerald-400">{fmtUSDT(m.receive)}</td>
                                  <td className="py-1 px-3 text-right font-mono text-cyan-400">{fmtUSDT(m.commission)}</td>
                                  <td className="py-1 px-3 text-right font-mono text-emerald-400">{fmtUSDT(m.platform)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
