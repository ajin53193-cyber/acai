import { useCallback, useEffect, useState } from "react";
import { fmtBJ, bjToday } from "@/lib/bjtime";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { tr } from "@/i18n";

export const Card = ({ children, className = "", ...rest }) => <div {...rest} className={`bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</div>;

const BTN_KIND = {
  primary: "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white border border-transparent",
  secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent",
  danger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-transparent",
  ok: "bg-emerald-500 hover:bg-emerald-600 text-white border border-transparent",
};
const BTN_SIZE = { sm: "h-8 px-3 text-xs rounded-md", md: "h-9 px-4 text-xs rounded-lg", lg: "h-10 px-5 text-sm rounded-lg" };
export const Btn = ({ children, kind = "primary", size = "md", className = "", ...p }) => (
  <button {...p} className={`inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors disabled:opacity-50 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${BTN_KIND[kind] || BTN_KIND.primary} ${BTN_SIZE[size] || BTN_SIZE.md} ${className}`}>{children}</button>
);

export const Input = (p) => <input {...p} className={`h-9 rounded-lg bg-white border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 placeholder:text-slate-400 transition-colors ${p.className || ""}`} />;

export const Pill = ({ children, tone = "slate", dot = false }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${pillTone(tone)}`}>
    {dot && <span className={`h-1.5 w-1.5 rounded-full ${toneSolid(tone)}`} />}{children}
  </span>
);

export const Table = ({ cols, rows, render, empty, testId, stickyLast = false }) => (
  <Card className={`overflow-x-auto ${stickyLast ? "[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:bg-white [&_td:last-child]:shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.25)]" : ""}`}>
    <table className="w-full text-sm" data-testid={testId}>
      <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50/80">{cols.map((c, i) => <th key={typeof c === "string" ? c : i} className={`px-4 py-3 whitespace-nowrap ${stickyLast && i === cols.length - 1 ? "sticky right-0 bg-slate-50" : ""}`}>{c}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-slate-400 text-sm">{empty || tr("暫無資料")}</td></tr> : rows.map(render)}</tbody>
    </table>
  </Card>
);

export const Head = ({ title, sub, right }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-200/70">
    <div><h1 className="font-head text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">{title}</h1>{sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div>
    {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
  </div>
);

export const StatCard = ({ label, value, sub, tone = "slate", icon: Icon }) => (
  <Card className="p-5 flex flex-col justify-between relative overflow-hidden hover:border-slate-300 transition-colors">
    <div className="text-xs font-medium text-slate-500 flex items-center justify-between">{label}{Icon && <Icon className={`h-4 w-4 ${toneText(tone)}`} />}</div>
    <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight mt-2">{value}</div>
    {sub && <div className="text-[11px] text-slate-500 mt-2 font-medium">{sub}</div>}
    <span className={`absolute left-0 top-0 h-full w-1 ${toneSolid(tone)}`} />
  </Card>
);

const MODAL_W = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-xl", xl: "max-w-2xl", "2xl": "max-w-3xl", "3xl": "max-w-4xl", full: "max-w-[1400px] w-[96vw]" };
export function Modal({ title, onClose, children, footer, testId, size = "sm", bare = false, className = "" }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div data-testid={testId} className={`relative bg-white rounded-xl w-full ${MODAL_W[size] || MODAL_W.sm} max-h-[90vh] shadow-2xl border border-slate-200 ${bare ? "overflow-hidden" : "overflow-y-auto"} ${className}`} onClick={(e) => e.stopPropagation()}>
        {bare ? children : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10"><h3 className="font-head font-bold text-slate-900">{title}</h3><button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 text-lg leading-none transition-colors">×</button></div>
            <div className="p-6 space-y-3">{children}</div>
            {footer && <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 sticky bottom-0">{footer}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span><div className="mt-1.5">{children}</div></label>;
export const fmt = (s) => (s ? fmtBJ(s, "minute") : "-");

export const TONES = ["slate", "sky", "emerald", "amber", "violet", "rose", "red", "orange", "teal", "indigo"];
export const toneCls = (c) => ({ slate: "bg-slate-100 text-slate-600", sky: "bg-sky-100 text-sky-700", emerald: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", violet: "bg-violet-100 text-violet-700", rose: "bg-rose-100 text-rose-700", red: "bg-red-100 text-red-600", orange: "bg-orange-100 text-orange-700", teal: "bg-teal-100 text-teal-700", indigo: "bg-indigo-100 text-indigo-700" }[c] || "bg-slate-100 text-slate-600");
export const pillTone = (c) => ({ slate: "bg-slate-50 text-slate-600 border-slate-200", sky: "bg-sky-50 text-sky-700 border-sky-200", emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", amber: "bg-amber-50 text-amber-700 border-amber-200", violet: "bg-violet-50 text-violet-700 border-violet-200", rose: "bg-rose-50 text-rose-700 border-rose-200", red: "bg-red-50 text-red-600 border-red-200", orange: "bg-orange-50 text-orange-700 border-orange-200", teal: "bg-teal-50 text-teal-700 border-teal-200", indigo: "bg-indigo-50 text-indigo-700 border-indigo-200" }[c] || "bg-slate-50 text-slate-600 border-slate-200");
export const toneSolid = (c) => ({ slate: "bg-slate-500", sky: "bg-sky-500", emerald: "bg-emerald-500", amber: "bg-amber-500", violet: "bg-violet-500", rose: "bg-rose-500", red: "bg-red-500", orange: "bg-orange-500", teal: "bg-teal-500", indigo: "bg-indigo-500" }[c] || "bg-slate-500");
export const toneText = (c) => ({ slate: "text-slate-500", sky: "text-sky-500", emerald: "text-emerald-500", amber: "text-amber-500", violet: "text-violet-500", rose: "text-rose-500", red: "text-red-500", orange: "text-orange-500", teal: "text-teal-500", indigo: "text-indigo-500" }[c] || "text-slate-500");

export const useLoad = (callApi, url, deps = []) => {
  const [data, setData] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url }).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, load, setData];
};

export const readFileB64 = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
export function ImgField({ value, onChange, hint, testId, ratio = "aspect-[3/1]" }) {
  return (
    <div>
      <label className={`block ${ratio} max-h-40 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer hover:border-orange-300 relative`}>
        {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1"><ImagePlus className="h-6 w-6" />{tr("點擊上傳圖片")}</span>}
        <input data-testid={testId} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await readFileB64(f)); }} />
      </label>
      <div className="flex items-center gap-2 mt-1.5">
        <Input className="flex-1 text-xs" placeholder={tr("或貼上圖片網址")} value={value?.startsWith("data:") ? "" : value || ""} onChange={(e) => onChange(e.target.value)} />
        {value && <button onClick={() => onChange("")} className="text-[11px] text-red-500 whitespace-nowrap">{tr("清除")}</button>}
      </div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
