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
import AddressHealthPage from "@/pages/AddressHealthPage";
import OperatorTrailPage from "@/pages/OperatorTrailPage";
import BalanceLedgerPage from "@/pages/BalanceLedgerPage";
import SecurityPage from "@/pages/SecurityPage";
import MerchantStatsPage from "@/pages/MerchantStatsPage";
import ProfitSnapshotsPage from "@/pages/ProfitSnapshotsPage";
import ExportJobsPage from "@/pages/ExportJobsPage";
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

function IndexRoute() {
  const { user } = useAuth();
  if (user && user.role === "merchant") return <Navigate to="/ledger" replace />;
  return <DashboardPage />;
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
              <Route index element={<IndexRoute />} />
              <Route
                path="orders"
                element={
                  <Protected roles={["admin", "agent", "operator"]}>
                    <OrdersPage />
                  </Protected>
                }
              />
              <Route
                path="channels"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <ChannelsPage />
                  </Protected>
                }
              />
              <Route path="settlements" element={<SettlementsPage />} />
              <Route
                path="ledger"
                element={
                  <Protected roles={["admin"]}>
                    <BalanceLedgerPage />
                  </Protected>
                }
              />
              <Route
                path="operators"
                element={
                  <Protected roles={["admin"]}>
                    <OperatorTrailPage />
                  </Protected>
                }
              />
              <Route
                path="merchant-stats"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <MerchantStatsPage />
                  </Protected>
                }
              />
              <Route
                path="security"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <SecurityPage />
                  </Protected>
                }
              />
              <Route
                path="addresses"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <AddressHealthPage />
                  </Protected>
                }
              />
              <Route
                path="callbacks"
                element={
                  <Protected roles={["admin", "agent", "operator"]}>
                    <CallbacksPage />
                  </Protected>
                }
              />
              <Route
                path="developer"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <ApiDocsPage />
                  </Protected>
                }
              />
              <Route
                path="profit-snapshots"
                element={
                  <Protected roles={["admin"]}>
                    <ProfitSnapshotsPage />
                  </Protected>
                }
              />
              <Route
                path="exports"
                element={
                  <Protected roles={["admin", "operator"]}>
                    <ExportJobsPage />
                  </Protected>
                }
              />
              <Route
                path="audit"
                element={
                  <Protected roles={["admin", "operator"]}>
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
