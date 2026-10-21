import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Eye, Users, MousePointerClick, Bot } from "lucide-react";
import { API, formatDetail } from "@/lib/api";
import { ChinaMap } from "@/components/ChinaMap";
import { sourceLabel } from "@/lib/source";

const todayStr = () => {
  // 按中国时区(UTC+8)取当天日期，与后端统计口径一致
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

const RANGES = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
];

const Metric = ({ icon: Icon, label, value, hint, testid }) => (
  <div className="glass-card rounded-2xl p-5" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs tracking-widest text-slate-400">
      <Icon size={14} className="text-[#E5C158]" /> {label}
    </div>
    <div className="mt-2 font-display text-3xl font-black text-gold-gradient">{value}</div>
    {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
  </div>
);

const RankCard = ({ title, items, nameKey = "name", valueKey = "visits", subKey = "uv", subLabel = "独立IP", mapName, testid }) => {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  return (
    <div className="glass-card rounded-2xl p-6" data-testid={testid}>
      <h3 className="font-display text-base font-bold text-gold-gradient">{title}</h3>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">暂无数据</div>
      ) : (
        <div className="mt-5 space-y-3.5">
          {items.map((it, idx) => (
            <div key={idx} className="text-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="truncate pr-2 text-slate-300">{mapName ? mapName(it[nameKey]) : it[nameKey]}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  <span className="font-bold text-[#E5C158]">{it[valueKey]}</span> 次 · {it[subKey]} {subLabel}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gold-gradient transition-all duration-700" style={{ width: `${(it[valueKey] / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function PromoAnalytics({ token, onUnauthorized }) {
  const [promos, setPromos] = useState([]);
  const [slug, setSlug] = useState("about");
  const [days, setDays] = useState(30);
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/admin/promos`, { headers })
      .then((res) => {
        const list = (res.data.promos || []).map((p) => ({ slug: p.slug, title: p.title }));
        setPromos(list);
        if (list.length && !list.find((p) => p.slug === "about")) setSlug(list[0].slug);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/promos/${slug}/analytics`, { headers, params: { days, date } });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized?.();
      else toast.error(formatDetail(err.response?.data?.detail) || "加载失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, days, date]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const maxDaily = Math.max(1, ...(data?.daily || []).map((d) => d.pv));

  return (
    <div data-testid="promo-analytics">
      {/* 筛选条 */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">选择推文</label>
          <select
            data-testid="promo-analytics-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-xl border border-amber-500/20 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]/60"
          >
            {promos.map((p) => <option key={p.slug} value={p.slug}>{p.title}（/p/{p.slug}）</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">时间范围</label>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.days}
                data-testid={`promo-analytics-range-${r.days}`}
                onClick={() => setDays(r.days)}
                className={`rounded-full px-4 py-2 text-sm transition-all ${days === r.days ? "bg-gold-gradient text-[#060B18]" : "border border-amber-500/20 text-slate-300 hover:text-[#FFE896]"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs tracking-widest text-slate-400">IP 明细日期</label>
          <input
            type="date"
            data-testid="promo-analytics-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-amber-500/20 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-[#D4AF37]/60"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : s ? (
        <div className="space-y-6">
          {/* 汇总卡片 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric icon={Eye} label={`访问量（近${data.days}天）`} value={s.views} hint="总浏览次数 PV" testid="promo-metric-views" />
            <Metric icon={Users} label="去重访问 IP（UV）" value={s.unique_ips} hint="已排除爬虫" testid="promo-metric-uv" />
            <Metric icon={MousePointerClick} label="按钮点击" value={s.clicks} hint={`${s.click_unique_ips} 个独立 IP 点击`} testid="promo-metric-clicks" />
            <Metric icon={Bot} label="已过滤爬虫" value={s.bots_excluded} hint="UA/数据中心/代理" testid="promo-metric-bots" />
          </div>

          {/* 每日趋势 */}
          <div className="glass-card rounded-2xl p-6" data-testid="promo-daily">
            <h3 className="font-display text-base font-bold text-gold-gradient">每日访问趋势</h3>
            <div className="mt-5 flex items-end gap-1 overflow-x-auto" style={{ height: 160 }}>
              {(data.daily || []).map((d) => (
                <div key={d.date} className="group flex min-w-[20px] flex-1 flex-col items-center justify-end" title={`${d.date}｜访问 ${d.pv} · 去重IP ${d.uv} · 点击 ${d.clicks}`}>
                  <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: 130 }}>
                    <div className="w-1/2 rounded-t bg-[#D4AF37]/40 transition-all" style={{ height: `${(d.pv / maxDaily) * 100}%` }} />
                    <div className="w-1/2 rounded-t bg-gold-gradient transition-all" style={{ height: `${(d.uv / maxDaily) * 100}%` }} />
                  </div>
                  <span className="mt-1 whitespace-nowrap text-[9px] text-slate-500">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#D4AF37]/40" /> 访问量 PV</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold-gradient" /> 去重 IP（UV）</span>
            </div>
          </div>

          {/* 来源渠道（A链接）+ 来源网站 */}
          <div className="grid gap-4 md:grid-cols-2">
            <RankCard title="来源渠道（A 链接 ?from=）" items={data.sources} mapName={sourceLabel} testid="promo-sources" />
            <RankCard title="来源网站（referrer）" items={data.referrers} testid="promo-referrers" />
          </div>

          {/* 按钮点击分布 */}
          <RankCard title="引导按钮点击分布" items={data.targets} valueKey="clicks" subKey="uv" subLabel="独立IP" testid="promo-targets" />

          {/* 省份分布地图 */}
          <div className="glass-card rounded-2xl p-6" data-testid="promo-provinces">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-gold-gradient">访客地区分布</h3>
              <span className="text-xs text-slate-500">
                共 <span className="font-bold text-[#E5C158]">{data.provinces.total}</span> 位独立访客
                {data.provinces.unknown > 0 && <span className="ml-2 text-slate-600">（{data.provinces.unknown} 位未识别省份）</span>}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <ChinaMap provinces={data.provinces.provinces} />
              <div>
                <div className="mb-2 text-xs tracking-widest text-slate-500">省份排行 TOP 10</div>
                {data.provinces.provinces.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">暂无数据</div>
                ) : (
                  <ul className="space-y-2">
                    {data.provinces.provinces.slice(0, 10).map((p, i) => (
                      <li key={p.name} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-xs text-slate-500">{i + 1}</span>
                        <span className="w-14 text-slate-300">{p.name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${Math.max(4, (p.count / data.provinces.provinces[0].count) * 100)}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs text-[#E5C158]">{p.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* 指定日 IP 明细（去重） */}
          <div className="glass-card rounded-2xl p-6" data-testid="promo-ip-detail">
            <h3 className="font-display text-base font-bold text-gold-gradient">{data.detail_date} 访问 IP 明细（去重 · 已排除爬虫）</h3>
            {data.ip_detail.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">该日暂无访问数据</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-500/10 text-left text-xs tracking-widest text-slate-500">
                      <th className="py-2.5 pr-3">IP 地址</th>
                      <th className="py-2.5 pr-3">地区</th>
                      <th className="py-2.5 pr-3">来源渠道</th>
                      <th className="py-2.5 pr-3">来源网站</th>
                      <th className="py-2.5 pr-3">设备</th>
                      <th className="py-2.5 pr-3">访问</th>
                      <th className="py-2.5 pr-3">点击</th>
                      <th className="py-2.5 pr-3">首次</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ip_detail.map((r) => (
                      <tr key={r.ip} className="border-b border-amber-500/5">
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-200">{r.ip}</td>
                        <td className="py-2.5 pr-3 text-slate-300">{r.region || "—"}</td>
                        <td className="py-2.5 pr-3 text-slate-400">{r.source ? sourceLabel(r.source) : "—"}</td>
                        <td className="py-2.5 pr-3 text-slate-400">{r.referrer || "—"}</td>
                        <td className="py-2.5 pr-3 text-slate-400">{r.device} · {r.browser}</td>
                        <td className="py-2.5 pr-3 text-[#E5C158]">{r.views}</td>
                        <td className="py-2.5 pr-3 text-[#E5C158]">{r.clicks}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{r.first_seen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-xs text-slate-500">共 {data.ip_detail.length} 个独立 IP</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-sm text-slate-500">暂无数据</div>
      )}
    </div>
  );
}
