import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2, FolderDown, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS = {
  pending: { label: "生成中", cls: "text-amber-400 border-amber-400/30", Icon: Clock },
  done: { label: "已完成", cls: "text-emerald-400 border-emerald-400/30", Icon: CheckCircle2 },
  failed: { label: "失败", cls: "text-red-400 border-red-400/30", Icon: XCircle },
};

export default function ExportJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/export/jobs");
      setJobs(data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasPending = jobs.some((j) => j.status === "pending");
    if (hasPending && !timer.current) {
      timer.current = setInterval(load, 3000);
    } else if (!hasPending && timer.current) {
      clearInterval(timer.current); timer.current = null;
    }
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [jobs, load]);

  const download = async (job) => {
    try {
      const res = await api.get(`/export/jobs/${job.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = job.filename || "orders.xlsx"; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("下载失败，文件可能已过期，请重新导出"); }
  };

  const fmtSize = (b) => (!b ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${(b / 1024).toFixed(0)}KB`);
  const fmtParams = (p) => {
    if (!p || Object.keys(p).length === 0) return "全部订单";
    const map = { status: "状态", network: "网络", keyword: "关键词", merchant_id: "商户", date: "日期", start: "起", end: "止", ids: "所选" };
    return Object.entries(p).map(([k, v]) => `${map[k] || k}=${k === "ids" ? `${String(v).split(",").length}笔` : v}`).join(" · ");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;

  return (
    <div className="space-y-6" data-testid="export-jobs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FolderDown className="w-6 h-6 text-cyan-400" /> 导出任务</h1>
          <p className="text-sm text-slate-400 mt-1">大批量订单导出在后台生成，完成后在此下载（无需长时间等待）</p>
        </div>
        <Button onClick={load} variant="outline" data-testid="refresh-jobs-btn" className="border-slate-700 hover:bg-slate-800"><Loader2 className="w-4 h-4 mr-1" /> 刷新</Button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="py-3 px-3 font-medium">创建时间</th>
              <th className="py-3 px-3 font-medium">筛选条件</th>
              <th className="py-3 px-3 font-medium text-right">行数</th>
              <th className="py-3 px-3 font-medium text-right">大小</th>
              <th className="py-3 px-3 font-medium">创建人</th>
              <th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-500">暂无导出任务，在「订单与收款」页点击「后台导出」创建</td></tr>
            ) : jobs.map((j) => {
              const s = STATUS[j.status] || STATUS.pending; const Icon = s.Icon;
              return (
                <tr key={j.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`export-job-${j.id}`}>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{fmtDate(j.created_at)}</td>
                  <td className="py-3 px-3 text-xs text-slate-300">{fmtParams(j.params)}</td>
                  <td className="py-3 px-3 text-right font-mono">{j.row_count ?? "—"}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400">{fmtSize(j.size_bytes)}</td>
                  <td className="py-3 px-3 text-xs text-slate-400">{j.created_email}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${s.cls}`}>
                      <Icon className={`w-3 h-3 ${j.status === "pending" ? "animate-pulse" : ""}`} /> {s.label}
                    </span>
                    {j.status === "failed" && j.error && <div className="text-[10px] text-red-400/70 mt-0.5 max-w-[200px] truncate" title={j.error}>{j.error}</div>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {j.status === "done" ? (
                      <button onClick={() => download(j)} data-testid={`download-job-${j.id}`} className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-400/10" title="下载"><Download className="w-4 h-4" /></button>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
