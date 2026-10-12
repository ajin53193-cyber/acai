import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Radio, Gamepad2, Play, Gift, ShieldCheck, Star, ArrowRight, Zap } from "lucide-react";
import { publicApi } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import LiveTicker from "@/components/LiveTicker";

const CAT_ICONS = { douyin: Flame, live: Radio, game: Gamepad2, vip: Play, giftcard: Gift };

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    publicApi.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    publicApi.get("/reviews").then((r) => setReviews(r.data.slice(0, 8))).catch(() => {});
  }, []);

  const filtered = activeTab === "all" ? products : products.filter((p) => p.category === activeTab);

  return (
    <div className="pb-10">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid lg:grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-secondary/20 text-secondary rounded-full px-3 py-1 mb-4">
              <Zap className="h-3.5 w-3.5" /> 24 小時人工極速發貨
            </span>
            <h1 className="font-head text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              海外充值<span className="text-primary">·</span>一站搞定
              <br />
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                抖音 DOU+、直播幣、遊戲點卡
              </span>
            </h1>
            <p className="text-slate-300 mt-4 text-sm sm:text-base max-w-lg">
              跨境用戶首選數字商品充值平台，支援多幣種顯示，官方授權正品，全程人工安全發貨。
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                to="/category/douyin"
                data-testid="hero-cta-primary"
                className="h-12 px-6 rounded-full bg-primary text-white font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors"
              >
                立即充值 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/category/game"
                className="h-12 px-6 rounded-full bg-white/10 text-white font-semibold flex items-center hover:bg-white/20 transition-colors"
              >
                遊戲直充
              </Link>
            </div>
            <div className="mt-6">
              <LiveTicker />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-5 hidden lg:block"
          >
            <img
              src="https://images.unsplash.com/photo-1542751371-adc38448a05e?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
              alt="gaming"
              className="rounded-3xl shadow-2xl object-cover h-80 w-full"
            />
          </motion.div>
        </div>
      </section>

      {/* Quick entrance cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {categories.map((c, i) => {
            const Icon = CAT_ICONS[c.id] || Flame;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/category/${c.id}`}
                  data-testid={`quick-entry-${c.id}`}
                  className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:border-primary/40 transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 text-center">{c.name}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Product grid with tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-2xl font-bold text-slate-900">熱門商品</h2>
        </div>
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-3 mb-4">
          <button
            data-testid="home-tab-all"
            onClick={() => setActiveTab("all")}
            className={`whitespace-nowrap text-sm font-semibold rounded-full px-4 py-2 transition-colors ${
              activeTab === "all" ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              data-testid={`home-tab-${c.id}`}
              onClick={() => setActiveTab(c.id)}
              className={`whitespace-nowrap text-sm font-semibold rounded-full px-4 py-2 transition-colors ${
                activeTab === c.id ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Non-refund banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">溫馨提示 · 無退款聲明</div>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              本站充值屬虛擬商品，由人工作業處理，一經充值完成恕不退款。下單前請務必確認充值帳號正確無誤。
            </p>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <h2 className="font-head text-2xl font-bold text-slate-900 mb-4">用戶真實評價</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{r.content}</p>
              <div className="text-xs text-slate-400 mt-3">— {r.author}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
