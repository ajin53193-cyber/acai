import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tr } from "@/i18n";

const V_STATUS = { reviewing: [tr("審核中"), "bg-amber-500/20 text-amber-300"], pending: [tr("待補件"), "bg-slate-700 text-slate-300"], approved: [tr("已通過"), "bg-emerald-500/20 text-emerald-300"], rejected: [tr("已拒絕"), "bg-red-500/20 text-red-300"] };
const KIND = { identity: tr("身份認證"), card: tr("金融卡認證") };
const F_KIND = { suggestion: tr("用戶建議"), complaint: tr("投訴"), restock: tr("缺貨登記") };
const chip = (on) => `whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5 ${on ? "bg-primary text-white" : "bg-slate-800 text-slate-400"}`;

export function VerificationsAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("reviewing");
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/verifications" }).then((r) => setList(r.data)).catch(() => setList([])), [callApi]);
  useEffect(() => { load(); }, [load]);

  const decide = async (v, status) => {
    const note = status === "rejected" ? window.prompt("拒絕原因（會顯示給用戶）", v.admin_note || "") : (window.prompt("備註（選填）", v.admin_note || "") ?? null);
    if (note === null) return;
    try { await callApi({ method: "PUT", url: `/admin/verifications/${v.id}`, data: { status, admin_note: note } }); toast.success(status === "approved" ? tr("已通過認證") : tr("已拒絕")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const shown = (list || []).filter((v) => filter === "all" || v.status === filter);
  const count = (s) => (list || []).filter((v) => v.status === s).length;

  return (
    <div>
      <h1 className="font-head text-2xl font-bold text-white mb-5">{tr("認證審核")}</h1>
      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4">
        <button data-testid="verif-filter-all" onClick={() => setFilter("all")} className={chip(filter === "all")}>{tr("全部")} {list?.length ?? ""}</button>
        {Object.entries(V_STATUS).map(([k, [l]]) => <button key={k} data-testid={`verif-filter-${k}`} onClick={() => setFilter(k)} className={chip(filter === k)}>{l} {count(k)}</button>)}
      </div>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin" /> : shown.length === 0 ? <div className="text-slate-500 text-sm py-10 text-center">{tr("暫無資料")}</div> : (
        <div className="space-y-2">
          {shown.map((v) => (
            <div key={v.id} data-testid={`verif-row-${v.id}`} className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm text-white font-semibold">{v.name} <span className="text-xs text-slate-400 font-normal ml-1">{KIND[v.kind] || v.kind} · {v.doc_type}</span></div>
                <div className="text-xs text-slate-500 mt-0.5">{v.user_email || v.user_id} · {v.created_at?.slice(0, 16).replace("T", " ")}</div>
                {v.admin_note && <div className="text-xs text-amber-300 mt-1">{tr("備註：")}{v.admin_note}</div>}
              </div>
              <span data-testid={`verif-status-${v.id}`} className={`text-xs font-semibold rounded-full px-2.5 py-1 ${V_STATUS[v.status]?.[1] || ""}`}>{V_STATUS[v.status]?.[0] || v.status}</span>
              <button data-testid={`verif-view-${v.id}`} onClick={() => setViewing(v)} className="h-8 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{tr("查看證件")}</button>
              {v.status !== "approved" && <button data-testid={`verif-approve-${v.id}`} onClick={() => decide(v, "approved")} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"><Check className="h-3.5 w-3.5" />{tr("通過")}</button>}
              {v.status !== "rejected" && <button data-testid={`verif-reject-${v.id}`} onClick={() => decide(v, "rejected")} className="h-8 px-3 rounded-lg bg-red-600/80 text-white text-xs font-semibold flex items-center gap-1"><X className="h-3.5 w-3.5" />{tr("拒絕")}</button>}
            </div>
          ))}
        </div>
      )}
      {viewing && <DocViewer v={viewing} callApi={callApi} onClose={() => setViewing(null)} />}
    </div>
  );
}

function DocViewer({ v, callApi, onClose }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: `/admin/verifications/${v.id}/image` }).then((r) => setSrc(r.data.data_url)).catch(() => setErr(true)); }, [callApi, v.id]);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl">
        <DialogHeader><DialogTitle className="text-white">{v.name} · {v.doc_type}</DialogTitle></DialogHeader>
        <div className="min-h-[200px] flex items-center justify-center bg-slate-800 rounded-xl overflow-hidden">
          {err ? <span className="text-sm text-slate-500">{tr("圖片載入失敗")}</span> : src ? <img data-testid="verif-doc-image" src={src} alt={tr("證件")} className="max-h-[70vh] object-contain" /> : <Loader2 className="h-6 w-6 animate-spin" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("open");
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/feedback" }).then((r) => setList(r.data)).catch(() => setList([])), [callApi]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (f, status) => {
    const note = status === "resolved" ? window.prompt("處理備註（選填）", f.admin_note || "") : "";
    if (note === null) return;
    try { await callApi({ method: "PUT", url: `/admin/feedback/${f.id}`, data: { status, admin_note: note } }); toast.success(status === "resolved" ? tr("已標記為已處理") : tr("已重新開啟")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const shown = (list || []).filter((f) => filter === "all" || f.status === filter);

  return (
    <div>
      <h1 className="font-head text-2xl font-bold text-white mb-5">{tr("用戶反饋")}</h1>
      <div className="flex gap-2 mb-4">
        {[["open", tr("待處理")], ["resolved", tr("已處理")], ["all", tr("全部")]].map(([k, l]) => <button key={k} data-testid={`feedback-filter-${k}`} onClick={() => setFilter(k)} className={chip(filter === k)}>{l} {(list || []).filter((f) => k === "all" || f.status === k).length}</button>)}
      </div>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin" /> : shown.length === 0 ? <div className="text-slate-500 text-sm py-10 text-center">{tr("暫無反饋")}</div> : (
        <div className="space-y-2">
          {shown.map((f) => (
            <div key={f.id} data-testid={`feedback-row-${f.id}`} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-primary/20 text-primary">{F_KIND[f.kind] || f.kind}</span>
                {f.topic && <span className="text-xs text-slate-300">{f.topic}</span>}
                <span data-testid={`feedback-status-${f.id}`} className={`text-xs font-semibold rounded-full px-2.5 py-1 ${f.status === "resolved" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>{f.status === "resolved" ? tr("已處理") : tr("待處理")}</span>
                <span className="ml-auto text-[11px] text-slate-500">{f.created_at?.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap flex items-start gap-2"><MessageSquare className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{f.content}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                <span>{tr("用戶：")}{f.user_email || f.user_id}</span>
                <span>{tr("聯繫：")}<span className="text-slate-200">{f.contact}</span></span>
                {f.admin_note && <span className="text-emerald-400">{tr("處理備註：")}{f.admin_note}</span>}
                <span className="ml-auto">
                  {f.status === "resolved"
                    ? <button data-testid={`feedback-reopen-${f.id}`} onClick={() => setStatus(f, "open")} className="h-8 px-3 rounded-lg border border-slate-700 text-slate-300">{tr("重新開啟")}</button>
                    : <button data-testid={`feedback-resolve-${f.id}`} onClick={() => setStatus(f, "resolved")} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-1"><Check className="h-3.5 w-3.5" />{tr("標記已處理")}</button>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
