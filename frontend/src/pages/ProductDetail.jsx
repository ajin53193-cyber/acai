import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Star, Minus, Plus, ShoppingCart, Sparkles, CalendarCheck, Gift, Tags, BadgePercent, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { useCart } from "@/context/CartContext";
import ProductCard from "@/components/ProductCard";

const PERKS = [
  [Sparkles, "新用戶專享", "新用戶首單特惠"],
  [CalendarCheck, "每日一單", "規格超低價每日限購"],
  [Gift, "買就送不限量", "買得多送得多"],
  [Tags, "組合特價", "搭配購買更划算"],
  [BadgePercent, "特價不限量", "限時優惠不限購"],
];

const TIPS = [
  ["購買前請確認", "購物車商品資訊無誤", "。"],
  ["接收", "全球幣種", "支付，請在網站上方選擇您的支付貨幣類型即可。"],
  ["所有產品", "一經發貨，概不退款", "。"],
  ["點卡類商品收貨後請", "儘快去對應的官方網站充值", "，不要隨便在協力廠商提供的地址使用。"],
  ["請多次確認您的充值帳號及相關", "資訊是否正確", "，如因您充值帳號輸入錯誤但充值成功的，系統不予退款。"],
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { addItem, setOpen, count } = useCart();

  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [specId, setSpecId] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("desc");

  useEffect(() => {
    window.scrollTo(0, 0);
    setQty(1);
    publicApi.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      const first = r.data.specs.find((s) => s.in_stock) || r.data.specs[0];
      setSpecId(first?.id);
      publicApi.get("/categories").then((c) => setCategory(c.data.find((x) => x.id === r.data.category)));
      publicApi.get("/products", { params: { category: r.data.category } }).then((p) => setRelated(p.data.filter((x) => x.id !== id).slice(0, 8)));
    });
    publicApi.get("/reviews", { params: { product_id: id } }).then((r) => setReviews(r.data));
  }, [id]);

  const spec = useMemo(() => product?.specs.find((s) => s.id === specId), [product, specId]);
  const totalUsd = (spec?.price_usd || 0) * qty;
  const originalUsd = totalUsd * 1.1;

  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">載入中…</div>;

  const handleAdd = (buyNow = false) => {
    if (!spec) return;
    addItem(product, spec, qty);
    if (buyNow) navigate("/checkout");
    else { toast.success("已加入購物車"); setOpen(true); }
  };

  return (
    <div className="pb-28 md:pb-10" data-testid="product-detail">
      {/* Hero area */}
      <div className="bg-gradient-to-b from-[#FFE9D2] via-[#FFF3E6] to-[#FFF8F1] rounded-b-[40px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          <div className="text-xs text-slate-400 flex items-center gap-1.5" data-testid="product-breadcrumb">
            <Link to="/" className="hover:text-orange-600">首頁</Link><span>/</span>
            {category && <><Link to={`/category/${category.id}`} className="hover:text-orange-600">{category.name}</Link><span>/</span></>}
            <span className="text-slate-600">{product.name}</span>
          </div>

          <Link to="/sign-up" data-testid="detail-promo-banner" className="mt-4 flex justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFD9B0] via-[#FFE9D2] to-[#FFD9B0] h-[110px] sm:h-[150px]">
            <img src="https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b55a2354a230f99b_image.png" alt="新版上線有禮" className="h-full w-auto object-contain" />
          </Link>

          <div className="mt-6 flex items-center gap-5">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white p-3 shadow-sm shrink-0">
              <img src={product.image} alt={product.name} className="h-full w-full object-contain" data-testid="product-image" />
            </div>
            <div className="min-w-0">
              <h1 className="font-head text-xl sm:text-2xl font-bold text-slate-900" data-testid="product-title">{product.name}</h1>
              <div className="mt-1.5 text-sm text-slate-600 truncate">{product.account_field_hint || `${product.brand} 海外代充服務，支援全球帳號`}</div>
              <div className="mt-1.5 text-xs text-orange-500 flex items-center gap-3">
                <span>&gt;&gt;極速發貨</span><span>&gt;&gt;正版安全</span><span>&gt;&gt;24小時營業</span>
                <span className="hidden sm:flex items-center gap-1 text-amber-500"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{product.rating} · 已售 {product.sales_count}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 relative">
            <ChevronLeft className="absolute -left-1 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-300" />
            <ChevronRight className="absolute -right-1 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-300" />
            <div className="mx-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-white/40 rounded-2xl px-4 py-3" data-testid="perks-strip">
              {PERKS.map(([Icon, t, d]) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{t}</div>
                    <div className="text-xs text-slate-500 truncate">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2">
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-20px_rgba(232,121,42,0.35)] overflow-hidden">
          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {product.specs.map((s, i) => {
                const sel = s.id === specId;
                return (
                  <button
                    key={s.id}
                    data-testid={`spec-option-${s.id}`}
                    disabled={!s.in_stock}
                    onClick={() => setSpecId(s.id)}
                    className={`relative h-14 min-w-[140px] px-6 rounded-xl text-sm font-medium transition-all ${
                      sel ? "border-2 border-orange-400 bg-orange-50 text-orange-600" : "border border-transparent bg-slate-100 text-slate-700 hover:bg-orange-50"
                    } ${!s.in_stock ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {i === 0 && product.tags?.includes("熱銷") && (
                      <span className="absolute -top-2.5 right-0 rounded-full bg-orange-500 text-white text-[10px] px-2 py-0.5">每日一單</span>
                    )}
                    {s.label}
                    {!s.in_stock && <span className="ml-1 text-[10px] text-red-400">缺貨</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative bg-[#FFF6EC] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:14px_14px] px-5 sm:px-8 py-5">
            <div className="bg-white rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">購買數量</span>
                <div className="flex items-center rounded-full bg-slate-100 h-9">
                  <button data-testid="qty-dec" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-orange-500"><Minus className="h-4 w-4" /></button>
                  <span className="w-8 text-center text-sm font-semibold" data-testid="qty-value">{qty}</span>
                  <button data-testid="qty-inc" onClick={() => setQty((q) => Math.min(99, q + 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-orange-500"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="md:ml-auto flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <div className="text-sm text-slate-700">總計：<span className="font-head text-xl font-extrabold text-orange-500" data-testid="total-price">{format(totalUsd)}</span></div>
                  <div className="text-xs text-slate-400 line-through" data-testid="original-price">{format(originalUsd)}</div>
                </div>
                <button data-testid="cart-icon-btn" onClick={() => setOpen(true)} className="relative h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold flex items-center justify-center">{count}</span>
                </button>
                <button data-testid="add-to-cart-btn" onClick={() => handleAdd(false)} className="hidden md:inline-flex h-11 px-6 rounded-full bg-slate-900 text-white text-sm font-bold items-center hover:bg-slate-800 transition-colors">加入購物車</button>
                <button data-testid="buy-now-btn" onClick={() => handleAdd(true)} className="hidden md:inline-flex h-11 px-7 rounded-full bg-orange-500 text-white text-sm font-bold items-center hover:bg-orange-600 transition-colors">立即購買</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-3">
          {[["desc", "產品說明"], ["reviews", `評價(${reviews.length})`]].map(([k, label]) => (
            <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)} className={`h-10 px-6 rounded-full text-sm font-semibold transition-colors ${tab === k ? "bg-white text-orange-600 border-2 border-orange-400" : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "desc" ? (
          <div className="mt-4 bg-white rounded-3xl p-6 sm:p-8 text-sm text-slate-700 leading-7" data-testid="product-description">
            <div className="font-bold text-slate-900">溫馨提示：</div>
            <ol className="mt-2 space-y-1">
              {TIPS.map(([a, b, c], i) => <li key={i}>{i + 1}.{a} <span className="text-orange-500 font-semibold">{b}</span>{c}</li>)}
            </ol>
            <p className="mt-3 text-red-500 font-semibold">本平臺不刷單、不返傭，刷信譽、兼職等理由均為詐騙行為，請勿相信！ 避免上當受騙！</p>
            <div className="mt-6 font-bold text-slate-900">商品簡介：</div>
            <p className="mt-1 whitespace-pre-line">{product.description}</p>
            <div className="mt-6 font-bold text-slate-900">購買流程：</div>
            <p className="mt-1 whitespace-pre-line">{product.tutorial}</p>
            <div className="mt-6 font-bold text-slate-900">如何收貨：</div>
            <p className="mt-1">1. 訂單完成後，請登入對應 App 或官網查詢餘額；請留意充值前的餘額，方便確認到帳情況。<br />2. 下單過程中若有任何疑問，請隨時聯繫我們的 7×24 小時線上客服。</p>
            <div className="mt-6 font-bold text-slate-900">支付方式：</div>
            <p className="mt-1">1. 接收全幣種支付；<br />2. 支援 PayPal 帳戶、各種信用卡以及本地支付方式。</p>
            <div className="mt-6 font-bold text-slate-900">網站聲明：</div>
            <p className="mt-1">請多次確認您的充值帳號（{product.account_field_label}）及相關資訊是否正確，如因您充值帳號輸入錯誤但充值成功的，系統不予退款。</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3" data-testid="product-reviews">
            {reviews.length === 0 && <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm">暫無評價</div>}
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-700">{r.author}</span>
                  <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
                </div>
                <p className="text-sm text-slate-600 mt-2">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-10" data-testid="related-products">
            <h2 className="font-head text-xl font-bold text-slate-900 mb-4">相關推薦</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 z-30 flex items-center gap-3 md:hidden shadow-lg">
        <div className="shrink-0">
          <div className="text-[10px] text-slate-400">總計</div>
          <div className="font-head font-extrabold text-orange-500 text-lg leading-none">{format(totalUsd)}</div>
        </div>
        <button data-testid="mobile-add-to-cart-btn" onClick={() => handleAdd(false)} className="flex-1 h-11 rounded-full bg-slate-900 text-white font-bold text-sm">加入購物車</button>
        <button data-testid="mobile-buy-now-btn" onClick={() => handleAdd(true)} className="flex-1 h-11 rounded-full bg-orange-500 text-white font-bold text-sm">立即購買</button>
      </div>
    </div>
  );
}
