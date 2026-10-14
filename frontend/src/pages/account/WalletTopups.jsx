import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, SubTabs } from "./AccountLayout";
import { useWallet, BalanceBanner } from "./MyWallet";
import { tr } from "@/i18n";

const TABS = [["all", tr("全部")], ["pending", tr("待付款")], ["paid", tr("已到帳")], ["closed", tr("已失效")]];
const STATUS = {
  pending: [tr("待付款"), "bg-orange-100 text-orange-500"],
  paid: [tr("已到帳"), "bg-emerald-100 text-emerald-600"],
  expired: [tr("已過期"), "bg-slate-100 text-slate-500"],
  cancelled: [tr("已取消"), "bg-slate-100 text-slate-500"],
  closed: [tr("已關閉"), "bg-slate-100 text-slate-500"],
  failed: [tr("失敗"), "bg-red-100 text-red-500"],
};
const fmtTime = (s) => (s ? s.slice(0, 16).replace("T", " ") : "-");

function TopupRow({ t, onCheck }) {
  const [label, cls] = STATUS[t.status] || [t.status, "bg-slate-100 text-slate-500"];
  const copy = (v) => { navigator.clipboard?.writeText(v); toast.success(tr("已複製")); };
  return (
    <div className="py-4 first:pt-2" data-testid={`topup-row-${t.id}`}>
      <div className="flex items-start gap-3">
        <img src="/payments/usdt.svg" alt="" className="h-7 w-auto mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-head font-extrabold text-slate-800">USD$ {Number(t.amount_usd).toFixed(2)}</span>
            <span className="text-xs text-slate-500">{tr("應付")} <b className="text-orange-500" data-testid={`topup-pay-amount-${t.id}`}>{t.pay_amount} USDT</b> · {t.network}</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`} data-testid={`topup-status-${t.id}`}>{label}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{tr("建立")} {fmtTime(t.created_at)}</span>
            {t.status === "pending" && t.expires_at && <span>{tr("截止")} {fmtTime(t.expires_at)}</span>}
            {t.paid_at && <span>{tr("到帳")} {fmtTime(t.paid_at)}</span>}
            <span className="truncate max-w-full">{tr("單號")} {t.out_trade_no}</span>
          </div>
          {t.tx_id && <button onClick={() => copy(t.tx_id)} className="mt-1 text-[11px] text-slate-500 font-mono truncate max-w-full flex items-center gap-1 hover:text-orange-500" data-testid={`topup-txid-${t.id}`}><Copy className="h-3 w-3 shrink-0" />TX {t.tx_id.slice(0, 10)}…{t.tx_id.slice(-8)}</button>}
          {t.status === "pending" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href={t.pay_url} target="_blank" rel="noreferrer" data-testid={`topup-reopen-${t.id}`} className="h-8 px-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"><ExternalLink className="h-3.5 w-3.5" />{tr("重新開啟收銀台")}</a>
              <button onClick={() => onCheck(t)} data-testid={`topup-check-${t.id}`} className="h-8 px-4 rounded-full bg-orange-50 text-orange-500 text-xs font-semibold flex items-center gap-1 hover:bg-orange-100 transition-colors"><RefreshCw className="h-3.5 w-3.5" />{tr("查詢到帳")}</button>
              {t.wallet_address && <button onClick={() => copy(t.wallet_address)} className="h-8 px-4 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 hover:bg-slate-200 transition-colors"><Copy className="h-3.5 w-3.5" />{tr("複製地址")}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WalletTopups() {
  const callApi = useApi();
  const { data, load } = useWallet();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const fetchAll = useCallback(() => callApi({ method: "GET", url: "/me/wallet/topups" }).then((r) => setItems(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const check = async (t) => {
    try {
      const r = await callApi({ method: "GET", url: `/me/wallet/topup/${t.id}` });
      setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, ...r.data } : x)));
      if (r.data.status === "paid") { toast.success(tr("已到帳，餘額已更新")); load(); }
      else if (r.data.status === "pending") toast(tr("尚未收到付款，請完成轉帳後稍候再查"));
      else toast.error(tr("此充值單已失效"));
    } catch { toast.error(tr("查詢失敗，請稍後再試")); }
  };

  const shown = items.filter((t) => tab === "all" || (tab === "closed" ? !["pending", "paid"].includes(t.status) : t.status === tab));
  return (
    <Panel title={tr("充值記錄")} testId="wallet-topups-page" right={<Link to="/account/wallet" data-testid="wallet-back" className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500"><ChevronLeft className="h-4 w-4" />{tr("返回錢包")}</Link>}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-6" data-testid="wallet-topups">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} testPrefix="topup-tab" />
        {shown.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm" data-testid="topups-empty">{tr("尚無充值記錄")}<div className="mt-3"><Link to="/account/wallet/topup" className="text-orange-500 font-semibold" data-testid="topups-go-topup">{tr("前往充值 ›")}</Link></div></div>
        ) : (
          <div className="divide-y divide-slate-200/70">{shown.map((t) => <TopupRow key={t.id} t={t} onCheck={check} />)}</div>
        )}
      </div>
    </Panel>
  );
}
