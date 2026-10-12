import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { SignIn, SignUp, AuthenticateWithRedirectCallback } from "@clerk/react";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { AuthModalProvider } from "@/components/auth/AuthModal";
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

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center px-4 py-10">
      {children}
    </div>
  );
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
                  <Route path="/orders" element={<MyOrders />} />
                  <Route path="/info/:slug" element={<Info />} />
                  <Route path="/article" element={<ArticleCenter />} />
                  <Route path="/article/:id" element={<ArticleDetail />} />
                </Route>
                <Route path="/admin" element={<Admin />} />
                <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />} />
                <Route path="/sign-in/*" element={<AuthLayout><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthLayout>} />
                <Route path="/sign-up/*" element={<AuthLayout><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthLayout>} />
              </Routes>
            </CartProvider>
          </CurrencyProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
