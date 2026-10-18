import { useEffect, useState } from "react";
import { Loader2, Copy, X, BadgeCheck, Ban, Mail, Phone, Wallet, ShoppingBag, Crown } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Modal } from "@/pages/admin/ui";

const copy = (v) => { if (v) { navigator.clipboard?.writeText(String(v)); toast.success(tr("已複製")); } };
const fmt = (s) => s ? new Date(s).toLocaleString() : "-";

export function UserInfoDialog({ uid, callApi, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!uid) return;
    setD(null); setErr("");
    callApi({ method: "GET", url: `/admin/members/${uid}` }).then((r) => setD(r.data)).catch((e) => setErr(e.response?.data?.detail || tr("載入失敗")));
  }, [uid, callApi]);
  const Row = ({ icon: Icon, label, value, mono, copyable }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-[13px] text-slate-500 w-20 shrink-0">{label}</span>
      <span className={`flex-1 text-[13px] text-slate-800 ${mono ? "font-mono" : ""} break-all`}>{value ?? "-"}</span>
      {copyable && value ? <button onClick={() => copy(value)} className="text-slate-400 hover:text-orange-600"><Copy className="h-3.5 w-3.5" /></button> : null}
    </div>
  );
  if (!uid) return null;
  return (
    <Modal bare size="sm" testId="user-info-dialog" onClose={onClose}>
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white px-5 py-4">
          <div className="text-[12px] text-white/80 font-semibold">{tr("帳戶ID")}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-head text-2xl font-extrabold" data-testid="user-info-account">{d?.account_no || "…"}</span>
            {d?.account_no && <button onClick={() => copy(d.account_no)} className="text-white/80 hover:text-white"><Copy className="h-4 w-4" /></button>}
          </div>
          {d?.nickname ? <div className="text-[13px] text-white/90 mt-0.5">{d.nickname}</div> : null}
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {err ? <div className="py-8 text-center text-sm text-red-500">{err}</div>
            : !d ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            : (
              <div data-testid="user-info-body">
                <Row icon={Mail} label={tr("郵箱")} value={(d.emails && d.emails[0]) || d.email || "-"} copyable />
                <Row icon={Phone} label={tr("手機")} value={d.phone} copyable />
                <Row icon={Wallet} label={tr("錢包餘額")} value={`USD$ ${(d.balance_usd ?? 0).toLocaleString()}`} />
                <Row icon={ShoppingBag} label={tr("訂單/消費")} value={`${d.order_count ?? 0} ${tr("筆")} · USD$ ${(d.spent_usd ?? 0).toLocaleString()}`} />
                <Row icon={Crown} label={tr("會員等級")} value={d.level?.name || "-"} />
                <Row icon={BadgeCheck} label={tr("實名")} value={d.verified ? tr("已實名") : tr("未實名")} />
                <Row icon={Ban} label={tr("狀態")} value={d.banned ? tr("已封禁") : tr("正常")} />
                <Row icon={Mail} label={tr("User ID")} value={d.user_id} mono copyable />
                <Row icon={ShoppingBag} label={tr("註冊時間")} value={fmt(d.created_at)} />
              </div>
            )}
        </div>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white" data-testid="user-info-close"><X className="h-5 w-5" /></button>
    </Modal>
  );
}
