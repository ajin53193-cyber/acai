import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Loader2, FolderDown, CheckCircle2, XCircle, Clock, CalendarClock, Plus, Trash2, Power, AlertTriangle } from "lucide-react";

const STATUS = {
  pending: { label: "生成中", cls: "text-amber-400 border-amber-400/30", Icon: Clock },
  done: { label: "已完成", cls: "text-emerald-400 border-emerald-400/30", Icon: CheckCircle2 },
  failed: { label: "失败", cls: "text-red-400 border-red-400/30", Icon: XCircle },
};

export default function ExportJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ kind: "orders", freq: "daily", range: "all", account_id: "" });
  const [creating, setCreating] = useState(false);

  const loadSchedules = useCallback(async () => {
    try { const { data } = await api.get("/export-schedules"); setSchedules(data); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    loadSchedules();
    Promise.all([
      api.get("/accounts", { params: { role: "merchant" } }),
      api.get("/accounts", { params: { role: "agent" } }),
    ]).then((rs) => setAccounts(rs.flatMap((r) => r.data))).catch(() => {});
  }, [loadSchedules]);

  const createSchedule = async () => {
    if (form.kind === "ledger" && !form.account_id) { toast.error("资金流水定时导出需选择账户"); return; }
    setCreating(true);
    try {
      await api.post("/export-schedules", { kind: form.kind, freq: form.freq, range: form.range, account_id: form.kind === "ledger" ? form.account_id : null });
      toast.success("定时导出已创建");
      setForm({ kind: "orders", freq: "daily", range: "all", account_id: "" });
      loadSchedules();
    } catch (err) { toast.error(err.response?.data?.detail || "创建失败"); }
    finally { setCreating(false); }
  };
  const toggleSchedule = async (s) => { try { await api.patch(`/export-schedules/${s.id}/toggle`); loadSchedules(); } catch { toast.error("操作失败"); } };
  const deleteSchedule = async (s) => { try { await api.delete(`/export-schedules/${s.id}`); loadSchedules(); } catch { toast.error("删除失败"); } };

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
  const expiryInfo = (j) => {
    if (!j.expires_at) return null;
    const ms = new Date(j.expires_at) - new Date();
    if (ms <= 0) return { label: "已过期", soon: false, expired: true };
    const hrs = ms / 3600000;
    const text = hrs < 24 ? `${Math.max(1, Math.round(hrs))}h 后` : `${Math.round(hrs / 24)}天后`;
    return { label: `${text}到期`, soon: hrs < 24, expired: false };
  };
  const fmtParams = (p) => {
    if (!p || Object.keys(p).length === 0) return "全部订单";
    const map = { status: "状态", network: "网络", keyword: "关键词", merchant_id: "商户", date: "日期", start: "起", end: "止", ids: "所选" };
    return Object.entries(p).map(([k, v]) => `${map[k] || k}=${k === "ids" ? `${String(v).split(",").length}笔` : v}`).join(" · ");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;

  const _now = new Date();
  const monthCount = jobs.filter((j) => { const d = new Date(j.created_at); return d.getFullYear() === _now.getFullYear() && d.getMonth() === _now.getMonth(); }).length;
  const totalBytes = jobs.reduce((a, j) => a + (j.size_bytes || 0), 0);
  const expiringSoon = jobs.filter((j) => j.expires_at && new Date(j.expires_at) > _now && (new Date(j.expires_at) - _now) < 86400000).length;

  return (
    <div className="space-y-6" data-testid="export-jobs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FolderDown className="w-6 h-6 text-cyan-400" /> 导出任务</h1>
          <p className="text-sm text-slate-400 mt-1">大批量订单导出在后台生成，完成后在此下载（无需长时间等待）</p>
        </div>
        <Button onClick={load} variant="outline" data-testid="refresh-jobs-btn" className="border-slate-700 hover:bg-slate-800"><Loader2 className="w-4 h-4 mr-1" /> 刷新</Button>
      </div>

      <div className="grid grid-cols-3 gap-3" data-testid="export-summary-bar">
        <div className="glass rounded-xl p-4"><div className="text-xs text-slate-400">本月导出</div><div className="text-2xl font-bold text-cyan-400" data-testid="summary-month-count">{monthCount}</div></div>
        <div className="glass rounded-xl p-4"><div className="text-xs text-slate-400">文件总大小</div><div className="text-2xl font-bold text-cyan-400" data-testid="summary-total-size">{fmtSize(totalBytes)}</div></div>
        <div className="glass rounded-xl p-4"><div className="text-xs text-slate-400">24h 内到期</div><div className="text-2xl font-bold text-amber-400" data-testid="summary-expiring">{expiringSoon}</div></div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3" data-testid="export-schedules-card">
        <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="w-4 h-4 text-cyan-400" /> 定时导出</div>
        <p className="text-xs text-slate-400 -mt-1">按每日/每周自动生成报表并存入下方任务列表（每周于周一运行）。资金流水需指定账户。</p>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, account_id: "" })}>
            <SelectTrigger data-testid="schedule-kind-select" className="w-[150px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="orders">订单</SelectItem><SelectItem value="ledger">资金流水</SelectItem><SelectItem value="snapshots">分润快照</SelectItem></SelectContent>
          </Select>
          <Select value={form.freq} onValueChange={(v) => setForm({ ...form, freq: v })}>
            <SelectTrigger data-testid="schedule-freq-select" className="w-[120px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="daily">每日</SelectItem><SelectItem value="weekly">每周</SelectItem></SelectContent>
          </Select>
          <Select value={form.range} onValueChange={(v) => setForm({ ...form, range: v })}>
            <SelectTrigger data-testid="schedule-range-select" className="w-[130px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部数据</SelectItem><SelectItem value="yesterday">仅昨日</SelectItem><SelectItem value="week">本周至今</SelectItem></SelectContent>
          </Select>
          {form.kind === "ledger" && (
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger data-testid="schedule-account-select" className="w-[220px] bg-slate-900/60 border-slate-700"><SelectValue placeholder="选择账户" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.email}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button onClick={createSchedule} disabled={creating} data-testid="schedule-add-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> 添加</>}
          </Button>
        </div>
        {schedules.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-xs bg-slate-900/40 rounded-lg px-3 py-2" data-testid={`schedule-row-${s.id}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">{{ orders: "订单", ledger: "资金流水", snapshots: "分润快照" }[s.kind]}</span>
                  <span className="text-cyan-400">{s.freq === "daily" ? "每日" : "每周(周一)"}</span>
                  <span className="text-slate-400">{{ all: "全部", yesterday: "仅昨日", week: "本周至今" }[s.range || "all"]}</span>
                  {s.account_name && <span className="text-slate-400">{s.account_name}</span>}
                  <span className={`text-[11px] ${s.enabled ? "text-emerald-400" : "text-slate-500"}`}>{s.enabled ? "启用中" : "已暂停"}</span>
                  <span className="text-slate-500">上次：{s.last_run_at ? fmtDate(s.last_run_at) : "尚未运行"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleSchedule(s)} data-testid={`schedule-toggle-${s.id}`} className={`p-1.5 rounded hover:bg-slate-800 ${s.enabled ? "text-amber-400" : "text-emerald-400"}`} title={s.enabled ? "暂停" : "启用"}><Power className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteSchedule(s)} data-testid={`schedule-delete-${s.id}`} className="p-1.5 rounded text-red-400 hover:bg-red-400/10" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="py-3 px-3 font-medium">创建时间</th>
              <th className="py-3 px-3 font-medium">类型</th>
              <th className="py-3 px-3 font-medium">筛选条件</th>
              <th className="py-3 px-3 font-medium text-right">行数</th>
              <th className="py-3 px-3 font-medium text-right">大小</th>
              <th className="py-3 px-3 font-medium">创建人</th>
              <th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium">有效期</th>
              <th className="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-slate-500">暂无导出任务，在「订单与收款」页点击「后台导出」创建</td></tr>
            ) : jobs.map((j) => {
              const s = STATUS[j.status] || STATUS.pending; const Icon = s.Icon;
              const kindLabel = { orders: "订单", snapshots: "分润快照", ledger: "资金流水" }[j.kind] || j.kind;
              const exp = expiryInfo(j);
              return (
                <tr key={j.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${exp?.soon ? "bg-amber-400/5" : ""}`} data-testid={`export-job-${j.id}`}>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{fmtDate(j.created_at)}</td>
                  <td className="py-3 px-3"><span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">{kindLabel}</span></td>
                  <td className="py-3 px-3 text-xs text-slate-300">{fmtParams(j.params)}</td>
                  <td className="py-3 px-3 text-right font-mono">{j.row_count ?? "—"}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400">{fmtSize(j.size_bytes)}</td>
                  <td className="py-3 px-3 text-xs text-slate-400">{j.created_email}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${s.cls}`}>
                      <Icon className={`w-3 h-3 ${j.status === "pending" ? "animate-pulse" : ""}`} /> {s.label}{j.status === "pending" && j.expected ? ` ${j.processed || 0}/${j.expected}` : ""}
                    </span>
                    {j.status === "failed" && j.error && <div className="text-[10px] text-red-400/70 mt-0.5 max-w-[200px] truncate" title={j.error}>{j.error}</div>}
                  </td>
                  <td className="py-3 px-3">
                    {exp ? (
                      <span data-testid={`job-expiry-${j.id}`} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${exp.expired ? "text-slate-500 border-slate-700" : exp.soon ? "text-amber-400 border-amber-400/40 bg-amber-400/10" : "text-slate-400 border-slate-700"}`}>
                        {exp.soon && <AlertTriangle className="w-3 h-3" />}{exp.label}
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
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
