import { MapPin, AlertTriangle } from "lucide-react";

export const GeoLabel = ({ geo, detail }) => {
  if (!geo || !geo.label) return null;
  const unusual = !!(detail && detail.new_location);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] whitespace-nowrap ${unusual ? "text-amber-300" : "text-slate-400"}`} title={geo.isp ? `ISP: ${geo.isp}` : undefined} data-testid="geo-label">
      {unusual ? <AlertTriangle className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}{geo.label}{unusual && <span className="ml-0.5 px-1 rounded bg-amber-400/15 border border-amber-400/30">异常位置</span>}
    </span>
  );
};
