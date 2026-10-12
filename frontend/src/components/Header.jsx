import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Show, SignInButton, UserButton, useUser } from "@clerk/react";
import { Search, ShoppingCart, Headphones, ChevronDown, Shield, Package, Menu, X, UserRound, Gift } from "lucide-react";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import CurrencySelector from "@/components/CurrencySelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const navigate = useNavigate();
  const { count, setOpen } = useCart();
  const { isSignedIn } = useUser();
  const callApi = useApi();
  const [categories, setCategories] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSignedIn) return setIsAdmin(false);
    callApi({ method: "GET", url: "/me" }).then((r) => setIsAdmin(r.data.role === "admin")).catch(() => setIsAdmin(false));
  }, [isSignedIn, callApi]);

  const doSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/category/all?q=${encodeURIComponent(query.trim())}`);
  };

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
      <div className="bg-white border-b border-orange-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-[72px] flex items-center gap-3 md:gap-5">
          {/* Logo */}
          <Link to="/" data-testid="logo-link" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-black font-head text-lg shadow">G</div>
            <div className="leading-tight">
              <div className="font-head font-extrabold text-xl tracking-tight text-orange-600">GlobalTopUp</div>
              <div className="text-[10px] text-slate-400 font-medium hidden sm:block">全球應用內購服務</div>
            </div>
          </Link>

          {/* 所有服務 + search */}
          <div className="hidden md:flex flex-1 items-center gap-2 max-w-3xl">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="all-categories-trigger" className="flex items-center gap-1 h-11 px-3 rounded-full text-sm font-semibold text-slate-700 hover:text-orange-600 whitespace-nowrap">
                  所有服務 <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {categories.map((c) => (
                  <DropdownMenuItem key={c.id} data-testid={`menu-category-${c.id}`} onClick={() => navigate(`/category/${c.id}`)} className="gap-2 cursor-pointer">
                    {c.image && <img src={c.image} alt="" className="h-5 w-5 rounded object-cover" />}
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <form onSubmit={doSearch} className="flex-1 relative">
              <input
                data-testid="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="請輸入需搜尋的商品名"
                className="w-full h-11 rounded-full border-2 border-orange-200 bg-orange-50/40 pl-5 pr-14 text-sm outline-none focus:border-orange-400 focus:bg-white transition-colors"
              />
              <button data-testid="search-submit" className="absolute right-1 top-1 h-9 w-11 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white">
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            {!isSignedIn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="register-promo-pill"
                    className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 rounded-full pl-3 pr-4 py-1.5 text-xs font-bold border border-orange-200 hover:shadow-sm transition-shadow"
                  >
                    <Gift className="h-4 w-4" />
                    <span className="leading-tight text-left">新用戶註冊<br />最高領 9% 優惠券</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem data-testid="promo-register" onClick={() => navigate("/sign-up")} className="cursor-pointer gap-2">
                    <Gift className="h-4 w-4 text-orange-500" /> 立即註冊
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="promo-login" onClick={() => navigate("/sign-in")} className="cursor-pointer gap-2">
                    <UserRound className="h-4 w-4 text-slate-500" /> 會員登入
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!isSignedIn ? (
              <button
                data-testid="header-signin-btn"
                onClick={() => navigate("/sign-in")}
                className="flex items-center gap-1 h-10 px-3 rounded-full text-sm font-semibold text-slate-700 hover:text-orange-600"
              >
                <UserRound className="h-5 w-5" /> <span className="hidden sm:inline">登入</span>
              </button>
            ) : (
              <>
                <Link to="/orders" data-testid="my-orders-link" className="hidden sm:flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 px-1">
                  <Package className="h-5 w-5" />
                </Link>
                {isAdmin && (
                  <Link to="/admin" data-testid="admin-entry-link" className="hidden sm:flex items-center text-orange-600 px-1">
                    <Shield className="h-5 w-5" />
                  </Link>
                )}
                <UserButton />
              </>
            )}

            <button data-testid="cart-trigger" onClick={() => setOpen(true)} className="relative p-2 rounded-lg hover:bg-orange-50 text-slate-700">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>

            <button className="hidden sm:flex p-2 rounded-lg hover:bg-orange-50 text-slate-700" title="線上客服">
              <Headphones className="h-5 w-5" />
            </button>

            <div className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-2">
              <CurrencySelector />
              <span className="text-xs text-slate-500 font-medium">ZH-TW</span>
            </div>

            <button data-testid="mobile-nav-toggle" onClick={() => setMobileNav((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-orange-50 text-slate-700">
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search + nav */}
        {mobileNav && (
          <div className="md:hidden border-t border-orange-100 bg-white px-4 py-3 space-y-3">
            <form onSubmit={doSearch} className="relative">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="請輸入需搜尋的商品名" className="w-full h-10 rounded-full border-2 border-orange-200 bg-orange-50/40 pl-4 pr-10 text-sm outline-none" />
              <button className="absolute right-1 top-1 h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white"><Search className="h-4 w-4" /></button>
            </form>
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
