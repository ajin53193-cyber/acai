import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { BarChart3, Eye, Users, Globe, Search } from "lucide-react";
import { API } from "@/lib/api";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ShareCard = ({ title, items, total, testid }) => (
  <div className="glass-card rounded-2xl p-6" data-testid={testid}>
    <h3 className="font-display text-base font-bold text-gold-gradient">{title}</h3>
    {items.length === 0 ? (
      <div className="py-8 text-center text-xs text-slate-500">暂无数据</div>
    ) : (
      <div className="mt-5 space-y-3.5">
        {items.map((it) => (
          <div key={it.name} className="text-sm">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-slate-300">{it.name}</span>
              <span className="text-xs text-slate-400">
                {it.count} 次 · <span className="font-bold text-[#E5C158]">{total ? Math.round((it.count / total) * 100) : 0}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gold-gradient transition-all duration-700"
                style={{ width: `${total ? (it.count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default function StatsAdmin({ token, onUnauthorized }) {
  const [date, setDate] = useState(todayStr());
  const [overview, setOverview] = useState(null);
  const [daily, setDaily] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, d, v] = await Promise.all([
        axios.get(`${API}/admin/stats/overview`, { headers, params: { date } }),
        axios.get(`${API}/admin/stats/daily`, { headers, params: { days: 14 } }),
        axios.get(`${API}/admin/stats/visits`, { headers, params: { date } }),
      ]);
      setOverview(o.data);
      setDaily(d.data.days);
      setVisits(v.data.visits);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const maxVisits = Math.max(1, ...daily.map((d) => d.visits));

  return (
    <div className="space-y-6" data-testid="admin-stats">
      <div className="glass-card flex flex-wrap items-end gap-4 rounded-2xl p-5">
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">查询日期</label>
          <input
            type="date"
            data-testid="stats-date-input"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none [color-scheme:dark] focus:border-[#D4AF37]/60"
          />
        </div>
        <button
          data-testid="stats-query-btn"
          onClick={load}
          className="flex items-center gap-2 rounded-full bg-gold-gradient px-6 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95"
        >
          <Search size={15} /> {loading ? "查询中…" : "查询"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[
          { icon: Eye, label: "访问量", value: overview?.visits ?? "—", testid: "stats-visits-card" },
          { icon: Users, label: "独立IP", value: overview?.unique_ips ?? "—", testid: "stats-ips-card" },
          { icon: Globe, label: "覆盖地区", value: new Set(visits.map((v) => v.region)).size, testid: "stats-regions-card" },
          { icon: BarChart3, label: "访问页面", value: new Set(visits.map((v) => v.path)).size, testid: "stats-pages-card" },
        ].map((c) => (
          <div key={c.label} className="glass-card rounded-2xl p-6" data-testid={c.testid}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158]">
              <c.icon size={18} />
            </div>
            <div className="mt-4 font-display text-3xl font-black text-gold-gradient">{c.value}</div>
            <div className="mt-1 text-xs tracking-widest text-slate-400">{c.label}（{date}）</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ShareCard title={`设备类型占比（${date}）`} items={overview?.devices || []} total={overview?.visits || 0} testid="stats-devices-card" />
        <ShareCard title={`浏览器占比（${date}）`} items={overview?.browsers || []} total={overview?.visits || 0} testid="stats-browsers-card" />
      </div>

      <div className="glass-card rounded-2xl p-6" data-testid="stats-daily-chart">
        <h3 className="font-display text-base font-bold text-gold-gradient">近 14 天访问趋势</h3>
        <div className="mt-6 flex h-40 items-end gap-2">
          {daily.map((d) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-2">
              <div className="text-[10px] text-[#E5C158] opacity-0 transition-opacity group-hover:opacity-100">{d.visits}</div>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#997316]/60 to-[#FFE896] transition-all duration-500 group-hover:shadow-[0_0_16px_rgba(212,175,55,0.5)]"
                style={{ height: `${Math.max(3, (d.visits / maxVisits) * 120)}px` }}
                title={`${d.date}：${d.visits} 次访问 / ${d.unique_ips} 个IP`}
              />
              <div className="text-[9px] text-slate-500">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      {overview && overview.top_pages.length > 0 && (
        <div className="glass-card rounded-2xl p-6" data-testid="stats-top-pages">
          <h3 className="font-display text-base font-bold text-gold-gradient">热门页面（{date}）</h3>
          <div className="mt-4 space-y-2.5">
            {overview.top_pages.map((p) => (
              <div key={p.path} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-slate-300">{p.path}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gold-gradient"
                    style={{ width: `${(p.count / overview.top_pages[0].count) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[#E5C158]">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-2xl" data-testid="stats-visit-table">
        <h3 className="border-b border-amber-500/10 p-6 font-display text-base font-bold text-gold-gradient">
          访问明细（{date}，最近 {visits.length} 条）
        </h3>
        {visits.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500">该日期暂无访问记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-500/10 text-left text-xs tracking-widest text-slate-500">
                  <th className="px-6 py-3 font-medium">时间</th>
                  <th className="px-6 py-3 font-medium">IP 地址</th>
                  <th className="px-6 py-3 font-medium">IP 地区</th>
                  <th className="px-6 py-3 font-medium">访问页面</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, i) => (
                  <tr key={v.id} className="border-b border-amber-500/5 text-slate-300 transition-colors hover:bg-amber-500/5" data-testid={`stats-visit-row-${i}`}>
                    <td className="px-6 py-3 text-slate-400">{new Date(v.created_at).toLocaleTimeString("zh-CN", { hour12: false })}</td>
                    <td className="px-6 py-3 font-mono text-xs">{v.ip}</td>
                    <td className="px-6 py-3 text-[#E5C158]">{v.region}</td>
                    <td className="px-6 py-3">{v.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
