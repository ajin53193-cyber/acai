import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { X, Search, Users, UserCheck, UserPlus, ShieldBan, Wallet, ShoppingBag, RotateCw, Tag as TagIcon } from "lucide-react";
import { tr } from "@/i18n";
import { Btn, Card, Input, Pill, Head, fmt, useLoad, toneCls } from "./ui";
import { STATUS_LABELS } from "@/lib/status";

const KIND_LABEL = { credit: tr("加款"), debit: tr("扣款"), refund: tr("退款") };


function StatCard({ icon: Icon, label, value, tone, tid }) {
  return (
    <Card className="p-4 flex items-center justify-between overflow-hidden relative" data-testid={`member-stat-${tid}`}>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-head text-2xl font-bold text-slate-900 mt-1">{value ?? "—"}</div>
      </div>
      <span className={`h-11 w-11 rounded-xl flex items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></span>
    </Card>
  );
}

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
      <div className="grid grid-cols-[110px_1fr_auto] gap-2">
        <Input data-testid="wallet-adjust-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tr("金額 USD")} />
        <Input data-testid="wallet-adjust-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("備註（會顯示在會員的交易紀錄）")} />
        <Btn kind={kind === "debit" ? "danger" : "ok"} data-testid="wallet-adjust-submit" onClick={submit} disabled={busy}>{busy ? tr("處理中…") : tr("確認{0}", KIND_LABEL[kind])}</Btn>
      </div>
    </Card>
  );
}

function TagsEditor({ uid, current, callApi, onDone }) {
  const [all] = useLoad(callApi, "/admin/user-tags");
  const [sel, setSel] = useState(current);
  const [saving, setSaving] = useState(false);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const dirty = JSON.stringify([...sel].sort()) !== JSON.stringify([...current].sort());
  const save = async () => { setSaving(true); try { await callApi({ method: "POST", url: `/admin/members/${uid}/tags`, data: { tag_ids: sel } }); toast.success(tr("標籤已更新")); onDone(); } catch { toast.error(tr("失敗")); } setSaving(false); };
  return (
    <Card className="p-4" data-testid="member-tags">
      <div className="flex items-center justify-between mb-2"><div className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><TagIcon className="h-4 w-4 text-slate-400" />{tr("用戶標籤")}</div>{dirty && <Btn data-testid="member-tags-save" onClick={save} disabled={saving}>{tr("儲存")}</Btn>}</div>
      <div className="flex flex-wrap gap-2">
        {(all || []).length === 0 ? <div className="text-xs text-slate-400">{tr("尚未建立標籤，請先到「用戶標籤」新增")}</div> : (all || []).map((t) => (
          <button key={t.id} data-testid={`member-tag-${t.id}`} onClick={() => toggle(t.id)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${sel.includes(t.id) ? toneCls(t.color) + " ring-2 ring-offset-1 ring-slate-300" : "bg-slate-100 text-slate-400"}`}>{t.name}</button>
        ))}
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
  const InfoRow = ({ k, v }) => <div className="flex items-center gap-3 py-2 text-sm border-b border-slate-50 last:border-0"><span className="w-20 shrink-0 text-slate-400 text-xs">{k}</span><span className="text-slate-800 break-all font-medium">{v || "-"}</span></div>;
  const DataRow = ({ k, v }) => <div className="flex items-center justify-between py-2 text-sm border-b border-slate-50 last:border-0"><span className="text-slate-500">{k}</span><span className="font-head font-bold text-slate-900">{v}</span></div>;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-50 overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="member-detail">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center justify-between px-5 py-3.5"><h2 className="font-head text-base font-bold text-slate-900">{tr("會員詳情")}</h2><button data-testid="member-detail-close" onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><X className="h-4 w-4" /></button></div>

        <div className="p-5 space-y-4">
          {/* basic info */}
          <Card className="p-4">
            <div className="text-sm font-bold text-slate-800 mb-1.5">{tr("基本信息")}</div>
            <InfoRow k={tr("帳戶ID")} v={<span className="font-mono">{d.account_no}</span>} />
            <InfoRow k={tr("手機號")} v={d.phone} />
            <InfoRow k={tr("信箱")} v={d.emails?.join(", ")} />
            <InfoRow k="Google" v={d.google ? tr("已綁定") : tr("未綁定")} />
            <InfoRow k={tr("註冊時間")} v={fmt(d.created_at)} />
            <InfoRow k={tr("最近登入")} v={d.last_sign_in_at ? new Date(d.last_sign_in_at).toISOString().slice(0, 16).replace("T", " ") : "-"} />
          </Card>

          {/* account data */}
          <Card className="p-4">
            <div className="text-sm font-bold text-slate-800 mb-1.5">{tr("帳戶數據")}</div>
            <DataRow k={tr("帳戶餘額")} v={<span className="text-orange-600">USD$ {Number(d.balance_usd).toFixed(2)}</span>} />
            <DataRow k={tr("累計消費")} v={<>USD$ {Number(d.spent_usd || 0).toFixed(2)}</>} />
            <DataRow k={tr("訂單數")} v={d.order_count || 0} />
          </Card>

          <TagsEditor uid={uid} current={d.tags || []} callApi={callApi} onDone={() => { load(); onChanged(); }} />

          <div className="grid grid-cols-2 gap-2">
            {d.banned ? <Btn kind="ok" data-testid="member-unban" onClick={() => act("unban", {}, tr("已解除封禁"))}>{tr("解封")}</Btn> : <Btn kind="danger" data-testid="member-ban" onClick={() => window.confirm(tr("確定封禁此會員？其所有登入將被登出")) && act("ban", {}, tr("已封禁"))}>{tr("封禁")}</Btn>}
            <Btn kind="ghost" data-testid="member-reset-pw" onClick={resetPw}>{tr("重置密碼")}</Btn>
          </div>

          <WalletAdjust uid={uid} balance={d.balance_usd} callApi={callApi} onDone={() => { load(); onChanged(); }} />

          <div>
            <h3 className="font-semibold text-slate-800 mt-2 mb-2 text-sm flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-slate-400" />{tr("最近訂單")}</h3>
            <Card className="divide-y divide-slate-100">{(d.orders || []).length === 0 ? <div className="p-4 text-xs text-slate-400">{tr("暫無訂單")}</div> : d.orders.map((o) => <div key={o.id} className="px-4 py-2.5 text-xs flex items-center gap-3"><span className="font-mono text-slate-500">{o.id.slice(0, 8)}</span><span className="flex-1 truncate text-slate-700">{o.items?.[0]?.name}</span><span className="font-semibold">USD$ {Number(o.total_usd || 0).toFixed(2)}</span><Pill>{STATUS_LABELS[o.status] || o.status}</Pill></div>)}</Card>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mt-2 mb-2 text-sm flex items-center gap-1.5"><Wallet className="h-4 w-4 text-slate-400" />{tr("最近錢包流水")}</h3>
            <Card className="divide-y divide-slate-100">{(d.transactions || []).length === 0 ? <div className="p-4 text-xs text-slate-400">{tr("暫無流水")}</div> : d.transactions.map((t, i) => <div key={i} className="px-4 py-2.5 text-xs flex items-center gap-3"><span className="text-slate-500">{fmt(t.created_at)}</span><span className="flex-1 truncate text-slate-700">{t.note}</span><span className={`font-semibold ${t.amount_usd >= 0 ? "text-emerald-600" : "text-red-500"}`}>{t.amount_usd >= 0 ? "+" : ""}{Number(t.amount_usd).toFixed(2)}</span></div>)}</Card>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_TABS = [["", tr("全部")], ["active", tr("正常")], ["banned", tr("已封禁")]];

export function MembersAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [tab, setTab] = useState("");
  const [sel, setSel] = useState(null);
  const [stats, loadStats] = useLoad(callApi, "/admin/members/stats");
  const [data, load] = useLoad(callApi, `/admin/members?q=${encodeURIComponent(qq)}`);
  const refresh = () => { load(); loadStats(); };
  const rows = (data || []).filter((u) => (tab === "banned" ? u.banned : tab === "active" ? !u.banned : true));

  return (
    <div data-testid="members-admin">
      <Head title={tr("會員管理")} sub={tr("會員餘額、訂單、實名認證、封禁與密碼重置")} right={<Btn kind="ghost" data-testid="members-refresh" onClick={refresh}><RotateCw className="h-3.5 w-3.5" /></Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Users} label={tr("總用戶")} value={stats?.total} tone="bg-sky-50 text-sky-600" tid="total" />
        <StatCard icon={UserCheck} label={tr("活躍用戶")} value={stats?.active} tone="bg-emerald-50 text-emerald-600" tid="active" />
        <StatCard icon={UserPlus} label={tr("近30天新增")} value={stats?.new} tone="bg-violet-50 text-violet-600" tid="new" />
        <StatCard icon={ShieldBan} label={tr("封禁用戶")} value={stats?.banned} tone="bg-red-50 text-red-500" tid="banned" />
      </div>

      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input data-testid="members-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("帳戶ID / 信箱 / 手機 / 姓名")} className="w-full h-9 rounded-lg bg-slate-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400" />
          </div>
          <Btn data-testid="members-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
          {(qq || tab) && <button data-testid="members-clear" onClick={() => { setQ(""); setQq(""); setTab(""); }} className="h-9 px-3 rounded-lg text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="h-3.5 w-3.5" />{tr("重置")}</button>}
          <div className="flex items-center gap-1 ml-auto">
            {STATUS_TABS.map(([k, l]) => <button key={k || "all"} data-testid={`members-tab-${k || "all"}`} onClick={() => setTab(k)} className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors ${tab === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>)}
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="members-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">
            {[tr("帳戶ID"), tr("訂單數 / 消費"), tr("餘額"), tr("註冊時間"), tr("狀態"), tr("操作")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-400">{data === null ? tr("載入中…") : tr("暫無會員")}</td></tr> : rows.map((u) => {
              return (
                <tr key={u.user_id} data-testid={`member-row-${u.user_id}`} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-head font-bold text-slate-900">{u.account_no}</span></td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{u.order_count} / <span className="font-semibold text-slate-800">${Number(u.spent_usd || 0).toFixed(2)}</span></td>
                  <td className="px-4 py-3 font-head font-bold text-slate-900 whitespace-nowrap">${Number(u.balance_usd || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3">{u.banned ? <Pill tone="red">{tr("封禁")}</Pill> : <Pill tone="emerald">{tr("正常")}</Pill>}</td>
                  <td className="px-4 py-3"><Btn kind="ghost" data-testid={`member-view-${u.user_id}`} onClick={() => setSel(u.user_id)}>{tr("詳情")}</Btn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {sel && <MemberDetail uid={sel} callApi={callApi} onClose={() => setSel(null)} onChanged={refresh} />}
    </div>
  );
}
