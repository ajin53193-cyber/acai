import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, AlertTriangle, PackageCheck } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Pill } from "./ui";

export function InventoryAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({});
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/inventory?q=${encodeURIComponent(q)}&only_low=${onlyLow}` }).then((r) => { setRows(r.data); setDraft({}); }).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, q, onlyLow]);
  useEffect(() => { load(); }, [load]);

  const key = (r) => `${r.product_id}:${r.spec_id}`;
  const toggle = async (r) => {
    try { await callApi({ method: "PUT", url: "/admin/inventory", data: { product_id: r.product_id, spec_id: r.spec_id, in_stock: !r.in_stock } }); setRows((rs) => rs.map((x) => key(x) === key(r) ? { ...x, in_stock: !x.in_stock } : x)); }
    catch { toast.error(tr("更新失敗")); }
  };
  const saveStock = async (r) => {
    const v = draft[key(r)];
    if (v === undefined) return;
    try { await callApi({ method: "PUT", url: "/admin/inventory", data: { product_id: r.product_id, spec_id: r.spec_id, stock: v === "" ? null : +v } }); toast.success(tr("庫存已更新")); setRows((rs) => rs.map((x) => key(x) === key(r) ? { ...x, stock: v === "" ? null : +v } : x)); setDraft((d) => { const n = { ...d }; delete n[key(r)]; return n; }); }
    catch { toast.error(tr("更新失敗")); }
  };

  return (
    <div data-testid="inventory-admin">
      <Head title={tr("庫存管理")} sub={tr("統一管理所有商品規格的售罄開關與庫存數量（庫存留空＝不限量）")} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="inv-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={tr("搜尋商品 / 規格")} className="pl-8 w-64" /></div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" data-testid="inv-only-low" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="h-4 w-4 accent-orange-500" />{tr("僅看低庫存(≤5)")}</label>
        <Btn kind="ghost" data-testid="inv-refresh" onClick={load}>{tr("查詢")}</Btn>
      </div>
      <Table testId="inventory-table" cols={[tr("商品"), tr("規格"), tr("價格"), tr("庫存數量"), tr("狀態"), tr("操作")]}
        empty={rows === null ? tr("載入中…") : tr("暫無規格")} rows={rows || []} render={(r, i) => {
          const low = r.stock !== null && r.stock !== undefined && r.stock <= 5;
          return (
            <tr key={i} data-testid={`inv-row-${i}`} className="hover:bg-orange-50/30">
              <td className="px-4 py-2.5"><div className="flex items-center gap-2"><img src={r.image} alt="" className="h-8 w-8 rounded object-cover bg-slate-100" /><span className="font-medium text-slate-800">{r.product_name}</span>{!r.active && <Pill tone="slate">{tr("已下架")}</Pill>}</div></td>
              <td className="px-4 py-2.5 text-slate-600">{r.label}</td>
              <td className="px-4 py-2.5 text-slate-500">${r.price_usd}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Input data-testid={`inv-stock-${i}`} type="number" className="w-24" value={draft[key(r)] ?? (r.stock ?? "")} placeholder={tr("不限")} onChange={(e) => setDraft((d) => ({ ...d, [key(r)]: e.target.value }))} />
                  {draft[key(r)] !== undefined && <Btn data-testid={`inv-stock-save-${i}`} onClick={() => saveStock(r)}>{tr("保存")}</Btn>}
                  {low && <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 font-semibold"><AlertTriangle className="h-3 w-3" />{tr("低庫存")}</span>}
                </div>
              </td>
              <td className="px-4 py-2.5">{r.in_stock ? <Pill tone="emerald">{tr("有貨")}</Pill> : <Pill tone="red">{tr("售罄")}</Pill>}</td>
              <td className="px-4 py-2.5"><Btn kind={r.in_stock ? "danger" : "ok"} data-testid={`inv-toggle-${i}`} onClick={() => toggle(r)}>{r.in_stock ? tr("設為售罄") : tr("恢復有貨")}</Btn></td>
            </tr>
          );
        }} />
      {rows && <div className="text-xs text-slate-400 mt-3 flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />{tr("共 {0} 個規格", rows.length)}</div>}
    </div>
  );
}
