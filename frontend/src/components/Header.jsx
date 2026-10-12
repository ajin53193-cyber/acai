import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Show, SignInButton, UserButton, useUser } from "@clerk/react";
import { Search, ShoppingCart, Package, Shield, Menu, X } from "lucide-react";
import { publicApi, useApi } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import CurrencySelector from "@/components/CurrencySelector";

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
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }
    callApi({ method: "GET", url: "/me" })
      .then((r) => setIsAdmin(r.data.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [isSignedIn, callApi]);

  const doSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/category/all?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Top utility bar */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-9 text-xs">
          <span className="hidden sm:flex items-center gap-1.5 text-white/70">
            <Shield className="h-3.5 w-3.5 text-emerald-400" /> 官方授權 · 24H 人工極速發貨
          </span>
          <span className="sm:hidden text-white/70">24H 極速發貨</span>
          <div className="flex items-center gap-1">
            <CurrencySelector dark />
            <span className="text-white/60 text-xs px-2 border-l border-white/15">繁體中文</span>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link to="/" data-testid="logo-link" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-white font-black font-head text-lg shadow-md">
              G
            </div>
            <div className="leading-none">
              <div className="font-head font-extrabold text-lg tracking-tight text-slate-900">
                GlobalTopUp
              </div>
              <div className="text-[10px] text-slate-400 font-medium">環球充值</div>
            </div>
          </Link>

          <form onSubmit={doSearch} className="hidden md:flex flex-1 max-w-md relative">
            <input
              data-testid="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋商品，如 抖音、原神、Netflix…"
              className="w-full h-10 rounded-full border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
            />
            <button data-testid="search-submit" className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
              <Search className="h-4 w-4" />
            </button>
          </form>

          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600">
            {categories.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.id}`}
                data-testid={`nav-category-${c.id}`}
                className="px-2.5 py-2 rounded-lg hover:bg-slate-100 hover:text-primary transition-colors whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 ml-auto">
            {isAdmin && (
              <Link
                to="/admin"
                data-testid="admin-entry-link"
                className="hidden sm:flex items-center gap-1 text-xs font-semibold text-secondary hover:bg-orange-50 px-2.5 py-2 rounded-lg"
              >
                <Shield className="h-4 w-4" /> 後台
              </Link>
            )}
            <Link
              to="/orders"
              data-testid="my-orders-link"
              className="hidden sm:flex items-center gap-1 text-sm text-slate-600 hover:text-primary px-2.5 py-2 rounded-lg hover:bg-slate-100"
            >
              <Package className="h-4 w-4" /> <span className="hidden md:inline">我的訂單</span>
            </Link>
            <button
              data-testid="cart-trigger"
              onClick={() => setOpen(true)}
              className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-700"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span
                  data-testid="cart-count"
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {count}
                </span>
              )}
            </button>

            <div className="ml-1">
              <Show when="signed-out">
                <SignInButton>
                  <button
                    data-testid="header-signin-btn"
                    className="h-9 px-4 rounded-full bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    登入
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>

            <button
              data-testid="mobile-nav-toggle"
              onClick={() => setMobileNav((v) => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700"
            >
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile category row */}
        <div className="lg:hidden border-t border-slate-100">
          <div className="flex overflow-x-auto no-scrollbar gap-1 px-4 py-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.id}`}
                data-testid={`mobile-nav-category-${c.id}`}
                className="whitespace-nowrap text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-3 py-1.5"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        {mobileNav && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-2">
            <form onSubmit={doSearch} className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋商品…"
                className="w-full h-10 rounded-full border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm outline-none"
              />
              <button className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                <Search className="h-4 w-4" />
              </button>
            </form>
            <Link to="/orders" onClick={() => setMobileNav(false)} className="block py-2 text-sm text-slate-700">我的訂單</Link>
            {isAdmin && <Link to="/admin" onClick={() => setMobileNav(false)} className="block py-2 text-sm text-secondary font-semibold">管理後台</Link>}
          </div>
        )}
      </div>
    </header>
  );
}
