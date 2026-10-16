import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Copy, Package, Check, CheckCircle2, Gift, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useCart } from "@/context/CartContext";
import { Panel, SubTabs } from "@/pages/account/AccountLayout";
import { useCurrency } from "@/context/CurrencyContext";
import { StatusBadge, STATUS_LABELS, STATUS_ORDER, orderLabel } from "@/lib/status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";
import { ContactInfoDialog, profileComplete } from "@/components/ContactInfoDialog";

function OrderInfoForm({ order, callApi, onDone }) {
  const [defs, setDefs] = useState({});
  const [vals, setVals] = useState(order.delivery_info || {});
  const [open, setOpen] = useState(order.info_submitted === false);
  useEffect(() => { if (order.info_submitted === false && order.info_rejected) setOpen(true); }, [order.info_submitted, order.info_rejected]);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: "/me/profile" }).then((r) => setProfile(r.data.profile || {})).catch(() => setProfile({})); }, [callApi]);
  useEffect(() => {
    const ids = [...new Set(order.items.map((i) => i.product_id))];
    Promise.all(ids.map((pid) => publicApi.get(`/products/${pid}`).then((r) => [pid, r.data]).catch(() => [pid, null]))).then((rs) => {
      const d = {};
      rs.forEach(([pid, p]) => { if (p) d[pid] = { name: p.name, fields: p.delivery_fields?.length ? p.delivery_fields : [{ name: p.account_field_label || tr("充值帳號 / ID"), required: true, type: "text", options: [] }] }; });
      setDefs(d);
    });
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (pid, name, v) => setVals((d) => ({ ...d, [pid]: { ...(d[pid] || {}), [name]: v } }));
  const [confirming, setConfirming] = useState(false);
  const submit = () => {
    for (const pid of Object.keys(defs)) for (const f of defs[pid].fields) if (f.required && !(vals[pid]?.[f.name] || "").trim()) return toast.error(tr("請填寫「{0}」", f.name));
    setConfirming(true);
  };
  const doSubmit = async () => {
    setConfirming(false);
    setBusy(true);
    try { const r = await callApi({ method: "POST", url: `/orders/${order.id}/info`, data: { delivery_info: vals } }); toast.success(r.data.is_giftcard_order ? (r.data.gift_manual ? tr("充值資料已提交，等待人工轉贈") : tr("充值資料已提交，等待系統轉贈充值")) : tr("充值資料已提交，等待人工充值")); setOpen(false); onDone(r.data); }
    catch (e) { toast.error(e.response?.data?.detail || tr("提交失敗")); }
    setBusy(false);
  };
  if (order.info_submitted !== false && order.is_giftcard_order && order.status === "processing" && order.gift_manual) return <GiftManualWaiting />;
  if (order.info_submitted !== false && order.is_giftcard_order && order.status === "processing") return <GiftTransferring order={order} onRefresh={onDone} callApi={callApi} />;
  if (order.info_submitted !== false) return <div data-testid="order-info-locked" className="w-full rounded-xl bg-orange-50 text-orange-600 text-xs px-3 py-2.5 text-center">{tr("充值資料已提交，等待人工處理；如帳號有誤將由平台駁回後開放修改")}</div>;
  if (!open) return <button data-testid="order-info-edit" onClick={() => setOpen(true)} className="w-full h-10 rounded-xl border border-orange-300 text-orange-600 text-sm font-semibold hover:bg-orange-50">{tr("填寫充值資料")}</button>;
  const inp = "w-full h-11 rounded-xl bg-slate-100 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
  if (profile && !profileComplete(profile)) return <ContactInfoDialog initial={profile} onSaved={(p) => setProfile(p)} onClose={() => setOpen(false)} />;
  return (
    <div className="rounded-2xl border border-orange-300 bg-white p-4 text-sm space-y-3 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]" data-testid="order-info-form">
      <div className="font-bold text-slate-900">{tr("請填寫充值資料")}<span className="text-orange-500">{tr("，提交後開始人工充值")}</span></div>
      {order.info_rejected && <div data-testid="order-info-reject-reason" className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 font-semibold">{order.gift_auto_failed ? order.info_reject_reason : <>{tr("平台駁回：")}{order.info_reject_reason}{tr("，請重新填寫後提交")}</>}</div>}
      <div className="text-[11px] text-slate-500">{tr("提交後將無法自行修改，請務必核對無誤")}</div>
      {Object.entries(defs).map(([pid, d]) => (
        <div key={pid} className="space-y-2">
          {Object.keys(defs).length > 1 && <div className="text-xs font-semibold text-slate-500">{d.name}</div>}
          {d.fields.map((f) => (
            <div key={f.name}>
              <div className="text-xs text-slate-600 mb-1">{f.required && <span className="text-red-500">*</span>}{f.name}</div>
              {f.type === "select" ? (
                <select data-testid={`order-info-${pid}-${f.name}`} value={vals[pid]?.[f.name] || ""} onChange={(e) => set(pid, f.name, e.target.value)} className={inp}><option value="">{tr("請選擇")}</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input data-testid={`order-info-${pid}-${f.name}`} type={f.type === "password" ? "password" : "text"} value={vals[pid]?.[f.name] || ""} onChange={(e) => set(pid, f.name, e.target.value)} placeholder={f.placeholder || tr("請輸入{0}", f.name)} className={inp} />
              )}
              {f.tips && <div className="text-[11px] text-orange-500 mt-1">{f.tips}</div>}
            </div>
          ))}
        </div>
      ))}
      <button data-testid="order-info-submit" onClick={submit} disabled={busy} className="w-full h-11 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-60">{busy ? tr("提交中…") : tr("提交充值資料")}</button>
      {confirming && <InfoConfirm defs={defs} vals={vals} onBack={() => setConfirming(false)} onConfirm={doSubmit} />}
    </div>
  );
}

function InfoConfirm({ defs, vals, onBack, onConfirm }) {
  const rows = Object.entries(defs).flatMap(([pid, d]) => d.fields.map((f) => ({ key: `${pid}-${f.name}`, product: d.name, label: f.name, value: f.type === "password" ? "••••••" : (vals[pid]?.[f.name] || "") })));
  const multi = Object.keys(defs).length > 1;
  return (
    <div data-testid="order-info-confirm" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onBack}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="font-bold text-slate-900 text-base">{tr("請核對充值資料")}</div>
          <div className="text-xs text-orange-500 mt-1">{tr("提交後將無法自行修改，請務必核對無誤")}</div>
        </div>
        <div className="rounded-xl bg-orange-50 divide-y divide-orange-100">
          {rows.map((r) => (
            <div key={r.key} className="px-3 py-2.5">
              <div className="text-[11px] text-slate-500">{multi ? `${r.product} · ` : ""}{r.label}</div>
              <div data-testid={`order-info-confirm-${r.key}`} className="text-base font-bold text-slate-900 break-all tracking-wide">{r.value}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button data-testid="order-info-confirm-back" onClick={onBack} className="flex-1 h-11 rounded-full border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">{tr("返回修改")}</button>
          <button data-testid="order-info-confirm-ok" onClick={onConfirm} className="flex-1 h-11 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600">{tr("確認無誤，提交")}</button>
        </div>
      </div>
    </div>
  );
}

function GiftManualWaiting() {
  return (
    <div data-testid="order-gift-manual" className="w-full rounded-3xl border border-orange-200/70 bg-gradient-to-b from-[#FFE6CC] via-[#FFF1E2] to-white px-4 py-6 text-center">
      <div className="mx-auto h-20 w-20 rounded-full overflow-hidden ring-2 ring-white/70 shadow-[0_6px_16px_-6px_rgba(232,121,42,0.6)] animate-gt-float"><img src="/giftbox-disc.png" alt="" className="h-full w-full object-cover scale-[1.08]" /></div>
      <div className="mt-4 font-head text-lg font-bold text-orange-600">{tr("等待人工轉贈")}</div>
      <div className="text-[13px] text-orange-900/60 mt-2 leading-6 px-2">{tr("帳號已提交，客服正在為您人工轉贈，預計 30 分鐘內完成。完成後交易號會顯示在此處。")}</div>
    </div>
  );
}

function GiftTransferring({ order, onRefresh, callApi, onCelebrate }) {
  const end = order.gift_countdown_at ? new Date(order.gift_countdown_at).getTime() : (order.gift_dispatch_at ? new Date(order.gift_dispatch_at).getTime() : 0);
  const [left, setLeft] = useState(() => (end ? Math.max(0, end - Date.now()) : 0));
  const giftRef = useRef(null);
  useEffect(() => {
    let stopped = false;
    const check = () => callApi({ method: "GET", url: `/orders/${order.id}` }).then((r) => {
      if (stopped || r.data.status === "processing") return;
      if (r.data.status === "completed") {
        const rect = giftRef.current?.getBoundingClientRect();
        const origin = rect ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight } : undefined;
        celebrate(origin);
        onCelebrate?.(r.data);
      }
      onRefresh(r.data);
    }).catch(() => {});
    let lastPoll = Date.now();
    const t = setInterval(() => {
      const l = end ? Math.max(0, end - Date.now()) : 0;
      setLeft(l);
      const interval = l <= 0 ? 2000 : 3000;
      if (Date.now() - lastPoll >= interval) { lastPoll = Date.now(); check(); }
    }, 1000);
    return () => { stopped = true; clearInterval(t); };
  }, [end, order.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = end && order.info_submitted_at ? Math.max(1, end - new Date(order.info_submitted_at).getTime()) : 1;
  const pct = end ? Math.min(100, Math.round(((total - left) / total) * 100)) : 60;
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <div data-testid="order-gift-transferring" className="relative w-full overflow-hidden rounded-3xl border border-orange-200/70 bg-gradient-to-b from-[#FFE6CC] via-[#FFF1E2] to-white px-4 py-6 text-center shadow-[0_12px_30px_-14px_rgba(232,121,42,0.55)]">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.85)_1.5px,transparent_1.5px)] [background-size:16px_16px]" />
      <div className="relative">
        <div className="relative mx-auto h-28 w-28">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-28 w-28 -rotate-90">
            <circle cx="18" cy="18" r="16.5" fill="none" stroke="#ffe0bf" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="16.5" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${pct} 100`} pathLength="100" className="transition-all duration-700" />
          </svg>
          <div ref={giftRef} className="absolute inset-[7px] rounded-full overflow-hidden ring-2 ring-white/70 shadow-[0_6px_16px_-6px_rgba(232,121,42,0.6)] animate-gt-float">
            <img src="/giftbox-disc.png" alt="" className="h-full w-full object-cover scale-[1.08]" />
          </div>
        </div>
        <div className="mt-4 font-cute text-xl text-orange-600 drop-shadow-sm">{tr("系統轉贈中")}…</div>
        {end > 0 && left > 0 && <div className="font-cute-num text-[2.5rem] leading-none font-bold text-orange-500 mt-1.5 tracking-wide tabular-nums" data-testid="order-gift-countdown">{mm}:{String(ss).padStart(2, "0")}</div>}
        <div className="font-cute text-[13px] text-orange-900/50 mt-3 leading-6 px-2">{tr("系統轉贈中，請耐心等候，請勿關閉頁面。完成後將自動顯示交易號。")}</div>
      </div>
    </div>
  );
}

const FILTERS = [["all", tr("全部")], ...Object.entries(STATUS_LABELS)];

const HKD_CARD_AMOUNTS = { 200: 1, 500: 1, 1000: 1, 5000: 1, 8000: 1 };
function giftCardImageFor(order) {
  for (const it of (order?.items || [])) {
    const m = String(it.spec_label || "").match(/(\d[\d,]*)\s*HKD/i);
    if (m) {
      const amt = parseInt(m[1].replace(/,/g, ""), 10);
      if (HKD_CARD_AMOUNTS[amt]) return `/giftcards/hkd-${amt}.png`;
    }
  }
  return "";
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
    toast.success(tr("已複製"));
  };

  const [celebrateInfo, setCelebrateInfo] = useState(null);
  const [query, setQuery] = useState("");

  const channelOf = (order) => {
    const keys = order?.delivery_info ? Object.values(order.delivery_info).flatMap((f) => Object.keys(f)) : [];
    const k = keys.find((x) => /(帳號|账号|账户|帐号|ID|账号|钱包|錢包|wallet|account)/i.test(x)) || keys[0];
    if (!k) return "Alipay HK";
    return k.replace(/\s*(帳號|账号|账户|帐号|钱包|錢包|wallet|account|ID)\s*$/i, "").trim() || k;
  };
  const showCelebration = (order) => {
    setCelebrateInfo({ msg: tr("禮品卡已轉贈到您的{0}賬戶！", channelOf(order)), img: giftCardImageFor(order) });
  };

  const payNow = async (order) => {
    setPaying(true);
    try {
      const r = await callApi({ method: "POST", url: `/orders/${order.id}/pay-wallet` });
      toast.success(tr("錢包付款成功"));
      setDetail(r.data);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || tr("付款失敗"));
    } finally {
      setPaying(false);
    }
  };

  const removeOrder = async (o) => {
    try { await callApi({ method: "DELETE", url: `/orders/${o.id}` }); toast.success(tr("訂單已刪除")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("刪除失敗")); }
  };
  const reorder = (o) => { o.items.forEach((it) => addItem({ id: it.product_id, name: it.product_name, image: it.image }, { id: it.spec_id, label: it.spec_label, price_usd: it.unit_price_usd }, it.quantity)); navigate("/checkout"); };
  const KAVIP_LABELS = { all: tr("全部"), pending_payment: tr("未付款"), awaiting_info: tr("等待填寫資料"), waiting: tr("等待中"), completed: tr("已完成") };

  const q = query.trim().toLowerCase();
  const visibleOrders = q
    ? orders.filter((o) => (o.order_no || "").toLowerCase().includes(q) || (o.gift_trade_nos || []).some((g) => (g.trade_no || "").toLowerCase().includes(q)))
    : orders;

  return (
    <Panel title={tr("我的訂單")} testId="orders-page">
      <SubTabs tabs={Object.entries(KAVIP_LABELS)} value={filter} onChange={setFilter} testPrefix="order-filter" />
      <div className="mt-3 mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          data-testid="order-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("搜尋交易號 / 訂單編號")}
          className="w-full h-10 rounded-full bg-white border border-orange-200 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 shadow-sm"
        />
        {query && (
          <button data-testid="order-search-clear" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"><X className="h-4 w-4" /></button>
        )}
      </div>
      {loading ? (
        <div className="grid md:grid-cols-2 gap-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : visibleOrders.length === 0 ? (
        <div className="py-20 text-center text-slate-400" data-testid="orders-empty">{q ? tr("找不到符合的訂單") : tr("無數據")}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {visibleOrders.map((o) => {
            const it = o.items[0];
            const fields = o.delivery_info ? Object.values(o.delivery_info).flatMap((f) => Object.entries(f)) : [];
            return (
              <div key={o.id} data-testid={`order-card-${o.id}`} className="rounded-2xl bg-slate-50 max-md:bg-white max-md:shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] p-3.5 md:p-5">
                <div className="text-[13px] md:text-sm text-slate-500">
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <span className="flex items-center gap-2 min-w-0">{tr("訂單編號:")} <span className="text-slate-700 truncate">{o.order_no}</span><button onClick={() => copy(o.order_no)} className="text-slate-400 hover:text-orange-500 shrink-0"><Copy className="h-3.5 w-3.5" /></button></span>
                    <span className={`ml-auto shrink-0 font-medium ${o.status === "pending_payment" ? "text-slate-600" : o.status === "completed" ? "text-emerald-600" : "text-orange-500"}`} data-testid={`order-status-${o.id}`}>{orderLabel(o)}</span>
                  </div>
                  <div className="text-[11px] md:text-xs text-slate-400 mt-0.5 md:mt-1">{o.created_at?.slice(0, 19).replace("T", " ")}</div>
                </div>
                <div className="mt-3 md:mt-4 flex gap-3 md:gap-5">
                  <button onClick={() => setDetail(o)} className="h-16 w-16 md:h-24 md:w-24 shrink-0 rounded-xl md:rounded-2xl bg-white max-md:bg-slate-50 p-1.5 md:p-2 shadow-sm"><img src={it?.image} alt="" className="h-full w-full object-contain rounded-xl" /></button>
                  <div className="flex-1 min-w-0 text-[13px] md:text-sm text-slate-800 space-y-0.5 md:space-y-1.5">
                    <div className="truncate">{it?.product_name}{o.items.length > 1 ? tr(" 等 {0} 件", o.items.length) : ""}</div>
                    <div>{it?.spec_label} * {it?.quantity}</div>
                    {fields.slice(0, 1).map(([k, v]) => <div key={k} className="truncate">{k}: {k.includes(tr("密碼")) ? "••••••" : v}</div>)}
                    {!fields.length && o.recharge_account && <div className="truncate">ID: {o.recharge_account}</div>}
                    <div className="text-orange-500 font-semibold pt-0.5 text-sm md:text-base">{o.currency}$ {(o.total_usd * o.rate_to_usd).toFixed(2)}</div>
                  </div>
                </div>
                {o.status === "completed" && (o.gift_trade_nos || []).length > 0 && (
                  <div className="relative mt-3 overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-br from-[#FFEAD3] to-[#FFF6EC] px-3.5 py-3 shadow-[0_8px_22px_-14px_rgba(232,121,42,0.5)]" data-testid={`order-gift-trade-${o.id}`}>
                    <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.8)_1.5px,transparent_1.5px)] [background-size:15px_15px]" />
                    <div className="relative">
                      <div className="font-cute text-base text-orange-600 flex items-center gap-1.5"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm"><Gift className="h-3.5 w-3.5" /></span>{tr("轉贈成功 · 交易號")}</div>
                      {o.gift_trade_nos.map((g, i) => (
                        <div key={i} className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white/70 px-2.5 py-2">
                          <span className="font-mono text-base md:text-lg tracking-wider text-slate-800 break-all" data-testid={`order-gift-trade-no-${o.id}-${i}`}>{g.trade_no}</span>
                          <button onClick={() => copy(g.trade_no)} data-testid={`order-gift-trade-copy-${o.id}-${i}`} className="shrink-0 inline-flex items-center gap-1 text-orange-500 text-sm font-semibold hover:text-orange-600"><Copy className="h-4 w-4" />{tr("複製")}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 md:mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-center md:justify-end gap-2.5 md:gap-2">
                  {o.status === "pending_payment" && <button data-testid={`order-delete-${o.id}`} onClick={() => removeOrder(o)} className="h-8 md:h-9 px-4 rounded-full bg-white max-md:bg-slate-100 text-slate-600 text-xs hover:bg-orange-50 hover:text-orange-500 whitespace-nowrap">{tr("刪除訂單")}</button>}
                  <button data-testid={`order-reorder-${o.id}`} onClick={() => reorder(o)} className="h-9 md:h-10 px-5 rounded-full bg-white border border-orange-200 text-orange-600 text-xs md:text-sm font-semibold shadow-sm hover:bg-orange-50 transition-colors whitespace-nowrap">{tr("再來一單")}</button>
                  {o.status === "paid" && o.info_submitted === false && (
                    <button data-testid={`order-fill-${o.id}`} onClick={() => setDetail(o)} className="h-9 md:h-10 px-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs md:text-sm font-bold shadow-md shadow-orange-200/70 hover:brightness-105 transition whitespace-nowrap">{tr("填寫充值資料")}</button>
                  )}
                  {o.status === "pending_payment" ? (
                    <button data-testid={`order-pay-${o.id}`} onClick={() => payNow(o)} disabled={paying} className="h-9 md:h-10 px-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs md:text-sm font-bold shadow-md shadow-orange-200/70 hover:brightness-105 transition disabled:opacity-60 whitespace-nowrap">{tr("去付款")}</button>
                  ) : (
                    <button data-testid={`order-detail-${o.id}`} onClick={() => setDetail(o)} className="h-9 md:h-10 px-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs md:text-sm font-bold shadow-md shadow-orange-200/70 hover:brightness-105 transition whitespace-nowrap">{tr("查看詳情")}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && !celebrateInfo && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-[#FFF4EA] border-l-0 [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:18px_18px]" data-testid="order-detail-drawer">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-head text-slate-900 relative inline-block mx-auto"><span className="relative z-10">{tr("訂單詳情")}</span><span className="absolute left-0 right-0 bottom-0.5 h-2 bg-orange-200/80 rounded-sm" /></SheetTitle>
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
                  {detail.status === "exception" && <div className="text-xs text-red-500 mt-3 text-center">{tr("訂單異常，請聯絡客服")}</div>}
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

                {detail.is_giftcard_order && detail.status === "processing" && detail.gift_manual && <GiftManualWaiting />}
                {detail.is_giftcard_order && detail.status === "processing" && !detail.gift_manual && (
                  <GiftTransferring order={detail} callApi={callApi} onCelebrate={showCelebration} onRefresh={(o) => { setDetail(o); load(); }} />
                )}

                {detail.status === "completed" && (detail.gift_trade_nos || []).length > 0 && (
                  <div className="relative overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-br from-[#FFEAD3] to-[#FFF6EC] p-4 shadow-[0_10px_26px_-14px_rgba(232,121,42,0.5)]" data-testid="order-gift-trade-detail">
                    <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.8)_1.5px,transparent_1.5px)] [background-size:15px_15px]" />
                    <div className="relative">
                      <div className="font-cute text-lg text-orange-600 mb-2.5 flex items-center gap-1.5"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm"><Gift className="h-3.5 w-3.5" /></span>{tr("轉贈成功 · 交易號")}</div>
                      <div className="space-y-2">
                        {detail.gift_trade_nos.map((g, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5">
                            <div className="min-w-0"><div className="font-mono text-base tracking-wider text-slate-800 break-all">{g.trade_no}</div><div className="text-[11px] text-slate-500 mt-0.5">{g.product_name} {g.spec_label}</div></div>
                            <button onClick={() => copy(g.trade_no)} data-testid="order-gift-copy" className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-white text-xs font-semibold shadow-sm hover:bg-orange-600"><Copy className="h-3.5 w-3.5" />{tr("複製")}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {["paid", "pending_payment"].includes(detail.status) && (
                  <OrderInfoForm order={detail} callApi={callApi} onDone={(o) => { setDetail(o); load(); }} />
                )}
                {/* Account info */}
                {detail.status === "cancelled" && detail.admin_note && (
                  <div data-testid="order-cancel-reason" className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                    <div className="text-sm font-bold text-red-600">{tr("訂單已取消")}</div>
                    <div className="text-xs text-red-500 mt-1 leading-5">{tr("原因：")}{detail.admin_note}</div>
                  </div>
                )}
                {(Object.keys(detail.delivery_info || {}).length > 0 || detail.recharge_note || detail.admin_note) && (
                <div className="bg-white rounded-2xl p-4 text-sm space-y-2 shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)]" data-testid="order-detail-info">
                  {detail.delivery_info && Object.values(detail.delivery_info).flatMap((f) => Object.entries(f)).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><span className="text-slate-400 shrink-0">{k}</span><span className="text-slate-700 text-right break-all">{k.includes(tr("密碼")) ? "••••••" : v}</span></div>
                  ))}
                  {detail.recharge_note && <div className="flex justify-between"><span className="text-slate-400">{tr("備註")}</span><span className="text-slate-700">{detail.recharge_note}</span></div>}
                  {detail.admin_note && detail.status !== "cancelled" && <div className="flex justify-between"><span className="text-slate-400">{tr("客服備註")}</span><span className="text-emerald-600">{detail.admin_note}</span></div>}
                </div>
                )}

                {detail.status === "pending_payment" && (
                  <button
                    data-testid="order-pay-now-btn"
                    onClick={() => payNow(detail)}
                    disabled={paying}
                    className="w-full h-11 rounded-full bg-orange-500 text-white font-bold disabled:opacity-60"
                  >
                    {paying ? tr("處理中…") : tr("立即付款（測試）")}
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    data-testid="order-detail-view-orders"
                    onClick={() => { setDetail(null); navigate("/orders"); }}
                    className="flex-1 h-11 rounded-full bg-white border border-orange-300 text-orange-500 font-semibold text-sm"
                  >
                    {tr("訂單列表")}
                  </button>
                  <button
                    data-testid="order-detail-home-btn"
                    onClick={() => { setDetail(null); navigate("/"); }}
                    className="flex-1 h-11 rounded-full bg-white border border-orange-300 text-orange-500 font-semibold text-sm"
                  >
                    {tr("返回首頁")}
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {celebrateInfo && (
        <div className="fixed inset-0 -bottom-24 pb-24 z-[9998] flex items-center justify-center px-6 bg-black/35 backdrop-blur-sm pointer-events-auto" data-testid="order-celebrate-overlay">
          <div className="animate-gt-pop max-w-xs w-full rounded-[28px] bg-[#FFF4EA] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:18px_18px] p-2 shadow-[0_24px_60px_-20px_rgba(232,121,42,0.55)]" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-[22px] bg-white px-5 pt-5 pb-5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FDEBD9] text-orange-500 px-3 py-1 text-xs font-bold mb-3"><CheckCircle2 className="h-3.5 w-3.5" />{tr("轉贈成功")}</div>
              {celebrateInfo.img ? (
                <div className="mb-4 relative w-full overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-md animate-gt-float" style={{ aspectRatio: "1.586" }}>
                  <img src={celebrateInfo.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ) : (
                <div className="mx-auto mb-4 h-20 w-20 rounded-full overflow-hidden ring-4 ring-[#FDEBD9] shadow-md animate-gt-float">
                  <img src="/giftbox-disc.png" alt="" className="h-full w-full object-cover scale-[1.08]" />
                </div>
              )}
              <div className="font-head text-base md:text-lg font-bold text-slate-900 leading-relaxed">{celebrateInfo.msg}</div>
              <div className="text-xs text-slate-500 mt-1.5">{tr("交易號已顯示在訂單詳情，可隨時查看")}</div>
              <button onClick={() => setCelebrateInfo(null)} data-testid="order-celebrate-view-order" className="mt-5 w-full h-11 rounded-full bg-gradient-to-r from-[#F0872E] to-[#F6A04A] text-white text-sm font-bold shadow-[0_10px_24px_-10px_rgba(240,135,46,0.8)] active:scale-[0.98] transition-transform">{tr("查看訂單")}</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function MyOrders() {
  return <OrdersInner />;
}
