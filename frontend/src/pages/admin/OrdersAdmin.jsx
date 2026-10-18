import { useCallback, useEffect, useState } from "react";
import { Search, Download, ShieldAlert, Copy, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { Card, Btn, Input, Pill, Head } from "@/pages/admin/ui";
import { STATUS_LABELS, StatusBadge } from "@/lib/status";
import { tr } from "@/i18n";
import { UserInfoDialog } from "@/pages/admin/UserInfoDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const selBase = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";
const ALL_STATUSES = Object.keys(STATUS_LABELS);
const fmt = (s) => (s ? s.slice(0, 19).replace("T", " ") : "-");
const PRESETS = [["today", tr("今天")], ["7", tr("近 7 天")], ["30", tr("近 30 天")], ["month", tr("本月")]];
const iso = (d) => d.toISOString().slice(0, 10);
const presetRange = (k) => {
  const now = new Date(); const to = iso(now);
  if (k === "today") return [to, to];
  if (k === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), to];
  const from = new Date(now); from.setDate(from.getDate() - (+k - 1)); return [iso(from), to];
};

export function OrdersAdmin({ callApi }) {
  const [data, setData] = useState({ total: 0, rows: [], summary: { total_usd: 0, paid_usd: 0, by_status: {} } });
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [viewUid, setViewUid] = useState("");
  const [exporting, setExporting] = useState(false);
  const size = 30;

  useEffect(() => { const t = setTimeout(() => { setQd(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const params = `status=${status}&q=${encodeURIComponent(qd)}&date_from=${from}&date_to=${to}`;
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/orders?${params}&page=${page}&size=${size}` }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, params, page]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); } };
  const confirmTopup = (o) => window.confirm(tr("確認已完成人工充值？訂單 {0} 將標記為「已完成」", o.order_no)) && act(() => callApi({ method: "POST", url: `/admin/orders/${o.id}/confirm` }), tr("已確認充值，訂單完成"));
  const changeStatus = (o, s) => act(() => callApi({ method: "PATCH", url: `/admin/orders/${o.id}`, data: { status: s } }), tr("已更新為「{0}」", STATUS_LABELS[s]));
  const rejectInfo = (o) => { const reason = window.prompt(tr("駁回原因（將顯示給用戶）"), tr("充值帳號有誤，請重新填寫")); if (reason !== null) act(() => callApi({ method: "POST", url: `/admin/orders/${o.id}/reject-info`, data: { reason } }), tr("已駁回，用戶可重新填寫充值資料")); };
  const cancelOrder = (o) => { const reason = window.prompt(tr("取消原因（將通知用戶；已用錢包付款的訂單會自動退回餘額）"), o.admin_note || ""); if (reason !== null) act(() => callApi({ method: "PATCH", url: `/admin/orders/${o.id}`, data: { status: "cancelled", admin_note: reason } }), tr("訂單已取消")); };
  const addNote = (o) => { const note = window.prompt(tr("客服備註"), o.admin_note || ""); if (note !== null) act(() => callApi({ method: "PATCH", url: `/admin/orders/${o.id}`, data: { status: o.status, admin_note: note } }), tr("備註已更新")); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await callApi({ method: "GET", url: `/admin/orders/export?${params}`, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `orders_${from || "all"}_${to || "now"}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success(tr("已匯出 CSV"));
    } catch { toast.error(tr("匯出失敗")); }
    setExporting(false);
  };

  const pages = Math.max(1, Math.ceil(data.total / size));
  const bs = data.summary?.by_status || {};
  const tabs = [["all", tr("全部"), Object.values(bs).reduce((a, b) => a + b, 0)], ...ALL_STATUSES.map((s) => [s, STATUS_LABELS[s], bs[s] || 0]), ["awaiting_info", tr("待填資料"), null]];

  return (
    <div data-testid="orders-admin">
      <Head title={tr("訂單管理")} sub={tr("搜尋訂單號 / 用戶信箱 / 充值帳號 / 商品名稱，可按日期區間篩選並匯出 CSV。")}
        right={<Btn data-testid="orders-export" kind="ghost" onClick={exportCsv} disabled={exporting}><Download className="h-4 w-4 inline -mt-0.5 mr-1" />{exporting ? tr("匯出中…") : tr("匯出 CSV（目前篩選）")}</Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[[tr("篩選結果訂單數"), data.total], [tr("訂單總額 (USD)"), `$${(data.summary?.total_usd || 0).toLocaleString()}`], [tr("已付款金額 (USD)"), `$${(data.summary?.paid_usd || 0).toLocaleString()}`], [tr("待處理（已付/充值中）"), (bs.paid || 0) + (bs.processing || 0)]].map(([l, v], i) => (
          <Card key={i} className="p-4" data-testid={`orders-stat-${i}`}><div className="text-xs text-slate-500">{l}</div><div className="font-head text-xl font-bold text-slate-900 mt-1">{v}</div></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" /><Input data-testid="orders-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("訂單號 / 信箱 / 充值帳號 / 商品")} className="pl-8 w-72" /></div>
        <Input data-testid="orders-date-from" type="date" className="w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <span className="text-slate-400 text-xs">~</span>
        <Input data-testid="orders-date-to" type="date" className="w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        {PRESETS.map(([k, l]) => <button key={k} data-testid={`orders-preset-${k}`} onClick={() => { const [a, b] = presetRange(k); setFrom(a); setTo(b); setPage(1); }} className="h-9 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-orange-300">{l}</button>)}
        {(from || to || q) && <button data-testid="orders-clear" onClick={() => { setFrom(""); setTo(""); setQ(""); setPage(1); }} className="text-xs text-slate-500 underline">{tr("清除")}</button>}
      </div>
      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4">
        {tabs.map(([k, label, n]) => (
          <button key={k} data-testid={`orders-tab-${k}`} onClick={() => { setStatus(k); setPage(1); }} className={`whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5 ${status === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{label}{n !== null && n !== undefined ? ` ${n}` : ""}</button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="orders-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{[tr("訂單"), tr("用戶"), tr("商品"), tr("充值帳號"), tr("金額"), tr("狀態"), tr("操作")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{tr("暫無訂單")}</td></tr>}
            {data.rows.map((o) => (
              <tr key={o.id} data-testid={`order-row-${o.id}`} className="hover:bg-orange-50/40">
                <td className="px-4 py-2.5 whitespace-nowrap"><div className="font-mono text-xs text-slate-800 flex items-center gap-1">{o.order_no}<button onClick={() => { navigator.clipboard?.writeText(o.order_no); toast.success(tr("已複製")); }} className="text-slate-300 hover:text-orange-500"><Copy className="h-3 w-3" /></button></div><div className="text-[11px] text-slate-400">{fmt(o.created_at)}</div></td>
                <td className="px-4 py-2.5 text-xs max-w-[200px]">{o.user_id ? <button data-testid={`order-user-${o.id}`} onClick={() => setViewUid(o.user_id)} className="text-orange-600 font-semibold hover:underline truncate block max-w-full text-left" title={tr("查看用戶信息")}>{o.user_email || o.user_id}</button> : <span className="text-slate-600 truncate block">{o.user_email || "-"}</span>}</td>
                <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[280px]"><div className="truncate">{o.items.map((i) => `${i.product_name} ${i.spec_label}×${i.quantity}`).join("、")}</div></td>
                <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[160px] truncate">{o.recharge_account}{o.status === "paid" && o.info_submitted === false && <Pill tone="amber">{o.info_rejected ? tr("已駁回") : tr("未填資料")}</Pill>}</td>
                <td className="px-4 py-2.5 text-xs text-slate-800 whitespace-nowrap font-semibold">{o.currency_symbol}{(o.total_usd * o.rate_to_usd).toFixed(2)} <span className="text-slate-400 font-normal">{o.currency}</span>{o.currency !== "USD" && <div className="text-[11px] text-slate-400 font-normal">≈ ${o.total_usd}</div>}</td>
                <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2.5"><button data-testid={`order-open-${o.id}`} onClick={() => setDetailId(o.id)} className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"><FileSearch className="h-3.5 w-3.5" />{tr("詳情 / 操作")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4" data-testid="orders-pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 px-3 rounded-full text-xs bg-white border border-slate-200 disabled:opacity-40">‹</button>
          <span className="text-xs text-slate-500">{tr("第 {0} / {1} 頁", page, pages)}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="h-8 px-3 rounded-full text-xs bg-white border border-slate-200 disabled:opacity-40">›</button>
        </div>
      )}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="order-detail-dialog">
          {(() => {
            const o = data.rows.find((x) => x.id === detailId);
            if (!o) return null;
            const Info = ({ label, children }) => (
              <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-[13px] text-slate-500 shrink-0">{label}</span>
                <span className="text-[13px] text-slate-800 text-right break-all">{children}</span>
              </div>
            );
            return (
              <div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] text-white/70">{tr("訂單")}</div>
                      <div className="font-mono text-sm font-bold flex items-center gap-1.5 truncate">{o.order_no}<button onClick={() => { navigator.clipboard?.writeText(o.order_no); toast.success(tr("已複製")); }} className="text-white/60 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button></div>
                      <div className="text-[11px] text-white/60 mt-0.5">{fmt(o.created_at)}</div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <div className="px-5 py-3 max-h-[46vh] overflow-y-auto">
                  {o.user_id && <Info label={tr("用戶")}><button onClick={() => { setDetailId(null); setViewUid(o.user_id); }} className="text-orange-600 font-semibold hover:underline">{o.user_email || o.user_id}</button></Info>}
                  <Info label={tr("商品")}>{o.items.map((i) => `${i.product_name} ${i.spec_label}×${i.quantity}`).join("、")}</Info>
                  <Info label={tr("充值帳號")}><b>{o.recharge_account}</b></Info>
                  <Info label={tr("金額")}>{o.currency_symbol}{(o.total_usd * o.rate_to_usd).toFixed(2)} {o.currency}{o.currency !== "USD" && ` ≈ $${o.total_usd}`}</Info>
                  {o.delivery_info && Object.values(o.delivery_info).flatMap((f) => Object.entries(f)).map(([k, v]) => <Info key={k} label={k}>{v}</Info>)}
                  {o.recharge_note && <Info label={tr("備註")}>{o.recharge_note}</Info>}
                  {o.contact && <Info label={tr("聯絡")}>{o.contact}</Info>}
                  {o.promo_code && <Info label={tr("優惠碼")}>{o.promo_code}（-${o.discount_usd}）</Info>}
                  <Info label={tr("付款時間")}>{fmt(o.paid_at)}</Info>
                  <Info label={tr("完成時間")}>{fmt(o.completed_at)}{o.confirmed_by && ` · ${o.confirmed_by}`}</Info>
                  {o.admin_note && <Info label={tr("客服備註")}><span className="text-emerald-600">{o.admin_note}</span></Info>}
                  {o.refunded_at && <Info label={tr("退款")}><span className="text-emerald-600">{tr("已退回錢包 USD$ {0}", Number(o.refund_usd || 0).toFixed(2))}</span></Info>}
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2 justify-end bg-slate-50/60">
                  {["paid", "processing", "shipped"].includes(o.status) && <button data-testid={`admin-order-confirm-${o.id}`} onClick={() => confirmTopup(o)} className="text-xs h-8 px-3 rounded-lg bg-emerald-500 text-white font-semibold">{tr("確認充值完成")}</button>}
                  {["paid", "processing"].includes(o.status) && o.info_submitted !== false && <button data-testid={`admin-order-reject-info-${o.id}`} onClick={() => rejectInfo(o)} className="text-xs h-8 px-3 rounded-lg bg-amber-500 text-white">{tr("駁回充值資料")}</button>}
                  {o.status === "paid" && <button data-testid={`admin-order-start-${o.id}`} onClick={() => changeStatus(o, "processing")} className="text-xs h-8 px-3 rounded-lg bg-violet-600 text-white">{tr("開始充值")}</button>}
                  {o.status === "processing" && <button data-testid={`admin-order-ship-${o.id}`} onClick={() => changeStatus(o, "shipped")} className="text-xs h-8 px-3 rounded-lg bg-cyan-600 text-white">{tr("確認人工發貨")}</button>}
                  {o.status === "shipped" && <button onClick={() => changeStatus(o, "completed")} className="text-xs h-8 px-3 rounded-lg bg-emerald-600 text-white">{tr("標記已完成")}</button>}
                  {!["completed", "exception", "cancelled"].includes(o.status) && <button onClick={() => changeStatus(o, "exception")} className="text-xs h-8 px-3 rounded-lg bg-red-500 text-white flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> {tr("標記異常")}</button>}
                  {!["completed", "cancelled"].includes(o.status) && <button data-testid={`admin-order-cancel-${o.id}`} onClick={() => cancelOrder(o)} className="text-xs h-8 px-3 rounded-lg border border-red-300 text-red-600 bg-white">{tr("取消訂單")}</button>}
                  <select data-testid={`admin-order-status-${o.id}`} value={o.status} onChange={(e) => changeStatus(o, e.target.value)} className={selBase + " h-8 text-xs"}>{ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
                  <button data-testid={`admin-order-note-${o.id}`} onClick={() => addNote(o)} className="text-xs h-8 px-3 rounded-lg border border-slate-300 text-slate-600 bg-white">{tr("備註")}</button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <UserInfoDialog uid={viewUid} callApi={callApi} onClose={() => setViewUid("")} />
    </div>
  );
}
