export const ROLE_LABELS = {
  admin: "平台管理",
  agent: "代理商",
  merchant: "商户",
};

export const STATUS_MAP = {
  pending: { label: "待支付", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", dot: "bg-amber-400" },
  paid: { label: "已支付", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", dot: "bg-emerald-400" },
  expired: { label: "超时未付", color: "text-slate-400", bg: "bg-slate-400/10 border-slate-500/30", dot: "bg-slate-500" },
  abnormal: { label: "异常调账", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", dot: "bg-red-400" },
};

export const PAYOUT_STATUS = {
  pending: { label: "待审核", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30" },
  approved: { label: "已放款", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  rejected: { label: "已驳回", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
};

export const NETWORK_COLORS = {
  TRC20: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  ERC20: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  BEP20: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

export function fmtUSDT(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function shortHash(h, n = 8) {
  if (!h) return "-";
  if (h.length <= n * 2) return h;
  return `${h.slice(0, n)}...${h.slice(-6)}`;
}
