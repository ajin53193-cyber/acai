import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Gift, Package, Wallet, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, Input, Pill, fmt } from "@/pages/admin/ui";
import { tr } from "@/i18n";

const KINDS = [["all", tr("全部")], ["order", tr("商品訂單")], ["giftcard", tr("禮品卡訂單")], ["topup", tr("充值")]];
const KIND_ICON = { order: Package, giftcard: Gift, topup: Wallet };
const STATUS_LABEL = { completed: tr("已完成"), approved: tr("已到帳"), paid: tr("已支付"), processing: tr("處理中"), shipped: tr("已發貨"), reviewing: tr("審核中"), pending: tr("待支付"), need_info: tr("待填資料"), confirming: tr("鏈上確認中"), expired: tr("已過期"), pending_payment: tr("待支付"), cancelled: tr("已取消"), rejected: tr("已拒絕"), failed: tr("失敗"), refunded: tr("已退款") };
const STATUS_TONE = { completed: "green", approved: "green", paid: "orange", processing: "orange", need_info: "orange", confirming: "orange", reviewing: "orange", pending_payment: "slate", cancelled: "slate", rejected: "red", failed: "red" };

function PlatformTag({ p }) {
  const local = p?.id === "gogo589";
  return <span data-testid="hub-platform-tag" className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${local ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"}`}>{p?.name || p?.id}</span>;
}

function usePlatforms(callApi) {
  const [plats, setPlats] = useState([]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/hub/platforms/public" }).then((r) => setPlats(r.data.platforms)).catch(() => {}); }, [callApi]);
  return plats;
}

function Filters({ plats, platform, setPlatform, q, setQ, onRefresh, loading, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <select data-testid="hub-platform-filter" value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
        <option value="all">{tr("全部平台")}</option><option value="gogo589">gogo589</option>{plats.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {children}
      <div className="relative"><Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" /><Input data-testid="hub-search" className="pl-8 w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("訂單號 / 用戶 / 商品")} /></div>
      <button data-testid="hub-refresh" onClick={onRefresh} className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
    </div>
  );
}

export function HubOrdersAdmin({ callApi }) {
  const plats = usePlatforms(callApi);
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ rows: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => { setLoading(true); callApi({ method: "GET", url: `/admin/hub/orders?platform=${platform}&kind=${kind}&q=${encodeURIComponent(q)}&size=100` }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))).finally(() => setLoading(false)); }, [callApi, platform, kind, q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  return (
    <div data-testid="hub-orders-admin">
      <Filters plats={plats} platform={platform} setPlatform={setPlatform} q={q} setQ={setQ} onRefresh={load} loading={loading}>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">{KINDS.map(([k, l]) => <button key={k} data-testid={`hub-kind-${k}`} onClick={() => setKind(k)} className={`h-8 px-3 rounded-md text-xs font-semibold ${kind === k ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div>
      </Filters>
      {data.errors?.length > 0 && <div data-testid="hub-errors" className="mb-3 rounded-lg bg-red-50 text-red-600 text-xs px-3 py-2">{data.errors.map((e) => `${e.name}：${e.error}`).join("；")}</div>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="hub-orders-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{[tr("平台"), tr("類型"), tr("訂單"), tr("用戶"), tr("商品 / 方式"), tr("金額 (USD)"), tr("狀態"), tr("時間")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{loading ? tr("載入中…") : tr("暫無數據")}</td></tr>}
            {data.rows.map((r) => { const Icon = KIND_ICON[r.type] || Package; return (
              <tr key={`${r.platform?.id}-${r.type}-${r.id}`} className="hover:bg-orange-50/40">
                <td className="px-4 py-3"><PlatformTag p={r.platform} /></td>
                <td className="px-4 py-3 text-slate-500"><span className="inline-flex items-center gap-1 text-xs"><Icon className="h-3.5 w-3.5" />{KINDS.find(([k]) => k === r.type)?.[1] || r.type}</span></td>
                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{r.order_no}</td>
                <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">{r.user}</td>
                <td className="px-4 py-3 text-slate-600 truncate max-w-[260px]">{(r.items || []).join("、")}</td>
                <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">${Number(r.amount_usd || 0).toFixed(2)}{r.amount_label && <div className="text-[11px] font-normal text-slate-400">{r.amount_label}</div>}</td>
                <td className="px-4 py-3"><Pill tone={STATUS_TONE[r.status] || "slate"}>{STATUS_LABEL[r.status] || r.status || "-"}</Pill></td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
              </tr>); })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function HubMembersAdmin({ callApi }) {
  const plats = usePlatforms(callApi);
  const [platform, setPlatform] = useState("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ rows: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => { setLoading(true); callApi({ method: "GET", url: `/admin/hub/members?platform=${platform}&q=${encodeURIComponent(q)}&size=100` }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))).finally(() => setLoading(false)); }, [callApi, platform, q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  return (
    <div data-testid="hub-members-admin">
      <Filters plats={plats} platform={platform} setPlatform={setPlatform} q={q} setQ={setQ} onRefresh={load} loading={loading} />
      {data.errors?.length > 0 && <div className="mb-3 rounded-lg bg-red-50 text-red-600 text-xs px-3 py-2">{data.errors.map((e) => `${e.name}：${e.error}`).join("；")}</div>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="hub-members-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{[tr("平台"), tr("郵箱"), tr("名稱"), tr("錢包餘額 (USD)"), tr("註冊時間")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{loading ? tr("載入中…") : tr("暫無數據")}</td></tr>}
            {data.rows.map((u) => (
              <tr key={`${u.platform?.id}-${u.id}`} className="hover:bg-orange-50/40">
                <td className="px-4 py-3"><PlatformTag p={u.platform} /></td>
                <td className="px-4 py-3 font-semibold text-slate-800">{u.email}{u.is_test && <span className="ml-1 text-[10px] text-slate-400">{tr("測試")}</span>}</td>
                <td className="px-4 py-3 text-slate-600">{u.name}</td>
                <td className="px-4 py-3 font-bold text-slate-800">${Number(u.wallet_usd || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function HubStatsCards({ callApi, days }) {
  const [d, setD] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: `/admin/hub/stats?days=${days}` }).then((r) => setD(r.data)).catch(() => {}); }, [callApi, days]);
  if (!d || d.platforms.length < 2) return null;
  const cols = [["revenue_usd", tr("營收"), true], ["orders", tr("訂單")], ["topup_usd", tr("充值"), true], ["topups", tr("充值筆數")], ["new_members", tr("新會員")], ["members", tr("會員總數")], ["pending_orders", tr("待處理")], ["pending_topups", tr("待審充值")]];
  const cell = (v, usd) => (usd ? `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Number(v || 0).toLocaleString());
  return (
    <Card className="p-4 mb-5" data-testid="hub-stats-card">
      <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-orange-500" /><span className="font-semibold text-slate-800">{tr("多平台匯總（近 {0} 天）", d.days)}</span>
        {d.errors?.length > 0 && <span className="text-xs text-red-500">{d.errors.map((e) => `${e.name}：${e.error}`).join("；")}</span>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="hub-stats-table">
        <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="px-3 py-2">{tr("平台")}</th>{cols.map(([k, l]) => <th key={k} className="px-3 py-2 font-semibold text-right whitespace-nowrap">{l}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {d.platforms.map((p) => <tr key={p.platform.id}><td className="px-3 py-2"><PlatformTag p={p.platform} /></td>{cols.map(([k, , usd]) => <td key={k} className="px-3 py-2 text-right text-slate-700">{cell(p[k], usd)}</td>)}</tr>)}
          <tr className="bg-orange-50/60 font-bold text-slate-900" data-testid="hub-stats-total"><td className="px-3 py-2">{tr("合計")}</td>{cols.map(([k, , usd]) => <td key={k} className="px-3 py-2 text-right">{cell(d.total[k], usd)}</td>)}</tr>
        </tbody>
      </table></div>
    </Card>
  );
}
