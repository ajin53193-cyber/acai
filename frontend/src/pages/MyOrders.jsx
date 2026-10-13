import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Copy, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Panel, SubTabs } from "@/pages/account/AccountLayout";
import { useCurrency } from "@/context/CurrencyContext";
import { StatusBadge, STATUS_LABELS, STATUS_ORDER, orderLabel } from "@/lib/status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { publicApi } from "@/lib/api";

function OrderInfoForm({ order, callApi, onDone }) {
  const [defs, setDefs] = useState({});
  const [vals, setVals] = useState(order.delivery_info || {});
  const [open, setOpen] = useState(order.info_submitted === false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ids = [...new Set(order.items.map((i) => i.product_id))];
    Promise.all(ids.map((pid) => publicApi.get(`/products/${pid}`).then((r) => [pid, r.data]).catch(() => [pid, null]))).then((rs) => {
      const d = {};
      rs.forEach(([pid, p]) => { if (p) d[pid] = { name: p.name, fields: p.delivery_fields?.length ? p.delivery_fields : [{ name: p.account_field_label || "充值帳號 / ID", required: true, type: "text", options: [] }] }; });
      setDefs(d);
    });
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (pid, name, v) => setVals((d) => ({ ...d, [pid]: { ...(d[pid] || {}), [name]: v } }));
  const submit = async () => {
    for (const pid of Object.keys(defs)) for (const f of defs[pid].fields) if (f.required && !(vals[pid]?.[f.name] || "").trim()) return toast.error(`請填寫「${f.name}」`);
    setBusy(true);
    try { const r = await callApi({ method: "POST", url: `/orders/${order.id}/info`, data: { delivery_info: vals } }); toast.success("充值資料已提交，等待人工充值"); setOpen(false); onDone(r.data); }
    catch (e) { toast.error(e.response?.data?.detail || "提交失敗"); }
    setBusy(false);
  };
  if (order.info_submitted !== false) return <div data-testid="order-info-locked" className="w-full rounded-xl bg-orange-50 text-orange-600 text-xs px-3 py-2.5 text-center">充值資料已提交，等待人工處理；如帳號有誤將由客服駁回後開放修改</div>;
  if (!open) return <button data-testid="order-info-edit" onClick={() => setOpen(true)} className="w-full h-10 rounded-xl border border-orange-300 text-orange-600 text-sm font-semibold hover:bg-orange-50">填寫充值資料</button>;
  const inp = "w-full h-11 rounded-xl bg-slate-100 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
  return (
    <div className="rounded-2xl border border-orange-300 bg-white p-4 text-sm space-y-3 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]" data-testid="order-info-form">
      <div className="font-bold text-slate-900">請填寫充值資料<span className="text-orange-500">，提交後開始人工充值</span></div>
      {order.info_rejected && <div data-testid="order-info-reject-reason" className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2">後台駁回：{order.info_reject_reason}，請重新填寫後提交</div>}
      <div className="text-[11px] text-slate-500">提交後將無法自行修改，請務必核對無誤</div>
      {Object.entries(defs).map(([pid, d]) => (
        <div key={pid} className="space-y-2">
          {Object.keys(defs).length > 1 && <div className="text-xs font-semibold text-slate-500">{d.name}</div>}
          {d.fields.map((f) => (
            <div key={f.name}>
              <div className="text-xs text-slate-600 mb-1">{f.required && <span className="text-red-500">*</span>}{f.name}</div>
              {f.type === "select" ? (
                <select data-testid={`order-info-${pid}-${f.name}`} value={vals[pid]?.[f.name] || ""} onChange={(e) => set(pid, f.name, e.target.value)} className={inp}><option value="">請選擇</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input data-testid={`order-info-${pid}-${f.name}`} type={f.type === "password" ? "password" : "text"} value={vals[pid]?.[f.name] || ""} onChange={(e) => set(pid, f.name, e.target.value)} placeholder={f.placeholder || `請輸入${f.name}`} className={inp} />
              )}
              {f.tips && <div className="text-[11px] text-orange-500 mt-1">{f.tips}</div>}
            </div>
          ))}
        </div>
      ))}
      <button data-testid="order-info-submit" onClick={submit} disabled={busy} className="w-full h-11 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-60">{busy ? "提交中…" : "提交充值資料"}</button>
    </div>
  );
}

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
      const r = await callApi({ method: "POST", url: `/orders/${order.id}/pay-wallet` });
      toast.success("錢包付款成功");
      setDetail(r.data);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "付款失敗");
    } finally {
      setPaying(false);
    }
  };

  const removeOrder = async (o) => {
    try { await callApi({ method: "DELETE", url: `/orders/${o.id}` }); toast.success("訂單已刪除"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "刪除失敗"); }
  };
  const reorder = (o) => { o.items.forEach((it) => addItem({ id: it.product_id, name: it.product_name, image: it.image }, { id: it.spec_id, label: it.spec_label, price_usd: it.unit_price_usd }, it.quantity)); navigate("/checkout"); };
  const KAVIP_LABELS = { all: "全部", pending_payment: "未付款", awaiting_info: "等待填寫資料", waiting: "等待中", completed: "已完成" };

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
                <div className="text-sm text-slate-500">
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <span className="flex items-center gap-2 min-w-0">訂單編號: <span className="text-slate-700 truncate">{o.order_no}</span><button onClick={() => copy(o.order_no)} className="text-slate-400 hover:text-orange-500 shrink-0"><Copy className="h-3.5 w-3.5" /></button></span>
                    <span className={`ml-auto shrink-0 font-medium ${o.status === "pending_payment" ? "text-slate-600" : o.status === "completed" ? "text-emerald-600" : "text-orange-500"}`} data-testid={`order-status-${o.id}`}>{orderLabel(o)}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{o.created_at?.slice(0, 19).replace("T", " ")}</div>
                </div>
                <div className="mt-4 flex gap-5">
                  <button onClick={() => setDetail(o)} className="h-24 w-24 shrink-0 rounded-2xl bg-white p-2 shadow-sm"><img src={it?.image} alt="" className="h-full w-full object-contain rounded-xl" /></button>
                  <div className="flex-1 min-w-0 text-sm text-slate-800 space-y-1.5">
                    <div className="truncate">{it?.product_name}{o.items.length > 1 ? ` 等 ${o.items.length} 件` : ""}</div>
                    <div>{it?.spec_label} * {it?.quantity}</div>
                    {fields.slice(0, 1).map(([k, v]) => <div key={k} className="truncate">{k}: {k.includes("密碼") ? "••••••" : v}</div>)}
                    {!fields.length && o.recharge_account && <div className="truncate">ID: {o.recharge_account}</div>}
                    <div className="text-orange-500 font-semibold pt-0.5">{o.currency}$ {(o.total_usd * o.rate_to_usd).toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-end gap-2">
                  {o.status === "pending_payment" && <button data-testid={`order-delete-${o.id}`} onClick={() => removeOrder(o)} className="h-9 px-4 rounded-full bg-white text-slate-600 text-xs hover:bg-orange-50 hover:text-orange-500 whitespace-nowrap">刪除訂單</button>}
                  <button data-testid={`order-reorder-${o.id}`} onClick={() => reorder(o)} className="h-9 px-4 rounded-full bg-slate-900 text-white text-xs hover:bg-slate-800 whitespace-nowrap">再來一單</button>
                  {o.status === "paid" && o.info_submitted === false && (
                    <button data-testid={`order-fill-${o.id}`} onClick={() => setDetail(o)} className="h-9 px-4 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 whitespace-nowrap">填寫充值資料</button>
                  )}
                  {o.status === "pending_payment" ? (
                    <button data-testid={`order-pay-${o.id}`} onClick={() => payNow(o)} disabled={paying} className="h-9 px-4 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 whitespace-nowrap">去付款</button>
                  ) : (
                    <button data-testid={`order-detail-${o.id}`} onClick={() => setDetail(o)} className="h-9 px-4 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 whitespace-nowrap">查看詳情</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-[#FFF4EA] border-l-0 [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:18px_18px]" data-testid="order-detail-drawer">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-head text-slate-900 relative inline-block mx-auto"><span className="relative z-10">訂單詳情</span><span className="absolute left-0 right-0 bottom-0.5 h-2 bg-orange-200/80 rounded-sm" /></SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={detail.status} />
                  <button onClick={() => copy(detail.order_no)} className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    {detail.order_no} <Copy className="h-3 w-3" />
                  </button>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl p-4 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]">
                  <div className="flex items-center justify-between">
                    {STATUS_ORDER.map((s, i) => {
                      const done = detail.timeline?.some((t) => t.status === s) || STATUS_ORDER.indexOf(detail.status) >= i;
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && <div className={`absolute h-0.5 w-full right-1/2 top-3 ${done ? "bg-orange-400" : "bg-orange-100"}`} />}
                          <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${done ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-400"}`}>
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
                    <div key={idx} className="flex gap-3 bg-white rounded-2xl p-3 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]">
                      <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800">{it.product_name}</div>
                        <div className="text-xs text-slate-400">{it.spec_label} × {it.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {["paid", "pending_payment"].includes(detail.status) && (
                  <OrderInfoForm order={detail} callApi={callApi} onDone={(o) => { setDetail(o); load(); }} />
                )}
                {/* Account info */}
                {(Object.keys(detail.delivery_info || {}).length > 0 || detail.recharge_note || detail.admin_note) && (
                <div className="bg-white rounded-2xl p-4 text-sm space-y-2 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]" data-testid="order-detail-info">
                  {detail.delivery_info && Object.values(detail.delivery_info).flatMap((f) => Object.entries(f)).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><span className="text-slate-400 shrink-0">{k}</span><span className="text-slate-700 text-right break-all">{k.includes("密碼") ? "••••••" : v}</span></div>
                  ))}
                  {detail.recharge_note && <div className="flex justify-between"><span className="text-slate-400">備註</span><span className="text-slate-700">{detail.recharge_note}</span></div>}
                  {detail.admin_note && <div className="flex justify-between"><span className="text-slate-400">客服備註</span><span className="text-emerald-600">{detail.admin_note}</span></div>}
                </div>
                )}

                {/* Price */}
                <div className="bg-white rounded-2xl p-4 space-y-1.5 text-sm shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]">
                  <div className="flex justify-between text-slate-500"><span>小計</span><span>{money(detail.currency_symbol, detail.subtotal_usd, detail.rate_to_usd, detail.currency)}</span></div>
                  {detail.discount_usd > 0 && <div className="flex justify-between text-emerald-600"><span>優惠 {detail.promo_code}</span><span>-{money(detail.currency_symbol, detail.discount_usd, detail.rate_to_usd, detail.currency)}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-dashed border-orange-100"><span className="font-semibold">應付</span><span className="font-head font-extrabold text-orange-500">{money(detail.currency_symbol, detail.total_usd, detail.rate_to_usd, detail.currency)}</span></div>
                </div>

                {detail.status === "pending_payment" && (
                  <button
                    data-testid="order-pay-now-btn"
                    onClick={() => payNow(detail)}
                    disabled={paying}
                    className="w-full h-11 rounded-full bg-orange-500 text-white font-bold disabled:opacity-60"
                  >
                    {paying ? "處理中…" : "立即付款（測試）"}
                  </button>
                )}
                <button
                  onClick={() => { copy(detail.order_no); toast.info("已複製訂單編號，請提供給客服"); }}
                  className="w-full h-11 rounded-full bg-white border border-orange-300 text-orange-500 font-semibold text-sm"
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
