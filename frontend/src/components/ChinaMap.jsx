import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";

const W = 760;
const H = 560;

/** 中国省份访客热力图（SVG + d3-geo，数据：[{name, count}]，name 为省级短名） */
export const ChinaMap = ({ provinces }) => {
  const [geo, setGeo] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    fetch("/geo/china.json").then((r) => r.json()).then(setGeo).catch(() => setGeo(null));
  }, []);

  const counts = useMemo(() => Object.fromEntries((provinces || []).map((p) => [p.name, p.count])), [provinces]);
  const max = Math.max(1, ...(provinces || []).map((p) => p.count));

  const path = useMemo(() => {
    if (!geo) return null;
    // 固定中心与比例（不依赖 fitSize，避免个别图形方向异常导致整体缩小）
    const projection = geoMercator().center([104.5, 36.5]).scale(640).translate([W / 2, H / 2]);
    return geoPath(projection);
  }, [geo]);

  const countOf = (feature) => {
    const name = feature.properties.name || "";
    const key = Object.keys(counts).find((k) => name.startsWith(k));
    return key ? counts[key] : 0;
  };

  const fillFor = (n) => {
    if (!n) return "rgba(148, 163, 184, 0.10)";
    const t = Math.min(1, Math.log(n + 1) / Math.log(max + 1));
    // 从暗金到亮金
    const alpha = 0.25 + t * 0.75;
    return `rgba(${Math.round(212 + (255 - 212) * t)}, ${Math.round(175 + (232 - 175) * t)}, ${Math.round(55 + (150 - 55) * t)}, ${alpha})`;
  };

  if (!geo || !path) {
    return <div className="flex h-72 items-center justify-center text-xs text-slate-500">地图加载中…</div>;
  }

  return (
    <div className="relative" data-testid="china-map">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="各省访客分布">
        {geo.features.map((f) => {
          const n = countOf(f);
          const name = f.properties.name;
          const active = hover?.name === name;
          return (
            <path
              key={name}
              d={path(f)}
              fill={fillFor(n)}
              stroke={active ? "#FFE896" : "rgba(212,175,55,0.45)"}
              strokeWidth={active ? 1.6 : 0.6}
              className="cursor-pointer transition-[fill,stroke] duration-200"
              onMouseEnter={() => setHover({ name, n })}
              onMouseLeave={() => setHover(null)}
              data-testid={`map-province-${name}`}
            >
              <title>{`${name}：${n} 位访客`}</title>
            </path>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-amber-500/30 bg-[#060B18]/90 px-4 py-2 text-xs backdrop-blur-sm" data-testid="map-tooltip">
          <div className="font-bold text-slate-100">{hover.name}</div>
          <div className="text-[#E5C158]">{hover.n} 位独立访客</div>
        </div>
      )}
      <div className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] text-slate-500">
        少
        <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.25), rgba(255,232,150,1))" }} />
        多
      </div>
    </div>
  );
};
