import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, BarChart3, Trophy, FileText, ChevronRight } from "lucide-react";

export default function MerchantStatsPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("single");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const params = useCallback(() => (mode === "range" ? { start, end } : { date }), [mode, start, end, date]);

  useEffect(() => {
    setLoading(true);
    api.get("/stats/merchants", { params: params() })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(formatApiErrorDetail(err.response?.data?.detail)); });
  }, [params]);

  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get("/reports/merchant-stats", { params: params(), responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `merchant_stats.xlsx`; a.click(); URL.revokeObjectURL(url);
      toast.success("商户统计已导出");
    } catch { toast.error("导出失败"); } finally { setBusy(false); }
  };

  const drill = (m) => {
    const qs = mode === "range" ? `start=${start}&end=${end}` : `date=${date}`;
    navigate(`/orders?merchant_id=${m.id}&${qs}`);
  };

  const rows = data?.merchants || [];
  const totals = rows.reduce((a, m) => ({
    orders: a.orders + m.orders, paid: a.paid + m.paid, volume: a.volume + m.volume, fee: a.fee + m.fee,
  }), { orders: 0, paid: 0, volume: 0, fee: 0 });
  const totalSr = totals.orders ? Math.round(totals.paid / totals.orders * 1000) / 10 : 0;

  return (
    <div className="space-y-6" data-testid="merchant-stats-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6 text-cyan-400" /> 商户统计</h1>
          <p className="text-sm text-slate-400 mt-1">按日期或区间查看各商户收款表现，点击可下钻订单明细</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            <button onClick={() => setMode("single")} data-testid="mode-single" className={`px-3 py-1.5 text-sm ${mode === "single" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}>单日</button>
            <button onClick={() => setMode("range")} data-testid="mode-range" className={`px-3 py-1.5 text-sm ${mode === "range" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}>区间</button>
          </div>
          {mode === "single" ? (
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} data-testid="merchant-stats-date" className="bg-slate-900/60 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono text-slate-200" />
          ) : (
            <>
              <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} data-testid="merchant-stats-start" className="bg-slate-900/60 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono text-slate-200" />
              <span className="text-slate-500">~</span>
              <input type="date" value={end} max={today} onChange={(e) => setEnd(e.target.value)} data-testid="merchant-stats-end" className="bg-slate-900/60 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono text-slate-200" />
            </>
          )}
          <Button onClick={download} disabled={busy} variant="outline" data-testid="merchant-stats-export" className="border-slate-700 hover:bg-slate-800">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4 mr-1" /> 导出 Excel</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4" data-testid="mstat-total-orders"><div className="text-xs text-slate-400 mb-1">订单（全部商户）</div><div className="font-mono text-xl font-bold">{totals.orders} <span className="text-xs text-slate-500 font-normal">笔</span></div></div>
        <div className="glass rounded-xl p-4" data-testid="mstat-total-paid"><div className="text-xs text-slate-400 mb-1">成功收款</div><div className="font-mono text-xl font-bold text-emerald-400">{totals.paid} <span className="text-xs text-slate-500 font-normal">笔</span></div></div>
        <div className="glass rounded-xl p-4" data-testid="mstat-total-sr"><div className="text-xs text-slate-400 mb-1">整体成功率</div><div className="font-mono text-xl font-bold text-cyan-400">{totalSr}%</div></div>
        <div className="glass rounded-xl p-4" data-testid="mstat-total-vol"><div className="text-xs text-slate-400 mb-1">收款金额</div><div className="font-mono text-xl font-bold text-emerald-400">{fmtUSDT(totals.volume)} <span className="text-xs text-slate-500 font-normal">USDT</span></div></div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">#</th>
                <th className="py-3 px-3 font-medium">商户</th>
                <th className="py-3 px-3 font-medium text-right">订单</th>
                <th className="py-3 px-3 font-medium text-right">成功</th>
                <th className="py-3 px-3 font-medium text-right">成功率</th>
                <th className="py-3 px-3 font-medium text-right">收款金额</th>
                <th className="py-3 px-3 font-medium text-right">手续费</th>
                <th className="py-3 px-3 font-medium text-right">可用余额</th>
                <th className="py-3 px-3 font-medium text-right">明细</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500">暂无商户</td></tr>
              ) : rows.map((m, i) => (
                <tr key={m.id} onClick={() => drill(m)} className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer" data-testid={`mstat-row-${m.id}`}>
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {i < 3 && m.volume > 0 ? <Trophy className={`w-4 h-4 inline ${["text-amber-400", "text-slate-300", "text-amber-700"][i]}`} /> : i + 1}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-200">{m.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{m.email}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{m.orders}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">{m.paid}</td>
                  <td className="py-3 px-3 text-right font-mono text-cyan-400">{m.success_rate}%</td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(m.volume)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400">{fmtUSDT(m.fee)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{fmtUSDT(m.balance)}</td>
                  <td className="py-3 px-3 text-right"><ChevronRight className="w-4 h-4 text-slate-500 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
