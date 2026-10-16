import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Search, ShoppingCart, Headphones, ChevronDown, ChevronRight, Shield, Package, Menu, X, UserRound, Gift, Wallet, Home, LayoutGrid,
  Tv, Gamepad2, MessageCircle, Music, Smile, Mic, HeartHandshake, CreditCard, BookOpen, Rocket, Cpu } from "lucide-react";
import { SearchBox } from "@/components/SearchBox";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import CurrencySelector from "@/components/CurrencySelector";
import { openService } from "@/components/ServiceWidget";
import { useSiteConfig } from "@/lib/siteConfig";
import { AddToHomeDialog } from "@/components/AddToHomeDialog";
import { A2HSTip } from "@/components/A2HSTip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tr, LANG } from "@/i18n";
import { userLabel } from "@/lib/api";

const CAT_ICONS = {
  livestream: [Tv, "from-orange-400 to-orange-500"],
  games: [Gamepad2, "from-rose-400 to-orange-500"],
  social: [MessageCircle, "from-green-400 to-emerald-500"],
  "video-music": [Music, "from-teal-300 to-cyan-400"],
  play: [Smile, "from-rose-400 to-red-400"],
  voice: [Mic, "from-fuchsia-400 to-pink-500"],
  life: [HeartHandshake, "from-sky-300 to-blue-400"],
  pointcard: [CreditCard, "from-indigo-300 to-violet-400"],
  literary: [BookOpen, "from-amber-300 to-yellow-400"],
  accelerator: [Rocket, "from-orange-300 to-amber-400"],
  ai: [Cpu, "from-blue-400 to-indigo-500"],
};

export default function Header() {
  const cfg = useSiteConfig();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showMobileSearch = pathname === "/" || pathname.startsWith("/search");
  const { count, setOpen } = useCart();
  const { active } = useCurrency();
  const { isSignedIn, user } = useUser();
  const accountLabel = userLabel(user);
  const { openAuth } = useAuthModal();
  const callApi = useApi();
  const [categories, setCategories] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [a2hs, setA2hs] = useState(false);
  const [a2hsSrc, setA2hsSrc] = useState("drawer");
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSignedIn) return setIsAdmin(false);
    callApi({ method: "GET", url: "/me" }).then((r) => setIsAdmin(r.data.role === "admin")).catch(() => setIsAdmin(false));
  }, [isSignedIn, callApi]);

  return (
    <>
    {/* Browser: sticky. Home-screen PWA: app shell (index.css html.pwa) keeps the header outside the scroll area, window never scrolls */}
    <header className="sticky top-0 z-40 w-full bg-[#FFF4EA] shrink-0">
      <div style={{ height: "env(safe-area-inset-top)" }} />
      {/* Top promo bar */}
      {cfg.top_promo.enabled !== false && cfg.top_promo.image && (
      <a href={cfg.top_promo.link || "#"} target="_blank" rel="noreferrer" data-testid="promo-experience-btn" className="block bg-[#F7A23B]">
        <img src={cfg.top_promo.image} alt={cfg.top_promo.alt || ""} className="w-full h-auto max-h-10 md:max-h-12 object-cover md:object-contain mx-auto block" />
      </a>
      )}

      {/* Main header */}
      <div className="bg-white md:border-b border-orange-100 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-[72px] flex items-center gap-3 md:gap-5">
          {/* Mobile hamburger */}
          <button data-testid="mobile-nav-toggle" onClick={() => setMobileNav((v) => !v)} className="md:hidden -ml-1 p-1 rounded-lg text-orange-500">
            {mobileNav ? <X className="h-6 w-6" strokeWidth={2.5} /> : <Menu className="h-6 w-6" strokeWidth={2.5} />}
          </button>
          {/* Logo */}
          <Link to="/" data-testid="logo-link" className="flex flex-col items-start shrink-0 leading-none">
            <img src={cfg.logo.image} alt="gogo589" className="h-7 md:h-9 w-auto object-contain" />
            <div className="text-[10px] text-slate-400 font-medium mt-0.5 hidden sm:block">{tr("全球應用內購服務")}</div>
          </Link>

          {/* 所有服務 + search */}
          <div className="hidden md:flex flex-1 items-center gap-2 max-w-3xl">
            <button
              data-testid="all-categories-trigger"
              onClick={() => setServicesOpen((v) => !v)}
              className="flex items-center gap-1 h-11 px-3 rounded-full text-sm font-semibold text-slate-700 hover:text-orange-600 whitespace-nowrap"
            >
              {tr("所有服務")} <ChevronDown className={`h-4 w-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            <SearchBox />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 md:gap-3 ml-auto">
            {!isSignedIn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="register-promo-pill"
                    className="hidden lg:flex items-center hover:opacity-90 transition-opacity"
                  >
                    <img
                      src="https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b08198289aa5a07a_image.png"
                      alt={tr("新用戶註冊 最高領 9% 優惠券")}
                      className="h-11 w-auto object-contain"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem data-testid="promo-register" onClick={openAuth} className="cursor-pointer gap-2">
                    <Gift className="h-4 w-4 text-orange-500" /> {tr("立即註冊")}
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="promo-login" onClick={openAuth} className="cursor-pointer gap-2">
                    <UserRound className="h-4 w-4 text-slate-500" /> {tr("會員登入")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!isSignedIn ? (
              <button
                data-testid="header-signin-btn"
                onClick={openAuth}
                className="flex items-center gap-1.5 h-9 w-9 md:h-10 md:w-auto justify-center md:pl-3 md:pr-5 rounded-full text-sm font-semibold text-orange-500 bg-orange-100/60 md:bg-orange-100/70 hover:bg-orange-100 transition-colors"
              >
                <UserRound className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={1.75} /> <span className="hidden md:inline">{tr("登入")}</span>
              </button>
            ) : (
              <>
              <button data-testid="header-wallet-btn" onClick={() => navigate("/account/wallet")} title={tr("我的錢包")} className="hidden md:flex items-center gap-1.5 h-11 px-4 rounded-full bg-orange-100/70 hover:bg-orange-100 text-orange-500 text-sm font-medium transition-colors">
                <Wallet className="h-4 w-4" /><span className="hidden md:inline">{tr("我的錢包")}</span>
              </button>
              <button data-testid="header-account-btn" onClick={() => navigate("/account")} className="flex items-center gap-2 h-9 w-9 md:h-11 md:w-auto justify-center md:justify-start md:pl-1.5 md:pr-4 rounded-full bg-orange-100/70 hover:bg-orange-100 text-orange-500 transition-colors max-w-[260px]">
                <span className="h-8 w-8 rounded-full md:bg-white flex items-center justify-center shrink-0"><UserRound className="h-[18px] w-[18px] md:h-4 md:w-4 text-orange-500" strokeWidth={1.75} /></span>
                <span className="hidden md:block text-sm text-orange-500 truncate" data-testid="header-account-label">{accountLabel}</span>
              </button>
              </>
            )}

            <button data-testid="cart-trigger" onClick={() => setOpen(true)} className="relative hidden md:flex h-10 w-10 rounded-full bg-orange-100/70 hover:bg-orange-100 text-orange-500 items-center justify-center transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>

            <button data-testid="service-trigger" onClick={openService} className="flex h-9 w-9 md:h-10 md:w-10 rounded-full bg-orange-100/60 md:bg-orange-100/70 hover:bg-orange-100 text-orange-500 items-center justify-center transition-colors" title={tr("線上客服")}>
              <Headphones className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={1.75} />
            </button>

            <div className="flex items-center gap-2 md:pl-2 md:ml-1 md:border-l border-slate-200">
              <CurrencySelector variant="circle" />
              <span className="hidden md:inline text-sm text-slate-500 font-medium whitespace-nowrap">{LANG.toUpperCase()} / {active.code}</span>
            </div>
          </div>
        </div>

        {/* Mobile search bar (always visible) */}
        {showMobileSearch && (
          <div className="md:hidden px-4 pb-2.5 pt-2.5 bg-[#FFF4EA]">
            <SearchBox compact />
          </div>
        )}

        {/* 所有服務 mega menu */}
        {servicesOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setServicesOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-40 px-4">
              <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-orange-100 p-6 mt-1">
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
                  {categories.map((c) => {
                    const [Icon, bg] = CAT_ICONS[c.id] || [Tv, "from-slate-300 to-slate-400"];
                    return (
                      <button
                        key={c.id}
                        data-testid={`menu-category-${c.id}`}
                        onClick={() => { setServicesOpen(false); navigate(`/category/${c.id}`); }}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <span className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${bg} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                          <Icon className="h-7 w-7" />
                        </span>
                        <span className="text-xs font-medium text-slate-700 group-hover:text-orange-600 text-center leading-tight">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}


        {/* Mobile search + nav */}
        {mobileNav && (
          <div className="md:hidden fixed inset-0 z-50" data-testid="mobile-drawer">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[73%] max-w-[320px] bg-white rounded-r-3xl shadow-2xl overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <Link to="/" onClick={() => setMobileNav(false)} data-testid="drawer-home" className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-orange-100/80 text-orange-500 text-[15px] font-medium"><Home className="h-4 w-4" />{tr("首頁")}</Link>
                <button onClick={() => setMobileNav(false)} data-testid="drawer-close" className="h-9 w-9 rounded-full bg-orange-100/80 text-orange-500 flex items-center justify-center"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-y-7 px-4 pt-4 pb-8">
                {categories.map((c) => {
                  const [Icon, bg] = CAT_ICONS[c.id] || [Tv, "from-slate-300 to-slate-400"];
                  return (
                    <button key={c.id} data-testid={`drawer-cat-${c.id}`} onClick={() => { navigate(`/category/${c.id}`); setMobileNav(false); }} className="flex flex-col items-center gap-2.5">
                      <span className={`h-[62px] w-[62px] rounded-[18px] bg-gradient-to-br ${bg} text-white flex items-center justify-center shadow-sm`}><Icon className="h-7 w-7" strokeWidth={1.9} /></span>
                      <span className="text-[13px] text-slate-700">{c.name}</span>
                    </button>
                  );
                })}
                <button data-testid="drawer-a2hs" onClick={() => { setMobileNav(false); setA2hsSrc("drawer"); setA2hs(true); }} className="flex flex-col items-center gap-2.5">
                  <span className="h-[62px] w-[62px] rounded-[18px] bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center shadow-sm"><LayoutGrid className="h-7 w-7" strokeWidth={1.9} /></span>
                  <span className="text-[13px] text-slate-700">{tr("新增桌面")}</span>
                </button>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileNav(false)} className="flex flex-col items-center gap-2.5">
                    <span className="h-[62px] w-[62px] rounded-[18px] bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center"><Shield className="h-7 w-7" strokeWidth={1.9} /></span>
                    <span className="text-[13px] text-slate-700">{tr("管理後台")}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <A2HSTip pathname={pathname} onOpen={() => { setA2hsSrc("popup"); setA2hs(true); }} />
      {a2hs && <AddToHomeDialog source={a2hsSrc} onClose={() => setA2hs(false)} />}
    </header>
    </>
  );
}
