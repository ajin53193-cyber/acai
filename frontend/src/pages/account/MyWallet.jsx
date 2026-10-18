import { useEffect, useState } from "react";
import { fmtBJ, bjToday } from "@/lib/bjtime";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Wallet, ArrowDownToLine, ShoppingBag, ChevronRight, PlusCircle, MinusCircle, Gift, RotateCcw } from "lucide-react";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";
import { tr } from "@/i18n";

export function useWallet() {
  const callApi = useApi();
  const [data, setData] = useState({ balance_usd: 0, transactions: [], last_method_id: "" });
  const load = () => callApi({ method: "GET", url: "/me/wallet" }).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [callApi]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, load };
}

export function BalanceBanner({ data }) {
  const { format } = useCurrency();
  const totalIn = data.transactions.filter((t) => t.amount_usd > 0).reduce((a, t) => a + t.amount_usd, 0);
  const totalOut = -data.transactions.filter((t) => t.amount_usd < 0).reduce((a, t) => a + t.amount_usd, 0);
  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#ED8D37] text-white shadow-[0_14px_30px_-16px_rgba(237,141,55,0.8)]" data-testid="wallet-hero-card">
      <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-[#E8762A] to-transparent" />
      <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <div className="absolute left-24 -bottom-20 h-40 w-40 rounded-full bg-white/[0.07]" />
      <img src="/banners/wallet-hero.webp" alt="" className="absolute -right-2 md:right-4 top-1/2 -translate-y-1/2 h-[92%] md:h-[118%] w-auto max-w-none pointer-events-none select-none" style={{ WebkitMaskImage: "linear-gradient(to right, transparent, #000 30%)", maskImage: "linear-gradient(to right, transparent, #000 30%)" }} />
      <div className="relative px-5 py-5 md:px-8 md:py-7">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] md:text-xs font-medium"><Wallet className="h-3.5 w-3.5" />{tr("錢包餘額（USD）")}</div>
        <div className="font-head text-[34px] md:text-5xl font-extrabold mt-2 tracking-tight leading-none drop-shadow-sm" data-testid="wallet-balance">{format(data.balance_usd)}</div>
        <div className="mt-4 md:mt-6 flex gap-2.5 md:gap-3">
          <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 md:px-4 md:py-2.5 min-w-[108px]">
            <div className="flex items-center gap-1 text-[11px] md:text-xs text-white/80"><ArrowDownToLine className="h-3 w-3" />{tr("累計充值")}</div>
            <div className="font-head font-bold text-[15px] md:text-lg mt-0.5">{format(totalIn)}</div>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 md:px-4 md:py-2.5 min-w-[108px]">
            <div className="flex items-center gap-1 text-[11px] md:text-xs text-white/80"><ShoppingBag className="h-3 w-3" />{tr("累計消費")}</div>
            <div className="font-head font-bold text-[15px] md:text-lg mt-0.5">{format(totalOut)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TX_ICONS = {
  payment: [ShoppingBag, "from-[#FF9A3C] to-[#F2672D]"],
  topup: [PlusCircle, "from-[#34D399] to-[#059669]"],
  topup_bonus: [Gift, "from-[#FBBF24] to-[#F97316]"],
  giftcard: [Gift, "from-[#A78BFA] to-[#7C3AED]"],
  admin_credit: [Gift, "from-[#FBBF24] to-[#F59E0B]"],
  admin_debit: [MinusCircle, "from-[#94A3B8] to-[#64748B]"],
  refund: [RotateCcw, "from-[#60A5FA] to-[#2563EB]"],
};

function TxIcon({ kind, credit }) {
  const [Icon, grad] = TX_ICONS[kind] || (credit ? TX_ICONS.topup : TX_ICONS.payment);
  return (
    <span className={`relative h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)]`}>
      <Icon className="h-5 w-5" strokeWidth={2.2} />
      <span className={`absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-white text-[10px] font-bold leading-[12px] text-center ${credit ? "bg-emerald-500 text-white" : "bg-slate-800 text-white"}`}>{credit ? "+" : "−"}</span>
    </span>
  );
}

const KIND_LABEL = { payment: tr("訂單付款"), topup: tr("錢包充值"), topup_bonus: tr("充值贈送"), admin_credit: tr("平台加款"), admin_debit: tr("平台扣款"), admin_refund: tr("平台退款"), refund: tr("退款"), giftcard: tr("禮品卡充值") };

function TxDetailSheet({ t, onClose }) {
  const { format } = useCurrency();
  if (!t) return null;
  const credit = t.amount_usd >= 0;
  const m = /^(.*?)\s+([A-Z]{2}\d{8,})$/.exec(t.note || "");
  const rows = [
    [tr("交易類型"), KIND_LABEL[t.kind] || (credit ? tr("入帳") : tr("支出"))],
    [tr("交易金額"), `${credit ? "+" : "-"}${format(Math.abs(t.amount_usd))}`],
    [tr("交易後餘額"), format(t.balance_after_usd)],
    [tr("交易時間"), fmtBJ(t.created_at)],
    m ? [tr("訂單編號"), m[2]] : null,
    t.note ? [tr("說明"), m ? m[1] : t.note] : null,
    [tr("交易單號"), t.id],
  ].filter(Boolean);
  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-[#FFF4EA] border-0 px-5 pb-8 max-h-[88vh] overflow-y-auto [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:18px_18px] sm:max-w-md sm:mx-auto" data-testid="tx-detail-sheet">
        <SheetHeader><SheetTitle className="font-head text-slate-900 text-center">{tr("交易詳情")}</SheetTitle></SheetHeader>
        <div className="mt-3 flex flex-col items-center">
          <TxIcon kind={t.kind} credit={credit} />
          <div className={`mt-3 font-head text-3xl font-extrabold ${credit ? "text-emerald-600" : "text-slate-900"}`} data-testid="tx-detail-amount">{credit ? "+" : "-"}{format(Math.abs(t.amount_usd))}</div>
          <div className="text-xs text-slate-500 mt-1">{KIND_LABEL[t.kind] || t.note}</div>
        </div>
        {t.order?.items?.length > 0 && (
          <div className="mt-5 bg-white rounded-2xl p-3 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]" data-testid="tx-detail-items">
            <div className="text-xs text-slate-400 px-1 mb-2">{tr("購買商品")}</div>
            <div className="space-y-2">
              {t.order.items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <img src={i.image} alt="" className="h-11 w-11 rounded-xl object-cover bg-slate-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 truncate">{i.product_name}</div>
                    <div className="text-xs text-slate-500 truncate">{i.spec_label}</div>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">x{i.quantity}</div>
                </div>
              ))}
            </div>
            <Link to="/orders" onClick={onClose} data-testid="tx-detail-view-order" className="mt-3 flex items-center justify-center h-9 rounded-full bg-orange-50 text-orange-500 text-xs font-semibold">{tr("查看訂單 ›")}</Link>
          </div>
        )}
        <div className="mt-4 bg-white rounded-2xl p-4 text-sm space-y-3 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4"><span className="text-slate-400 shrink-0">{k}</span><span className="text-slate-800 text-right break-all">{v}</span></div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TxRow({ t }) {
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const credit = t.amount_usd >= 0;
  const m = /^(.*?)\s+([A-Z]{2}\d{8,})$/.exec(t.note || "");
  const items = t.order?.items || [];
  const title = items.length ? `${items[0].product_name}${items[0].spec_label ? ` · ${items[0].spec_label}` : ""}${items.length > 1 ? tr(" 等{0}件", items.length) : ""}` : (m ? m[1] : t.note);
  const ref = m ? m[2] : "";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left flex items-center gap-3 py-3 text-sm active:bg-orange-50/60 rounded-xl transition-colors" data-testid={`tx-row-${t.id}`}>
        <TxIcon kind={t.kind} credit={credit} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-800 font-medium truncate">{title}</span>
            <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] ${credit ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"}`}>{items.length ? tr("購買") : credit ? tr("入帳") : tr("支出")}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{fmtBJ(t.created_at, "minute")}{ref && <span className="ml-2 font-mono">{ref}</span>}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-head font-bold text-[15px] ${credit ? "text-emerald-600" : "text-slate-900"}`}>{credit ? "+" : "-"}{format(Math.abs(t.amount_usd))}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{tr("餘額")} {format(t.balance_after_usd)}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 -ml-1" />
      </button>
      {open && <TxDetailSheet t={t} onClose={() => setOpen(false)} />}
    </>
  );
}

const ACTIONS = [
  { to: "/account/wallet/topup", title: tr("錢包充值"), sub: tr("多種支付 · 即時入帳"), btn: tr("立即充值"), img: "/banners/wallet-topup-3d.webp", bg: "#FED5B5", tid: "wallet-go-topup" },
  { to: "/account/wallet/transactions", title: tr("交易紀錄"), sub: tr("充值 · 付款 · 明細"), btn: tr("查看明細"), img: "/banners/wallet-transactions-3d.webp", bg: "#F3CCAB", tid: "wallet-go-transactions" },
  { to: "/account/wallet/topups", title: tr("充值記錄"), sub: tr("充值單 · 到帳狀態"), btn: tr("查看記錄"), img: "/banners/wallet-topups-3d.webp", bg: "#FBE3C9", tid: "wallet-go-topups" },
];

export default function MyWallet() {
  const { data } = useWallet();
  const last = data.transactions[0];
  return (
    <Panel title={tr("我的錢包")} testId="wallet-page">
      <div className="pb-36 md:pb-0 max-md:min-h-[calc(100dvh-170px)]">
        <BalanceBanner data={data} />
        <div className="mt-4 md:mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} data-testid={a.tid} style={{ backgroundColor: a.bg }} className="group relative block overflow-hidden rounded-xl md:rounded-2xl aspect-[16/10] md:aspect-[2.3/1] last:max-md:col-span-2 last:max-md:aspect-[2.6/1] shadow-[0_8px_22px_-14px_rgba(232,121,42,0.5)] hover:shadow-lg transition-shadow">
              <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-white/40 to-transparent" />
              <img src={a.img} alt="" className="absolute right-1 md:right-4 bottom-0 h-[86%] w-auto max-w-none group-hover:scale-105 transition-transform duration-300" />
              <div className="relative h-full flex flex-col justify-center pl-3.5 md:pl-7 pr-[42%]">
                <div className="font-head text-[17px] md:text-2xl font-extrabold text-[#5A2D0C] leading-tight">{a.title}</div>
                <div className="mt-0.5 md:mt-1 text-[10px] md:text-sm text-[#8A5A3A] whitespace-nowrap">{a.sub}</div>
                <span className="mt-2 md:mt-3 inline-flex self-start items-center gap-0.5 rounded-full bg-white text-orange-500 text-[10px] md:text-sm font-bold px-2.5 md:px-4 py-1 md:py-1.5 shadow-sm">{a.btn}<ChevronRight className="h-3 w-3 md:h-4 md:w-4" /></span>
              </div>
            </Link>
          ))}
        </div>
        {last && (
          <div className="mt-4 md:mt-6 relative rounded-2xl bg-white md:bg-slate-50 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] md:shadow-none px-4 md:px-6 pt-11 md:pt-4 pb-2 md:pb-3" data-testid="wallet-last-tx">
            <div className="absolute left-0 top-0 right-0 flex items-center justify-between md:static">
              <span className="rounded-tl-2xl rounded-br-xl bg-slate-800 text-white text-[13px] px-3.5 py-1.5 md:rounded-md md:text-xs md:px-3 md:py-1">{tr("最近一筆")}</span>
              <Link to="/account/wallet/transactions" data-testid="wallet-last-tx-more" className="text-xs text-orange-500 pr-4 pt-2 md:pt-0 md:pr-0">{tr("全部明細 ›")}</Link>
            </div>
            <TxRow t={last} />
          </div>
        )}
      </div>
    </Panel>
  );
}
