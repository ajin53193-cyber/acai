import { useEffect, useState, useCallback, Fragment } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PieChart, Loader2, Play, ChevronDown, ChevronRight } from "lucide-react";

export default function ProfitSnapshotsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);
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

  return (
    <div className="space-y-6" data-testid="profit-snapshots-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><PieChart className="w-6 h-6 text-cyan-400" /> 分润快照</h1>
          <p className="text-sm text-slate-400 mt-1">每日日终自动对账快照（分润实时入账，此处为按商户/代理/平台的日度汇总与兜底补偿）</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="snapshot-date-input" className="w-[150px] bg-slate-900/60 border-slate-700 font-mono" />
          <Button onClick={runNow} disabled={busy} data-testid="snapshot-run-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-1" /> 生成快照</>}
          </Button>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">暂无快照，点击「生成快照」创建</td></tr>
              ) : rows.map((s) => (
                <Fragment key={s.id}>
                  <tr onClick={() => setExpanded(expanded === s.date ? null : s.date)} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer" data-testid={`snapshot-row-${s.date}`}>
                    <td className="py-3 px-3 font-mono text-slate-200 flex items-center gap-1">
                      {expanded === s.date ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      {s.date}{s.backfilled > 0 && <span className="ml-1 text-[10px] text-amber-400">补{s.backfilled}</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{s.order_count}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">{fmtUSDT(s.total_amount)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">{fmtUSDT(s.total_fee)}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">{fmtUSDT(s.total_merchant_receive)}</td>
                    <td className="py-3 px-3 text-right font-mono text-cyan-400">{fmtUSDT(s.total_agent_commission)}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(s.total_platform_profit)}</td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-500">{s.updated_at ? fmtDate(s.updated_at) : "—"}</td>
                  </tr>
                  {expanded === s.date && (
                    <tr className="bg-slate-950/40" data-testid={`snapshot-detail-${s.date}`}>
                      <td colSpan={8} className="px-6 py-3">
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
