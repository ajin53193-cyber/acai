import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, Search } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, useLoad, fmt } from "./ui";

const empty = { title: "", product_id: "", spec_id: "", flash_price_usd: 0, stock: 100, per_user_limit: 1, start_at: "", end_at: "", active: true };
const selCls = "w-full h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";

function ProductPicker({ callApi, product, onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => callApi({ method: "GET", url: `/admin/products?q=${encodeURIComponent(q)}&size=8` }).then((r) => setRes(r.data.rows)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q, callApi]);
  return (
    <div>
      {product ? (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-lg p-2" data-testid="fs-picked-product">
          <img src={product.image} alt="" className="h-9 w-9 rounded-lg object-cover" />
          <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-800 truncate">{product.name}</div><div className="text-[11px] text-slate-400">{(product.specs || []).length} {tr("個規格")}</div></div>
          <button onClick={() => onPick(null)} className="text-xs text-red-500">{tr("更換")}</button>
        </div>
      ) : (
        <>
          <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="fs-product-search" className="pl-8 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("搜尋商品名稱 / ID")} /></div>
          {res.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {res.map((p) => <button key={p.id} data-testid={`fs-product-opt-${p.id}`} onClick={() => { onPick(p); setQ(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50"><img src={p.image} alt="" className="h-7 w-7 rounded object-cover" /><span className="truncate">{p.name}</span></button>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FlashSaleAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/flash-sales");
  const [edit, setEdit] = useState(null);
  const [product, setProduct] = useState(null);

  const openNew = () => { setProduct(null); setEdit({ ...empty }); };
  const openEdit = async (fs) => {
    try { const r = await callApi({ method: "GET", url: `/admin/products/${fs.product_id}` }); setProduct(r.data); } catch { setProduct(null); }
    setEdit({ ...fs, start_at: (fs.start_at || "").slice(0, 16), end_at: (fs.end_at || "").slice(0, 16) });
  };
  const pickProduct = (p) => { setProduct(p); setEdit((e) => ({ ...e, product_id: p?.id || "", spec_id: p?.specs?.[0]?.id || "" })); };

  const save = async () => {
    if (!edit.product_id || !edit.spec_id) return toast.error(tr("請選擇商品與規格"));
    if (!edit.flash_price_usd || edit.flash_price_usd <= 0) return toast.error(tr("請輸入秒殺價"));
    const body = { ...edit, flash_price_usd: +edit.flash_price_usd, stock: Math.max(1, +edit.stock || 1), per_user_limit: Math.max(0, +edit.per_user_limit || 0) };
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/flash-sales/${edit.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/flash-sales", data: body });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (fs) => { if (!window.confirm(tr("刪除此秒殺活動？"))) return; await callApi({ method: "DELETE", url: `/admin/flash-sales/${fs.id}` }); load(); };
  const specs = product?.specs || [];

  return (
    <div data-testid="flashsale-admin">
      <Head title={tr("秒殺活動")} sub={tr("指定商品規格限時特價、限量搶購，首頁展示倒計時")} right={<Btn data-testid="fs-add" onClick={openNew}><Plus className="h-4 w-4" />{tr("新增秒殺")}</Btn>} />
      <Table testId="fs-table" cols={[tr("商品"), tr("規格"), tr("秒殺價"), tr("原價"), tr("已搶/庫存"), tr("限購"), tr("結束時間"), tr("狀態"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("暫無活動")} rows={list || []} render={(fs) => (
        <tr key={fs.id} data-testid={`fs-row-${fs.id}`} className={`hover:bg-orange-50/30 ${fs.active ? "" : "opacity-60"}`}>
          <td className="px-4 py-2"><div className="flex items-center gap-2 max-w-[220px]"><img src={fs.image} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" /><span className="truncate text-slate-800">{fs.product_name}</span></div></td>
          <td className="px-4 py-2 text-xs text-slate-600">{fs.spec_label}</td>
          <td className="px-4 py-2 font-head font-bold text-rose-600">${Number(fs.flash_price_usd).toFixed(2)}</td>
          <td className="px-4 py-2 text-xs text-slate-400 line-through">{fs.original_price_usd != null ? `$${Number(fs.original_price_usd).toFixed(2)}` : "-"}</td>
          <td className="px-4 py-2 text-xs"><span className="text-orange-600 font-semibold">{fs.sold || 0}</span> / {fs.stock}</td>
          <td className="px-4 py-2 text-xs text-slate-600">{fs.per_user_limit > 0 ? tr("每人 {0}", fs.per_user_limit) : tr("不限")}</td>
          <td className="px-4 py-2 text-xs text-slate-500">{fmt(fs.end_at)}</td>
          <td className="px-4 py-2">{fs.active ? <Pill tone="emerald">{tr("啟用中")}</Pill> : <Pill tone="slate">{tr("已停用")}</Pill>}</td>
          <td className="px-4 py-2"><div className="flex gap-1.5"><Btn kind="ghost" data-testid={`fs-edit-${fs.id}`} onClick={() => openEdit(fs)}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`fs-del-${fs.id}`} onClick={() => del(fs)}><Trash2 className="h-3.5 w-3.5" /></Btn></div></td>
        </tr>
      )} />
      {edit && (
        <Modal testId="fs-modal" title={<span className="flex items-center gap-2"><Zap className="h-4 w-4 text-rose-500" />{edit.id ? tr("編輯秒殺") : tr("新增秒殺活動")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="fs-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("活動名稱（選填，預設用商品名）")}><Input data-testid="fs-title" className="w-full" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label={tr("秒殺商品")}><ProductPicker callApi={callApi} product={product} onPick={pickProduct} /></Field>
          {product && (
            <Field label={tr("規格")}>
              <select data-testid="fs-spec" className={selCls} value={edit.spec_id} onChange={(e) => setEdit({ ...edit, spec_id: e.target.value })}>
                {specs.map((s) => <option key={s.id} value={s.id}>{s.label}（${Number(s.price_usd).toFixed(2)}）</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label={tr("秒殺價 USD$")}><Input data-testid="fs-price" type="number" step="0.01" className="w-full" value={edit.flash_price_usd} onChange={(e) => setEdit({ ...edit, flash_price_usd: e.target.value })} /></Field>
            <Field label={tr("庫存限量")}><Input data-testid="fs-stock" type="number" className="w-full" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} /></Field>
            <Field label={tr("每人限購（0 不限）")}><Input data-testid="fs-limit" type="number" className="w-full" value={edit.per_user_limit} onChange={(e) => setEdit({ ...edit, per_user_limit: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("開始時間（選填）")}><Input type="datetime-local" className="w-full" value={edit.start_at} onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} /></Field>
            <Field label={tr("結束時間")}><Input type="datetime-local" className="w-full" value={edit.end_at} onChange={(e) => setEdit({ ...edit, end_at: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid="fs-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用此活動")}</label>
        </Modal>
      )}
    </div>
  );
}
