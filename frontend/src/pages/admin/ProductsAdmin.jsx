import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { RichEditor } from "@/components/admin/RichEditor";
import { Card, Btn, Input, Pill, Table, Head, ImgField } from "@/pages/admin/ui";
import { tr } from "@/i18n";
import { publicApi } from "@/lib/api";

const lbl = "block text-xs font-semibold text-slate-500 mb-1";
const selBase = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";
const sel = selBase + " w-full";
const ta = "w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300";
export const EMPTY_PRODUCT = { name: "", category: "", brand: "", subtitle: "", image: "", description: "", content_html: "", tutorial: "", delivery_fields: [{ code: "account", name: "充值帳號", required: true, placeholder: "", tips: "", type: "text", options: [] }], specs: [], tags: [], is_giftcard: false, price_currency: "", price_rate: 0, sales_count: 0, rating: 5, sort_order: 0, active: true, related_ids: [], related: [] };
const LIMIT_KINDS = { "": tr("依角標自動"), none: tr("不限購"), daily: tr("每日限購"), weekly: tr("每週限購"), monthly: tr("每月限購"), lifetime: tr("終生限購"), newcomer: tr("新用戶專享") };
const inferLimit = (b = "") => (/每月一單|每月一单/.test(b) ? "monthly" : /每日一單|每日一单/.test(b) ? "daily" : /新客|新用戶|新用户|新使用者/.test(b) ? "newcomer" : "");
const FIELD_TYPES = { text: tr("文字"), select: tr("下拉選擇"), password: tr("密碼"), textarea: tr("多行文字") };
const priceRange = (specs) => { const ps = (specs || []).map((s) => s.price_usd).filter((n) => n > 0); if (!ps.length) return "-"; const a = Math.min(...ps), b = Math.max(...ps); return a === b ? `$${a}` : `$${a} ~ $${b}`; };

export function ProductsAdmin({ callApi, autoCreate, giftcardOnly }) {
  const [data, setData] = useState({ total: 0, rows: [] });
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [sel, setSel] = useState([]);
  const size = 30;

  useEffect(() => { const t = setTimeout(() => { setQd(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/products?q=${encodeURIComponent(qd)}&category=${cat}&active=${status}&giftcard=${giftcardOnly ? "1" : ""}&page=${page}&size=${size}` }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, qd, cat, status, page, giftcardOnly]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/categories" }).then((r) => setCats(r.data)).catch(() => {}); }, [callApi]);
  useEffect(() => { if (autoCreate && !autoOpened && cats.length) { setEditing({ ...EMPTY_PRODUCT, category: cats[0]?.id || "" }); setAutoOpened(true); } }, [autoCreate, autoOpened, cats]);

  const openEdit = async (row) => { const r = await callApi({ method: "GET", url: `/admin/products/${row.id}` }); setEditing({ ...EMPTY_PRODUCT, ...r.data, related: r.data.related || [] }); };
  const patch = async (row, body) => { try { await callApi({ method: "PATCH", url: `/admin/products/${row.id}`, data: body }); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("更新失敗")); } };
  const del = async (row) => {
    if (!window.confirm(tr("確定刪除商品「{0}」？此操作無法復原", row.name))) return;
    await callApi({ method: "DELETE", url: `/admin/products/${row.id}` }); toast.success(tr("已刪除")); load();
  };
  const pages = Math.max(1, Math.ceil(data.total / size));
  const catName = (id) => cats.find((c) => c.id === id)?.name || id;
  const pageIds = data.rows.map((p) => p.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => sel.includes(id));
  const toggleAll = () => setSel(allChecked ? sel.filter((id) => !pageIds.includes(id)) : [...new Set([...sel, ...pageIds])]);
  const toggleOne = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const bulk = async (action, value) => {
    if (action === "delete" && !window.confirm(tr("確定刪除選取的 {0} 件商品？此操作無法復原", sel.length))) return;
    try {
      const r = await callApi({ method: "POST", url: "/admin/products/bulk", data: { ids: sel, action, value } });
      toast.success(tr("已更新 {0} 件商品", r.data.count)); setSel([]); load();
      if (action === "set_category" || action === "delete") callApi({ method: "GET", url: "/admin/categories" }).then((c) => setCats(c.data)).catch(() => {});
    } catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };

  return (
    <div data-testid="products-admin">
      <Head title={giftcardOnly ? tr("禮品卡列表") : tr("商品管理")} sub={giftcardOnly ? tr("共 {0} 張禮品卡商品；點擊編輯可修改規格、面額與下單需填寫資料。", data.total) : tr("共 {0} 件商品，可搜尋、按分類/狀態篩選；點擊編輯可修改規格、價格、角標與下單需填寫資料。", data.total)}
        right={<Btn data-testid="product-add-btn" onClick={() => setEditing({ ...EMPTY_PRODUCT, category: cats[0]?.id || "" })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增商品")}</Btn>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="product-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("搜尋名稱 / 品牌 / ID")} className="pl-8 w-64" /></div>
        <select data-testid="product-filter-category" className={selBase + " w-44"} value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">{tr("全部分類")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{`${c.name}（${c.product_count}）`}</option>)}</select>
        <select data-testid="product-filter-status" className={selBase + " w-32"} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">{tr("全部狀態")}</option><option value="true">{tr("上架中")}</option><option value="false">{tr("已下架")}</option></select>
        <span className="text-xs text-slate-400 ml-auto">{tr("第 {0} / {1} 頁", page, pages)}</span>
      </div>
      {sel.length > 0 && <BulkBar count={sel.length} cats={cats} onAction={bulk} onClear={() => setSel([])} />}
      <Table testId="products-table" cols={[<input key="all" type="checkbox" data-testid="product-select-all" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-orange-500" />, tr("商品"), tr("分類"), tr("規格 / 價格"), tr("已售"), tr("評分"), tr("排序"), tr("上架"), tr("操作")]} rows={data.rows} render={(p) => (
        <tr key={p.id} data-testid={`product-row-${p.id}`} className={`hover:bg-orange-50/40 ${sel.includes(p.id) ? "bg-orange-50/60" : ""}`}>
          <td className="px-4 py-2"><input type="checkbox" data-testid={`product-select-${p.id}`} checked={sel.includes(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 accent-orange-500" /></td>
          <td className="px-4 py-2 max-w-[360px]">
            <div className="flex items-center gap-3">
              <img src={p.image} alt="" className="h-11 w-11 rounded-lg object-cover bg-slate-100 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-slate-800 truncate">{p.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{p.brand}{p.subtitle ? ` · ${p.subtitle}` : ""}</div>
                <div className="flex gap-1 mt-0.5">{(p.tags || []).map((t) => <Pill key={t} tone="orange">{t}</Pill>)}</div>
              </div>
            </div>
          </td>
          <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{catName(p.category)}</td>
          <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{(p.specs || []).length} {tr("個規格")}<div className="text-slate-400">{priceRange(p.specs)}</div></td>
          <td className="px-4 py-2 text-xs text-slate-600">{p.sales_count}</td>
          <td className="px-4 py-2 text-xs text-slate-600">{p.rating}</td>
          <td className="px-4 py-2"><input type="number" defaultValue={p.sort_order} key={p.sort_order} data-testid={`product-sort-${p.id}`} onBlur={(e) => +e.target.value !== p.sort_order && patch(p, { sort_order: +e.target.value })} className="h-8 w-16 rounded-md bg-slate-100 px-2 text-xs" /></td>
          <td className="px-4 py-2"><Switch checked={!!p.active} onCheckedChange={(v) => patch(p, { active: v })} data-testid={`product-toggle-${p.id}`} /></td>
          <td className="px-4 py-2 whitespace-nowrap">
            <button data-testid={`product-edit-${p.id}`} onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-orange-500"><Pencil className="h-4 w-4" /></button>
            <button data-testid={`product-delete-${p.id}`} onClick={() => del(p)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </td>
        </tr>
      )} />
      {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
      {editing && <ProductForm item={editing} cats={cats} callApi={callApi} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function BulkBar({ count, cats, onAction, onClear }) {
  const [cat, setCat] = useState("");
  const [tags, setTags] = useState("");
  return (
    <Card className="p-3 mb-3 flex flex-wrap items-center gap-2 border-orange-200 bg-orange-50/60" data-testid="bulk-bar">
      <span className="text-sm font-semibold text-orange-700">{tr("已選 {0} 件", count)}</span>
      <button onClick={onClear} className="text-xs text-slate-500 underline">{tr("取消選取")}</button>
      <span className="h-5 w-px bg-orange-200 mx-1" />
      <Btn kind="ok" data-testid="bulk-activate" onClick={() => onAction("set_active", true)}>{tr("批量上架")}</Btn>
      <Btn kind="ghost" data-testid="bulk-deactivate" onClick={() => onAction("set_active", false)}>{tr("批量下架")}</Btn>
      <span className="h-5 w-px bg-orange-200 mx-1" />
      <select data-testid="bulk-category" className={selBase + " w-40"} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{tr("移動到分類…")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <Btn kind="ghost" data-testid="bulk-category-apply" disabled={!cat} onClick={() => onAction("set_category", cat)}>{tr("移動")}</Btn>
      <span className="h-5 w-px bg-orange-200 mx-1" />
      <Input data-testid="bulk-tags" className="w-44" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tr("標籤，逗號分隔")} />
      <Btn kind="ghost" data-testid="bulk-add-tags" disabled={!tags.trim()} onClick={() => onAction("add_tags", tags)}>{tr("加標籤")}</Btn>
      <Btn kind="ghost" data-testid="bulk-remove-tags" disabled={!tags.trim()} onClick={() => onAction("remove_tags", tags)}>{tr("移除標籤")}</Btn>
      <Btn kind="danger" data-testid="bulk-delete" className="ml-auto" onClick={() => onAction("delete")}>{tr("批量刪除")}</Btn>
    </Card>
  );
}

function Pager({ page, pages, onChange }) {
  const items = [];
  for (let i = 1; i <= pages; i++) if (i <= 2 || i > pages - 2 || Math.abs(i - page) <= 2) items.push(i); else if (items[items.length - 1] !== "…") items.push("…");
  return (
    <div className="flex items-center justify-center gap-1.5 mt-4" data-testid="products-pager">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="h-8 px-3 rounded-full text-xs bg-white border border-slate-200 disabled:opacity-40">‹</button>
      {items.map((it, i) => it === "…" ? <span key={`e${i}`} className="px-1 text-slate-400">…</span> : <button key={it} onClick={() => onChange(it)} className={`h-8 min-w-8 px-2 rounded-full text-xs ${it === page ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{it}</button>)}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="h-8 px-3 rounded-full text-xs bg-white border border-slate-200 disabled:opacity-40">›</button>
    </div>
  );
}

const TABS = [["basic", tr("基本資訊")], ["specs", tr("規格與價格")], ["delivery", tr("下單需填寫")], ["content", tr("商品說明")], ["related", tr("相關推薦")]];

export function ProductForm({ item, cats, callApi, onClose, onSaved, inline, title }) {
  const [f, setF] = useState({ ...item, tags: (item.tags || []).join(", ") });
  const [tab, setTab] = useState("basic");
  const [busy, setBusy] = useState(false);
  const [badges, setBadges] = useState([]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/products/badges" }).then((r) => setBadges(r.data)).catch(() => {}); }, [callApi]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const upload = useCallback(async (img) => { try { return (await callApi({ method: "POST", url: "/admin/articles/upload", data: img })).data.url; } catch { toast.error(tr("圖片上傳失敗")); return null; } }, [callApi]);

  const save = async () => {
    if (!f.name.trim()) return toast.error(tr("請輸入商品名稱"));
    if (!f.category) return toast.error(tr("請選擇分類"));
    if (!f.specs.length) return toast.error(tr("請至少新增一個規格"));
    if (f.specs.some((s) => !s.label.trim())) return toast.error(tr("規格名稱不可為空"));
    setBusy(true);
    try {
      const body = {
        name: f.name, category: f.category, brand: f.brand, subtitle: f.subtitle, image: f.image, description: f.description, content_html: f.content_html, tutorial: f.tutorial,
        delivery_fields: f.delivery_fields.map((d) => ({ ...d, options: Array.isArray(d.options) ? d.options : String(d.options || "").split(/[,，\n]/).map((o) => o.trim()).filter(Boolean) })),
        specs: f.specs.map((s) => ({ ...s, price_usd: +s.price_usd || 0, sale_price_usd: s.sale_price_usd ? +s.sale_price_usd : null, giftcard_value_usd: s.giftcard_value_usd ? +s.giftcard_value_usd : null, price_local: s.price_local ? +s.price_local : null, sale_price_local: s.sale_price_local ? +s.sale_price_local : null, giftcard_value_local: s.giftcard_value_local ? +s.giftcard_value_local : null, limit: s.limit || "", limit_count: Math.max(1, +s.limit_count || 1) })),
        tags: f.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean), is_giftcard: !!f.is_giftcard, price_currency: f.is_giftcard ? (f.price_currency || "") : "", price_rate: f.is_giftcard ? (+f.price_rate || 0) : 0, sales_count: +f.sales_count || 0, rating: +f.rating || 5, sort_order: +f.sort_order || 0, active: !!f.active,
        related_ids: (f.related || []).map((r) => r.id),
      };
      if (f.id) await callApi({ method: "PUT", url: `/admin/products/${f.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/products", data: body });
      toast.success(tr("已儲存")); onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };

  const heading = title || (f.id ? tr("編輯商品") : tr("新增商品"));
  const body = (
    <>
        <div className="flex gap-2 border-b border-slate-200 -mt-1">
          {TABS.map(([k, label]) => <button key={k} data-testid={`pf-tab-${k}`} onClick={() => setTab(k)} className={`h-9 px-3 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>)}
        </div>

        {tab === "basic" && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>{tr("商品名稱")} *</label><Input data-testid="pf-name" className="w-full" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
                <div><label className={lbl}>{tr("品牌 / 分組名稱")}</label><Input data-testid="pf-brand" className="w-full" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></div>
                <div><label className={lbl}>{tr("分類")} *</label><select data-testid="pf-category" className={sel} value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">{tr("請選擇")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className={lbl}>{tr("標籤（逗號分隔；「快速下單」「熱銷」會顯示在首頁）")}</label><Input data-testid="pf-tags" className="w-full" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="快速下單, 熱銷" /></div>
              </div>
              <div><label className={lbl}>{tr("副標題（商品頁名稱下方提示）")}</label><Input data-testid="pf-subtitle" className="w-full" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className={lbl}>{tr("已售數")}</label><Input type="number" className="w-full" value={f.sales_count} onChange={(e) => set("sales_count", e.target.value)} /></div>
                <div><label className={lbl}>{tr("評分 1-5")}</label><Input type="number" step="0.1" min="1" max="5" className="w-full" value={f.rating} onChange={(e) => set("rating", e.target.value)} /></div>
                <div><label className={lbl}>{tr("排序（小在前）")}</label><Input type="number" className="w-full" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-slate-700"><Switch data-testid="pf-active" checked={!!f.active} onCheckedChange={(v) => set("active", v)} /> {tr("上架")}</label></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2"><Switch data-testid="pf-giftcard" checked={!!f.is_giftcard} onCheckedChange={(v) => set("is_giftcard", v)} /> <span>{tr("禮品卡商品")}</span><span className="text-[11px] text-slate-400">{tr("開啟後，用戶付款成功會自動生成卡號發送（可於規格設定每檔面額）")}</span></label>
            </div>
            <div><label className={lbl}>{tr("商品圖片（方形，≤4M）")}</label><ImgField value={f.image} onChange={(v) => set("image", v)} testId="pf-image" ratio="aspect-square" /></div>
          </div>
        )}

        {tab === "specs" && <SpecsEditor specs={f.specs} badges={badges} isGiftcard={f.is_giftcard} callApi={callApi} onChange={(v) => set("specs", v)} fx={{ currency: f.price_currency, rate: f.price_rate }} onFx={(c, r) => setF((p) => ({ ...p, price_currency: c, price_rate: r }))} />}
        {tab === "delivery" && <DeliveryEditor fields={f.delivery_fields} onChange={(v) => set("delivery_fields", v)} />}

        {tab === "content" && (
          <div className="space-y-3">
            <div><label className={lbl}>{tr("簡短說明（列表 / 摘要）")}</label><textarea data-testid="pf-description" className={ta + " h-16"} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div><label className={lbl}>{tr("商品詳細說明（商品頁「產品說明」分頁）")}</label><RichEditor testId="pf-content" value={f.content_html} onChange={(v) => set("content_html", v)} onUpload={upload} placeholder={tr("輸入商品說明，可插入圖片…")} /></div>
            <div><label className={lbl}>{tr("充值教學（選填）")}</label><textarea className={ta + " h-20"} value={f.tutorial} onChange={(e) => set("tutorial", e.target.value)} /></div>
          </div>
        )}

        {tab === "related" && <RelatedEditor related={f.related || []} selfId={f.id} callApi={callApi} onChange={(v) => set("related", v)} />}

        <div className="flex justify-end gap-2 pt-2">
          {onClose && <Btn kind="ghost" onClick={onClose}>{tr("取消")}</Btn>}
          <Btn data-testid="pf-save" onClick={save} disabled={busy}>{busy ? tr("儲存中…") : tr("儲存")}</Btn>
        </div>
    </>
  );
  if (inline) return <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4" data-testid="product-form">{body}</div>;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-white" data-testid="product-form">
        <DialogHeader><DialogTitle>{heading}{f.id && <span className="ml-2 text-xs font-normal text-slate-400">ID {f.id}</span>}</DialogTitle></DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function SpecsEditor({ specs, badges, isGiftcard, callApi, onChange, fx, onFx }) {
  const [currencies, setCurrencies] = useState([]);
  useEffect(() => { if (isGiftcard) publicApi.get("/currencies").then((r) => setCurrencies(r.data.filter((c) => c.code !== "USD"))).catch(() => {}); }, [isGiftcard]);
  useEffect(() => { if (isGiftcard && !fx?.currency && currencies.length) { const hk = currencies.find((c) => c.code === "HKD") || currencies[0]; onFx(hk.code, +(+hk.rate_to_usd).toFixed(4)); } }, [isGiftcard, currencies]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = +fx?.rate || 0;
  const toUsd = (v) => (rate > 0 && v !== "" && v != null ? +((+v) / rate).toFixed(2) : null);
  const setLocal = (i, k, v) => { const usdKey = { price_local: "price_usd", sale_price_local: "sale_price_usd", giftcard_value_local: "giftcard_value_usd" }[k]; onChange(specs.map((s, idx) => (idx === i ? { ...s, [k]: v, [usdKey]: v === "" ? (usdKey === "price_usd" ? 0 : null) : toUsd(v) } : s))); };
  const changeRate = (r) => { onFx(fx?.currency, r); const rr = +r || 0; if (rr > 0) onChange(specs.map((s) => ({ ...s, price_usd: s.price_local ? +((+s.price_local) / rr).toFixed(2) : s.price_usd, sale_price_usd: s.sale_price_local ? +((+s.sale_price_local) / rr).toFixed(2) : s.sale_price_usd, giftcard_value_usd: s.giftcard_value_local ? +((+s.giftcard_value_local) / rr).toFixed(2) : s.giftcard_value_usd }))); };
  const changeCurrency = (code) => { const c = currencies.find((x) => x.code === code); onFx(code, c ? +(+c.rate_to_usd).toFixed(4) : rate); if (c) changeRate(+(+c.rate_to_usd).toFixed(4)); };
  const cur = fx?.currency || "HKD";
  const set = (i, k, v) => onChange(specs.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= specs.length) return; const a = [...specs]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div>
      <div className="text-[11px] text-slate-400 mb-2">{tr("售價為實際結帳價格；「原價」填寫後商品頁顯示刪除線。限購：「依角標自動」會依角標文字（每日一單 / 每月一單 / 新客專享）判斷；也可明確指定每日 / 每週 / 每月 / 終生限購份數或新用戶專享。")}{isGiftcard && tr(" 本商品為禮品卡：請以計價幣別填寫金額，系統依匯率自動換算 USD；「卡面額」留空則同售價。")}</div>
      {isGiftcard && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5" data-testid="pf-fx-bar">
          <span className="text-xs font-semibold text-violet-700">{tr("計價幣別")}</span>
          <select data-testid="pf-fx-currency" className={selBase + " w-28"} value={cur} onChange={(e) => changeCurrency(e.target.value)}>{(currencies.length ? currencies : [{ code: "HKD" }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
          <span className="text-xs font-semibold text-violet-700">{tr("匯率")}</span>
          <div className="flex items-center gap-1 text-xs text-slate-600">1 USD = <Input data-testid="pf-fx-rate" type="number" step="0.0001" className="w-28" value={fx?.rate ?? ""} onChange={(e) => changeRate(e.target.value)} /> {cur}</div>
          <span className="text-[11px] text-slate-500">{tr("填寫 {0} 金額後自動換算為 USD 售價；修改匯率會重新換算所有規格。", cur)}</span>
        </div>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="pf-specs-table">
          <thead><tr className="text-left text-xs text-slate-500 bg-slate-50/70 border-b border-slate-200"><th className="px-3 py-2 min-w-[160px]">{tr("規格名稱")}</th><th className="px-3 py-2 w-32">{isGiftcard ? tr("售價 {0}", cur) : tr("售價 USD")}</th><th className="px-3 py-2 w-32">{isGiftcard ? tr("原價 {0}", cur) : tr("原價 USD")}</th>{isGiftcard && <th className="px-3 py-2 w-32">{tr("卡面額 {0}", cur)}</th>}<th className="px-3 py-2 w-44">{tr("角標")}</th><th className="px-3 py-2 w-48">{tr("限購")}</th><th className="px-3 py-2 w-16">{tr("有貨")}</th><th className="px-3 py-2 w-24"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {specs.map((s, i) => (
              <tr key={s.id || i} data-testid={`pf-spec-row-${i}`}>
                <td className="px-3 py-1.5"><Input data-testid={`pf-spec-label-${i}`} className="w-full min-w-[140px]" value={s.label} onChange={(e) => set(i, "label", e.target.value)} placeholder={tr("如 1000 鑽石")} /></td>
                {isGiftcard ? (
                  <>
                    <td className="px-3 py-1.5"><Input data-testid={`pf-spec-price-${i}`} type="number" step="0.01" className="w-full" value={s.price_local ?? ""} onChange={(e) => setLocal(i, "price_local", e.target.value)} placeholder={cur} /><div className="text-[10px] text-emerald-600 mt-0.5 pl-1" data-testid={`pf-spec-price-usd-${i}`}>≈ USD {(+s.price_usd || 0).toFixed(2)}</div></td>
                    <td className="px-3 py-1.5"><Input type="number" step="0.01" className="w-full" value={s.sale_price_local ?? ""} onChange={(e) => setLocal(i, "sale_price_local", e.target.value)} placeholder={tr("選填")} />{s.sale_price_usd ? <div className="text-[10px] text-slate-400 mt-0.5 pl-1">≈ USD {(+s.sale_price_usd).toFixed(2)}</div> : null}</td>
                    <td className="px-3 py-1.5"><Input data-testid={`pf-spec-giftcard-${i}`} type="number" step="0.01" className="w-full" value={s.giftcard_value_local ?? ""} onChange={(e) => setLocal(i, "giftcard_value_local", e.target.value)} placeholder={tr("同售價")} />{s.giftcard_value_usd ? <div className="text-[10px] text-slate-400 mt-0.5 pl-1">≈ USD {(+s.giftcard_value_usd).toFixed(2)}</div> : null}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5"><Input data-testid={`pf-spec-price-${i}`} type="number" step="0.01" className="w-full" value={s.price_usd} onChange={(e) => set(i, "price_usd", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input type="number" step="0.01" className="w-full" value={s.sale_price_usd ?? ""} onChange={(e) => set(i, "sale_price_usd", e.target.value)} placeholder={tr("選填")} /></td>
                  </>
                )}
                <td className="px-3 py-1.5"><Input list="badge-list" data-testid={`pf-spec-badge-${i}`} className="w-full" value={s.badge || ""} onChange={(e) => set(i, "badge", e.target.value)} placeholder={tr("如 每日一單")} /></td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <select data-testid={`pf-spec-limit-${i}`} className={selBase + " flex-1 px-2 text-xs"} value={s.limit || ""} onChange={(e) => set(i, "limit", e.target.value)}>{Object.entries(LIMIT_KINDS).map(([k, v]) => <option key={k} value={k}>{k === "" ? `${v}${inferLimit(s.badge) ? `（${LIMIT_KINDS[inferLimit(s.badge)]}）` : `（${LIMIT_KINDS.none}）`}` : v}</option>)}</select>
                    {["daily", "weekly", "monthly", "lifetime", "newcomer"].includes(s.limit) && <Input data-testid={`pf-spec-limit-count-${i}`} type="number" min="1" className="w-14 px-2 text-xs" value={s.limit_count || 1} onChange={(e) => set(i, "limit_count", e.target.value)} title={tr("份數")} />}
                  </div>
                </td>
                <td className="px-3 py-1.5"><Switch checked={s.in_stock !== false} onCheckedChange={(v) => set(i, "in_stock", v)} /></td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button onClick={() => move(i, -1)} className="p-1 text-slate-400 hover:text-slate-700"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} className="p-1 text-slate-400 hover:text-slate-700"><ArrowDown className="h-4 w-4" /></button>
                  <button data-testid={`pf-spec-remove-${i}`} onClick={() => onChange(specs.filter((_, idx) => idx !== i))} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {specs.length === 0 && <tr><td colSpan={isGiftcard ? 8 : 7} className="px-3 py-8 text-center text-slate-400 text-xs">{tr("尚無規格，請新增")}</td></tr>}
          </tbody>
        </table>
      </Card>
      <datalist id="badge-list">{badges.map((b) => <option key={b} value={b} />)}</datalist>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn kind="ghost" data-testid="pf-add-spec" onClick={() => onChange([...specs, { id: `new-${Date.now()}`, label: "", price_usd: 0, sale_price_usd: null, badge: "", in_stock: true, limit: "", limit_count: 1 }])}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增規格")}</Btn>
      </div>
    </div>
  );
}

function DeliveryEditor({ fields, onChange }) {
  const set = (i, k, v) => onChange(fields.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">{tr("用戶下單時需填寫的資料（如充值帳號、區服、密碼）。第一個欄位作為主要充值帳號。")}</div>
      {fields.map((d, i) => (
        <Card key={i} className="p-4 grid md:grid-cols-4 gap-3 relative" data-testid={`pf-field-${i}`}>
          <div><label className={lbl}>{tr("欄位名稱")} *</label><Input data-testid={`pf-field-name-${i}`} className="w-full" value={d.name} onChange={(e) => set(i, "name", e.target.value)} placeholder={tr("如 抖音帳號")} /></div>
          <div><label className={lbl}>{tr("類型")}</label><select className={sel} value={d.type} onChange={(e) => set(i, "type", e.target.value)}>{Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className={lbl}>{tr("欄位代碼")}</label><Input className="w-full" value={d.code} onChange={(e) => set(i, "code", e.target.value)} placeholder="account" /></div>
          <div className="flex items-end gap-3 pb-1"><label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={d.required !== false} onCheckedChange={(v) => set(i, "required", v)} /> {tr("必填")}</label>
            <button data-testid={`pf-field-remove-${i}`} onClick={() => onChange(fields.filter((_, idx) => idx !== i))} className="ml-auto text-xs text-red-500 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />{tr("移除")}</button></div>
          <div className="md:col-span-2"><label className={lbl}>{tr("輸入提示（placeholder）")}</label><Input className="w-full" value={d.placeholder || ""} onChange={(e) => set(i, "placeholder", e.target.value)} /></div>
          <div className="md:col-span-2"><label className={lbl}>{tr("說明文字（顯示在欄位下方）")}</label><Input className="w-full" value={d.tips || ""} onChange={(e) => set(i, "tips", e.target.value)} /></div>
          {d.type === "select" && <div className="md:col-span-4"><label className={lbl}>{tr("下拉選項（逗號分隔）")}</label><Input className="w-full" value={Array.isArray(d.options) ? d.options.join(", ") : d.options || ""} onChange={(e) => set(i, "options", e.target.value)} placeholder={tr("手機號登入, 郵箱登入")} /></div>}
        </Card>
      ))}
      <Btn kind="ghost" data-testid="pf-add-field" onClick={() => onChange([...fields, { code: `field${fields.length + 1}`, name: "", required: true, placeholder: "", tips: "", type: "text", options: [] }])}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增欄位")}</Btn>
    </div>
  );
}

function RelatedEditor({ related, selfId, callApi, onChange }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => callApi({ method: "GET", url: `/admin/products?q=${encodeURIComponent(q)}&size=8` }).then((r) => setRes(r.data.rows.filter((p) => p.id !== selfId && !related.some((x) => x.id === p.id)))).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q, callApi, selfId, related]);
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">{tr("商品頁底部「相關推薦」，最多 8 個；未設定時自動顯示同分類熱銷商品。")}</div>
      <div className="flex flex-wrap gap-2">
        {related.map((r) => <span key={r.id} data-testid={`pf-related-${r.id}`} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full pl-1 pr-2 py-1 text-xs">{r.image && <img src={r.image} alt="" className="h-6 w-6 rounded-full object-cover" />}{r.name}<button onClick={() => onChange(related.filter((x) => x.id !== r.id))} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button></span>)}
        {related.length === 0 && <span className="text-xs text-slate-400">{tr("尚未選擇")}</span>}
      </div>
      <div className="relative max-w-md"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="pf-related-search" className="pl-8 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("搜尋商品名稱加入推薦")} disabled={related.length >= 8} /></div>
      {res.length > 0 && <Card className="divide-y divide-slate-100 max-w-md">{res.map((p) => <button key={p.id} data-testid={`pf-related-add-${p.id}`} onClick={() => { onChange([...related, { id: p.id, name: p.name, image: p.image }]); setQ(""); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-orange-50"><img src={p.image} alt="" className="h-8 w-8 rounded-lg object-cover" /><span className="truncate">{p.name}</span><Plus className="h-4 w-4 ml-auto text-orange-500" /></button>)}</Card>}
    </div>
  );
}
