import { useEffect } from "react";
import { BellRing, Gift, Package } from "lucide-react";
import { playAlert, loadSoundPrefs } from "@/lib/adminSounds";
import { tr } from "@/i18n";

// Persistent new-order popup: stays until acknowledged, re-plays the order sound every 12s while open.
export function NewOrderAlert({ orders, onView, onClose }) {
  useEffect(() => {
    if (!orders.length) return;
    const id = setInterval(() => playAlert("order", loadSoundPrefs()), 12000);
    return () => clearInterval(id);
  }, [orders.length]);
  if (!orders.length) return null;
  return (
    <div data-testid="new-order-alert" className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="bg-orange-500 text-white px-5 py-4 flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center"><BellRing className="h-5 w-5 animate-[wiggle_1s_ease-in-out_infinite]" /></span>
          <div><div className="font-bold text-base" data-testid="new-order-alert-title">{tr("新訂單：{0} 筆已支付", orders.length)}</div><div className="text-xs text-white/80">{tr("請盡快處理")}</div></div>
        </div>
        <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100" data-testid="new-order-alert-list">
          {orders.map((o) => (
            <li key={o.id} className="px-5 py-3 flex items-start gap-3 text-sm">
              <span className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${o.is_giftcard_order ? "bg-pink-50 text-pink-500" : "bg-orange-50 text-orange-500"}`}>{o.is_giftcard_order ? <Gift className="h-4 w-4" /> : <Package className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800">#{o.order_no || o.id.slice(0, 8)}</span><span className="font-bold text-orange-600">${o.total_usd}</span></div>
                <div className="text-xs text-slate-500 truncate">{(o.items || []).map((it) => `${it.product_name || ""} ${it.spec_label || ""} ×${it.qty || 1}`).join("，")}</div>
                {o.user_email && <div className="text-[11px] text-slate-400 truncate">{o.user_email}</div>}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-5 py-4 flex gap-3 bg-slate-50">
          <button data-testid="new-order-alert-later" onClick={onClose} className="flex-1 h-10 rounded-full border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-white">{tr("稍後處理")}</button>
          <button data-testid="new-order-alert-view" onClick={onView} className="flex-1 h-10 rounded-full bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">{tr("查看訂單")}</button>
        </div>
      </div>
    </div>
  );
}
