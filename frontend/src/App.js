import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { scrollPageTo } from "@/lib/scroller";
import { AuthenticateWithRedirectCallback, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { AuthModalProvider, useAuthModal } from "@/components/auth/AuthModal";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { CartProvider } from "@/context/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ServiceWidget from "@/components/ServiceWidget";
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import MyOrders from "@/pages/MyOrders";
import AccountLayout from "@/pages/account/AccountLayout";
import UsdtPay from "@/pages/UsdtPay";
import MyAccount from "@/pages/account/MyAccount";
import MyVerify from "@/pages/account/MyVerify";
import MyCoupons from "@/pages/account/MyCoupons";
import HelpCenter from "@/pages/account/HelpCenter";
import ChatHistory from "@/pages/account/ChatHistory";
import MyWallet from "@/pages/account/MyWallet";
import WalletTopUp from "@/pages/account/WalletTopUp";
import WalletTransactions from "@/pages/account/WalletTransactions";
import WalletTopups from "@/pages/account/WalletTopups";
import GoogleCallback from "@/pages/GoogleCallback";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/NotFound";
import { ADMIN_BASE, ADMIN_LOGIN, isAdminPath } from "@/lib/adminPath";
import Info from "@/pages/Info";
import ArticleCenter from "@/pages/ArticleCenter";
import ArticleDetail from "@/pages/ArticleDetail";
import Admin from "@/pages/Admin";

if (typeof window !== "undefined" && "scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

function StoreLayout() {
  const { pathname } = useLocation();
  useEffect(() => { scrollPageTo({ top: 0 }); }, [pathname]);
  const hideFooterOnMobile = ["/product/", "/checkout", "/account", "/orders", "/article", "/info"].some((p) => pathname.startsWith(p));
  return (
    <AuthModalProvider>
      <div className="min-h-screen flex flex-col site-bg" style={{ "--site-bg-pc": "url(/kavip-bg-pc.png)", "--site-bg-m": "url(/kavip-bg-m.png)" }}>
        <Header />
        <div id="site-scroll" className="flex-1 flex flex-col">
          <main className="flex-1">
            <Outlet />
          </main>
          <div className={hideFooterOnMobile ? "max-md:hidden" : ""}><Footer /></div>
        </div>
        <CartDrawer />
        <ServiceWidget />
      </div>
    </AuthModalProvider>
  );
}

function AuthRedirect() {
  const navigate = useNavigate();
  const { openAuth } = useAuthModal();
  const { isLoaded, isSignedIn } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    navigate("/", { replace: true });
    if (!isSignedIn) openAuth();
  }, [isLoaded, isSignedIn, navigate, openAuth]);
  return null;
}

function GeoGate({ children }) {
  const { pathname } = useLocation();
  const [state, setState] = useState("checking");
  useEffect(() => {
    const scope = isAdminPath(pathname) ? "admin" : "store";
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/geo/guard?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => setState(!d.enforce || d.allowed ? "ok" : "blocked"))
      .catch(() => setState("ok"));
  }, [pathname]);
  if (state === "checking") return null;
  if (state === "blocked") return <NotFound />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <CurrencyProvider>
            <CartProvider>
              <GeoGate>
              <Routes>
                <Route element={<StoreLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/category/:id" element={<Category />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/info/:slug" element={<Info />} />
                  <Route path="/article" element={<ArticleCenter />} />
                  <Route path="/article/:id" element={<ArticleDetail />} />
                  <Route element={<AccountLayout />}>
                    <Route path="/account" element={<MyAccount />} />
                    <Route path="/orders" element={<MyOrders />} />
                    <Route path="/account/wallet" element={<MyWallet />} />
                    <Route path="/account/wallet/topup" element={<WalletTopUp />} />
                    <Route path="/account/wallet/transactions" element={<WalletTransactions />} />
                    <Route path="/account/wallet/topups" element={<WalletTopups />} />
                    <Route path="/account/verify" element={<MyVerify />} />
                    <Route path="/account/coupons" element={<MyCoupons />} />
                    <Route path="/account/help" element={<HelpCenter />} />
                    <Route path="/account/chat" element={<ChatHistory />} />
                  </Route>
                  <Route path="/sign-in/*" element={<AuthRedirect />} />
                  <Route path="/sign-up/*" element={<AuthRedirect />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/pay/usdt/:tid" element={<UsdtPay />} />
                <Route path={ADMIN_LOGIN} element={<AdminLogin />} />
                <Route path={ADMIN_BASE} element={<Admin />} />
                <Route path="/auth/google" element={<GoogleCallback />} />
                <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />} />
              </Routes>
              </GeoGate>
            </CartProvider>
          </CurrencyProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
