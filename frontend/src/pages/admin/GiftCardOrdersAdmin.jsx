import { useCallback, useEffect, useState } from "react";
import { Copy, Search, Gift } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Head, Card, Input, Pill, Table, fmt } from "./ui";

const STATUS = { pending_payment: ["待支付", "slate"], paid: ["已支付", "sky"], processing: ["處理中", "amber"], completed: ["已完成", "emerald"], cancelled: ["已取消", "slate"], failed: ["異常", "red"], refunded: ["已退款", "slate"] };
const TABS = [["", "全部"], ["paid", "已支付"], ["processing", "處理中"], ["completed", "已完成"], ["pending_payment", "待支付"]];

export function GiftCardOrdersAdmin({ callApi }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ rows: [], counts: {} });
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/gift-card-orders", params: { status, q } }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, status, q]);
  useEffect(() => { load(); }, [load]);
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success(tr("已複製")));
  const info = (o) => Object.values(o.delivery_info || {}).flatMap((d) => Object.entries(d || {})).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("，") || (o.recharge_account ? `ID: ${o.recharge_account}` : "-");
  return (
    <div data-testid="giftcard-orders-admin">
      <Head title={tr("禮品卡訂單")} sub={tr("用戶購買禮品卡商品後填寫的轉贈資料與系統自動生成的交易號")} />
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(([k, l]) => <button key={k} data-testid={`gco-tab-${k || "all"}`} onClick={() => setStatus(k)} className={`h-8 px-3.5 rounded-lg text-xs font-semibold ${status === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tr(l)}{k && data.counts[k] ? ` (${data.counts[k]})` : ""}</button>)}
        <div className="ml-auto relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input data-testid="gco-search" className="pl-8 w-72" placeholder={tr("搜尋訂單號 / 交易號 / 信箱")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </Card>
      <Card className="overflow-hidden">
        <Table testId="gco-table" cols={[tr("訂單號 / 時間"), tr("用戶"), tr("商品"), tr("轉贈資料"), tr("金額"), tr("交易號"), tr("狀態")]} rows={data.rows} empty={tr("暫無禮品卡訂單")} render={(o) => (
          <tr key={o.id} data-testid={`gco-row-${o.id}`} className="hover:bg-slate-50 align-top">
            <td className="px-4 py-3 whitespace-nowrap"><div className="font-mono text-xs font-semibold text-slate-800">{o.order_no}</div><div className="text-[11px] text-slate-400">{fmt(o.created_at)}</div></td>
            <td className="px-4 py-3 whitespace-nowrap"><div className="font-head font-bold text-slate-800 text-xs">{o.account_no}</div><div className="text-[11px] text-slate-400 truncate max-w-[160px]">{o.user_email}</div></td>
            <td className="px-4 py-3 min-w-[180px]">{o.items.map((i, k) => <div key={k} className="flex items-center gap-2 text-xs"><img src={i.image} alt="" className="h-7 w-7 rounded object-cover bg-slate-100" /><span className="truncate max-w-[160px]">{i.product_name}<br /><span className="text-slate-400">{i.spec_label} ×{i.quantity}</span></span></div>)}</td>
            <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] break-all">{info(o)}</td>
            <td className="px-4 py-3 whitespace-nowrap font-semibold text-orange-600">{o.currency}$ {(o.total_usd * (o.rate_to_usd || 1)).toFixed(2)}</td>
            <td className="px-4 py-3">
              {(o.gift_trade_nos || []).length === 0 ? <span className="text-xs text-slate-400">{tr("付款後生成")}</span> : o.gift_trade_nos.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-violet-700"><Gift className="h-3.5 w-3.5" /><span data-testid={`gco-trade-${o.id}-${i}`}>{g.trade_no}</span><button onClick={() => copy(g.trade_no)} className="text-slate-400 hover:text-violet-600"><Copy className="h-3.5 w-3.5" /></button></div>
              ))}
            </td>
            <td className="px-4 py-3 whitespace-nowrap"><Pill tone={(STATUS[o.status] || ["", "slate"])[1]}>{tr((STATUS[o.status] || [o.status])[0])}</Pill></td>
          </tr>
        )} />
      </Card>
    </div>
  );
}
