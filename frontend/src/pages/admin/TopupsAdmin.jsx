import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, CheckCircle2, XCircle, HandCoins, Radar, Image as ImageIcon, Copy, CalendarDays, X } from "lucide-react";
import { tr } from "@/i18n";
import { Btn, Card, Head, Pill } from "./ui";
import { MemberDetail } from "./MembersAdmin";

const TONE = { pending: "orange", reviewing: "sky", paid: "emerald", expired: "slate", cancelled: "slate", closed: "slate", failed: "red", rejected: "red" };
const LABEL = { pending: tr("待付款"), reviewing: tr("待審核"), paid: tr("已到帳"), rejected: tr("已駁回"), expired: tr("已過期"), cancelled: tr("已取消"), closed: tr("已關閉"), failed: tr("失敗") };
const TABS = ["", "pending", "reviewing", "paid", "rejected", "expired"];
const ICON = { crypto: "/payments/usdt.svg", stripe: "/payments/visa-mastercard.svg", paypal: "/payments/paypal.svg", manual: "/payments/bank.svg" };
const MANUAL = ["manual", "other", "alipay", "wechat"];
const PRESETS = [["today", tr("今天")], ["7", tr("近 7 天")], ["30", tr("近 30 天")], ["month", tr("本月")]];
const iso = (d) => d.toISOString().slice(0, 10);
const presetRange = (k) => {
  const now = new Date(); const to = iso(now);
  if (k === "today") return [to, to];
  if (k === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), to];
  const from = new Date(now); from.setDate(from.getDate() - (+k - 1)); return [iso(from), to];
};
const fmtDT = (s) => (s ? [s.slice(0, 10), s.slice(11, 19)] : ["-", ""]);
const copy = (v) => { navigator.clipboard?.writeText(v); toast.success(tr("已複製")); };
const dateInp = "h-9 rounded-lg bg-white border border-slate-200 px-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-300";

function ActionBtn({ tone = "slate", icon: Icon, children, ...p }) {
  const t = { ok: "bg-emerald-500 hover:bg-emerald-600 text-white", danger: "bg-white border border-red-200 text-red-600 hover:bg-red-50", slate: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50", sky: "bg-sky-500 hover:bg-sky-600 text-white" }[tone];
  return <button {...p} className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-50 ${t}`}><Icon className="h-3.5 w-3.5" />{children}</button>;
}

export function TopupsAdmin({ callApi }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState({ rows: [], counts: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [proof, setProof] = useState(null);
  const [pmImg, setPmImg] = useState({});
  useEffect(() => { callApi({ method: "GET", url: "/admin/payment-methods" }).then((r) => setPmImg(Object.fromEntries(r.data.map((m) => [m.id, m.image])))).catch(() => {}); }, [callApi]);

  const load = useCallback(() => {
    setLoading(true);
    return callApi({ method: "GET", url: `/admin/topups?status=${status}&q=${encodeURIComponent(qq)}&date_from=${from}&date_to=${to}` })
      .then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))).finally(() => setLoading(false));
  }, [callApi, status, qq, from, to]);
  useEffect(() => { load(); }, [load]);

  const act = async (t, path, body, ok) => {
    try { const r = await callApi({ method: "POST", url: `/admin/topups/${t.id}/${path}`, data: body }); toast.success(ok(r.data)); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const reject = (t) => { const reason = window.prompt(tr("駁回原因（將顯示給用戶）"), tr("轉帳憑證無法核對，請確認金額與轉帳碼後重新上傳")); if (reason !== null) act(t, "reject", { reason }, () => tr("已駁回")); };
  const approve = (t) => { if (window.confirm(tr("確認已收到 USD$ {0} 轉帳，立即入帳？", Number(t.amount_usd).toFixed(2)))) act(t, "approve", {}, () => tr("已審核通過並入帳")); };
  const credit = (t) => { const note = window.prompt(tr("手動補單入帳備註（例如鏈上 TX / 原因）"), ""); if (note !== null) act(t, "credit", { note }, () => tr("已手動入帳")); };
  const creditHash = async (t) => {
    const tx = window.prompt(tr("請輸入該筆到賬的鏈上交易哈希(TXID)，系統將回調校驗後補單入帳"), (t.tx_id || t.tx_hash || "").trim());
    if (!tx || !tx.trim()) return;
    const data = { tx_id: tx.trim() };
    try {
      const r = await callApi({ method: "POST", url: `/admin/topups/${t.id}/credit-hash`, data });
      toast.success(tr("已補單入帳：{0}", r.data.order_no || "")); load();
    } catch (e) {
      const msg = e.response?.data?.detail || tr("補單失敗");
      if ([404, 422, 502].includes(e.response?.status) && window.confirm(msg + "\n\n" + tr("是否跳過鏈上校驗、強制按此哈希補單？"))) {
        try { const r = await callApi({ method: "POST", url: `/admin/topups/${t.id}/credit-hash`, data: { ...data, force: true } }); toast.success(tr("已強制補單入帳：{0}", r.data.order_no || "")); load(); }
        catch (e2) { toast.error(e2.response?.data?.detail || tr("補單失敗")); }
      } else { toast.error(msg); }
    }
  };
  const activePreset = PRESETS.find(([k]) => { const [a, b] = presetRange(k); return a === from && b === to; })?.[0];
  const counts = data.counts || {};

  return (
    <div data-testid="topups-admin">
      <Head title={tr("充值審核")} sub={tr("USDT / Stripe / PayPal 自動入帳；銀行轉帳需在此審核憑證後入帳")} right={<Btn kind="ghost" data-testid="topups-refresh" onClick={load}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Btn>} />

      <Card className="p-3 sm:p-4 mb-4" data-testid="topups-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium"><CalendarDays className="h-4 w-4 text-orange-500" />{tr("日期")}</span>
          <input data-testid="topups-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateInp} />
          <span className="text-slate-300">—</span>
          <input data-testid="topups-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateInp} />
          <div className="flex items-center gap-1 ml-1">
            {PRESETS.map(([k, l]) => <button key={k} data-testid={`topups-preset-${k}`} onClick={() => { const [a, b] = presetRange(k); setFrom(a); setTo(b); }} className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors ${activePreset === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-600"}`}>{l}</button>)}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input data-testid="topups-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("單號 / 轉帳碼 / 帳戶ID / 信箱 / TX")} className={`${dateInp} w-72 pl-9`} />
            </div>
            <Btn data-testid="topups-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
            {(from || to || qq) && <button data-testid="topups-clear" onClick={() => { setFrom(""); setTo(""); setQ(""); setQq(""); }} className="h-9 px-3 rounded-lg text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="h-3.5 w-3.5" />{tr("清除")}</button>}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 overflow-x-auto" data-testid="topups-tabs">
          {TABS.map((k) => {
            const n = k ? counts[k] || 0 : data.total || 0;
            return <button key={k || "all"} data-testid={`topups-tab-${k || "all"}`} onClick={() => setStatus(k)} className={`h-8 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${status === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{k ? LABEL[k] : tr("全部")}<span className={`rounded-full px-1.5 min-w-[18px] text-center text-[10px] ${status === k ? "bg-white/20" : "bg-slate-100"}`}>{n}</span></button>;
          })}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="topups-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">
            {[tr("日期時間"), tr("帳戶ID"), tr("付款方式"), tr("付款金額"), tr("單號 / 轉帳碼"), tr("操作")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-400">{loading ? tr("載入中…") : tr("暫無充值訂單")}</td></tr> : data.rows.map((t) => {
              const [d, tm] = fmtDT(t.created_at);
              const prov = t.provider || "crypto";
              const isCrypto = prov === "crypto" && !t.own_wallet;
              const reviewable = MANUAL.includes(prov) || !!t.own_wallet;
              return (
                <tr key={t.id} data-testid={`topup-admin-row-${t.id}`} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><div className="text-slate-800 font-medium">{d}</div><div className="text-[11px] text-slate-400 font-mono">{tm}</div></td>
                  <td className="px-4 py-3">
                    <button data-testid={`topup-member-${t.id}`} onClick={() => setMember(t.user_id)} className="text-left group">
                      <div className="font-head font-bold text-slate-900 text-[15px] group-hover:text-orange-600 underline-offset-2 group-hover:underline transition-colors">{t.account_no}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-11 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">{(pmImg[t.method_id] || ICON[prov]) ? <img src={pmImg[t.method_id] || ICON[prov]} alt="" className="max-h-5 max-w-[36px] object-contain" /> : <span className="text-[10px] font-bold text-slate-500">{tr("轉帳")}</span>}</span>
                      <span className="font-mono text-xs text-slate-500">{t.channel_no}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-head font-bold text-slate-900 text-[15px]">USD$ {Number(t.amount_usd).toFixed(2)}</div>
                    {(isCrypto || Number(t.pay_amount) !== Number(t.amount_usd)) && <div className="text-[11px] text-orange-600 font-semibold">{tr("應付")} {t.pay_amount} {isCrypto ? "USDT" : "USD"}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    <button onClick={() => copy(t.out_trade_no)} className="flex items-center gap-1 hover:text-slate-800" data-testid={`topup-no-${t.id}`}>{t.out_trade_no}<Copy className="h-3 w-3 opacity-50" /></button>
                    {t.reference_code && <button onClick={() => copy(t.reference_code)} className="mt-0.5 flex items-center gap-1 text-orange-600 font-bold hover:text-orange-700" data-testid={`topup-ref-${t.id}`}>{tr("轉帳碼")} {t.reference_code}<Copy className="h-3 w-3 opacity-50" /></button>}
                    {t.tx_id && <div className="mt-0.5 truncate max-w-[200px]" title={t.tx_id}>TX {t.tx_id}</div>}
                    {t.own_wallet && t.tx_hash && !t.tx_id && <button onClick={() => copy(t.tx_hash)} className="mt-0.5 flex items-center gap-1 text-sky-600 hover:text-sky-700 max-w-[220px]" data-testid={`topup-txhash-${t.id}`}><span className="truncate">TXID {t.tx_hash}</span><Copy className="h-3 w-3 opacity-50 shrink-0" /></button>}
                    {t.own_wallet && <div className="mt-0.5 text-[10px] text-slate-400">{tr("自有地址")} · {t.network}</div>}
                    {t.reject_reason && <div className="mt-0.5 text-red-500 font-sans truncate max-w-[220px]" title={t.reject_reason}>{tr("駁回：")}{t.reject_reason}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0"><Pill tone={TONE[t.status] || "slate"}>{LABEL[t.status] || t.status}</Pill>{t.manual_credit && <span className="ml-1 text-[10px] text-slate-400">{tr("手動補單")}</span>}</span>
                      {(t.proof_image || t.tx_hash) && <ActionBtn tone="slate" icon={ImageIcon} data-testid={`topup-proof-${t.id}`} onClick={() => setProof(t)}>{tr("憑證")}</ActionBtn>}
                      {isCrypto && t.status === "pending" && <ActionBtn tone="slate" icon={Radar} data-testid={`topup-requery-${t.id}`} onClick={() => act(t, "requery", {}, (r) => tr("網關狀態：{0}", r.gateway?.status || "-"))}>{tr("重查網關")}</ActionBtn>}
                      {reviewable && ["pending", "reviewing", "rejected"].includes(t.status) && <>
                        <ActionBtn tone="ok" icon={CheckCircle2} data-testid={`topup-approve-${t.id}`} onClick={() => approve(t)}>{tr("審核通過")}</ActionBtn>
                        {t.status !== "rejected" && <ActionBtn tone="danger" icon={XCircle} data-testid={`topup-reject-${t.id}`} onClick={() => reject(t)}>{tr("駁回")}</ActionBtn>}
                      </>}
                      {t.own_wallet && t.status !== "paid" && <ActionBtn tone="ok" icon={HandCoins} data-testid={`topup-credit-hash-${t.id}`} onClick={() => creditHash(t)}>{tr("哈希補單")}</ActionBtn>}
                      {!MANUAL.includes(prov) && t.status !== "paid" && <ActionBtn tone="sky" icon={HandCoins} data-testid={`topup-credit-${t.id}`} onClick={() => credit(t)}>{tr("手動入帳")}</ActionBtn>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {member && <MemberDetail uid={member} callApi={callApi} onClose={() => setMember(null)} onChanged={load} />}
      {proof && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setProof(null)} data-testid="topup-proof-modal">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100"><div className="font-semibold text-slate-800 text-sm">{tr("轉帳憑證")} · {proof.out_trade_no}</div><button onClick={() => setProof(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
            <div className="p-5">
              {proof.proof_image && <a href={proof.proof_image} target="_blank" rel="noreferrer"><img src={proof.proof_image} alt="" className="max-h-[60vh] w-full object-contain rounded-xl bg-slate-50" /></a>}
              {proof.own_wallet && <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div><span className="text-slate-400">TXID：</span><span className="font-mono break-all text-slate-800" data-testid="proof-txhash">{proof.tx_hash || "-"}</span>{proof.tx_hash && <a href={`https://tronscan.org/#/transaction/${proof.tx_hash}`} target="_blank" rel="noreferrer" className="ml-2 text-sky-600 hover:underline">{tr("在 Tronscan 查看")}</a>}</div>
                <div><span className="text-slate-400">{tr("收款地址")}：</span><span className="font-mono break-all">{proof.wallet_address}</span></div>
                <div><span className="text-slate-400">{tr("應付")}：</span><b className="text-orange-600">{Number(proof.pay_amount || proof.amount_usd).toFixed(2)} USDT</b> · {proof.network}</div>
              </div>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div><span className="text-slate-400">{tr("付款人")}：</span>{proof.payer_name || "-"}</div>
                <div><span className="text-slate-400">{tr("轉帳碼")}：</span><b className="text-orange-600 font-mono">{proof.reference_code}</b></div>
                <div className="col-span-2"><span className="text-slate-400">{tr("備註")}：</span>{proof.proof_note || "-"}</div>
              </div>
              {(MANUAL.includes(proof.provider) || proof.own_wallet) && ["pending", "reviewing", "rejected"].includes(proof.status) && <div className="mt-4 flex gap-2 justify-end">
                <ActionBtn tone="ok" icon={CheckCircle2} onClick={() => { setProof(null); approve(proof); }}>{tr("審核通過")}</ActionBtn>
                {proof.status !== "rejected" && <ActionBtn tone="danger" icon={XCircle} onClick={() => { setProof(null); reject(proof); }}>{tr("駁回")}</ActionBtn>}
              </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
