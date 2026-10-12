import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Show, useUser } from "@clerk/react";
import { Minus, Plus, Trash2, CheckCircle2, CreditCard, Smartphone, Bitcoin, Ticket, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuthModal } from "@/components/auth/AuthModal";

const field = "w-full h-12 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
const PAY_METHODS = [
  { id: "card", label: "信用卡 / Visa / Master", icon: CreditCard },
  { id: "applepay", label: "Apple Pay / Google Pay", icon: Smartphone },
  { id: "crypto", label: "加密貨幣 USDT", icon: Bitcoin },
];
const CONTACT_TYPES = ["微信", "Telegram", "WhatsApp", "LINE"];

function SectionTitle({ children }) {
  return <h3 className="relative inline-block font-bold text-slate-900 text-base"><span className="relative z-10">{children}</span><span className="absolute left-0 right-0 bottom-0.5 h-2 bg-orange-200/70 rounded-sm" /></h3>;
}

function Label({ children, required }) {
  return <div className="text-sm text-slate-700 mb-2">{required && <span className="text-red-500 mr-1">*</span>}{children}</div>;
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

  const [note, setNote] = useState("");
  const [fieldDefs, setFieldDefs] = useState({});
  const [delivery, setDelivery] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [phone, setPhone] = useState("");
  const [otherType, setOtherType] = useState(CONTACT_TYPES[0]);
  const [other, setOther] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);
  const [promos, setPromos] = useState([]);
  const [agree, setAgree] = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [loading, setLoading] = useState(false);

  useEffect(() => { publicApi.get("/promos/public").then((r) => setPromos(r.data)).catch(() => {}); }, []);
  const productIds = [...new Set(items.map((i) => i.product_id))].join(",");
  useEffect(() => {
    productIds.split(",").filter(Boolean).forEach((pid) => {
      if (fieldDefs[pid]) return;
      publicApi.get(`/products/${pid}`).then((r) => {
        const defs = r.data.delivery_fields?.length ? r.data.delivery_fields : [{ code: "account", name: r.data.account_field_label || "充值帳號 / ID", required: true, type: "text", options: [], tips: r.data.account_field_hint || "" }];
        setFieldDefs((d) => ({ ...d, [pid]: { name: r.data.name, fields: defs } }));
      }).catch(() => {});
    });
  }, [productIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const setField = (pid, name, value) => setDelivery((d) => ({ ...d, [pid]: { ...(d[pid] || {}), [name]: value } }));
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
    for (const pid of Object.keys(fieldDefs)) {
      for (const f of fieldDefs[pid].fields) {
        if (f.required && !(delivery[pid]?.[f.name] || "").trim()) return toast.error(`請填寫「${f.name}」（${fieldDefs[pid].name}）`);
      }
    }
    const firstPid = Object.keys(fieldDefs)[0];
    const firstDef = fieldDefs[firstPid]?.fields.find((f) => f.code === "account") || fieldDefs[firstPid]?.fields[0];
    const account = firstDef ? delivery[firstPid]?.[firstDef.name] || "" : "";
    if (!name.trim() || !email.trim() || !phone.trim()) return toast.error("請完整填寫聯絡資訊");
    if (!agree) return toast.error("請先閱讀並同意無退款聲明");
    setLoading(true);
    try {
      const contact = `${name.trim()} | ${email.trim()} | ${phone.trim()}${other.trim() ? ` | ${otherType}: ${other.trim()}` : ""}`;
      const orderRes = await callApi({
        method: "POST",
        url: "/orders",
        data: {
          items: items.map((i) => ({ product_id: i.product_id, spec_id: i.spec_id, quantity: i.quantity })),
          currency: code,
          recharge_account: account.trim(),
          delivery_info: delivery,
          recharge_note: `${note.trim()}${note.trim() ? " · " : ""}支付方式：${PAY_METHODS.find((m) => m.id === payMethod)?.label}`,
          contact,
          promo_code: promo?.code || null,
        },
      });
      const order = orderRes.data;
      await new Promise((res) => setTimeout(res, 900));
      await callApi({ method: "POST", url: `/orders/${order.id}/pay` });
      clear();
      toast.success("付款成功（測試），訂單已提交！");
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" data-testid="checkout-page">
        <h1 className="font-head text-2xl font-bold text-slate-900 relative inline-block"><span className="relative z-10">購物車</span><span className="absolute left-0 right-0 bottom-0.5 h-2.5 bg-orange-200/70 rounded-sm" /></h1>

        {/* Items */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden" data-testid="cart-items-card">
          <div className="p-6 sm:p-8 space-y-6">
            {items.map((i) => (
              <div key={i.key} data-testid={`cart-item-${i.key}`}>
                <div className="text-base text-slate-800 mb-4">{i.product_name}</div>
                <div className="flex items-center gap-5">
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-slate-100 overflow-hidden shrink-0"><img src={i.image} alt={i.product_name} className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base text-slate-800">{i.spec_label}</div>
                    <div className="mt-1 font-head text-lg text-orange-500"><span className="text-sm font-medium">{code}$</span> <span className="font-bold">{format(i.unit_price_usd).replace(/[^\d.,]/g, "")}</span></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center h-11 rounded-xl border border-slate-200 bg-white">
                      <button data-testid={`cart-dec-${i.key}`} onClick={() => updateQty(i.key, Math.max(1, i.quantity - 1))} className="h-11 w-11 flex items-center justify-center text-slate-500 hover:text-orange-500"><Minus className="h-4 w-4" /></button>
                      <span className="w-8 text-center text-sm font-semibold" data-testid={`cart-qty-${i.key}`}>{i.quantity}</span>
                      <button data-testid={`cart-inc-${i.key}`} onClick={() => updateQty(i.key, Math.min(99, i.quantity + 1))} className="h-11 w-11 flex items-center justify-center text-slate-500 hover:text-orange-500"><Plus className="h-4 w-4" /></button>
                    </div>
                    <button data-testid={`cart-remove-${i.key}`} onClick={() => removeItem(i.key)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={`${dots} px-6 sm:px-8 py-5`}>
            <div className="bg-slate-100 rounded-full h-16 flex items-center justify-end px-8 text-lg">
              <span className="font-bold text-slate-900">商品總額：</span>
              <span className="font-head font-extrabold text-orange-500 ml-1" data-testid="cart-subtotal">{format(subtotalUsd)}</span>
            </div>
          </div>
        </div>

        {/* Delivery + contact */}
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 grid md:grid-cols-2 gap-8 md:gap-0" data-testid="checkout-info-card">
          <div className="md:pr-10 md:border-r md:border-dashed md:border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <SectionTitle>遞送訊息</SectionTitle>
              <span className="rounded-full bg-orange-50 text-orange-500 text-sm px-4 py-1.5">我的帳號</span>
            </div>
            <div className="space-y-5">
              {Object.entries(fieldDefs).map(([pid, def]) => (
                <div key={pid} data-testid={`delivery-group-${pid}`}>
                  {Object.keys(fieldDefs).length > 1 && <div className="text-xs font-semibold text-orange-500 mb-2">{def.name}</div>}
                  <div className="space-y-4">
                    {def.fields.map((f) => (
                      <div key={f.name}>
                        <Label required={f.required}>{f.name}</Label>
                        {f.type === "select" ? (
                          <div className="relative">
                            <select data-testid={`delivery-${pid}-${f.name}`} value={delivery[pid]?.[f.name] || ""} onChange={(e) => setField(pid, f.name, e.target.value)} className={`${field} appearance-none pr-10`}>
                              <option value="">請選擇{f.name}</option>
                              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          </div>
                        ) : f.type === "textarea" ? (
                          <textarea data-testid={`delivery-${pid}-${f.name}`} value={delivery[pid]?.[f.name] || ""} onChange={(e) => setField(pid, f.name, e.target.value)} placeholder={f.placeholder || `請輸入${f.name}`} rows={3} className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400" />
                        ) : (
                          <input data-testid={`delivery-${pid}-${f.name}`} type={f.type === "password" ? "password" : "text"} value={delivery[pid]?.[f.name] || ""} onChange={(e) => setField(pid, f.name, e.target.value)} placeholder={f.placeholder || `請輸入${f.name}`} className={field} />
                        )}
                        {f.tips && <div className="mt-1.5 text-xs text-orange-500">{f.tips}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <Label>備註（選填）</Label>
                <input data-testid="checkout-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="選填" className={field} />
              </div>
            </div>
          </div>
          <div className="md:pl-10">
            <div className="mb-6"><SectionTitle>聯絡資訊</SectionTitle></div>
            <div className="space-y-4">
              {[["聯絡人姓名", name, setName, "請輸入姓名", "checkout-name-input"], ["聯絡信箱", email, setEmail, "用於接收充值結果", "checkout-email-input"], ["手機號碼", phone, setPhone, "請輸入手機號碼", "checkout-phone-input"]].map(([l, v, set, ph, tid]) => (
                <div key={l} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 text-sm text-slate-700"><span className="text-red-500 mr-1">*</span>{l}</div>
                  <input data-testid={tid} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className={field} />
                </div>
              ))}
              <div className="flex items-center gap-4">
                <div className="w-28 shrink-0 text-sm text-slate-700 pl-3">其他聯絡方式</div>
                <div className="flex items-center w-full h-12 rounded-xl bg-slate-100 px-4">
                  <div className="relative flex items-center shrink-0 pr-4 mr-3 border-r border-slate-200">
                    <select data-testid="checkout-other-type" value={otherType} onChange={(e) => setOtherType(e.target.value)} className="appearance-none bg-transparent pr-6 text-sm outline-none">
                      {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 h-3.5 w-3.5 text-slate-700" />
                  </div>
                  <input data-testid="checkout-other-input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="其他聯絡方式" className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coupons */}
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8" data-testid="checkout-coupon-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionTitle>優惠券</SectionTitle>
            <div className="flex items-center gap-3">
              <input data-testid="checkout-promo-input" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="請輸入優惠券碼" className="h-11 w-64 rounded-full bg-slate-100 px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
              <button data-testid="checkout-apply-promo-btn" onClick={() => applyPromo()} className="h-11 px-5 rounded-full bg-orange-50 text-orange-500 text-sm font-semibold hover:bg-orange-100">立即兌換</button>
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
          <div className="p-6 sm:p-8">
            <SectionTitle>支付方式（測試模式）</SectionTitle>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PAY_METHODS.map((m) => (
                <button key={m.id} data-testid={`pay-method-${m.id}`} onClick={() => setPayMethod(m.id)} className={`h-16 rounded-2xl border-2 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${payMethod === m.id ? "border-orange-400 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-600 hover:border-orange-200"}`}>
                  <m.icon className="h-5 w-5" />{m.label}
                </button>
              ))}
            </div>
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
          <div className={`${dots} px-6 sm:px-8 py-5`}>
            <div className="bg-slate-100 rounded-full min-h-[72px] flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-8 py-3">
              <div className="text-lg"><span className="font-bold text-slate-900">支付總額: </span><span className="font-head font-extrabold text-orange-500" data-testid="checkout-total">{format(totalUsd)}</span></div>
              <button data-testid="checkout-pay-btn" onClick={submit} disabled={loading} className="h-14 px-16 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold transition-colors disabled:opacity-60 w-full sm:w-auto">
                {loading ? "處理中…" : "立即支付"}
              </button>
            </div>
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
          <CheckCircle2 className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="font-head text-xl font-bold text-slate-900 mb-2">請先登入</h2>
          <p className="text-sm text-slate-500 mb-5">登入後即可填寫充值信息並下單</p>
          <button onClick={openAuth} className="h-11 px-6 rounded-full bg-orange-500 text-white font-semibold" data-testid="checkout-login-btn">登入 / 註冊</button>
        </div>
      </Show>
    </>
  );
}
