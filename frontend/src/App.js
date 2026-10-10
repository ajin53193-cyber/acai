import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardPage from "@/pages/DashboardPage";
import OrdersPage from "@/pages/OrdersPage";
import ChannelsPage from "@/pages/ChannelsPage";
import SettlementsPage from "@/pages/SettlementsPage";
import AccountsPage from "@/pages/AccountsPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CallbacksPage from "@/pages/CallbacksPage";
import AuditLogsPage from "@/pages/AuditLogsPage";
import ApiDocsPage from "@/pages/ApiDocsPage";
import { Loader2 } from "lucide-react";

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pay/:orderNo" element={<CheckoutPage />} />
            <Route
              path="/"
              element={
                <Protected>
                  <DashboardLayout />
                </Protected>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route
                path="channels"
                element={
                  <Protected roles={["admin"]}>
                    <ChannelsPage />
                  </Protected>
                }
              />
              <Route path="settlements" element={<SettlementsPage />} />
              <Route path="callbacks" element={<CallbacksPage />} />
              <Route
                path="api"
                element={
                  <Protected roles={["merchant"]}>
                    <ApiDocsPage />
                  </Protected>
                }
              />
              <Route
                path="audit"
                element={
                  <Protected roles={["admin"]}>
                    <AuditLogsPage />
                  </Protected>
                }
              />
              <Route
                path="accounts"
                element={
                  <Protected roles={["admin", "agent"]}>
                    <AccountsPage />
                  </Protected>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" theme="dark" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
