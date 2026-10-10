import { useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, FileText, Wallet, Snowflake, TrendingUp, TrendingDown } from "lucide-react";

const CAT = {
  order_credit: { label: "收款入账", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  commission: { label: "代理分润", cls: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  payout_freeze: { label: "提现冻结", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  payout_done: { label: "提现完成", cls: "text-sky-400 border-sky-400/30 bg-sky-400/10" },
  payout_reject: { label: "提现驳回退回", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  adjust_credit: { label: "人工加款", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  adjust_debit: { label: "人工扣款", cls: "text-red-400 border-red-400/30 bg-red-400/10" },
  adjust_freeze: { label: "冻结", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  adjust_unfreeze: { label: "解冻", cls: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
};

export default function BalanceLedgerPage() {
  const { user } = useAuth();
  const pick = user.role !== "merchant";
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!pick);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [byMonth, setByMonth] = useState(false);

  useEffect(() => {
    if (!pick) return;
    const reqs = user.role === "admin"
      ? [api.get("/accounts", { params: { role: "merchant" } }), api.get("/accounts", { params: { role: "agent" } })]
      : [api.get("/accounts")];
    Promise.all(reqs).then((rs) => setAccounts(rs.flatMap((r) => r.data))).catch(() => {});
  }, [pick, user.role]);

  const load = useCallback(() => {
    if (pick && !accountId) { setData(null); return; }
    setLoading(true);
    const params = pick ? { account_id: accountId } : {};
    if (byMonth && month) params.month = month;
    api.get("/balance/ledger", { params })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(formatApiErrorDetail(err.response?.data?.detail)); });
  }, [pick, accountId, byMonth, month]);

  useEffect(() => { load(); }, [load]);

  const download = async () => {
    setBusy(true);
    try {
      const params = {}; if (pick) params.account_id = accountId; if (byMonth && month) params.month = month;
      const res = await api.get("/reports/balance-ledger", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `ledger_${month || "all"}.xlsx`; a.click(); URL.revokeObjectURL(url);
      toast.success("资金流水已下载");
    } catch (err) {
      let msg = err.message;
      try { msg = JSON.parse(await err.response.data.text()).detail; } catch { /* noop */ }
      toast.error(formatApiErrorDetail(msg));
    } finally { setBusy(false); }
  };

  const acc = data?.account;
  const entries = data?.entries || [];

  return (
    <div className="space-y-6" data-testid="balance-ledger-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ArrowLeftRight className="w-6 h-6 text-cyan-400" /> 资金流水</h1>
          <p className="text-sm text-slate-400 mt-1">每一笔收款、手续费、分润与提现的变动明细，便于对账</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pick && (
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger data-testid="ledger-account-select" className="w-[230px] bg-slate-900/60 border-slate-700"><SelectValue placeholder="选择账户" /></SelectTrigger>
              <SelectContent>{accounts.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.email}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={byMonth ? "month" : "all"} onValueChange={(v) => setByMonth(v === "month")}>
            <SelectTrigger data-testid="ledger-range-select" className="w-[118px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部时间</SelectItem><SelectItem value="month">按月份</SelectItem></SelectContent>
          </Select>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={!byMonth} data-testid="ledger-month-input" className="w-[150px] bg-slate-900/60 border-slate-700 font-mono disabled:opacity-40" />
          <Button onClick={download} disabled={busy || (pick && !accountId)} variant="outline" data-testid="ledger-export-btn" className="border-slate-700 hover:bg-slate-800">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4 mr-1" /> 导出 Excel</>}
          </Button>
        </div>
      </div>

      {acc && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4" data-testid="ledger-available">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-emerald-400" /> 可用余额</div>
            <div className="text-xl font-bold font-mono text-emerald-400">{fmtUSDT(acc.balance)} <span className="text-xs text-slate-500">USDT</span></div>
          </div>
          <div className="glass rounded-xl p-4" data-testid="ledger-frozen">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><Snowflake className="w-3.5 h-3.5 text-amber-400" /> 冻结余额</div>
            <div className="text-xl font-bold font-mono text-amber-400">{fmtUSDT(acc.frozen_balance)} <span className="text-xs text-slate-500">USDT</span></div>
          </div>
          <div className="glass rounded-xl p-4 col-span-2 sm:col-span-1" data-testid="ledger-count">
            <div className="text-xs text-slate-500 mb-1">流水笔数</div>
            <div className="text-xl font-bold font-mono text-cyan-400">{entries.length}</div>
          </div>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">时间</th>
                <th className="py-3 px-3 font-medium">类型</th>
                <th className="py-3 px-3 font-medium text-right">变动金额</th>
                <th className="py-3 px-3 font-medium text-right">变动后余额</th>
                <th className="py-3 px-3 font-medium">备注</th>
                <th className="py-3 px-3 font-medium">操作人</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : !acc ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">{pick ? "请选择账户查看资金流水" : "暂无数据"}</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">暂无资金流水</td></tr>
              ) : entries.map((e) => {
                const c = CAT[e.category] || { label: e.category, cls: "text-slate-300 border-slate-600 bg-slate-700/30" };
                const up = e.amount > 0;
                return (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`ledger-row-${e.id}`}>
                    <td className="py-3 px-3 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[11px] border whitespace-nowrap ${c.cls}`}>{c.label}</span></td>
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${e.amount > 0 ? "text-emerald-400" : e.amount < 0 ? "text-red-400" : "text-slate-500"}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {e.amount !== 0 && (up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
                        {up ? "+" : ""}{fmtUSDT(e.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{fmtUSDT(e.balance_after)}</td>
                    <td className="py-3 px-3 text-xs text-slate-400 max-w-[280px] truncate" title={e.remark}>{e.remark || "—"}</td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-500">{e.operator || "系统"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
