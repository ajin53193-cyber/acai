import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { tr } from "@/i18n";
import { Btn, Card, Input, Pill, Table, Head, fmt, useLoad } from "./ui";
import { STATUS_LABELS } from "@/lib/status";

const KIND_LABEL = { credit: tr("加款"), debit: tr("扣款"), refund: tr("退款") };

function WalletAdjust({ uid, balance, callApi, onDone }) {
  const [kind, setKind] = useState("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) return toast.error(tr("請輸入正確金額"));
    if (kind === "debit" && v > Number(balance) + 1e-9) return toast.error(tr("扣款金額超過會員餘額"));
    if (!window.confirm(tr("確定{0} USD$ {1}？", KIND_LABEL[kind], v.toFixed(2)))) return;
    setBusy(true);
    try { await callApi({ method: "POST", url: `/admin/wallets/${uid}/adjust`, data: { kind, amount_usd: v, note } }); toast.success(tr("{0}成功", KIND_LABEL[kind])); setAmount(""); setNote(""); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
    setBusy(false);
  };
  return (
    <Card className="p-4 mt-4" data-testid="member-wallet-adjust">
      <div className="flex items-center justify-between mb-3"><div className="font-semibold text-slate-800 text-sm">{tr("餘額調整")}</div><div className="flex gap-1.5">{Object.entries(KIND_LABEL).map(([k, l]) => <button key={k} data-testid={`wallet-kind-${k}`} onClick={() => setKind(k)} className={`h-8 px-3 rounded-full text-xs font-semibold ${kind === k ? (k === "debit" ? "bg-red-500 text-white" : "bg-emerald-500 text-white") : "bg-slate-100 text-slate-500"}`}>{l}</button>)}</div></div>
      <div className="grid grid-cols-[120px_1fr_auto] gap-2">
        <Input data-testid="wallet-adjust-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tr("金額 USD")} />
        <Input data-testid="wallet-adjust-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("備註（會顯示在會員的交易紀錄）")} />
        <Btn kind={kind === "debit" ? "danger" : "ok"} data-testid="wallet-adjust-submit" onClick={submit} disabled={busy}>{busy ? tr("處理中…") : tr("確認{0}", KIND_LABEL[kind])}</Btn>
      </div>
    </Card>
  );
}

export function MemberDetail({ uid, callApi, onClose, onChanged }) {
  const [d, load] = useLoad(callApi, `/admin/members/${uid}`);
  useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const act = async (path, body, msg) => {
    try { await callApi({ method: "POST", url: `/admin/members/${uid}/${path}`, data: body }); toast.success(msg); load(); onChanged(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const resetPw = () => { const p = window.prompt(tr("輸入新密碼（8~32 位，數字/字母/符號至少兩種）")); if (p) act("reset-password", { new_password: p }, tr("密碼已重設，該會員其他裝置已登出")); };
  if (!d) return null;
  const Row = ({ k, v }) => <div className="flex gap-3 py-1.5 text-sm"><span className="w-24 shrink-0 text-slate-500">{k}</span><span className="text-slate-800 break-all">{v || "-"}</span></div>;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="member-detail">
        <div className="flex items-center justify-between mb-4"><h2 className="font-head text-lg font-bold text-slate-900">{tr("會員詳情")}</h2><button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
        <Card className="p-4">
          <Row k={tr("帳戶ID")} v={<span className="font-head font-bold text-slate-900 text-base">{d.account_no}</span>} />
          <Row k={tr("信箱")} v={d.emails?.join(", ")} />
          <Row k={tr("手機")} v={d.phone} />
          <Row k="Google" v={d.google ? tr("已綁定") : tr("未綁定")} />
          <Row k={tr("密碼")} v={d.password_enabled ? tr("已設定") : tr("未設定")} />
          <Row k={tr("角色")} v={d.role} />
          <Row k={tr("狀態")} v={d.banned ? <Pill tone="red">{tr("已封禁")}</Pill> : <Pill tone="emerald">{tr("正常")}</Pill>} />
          <Row k={tr("餘額")} v={<b className="text-orange-600">USD$ {Number(d.balance_usd).toFixed(2)}</b>} />
          <Row k={tr("最後登入")} v={d.last_sign_in_at ? new Date(d.last_sign_in_at).toISOString().slice(0, 16).replace("T", " ") : "-"} />
          <Row k={tr("註冊時間")} v={fmt(d.created_at)} />
          <Row k={tr("聯絡資訊")} v={d.profile ? `${d.profile.name || "-"} · ${d.profile.contact_type || ""} ${d.profile.contact || ""}` : "-"} />
        </Card>
        <div className="flex gap-2 mt-4">
          {d.banned ? <Btn kind="ok" data-testid="member-unban" onClick={() => act("unban", {}, tr("已解除封禁"))}>{tr("解封")}</Btn> : <Btn kind="danger" data-testid="member-ban" onClick={() => window.confirm(tr("確定封禁此會員？其所有登入將被登出")) && act("ban", {}, tr("已封禁"))}>{tr("封禁")}</Btn>}
          <Btn kind="ghost" data-testid="member-reset-pw" onClick={resetPw}>{tr("重置密碼")}</Btn>
        </div>
        <WalletAdjust uid={uid} balance={d.balance_usd} callApi={callApi} onDone={() => { load(); onChanged(); }} />
        <h3 className="font-semibold text-slate-800 mt-6 mb-2 text-sm">{tr("最近訂單")}</h3>
        <Card className="divide-y divide-slate-100">{(d.orders || []).length === 0 ? <div className="p-4 text-xs text-slate-400">{tr("暫無訂單")}</div> : d.orders.map((o) => <div key={o.id} className="px-4 py-2.5 text-xs flex items-center gap-3"><span className="font-mono text-slate-500">{o.id.slice(0, 8)}</span><span className="flex-1 truncate text-slate-700">{o.items?.[0]?.name}</span><span className="font-semibold">USD$ {Number(o.total_usd || 0).toFixed(2)}</span><Pill>{STATUS_LABELS[o.status] || o.status}</Pill></div>)}</Card>
        <h3 className="font-semibold text-slate-800 mt-6 mb-2 text-sm">{tr("最近錢包流水")}</h3>
        <Card className="divide-y divide-slate-100">{(d.transactions || []).length === 0 ? <div className="p-4 text-xs text-slate-400">{tr("暫無流水")}</div> : d.transactions.map((t, i) => <div key={i} className="px-4 py-2.5 text-xs flex items-center gap-3"><span className="text-slate-500">{fmt(t.created_at)}</span><span className="flex-1 truncate text-slate-700">{t.note}</span><span className={`font-semibold ${t.amount_usd >= 0 ? "text-emerald-600" : "text-red-500"}`}>{t.amount_usd >= 0 ? "+" : ""}{Number(t.amount_usd).toFixed(2)}</span></div>)}</Card>
      </div>
    </div>
  );
}

export function MembersAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [sel, setSel] = useState(null);
  const [data, load] = useLoad(callApi, `/admin/members?q=${encodeURIComponent(qq)}`);
  return (
    <div>
      <Head title={tr("會員管理")} sub={tr("綁定資訊、餘額、訂單、封禁與密碼重置")} right={<><Input data-testid="members-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("信箱 / 手機 / 姓名 / ID")} className="w-56" /><Btn kind="ghost" onClick={() => setQq(q)}>{tr("搜尋")}</Btn></>} />
      <Table testId="members-table" cols={[tr("會員"), tr("手機"), tr("Google"), tr("角色"), tr("餘額"), tr("訂單數 / 消費"), tr("註冊時間"), tr("狀態"), ""]} rows={data || []} render={(u) => (
        <tr key={u.user_id} data-testid={`member-row-${u.user_id}`} className="hover:bg-slate-50/60">
          <td className="px-4 py-3"><div className="text-slate-800">{u.email || u.profile?.name || "-"}</div><div className="text-[10px] text-slate-400 font-mono">{tr("帳戶ID")} {u.account_no}</div></td>
          <td className="px-4 py-3 text-slate-600">{u.phone || "-"}</td>
          <td className="px-4 py-3">{u.google ? <Pill tone="emerald">{tr("已綁定")}</Pill> : <span className="text-slate-300">-</span>}</td>
          <td className="px-4 py-3"><Pill tone={u.role === "admin" ? "orange" : "slate"}>{u.role}</Pill></td>
          <td className="px-4 py-3 font-head font-bold text-slate-900">${u.balance_usd.toFixed(2)}</td>
          <td className="px-4 py-3 text-slate-600">{u.order_count} / ${u.spent_usd.toFixed(2)}</td>
          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(u.created_at)}</td>
          <td className="px-4 py-3">{u.banned ? <Pill tone="red">{tr("封禁")}</Pill> : <Pill tone="emerald">{tr("正常")}</Pill>}</td>
          <td className="px-4 py-3"><Btn kind="ghost" data-testid={`member-view-${u.user_id}`} onClick={() => setSel(u.user_id)}>{tr("詳情")}</Btn></td>
        </tr>
      )} />
      {sel && <MemberDetail uid={sel} callApi={callApi} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}
