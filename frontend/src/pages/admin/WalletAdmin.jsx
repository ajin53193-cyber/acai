import { useEffect, useState, useCallback } from "react";
import { Search, Wallet, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const inp = "h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 outline-none focus:border-primary";
const fmt = (n) => `USD$ ${Number(n || 0).toFixed(2)}`;
const KIND_LABEL = { credit: "加款", debit: "扣款", refund: "退款" };

export default function WalletAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/wallets${q ? `?q=${encodeURIComponent(q)}` : ""}` }).then((r) => setList(r.data)).catch(() => setList([])), [callApi, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const totalBal = (list || []).reduce((a, u) => a + u.balance_usd, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-head text-2xl font-bold text-white">錢包管理</h1>
        <div className="text-xs text-slate-400">會員總餘額 <span className="text-emerald-400 font-bold text-base ml-1" data-testid="wallet-admin-total">{fmt(totalBal)}</span></div>
      </div>
      <div className="relative mb-4 max-w-md">
        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
        <input data-testid="wallet-admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋信箱 / 姓名 / 用戶ID" className={`${inp} w-full pl-9`} />
      </div>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_130px_130px_130px_120px] gap-3 px-4 py-2.5 text-[11px] text-slate-500 border-b border-slate-800">
            <span>會員</span><span className="text-right">餘額</span><span className="text-right">累計入帳</span><span className="text-right">累計消費</span><span></span>
          </div>
          {list.length === 0 && <div className="text-slate-500 text-sm py-10 text-center">沒有符合的會員</div>}
          {list.map((u) => (
            <div key={u.user_id} data-testid={`wallet-row-${u.user_id}`} className="grid grid-cols-2 md:grid-cols-[1fr_130px_130px_130px_120px] gap-3 items-center px-4 py-3 border-b border-slate-800/70 last:border-0">
              <div className="min-w-0 col-span-2 md:col-span-1">
                <div className="text-sm font-semibold text-white truncate">{u.email || u.name || u.user_id}</div>
                <div className="text-[11px] text-slate-500 truncate">{u.name && <span>{u.name} · </span>}{u.user_id} · {u.tx_count} 筆交易</div>
              </div>
              <div className="text-right font-head font-bold text-emerald-400" data-testid={`wallet-balance-${u.user_id}`}>{fmt(u.balance_usd)}</div>
              <div className="text-right text-xs text-slate-300">{fmt(u.total_in_usd)}</div>
              <div className="text-right text-xs text-slate-300">{fmt(u.total_out_usd)}</div>
              <button data-testid={`wallet-manage-${u.user_id}`} onClick={() => setActive(u)} className="h-8 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1"><Wallet className="h-3.5 w-3.5" />管理</button>
            </div>
          ))}
        </div>
      )}
      {active && <WalletDialog user={active} callApi={callApi} onClose={() => setActive(null)} onChanged={load} />}
    </div>
  );
}

function WalletDialog({ user, callApi, onClose, onChanged }) {
  const [txs, setTxs] = useState(null);
  const [balance, setBalance] = useState(user.balance_usd);
  const [kind, setKind] = useState("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const loadTx = useCallback(() => callApi({ method: "GET", url: `/admin/wallets/${user.user_id}/transactions` }).then((r) => setTxs(r.data)).catch(() => setTxs([])), [callApi, user.user_id]);
  useEffect(() => { loadTx(); }, [loadTx]);

  const submit = async () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) return toast.error("請輸入正確金額");
    if (kind === "debit" && v > balance + 1e-9) return toast.error("扣款金額超過會員餘額");
    if (!window.confirm(`確定對 ${user.email || user.user_id} ${KIND_LABEL[kind]} ${fmt(v)}？`)) return;
    setBusy(true);
    try {
      const r = await callApi({ method: "POST", url: `/admin/wallets/${user.user_id}/adjust`, data: { kind, amount_usd: v, note } });
      setBalance(r.data.balance_usd); setAmount(""); setNote(""); toast.success(`${KIND_LABEL[kind]}成功`); loadTx(); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || "操作失敗"); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">錢包管理 · {user.email || user.user_id}</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-slate-800 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">目前餘額</span>
          <span className="font-head text-2xl font-extrabold text-emerald-400" data-testid="wallet-dialog-balance">{fmt(balance)}</span>
        </div>
        <div className="rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex gap-2">
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <button key={k} data-testid={`wallet-kind-${k}`} onClick={() => setKind(k)} className={`h-9 px-4 rounded-full text-xs font-semibold ${kind === k ? (k === "debit" ? "bg-red-500 text-white" : "bg-emerald-500 text-white") : "bg-slate-800 text-slate-400"}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <input data-testid="wallet-adjust-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額 USD" className={inp} />
            <input data-testid="wallet-adjust-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註（會顯示在會員的交易紀錄）" className={inp} />
          </div>
          <button data-testid="wallet-adjust-submit" onClick={submit} disabled={busy} className={`h-10 px-6 rounded-lg text-white text-sm font-semibold disabled:opacity-60 ${kind === "debit" ? "bg-red-600" : "bg-emerald-600"}`}>{busy ? "處理中…" : `確認${KIND_LABEL[kind]}`}</button>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-2">交易紀錄</div>
          {txs === null ? <Loader2 className="h-5 w-5 animate-spin" /> : txs.length === 0 ? <div className="text-xs text-slate-500 py-4 text-center">尚無交易</div> : (
            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto" data-testid="wallet-dialog-txs">
              {txs.map((t) => (
                <div key={t.id} className="py-2 flex items-center gap-3 text-xs">
                  <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${t.amount_usd >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"}`}>{t.amount_usd >= 0 ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}</span>
                  <div className="flex-1 min-w-0"><div className="text-slate-200 truncate">{t.note}</div><div className="text-[10px] text-slate-500">{t.created_at?.slice(0, 19).replace("T", " ")}{t.ref && t.kind?.startsWith("admin_") ? ` · 操作者 ${t.ref}` : ""}</div></div>
                  <div className={`font-bold ${t.amount_usd >= 0 ? "text-emerald-400" : "text-slate-200"}`}>{t.amount_usd >= 0 ? "+" : "-"}{fmt(Math.abs(t.amount_usd))}</div>
                  <div className="text-[10px] text-slate-500 w-24 text-right">餘 {Number(t.balance_after_usd).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><button onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">關閉</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
