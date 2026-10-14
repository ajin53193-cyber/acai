import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Search, X } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, useLoad } from "./ui";

const empty = { title: "", image: "", items: [], price_usd: 0, active: true, sort_order: 0 };

function ItemAdder({ callApi, onAdd }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => callApi({ method: "GET", url: `/admin/products?q=${encodeURIComponent(q)}&size=6` }).then((r) => setRes(r.data.rows)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q, callApi]);
  if (sel) return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
      <img src={sel.image} alt="" className="h-8 w-8 rounded object-cover" />
      <span className="text-sm truncate flex-1">{sel.name}</span>
      <select data-testid="combo-spec-select" className="h-8 rounded bg-white border px-2 text-xs" id="combo-spec">
        {(sel.specs || []).map((s) => <option key={s.id} value={s.id}>{s.label} (${Number(s.price_usd).toFixed(2)})</option>)}
      </select>
      <Btn data-testid="combo-item-confirm" onClick={() => { const specId = document.getElementById("combo-spec").value; const sp = sel.specs.find((s) => s.id === specId); onAdd({ product_id: sel.id, spec_id: specId, product_name: sel.name, image: sel.image, spec_label: sp.label, quantity: 1 }); setSel(null); setQ(""); }}>{tr("加入")}</Btn>
      <button onClick={() => setSel(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
    </div>
  );
  return (
    <div>
      <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="combo-item-search" className="pl-8 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("搜尋商品加入套餐")} /></div>
      {res.length > 0 && <div className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto">{res.map((p) => <button key={p.id} data-testid={`combo-prod-${p.id}`} onClick={() => setSel(p)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-orange-50"><img src={p.image} alt="" className="h-7 w-7 rounded object-cover" /><span className="truncate">{p.name}</span></button>)}</div>}
    </div>
  );
}

export function CombosAdmin({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/combos");
  const [edit, setEdit] = useState(null);
  const save = async () => {
    if (!edit.title.trim()) return toast.error(tr("請輸入套餐名稱"));
    if (!edit.items.length) return toast.error(tr("請至少加入一個商品"));
    if (!edit.price_usd || edit.price_usd <= 0) return toast.error(tr("請輸入套餐價"));
    const body = { title: edit.title, image: edit.image, price_usd: +edit.price_usd, active: edit.active, sort_order: +edit.sort_order || 0,
      items: edit.items.map((i) => ({ product_id: i.product_id, spec_id: i.spec_id, quantity: Math.max(1, +i.quantity || 1) })) };
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/combos/${edit.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/combos", data: body });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (c) => { if (!window.confirm(tr("刪除此套餐？"))) return; await callApi({ method: "DELETE", url: `/admin/combos/${c.id}` }); load(); };
  const origTotal = (edit?.items || []).reduce((s, i) => s + 0, 0); // display only

  return (
    <div data-testid="combos-admin">
      <Head title={tr("組合套餐")} sub={tr("將多個商品打包成一個套餐價，首頁展示、下單自動套用套餐優惠")} right={<Btn data-testid="combo-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增套餐")}</Btn>} />
      <Table testId="combos-table" cols={[tr("套餐"), tr("包含商品"), tr("套餐價"), tr("原價"), tr("狀態"), tr("操作")]} empty={list === null ? tr("載入中…") : tr("暫無套餐")} rows={list || []} render={(c) => (
        <tr key={c.id} data-testid={`combo-row-${c.id}`} className={`hover:bg-orange-50/30 ${c.active ? "" : "opacity-60"}`}>
          <td className="px-4 py-2"><div className="flex items-center gap-2 max-w-[200px]">{c.image ? <img src={c.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center"><Package className="h-4 w-4 text-rose-500" /></span>}<span className="truncate font-semibold text-slate-800">{c.title}</span></div></td>
          <td className="px-4 py-2 text-xs text-slate-500">{(c.items || []).map((i) => `${i.product_name}×${i.quantity}`).join("、")}</td>
          <td className="px-4 py-2 font-head font-bold text-rose-600">${Number(c.price_usd).toFixed(2)}</td>
          <td className="px-4 py-2 text-xs text-slate-400 line-through">${Number(c.original_total_usd || 0).toFixed(2)}</td>
          <td className="px-4 py-2">{c.active ? <Pill tone="emerald">{tr("啟用中")}</Pill> : <Pill tone="slate">{tr("已停用")}</Pill>}</td>
          <td className="px-4 py-2"><div className="flex gap-1.5"><Btn kind="ghost" data-testid={`combo-edit-${c.id}`} onClick={() => setEdit({ ...c })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`combo-del-${c.id}`} onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5" /></Btn></div></td>
        </tr>
      )} />
      {edit && (
        <Modal testId="combo-modal" title={<span className="flex items-center gap-2"><Package className="h-4 w-4 text-rose-500" />{edit.id ? tr("編輯套餐") : tr("新增組合套餐")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="combo-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("套餐名稱")}><Input data-testid="combo-title" className="w-full" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("套餐價 USD$")}><Input data-testid="combo-price" type="number" step="0.01" className="w-full" value={edit.price_usd} onChange={(e) => setEdit({ ...edit, price_usd: e.target.value })} /></Field>
            <Field label={tr("排序（小在前）")}><Input type="number" className="w-full" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} /></Field>
          </div>
          <Field label={tr("套餐封面圖網址（選填）")}><Input className="w-full" value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value })} placeholder="https://..." /></Field>
          <Field label={tr("包含商品")}>
            <div className="space-y-1.5 mb-2">
              {(edit.items || []).map((it, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5" data-testid={`combo-item-${i}`}>
                  <img src={it.image} alt="" className="h-7 w-7 rounded object-cover" />
                  <span className="text-sm truncate flex-1">{it.product_name} · {it.spec_label}</span>
                  <Input type="number" min="1" className="w-14 h-7 text-xs" value={it.quantity} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) })} />
                  <button onClick={() => setEdit({ ...edit, items: edit.items.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <ItemAdder callApi={callApi} onAdd={(it) => setEdit((e) => ({ ...e, items: [...e.items, it] }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid="combo-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用此套餐")}</label>
        </Modal>
      )}
    </div>
  );
}
