import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Search, ShoppingCart, Headphones, ChevronDown, Shield, Package, Menu, X, UserRound, Gift, Wallet,
  Tv, Gamepad2, MessageCircle, Music, Smile, Mic, HeartHandshake, CreditCard, BookOpen, Rocket, Cpu } from "lucide-react";
import { SearchBox } from "@/components/SearchBox";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import CurrencySelector from "@/components/CurrencySelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();
  const { count, setOpen } = useCart();
  const { active } = useCurrency();
  const { isSignedIn, user } = useUser();
  const accountLabel = user?.primaryEmailAddress?.emailAddress || user?.primaryPhoneNumber?.phoneNumber || user?.username || user?.fullName || "會員";
  const { openAuth } = useAuthModal();
  const callApi = useApi();
  const [categories, setCategories] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSignedIn) return setIsAdmin(false);
    callApi({ method: "GET", url: "/me" }).then((r) => setIsAdmin(r.data.role === "admin")).catch(() => setIsAdmin(false));
  }, [isSignedIn, callApi]);

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Top promo bar */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-center gap-3 text-xs sm:text-sm">
          <span className="font-semibold">⚡ 最強 AI 充值 免費試用，價格超實惠</span>
          <Link to="/category/ai" data-testid="promo-experience-btn" className="bg-white/25 hover:bg-white/35 transition-colors rounded-full px-3 py-0.5 text-xs font-bold">
            立即體驗
          </Link>
        </div>
      </div>

      {/* Main header */}
      <div className="bg-white border-b border-orange-100 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-[72px] flex items-center gap-3 md:gap-5">
          {/* Logo */}
          <Link to="/" data-testid="logo-link" className="flex flex-col items-start shrink-0 leading-none">
            <img src="/gogo589-logo.png" alt="gogo589" className="h-8 md:h-9 w-auto object-contain" />
            <div className="text-[10px] text-slate-400 font-medium mt-0.5 hidden sm:block">全球應用內購服務</div>
          </Link>

          {/* 所有服務 + search */}
          <div className="hidden md:flex flex-1 items-center gap-2 max-w-3xl">
            <button
              data-testid="all-categories-trigger"
              onClick={() => setServicesOpen((v) => !v)}
              className="flex items-center gap-1 h-11 px-3 rounded-full text-sm font-semibold text-slate-700 hover:text-orange-600 whitespace-nowrap"
            >
              所有服務 <ChevronDown className={`h-4 w-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            <SearchBox />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            {!isSignedIn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="register-promo-pill"
                    className="hidden lg:flex items-center hover:opacity-90 transition-opacity"
                  >
                    <img
                      src="https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b08198289aa5a07a_image.png"
                      alt="新用戶註冊 最高領 9% 優惠券"
                      className="h-11 w-auto object-contain"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem data-testid="promo-register" onClick={openAuth} className="cursor-pointer gap-2">
                    <Gift className="h-4 w-4 text-orange-500" /> 立即註冊
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="promo-login" onClick={openAuth} className="cursor-pointer gap-2">
                    <UserRound className="h-4 w-4 text-slate-500" /> 會員登入
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!isSignedIn ? (
              <button
                data-testid="header-signin-btn"
                onClick={openAuth}
                className="flex items-center gap-1.5 h-10 pl-3 pr-5 rounded-full text-sm font-semibold text-orange-500 bg-orange-100/70 hover:bg-orange-100 transition-colors"
              >
                <UserRound className="h-5 w-5" /> <span className="hidden sm:inline">登入</span>
              </button>
            ) : (
              <>
              <button data-testid="header-wallet-btn" onClick={() => navigate("/account/wallet")} title="錢包充值" className="flex items-center gap-1.5 h-11 px-3 rounded-full bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors">
                <Wallet className="h-4 w-4" /><span className="hidden md:inline">錢包</span><span className="hidden lg:inline">· 充值</span>
              </button>
              <button data-testid="header-account-btn" onClick={() => navigate("/account")} className="flex items-center gap-2 h-11 pl-1.5 pr-4 rounded-full bg-orange-100/70 hover:bg-orange-100 transition-colors max-w-[260px]">
                <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center shrink-0"><UserRound className="h-4 w-4 text-orange-500" /></span>
                <span className="hidden sm:block text-sm text-orange-500 truncate" data-testid="header-account-label">{accountLabel}</span>
              </button>
              </>
            )}

            <button data-testid="cart-trigger" onClick={() => setOpen(true)} className="relative h-10 w-10 rounded-full bg-orange-100/70 hover:bg-orange-100 text-orange-500 flex items-center justify-center transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>

            <button data-testid="service-trigger" className="hidden sm:flex h-10 w-10 rounded-full bg-orange-100/70 hover:bg-orange-100 text-orange-500 items-center justify-center transition-colors" title="線上客服">
              <Headphones className="h-5 w-5" />
            </button>

            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
              <CurrencySelector variant="circle" />
              <span className="text-sm text-slate-500 font-medium whitespace-nowrap">ZH-TW / {active.code}</span>
            </div>

            <button data-testid="mobile-nav-toggle" onClick={() => setMobileNav((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-orange-50 text-slate-700">
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

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
          <div className="md:hidden border-t border-orange-100 bg-white px-4 py-3 space-y-3">
            <SearchBox compact />
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <button key={c.id} onClick={() => { navigate(`/category/${c.id}`); setMobileNav(false); }} className="flex items-center gap-2 text-sm text-slate-700 bg-orange-50 rounded-lg px-3 py-2">
                  {c.image && <img src={c.image} alt="" className="h-5 w-5 rounded object-cover" />} {c.name}
                </button>
              ))}
            </div>
            <Link to="/orders" onClick={() => setMobileNav(false)} className="block py-2 text-sm text-slate-700">我的訂單</Link>
            {isAdmin && <Link to="/admin" onClick={() => setMobileNav(false)} className="block py-2 text-sm text-orange-600 font-semibold">管理後台</Link>}
          </div>
        )}
      </div>
    </header>
  );
}
