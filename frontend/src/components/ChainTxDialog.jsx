import { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtUSDT, fmtDate, shortHash, NETWORK_COLORS } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ExternalLink, CheckCircle2, Link2 } from "lucide-react";

export function ChainTxDialog({ open, onClose, title, params }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!open || !params) return;
    setRows(null);
    api.get("/chain/txs", { params: { ...params, limit: 200 } })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]));
  }, [open, params]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-slate-700 max-w-3xl" data-testid="chain-tx-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4 text-cyan-400" />{title || "链上到账记录"}</DialogTitle></DialogHeader>
        {params?.address && <div className="text-[11px] font-mono text-slate-500 break-all">{params.address}</div>}
        <div className="max-h-[60vh] overflow-y-auto mt-1">
          {rows === null ? (
            <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">暂无链上到账记录（仅显示已同步的 chain_txs）</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800 sticky top-0 bg-[#0B1120]">
                  <th className="py-2 px-2">时间</th><th className="py-2 px-2">网络</th>
                  <th className="py-2 px-2 text-right">金额</th><th className="py-2 px-2">来源</th>
                  <th className="py-2 px-2">TxID</th><th className="py-2 px-2">匹配订单</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`chain-tx-${t.id}`}>
                    <td className="py-2 px-2 font-mono text-slate-400 whitespace-nowrap">{fmtDate(t.block_time || t.created_at)}</td>
                    <td className="py-2 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${NETWORK_COLORS[t.network]}`}>{t.network}</span></td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(t.amount)}</td>
                    <td className="py-2 px-2 font-mono text-slate-400" title={t.from}>{shortHash(t.from)}</td>
                    <td className="py-2 px-2 font-mono text-slate-400">
                      <a href={t.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-cyan-400">{shortHash(t.tx_id)}<ExternalLink className="w-3 h-3" /></a>
                    </td>
                    <td className="py-2 px-2">
                      {t.matched ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" />{t.order_no}</span> : <span className="text-slate-600">未匹配</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
