export const STATUS_LABELS = {
  pending_payment: "待支付",
  paid: "等待中",
  processing: "充值中",
  shipped: "已發貨",
  completed: "已完成",
  exception: "異常",
};

export const STATUS_COLORS = {
  pending_payment: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-blue-100 text-blue-700 border-blue-200",
  processing: "bg-violet-100 text-violet-700 border-violet-200",
  shipped: "bg-cyan-100 text-cyan-700 border-cyan-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  exception: "bg-red-100 text-red-700 border-red-200",
};

export const orderLabel = (o) => (o.status === "paid" && o.info_submitted === false ? "待填寫資料" : STATUS_LABELS[o.status]);

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
