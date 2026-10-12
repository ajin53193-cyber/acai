import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronLeft, Zap, Megaphone, ShieldCheck, Rocket, Headphones, Tag, Globe, Star, Users, Gift } from "lucide-react";
import { publicApi } from "@/lib/api";

const NEWS = [
  { t: "雙十盛惠 | 全站充值立省最高 7%", d: "06-12", c: "from-rose-500 to-orange-500" },
  { t: "新用戶註冊 | 首單最高享 9% OFF", d: "06-10", c: "from-orange-500 to-amber-500" },
  { t: "會員日 | 每月領最高 8% 優惠券", d: "06-08", c: "from-violet-500 to-fuchsia-600" },
  { t: "海外如何為抖音充值？完整教學指南", d: "06-05", c: "from-emerald-500 to-teal-600" },
  { t: "小紅書薯幣有什麼用？海外購買指南", d: "06-03", c: "from-amber-500 to-yellow-500" },
  { t: "跨境充值常見問題與到帳時間說明", d: "06-01", c: "from-cyan-500 to-blue-600" },
];

const FEATURES = [
  [ShieldCheck, "正版安全", "涵蓋 500+ 款全球正版 App 內購服務"],
  [Rocket, "極速出貨", "人工 24 小時極速處理，多數訂單數分鐘到帳"],
  [Headphones, "7×24 客服", "全世界線上多語言客服竭誠服務"],
  [Tag, "天天平價", "每日全類目特價促銷，折扣不停"],
  [Globe, "全球支付", "預留 PayPal / 信用卡 / 加密貨幣支付通道"],
];

function salesText(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k+` : `${n}+`;
}

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
    <div className="pb-0">
      {/* Hero banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-100 via-amber-50 to-orange-50 border border-orange-100">
          <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-12 max-w-[60%]">
            <div className="text-sm font-semibold text-orange-500 mb-2">(UTC+8) 限時活動</div>
            <h1 className="font-head text-3xl sm:text-4xl lg:text-5xl font-extrabold text-orange-600 leading-tight">低價氪金 戰力超神</h1>
            <div className="font-head text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-800 mt-2">
              神券在手 下單省最高 <span className="text-orange-500">7%</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {[["手遊", "games"], ["端遊", "games"], ["點卡官方速充", "pointcard"]].map(([label, cid]) => (
                <Link key={label} to={`/category/${cid}`} data-testid={`hero-pill-${cid}-${label}`}
                  className="bg-white/80 hover:bg-white text-orange-600 font-semibold text-sm rounded-full px-5 py-2 border border-orange-200 transition-colors">{label}</Link>
              ))}
            </div>
          </div>
          <img src="https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/2ad58532ad0f875a0c9c030d9069119b5960735a7e1383d2f707ce6813e0bc05.jpeg"
            alt="hero" className="absolute right-0 top-0 h-full w-[55%] object-cover object-left pointer-events-none" />
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
          <Carousel testid="quick-carousel">
            {quick.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} data-testid={`quick-order-${p.id}`}
                className="group shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center text-center hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-50">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {p.tags?.includes("熱銷") && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500 text-white">熱銷</span>}
                </div>
                <h3 className="font-semibold text-[13px] text-slate-800 line-clamp-1 mt-2.5 group-hover:text-orange-600">{p.name}</h3>
                <span className="mt-2 text-xs font-bold text-orange-600 bg-orange-100 group-hover:bg-orange-500 group-hover:text-white rounded-full px-5 py-1.5 transition-colors">立即購買</span>
              </Link>
            ))}
          </Carousel>
        </section>

        {/* Hot products */}
        <section className="mt-8">
          <SectionTitle title="熱門商品" to="/category/livestream" />
          <Carousel testid="hot-carousel">
            {hot.slice(0, 16).map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} data-testid={`product-card-${p.id}`}
                className="group shrink-0 w-[150px] sm:w-[180px] bg-white rounded-2xl border border-slate-100 shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-50">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {p.tags?.includes("熱銷") && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500 text-white">熱銷</span>}
                </div>
                <h3 className="font-semibold text-[13px] text-slate-800 line-clamp-1 mt-2.5 text-center group-hover:text-orange-600">{p.name}</h3>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="flex items-center gap-0.5 text-slate-400"><span className="text-orange-400">🔥</span>{salesText(p.sales_count)}</span>
                  <span className="flex items-center gap-0.5 text-amber-500 font-semibold">{Math.round(p.rating)}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                </div>
              </Link>
            ))}
          </Carousel>
        </section>

        {/* Promo banners */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/sign-up" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white h-32 flex flex-col justify-center">
            <div className="font-head text-xl font-extrabold">新用戶註冊好禮</div>
            <p className="text-sm text-white/90 mt-1">首單最高領 9% 優惠券，立即開通</p>
            <Gift className="absolute right-5 bottom-4 h-16 w-16 text-white/20" />
          </Link>
          <Link to="/category/games" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 p-6 text-white h-32 flex flex-col justify-center">
            <div className="font-head text-xl font-extrabold">全站充值盛惠</div>
            <p className="text-sm text-white/90 mt-1">熱門遊戲 / 直播幣 立省最高 7%</p>
            <Zap className="absolute right-5 bottom-4 h-16 w-16 text-white/20" />
          </Link>
        </section>

        {/* Category sections (icon + name) */}
        {categories.map((c) => {
          const items = byCat(c.id).slice(0, 12);
          if (items.length === 0) return null;
          return (
            <section key={c.id} className="mt-8">
              <SectionTitle title={c.name} to={`/category/${c.id}`} icon={c.image} />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {items.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} data-testid={`cat-product-${p.id}`}
                    className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-50">
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-2.5 line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-orange-600">{p.name}</div>
                  </Link>
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
              <div key={i} data-testid={`news-card-${i}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex">
                <div className={`w-24 shrink-0 bg-gradient-to-br ${n.c} flex items-center justify-center`}>
                  <Megaphone className="h-7 w-7 text-white/80" />
                </div>
                <div className="p-3 flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 line-clamp-2">{n.t}</div>
                  <div className="text-xs text-slate-400 mt-2">2026-{n.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Feature band */}
      <section className="mt-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-8">
          <h2 className="font-head text-2xl font-extrabold text-center text-slate-900 mb-8">全球應用內購服務</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {FEATURES.map(([Icon, title, desc], i) => (
              <div key={i} className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mx-auto mb-3">
                  <Icon className="h-7 w-7 text-orange-500" />
                </div>
                <div className="font-semibold text-sm text-slate-800">{title}</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Register CTA band */}
      <section className="mt-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-white text-center sm:text-left">
            <div className="font-head text-2xl font-extrabold">新用戶註冊，最高領 9% 優惠券</div>
            <p className="text-sm text-white/85 mt-1">註冊即享首單優惠，海量正版 App 充值等你來！</p>
          </div>
          <Link to="/sign-up" data-testid="cta-register-btn" className="shrink-0 bg-white text-orange-600 font-bold rounded-full px-8 py-3 hover:shadow-lg transition-shadow">立即註冊</Link>
          <Gift className="absolute right-40 -bottom-6 h-32 w-32 text-white/10 hidden lg:block" />
        </div>
      </section>
    </div>
  );
}

function Carousel({ children, testid }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const [cardW, setCardW] = useState(180);
  const GAP = 12;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const per = el.clientWidth < 500 ? 3 : el.clientWidth < 768 ? 4 : 6;
      setCardW((el.clientWidth - GAP * (per - 1)) / per);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const scrollByDir = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * (cardW + GAP), behavior: "smooth" });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = setInterval(() => {
      if (paused || el.scrollWidth <= el.clientWidth + 2) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: cardW + GAP, behavior: "smooth" });
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [paused, cardW]);

  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const onDown = (e) => {
    const el = ref.current;
    drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
  };
  const onMove = (e) => {
    if (!drag.current.down) return;
    const el = ref.current;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = () => { drag.current.down = false; };

  const sized = React.Children.map(children, (c) =>
    React.cloneElement(c, { style: { ...(c.props.style || {}), width: cardW, flex: "0 0 auto" } })
  );

  return (
    <div className="relative" data-testid={testid}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => { setPaused(false); endDrag(); }}>
      <button data-testid={`${testid}-prev`} onClick={() => scrollByDir(-1)}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white shadow-md border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-50">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={endDrag}
        onClickCapture={(e) => { if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {sized}
      </div>
      <button data-testid={`${testid}-next`} onClick={() => scrollByDir(1)}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white shadow-md border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-50">
        <ChevronRight className="h-5 w-5" />
      </button>
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
      <Link to={to} className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-orange-500">查看更多 <ChevronRight className="h-3.5 w-3.5" /></Link>
    </div>
  );
}
