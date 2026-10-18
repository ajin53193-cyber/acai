import { useState } from "react";
import { Loader2, X, Search, CheckCircle2, AlertCircle, HandCoins, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-8)}` : "-");
const fmt = (s) => { if (!s) return "-"; const d = new Date(s); return d.toLocaleString(); };

export function CreditHashDialog({ order, callApi, onClose, onDone }) {
  const [tx, setTx] = useState("");
  const [checking, setChecking] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [res, setRes] = useState(null);
  const open = !!order;
  const reset = () => { setTx(""); setRes(null); setChecking(false); setCrediting(false); };
  const close = () => { reset(); onClose(); };

  const verify = async () => {
    const h = tx.trim();
    if (!h) return toast.error(tr("請輸入鏈上交易哈希(TXID)"));
    setChecking(true); setRes(null);
    try {
      const r = await callApi({ method: "POST", url: `/admin/topups/${order.id}/verify-hash`, data: { tx_id: h } });
      setRes(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || tr("鏈上查詢失敗")); }
    setChecking(false);
  };
  const credit = async (force) => {
    const h = tx.trim();
    if (force && !window.confirm(tr("鏈上校驗未通過，確定要強制按此哈希補單入帳？"))) return;
    setCrediting(true);
    try {
      const r = await callApi({ method: "POST", url: `/admin/topups/${order.id}/credit-hash`, data: { tx_id: h, force: !!force } });
      toast.success(tr("已補單入帳：{0}", r.data.order_no || ""));
      onDone && onDone(); close();
    } catch (e) { toast.error(e.response?.data?.detail || tr("補單失敗")); }
    setCrediting(false);
  };

  const ono = order ? (order.order_no || order.out_trade_no || order.id) : "";
  const expected = res?.expected ?? (order ? (order.pay_amount ?? order.amount_usd) : 0);
  const okToCredit = res && res.found && res.amount_match && !res.duplicate && !res.already_paid;

  const Row = ({ label, value, tone }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[13px] font-semibold ${tone || "text-slate-800"}`}>{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="credit-hash-dialog">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 py-4">
          <div className="flex items-center gap-2 text-[15px] font-bold"><HandCoins className="h-4 w-4" />{tr("按鏈上哈希補單")}</div>
          <div className="mt-1 text-[12px] text-white/85">{tr("訂單號")} {ono} · {tr("應付")} <b>{Number(expected).toLocaleString()} USDT</b></div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <input data-testid="credit-hash-input" value={tx} onChange={(e) => { setTx(e.target.value); setRes(null); }} placeholder={tr("貼上該筆到賬的 TXID")} className="flex-1 h-10 rounded-xl bg-slate-100 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-300" onKeyDown={(e) => e.key === "Enter" && verify()} />
            <button data-testid="credit-hash-verify" onClick={verify} disabled={checking} className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{tr("鏈上核對")}</button>
          </div>

          {res && (
            <div className="rounded-xl border border-slate-200 p-3" data-testid="credit-hash-result">
              {!res.has_key && !res.found && <div className="text-[12px] text-amber-600 mb-1">{tr("尚未配置 TRONGRID_API_KEY，無法鏈上核對")}</div>}
              {res.found ? (
                <>
                  <Row label={tr("鏈上到賬金額")} value={`${Number(res.amount).toLocaleString()} USDT`} tone={res.amount_match ? "text-emerald-600" : "text-red-600"} />
                  <Row label={tr("應付金額")} value={`${Number(res.expected).toLocaleString()} USDT`} />
                  <Row label={tr("付款方")} value={short(res.from)} />
                  <Row label={tr("到賬時間")} value={fmt(res.ts)} />
                  <Row label={tr("轉入地址")} value={tr("本訂單收款地址 ✓")} tone="text-emerald-600" />
                </>
              ) : (
                <div className="flex items-start gap-2 text-[13px] text-red-600"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{tr("在本訂單收款地址上找不到該哈希的轉入記錄，請核對哈希與收款地址。")}</div>
              )}
              {res.duplicate && <div className="mt-2 flex items-start gap-2 text-[13px] text-red-600"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{tr("該哈希已用於訂單 {0} 入帳，不能重複使用", res.dup_order_no)}</div>}
              {res.found && !res.amount_match && <div className="mt-2 flex items-start gap-2 text-[13px] text-amber-600"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{tr("鏈上金額與應付金額不符")}</div>}
              {res.already_paid && <div className="mt-2 text-[13px] text-slate-500">{tr("該訂單已入帳")}</div>}
              <a href={`https://tronscan.org/#/transaction/${tx.trim()}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-orange-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" />{tr("在 TronScan 查看")}</a>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {okToCredit ? (
              <button data-testid="credit-hash-confirm" onClick={() => credit(false)} disabled={crediting} className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{crediting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{tr("確認補單入帳")}</button>
            ) : res && !res.duplicate && !res.already_paid ? (
              <button data-testid="credit-hash-force" onClick={() => credit(true)} disabled={crediting} className="flex-1 h-11 rounded-xl border border-red-300 bg-white text-red-600 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{crediting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}{tr("跳過校驗強制補單")}</button>
            ) : (
              <button disabled className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-400 font-bold">{tr("確認補單入帳")}</button>
            )}
            <button onClick={close} className="h-11 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold">{tr("取消")}</button>
          </div>
        </div>
        <button onClick={close} className="absolute top-3 right-3 text-white/80 hover:text-white" data-testid="credit-hash-close"><X className="h-5 w-5" /></button>
      </DialogContent>
    </Dialog>
  );
}
