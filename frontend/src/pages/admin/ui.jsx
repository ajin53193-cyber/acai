import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { tr } from "@/i18n";

export const Card = ({ children, className = "", ...rest }) => <div {...rest} className={`bg-white rounded-2xl border border-slate-200 ${className}`}>{children}</div>;
export const Btn = ({ children, kind = "primary", className = "", ...p }) => {
  const k = { primary: "bg-orange-500 hover:bg-orange-600 text-white", ghost: "bg-slate-100 hover:bg-slate-200 text-slate-700", danger: "bg-red-50 hover:bg-red-100 text-red-600", ok: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" }[kind];
  return <button {...p} className={`h-9 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50 transition-colors ${k} ${className}`}>{children}</button>;
};
export const Input = (p) => <input {...p} className={`h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 ${p.className || ""}`} />;
export const Pill = ({ children, tone = "slate" }) => <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold bg-${tone}-100 text-${tone}-600`}>{children}</span>;
export const Table = ({ cols, rows, render, empty, testId, stickyLast = false }) => (
  <Card className={`overflow-x-auto ${stickyLast ? "[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:bg-white [&_td:last-child]:shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.25)]" : ""}`}>
    <table className="w-full text-sm" data-testid={testId}>
      <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{cols.map((c, i) => <th key={typeof c === "string" ? c : i} className={`px-4 py-3 font-semibold whitespace-nowrap ${stickyLast && i === cols.length - 1 ? "sticky right-0 bg-slate-50" : ""}`}>{c}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-slate-400">{empty || tr("暫無資料")}</td></tr> : rows.map(render)}</tbody>
    </table>
  </Card>
);
export const Head = ({ title, sub, right }) => <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div><h1 className="font-head text-xl md:text-2xl font-bold text-slate-900">{title}</h1>{sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div><div className="flex items-center gap-2">{right}</div></div>;

export function Modal({ title, onClose, children, footer, testId }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div data-testid={testId} className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white"><h3 className="font-head font-bold text-slate-900">{title}</h3><button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 text-lg leading-none">×</button></div>
        <div className="p-5 space-y-3">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">{footer}</div>}
      </div>
    </div>
  );
}
export const Field = ({ label, children }) => <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span><div className="mt-1">{children}</div></label>;
export const fmt = (s) => (s ? s.slice(0, 16).replace("T", " ") : "-");

export const TONES = ["slate", "sky", "emerald", "amber", "violet", "rose", "red", "orange", "teal", "indigo"];
export const toneCls = (c) => ({ slate: "bg-slate-100 text-slate-600", sky: "bg-sky-100 text-sky-700", emerald: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", violet: "bg-violet-100 text-violet-700", rose: "bg-rose-100 text-rose-700", red: "bg-red-100 text-red-600", orange: "bg-orange-100 text-orange-700", teal: "bg-teal-100 text-teal-700", indigo: "bg-indigo-100 text-indigo-700" }[c] || "bg-slate-100 text-slate-600");
export const toneSolid = (c) => ({ slate: "bg-slate-500", sky: "bg-sky-500", emerald: "bg-emerald-500", amber: "bg-amber-500", violet: "bg-violet-500", rose: "bg-rose-500", red: "bg-red-500", orange: "bg-orange-500", teal: "bg-teal-500", indigo: "bg-indigo-500" }[c] || "bg-slate-500");
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

