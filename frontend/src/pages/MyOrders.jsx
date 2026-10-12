import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Show, SignInButton } from "@clerk/react";
import { Copy, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { StatusBadge, STATUS_LABELS, STATUS_ORDER } from "@/lib/status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const FILTERS = [["all", "全部"], ...Object.entries(STATUS_LABELS)];

function money(sym, usd, rate, code) {
  const amt = usd * rate;
  const dec = ["JPY", "TWD"].includes(code) ? 0 : 2;
  return `${sym}${amt.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function OrdersInner() {
  const callApi = useApi();
  const { format } = useCurrency();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    callApi({ method: "GET", url: `/orders${filter === "all" ? "" : `?status=${filter}`}` })
      .then((r) => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [callApi, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const oid = searchParams.get("order");
    if (oid) {
      callApi({ method: "GET", url: `/orders/${oid}` }).then((r) => setDetail(r.data)).catch(() => {});
    }
  }, [searchParams, callApi]);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製");
  };

  const payNow = async (order) => {
    setPaying(true);
    try {
      const r = await callApi({ method: "POST", url: `/orders/${order.id}/pay` });
      toast.success("付款成功（測試）");
      setDetail(r.data);
      load();
    } catch {
      toast.error("付款失敗");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[60vh]">
      <h1 className="font-head text-2xl font-bold text-slate-900 mb-4">我的訂單</h1>

      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-3 mb-4">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            data-testid={`order-filter-${k}`}
            onClick={() => setFilter(k)}
            className={`whitespace-nowrap text-sm font-semibold rounded-full px-4 py-1.5 transition-colors ${
              filter === k ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-3" />
          <p>暫無訂單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              data-testid={`order-row-${o.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setDetail(o)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-slate-400">{o.order_no}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="flex gap-3">
                <img src={o.items[0]?.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{o.items[0]?.product_name}</div>
                  <div className="text-xs text-slate-400">{o.items[0]?.spec_label} × {o.items[0]?.quantity}{o.items.length > 1 ? ` 等 ${o.items.length} 項` : ""}</div>
                  <div className="text-xs text-slate-400 mt-1">充值帳號：{o.recharge_account}</div>
                </div>
                <div className="text-right">
                  <div className="font-head font-bold text-primary">{money(o.currency_symbol, o.total_usd, o.rate_to_usd, o.currency)}</div>
                  <div className="text-[10px] text-slate-400">{o.currency}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="order-detail-drawer">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-head">訂單詳情</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={detail.status} />
                  <button onClick={() => copy(detail.order_no)} className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    {detail.order_no} <Copy className="h-3 w-3" />
                  </button>
                </div>

                {/* Timeline */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    {STATUS_ORDER.map((s, i) => {
                      const done = detail.timeline?.some((t) => t.status === s) || STATUS_ORDER.indexOf(detail.status) >= i;
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && <div className={`absolute h-0.5 w-full right-1/2 top-3 ${done ? "bg-primary" : "bg-slate-200"}`} />}
                          <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${done ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
                            {done ? <Check className="h-3 w-3" /> : i + 1}
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1">{STATUS_LABELS[s]}</span>
                        </div>
                      );
                    })}
                  </div>
                  {detail.status === "exception" && <div className="text-xs text-red-500 mt-3 text-center">訂單異常，請聯絡客服</div>}
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {detail.items.map((it, idx) => (
                    <div key={idx} className="flex gap-3 bg-white border border-slate-100 rounded-xl p-2.5">
                      <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800">{it.product_name}</div>
                        <div className="text-xs text-slate-400">{it.spec_label} × {it.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Account info */}
                <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">充值帳號</span>
                    <button onClick={() => copy(detail.recharge_account)} className="font-semibold text-slate-700 flex items-center gap-1">{detail.recharge_account} <Copy className="h-3 w-3 text-slate-400" /></button>
                  </div>
                  {detail.recharge_note && <div className="flex justify-between"><span className="text-slate-400">備註</span><span className="text-slate-700">{detail.recharge_note}</span></div>}
                  {detail.contact && <div className="flex justify-between"><span className="text-slate-400">聯絡方式</span><span className="text-slate-700">{detail.contact}</span></div>}
                  {detail.admin_note && <div className="flex justify-between"><span className="text-slate-400">客服備註</span><span className="text-emerald-600">{detail.admin_note}</span></div>}
                </div>

                {/* Price */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500"><span>小計</span><span>{money(detail.currency_symbol, detail.subtotal_usd, detail.rate_to_usd, detail.currency)}</span></div>
                  {detail.discount_usd > 0 && <div className="flex justify-between text-emerald-600"><span>優惠 {detail.promo_code}</span><span>-{money(detail.currency_symbol, detail.discount_usd, detail.rate_to_usd, detail.currency)}</span></div>}
                  <div className="flex justify-between pt-2 border-t"><span className="font-semibold">應付</span><span className="font-head font-extrabold text-primary">{money(detail.currency_symbol, detail.total_usd, detail.rate_to_usd, detail.currency)}</span></div>
                </div>

                {detail.status === "pending_payment" && (
                  <button
                    data-testid="order-pay-now-btn"
                    onClick={() => payNow(detail)}
                    disabled={paying}
                    className="w-full h-11 rounded-xl bg-primary text-white font-bold disabled:opacity-60"
                  >
                    {paying ? "處理中…" : "立即付款（測試）"}
                  </button>
                )}
                <button
                  onClick={() => { copy(detail.order_no); toast.info("已複製訂單編號，請提供給客服"); }}
                  className="w-full h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
                >
                  聯絡客服處理
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function MyOrders() {
  return (
    <>
      <Show when="signed-in"><OrdersInner /></Show>
      <Show when="signed-out">
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Package className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="font-head text-xl font-bold text-slate-900 mb-2">請先登入</h2>
          <p className="text-sm text-slate-500 mb-5">登入後查看您的訂單與充值進度</p>
          <SignInButton><button className="h-11 px-6 rounded-full bg-primary text-white font-semibold">登入 / 註冊</button></SignInButton>
        </div>
      </Show>
    </>
  );
}
