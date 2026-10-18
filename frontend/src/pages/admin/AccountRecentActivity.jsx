import { useEffect, useState } from "react";
import { Loader2, History } from "lucide-react";
import { tr } from "@/i18n";
import { STATUS_LABELS } from "@/lib/status";

const fmt = (s) => (s ? s.slice(5, 16).replace("T", " ") : "-");
const TU_LABEL = () => ({ paid: tr("已到賬"), pending: tr("待付款"), expired: tr("已過期"), reviewing: tr("審核中"), rejected: tr("已駁回"), cancelled: tr("已取消") });

export function AccountRecentActivity({ uid, callApi }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!uid) return;
    setD(null);
    callApi({ method: "GET", url: `/admin/members/${uid}/recent` }).then((r) => setD(r.data)).catch(() => setD({ orders: [], topups: [] }));
  }, [uid, callApi]);
  if (!uid) return null;
  return (
    <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50/60 p-3" data-testid="account-recent">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-600"><History className="h-3.5 w-3.5" />{tr("同帳戶近期記錄")}</span>
        {d && <span className="text-[11px] text-slate-400">{tr("累計 {0} 單 / 充值 {1} 筆 · 消費 ${2}", d.order_count, d.topup_count, (d.spent_usd || 0).toLocaleString())}</span>}
      </div>
      {!d ? <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div> : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1">{tr("最近訂單")}</div>
            {(d.orders || []).length === 0 ? <div className="text-[11px] text-slate-400">{tr("無")}</div> : (d.orders || []).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
                <span className="font-mono text-slate-500 truncate max-w-[90px]">{o.order_no}</span>
                <span className="text-slate-400">{fmt(o.created_at)}</span>
                <span className="text-slate-700 font-semibold">${o.total_usd}</span>
                <span className="text-slate-400 w-10 text-right">{STATUS_LABELS[o.status] || o.status}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1">{tr("最近充值")}</div>
            {(d.topups || []).length === 0 ? <div className="text-[11px] text-slate-400">{tr("無")}</div> : (d.topups || []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
                <span className="text-slate-500 truncate max-w-[70px]">{t.own_wallet ? "USDT" : (t.provider || "").toUpperCase()}</span>
                <span className="text-slate-400">{fmt(t.created_at)}</span>
                <span className="text-slate-700 font-semibold">${t.amount_usd}</span>
                <span className={`w-10 text-right ${t.status === "paid" ? "text-emerald-500" : "text-slate-400"}`}>{TU_LABEL()[t.status] || STATUS_LABELS[t.status] || t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
