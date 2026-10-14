export const STATUS_LABELS = {
  pending_payment: tr("待支付"),
  paid: tr("等待中"),
  processing: tr("充值中"),
  shipped: tr("已發貨"),
  completed: tr("已完成"),
  exception: tr("異常"),
  cancelled: tr("已取消"),
};

export const STATUS_COLORS = {
  pending_payment: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-orange-100 text-orange-600 border-orange-200",
  processing: "bg-amber-100 text-amber-700 border-amber-200",
  shipped: "bg-orange-50 text-orange-500 border-orange-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  exception: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export const orderLabel = (o) => (o.status === "paid" && o.info_submitted === false ? tr("等待填寫資料") : STATUS_LABELS[o.status]);

export const STATUS_ORDER = ["pending_payment", "paid", "processing", "shipped", "completed"];

export function StatusBadge({ status }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

import { tr } from "@/i18n";