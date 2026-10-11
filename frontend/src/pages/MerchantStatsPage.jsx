import { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtUSDT } from "@/lib/format";
import { Loader2, BarChart3, Trophy, Wallet } from "lucide-react";

export default function MerchantStatsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/stats/merchants", { params: { date } })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

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
          <p className="text-sm text-slate-400 mt-1">按日期查看每个商户的收款表现、成功率与余额</p>
        </div>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} data-testid="merchant-stats-date" className="bg-slate-900/60 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono text-slate-200" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4" data-testid="mstat-total-orders"><div className="text-xs text-slate-400 mb-1">当日订单（全部商户）</div><div className="font-mono text-xl font-bold">{totals.orders} <span className="text-xs text-slate-500 font-normal">笔</span></div></div>
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
                <th className="py-3 px-3 font-medium text-right">当日订单</th>
                <th className="py-3 px-3 font-medium text-right">成功</th>
                <th className="py-3 px-3 font-medium text-right">成功率</th>
                <th className="py-3 px-3 font-medium text-right">收款金额</th>
                <th className="py-3 px-3 font-medium text-right">手续费</th>
                <th className="py-3 px-3 font-medium text-right">可用余额</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">暂无商户</td></tr>
              ) : rows.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`mstat-row-${m.id}`}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
