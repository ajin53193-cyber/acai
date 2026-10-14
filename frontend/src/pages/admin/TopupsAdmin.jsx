import { useState } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Btn, Input, Pill, Table, Head, fmt, useLoad } from "./ui";

const TONE = { pending: "orange", paid: "emerald", expired: "slate", cancelled: "slate", closed: "slate", failed: "red" };
const LABEL = { pending: tr("待付款"), paid: tr("已到帳"), expired: tr("已過期"), cancelled: tr("已取消"), closed: tr("已關閉"), failed: tr("失敗") };

export function TopupsAdmin({ callApi }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [data, load] = useLoad(callApi, `/admin/topups?status=${status}&q=${encodeURIComponent(qq)}`);
  const act = async (t, path, body, ok) => {
    try { const r = await callApi({ method: "POST", url: `/admin/topups/${t.id}/${path}`, data: body }); toast.success(ok(r.data)); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const credit = (t) => { const note = window.prompt(tr("手動補單入帳備註（例如鏈上 TX / 原因）"), ""); if (note !== null) act(t, "credit", { note }, () => tr("已手動入帳")); };
  return (
    <div>
      <Head title={tr("USDT 充值單管理")} sub={tr("網關訂單狀態、鏈上 TX、手動重查與補單入帳")} right={<>
        <select data-testid="topups-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm"><option value="">{tr("全部狀態")}</option>{Object.keys(LABEL).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select>
        <Input data-testid="topups-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("單號 / 用戶ID / TX")} className="w-52" />
        <Btn kind="ghost" onClick={() => setQq(q)}>{tr("搜尋")}</Btn>
      </>} />
      <Table testId="topups-table" cols={[tr("建立時間"), tr("用戶"), tr("金額 USD"), tr("應付 USDT"), tr("狀態"), tr("商戶單號 / 網關單號"), tr("TX"), tr("操作")]} rows={data || []} render={(t) => (
        <tr key={t.id} data-testid={`topup-admin-row-${t.id}`} className="hover:bg-slate-50/60">
          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmt(t.created_at)}</td>
          <td className="px-4 py-3"><div className="text-slate-800">{t.user_email || t.user_phone || "-"}</div><div className="text-[10px] text-slate-400 font-mono">{t.user_id.slice(-8)}</div></td>
          <td className="px-4 py-3 font-head font-bold text-slate-900">{Number(t.amount_usd).toFixed(2)}</td>
          <td className="px-4 py-3 text-orange-600 font-semibold">{t.pay_amount}</td>
          <td className="px-4 py-3"><Pill tone={TONE[t.status] || "slate"}>{LABEL[t.status] || t.status}</Pill>{t.manual_credit && <div className="text-[10px] text-slate-400 mt-1">{tr("手動補單")}</div>}</td>
          <td className="px-4 py-3 font-mono text-[11px] text-slate-500"><div>{t.out_trade_no}</div><div>{t.order_no}</div></td>
          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={t.tx_id}>{t.tx_id || "-"}</td>
          <td className="px-4 py-3"><div className="flex gap-1.5">
            <Btn kind="ghost" data-testid={`topup-requery-${t.id}`} onClick={() => act(t, "requery", {}, (d) => tr("網關狀態：{0}", d.gateway?.status || "-"))}>{tr("重查網關")}</Btn>
            {t.status !== "paid" && <Btn kind="ok" data-testid={`topup-credit-${t.id}`} onClick={() => credit(t)}>{tr("手動入帳")}</Btn>}
          </div></td>
        </tr>
      )} />
    </div>
  );
}
