import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Pill, fmt } from "./ui";
import { API } from "@/lib/api";

const METHOD_TONE = { POST: "emerald", PUT: "amber", DELETE: "red", PATCH: "violet", CREDIT: "emerald" };

export function OperationLogsAdmin({ callApi }) {
  const { getToken } = useAuth();
  const [q, setQ] = useState("");
  const [onlyCredit, setOnlyCredit] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const size = 50;
  const methodParam = onlyCredit ? "&method=CREDIT" : "";
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/operation-logs?q=${encodeURIComponent(q)}${onlyCredit ? "&method=CREDIT" : ""}&page=${page}&size=${size}` }).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, q, onlyCredit, page]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const token = await getToken();
      const r = await fetch(`${API}/admin/operation-logs/export?q=${encodeURIComponent(q)}${methodParam}`, { headers: { Authorization: `Bearer ${token}`, "X-Admin-Token": localStorage.getItem("admin_token") || "" } });
      const blob = await r.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "operation_logs.csv"; a.click();
    } catch { toast.error(tr("匯出失敗")); }
  };

  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div data-testid="operation-logs-admin">
      <Head title={tr("操作日誌")} sub={tr("記錄後台所有新增/修改/刪除操作（含管理員、路徑、狀態與時間）")} right={<Btn kind="ghost" data-testid="oplog-export" onClick={exportCsv}><Download className="h-4 w-4" />{tr("匯出 CSV")}</Btn>} />
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input data-testid="oplog-search" className="w-64 pl-8" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())} placeholder={tr("搜尋路徑或管理員信箱")} />
        </div>
        <Btn kind="ghost" data-testid="oplog-search-btn" onClick={() => { setPage(1); load(); }}>{tr("查詢")}</Btn>
        <button data-testid="oplog-only-credit" onClick={() => { setOnlyCredit((v) => !v); setPage(1); }} className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-colors ${onlyCredit ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>{tr("只看補單")}</button>
        <span className="text-xs text-slate-400 ml-auto">{tr("共 {0} 條", total)}</span>
      </div>
      <Table testId="oplog-table" cols={[tr("時間"), tr("管理員"), tr("方法"), tr("路徑"), tr("狀態"), tr("詳情")]}
        empty={data === null ? tr("載入中…") : tr("暫無日誌")} rows={data?.rows || []} render={(r, i) => (
          <tr key={i} data-testid={`oplog-row-${i}`} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
            <td className="px-4 py-2.5 text-slate-700">{r.admin_email || r.admin_user_id?.slice(-8) || "-"}</td>
            <td className="px-4 py-2.5"><Pill tone={METHOD_TONE[r.method] || "slate"}>{r.method}</Pill></td>
            <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">{r.path}</td>
            <td className="px-4 py-2.5"><span className={(r.status >= 200 && r.status < 300) ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>{r.status}</span></td>
            <td className="px-4 py-2.5 text-[12px] text-slate-600 max-w-[320px] break-all">{r.detail || "-"}</td>
          </tr>
        )} />
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Btn kind="ghost" data-testid="oplog-prev" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Btn>
          <span className="text-sm text-slate-500">{page} / {pages}</span>
          <Btn kind="ghost" data-testid="oplog-next" onClick={() => setPage((p) => Math.min(pages, p + 1))}><ChevronRight className="h-4 w-4" /></Btn>
        </div>
      )}
    </div>
  );
}
