import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, fmtDate, ROLE_LABELS } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw, Loader2, Wallet, Snowflake, Webhook, ShieldCheck } from "lucide-react";

const CAT = {
  order_credit: "收款入账", commission: "代理分润", payout_freeze: "提现冻结", payout_done: "提现完成",
  payout_reject: "提现驳回退回", adjust_credit: "人工加款", adjust_debit: "人工扣款",
  adjust_freeze: "冻结", adjust_unfreeze: "解冻",
};

export function MerchantDrawer({ accountId, open, onClose, isAdmin, onReset }) {
  const [acc, setAcc] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    setLoading(true); setShow(false);
    Promise.all([
      api.get(`/accounts/${accountId}`),
      api.get("/balance/ledger", { params: { account_id: accountId } }).catch(() => ({ data: { entries: [] } })),
    ]).then(([a, l]) => {
      setAcc(a.data); setEntries((l.data.entries || []).slice(0, 12));
    }).catch((err) => toast.error(formatApiErrorDetail(err.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [open, accountId]);

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };
  const reset = async () => {
    if (!window.confirm(`确定重置「${acc.name}」的 API 密钥？旧密钥将立即失效。`)) return;
    setResetting(true);
    try {
      const { data } = await api.post(`/accounts/${acc.id}/reset-api-key`);
      setAcc((a) => ({ ...a, ...data })); setShow(true);
      onReset?.(acc.id, data);
      toast.success("密钥已重置，请妥善保管新 secret");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setResetting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-[#0B1120] border-slate-800 w-full sm:max-w-md overflow-y-auto" data-testid="merchant-drawer">
        <SheetHeader><SheetTitle className="text-slate-100">账户详情{acc ? ` · ${acc.name}` : ""}</SheetTitle></SheetHeader>
        {loading || !acc ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{ROLE_LABELS[acc.role]}</span>
              <span className="font-mono text-slate-400">{acc.email}</span>
              <span className={`ml-auto px-2 py-0.5 rounded-full border ${acc.status === "active" ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-400/30"}`}>{acc.status === "active" ? "正常" : "冻结"}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-lg p-3" data-testid="drawer-balance">
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-1"><Wallet className="w-3 h-3 text-emerald-400" />可用余额</div>
                <div className="font-mono font-bold text-emerald-400">{fmtUSDT(acc.balance)}</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-1"><Snowflake className="w-3 h-3 text-amber-400" />冻结余额</div>
                <div className="font-mono font-bold text-amber-400">{fmtUSDT(acc.frozen_balance)}</div>
              </div>
              <div className="glass rounded-lg p-3 col-span-2">
                <div className="text-[11px] text-slate-500 mb-1">费率</div>
                <div className="font-mono text-slate-200">{((acc.rate || 0) * 100).toFixed(2)}%</div>
              </div>
            </div>

            {acc.role === "merchant" && (
              <div className="glass rounded-lg p-3 space-y-2" data-testid="drawer-credentials">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold"><KeyRound className="w-3.5 h-3.5 text-cyan-400" /> API 凭证</div>
                  {isAdmin && (
                    <Button onClick={reset} disabled={resetting} size="sm" variant="outline" data-testid="drawer-reset-key-btn" className="h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                      {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />重置</>}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500">api_key</div>
                  <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-700 font-mono text-[11px]"><span className="flex-1 truncate" data-testid="drawer-api-key">{acc.api_key}</span><button onClick={() => copy(acc.api_key)} className="text-cyan-400"><Copy className="w-3 h-3" /></button></div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500">api_secret</div>
                  <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-700 font-mono text-[11px]"><span className="flex-1 truncate" data-testid="drawer-api-secret">{show ? acc.api_secret : "•".repeat(32)}</span>
                    <button onClick={() => setShow(!show)} data-testid="drawer-toggle-secret" className="text-slate-400">{show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                    <button onClick={() => copy(acc.api_secret)} className="text-cyan-400"><Copy className="w-3 h-3" /></button></div>
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px] pt-1">
                  <div className="flex items-start gap-1.5"><Webhook className="w-3.5 h-3.5 text-slate-500 mt-0.5" /><span className="text-slate-400">回调地址：</span><span className="font-mono text-slate-200 break-all flex-1" data-testid="drawer-notify-url">{acc.notify_url || "未设置"}</span></div>
                  <div className="flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-slate-500 mt-0.5" /><span className="text-slate-400">IP 白名单：</span><span className="font-mono text-slate-200 flex-1" data-testid="drawer-ip-whitelist">{acc.ip_whitelist?.length ? acc.ip_whitelist.join(", ") : "未启用"}</span></div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">最近资金流水</div>
              <div className="space-y-1" data-testid="drawer-ledger">
                {entries.length === 0 ? <div className="text-xs text-slate-500 py-3 text-center">暂无流水</div> : entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/60 text-[11px]">
                    <div className="min-w-0">
                      <div className="text-slate-300">{CAT[e.category] || e.category}</div>
                      <div className="font-mono text-slate-500 truncate">{fmtDate(e.created_at)}</div>
                    </div>
                    <div className={`font-mono font-semibold whitespace-nowrap ${e.amount > 0 ? "text-emerald-400" : e.amount < 0 ? "text-red-400" : "text-slate-500"}`}>{e.amount > 0 ? "+" : ""}{fmtUSDT(e.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
