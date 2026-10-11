import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, STATUS_MAP, NETWORK_COLORS, fmtDate } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Receipt, CheckCircle2, Network, Clock, Wallet, Loader2,
} from "lucide-react";

const StatCard = ({ icon: Icon, label, value, unit, accent, delay, testid }) => (
  <div
    className="glass rounded-xl p-5 fade-up relative overflow-hidden"
    style={{ animationDelay: `${delay}ms` }}
    data-testid={testid}
  >
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20 ${accent}`} />
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-slate-400">{label}</span>
      <Icon className="w-4 h-4 text-slate-500" />
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-2xl font-bold tracking-tight">{value}</span>
      {unit && <span className="text-xs text-slate-500 font-mono">{unit}</span>}
    </div>
  </div>
);

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <div className="text-slate-400 mb-1 font-mono">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.dataKey === "volume" ? "交易量" : "订单数"}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {p.dataKey === "volume" ? fmtUSDT(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const [statDate, setStatDate] = useState(today);

  const load = () => {
    api.get("/dashboard/stats", { params: { date: statDate } }).then((r) => setStats(r.data)).catch(() => {});
    api.get("/orders", { params: { limit: 8 } }).then((r) => setOrders(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statDate]);

  if (!stats)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据总览</h1>
        <p className="text-sm text-slate-400 mt-1">实时监控收款流水、通道状态与结算数据</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="今日交易量" value={fmtUSDT(stats.today_volume)} unit="USDT" accent="bg-cyan-500" delay={0} testid="stat-today-volume" />
        <StatCard icon={Receipt} label="累计订单" value={stats.total_orders} unit="笔" accent="bg-sky-500" delay={60} testid="stat-total-orders" />
        <StatCard icon={CheckCircle2} label="支付成功率" value={stats.success_rate} unit="%" accent="bg-emerald-500" delay={120} testid="stat-success-rate" />
        <StatCard icon={Wallet} label={stats.profit_label} value={fmtUSDT(stats.profit)} unit="USDT" accent="bg-emerald-500" delay={180} testid="stat-profit" />
      </div>

      {user.role !== "agent" && (
        <div className="space-y-3" data-testid="daily-stats-section">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-200">每日收款统计{statDate !== today && <span className="ml-2 text-xs text-cyan-400 font-mono">{statDate}</span>}</h2>
            <input type="date" value={statDate} max={today} onChange={(e) => setStatDate(e.target.value || today)} data-testid="daily-stat-date" className="bg-slate-900/60 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-200" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4" data-testid="stat-today-orders"><div className="text-xs text-slate-400 mb-1">当日订单数</div><div className="font-mono text-xl font-bold">{stats.today_orders ?? 0} <span className="text-xs text-slate-500 font-normal">笔</span></div></div>
            <div className="glass rounded-xl p-4" data-testid="stat-today-paid"><div className="text-xs text-slate-400 mb-1">当日成功收款</div><div className="font-mono text-xl font-bold text-emerald-400">{stats.today_paid ?? 0} <span className="text-xs text-slate-500 font-normal">笔</span></div></div>
            <div className="glass rounded-xl p-4" data-testid="stat-today-success"><div className="text-xs text-slate-400 mb-1">当日成功率</div><div className="font-mono text-xl font-bold text-cyan-400">{stats.today_success_rate ?? 0}%</div></div>
            <div className="glass rounded-xl p-4" data-testid="stat-today-vol"><div className="text-xs text-slate-400 mb-1">当日收款金额</div><div className="font-mono text-xl font-bold text-emerald-400">{fmtUSDT(stats.today_volume)} <span className="text-xs text-slate-500 font-normal">USDT</span></div></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5 fade-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">近 7 日交易趋势</h2>
            <span className="text-xs text-slate-500 font-mono">USDT</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="volume" stroke="#06B6D4" strokeWidth={2} fill="url(#volGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5 fade-up" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">订单数量</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
              <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400">待支付订单</div>
            <div className="font-mono text-lg font-bold">{stats.pending_orders}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400">活跃通道</div>
            <div className="font-mono text-lg font-bold">{stats.active_channels}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400">累计交易量</div>
            <div className="font-mono text-lg font-bold">{fmtUSDT(stats.total_volume)}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400">可用余额</div>
            <div className="font-mono text-lg font-bold">{fmtUSDT(stats.balance)}</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5 fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">实时订单流水</h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" /> 自动刷新
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2.5 px-3 font-medium">订单号</th>
                <th className="py-2.5 px-3 font-medium">商户</th>
                <th className="py-2.5 px-3 font-medium">网络</th>
                <th className="py-2.5 px-3 font-medium text-right">金额</th>
                <th className="py-2.5 px-3 font-medium">状态</th>
                <th className="py-2.5 px-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
                return (
                  <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-300">{o.order_no}</td>
                    <td className="py-2.5 px-3">{o.merchant_name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${NETWORK_COLORS[o.network]}`}>{o.network}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmtUSDT(o.amount_usdt)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${s.bg} ${s.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500 font-mono">{fmtDate(o.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
