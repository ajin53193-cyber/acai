import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Minus, Plus, ShieldCheck, Clock, BadgeCheck, ShoppingCart, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { useCart } from "@/context/CartContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { addItem, setOpen } = useCart();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [specId, setSpecId] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    publicApi.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      const firstInStock = r.data.specs.find((s) => s.in_stock) || r.data.specs[0];
      setSpecId(firstInStock?.id);
    });
    publicApi.get("/reviews", { params: { product_id: id } }).then((r) => setReviews(r.data));
  }, [id]);

  const spec = useMemo(() => product?.specs.find((s) => s.id === specId), [product, specId]);
  const totalUsd = (spec?.price_usd || 0) * qty;

  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">載入中…</div>;

  const handleAdd = (buyNow = false) => {
    if (!spec) return;
    addItem(product, spec, qty);
    if (buyNow) {
      navigate("/checkout");
    } else {
      toast.success("已加入購物車");
      setOpen(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-10">
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Image */}
        <div className="lg:col-span-5">
          <div className="sticky top-28">
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white">
              <img src={product.image} alt={product.name} className="w-full aspect-square object-cover" data-testid="product-image" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1 flex items-center gap-1">
              <BadgeCheck className="h-3 w-3" /> {product.brand}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> 24H 極速發貨
            </span>
          </div>
          <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-slate-900" data-testid="product-title">
            {product.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{product.rating}</span>
            </div>
            <span>· 已售 {product.sales_count}</span>
          </div>

          <div className="mt-4 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl p-4 border border-primary/10">
            <span className="text-xs text-slate-500">當前選擇總價</span>
            <div className="font-head font-extrabold text-primary text-3xl" data-testid="total-price">
              {format(totalUsd)}
            </div>
          </div>

          {/* Specs */}
          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-700 mb-2">選擇規格</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {product.specs.map((s) => {
                const sel = s.id === specId;
                return (
                  <button
                    key={s.id}
                    data-testid={`spec-option-${s.id}`}
                    disabled={!s.in_stock}
                    onClick={() => setSpecId(s.id)}
                    className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                      sel
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } ${!s.in_stock ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="font-semibold text-sm text-slate-900">{s.label}</div>
                    <div className={`text-sm font-head font-bold mt-0.5 ${sel ? "text-primary" : "text-slate-500"}`}>
                      {format(s.price_usd)}
                    </div>
                    {!s.in_stock && <span className="text-[10px] text-red-400">缺貨</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-5 flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">數量</span>
            <div className="flex items-center border border-slate-200 rounded-xl bg-white">
              <button
                data-testid="qty-dec"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-2.5 text-slate-500 hover:text-primary"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 font-semibold w-12 text-center" data-testid="qty-value">{qty}</span>
              <button
                data-testid="qty-inc"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="p-2.5 text-slate-500 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Account hint */}
          <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2.5">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600">
              下單結賬時需填寫 <span className="font-semibold text-primary">{product.account_field_label}</span>。
              {product.account_field_hint && <span className="block text-slate-400 mt-0.5">{product.account_field_hint}</span>}
            </div>
          </div>

          {/* Desktop buttons */}
          <div className="hidden md:flex gap-3 mt-6">
            <button
              data-testid="add-to-cart-btn"
              onClick={() => handleAdd(false)}
              className="flex-1 h-13 py-3.5 rounded-xl border-2 border-primary text-primary font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" /> 加入購物車
            </button>
            <button
              data-testid="buy-now-btn"
              onClick={() => handleAdd(true)}
              className="flex-1 h-13 py-3.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
            >
              <Zap className="h-5 w-5" /> 立即購買
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-10">
        <Tabs defaultValue="details">
          <TabsList className="bg-white border border-slate-200 rounded-xl p-1">
            <TabsTrigger value="details" data-testid="tab-details">商品說明</TabsTrigger>
            <TabsTrigger value="tutorial" data-testid="tab-tutorial">充值教學</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">評價 ({reviews.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {product.description}
              <div className="mt-4 flex items-start gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                虛擬商品人工充值，完成後不可退款，請確認帳號無誤後再下單。
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tutorial" className="mt-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {product.tutorial}
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-4">
            <div className="space-y-3">
              {reviews.length === 0 && <div className="text-slate-400 text-sm">暫無評價</div>}
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-700">{r.author}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{r.content}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile sticky bar */}
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 z-30 flex items-center gap-3 md:hidden shadow-lg"
      >
        <div className="shrink-0">
          <div className="text-[10px] text-slate-400">總價</div>
          <div className="font-head font-extrabold text-primary text-lg leading-none">{format(totalUsd)}</div>
        </div>
        <button
          data-testid="mobile-add-to-cart-btn"
          onClick={() => handleAdd(false)}
          className="flex-1 h-11 rounded-full border-2 border-primary text-primary font-bold text-sm"
        >
          加入購物車
        </button>
        <button
          data-testid="mobile-buy-now-btn"
          onClick={() => handleAdd(true)}
          className="flex-1 h-11 rounded-full bg-primary text-white font-bold text-sm"
        >
          立即購買
        </button>
      </motion.div>
    </div>
  );
}
