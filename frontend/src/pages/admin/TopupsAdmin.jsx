import { useState } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Btn, Input, Pill, Table, Head, fmt, useLoad } from "./ui";

const TONE = { pending: "orange", reviewing: "sky", paid: "emerald", expired: "slate", cancelled: "slate", closed: "slate", failed: "red", rejected: "red" };
const LABEL = { pending: tr("待付款"), reviewing: tr("待審核"), paid: tr("已到帳"), rejected: tr("已駁回"), expired: tr("已過期"), cancelled: tr("已取消"), closed: tr("已關閉"), failed: tr("失敗") };
const PROVIDER = { crypto: "USDT", stripe: "Stripe", paypal: "PayPal", manual: tr("銀行轉帳") };

export function TopupsAdmin({ callApi }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [data, load] = useLoad(callApi, `/admin/topups?status=${status}&q=${encodeURIComponent(qq)}`);
  const act = async (t, path, body, ok) => {
    try { const r = await callApi({ method: "POST", url: `/admin/topups/${t.id}/${path}`, data: body }); toast.success(ok(r.data)); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const reject = (t) => { const reason = window.prompt(tr("駁回原因（將顯示給用戶）"), tr("轉帳憑證無法核對，請確認金額與轉帳碼後重新上傳")); if (reason !== null) act(t, "reject", { reason }, () => tr("已駁回")); };
  const approve = (t) => { if (window.confirm(tr("確認已收到 USD$ {0} 轉帳，立即入帳？", Number(t.amount_usd).toFixed(2)))) act(t, "approve", {}, () => tr("已審核通過並入帳")); };
  const credit = (t) => { const note = window.prompt(tr("手動補單入帳備註（例如鏈上 TX / 原因）"), ""); if (note !== null) act(t, "credit", { note }, () => tr("已手動入帳")); };
  return (
    <div>
      <Head title={tr("充值訂單")} sub={tr("USDT / Stripe / PayPal 自動入帳；銀行轉帳需在此審核憑證後入帳")} right={<>
        <select data-testid="topups-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm"><option value="">{tr("全部狀態")}</option>{Object.keys(LABEL).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select>
        <Input data-testid="topups-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("單號 / 用戶ID / TX")} className="w-52" />
        <Btn kind="ghost" onClick={() => setQq(q)}>{tr("搜尋")}</Btn>
      </>} />
      <Table testId="topups-table" cols={[tr("建立時間"), tr("用戶"), tr("方式"), tr("金額 USD"), tr("應付"), tr("狀態"), tr("單號 / 轉帳碼"), tr("TX / 憑證"), tr("操作")]} rows={data || []} render={(t) => (
        <tr key={t.id} data-testid={`topup-admin-row-${t.id}`} className="hover:bg-slate-50/60">
          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmt(t.created_at)}</td>
          <td className="px-4 py-3"><div className="text-slate-800">{t.user_email || t.user_phone || "-"}</div><div className="text-[10px] text-slate-400 font-mono">{t.user_id.slice(-8)}</div></td>
          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{t.method_name || PROVIDER[t.provider || "crypto"]}</td>
          <td className="px-4 py-3 font-head font-bold text-slate-900">{Number(t.amount_usd).toFixed(2)}</td>
          <td className="px-4 py-3 text-orange-600 font-semibold whitespace-nowrap">{t.pay_amount} {(t.provider || "crypto") === "crypto" ? "USDT" : "USD"}</td>
          <td className="px-4 py-3"><Pill tone={TONE[t.status] || "slate"}>{LABEL[t.status] || t.status}</Pill>{t.manual_credit && <div className="text-[10px] text-slate-400 mt-1">{tr("手動補單")}</div>}</td>
          <td className="px-4 py-3 font-mono text-[11px] text-slate-500"><div>{t.out_trade_no}</div><div>{t.order_no}</div>{t.reference_code && <div className="text-orange-600 font-bold">{t.reference_code}</div>}</td>
          <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[160px]">
            {t.proof_image ? <a href={t.proof_image} target="_blank" rel="noreferrer" data-testid={`topup-proof-${t.id}`} className="block"><img src={t.proof_image} alt="" className="h-10 w-16 object-cover rounded-md border border-slate-200" /><div className="truncate">{t.payer_name}{t.proof_note ? ` · ${t.proof_note}` : ""}</div></a>
              : <span className="font-mono truncate block" title={t.tx_id}>{t.tx_id || "-"}</span>}
            {t.reject_reason && <div className="text-red-500 truncate">{t.reject_reason}</div>}
          </td>
          <td className="px-4 py-3"><div className="flex gap-1.5">
            {(t.provider || "crypto") === "crypto" && <Btn kind="ghost" data-testid={`topup-requery-${t.id}`} onClick={() => act(t, "requery", {}, (d) => tr("網關狀態：{0}", d.gateway?.status || "-"))}>{tr("重查網關")}</Btn>}
            {["manual", "other", "alipay", "wechat"].includes(t.provider) && ["pending", "reviewing", "rejected"].includes(t.status) && <>
              <Btn kind="ok" data-testid={`topup-approve-${t.id}`} onClick={() => approve(t)}>{tr("審核通過")}</Btn>
              {t.status !== "rejected" && <Btn kind="danger" data-testid={`topup-reject-${t.id}`} onClick={() => reject(t)}>{tr("駁回")}</Btn>}
            </>}
            {!["manual", "other", "alipay", "wechat"].includes(t.provider) && t.status !== "paid" && <Btn kind="ok" data-testid={`topup-credit-${t.id}`} onClick={() => credit(t)}>{tr("手動入帳")}</Btn>}
          </div></td>
        </tr>
      )} />
    </div>
  );
}
