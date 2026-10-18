import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ShoppingBag, Wallet, Users, Package, Clock, Landmark, BadgeCheck, MessageSquare, ArrowRight, Star, Smartphone } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { Card, Head, Pill, fmt } from "@/pages/admin/ui";
import { STATUS_LABELS, StatusBadge } from "@/lib/status";
import { tr } from "@/i18n";

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#f59e0b", "#84cc16", "#06b6d4", "#8b5cf6", "#ec4899"];
const RANGES = [[7, tr("近 7 天")], [30, tr("近 30 天")], [90, tr("近 90 天")]];
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TOPUP_LABEL = { pending: tr("待付款"), reviewing: tr("待審核"), paid: tr("已到帳"), rejected: tr("已駁回"), expired: tr("已過期"), cancelled: tr("已取消"), failed: tr("失敗") };
const TOPUP_TONE = { pending: "orange", reviewing: "sky", paid: "emerald", rejected: "red", expired: "slate", cancelled: "slate", failed: "red" };

function Delta({ cur, prev }) {
  if (!prev) return <span className="text-[11px] text-slate-400">{tr("上期無資料")}</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{up ? "+" : ""}{pct.toFixed(1)}% <span className="text-slate-400 font-normal">{tr("vs 上期")}</span></span>;
}

const Kpi = ({ icon: Icon, label, value, sub, color, testId }) => (
  <Card className="p-5 relative overflow-hidden" data-testid={testId}>
    <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${color}`} />
    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${color}`}><Icon className="h-4.5 w-4.5" /></div>
    <div className="font-head text-2xl font-extrabold text-slate-900 mt-3">{value}</div>
    <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    <div className="mt-1.5">{sub}</div>
  </Card>
);

const Todo = ({ icon: Icon, label, n, onClick, testId, alert }) => (
  <button data-testid={testId} onClick={onClick} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${n > 0 ? (alert ? "bg-red-50 border-red-200 hover:bg-red-100 animate-pulse" : "bg-orange-50 border-orange-200 hover:bg-orange-100") : "bg-white border-slate-200 hover:border-orange-200"}`}>
    <Icon className={`h-5 w-5 ${n > 0 ? (alert ? "text-red-500" : "text-orange-500") : "text-slate-400"}`} />
    <div className="flex-1"><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-lg font-bold ${n > 0 ? (alert ? "text-red-600" : "text-orange-600") : "text-slate-800"}`}>{n}</div></div>
    <ArrowRight className="h-4 w-4 text-slate-300" />
  </button>
);

const SOURCE_LABEL = { popup: tr("首訪海報彈窗"), auto: tr("首訪自動彈窗"), tip: tr("首訪提示條"), drawer: tr("側欄選單"), "detail-banner": tr("商品頁橫幅"), carousel: tr("輪播圖"), unknown: tr("其他") };
function A2HSStats({ callApi, days }) {
  const [a, setA] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: `/admin/a2hs/stats?days=${days}` }).then((r) => setA(r.data)).catch(() => {}); }, [callApi, days]);
  if (!a) return null;
  const series = a.series.map((r) => ({ ...r, label: r.date.slice(5) }));
  const stats = [[tr("提示條曝光"), a.tip_shown, "a2hs-stat-shown"], [tr("提示條點擊"), a.tip_open, "a2hs-stat-open"], [tr("點擊率"), `${a.tip_ctr}%`, "a2hs-stat-ctr"], [tr("教學彈窗打開"), a.dialog_open, "a2hs-stat-dialog"], [tr("桌面 App 啟動次數"), a.pwa_launch, "a2hs-stat-launch"]];
  return (
    <Card className="p-5 mb-4" data-testid="a2hs-stats">
      <div className="flex items-center justify-between mb-3"><div className="font-semibold text-slate-800 flex items-center gap-2"><Smartphone className="h-4 w-4 text-orange-500" />{tr("「添加到桌面」引導成效")}</div><span className="text-xs text-slate-400">{tr("近 {0} 天", a.days)}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {stats.map(([l, v, t]) => <div key={t} data-testid={t} className="rounded-xl bg-slate-50 px-4 py-3"><div className="text-xs text-slate-500">{l}</div><div className="font-head text-xl font-bold text-slate-900">{v}</div></div>)}
      </div>
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} /><YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="dialog_open" name={tr("教學打開")} fill="#f97316" radius={[4, 4, 0, 0]} /><Bar dataKey="pwa_launch" name={tr("App 啟動")} fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs space-y-3">
          <div><div className="font-semibold text-slate-700 mb-1">{tr("教學來源")}</div>{Object.keys(a.by_source).length === 0 ? <div className="text-slate-400">{tr("暫無資料")}</div> : Object.entries(a.by_source).sort((x, y) => y[1] - x[1]).map(([k, v]) => <div key={k} className="flex justify-between py-0.5"><span className="text-slate-600">{SOURCE_LABEL[k] || k}</span><b className="text-slate-800">{v}</b></div>)}</div>
          <div><div className="font-semibold text-slate-700 mb-1">{tr("平台")}</div>{Object.keys(a.by_platform).length === 0 ? <div className="text-slate-400">{tr("暫無資料")}</div> : Object.entries(a.by_platform).map(([k, v]) => <div key={k} className="flex justify-between py-0.5"><span className="text-slate-600 uppercase">{k}</span><b className="text-slate-800">{v}</b></div>)}</div>
        </div>
      </div>
    </Card>
  );
}

export function DashboardAdmin({ callApi, go }) {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: `/admin/dashboard?days=${days}` }).then((r) => setD(r.data)).catch(() => toast.error(tr("載入失敗"))); }, [callApi, days]);
  if (!d) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const { current: c, previous: p, totals: t } = d;
  const series = d.series.map((r) => ({ ...r, label: r.date.slice(5) }));
  const statusData = Object.keys(STATUS_LABELS).map((k) => ({ name: STATUS_LABELS[k], value: d.by_status[k] || 0 })).filter((x) => x.value > 0);

  return (
    <div data-testid="dashboard-admin">
      <Head title={tr("總覽儀表板")} sub={tr("營收、充值、用戶與訂單走勢一覽；點擊待辦可直接前往處理。")}
        right={<div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5">{RANGES.map(([k, l]) => <button key={k} data-testid={`dash-range-${k}`} onClick={() => setDays(k)} className={`h-8 px-3 rounded-md text-xs font-semibold ${days === k ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>)}</div>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Kpi testId="kpi-revenue" icon={TrendingUp} color="bg-orange-500" label={tr("期間營收 (USD)")} value={money(c.revenue_usd)} sub={<Delta cur={c.revenue_usd} prev={p.revenue_usd} />} />
        <Kpi testId="kpi-orders" icon={ShoppingBag} color="bg-sky-500" label={tr("期間訂單數")} value={c.orders} sub={<Delta cur={c.orders} prev={p.orders} />} />
        <Kpi testId="kpi-topup" icon={Wallet} color="bg-emerald-500" label={tr("期間充值到帳 (USD)")} value={money(c.topup_usd)} sub={<Delta cur={c.topup_usd} prev={p.topup_usd} />} />
        <Kpi testId="kpi-users" icon={Users} color="bg-violet-500" label={tr("新增用戶")} value={c.new_users} sub={<Delta cur={c.new_users} prev={p.new_users} />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <Todo testId="todo-bad-reviews" alert icon={Star} label={tr("差評待處理 (1-2★)")} n={t.bad_reviews || 0} onClick={() => { sessionStorage.setItem("reviews_preset", "bad"); go("reviews"); }} />
        <Todo testId="todo-dispatch" icon={Clock} label={tr("待處理訂單")} n={t.pending_dispatch} onClick={() => go("orders")} />
        <Todo testId="todo-topups" icon={Landmark} label={tr("待審核充值")} n={t.pending_topup_reviews} onClick={() => go("topups")} />
        <Todo testId="todo-verif" icon={BadgeCheck} label={tr("待審核認證")} n={t.pending_verifications} onClick={() => go("verifications")} />
        <Todo testId="todo-feedback" icon={MessageSquare} label={tr("待處理反饋")} n={t.open_feedback} onClick={() => go("feedback")} />
        <Card className="px-4 py-3"><div className="text-xs text-slate-500">{tr("會員錢包總餘額")}</div><div className="font-head text-lg font-bold text-slate-800">{money(t.wallet_balance_usd)}</div></Card>
        <Card className="px-4 py-3"><div className="text-xs text-slate-500">{tr("會員總數")}</div><div className="font-head text-lg font-bold text-slate-800">{t.users}</div></Card>
        <Card className="px-4 py-3"><div className="text-xs text-slate-500">{tr("上架商品")}</div><div className="font-head text-lg font-bold text-slate-800">{t.products}</div></Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 xl:col-span-2" data-testid="chart-revenue">
          <div className="font-semibold text-slate-800 mb-3">{tr("營收與充值走勢 (USD)")}</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.35} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v, n) => [money(v), n]} /><Legend />
              <Area type="monotone" dataKey="revenue_usd" name={tr("訂單營收")} stroke="#f97316" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="topup_usd" name={tr("充值到帳")} stroke="#10b981" fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5" data-testid="chart-status">
          <div className="font-semibold text-slate-800 mb-3">{tr("訂單狀態分佈")}</div>
          {statusData.length === 0 ? <div className="text-xs text-slate-400 py-16 text-center">{tr("暫無訂單")}</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">{Object.keys(STATUS_LABELS).map((k, i) => <div key={k} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[statusData.findIndex((x) => x.name === STATUS_LABELS[k]) % COLORS.length] || "#e2e8f0" }} />{STATUS_LABELS[k]}</span><b className="text-slate-800">{d.by_status[k] || 0}</b></div>)}</div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Card className="p-5" data-testid="chart-orders">
          <div className="font-semibold text-slate-800 mb-3">{tr("每日訂單數 / 新用戶")}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} /><YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="orders" name={tr("訂單")} fill="#f97316" radius={[4, 4, 0, 0]} /><Bar dataKey="new_users" name={tr("新用戶")} fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5" data-testid="chart-category">
          <div className="font-semibold text-slate-800 mb-3">{tr("分類營收 Top")}</div>
          {d.category_mix.length === 0 ? <div className="text-xs text-slate-400 py-16 text-center">{tr("暫無資料")}</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.category_mix} layout="vertical" margin={{ left: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} /><Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="usd" name="USD" fill="#fb923c" radius={[0, 4, 4, 0]}>{d.category_mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5" data-testid="chart-payment">
          <div className="font-semibold text-slate-800 mb-3">{tr("充值方式佔比")}</div>
          {d.payment_mix.length === 0 ? <div className="text-xs text-slate-400 py-16 text-center">{tr("暫無充值")}</div> : (<>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart><Pie data={d.payment_mix} dataKey="usd" nameKey="name" outerRadius={65}>{d.payment_mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-1">{d.payment_mix.map((m, i) => <div key={m.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{m.name}</span><span className="text-slate-800"><b>{money(m.usd)}</b> <span className="text-slate-400">· {m.count} {tr("筆")}</span></span></div>)}</div>
          </>)}
        </Card>
      </div>

      <A2HSStats callApi={callApi} days={days} />

      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2" data-testid="recent-orders">
          <div className="flex items-center justify-between mb-3"><div className="font-semibold text-slate-800">{tr("最近訂單")}</div><button onClick={() => go("orders")} className="text-xs text-orange-600 font-semibold">{tr("查看全部")} →</button></div>
          <div className="divide-y divide-slate-100">
            {d.recent_orders.map((o) => (
              <div key={o.id} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1"><div className="text-slate-800 truncate">{o.items.map((i) => `${i.product_name} ${i.spec_label}×${i.quantity}`).join("、")}</div><div className="text-[11px] text-slate-400 font-mono">{o.order_no} · {o.user_email} · {fmt(o.created_at)}</div></div>
                <div className="font-semibold text-slate-800 whitespace-nowrap">{money(o.total_usd)}</div><StatusBadge status={o.status} />
              </div>
            ))}
            {d.recent_orders.length === 0 && <div className="text-xs text-slate-400 py-6 text-center">{tr("暫無訂單")}</div>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5" data-testid="top-products">
            <div className="font-semibold text-slate-800 mb-3">{tr("熱銷商品 Top")}</div>
            <div className="space-y-2">
              {d.top_products.map((pr, i) => (
                <div key={pr.product_id} className="flex items-center gap-2.5 text-sm"><span className="text-[11px] font-bold text-slate-400 w-4">{i + 1}</span>{pr.image && <img src={pr.image} alt="" className="h-8 w-8 rounded-lg object-cover" />}<div className="min-w-0 flex-1"><div className="truncate text-slate-800 text-xs">{pr.name}</div><div className="text-[11px] text-slate-400">{tr("售出")} {pr.qty}</div></div><b className="text-xs text-slate-800">{money(pr.revenue_usd)}</b></div>
              ))}
              {d.top_products.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">{tr("暫無資料")}</div>}
            </div>
          </Card>
          <Card className="p-5" data-testid="recent-topups">
            <div className="flex items-center justify-between mb-3"><div className="font-semibold text-slate-800">{tr("最近充值")}</div><button onClick={() => go("topups")} className="text-xs text-orange-600 font-semibold">{tr("查看全部")} →</button></div>
            <div className="space-y-2">{d.recent_topups.map((x) => <div key={x.id} className="flex items-center gap-2 text-xs"><span className="text-slate-500 w-24 truncate">{x.method_name || x.provider || "USDT"}</span><b className="text-slate-800">{money(x.amount_usd)}</b><span className="ml-auto text-slate-400">{fmt(x.created_at).slice(5)}</span><Pill tone={TOPUP_TONE[x.status] || "slate"}>{TOPUP_LABEL[x.status] || x.status}</Pill></div>)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
