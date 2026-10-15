import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, MessageSquareReply, Star, Eye, EyeOff, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Btn, Input, Card, Head, Field, fmt } from "@/pages/admin/ui";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";

const PAGE = 30;
const EMPTY = { product_id: "", author: "", rating: 5, content: "", images: [], visible: true, reply: "", area: "" };
const sel = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";
const Stars = ({ n }) => <span className="inline-flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</span>;

export function ReviewsAdmin({ callApi }) {
  const [data, setData] = useState({ items: [], counts: {} });
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState({ product_id: "", q: "", visible: "", rating: 0 });
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState([]);
  const [editing, setEditing] = useState(null);
  const [replying, setReplying] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => callApi({ method: "GET", url: "/admin/reviews", params: filter }).then((r) => { setData(r.data); setPicked([]); }).catch(() => toast.error(tr("載入失敗"))), [callApi, filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { publicApi.get("/products").then((r) => setProducts(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => setFilter((f) => ({ ...f, q })), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setShown(PAGE); }, [filter]);

  const pname = useMemo(() => { const m = Object.fromEntries(products.map((p) => [p.id, p.name])); return (id) => m[id] || id; }, [products]);
  const items = data.items || [];
  const c = data.counts || {};

  const save = async () => {
    if (!editing.product_id) return toast.error(tr("請選擇商品"));
    if (!editing.author.trim()) return toast.error(tr("請填寫作者"));
    setBusy(true);
    try {
      const body = { ...editing, rating: Math.min(5, Math.max(1, +editing.rating || 5)) };
      if (editing.id) await callApi({ method: "PUT", url: `/admin/reviews/${editing.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/reviews", data: body });
      toast.success(tr("已儲存")); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };
  const patch = async (id, p, msg) => {
    try { await callApi({ method: "PATCH", url: `/admin/reviews/${id}`, data: p }); if (msg) toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const del = async (r) => {
    if (!window.confirm(tr("刪除評價？"))) return;
    try { await callApi({ method: "DELETE", url: `/admin/reviews/${r.id}` }); toast.success(tr("已刪除")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("刪除失敗")); }
  };
  const bulk = async (action) => {
    if (action === "delete" && !window.confirm(tr("確定刪除已選的 {0} 則評價？", picked.length))) return;
    try { const r = await callApi({ method: "POST", url: "/admin/reviews/bulk", data: { ids: picked, action } }); toast.success(tr("已處理 {0} 則", r.data.count)); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const sendReply = async () => {
    setBusy(true);
    await patch(replying.id, { reply: replying.reply.trim() }, replying.reply.trim() ? tr("已回覆") : tr("已清除回覆"));
    setBusy(false); setReplying(null);
  };
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const visibleRows = items.slice(0, shown);
  const allPicked = visibleRows.length > 0 && visibleRows.every((r) => picked.includes(r.id));

  return (
    <div data-testid="reviews-admin">
      <Head title={tr("評價管理")} sub={tr("審核前台顯示、回覆顧客評價。隱藏的評價不會出現在商品頁。")}
        right={<Btn data-testid="review-add-btn" onClick={() => setEditing({ ...EMPTY, product_id: products[0]?.id || "" })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增評價")}</Btn>} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[[tr("全部評價"), c.total, "review-stat-total"], [tr("已隱藏"), c.hidden, "review-stat-hidden"], [tr("待回覆"), c.no_reply, "review-stat-noreply"]].map(([l, v, t]) => (
          <Card key={t} className="px-4 py-3" data-testid={t}><div className="text-xs text-slate-500">{l}</div><div className="font-head text-2xl font-bold text-slate-900">{v ?? "-"}</div></Card>
        ))}
      </div>

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" /><Input data-testid="review-search" className="w-full pl-9" placeholder={tr("搜尋作者 / 內容 / 回覆")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select data-testid="review-filter-product" className={sel} value={filter.product_id} onChange={(e) => setFilter({ ...filter, product_id: e.target.value })}>
          <option value="">{tr("全部商品")}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select data-testid="review-filter-visible" className={sel} value={filter.visible} onChange={(e) => setFilter({ ...filter, visible: e.target.value })}>
          <option value="">{tr("顯示狀態：全部")}</option><option value="true">{tr("前台顯示中")}</option><option value="false">{tr("已隱藏")}</option>
        </select>
        <select data-testid="review-filter-rating" className={sel} value={filter.rating} onChange={(e) => setFilter({ ...filter, rating: +e.target.value })}>
          <option value={0}>{tr("評分：全部")}</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      </Card>

      {picked.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-orange-50 border border-orange-100 px-4 py-2 text-sm" data-testid="review-bulk-bar">
          <span className="font-semibold text-orange-600">{tr("已選 {0} 則", picked.length)}</span>
          <Btn kind="ok" data-testid="review-bulk-show" onClick={() => bulk("show")}><Eye className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />{tr("顯示")}</Btn>
          <Btn kind="ghost" data-testid="review-bulk-hide" onClick={() => bulk("hide")}><EyeOff className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />{tr("隱藏")}</Btn>
          <Btn kind="danger" data-testid="review-bulk-delete" onClick={() => bulk("delete")}><Trash2 className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />{tr("刪除")}</Btn>
          <button className="ml-auto text-xs text-slate-500 underline" onClick={() => setPicked([])}>{tr("取消選取")}</button>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="reviews-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">
            <th className="px-4 py-3 w-8"><input type="checkbox" data-testid="review-pick-all" checked={allPicked} onChange={() => setPicked(allPicked ? [] : visibleRows.map((r) => r.id))} /></th>
            <th className="px-4 py-3 font-semibold">{tr("評價")}</th><th className="px-4 py-3 font-semibold whitespace-nowrap">{tr("商品")}</th><th className="px-4 py-3 font-semibold whitespace-nowrap">{tr("時間")}</th><th className="px-4 py-3 font-semibold whitespace-nowrap">{tr("前台顯示")}</th><th className="px-4 py-3 font-semibold">{tr("操作")}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{tr("暫無資料")}</td></tr> : visibleRows.map((r) => (
              <tr key={r.id} data-testid={`review-row-${r.id}`} className={`align-top hover:bg-orange-50/40 ${r.visible === false ? "opacity-60" : ""}`}>
                <td className="px-4 py-3"><input type="checkbox" data-testid={`review-pick-${r.id}`} checked={picked.includes(r.id)} onChange={() => togglePick(r.id)} /></td>
                <td className="px-4 py-3 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-slate-800">{r.author}</span><Stars n={r.rating} />{r.area && <span className="text-[11px] text-slate-400">{r.area}</span>}</div>
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap break-words">{r.content || <span className="italic text-slate-400">{tr("未填寫評價內容")}</span>}</p>
                  {r.reply && <div className="mt-2 rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-slate-600" data-testid={`review-reply-${r.id}`}><span className="font-semibold text-orange-500">{tr("客服回覆：")}</span>{r.reply}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap max-w-[180px] truncate">{pname(r.product_id)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                <td className="px-4 py-3"><Switch data-testid={`review-toggle-${r.id}`} checked={r.visible !== false} onCheckedChange={(v) => patch(r.id, { visible: v })} /></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button data-testid={`review-reply-btn-${r.id}`} title={tr("回覆")} onClick={() => setReplying({ id: r.id, reply: r.reply || "", author: r.author, content: r.content })} className="p-1.5 text-slate-400 hover:text-orange-500"><MessageSquareReply className="h-4 w-4" /></button>
                  <button data-testid={`review-edit-${r.id}`} title={tr("編輯")} onClick={() => setEditing({ ...EMPTY, ...r })} className="p-1.5 text-slate-400 hover:text-orange-500"><Pencil className="h-4 w-4" /></button>
                  <button data-testid={`review-delete-${r.id}`} title={tr("刪除")} onClick={() => del(r)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > shown && <div className="p-3 text-center border-t border-slate-100"><Btn kind="ghost" data-testid="review-load-more" onClick={() => setShown((n) => n + PAGE)}>{tr("載入更多（{0} / {1}）", shown, items.length)}</Btn></div>}
      </Card>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg bg-white" data-testid="review-form">
            <DialogHeader><DialogTitle>{editing.id ? tr("編輯評價") : tr("新增評價")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label={tr("商品")}><select data-testid="review-form-product" className={`${sel} w-full`} value={editing.product_id} onChange={(e) => setEditing({ ...editing, product_id: e.target.value })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr("作者")}><Input data-testid="review-form-author" className="w-full" value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></Field>
                <Field label={tr("評分 1-5")}><Input data-testid="review-form-rating" type="number" min="1" max="5" className="w-full" value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: e.target.value })} /></Field>
                <Field label={tr("地區（選填）")}><Input data-testid="review-form-area" className="w-full" value={editing.area || ""} onChange={(e) => setEditing({ ...editing, area: e.target.value })} placeholder={tr("例：中國台灣")} /></Field>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-slate-700"><Switch data-testid="review-form-visible" checked={editing.visible !== false} onCheckedChange={(v) => setEditing({ ...editing, visible: v })} /> {tr("前台顯示")}</label></div>
              </div>
              <Field label={tr("內容")}><textarea data-testid="review-form-content" className="w-full min-h-[90px] rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></Field>
              <Field label={tr("客服回覆（選填）")}><textarea data-testid="review-form-reply" className="w-full min-h-[60px] rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" value={editing.reply || ""} onChange={(e) => setEditing({ ...editing, reply: e.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Btn kind="ghost" onClick={() => setEditing(null)}>{tr("取消")}</Btn>
              <Btn data-testid="review-form-save" onClick={save} disabled={busy}>{tr("儲存")}</Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {replying && (
        <Dialog open onOpenChange={() => setReplying(null)}>
          <DialogContent className="max-w-md bg-white" data-testid="review-reply-form">
            <DialogHeader><DialogTitle>{tr("回覆評價")}</DialogTitle></DialogHeader>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><div className="font-semibold text-slate-800">{replying.author}</div><p className="text-slate-600 mt-0.5">{replying.content || <span className="italic text-slate-400">{tr("未填寫評價內容")}</span>}</p></div>
            <textarea data-testid="review-reply-input" autoFocus className="w-full min-h-[100px] rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" placeholder={tr("輸入客服回覆，顧客會在商品頁看到")} value={replying.reply} onChange={(e) => setReplying({ ...replying, reply: e.target.value })} />
            <DialogFooter>
              <Btn kind="ghost" onClick={() => setReplying(null)}>{tr("取消")}</Btn>
              <Btn data-testid="review-reply-save" onClick={sendReply} disabled={busy}>{tr("送出回覆")}</Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
