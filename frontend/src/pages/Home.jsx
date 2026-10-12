import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronLeft, Zap, Megaphone, ShieldCheck, Rocket, Headphones, Tag, Globe, Star, Users, Gift, Percent, FileText } from "lucide-react";
import { publicApi } from "@/lib/api";

const PIMG = "https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/";
const NEWS = [
  { img: PIMG + "39ae98f586060ad5b69976ce922491f48c54040922798b5ed10349676b662215.jpeg", t: "十一盛惠｜全站充值立省最高 7%", type: "promo" },
  { img: PIMG + "df7e2e49230f68860ee9fad2f1b296f3bdd3d7bbac3a7ab579127753b3da0f91.jpeg", t: "中秋同樂｜充值最高享 7% OFF", type: "promo" },
  { img: PIMG + "c91a909e2ccc13ca328283dabfefdfd1aa645679457f488264697a7281f7256d.jpeg", t: "金秋三重好券｜充值最高省 7%", type: "promo" },
  { img: PIMG + "84b82d52bc003b68a749684c105cd74b005d2cb7a0296564723bce2db6b83e92.jpeg", t: "會員日優惠券｜每月送最高 8% OFF", type: "promo" },
  { img: PIMG + "e93f5592b4a32550909fba4494e7a12f4405ef1f0d2af4795696a505042a8d30.jpeg", t: "月初滿減大禮包｜用券最高省 128 美金", type: "promo" },
  { img: PIMG + "dbb362841e4a83aa5efc1f7b50d4b8235b96eb646e6be5244d719424e93925db.jpeg", t: "開學季「券」力全開｜新學期最高省 7%", type: "promo" },
  { img: PIMG + "15a9df686e792e1c9ae72cad000cd79136df98bce2039217422acf67e67448f7.jpeg", t: "在國外怎麼幫社交平台充值？海外教學", type: "article" },
  { img: PIMG + "95027518454c11a91b49cf79798c6fcfe3e1eb4fcc2f4b4122737c143f351aca.jpeg", t: "虛擬幣有什麼用？海外用戶充值指南", type: "article" },
  { img: PIMG + "899567a5c0f4bff028245a26f4321eea9a5f56d3eca3c5187fcf00bd170e8d83.jpeg", t: "海外怎麼給短影音平台充值？完整教學", type: "article" },
  { img: PIMG + "0221be504565b160e332aa877354fa4ec3247d3db28e7c88d0222e9730ef659f.jpeg", t: "海外如何充值直播幣？國外充值教學", type: "article" },
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
                className="group shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center text-center hover:shadow-md transition-all">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {p.tags?.includes("熱銷") && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500 text-white">熱銷</span>}
                </div>
                <h3 className="font-semibold text-[13px] leading-normal text-slate-800 truncate mt-1 w-full group-hover:text-orange-600">{p.name}</h3>
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
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {p.tags?.includes("熱銷") && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500 text-white">熱銷</span>}
                </div>
                <h3 className="font-semibold text-[13px] leading-normal text-slate-800 truncate mt-2.5 text-center w-full group-hover:text-orange-600">{p.name}</h3>
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
          <Link to="/sign-up" data-testid="promo-banner-1" className="block overflow-hidden rounded-2xl hover:shadow-lg transition-shadow">
            <img src="https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b55a2354a230f99b_image.png" alt="新版上線有禮 5% OFF" className="w-full h-auto object-cover" />
          </Link>
          <Link to="/category/games" data-testid="promo-banner-2" className="block overflow-hidden rounded-2xl hover:shadow-lg transition-shadow">
            <img src="https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/3673631df7a58fe1_image.png" alt="精選活動合集 優惠一站搞定" className="w-full h-auto object-cover" />
          </Link>
        </section>

        {/* Hot categories: 6 categories, each a 2-page swipeable 5x2 grid */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-xl font-bold text-slate-900">熱門分類</h2>
            <Link to="/category/livestream" data-testid="all-categories-link" className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 hover:bg-orange-100">全部分類</Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {categories.slice(0, 6).map((c) => {
              const items = byCat(c.id).slice(0, 20);
              if (items.length === 0) return null;
              return (
                <div key={c.id} data-testid={`cat-panel-${c.id}`} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-orange-400 to-amber-500" />
                      <h3 className="font-bold text-lg text-slate-900">{c.name}</h3>
                    </div>
                    <Link to={`/category/${c.id}`} className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-orange-500">查看更多 <ChevronRight className="h-3.5 w-3.5" /></Link>
                  </div>
                  <PagedGrid items={items} perPage={10} testid={`cat-paged-${c.id}`} />
                </div>
              );
            })}
          </div>
        </section>

        {/* News & promo */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-xl font-bold text-slate-900">新聞 & 促銷</h2>
            <Link to="/" data-testid="news-more-link" className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 hover:bg-orange-100">查看更多</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {NEWS.map((n, i) => (
              <div key={i} data-testid={`news-card-${i}`} className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className="h-5 bg-gradient-to-r from-orange-400 to-amber-400 flex items-center gap-1 px-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                </div>
                <div className="aspect-[3/2] overflow-hidden bg-orange-50">
                  <img src={n.img} alt={n.t} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-3 flex items-center gap-1.5">
                  {n.type === "promo" ? (
                    <span className="shrink-0 h-4 w-4 rounded bg-red-500 text-white flex items-center justify-center"><Percent className="h-2.5 w-2.5" strokeWidth={3} /></span>
                  ) : (
                    <span className="shrink-0 h-4 w-4 rounded bg-orange-100 text-orange-500 flex items-center justify-center"><FileText className="h-2.5 w-2.5" /></span>
                  )}
                  <span className="text-[13px] font-medium text-slate-700 truncate group-hover:text-orange-600">{n.t}</span>
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
    React.cloneElement(c, {
      style: { ...(c.props.style || {}), width: cardW, flex: "0 0 auto", scrollSnapAlign: "start" },
    })
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
        style={{ scrollSnapType: "x mandatory" }}
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

function PagedGrid({ items, perPage = 10, testid }) {
  const ref = useRef(null);
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));

  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const goTo = (p) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = ref.current;
    if (el && !drag.current.down) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const onDown = (e) => {
    const el = ref.current;
    drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onMove = (e) => {
    if (!drag.current.down) return;
    const el = ref.current;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const onUp = (e) => {
    if (!drag.current.down) return;
    drag.current.down = false;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    const el = ref.current;
    if (el) {
      const p = Math.max(0, Math.min(pages.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
      setPage(p);
      goTo(p);
    }
  };

  return (
    <div data-testid={testid}>
      <div ref={ref} onScroll={onScroll}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); } }}
        className="flex overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
        style={{ scrollSnapType: dragging ? "none" : "x mandatory", touchAction: "pan-y" }}>
        {pages.map((pg, pi) => (
          <div key={pi} className="shrink-0 w-full grid grid-cols-5 gap-x-2 gap-y-4"
            style={{ scrollSnapAlign: "start" }}>
            {pg.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} draggable={false} data-testid={`cat-product-${p.id}`} className="group flex flex-col items-center text-center">
                <div className="w-full aspect-square rounded-[22px] overflow-hidden bg-white border border-slate-50 shadow-sm group-hover:shadow-md transition-shadow">
                  <img src={p.image} alt={p.name} draggable={false} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none" />
                </div>
                <div className="text-xs sm:text-[13px] leading-normal text-slate-600 mt-2 truncate w-full group-hover:text-orange-600">{p.name}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {pages.map((_, i) => (
            <button key={i} data-testid={`${testid}-dot-${i}`} onClick={() => goTo(i)} aria-label={`第 ${i + 1} 頁`}
              className={`h-1.5 rounded-full transition-all ${i === page ? "w-6 bg-orange-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, to, icon }) {  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && <img src={icon} alt="" className="h-6 w-6 rounded-md object-cover" />}
        <h2 className="font-head text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <Link to={to} className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-orange-500">查看更多 <ChevronRight className="h-3.5 w-3.5" /></Link>
    </div>
  );
}
