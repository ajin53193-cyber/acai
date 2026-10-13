import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Copy, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Panel, SubTabs } from "@/pages/account/AccountLayout";
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
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [paying, setPaying] = useState(false);
  const { addItem } = useCart();

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

  const removeOrder = async (o) => {
    try { await callApi({ method: "DELETE", url: `/orders/${o.id}` }); toast.success("訂單已刪除"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "刪除失敗"); }
  };
  const reorder = (o) => { o.items.forEach((it) => addItem({ id: it.product_id, name: it.product_name, image: it.image }, { id: it.spec_id, label: it.spec_label, price_usd: it.unit_price_usd }, it.quantity)); navigate("/checkout"); };
  const KAVIP_LABELS = { all: "全部", pending_payment: "未付款", paid: "待審核", processing: "認證中", exception: "出貨失敗", completed: "出貨完成" };

  return (
    <Panel title="我的訂單" testId="orders-page">
      <SubTabs tabs={Object.entries(KAVIP_LABELS)} value={filter} onChange={setFilter} testPrefix="order-filter" />
      {loading ? (
        <div className="grid md:grid-cols-2 gap-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center text-slate-400" data-testid="orders-empty">無數據</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {orders.map((o) => {
            const it = o.items[0];
            const fields = o.delivery_info ? Object.values(o.delivery_info).flatMap((f) => Object.entries(f)) : [];
            return (
              <div key={o.id} data-testid={`order-card-${o.id}`} className="rounded-2xl bg-slate-50 p-5">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span className="flex items-center gap-2">訂單編號: <span className="text-slate-700">{o.order_no}</span><button onClick={() => copy(o.order_no)} className="text-slate-400 hover:text-orange-500"><Copy className="h-3.5 w-3.5" /></button></span>
                  <span>{o.created_at?.slice(0, 19).replace("T", " ")}</span>
                  <span className={o.status === "pending_payment" ? "text-slate-600" : o.status === "completed" ? "text-emerald-600" : "text-orange-500"}>{KAVIP_LABELS[o.status] || STATUS_LABELS[o.status]}</span>
                </div>
                <div className="mt-4 flex gap-5">
                  <button onClick={() => setDetail(o)} className="h-28 w-28 shrink-0 rounded-2xl bg-white p-2 shadow-sm"><img src={it?.image} alt="" className="h-full w-full object-contain rounded-xl" /></button>
                  <div className="flex-1 min-w-0 text-sm text-slate-800 space-y-1.5">
                    <div className="truncate">{it?.product_name}{o.items.length > 1 ? ` 等 ${o.items.length} 件` : ""}</div>
                    <div>{it?.spec_label} * {it?.quantity}</div>
                    {fields.slice(0, 1).map(([k, v]) => <div key={k} className="truncate">{k}: {k.includes("密碼") ? "••••••" : v}</div>)}
                    {!fields.length && o.recharge_account && <div className="truncate">ID: {o.recharge_account}</div>}
                    <div className="flex items-end justify-between gap-2 pt-1">
                      <span className="text-orange-500 font-medium">{o.currency}$ {(o.total_usd * o.rate_to_usd).toFixed(2)}</span>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {o.status === "pending_payment" && <button data-testid={`order-delete-${o.id}`} onClick={() => removeOrder(o)} className="h-9 px-3 rounded-full bg-orange-50 text-orange-500 text-xs hover:bg-orange-100">刪除訂單</button>}
                        <button data-testid={`order-reorder-${o.id}`} onClick={() => reorder(o)} className="h-9 px-4 rounded-full bg-slate-900 text-white text-xs hover:bg-slate-800">再來一單</button>
                        {o.status === "pending_payment" ? (
                          <button data-testid={`order-pay-${o.id}`} onClick={() => payNow(o)} disabled={paying} className="h-9 px-4 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600">去付款</button>
                        ) : (
                          <button data-testid={`order-detail-${o.id}`} onClick={() => setDetail(o)} className="h-9 px-4 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600">查看詳情</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
                  {detail.delivery_info && Object.values(detail.delivery_info).flatMap((f) => Object.entries(f)).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><span className="text-slate-400 shrink-0">{k}</span><span className="text-slate-700 text-right break-all">{k.includes("密碼") ? "••••••" : v}</span></div>
                  ))}
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
    </Panel>
  );
}

export default function MyOrders() {
  return <OrdersInner />;
}
