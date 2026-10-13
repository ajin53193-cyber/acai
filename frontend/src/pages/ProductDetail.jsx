import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Star, Minus, Plus, ShoppingCart, Sparkles, CalendarCheck, Gift, Tags, BadgePercent, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { publicApi, useApi } from "@/lib/api";
import { useUser } from "@clerk/react";
import { useCurrency } from "@/context/CurrencyContext";
import { useIsMobile } from "@/lib/useIsMobile";
import { useCart } from "@/context/CartContext";
import ProductCard from "@/components/ProductCard";

const PERKS = [
  [Sparkles, "新用戶專享", "新用戶首單特惠"],
  [CalendarCheck, "每日一單", "規格超低價每日限購"],
  [Gift, "買就送不限量", "買得多送得多"],
  [Tags, "組合特價", "搭配購買更划算"],
  [BadgePercent, "特價不限量", "限時優惠不限購"],
];

const badgeColor = (b = "") => /新用戶|每月一單/.test(b) ? "bg-fuchsia-500" : /每日一單|特價/.test(b) ? "bg-violet-500" : /送/.test(b) ? "bg-emerald-500" : /最低|免費/.test(b) ? "bg-red-500" : "bg-orange-500";

const PERK_SLIDES = ["/banners/perks-1.png", "/banners/perks-2.png"];

function PerksSlider() {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const go = (n) => {
    const k = (n + PERK_SLIDES.length) % PERK_SLIDES.length;
    setIdx(k);
    ref.current?.scrollTo({ left: k * ref.current.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="mt-4 md:mt-6 relative -mx-4 md:mx-0" data-testid="perks-slider">
      <button data-testid="perks-prev" onClick={() => go(idx - 1)} className="absolute left-1 md:-left-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-[#FFE4C8] text-orange-400 flex items-center justify-center shadow-sm"><ChevronLeft className="h-4 w-4" /></button>
      <button data-testid="perks-next" onClick={() => go(idx + 1)} className="absolute right-1 md:-right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-[#FFE4C8] text-orange-400 flex items-center justify-center shadow-sm"><ChevronRight className="h-4 w-4" /></button>
      <div ref={ref} onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="md:mx-6 flex overflow-x-auto no-scrollbar snap-x snap-mandatory md:rounded-2xl" data-testid="perks-strip">
        {PERK_SLIDES.map((src, i) => (
          <img key={src} src={src} alt={`購物權益 ${i + 1}`} data-testid={`perks-slide-${i}`} className="w-full shrink-0 snap-start h-auto block" />
        ))}
      </div>
    </div>
  );
}

const TICKER = ["如需使用其它幣種，請在網站右上角選擇", ">>極速發貨 >>正規安全 >>24小時營業"];

const TIPS = [
  ["購買前請確認", "購物車商品資訊無誤", "。"],
  ["接收", "全球幣種", "支付，請在網站上方選擇您的支付貨幣類型即可。"],
  ["所有產品", "一經發貨，概不退款", "。"],
  ["點卡類商品收貨後請", "儘快去對應的官方網站充值", "，不要隨便在協力廠商提供的地址使用。"],
  ["請多次確認您的充值帳號及相關", "資訊是否正確", "，如因您充值帳號輸入錯誤但充值成功的，系統不予退款。"],
];

export default function ProductDetail() {
  const isMobile = useIsMobile();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((v) => (v + 1) % TICKER.length), 3000); return () => clearInterval(t); }, []);
  const { id } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { addItem, setOpen, count } = useCart();
  const { isSignedIn } = useUser();
  const callApi = useApi();
  const [limit, setLimit] = useState({ used_spec_ids: [], is_new_customer: true });

  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [specId, setSpecId] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("desc");
  const [reviewsShown, setReviewsShown] = useState(10);

  useEffect(() => {
    window.scrollTo(0, 0);
    setQty(1);
    publicApi.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      const first = r.data.specs.find((s) => s.in_stock) || r.data.specs[0];
      setSpecId(first?.id);
      publicApi.get("/categories").then((c) => setCategory(c.data.find((x) => x.id === r.data.category)));
      setRelated(r.data.related || []);
    });
    publicApi.get("/reviews", { params: { product_id: id } }).then((r) => setReviews(r.data));
  }, [id]);

  useEffect(() => {
    if (!isSignedIn) return;
    callApi({ method: "GET", url: `/products/${id}/daily-limit` }).then((r) => setLimit(r.data)).catch(() => {});
  }, [id, isSignedIn, callApi]);

  const limitKind = (s) => { const b = s.badge || ""; return b.includes("每月一單") ? "monthly" : b.includes("每日一單") ? "daily" : /新客|新用戶|新使用者/.test(b) ? "newcomer" : null; };
  const specLimited = (s) => !!limitKind(s);
  const specLocked = (s) => { const k = limitKind(s); return ((k === "daily" || k === "monthly") && limit.used_spec_ids.includes(s.id)) || (k === "newcomer" && !limit.is_new_customer); };
  const limitText = (s) => { const k = limitKind(s); return k === "monthly" ? "每月一單" : k === "daily" ? "每日一單" : "新用戶專享"; };

  const spec = useMemo(() => product?.specs.find((s) => s.id === specId), [product, specId]);
  const totalUsd = (spec?.price_usd || 0) * qty;
  const originalUsd = (spec?.sale_price_usd || 0) * qty;

  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">載入中…</div>;

  const handleAdd = (buyNow = false) => {
    if (!spec) return;
    if (specLocked(spec)) return toast.error(limitKind(spec) === "newcomer" ? "此規格為新用戶專享，僅限首單購買，請選擇其他規格" : `此規格為${limitText(spec)}特價，您已購買過，請稍後再來或選擇其他規格`);
    if (specLimited(spec) && qty > 1) return toast.error(`${limitText(spec)}規格每次限購 1 份`);
    addItem(product, spec, qty);
    if (buyNow) navigate("/checkout");
    else { toast.success("已加入購物車"); setOpen(true); }
  };

  return (
    <div className="pb-28 md:pb-10" data-testid="product-detail">
      {/* Hero area */}
      <div className="max-md:rounded-b-[28px] max-md:bg-[#FFEFDF] md:bg-gradient-to-b md:from-[#FFE9D2] md:via-[#FFF3E6] md:to-[#FFF8F1] md:rounded-b-[40px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 md:pt-6 pb-5 md:pb-8">
          <div className="hidden md:flex text-xs text-slate-400 items-center gap-1.5" data-testid="product-breadcrumb">
            <Link to="/" className="hover:text-orange-600">首頁</Link><span>/</span>
            {category && <><Link to={`/category/${category.id}`} className="hover:text-orange-600">{category.name}</Link><span>/</span></>}
            <span className="text-slate-600">{product.name}</span>
          </div>

          <Link to="/sign-up" data-testid="detail-promo-banner" className="mt-0 md:mt-4 block overflow-hidden rounded-2xl">
            <img src="/banners/detail-promo.png" alt="低價氪金 戰力超神 神券在手 下單省最高 7%" className="w-full h-auto block" />
          </Link>

          <div className="mt-4 md:mt-6 flex items-start md:items-center gap-3 md:gap-5">
            <div className="h-[72px] w-[72px] sm:h-24 sm:w-24 rounded-2xl bg-white p-1.5 md:p-3 shadow-sm shrink-0 overflow-hidden">
              <img src={product.image} alt={product.name} className="h-full w-full object-cover md:object-contain rounded-xl" data-testid="product-image" />
            </div>
            <div className="min-w-0">
              <h1 className="font-head text-base sm:text-2xl font-bold text-slate-900" data-testid="product-title">{product.name}</h1>
              <div className="mt-1 md:mt-1.5 text-xs md:text-sm text-slate-500 md:text-slate-600 max-md:line-clamp-2 md:truncate">{product.subtitle || product.account_field_hint || `${product.brand} 海外代充服務，支援全球帳號`}</div>
              <div className="mt-1 md:mt-1.5 text-xs text-orange-500 h-4 overflow-hidden relative" data-testid="detail-ticker">
                <div key={tick} className="animate-ticker whitespace-nowrap">{TICKER[tick]}</div>
                <span className="hidden sm:flex items-center gap-1 text-amber-500"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{product.rating} · 已售 {product.sales_count}</span>
              </div>
            </div>
          </div>

          <PerksSlider />
          {product.group?.length > 1 && (
            <div className="mt-4 md:mt-6 grid grid-cols-2 md:flex md:flex-wrap gap-2.5 md:gap-3" data-testid="product-group-tabs">
              {product.group.map((g) => {
                const on = String(g.id) === String(product.id);
                return (
                  <Link key={g.id} to={`/product/${g.id}`} data-testid={`group-tab-${g.id}`} aria-current={on ? "page" : undefined}
                    className={`h-9 md:h-12 md:px-8 rounded-xl md:rounded-2xl flex items-center justify-center text-[13px] md:text-base font-normal transition-colors ${on ? "bg-white border border-orange-400 text-orange-500" : "bg-white/80 text-slate-600 hover:bg-white"}`}>
                    {g.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Purchase card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 md:-mt-2">
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-20px_rgba(232,121,42,0.35)] overflow-hidden">
          <div className="p-4 pt-7 sm:p-8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:flex md:flex-wrap md:gap-3 sm:gap-4">
              {product.specs.map((s, i) => {
                const sel = s.id === specId;
                const locked = specLocked(s);
                return (
                  <button
                    key={s.id}
                    data-testid={`spec-option-${s.id}`}
                    disabled={!s.in_stock}
                    onClick={() => setSpecId(s.id)}
                    title={locked ? "已達限購" : undefined}
                    className={`relative min-h-11 py-1.5 md:py-0 md:h-14 md:min-w-[140px] px-2 md:px-6 rounded-lg md:rounded-xl text-[14px] md:text-sm font-normal transition-all leading-tight ${
                      sel ? "border border-orange-400 bg-orange-50/60 md:bg-orange-50 text-orange-500" : "border border-transparent bg-slate-100/80 md:bg-slate-100 text-slate-600 hover:bg-orange-50"
                    } ${!s.in_stock ? "opacity-40 cursor-not-allowed" : ""} ${locked ? "opacity-50" : ""}`}
                  >
                    {s.badge && (
                      <span className={`absolute -top-2.5 right-0 rounded-md md:rounded-full text-white text-[10px] px-1.5 md:px-2 py-px md:py-0.5 whitespace-nowrap ${locked ? "bg-slate-400" : badgeColor(s.badge)}`}>{locked ? "已達限購" : s.badge}</span>
                    )}
                    {s.label}
                    {!s.in_stock && <span className="ml-1 text-[10px] text-red-400">缺貨</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {spec && specLimited(spec) && (
            <div data-testid="daily-limit-notice" className={`mx-5 sm:mx-8 mb-4 rounded-xl px-4 py-2.5 text-sm ${specLocked(spec) ? "bg-slate-100 text-slate-600" : "bg-orange-50 text-orange-600"}`}>
              {specLocked(spec)
                ? (limitKind(spec) === "newcomer" ? "「新用戶專享」規格僅限首次下單使用，請選擇其他規格。" : `您已購買過此「${limitText(spec)}」規格，${limitKind(spec) === "monthly" ? "30 天後" : "明天"}即可再次購買；也可選擇其他規格。`)
                : (limitKind(spec) === "newcomer" ? "此規格為「新用戶專享」特價：僅限首單購買 1 份。" : `此規格為「${limitText(spec)}」特價：每個帳號${limitKind(spec) === "monthly" ? "每月" : "每天"}限購 1 份。`)}
            </div>
          )}
          <div className="relative bg-[#FFF6EC] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:14px_14px] px-5 sm:px-8 py-5">
            <div className="bg-white rounded-2xl px-4 md:px-5 py-4 flex flex-row md:flex-row items-center justify-between md:justify-start gap-4">
              <div className="flex items-center gap-4">
                <span className="hidden md:inline text-sm text-slate-600">購買數量</span>
                <div className="flex items-center rounded-xl md:rounded-full border border-slate-200 md:border-0 bg-white md:bg-slate-100 h-10 md:h-9">
                  <button data-testid="qty-dec" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-orange-500"><Minus className="h-4 w-4" /></button>
                  <span className="w-10 md:w-8 text-center text-sm font-semibold" data-testid="qty-value">{qty}</span>
                  <button data-testid="qty-inc" onClick={() => setQty((q) => Math.min(99, q + 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-orange-500"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="md:ml-auto flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <div className="text-sm text-slate-700">總計：<span className="font-head text-xl font-extrabold text-orange-500" data-testid="total-price">{format(totalUsd)}</span></div>
                  {originalUsd > totalUsd && <div className="text-xs text-slate-400 line-through" data-testid="original-price">{format(originalUsd)}</div>}
                </div>
                <button data-testid="cart-icon-btn" onClick={() => setOpen(true)} className="relative hidden md:flex h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800">
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
        <div className="mt-6 md:mt-8 flex items-end" data-testid="detail-tabs">
          {[["desc", "產品說明"], ["reviews", `評價(${reviews.length})`]].map(([k, label]) => (
            <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)} className={`h-11 px-5 md:px-7 rounded-t-2xl text-[15px] md:text-base transition-colors ${tab === k ? "bg-white text-orange-500" : "text-slate-700 hover:text-orange-500"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "desc" ? (
          <div className={`bg-white rounded-b-3xl rounded-tr-3xl ${tab === "desc" ? "" : "rounded-tl-3xl"} p-4 sm:p-8 text-sm md:text-[15px] text-slate-600 leading-7`} data-testid="product-description">
            <div className="border border-dashed border-orange-400 rounded px-4 py-3 md:px-5 md:py-4 text-[15px] md:text-base leading-[1.9]" data-testid="product-tips">
              <div className="font-semibold text-slate-800">溫馨提示：</div>
              <ol>
                {TIPS.map(([a, b, c], i) => <li key={i}>{i + 1}.{a} <span className="text-orange-500">{b}</span>{c}</li>)}
              </ol>
              <p className="text-red-500">本平臺不刷單、不返傭，刷信譽、兼職等理由均為詐騙行為，請勿相信！ 避免上當受騙！</p>
            </div>
            {product.delivery_fields?.length > 0 && (
              <>
                <div className="mt-5 font-semibold text-slate-800">下單需填寫：</div>
                <ul className="mt-1 list-disc pl-5">
                  {product.delivery_fields.map((f) => <li key={f.name}>{f.name}{f.required ? "（必填）" : ""}{f.tips ? ` — ${f.tips}` : ""}</li>)}
                </ul>
              </>
            )}
            {product.content_html ? (
              <div className="mt-5 kavip-content" data-testid="product-content-html" dangerouslySetInnerHTML={{ __html: product.content_html }} />
            ) : (
              <>
                <div className="mt-5 font-semibold text-slate-800">商品簡介：</div>
                <p className="mt-1 whitespace-pre-line">{product.description}</p>
                {product.tutorial && <><div className="mt-5 font-semibold text-slate-800">購買流程：</div><p className="mt-1 whitespace-pre-line">{product.tutorial}</p></>}
              </>
            )}
            {!product.content_html && (
              <>
                <div className="mt-5 font-semibold text-slate-800">網站聲明：</div>
                <p className="mt-1">請多次確認您的充值帳號（{product.account_field_label}）及相關資訊是否正確，如因您充值帳號輸入錯誤但充值成功的，系統不予退款。</p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-b-3xl rounded-tl-3xl p-5 sm:p-6" data-testid="product-reviews">
            {reviews.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">暫無評價</div>
            ) : (
              <>
                <div className="flex items-center gap-4 pb-4 border-b border-dashed border-slate-200">
                  <span className="font-head text-4xl font-extrabold text-orange-500">{(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)}</span>
                  <div>
                    <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.round(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
                    <div className="text-xs text-slate-400 mt-1">共 {reviews.length} 則評價 · 來自 {new Set(reviews.map((r) => r.area).filter(Boolean)).size || 1} 個地區</div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {reviews.slice(0, reviewsShown).map((r) => (
                    <div key={r.id} className="py-4" data-testid={`review-${r.id}`}>
                      <div className="flex items-start gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center text-sm font-bold uppercase">{(r.author || "u")[0]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold text-sm text-slate-800" data-testid="review-author">{r.author}</span>
                            <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
                            {r.buy_count > 1 && <span className="text-[11px] rounded-full bg-orange-50 text-orange-500 px-2 py-0.5">回購 {r.buy_count} 次</span>}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {r.created_at?.slice(0, 10)}{r.area ? ` · ${r.area}` : ""}
                          </div>
                          {r.content ? (
                            <p className="text-sm text-slate-700 mt-2 leading-relaxed">{r.content}</p>
                          ) : (
                            <p className="text-sm text-slate-400 mt-2 italic">{r.lang === "en" ? "Rated without comment" : r.lang === "zh-CN" ? "用户未填写评价内容" : "用戶未填寫評價內容"}</p>
                          )}
                          {r.reply && <div className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-slate-600"><span className="font-semibold text-orange-500">客服回覆：</span>{r.reply}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {reviews.length > reviewsShown && (
                  <button data-testid="reviews-more" onClick={() => setReviewsShown((n) => n + 10)} className="mt-2 w-full h-10 rounded-full bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-600">載入更多評價</button>
                )}
              </>
            )}
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-10" data-testid="related-products">
            <h2 className="font-head text-lg md:text-xl font-bold text-slate-900 mb-4 relative inline-block z-0 max-md:after:content-[''] max-md:after:absolute max-md:after:left-0 max-md:after:right-0 max-md:after:bottom-0.5 max-md:after:h-2 max-md:after:bg-orange-200/80 max-md:after:-z-10">相關推薦</h2>
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
              {related.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} simple={isMobile} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl px-4 pt-3 pb-4 z-30 flex items-center gap-3 md:hidden shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)]">
        <button data-testid="mobile-cart-btn" onClick={() => setOpen(true)} className="relative h-12 w-12 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center">
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold flex items-center justify-center">{count}</span>
        </button>
        <button data-testid="mobile-add-to-cart-btn" onClick={() => handleAdd(false)} className="flex-1 h-12 rounded-full bg-slate-900 text-white font-bold text-base">加入購物車</button>
        <button data-testid="mobile-buy-now-btn" onClick={() => handleAdd(true)} className="flex-1 h-12 rounded-full bg-orange-500 text-white font-bold flex flex-col items-center justify-center leading-tight">
          <span className="text-sm">立即購買</span>
          <span className="text-[12px] font-bold" data-testid="mobile-total-price">{format(totalUsd)}</span>
        </button>
      </div>
    </div>
  );
}
