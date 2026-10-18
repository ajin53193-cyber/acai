import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ImagePlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { RichEditor } from "@/components/admin/RichEditor";
import { Card, Btn, Input, Pill, Table, Head, Modal } from "@/pages/admin/ui";
import { tr } from "@/i18n";

const TYPES = { promo: tr("促銷活動"), tutorial: tr("充值教學"), news: tr("新聞公告") };
const STATUS = { live: [tr("進行中"), "emerald"], scheduled: [tr("未開始"), "sky"], expired: [tr("已結束"), "slate"], inactive: [tr("已下架"), "red"] };
const EMPTY = { title: "", type: "promo", summary: "", cover: "", content_html: "", link: "", keywords: "", start_at: null, end_at: null, sort_order: 0, active: true };

const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const toIso = (v) => (v ? new Date(v).toISOString() : null);
const lbl = "block text-xs font-semibold text-slate-500 mb-1";
const sel = "h-9 w-full rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";

export function ActivitiesAdmin({ callApi }) {
  const [data, setData] = useState({ total: 0, rows: [] });
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const size = 20;

  const load = useCallback(() => callApi({ method: "GET", url: `/admin/articles?q=${encodeURIComponent(q)}&type=${type}&page=${page}&size=${size}` }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, q, type, page]);
  useEffect(() => { load(); }, [load]);

  const openEdit = async (row) => {
    const r = await callApi({ method: "GET", url: `/admin/articles/${row.id}` });
    setEditing(r.data);
  };
  const del = async (row) => {
    if (!window.confirm(tr("確定刪除文章「{0}」？", row.title))) return;
    await callApi({ method: "DELETE", url: `/admin/articles/${row.id}` });
    toast.success(tr("已刪除")); load();
  };
  const toggle = async (row) => {
    const full = (await callApi({ method: "GET", url: `/admin/articles/${row.id}` })).data;
    await callApi({ method: "PUT", url: `/admin/articles/${row.id}`, data: { ...full, active: !row.active } });
    load();
  };
  const pages = Math.max(1, Math.ceil(data.total / size));

  return (
    <div data-testid="activities-admin">
      <Head title={tr("新聞 & 促銷")} sub={tr("新增/編輯新聞、促銷與充值教學文章，顯示於首頁「新聞 & 促銷」與文章列表；可設定有效期，到期自動下架。")}
        right={<Btn data-testid="activity-add-btn" onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增文章")}</Btn>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="activity-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={tr("搜尋標題")} className="pl-8 w-56" /></div>
        {[["", tr("全部")], ...Object.entries(TYPES)].map(([k, label]) => (
          <button key={k} data-testid={`activity-filter-${k || "all"}`} onClick={() => { setType(k); setPage(1); }} className={`h-9 px-3.5 rounded-lg text-xs font-semibold ${type === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{label}</button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">{tr("共 {0} 筆", data.total)}</span>
      </div>
      <Table testId="activities-table" cols={[tr("封面"), tr("標題"), tr("類型"), tr("有效期"), tr("狀態"), tr("閱讀"), tr("排序"), tr("操作")]} rows={data.rows} render={(r) => (
        <tr key={r.id} data-testid={`activity-row-${r.id}`} className="hover:bg-orange-50/40">
          <td className="px-4 py-2"><div className="h-10 w-20 rounded-md bg-slate-100 overflow-hidden">{r.cover && <img src={r.cover} alt="" className="h-full w-full object-cover" />}</div></td>
          <td className="px-4 py-2 max-w-[320px]"><div className="font-medium text-slate-800 truncate">{r.title}</div><div className="text-[11px] text-slate-400">{r.published_at}</div></td>
          <td className="px-4 py-2"><Pill tone={r.type === "promo" ? "orange" : r.type === "tutorial" ? "sky" : "slate"}>{TYPES[r.type] || r.type || "-"}</Pill></td>
          <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{r.start_at || r.end_at ? `${toLocal(r.start_at).replace("T", " ") || tr("即時")} ~ ${toLocal(r.end_at).replace("T", " ") || tr("長期")}` : tr("長期有效")}</td>
          <td className="px-4 py-2"><Pill tone={STATUS[r.status]?.[1] || "slate"}>{STATUS[r.status]?.[0] || r.status}</Pill></td>
          <td className="px-4 py-2 text-xs text-slate-500">{r.view_count || 0}</td>
          <td className="px-4 py-2 text-xs text-slate-500">{r.sort_order}</td>
          <td className="px-4 py-2 whitespace-nowrap">
            <div className="flex items-center gap-1">
              <Switch checked={!!r.active} onCheckedChange={() => toggle(r)} data-testid={`activity-toggle-${r.id}`} />
              <button data-testid={`activity-edit-${r.id}`} onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-orange-500"><Pencil className="h-4 w-4" /></button>
              <button data-testid={`activity-delete-${r.id}`} onClick={() => del(r)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </td>
        </tr>
      )} />
      {pages > 1 && <div className="flex items-center justify-center gap-2 mt-4">{Array.from({ length: pages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded-full text-xs ${p === page ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{p}</button>)}</div>}
      {editing && <ActivityForm item={editing} callApi={callApi} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ActivityForm({ item, callApi, onClose, onSaved }) {
  const [f, setF] = useState(item);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const upload = useCallback(async (img) => {
    try { return (await callApi({ method: "POST", url: "/admin/articles/upload", data: img })).data.url; }
    catch (e) { toast.error(e.response?.data?.detail || tr("圖片上傳失敗")); return null; }
  }, [callApi]);
  const save = async () => {
    if (!f.title.trim()) return toast.error(tr("請輸入標題"));
    setBusy(true);
    try {
      const body = { ...f, sort_order: +f.sort_order || 0 };
      delete body.status; delete body.view_count; delete body.prev; delete body.next;
      if (f.id) await callApi({ method: "PUT", url: `/admin/articles/${f.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/articles", data: body });
      toast.success(tr("已儲存")); onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };
  return (
    <Modal testId="activity-form" size="3xl" title={f.id ? tr("編輯文章") : tr("新增文章")} onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>{tr("取消")}</Btn><Btn data-testid="activity-save" onClick={save} disabled={busy}>{busy ? tr("儲存中…") : tr("儲存")}</Btn></>}>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <div><label className={lbl}>{tr("標題")} *</label><Input data-testid="activity-title" className="w-full" value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>{tr("類型")}</label><select data-testid="activity-type" className={sel} value={f.type} onChange={(e) => set("type", e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className={lbl}>{tr("排序（小在前）")}</label><Input type="number" className="w-full" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></div>
              <div><label className={lbl}>{tr("開始時間（留空即時生效）")}</label><Input data-testid="activity-start" type="datetime-local" className="w-full" value={toLocal(f.start_at)} onChange={(e) => set("start_at", toIso(e.target.value))} /></div>
              <div><label className={lbl}>{tr("結束時間（留空長期有效）")}</label><Input data-testid="activity-end" type="datetime-local" className="w-full" value={toLocal(f.end_at)} onChange={(e) => set("end_at", toIso(e.target.value))} /></div>
            </div>
            <div><label className={lbl}>{tr("摘要（列表顯示）")}</label><textarea data-testid="activity-summary" className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 h-16" value={f.summary} onChange={(e) => set("summary", e.target.value)} /></div>
            <div><label className={lbl}>{tr("跳轉連結（選填，詳情頁顯示「立即參與」按鈕）")}</label><Input className="w-full" placeholder="/category/games 或 https://..." value={f.link || ""} onChange={(e) => set("link", e.target.value)} /></div>
            <div><label className={lbl}>{tr("文章內容")}</label><RichEditor testId="activity-content" value={f.content_html} onChange={(v) => set("content_html", v)} onUpload={upload} placeholder={tr("輸入文章內容，可插入圖片…")} /></div>
          </div>
          <div className="space-y-3">
            <div>
              <label className={lbl}>{tr("封面圖（建議 2:1，≤4M）")}</label>
              <label className="block aspect-[2/1] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer hover:border-orange-300 relative">
                {f.cover ? <img src={f.cover} alt="" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1"><ImagePlus className="h-6 w-6" />{tr("點擊上傳封面")}</span>}
                <input data-testid="activity-cover" type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set("cover", (await readFile(file)).image_b64); }} />
              </label>
              {f.cover && <button onClick={() => set("cover", "")} className="text-[11px] text-red-500 mt-1">{tr("移除封面")}</button>}
            </div>
            <div><label className={lbl}>{tr("關鍵字（SEO，逗號分隔）")}</label><Input className="w-full" value={f.keywords || ""} onChange={(e) => set("keywords", e.target.value)} /></div>
            <div><label className={lbl}>{tr("發布日期顯示")}</label><Input className="w-full" placeholder="2026-06-01 12:00:00" value={f.published_at || ""} onChange={(e) => set("published_at", e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-700 pt-1"><Switch data-testid="activity-active" checked={!!f.active} onCheckedChange={(v) => set("active", v)} /> {tr("上架顯示")}</label>
          </div>
        </div>
    </Modal>
  );
}
