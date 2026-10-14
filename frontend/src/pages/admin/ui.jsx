import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n";

export const Card = ({ children, className = "" }) => <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>{children}</div>;
export const Btn = ({ children, kind = "primary", className = "", ...p }) => {
  const k = { primary: "bg-orange-500 hover:bg-orange-600 text-white", ghost: "bg-slate-100 hover:bg-slate-200 text-slate-700", danger: "bg-red-50 hover:bg-red-100 text-red-600", ok: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" }[kind];
  return <button {...p} className={`h-9 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50 transition-colors ${k} ${className}`}>{children}</button>;
};
export const Input = (p) => <input {...p} className={`h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 ${p.className || ""}`} />;
export const Pill = ({ children, tone = "slate" }) => <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold bg-${tone}-100 text-${tone}-600`}>{children}</span>;
export const Table = ({ cols, rows, render, empty, testId }) => (
  <Card className="overflow-x-auto">
    <table className="w-full text-sm" data-testid={testId}>
      <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{cols.map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-slate-400">{empty || tr("暫無資料")}</td></tr> : rows.map(render)}</tbody>
    </table>
  </Card>
);
export const Head = ({ title, sub, right }) => <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div><h1 className="font-head text-xl md:text-2xl font-bold text-slate-900">{title}</h1>{sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div><div className="flex items-center gap-2">{right}</div></div>;
export const fmt = (s) => (s ? s.slice(0, 16).replace("T", " ") : "-");
export const useLoad = (callApi, url, deps = []) => {
  const [data, setData] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url }).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, load, setData];
};
