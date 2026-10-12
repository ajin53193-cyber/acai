import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Show } from "@clerk/react";
import { useAuthModal } from "@/components/auth/AuthModal";
import { Tag, ShieldCheck, Loader2, CheckCircle2, CreditCard, Smartphone, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { Checkbox } from "@/components/ui/checkbox";

function CheckoutInner() {
  const navigate = useNavigate();
  const callApi = useApi();
  const { items, subtotalUsd, clear } = useCart();
  const { format, code } = useCurrency();

  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);
  const [agree, setAgree] = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [loading, setLoading] = useState(false);

  const discountUsd = promo?.discount_usd || 0;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-400 mb-4">購物車是空的</p>
        <button onClick={() => navigate("/")} className="text-primary font-semibold">去逛逛 →</button>
      </div>
    );
  }

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    try {
      const r = await publicApi.post("/promo/validate", {
        code: promoInput.trim(),
        subtotal_usd: subtotalUsd,
      });
      setPromo(r.data);
      toast.success(`優惠碼已套用，折抵 ${format(r.data.discount_usd)}`);
    } catch (e) {
      setPromo(null);
      toast.error(e.response?.data?.detail || "優惠碼無效");
    }
  };

  const submit = async () => {
    if (!account.trim()) return toast.error("請填寫充值帳號");
    if (!agree) return toast.error("請先閱讀並同意無退款聲明");
    setLoading(true);
    try {
      const orderRes = await callApi({
        method: "POST",
        url: "/orders",
        data: {
          items: items.map((i) => ({ product_id: i.product_id, spec_id: i.spec_id, quantity: i.quantity })),
          currency: code,
          recharge_account: account.trim(),
          recharge_note: note.trim(),
          contact: contact.trim(),
          promo_code: promo?.code || null,
        },
      });
      const order = orderRes.data;
      // Mock payment
      await new Promise((res) => setTimeout(res, 900));
      await callApi({ method: "POST", url: `/orders/${order.id}/pay` });
      clear();
      toast.success("付款成功（測試），訂單已提交！");
      navigate(`/orders?order=${order.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "下單失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const payMethods = [
    { id: "card", label: "測試信用卡", icon: CreditCard },
    { id: "applepay", label: "測試 Apple Pay", icon: Smartphone },
    { id: "crypto", label: "測試加密貨幣", icon: Bitcoin },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-10">
      <h1 className="font-head text-2xl font-bold text-slate-900 mb-5">結賬下單</h1>
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">充值信息</h3>
            <label className="block text-sm font-medium text-slate-600 mb-1">充值帳號 <span className="text-red-500">*</span></label>
            <input
              data-testid="checkout-account-input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="請填寫需要充值的帳號 / ID"
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
            />
            <label className="block text-sm font-medium text-slate-600 mb-1 mt-4">備註（伺服器 / 區服等）</label>
            <input
              data-testid="checkout-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="選填"
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
            />
            <label className="block text-sm font-medium text-slate-600 mb-1 mt-4">聯絡方式（Email / Telegram）</label>
            <input
              data-testid="checkout-contact-input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="選填，用於接收充值結果"
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Tag className="h-4 w-4 text-secondary" /> 優惠碼</h3>
            <div className="flex gap-2">
              <input
                data-testid="checkout-promo-input"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="輸入優惠碼，如 GLOBAL2026"
                className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
              />
              <button
                data-testid="checkout-apply-promo-btn"
                onClick={applyPromo}
                className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
              >
                套用
              </button>
            </div>
            {promo && <div className="text-xs text-emerald-600 mt-2">已套用 {promo.code}，折抵 {format(promo.discount_usd)}</div>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">支付方式（測試模式）</h3>
            <div className="grid grid-cols-3 gap-2">
              {payMethods.map((m) => {
                const Icon = m.icon;
                const sel = payMethod === m.id;
                return (
                  <button
                    key={m.id}
                    data-testid={`pay-method-${m.id}`}
                    onClick={() => setPayMethod(m.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                      sel ? "border-primary bg-primary/5" : "border-slate-200"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${sel ? "text-primary" : "text-slate-400"}`} />
                    <span className="text-[11px] font-medium text-slate-600">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">本期為測試支付，點擊付款將模擬支付成功並生成訂單。</p>
          </div>
        </div>

        {/* Right: summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-28">
            <h3 className="font-semibold text-slate-800 mb-3">訂單摘要</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {items.map((i) => (
                <div key={i.key} className="flex gap-2.5">
                  <img src={i.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{i.product_name}</div>
                    <div className="text-[11px] text-slate-400">{i.spec_label} × {i.quantity}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-700">{format(i.unit_price_usd * i.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>小計</span><span>{format(subtotalUsd)}</span></div>
              {discountUsd > 0 && (
                <div className="flex justify-between text-emerald-600"><span>優惠折抵</span><span>-{format(discountUsd)}</span></div>
              )}
              <div className="flex justify-between text-[11px] text-slate-400"><span>結算幣種</span><span>{code}（下單鎖價）</span></div>
              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="font-semibold text-slate-800">應付總額</span>
                <span className="font-head font-extrabold text-primary text-xl" data-testid="checkout-total">{format(totalUsd)}</span>
              </div>
            </div>

            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <Checkbox checked={agree} onCheckedChange={setAgree} data-testid="checkout-agree-checkbox" className="mt-0.5" />
              <span className="text-xs text-slate-500 leading-relaxed">
                我已閱讀並同意：虛擬商品人工充值，完成後 <span className="text-amber-600 font-semibold">恕不退款</span>，並確認充值帳號正確。
              </span>
            </label>

            <button
              data-testid="checkout-pay-btn"
              onClick={submit}
              disabled={loading}
              className="w-full h-12 mt-4 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> 處理中…</> : <><ShieldCheck className="h-5 w-5" /> 確認付款（測試）</>}
            </button>
          </div>
        </div>
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
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="font-head text-xl font-bold text-slate-900 mb-2">請先登入</h2>
          <p className="text-sm text-slate-500 mb-5">登入後即可填寫充值信息並下單</p>
          <button onClick={openAuth} className="h-11 px-6 rounded-full bg-primary text-white font-semibold" data-testid="checkout-login-btn">登入 / 註冊</button>
        </div>
      </Show>
    </>
  );
}
