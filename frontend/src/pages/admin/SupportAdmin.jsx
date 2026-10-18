import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Card, Btn, Pill, Head, Modal, fmt } from "./ui";

const V_STATUS = { reviewing: [tr("審核中"), "amber"], pending: [tr("待補件"), "slate"], approved: [tr("已通過"), "emerald"], rejected: [tr("已拒絕"), "rose"] };
const KIND = { identity: tr("身份認證"), card: tr("金融卡認證") };
const F_KIND = { suggestion: tr("用戶建議"), complaint: tr("投訴"), restock: tr("缺貨登記") };
const chip = (on) => `whitespace-nowrap text-xs font-semibold rounded-full px-3.5 py-1.5 transition-colors ${on ? "bg-orange-500 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600"}`;

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
    <div data-testid="verifications-admin">
      <Head title={tr("認證審核")} sub={tr("用戶提交的身份 / 金融卡認證，審核後即時生效。")} />
      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4">
        <button data-testid="verif-filter-all" onClick={() => setFilter("all")} className={chip(filter === "all")}>{tr("全部")} {list?.length ?? ""}</button>
        {Object.entries(V_STATUS).map(([k, [l]]) => <button key={k} data-testid={`verif-filter-${k}`} onClick={() => setFilter(k)} className={chip(filter === k)}>{l} {count(k)}</button>)}
      </div>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin text-orange-500" /> : shown.length === 0 ? <div className="text-slate-400 text-sm py-12 text-center">{tr("暫無資料")}</div> : (
        <div className="space-y-2.5">
          {shown.map((v) => (
            <Card key={v.id} data-testid={`verif-row-${v.id}`} className="p-4 flex flex-wrap items-center gap-3 hover:border-slate-300 transition-colors">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm text-slate-900 font-semibold">{v.name} <span className="text-xs text-slate-400 font-normal ml-1">{KIND[v.kind] || v.kind} · {v.doc_type}</span></div>
                <div className="text-xs text-slate-500 mt-0.5">{v.user_email || v.user_id} · {fmt(v.created_at)}</div>
                {v.admin_note && <div className="text-xs text-amber-600 mt-1">{tr("備註：")}{v.admin_note}</div>}
              </div>
              <span data-testid={`verif-status-${v.id}`}><Pill tone={V_STATUS[v.status]?.[1] || "slate"} dot>{V_STATUS[v.status]?.[0] || v.status}</Pill></span>
              <Btn size="sm" kind="secondary" data-testid={`verif-view-${v.id}`} onClick={() => setViewing(v)}><Eye className="h-3.5 w-3.5" />{tr("查看證件")}</Btn>
              {v.status !== "approved" && <Btn size="sm" kind="ok" data-testid={`verif-approve-${v.id}`} onClick={() => decide(v, "approved")}><Check className="h-3.5 w-3.5" />{tr("通過")}</Btn>}
              {v.status !== "rejected" && <Btn size="sm" kind="danger" data-testid={`verif-reject-${v.id}`} onClick={() => decide(v, "rejected")}><X className="h-3.5 w-3.5" />{tr("拒絕")}</Btn>}
            </Card>
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
    <Modal testId="verif-doc-modal" size="xl" title={`${v.name} · ${v.doc_type}`} onClose={onClose}>
      <div className="min-h-[200px] flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
        {err ? <span className="text-sm text-slate-400 py-10">{tr("圖片載入失敗")}</span> : src ? <img data-testid="verif-doc-image" src={src} alt={tr("證件")} className="max-h-[70vh] object-contain" /> : <Loader2 className="h-6 w-6 animate-spin text-orange-500 my-10" />}
      </div>
    </Modal>
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
    <div data-testid="feedback-admin">
      <Head title={tr("用戶反饋")} sub={tr("用戶的建議、投訴與缺貨登記，處理後標記為已完成。")} />
      <div className="flex gap-2 mb-4">
        {[["open", tr("待處理")], ["resolved", tr("已處理")], ["all", tr("全部")]].map(([k, l]) => <button key={k} data-testid={`feedback-filter-${k}`} onClick={() => setFilter(k)} className={chip(filter === k)}>{l} {(list || []).filter((f) => k === "all" || f.status === k).length}</button>)}
      </div>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin text-orange-500" /> : shown.length === 0 ? <div className="text-slate-400 text-sm py-12 text-center">{tr("暫無反饋")}</div> : (
        <div className="space-y-2.5">
          {shown.map((f) => (
            <Card key={f.id} data-testid={`feedback-row-${f.id}`} className="p-4 hover:border-slate-300 transition-colors">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Pill tone="orange">{F_KIND[f.kind] || f.kind}</Pill>
                {f.topic && <span className="text-xs text-slate-500">{f.topic}</span>}
                <span data-testid={`feedback-status-${f.id}`}><Pill tone={f.status === "resolved" ? "emerald" : "amber"} dot>{f.status === "resolved" ? tr("已處理") : tr("待處理")}</Pill></span>
                <span className="ml-auto text-[11px] text-slate-400">{fmt(f.created_at)}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap flex items-start gap-2"><MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />{f.content}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                <span>{tr("用戶：")}{f.user_email || f.user_id}</span>
                <span>{tr("聯繫：")}<span className="text-slate-800 font-medium">{f.contact}</span></span>
                {f.admin_note && <span className="text-emerald-600">{tr("處理備註：")}{f.admin_note}</span>}
                <span className="ml-auto">
                  {f.status === "resolved"
                    ? <Btn size="sm" kind="secondary" data-testid={`feedback-reopen-${f.id}`} onClick={() => setStatus(f, "open")}>{tr("重新開啟")}</Btn>
                    : <Btn size="sm" kind="ok" data-testid={`feedback-resolve-${f.id}`} onClick={() => setStatus(f, "resolved")}><Check className="h-3.5 w-3.5" />{tr("標記已處理")}</Btn>}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
