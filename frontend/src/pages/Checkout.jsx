import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Show, useUser } from "@clerk/react";
import { Minus, Plus, Trash2, CheckCircle2, Ticket, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuthModal } from "@/components/auth/AuthModal";


function SectionTitle({ children }) {
  return <h3 className="relative inline-block font-bold text-slate-900 text-base"><span className="relative z-10">{children}</span><span className="absolute left-0 right-0 bottom-0.5 h-2 bg-orange-200/70 rounded-sm" /></h3>;
}

function CouponCard({ p, subtotalUsd, applied, onApply, format }) {
  const ok = subtotalUsd >= (p.min_order_usd || 0);
  const value = p.discount_type === "percent" ? `${p.value}%` : format(p.value);
  return (
    <button
      data-testid={`coupon-${p.code}`}
      disabled={!ok}
      onClick={() => onApply(p.code)}
      className={`relative text-left rounded-2xl border-[3px] p-4 w-full transition-all ${
        applied ? "border-orange-400 bg-orange-50" : ok ? "border-orange-200 bg-white hover:border-orange-400" : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 font-bold ${ok ? "text-slate-800" : "text-slate-500"}`}><Ticket className="h-4 w-4" />全站儲值優惠</span>
        <span className={`font-head text-2xl font-extrabold ${ok ? "text-orange-500" : "text-slate-500"}`}>{value}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span>{p.min_order_usd ? `滿 ${format(p.min_order_usd)} 可用` : "無門檻"}</span>
        <span>{applied ? "已使用" : ok ? "可使用" : "金額未達標"}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold ${ok ? "bg-orange-100 text-orange-600" : "bg-slate-200 text-slate-500"}`}>{p.discount_type === "percent" ? "折扣券" : "滿減券"}</span>
        <span className="flex-1 border border-dashed border-slate-300 rounded px-2 py-0.5 truncate">{p.code}{p.expires_at ? ` · 有效期至：${p.expires_at.slice(0, 10)}` : ""}</span>
      </div>
    </button>
  );
}

function CheckoutInner() {
  const navigate = useNavigate();
  const callApi = useApi();
  const { user } = useUser();
  const { items, subtotalUsd, clear, updateQty, removeItem } = useCart();
  const { format, code } = useCurrency();

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);
  const [promos, setPromos] = useState([]);
  const [agree, setAgree] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { publicApi.get("/promos/public").then((r) => setPromos(r.data)).catch(() => {}); }, []);
  useEffect(() => { callApi({ method: "GET", url: "/me/wallet" }).then((r) => setWallet(r.data.balance_usd)).catch(() => setWallet(0)); }, [callApi]);
  useEffect(() => { if (promo && subtotalUsd < (promo.min_order_usd || 0)) setPromo(null); }, [subtotalUsd, promo]);

  const discountUsd = promo?.discount_usd || 0;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-400 mb-4">購物車是空的</p>
        <button onClick={() => navigate("/")} className="text-orange-500 font-semibold">去逛逛 →</button>
      </div>
    );
  }

  const applyPromo = async (c) => {
    const codeStr = (c || promoInput).trim();
    if (!codeStr) return;
    try {
      const r = await publicApi.post("/promo/validate", { code: codeStr, subtotal_usd: subtotalUsd });
      setPromo(r.data);
      toast.success(`優惠券已套用，折抵 ${format(r.data.discount_usd)}`);
    } catch (e) {
      setPromo(null);
      toast.error(e.response?.data?.detail || "優惠券無效");
    }
  };

  const submit = async () => {
    if (!agree) return toast.error("請先閱讀並同意無退款聲明");
    if (wallet !== null && wallet < totalUsd) {
      toast.error(`錢包餘額不足（${format(wallet)}），請先充值`, { duration: 6000 });
      return navigate("/account/wallet");
    }
    setLoading(true);
    try {
      const orderRes = await callApi({
        method: "POST",
        url: "/orders",
        data: {
          items: items.map((i) => ({ product_id: i.product_id, spec_id: i.spec_id, quantity: i.quantity })),
          currency: code,
          recharge_account: "",
          delivery_info: {},
          recharge_note: "",
          contact: user?.primaryEmailAddress?.emailAddress || "",
          promo_code: promo?.code || null,
        },
      });
      const order = orderRes.data;
      const paid = await callApi({ method: "POST", url: `/orders/${order.id}/pay-wallet` });
      clear();
      toast.success(paid.data.info_submitted ? "錢包付款成功，訂單等待人工充值" : "錢包付款成功，請到訂單填寫充值資料", { duration: 6000 });
      navigate(`/orders?order=${order.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "下單失敗，請稍後再試", { duration: e.response?.status === 409 ? 7000 : 4000 });
    } finally {
      setLoading(false);
    }
  };

  const dots = "bg-[#FFF6EC] [background-image:radial-gradient(rgba(255,255,255,0.95)_1.5px,transparent_1.5px)] [background-size:14px_14px]";

  return (
    <div className="bg-gradient-to-b from-[#FFE9D2] to-[#FFF8F1] min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8 space-y-4 md:space-y-6 pb-32 md:pb-8" data-testid="checkout-page">
        <h1 className="font-head text-xl md:text-2xl font-bold text-slate-900 relative inline-block ml-1 md:ml-0"><span className="relative z-10">購物車</span><span className="absolute left-0 right-0 bottom-0.5 h-2.5 bg-orange-200/70 rounded-sm" /></h1>

        {/* Items */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden" data-testid="cart-items-card">
          <div className="p-4 sm:p-8 space-y-5 md:space-y-6">
            {items.map((i) => (
              <div key={i.key} data-testid={`cart-item-${i.key}`}>
                <div className="text-[14px] md:text-base text-slate-800 mb-3 md:mb-4">{i.product_name}</div>
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="h-16 w-16 sm:h-28 sm:w-28 rounded-xl sm:rounded-2xl bg-slate-100 overflow-hidden shrink-0"><img src={i.image} alt={i.product_name} className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] md:text-base text-slate-800 truncate">{i.spec_label}</div>
                    {i.badge && <span className="mt-1 inline-block max-w-full truncate rounded-md bg-fuchsia-500 text-white text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 leading-4 whitespace-nowrap">{i.badge}</span>}
                    <div className="mt-1 font-head text-base md:text-lg text-orange-500 whitespace-nowrap"><span className="text-xs md:text-sm font-medium">{code}$</span> <span className="font-bold">{format(i.unit_price_usd).replace(/[^\d.,]/g, "")}</span></div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <div className="flex items-center h-9 md:h-11 rounded-lg md:rounded-xl border border-slate-200 bg-white">
                      <button data-testid={`cart-dec-${i.key}`} onClick={() => updateQty(i.key, Math.max(1, i.quantity - 1))} className="h-9 w-8 md:h-11 md:w-11 flex items-center justify-center text-slate-500 hover:text-orange-500"><Minus className="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
                      <span className="w-6 md:w-8 text-center text-sm font-semibold" data-testid={`cart-qty-${i.key}`}>{i.quantity}</span>
                      <button data-testid={`cart-inc-${i.key}`} onClick={() => updateQty(i.key, Math.min(99, i.quantity + 1))} className="h-9 w-8 md:h-11 md:w-11 flex items-center justify-center text-slate-500 hover:text-orange-500"><Plus className="h-3.5 w-3.5 md:h-4 md:w-4" /></button>
                    </div>
                    <button data-testid={`cart-remove-${i.key}`} onClick={() => removeItem(i.key)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4 md:h-5 md:w-5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={`${dots} px-6 sm:px-8 py-5 hidden md:block`}>
            <div className="bg-slate-100 rounded-full h-16 flex items-center justify-end px-8 text-lg">
              <span className="font-bold text-slate-900">商品總額：</span>
              <span className="font-head font-extrabold text-orange-500 ml-1" data-testid="cart-subtotal">{format(subtotalUsd)}</span>
            </div>
          </div>
        </div>

        {/* Coupons */}
        <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-8" data-testid="checkout-coupon-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionTitle>優惠券</SectionTitle>
            <div className="flex items-center gap-3 max-md:w-full">
              <input data-testid="checkout-promo-input" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="請輸入優惠券碼" className="h-11 w-full sm:w-64 rounded-full bg-slate-100 px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
              <button data-testid="checkout-apply-promo-btn" onClick={() => applyPromo()} className="h-11 px-5 rounded-full bg-orange-50 text-orange-500 text-sm font-semibold hover:bg-orange-100 whitespace-nowrap">立即兌換</button>
            </div>
          </div>
          <div className="mt-5 h-1 rounded-full bg-slate-100"><div className="h-1 w-1/4 rounded-full bg-orange-400" /></div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {promos.length === 0 && <div className="text-sm text-slate-400">暫無可用優惠券</div>}
            {promos.map((p) => <CouponCard key={p.code} p={p} subtotalUsd={subtotalUsd} applied={promo?.code === p.code} onApply={applyPromo} format={format} />)}
          </div>
        </div>

        {/* Payment + summary */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden" data-testid="checkout-summary-card">
          <div className="p-4 sm:p-8">
            <SectionTitle>支付方式</SectionTitle>
            <div className="mt-5 rounded-2xl border-2 border-orange-400 bg-orange-50 p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="pay-method-wallet">
              <span className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0"><Wallet className="h-6 w-6" /></span>
              <div className="flex-1">
                <div className="font-bold text-slate-900">錢包餘額付款</div>
                <div className="text-sm text-slate-600 mt-0.5">目前餘額：<span className="font-head font-extrabold text-orange-500" data-testid="checkout-wallet-balance">{wallet === null ? "…" : format(wallet)}</span>{wallet !== null && wallet < totalUsd && <span className="ml-2 text-red-500">餘額不足，還差 {format(totalUsd - wallet)}</span>}</div>
              </div>
              <Link to="/account/wallet" data-testid="checkout-topup-link" className="h-10 px-5 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center hover:bg-orange-600">前往充值</Link>
            </div>
            <div className="mt-3 text-xs text-slate-500">付款完成後，請至「我的訂單」填寫充值資料（帳號 / ID 等），提交後開始人工充值。</div>
            <label className="mt-5 flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" data-testid="checkout-agree-checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-500" />
              <span>我已閱讀並同意：虛擬商品人工充值，完成後 <span className="text-orange-500 font-semibold">恕不退款</span>，並確認充值帳號正確。</span>
            </label>

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-600">商品總額:</span><span className="text-orange-500">{format(subtotalUsd)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">優惠金額:</span><span className="text-orange-500" data-testid="checkout-discount">-{format(discountUsd)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">支付手續費:</span><span className="text-slate-500"><span className="line-through mr-2">{format(subtotalUsd * 0.03)}</span><span className="text-orange-500">{format(0)}</span></span></div>
            </div>
          </div>
          <div className={`${dots} px-6 sm:px-8 py-5 hidden md:block`}>
            <div className="bg-slate-100 rounded-full min-h-[72px] flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-8 py-3">
              <div className="text-lg"><span className="font-bold text-slate-900">支付總額: </span><span className="font-head font-extrabold text-orange-500" data-testid="checkout-total">{format(totalUsd)}</span></div>
              <button data-testid="checkout-pay-btn" onClick={submit} disabled={loading} className="h-14 px-16 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold transition-colors disabled:opacity-60 w-full sm:w-auto">
                {loading ? "處理中…" : "使用錢包支付"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl px-5 pt-3 pb-4 safe-bottom-pad flex items-center justify-between gap-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)]" data-testid="checkout-mobile-bar">
        <div>
          <div className="text-sm text-slate-700">支付總額:</div>
          <div className="font-head text-xl font-extrabold text-orange-500" data-testid="checkout-mobile-total">{format(totalUsd)}</div>
        </div>
        <button data-testid="checkout-mobile-pay-btn" onClick={submit} disabled={loading} className="h-12 px-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base font-bold disabled:opacity-60">{loading ? "處理中…" : "立即支付"}</button>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { openAuth } = useAuthModal();
  return (
    <>
      <Show when="signed-in"><CheckoutInner /></Show>
      <Show when="signed-out">
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="font-head text-xl font-bold text-slate-900 mb-2">請先登入</h2>
          <p className="text-sm text-slate-500 mb-5">登入後即可填寫充值信息並下單</p>
          <button onClick={openAuth} className="h-11 px-6 rounded-full bg-orange-500 text-white font-semibold" data-testid="checkout-login-btn">登入 / 註冊</button>
        </div>
      </Show>
    </>
  );
}
