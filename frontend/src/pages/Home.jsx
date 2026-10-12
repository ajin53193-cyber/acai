import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Zap, Megaphone, ShieldCheck, Rocket, Headphones, Tag, Globe } from "lucide-react";
import { publicApi } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

const NEWS = [
  { t: "雙十盛惠 | 全站充值立省最高 7%", c: "from-rose-500 to-orange-500" },
  { t: "新用戶註冊 | 首單最高享 9% OFF", c: "from-blue-500 to-indigo-600" },
  { t: "會員日 | 每月領最高 8% 優惠券", c: "from-violet-500 to-fuchsia-600" },
  { t: "海外如何為抖音充值？完整教學指南", c: "from-emerald-500 to-teal-600" },
  { t: "小紅書薯幣有什麼用？海外購買指南", c: "from-amber-500 to-orange-600" },
  { t: "跨境充值常見問題與到帳時間說明", c: "from-cyan-500 to-blue-600" },
];

const FEATURES = [
  [ShieldCheck, "正版安全", "涵蓋 500+ 款全球正版 App 內購服務"],
  [Rocket, "極速出貨", "人工 24 小時極速處理，多數訂單數分鐘到帳"],
  [Headphones, "7×24 客服", "全世界線上多語言客服竭誠服務"],
  [Tag, "天天平價", "每日全類目特價促銷，折扣不停"],
  [Globe, "全球支付", "預留 PayPal / 信用卡 / 加密貨幣支付通道"],
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    publicApi.get("/products").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  const hot = [...products].sort((a, b) => b.sales_count - a.sales_count);
  const quick = products.filter((p) => p.tags?.includes("熱銷")).slice(0, 6);
  const byCat = (cid) => products.filter((p) => p.category === cid);

  return (
    <div className="bg-slate-50 pb-10">
      {/* Hero banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-100 via-amber-50 to-orange-50 border border-orange-100">
          <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-12 max-w-[60%]">
            <div className="text-sm font-semibold text-orange-500 mb-2">(UTC+8) 限時活動</div>
            <h1 className="font-head text-3xl sm:text-4xl lg:text-5xl font-extrabold text-orange-600 leading-tight">
              低價氪金 戰力超神
            </h1>
            <div className="font-head text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-800 mt-2">
              神券在手 下單省最高 <span className="text-orange-500">7%</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {[["手遊", "games"], ["端遊", "games"], ["點卡官方速充", "pointcard"]].map(([label, cid]) => (
                <Link
                  key={label}
                  to={`/category/${cid}`}
                  data-testid={`hero-pill-${cid}-${label}`}
                  className="bg-white/80 hover:bg-white text-orange-600 font-semibold text-sm rounded-full px-5 py-2 border border-orange-200 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <img
            src="https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/2ad58532ad0f875a0c9c030d9069119b5960735a7e1383d2f707ce6813e0bc05.jpeg"
            alt="hero"
            className="absolute right-0 top-0 h-full w-[55%] object-cover object-left pointer-events-none"
          />
        </div>
      </div>

      {/* Announcement */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-2 text-xs sm:text-sm text-orange-700">
          <Megaphone className="h-4 w-4 shrink-0" />
          <span className="font-medium">GlobalTopUp 介面升級公告：全新繁中介面上線，人工極速發貨，祝您購物愉快！</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quick order */}
        <section className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-secondary" />
            <h2 className="font-head text-lg font-bold text-slate-900">快速下單</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {quick.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                data-testid={`quick-order-${p.id}`}
                className="bg-white rounded-xl border border-slate-200 p-2.5 flex flex-col items-center text-center hover:shadow-md hover:border-primary/40 transition-all"
              >
                <img src={p.image} alt={p.name} className="h-14 w-14 rounded-xl object-cover" />
                <div className="text-[12px] font-medium text-slate-700 line-clamp-1 mt-1.5 w-full">{p.name}</div>
                <span className="mt-1.5 text-[11px] font-bold text-white bg-secondary rounded-full px-2.5 py-0.5">立即購買</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Hot products */}
        <section className="mt-8">
          <SectionTitle title="熱門商品" to="/category/livestream" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {hot.slice(0, 12).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Promo banners */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/category/pointcard" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-blue-600 p-6 text-white h-32 flex flex-col justify-center">
            <div className="font-head text-xl font-extrabold">新用戶註冊好禮</div>
            <p className="text-sm text-white/85 mt-1">首單最高領 9% 優惠券，立即開通</p>
            <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10" />
          </Link>
          <Link to="/category/games" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary to-rose-500 p-6 text-white h-32 flex flex-col justify-center">
            <div className="font-head text-xl font-extrabold">全站充值盛惠</div>
            <p className="text-sm text-white/85 mt-1">熱門遊戲 / 直播幣 立省最高 7%</p>
            <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10" />
          </Link>
        </section>

        {/* Category sections */}
        {categories.map((c) => {
          const items = byCat(c.id).slice(0, 12);
          if (items.length === 0) return null;
          return (
            <section key={c.id} className="mt-8">
              <SectionTitle title={c.name} to={`/category/${c.id}`} icon={c.image} />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          );
        })}

        {/* News & promo */}
        <section className="mt-10">
          <SectionTitle title="新聞 & 促銷" to="/" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {NEWS.map((n, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <div className={`h-24 bg-gradient-to-br ${n.c} flex items-center justify-center p-3`}>
                  <Megaphone className="h-8 w-8 text-white/80" />
                </div>
                <div className="p-3 text-sm font-medium text-slate-700 line-clamp-2 min-h-[3rem]">{n.t}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Feature banner */}
      <section className="mt-12 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="font-head text-2xl font-extrabold text-center mb-8">全球應用內購服務</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {FEATURES.map(([Icon, title, desc], i) => (
              <div key={i} className="text-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="font-semibold text-sm">{title}</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, to, icon }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && <img src={icon} alt="" className="h-6 w-6 rounded-md object-cover" />}
        <h2 className="font-head text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <Link to={to} className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-primary">
        查看更多 <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
