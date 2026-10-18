import { useEffect, useState } from "react";
import { Loader2, Copy, X, Wallet, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const copy = (v) => { if (v) { navigator.clipboard?.writeText(String(v)); toast.success(tr("已複製")); } };
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "-");
const shortTx = (a) => (a ? `${a.slice(0, 10)}…${a.slice(-6)}` : "-");
const fmt = (s) => { if (!s) return "-"; const d = new Date(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`; };

export function AddressChainDialog({ address, callApi, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!address) return;
    setD(null); setErr("");
    callApi({ method: "GET", url: `/admin/usdt/address/${address}` }).then((r) => setD(r.data)).catch((e) => setErr(e.response?.data?.detail || tr("載入失敗")));
  }, [address, callApi]);
  const txs = d?.transfers || [];
  return (
    <Dialog open={!!address} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden" data-testid="addr-chain-dialog">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 py-4">
          <div className="flex items-center gap-2 text-[15px] font-bold"><Wallet className="h-4 w-4 text-orange-400" />{tr("收款地址鏈上到帳記錄")}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[13px] text-white/80 break-all" data-testid="addr-chain-address">{address}</span>
            <button onClick={() => copy(address)} className="text-white/60 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <span className="text-[12px] text-slate-500">{tr("僅顯示轉入本地址的 USDT (TRC20) 記錄，用於對帳")}</span>
          <div className="flex items-center gap-3">
            {d && d.balance != null && <span className="text-[12px] font-semibold text-emerald-600">{tr("餘額")} {Number(d.balance).toLocaleString()} U</span>}
            <a href={`https://tronscan.org/#/address/${address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-orange-600 hover:underline" data-testid="addr-chain-tronscan"><ExternalLink className="h-3.5 w-3.5" />{tr("在 TronScan 查看")}</a>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {err ? <div className="py-12 text-center text-sm text-red-500">{err}</div>
            : !d ? <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            : !d.has_key ? <div className="py-12 px-6 text-center text-sm text-amber-600" data-testid="addr-chain-nokey">{tr("尚未配置 TRONGRID_API_KEY，無法查詢鏈上記錄")}</div>
            : txs.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">{tr("近期無轉入記錄")}</div>
            : (
              <table className="w-full text-sm" data-testid="addr-chain-table">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70 sticky top-0">
                  <th className="px-4 py-2.5 font-semibold">{tr("金額 (USDT)")}</th>
                  <th className="px-4 py-2.5 font-semibold">{tr("付款方")}</th>
                  <th className="px-4 py-2.5 font-semibold">{tr("時間")}</th>
                  <th className="px-4 py-2.5 font-semibold">{tr("哈希")}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{tr("對帳狀態")}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {txs.map((t) => (
                    <tr key={t.tx_id} data-testid={`addr-chain-tx-${(t.tx_id || "").slice(-6)}`} className={t.matched ? "hover:bg-emerald-50/40" : "bg-amber-50/40 hover:bg-amber-50/70"}>
                      <td className="px-4 py-3 font-head font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${t.matched ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {Number(t.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-slate-600"><button onClick={() => copy(t.from)} className="inline-flex items-center gap-1 hover:text-orange-600">{short(t.from)}<Copy className="h-3 w-3 opacity-50" /></button></td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmt(t.ts)}</td>
                      <td className="px-4 py-3 font-mono text-[12px]"><a href={`https://tronscan.org/#/transaction/${t.tx_id}`} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline">{shortTx(t.tx_id)}</a></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {t.matched
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold"><CheckCircle2 className="h-3 w-3" />{tr("已對應")}{t.order_no ? ` · ${t.order_no}` : ""}</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold" title={tr("此筆到帳未對應任何訂單，可能是未確認收款")}><AlertCircle className="h-3 w-3" />{tr("未對應")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white" data-testid="addr-chain-close"><X className="h-5 w-5" /></button>
      </DialogContent>
    </Dialog>
  );
}
