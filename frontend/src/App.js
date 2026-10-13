import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthenticateWithRedirectCallback, useUser } from "@clerk/react";
import { useEffect } from "react";
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
import MyAccount from "@/pages/account/MyAccount";
import MyVerify from "@/pages/account/MyVerify";
import MyCoupons from "@/pages/account/MyCoupons";
import HelpCenter from "@/pages/account/HelpCenter";
import MyWallet from "@/pages/account/MyWallet";
import WalletTopUp from "@/pages/account/WalletTopUp";
import WalletTransactions from "@/pages/account/WalletTransactions";
import Info from "@/pages/Info";
import ArticleCenter from "@/pages/ArticleCenter";
import ArticleDetail from "@/pages/ArticleDetail";
import Admin from "@/pages/Admin";

function StoreLayout() {
  return (
    <AuthModalProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
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

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <CurrencyProvider>
            <CartProvider>
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
                    <Route path="/account/verify" element={<MyVerify />} />
                    <Route path="/account/coupons" element={<MyCoupons />} />
                    <Route path="/account/help" element={<HelpCenter />} />
                  </Route>
                  <Route path="/sign-in/*" element={<AuthRedirect />} />
                  <Route path="/sign-up/*" element={<AuthRedirect />} />
                </Route>
                <Route path="/admin" element={<Admin />} />
                <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />} />
              </Routes>
            </CartProvider>
          </CurrencyProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
