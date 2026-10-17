import { BellRing, Gift, Package, UserRoundPen } from "lucide-react";
import { tr } from "@/i18n";

// Persistent popup for new paid orders / orders entering the manual-transfer queue; sound plays once (from useAdminAlerts).
export function NewOrderAlert({ orders, onView, onClose }) {
  if (!orders.length) return null;
  const manual = orders.filter((o) => o.manual).length;
  const paid = orders.length - manual;
  const title = manual && !paid ? tr("待人工轉贈：{0} 筆", manual) : paid && !manual ? tr("新訂單：{0} 筆已支付", paid) : tr("新訂單 {0} 筆 · 待人工轉贈 {1} 筆", paid, manual);
  const sub = manual ? tr("用戶已重新提交 AlipayHK 帳號，請人工完成轉贈") : tr("請盡快處理");
  return (
    <div data-testid="new-order-alert" className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className={`${manual && !paid ? "bg-red-500" : "bg-orange-500"} text-white px-5 py-4 flex items-center gap-3`}>
          <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center"><BellRing className="h-5 w-5 animate-[wiggle_1s_ease-in-out_infinite]" /></span>
          <div><div className="font-bold text-base" data-testid="new-order-alert-title">{title}</div><div className="text-xs text-white/80">{sub}</div></div>
        </div>
        <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100" data-testid="new-order-alert-list">
          {orders.map((o) => (
            <li key={o.id} className="px-5 py-3 flex items-start gap-3 text-sm">
              <span className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${o.manual ? "bg-red-50 text-red-500" : o.is_giftcard_order ? "bg-pink-50 text-pink-500" : "bg-orange-50 text-orange-500"}`}>{o.manual ? <UserRoundPen className="h-4 w-4" /> : o.is_giftcard_order ? <Gift className="h-4 w-4" /> : <Package className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800 flex items-center gap-1.5">{o.manual && <span data-testid="new-order-manual-tag" className="rounded-md bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">{tr("待人工")}</span>}{o.platform && <span data-testid="new-order-platform" className="rounded-md bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold">{o.platform.name}</span>}#{o.order_no || o.id.slice(0, 8)}</span><span className="font-bold text-orange-600">${o.total_usd}</span></div>
                <div className="text-xs text-slate-500 truncate">{(o.items || []).map((it) => `${it.product_name || ""} ${it.spec_label || ""} ×${it.qty || it.quantity || 1}`).join("，")}</div>
                {o.manual && o.recharge_account && <div className="text-[11px] text-red-600 font-semibold">{tr("轉贈帳號：{0}", o.recharge_account)}</div>}
                {o.user_email && <div className="text-[11px] text-slate-400 truncate">{o.user_email}</div>}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-5 py-4 flex gap-3 bg-slate-50">
          <button data-testid="new-order-alert-later" onClick={onClose} className="flex-1 h-10 rounded-full border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-white">{tr("稍後處理")}</button>
          <button data-testid="new-order-alert-view" onClick={onView} className="flex-1 h-10 rounded-full bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">{manual && !paid ? tr("前往人工轉贈") : tr("查看訂單")}</button>
        </div>
      </div>
    </div>
  );
}
