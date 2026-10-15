import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import "@/lib/iosViewportFix";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        offset={{ top: "calc(env(safe-area-inset-top) + 72px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 64px)", left: 16, right: 16 }}
        duration={2600}
        icons={{
          success: <span className="gt-toast-icon gt-toast-icon-success"><CheckCircle2 size={16} strokeWidth={2.5} /></span>,
          error: <span className="gt-toast-icon gt-toast-icon-error"><XCircle size={16} strokeWidth={2.5} /></span>,
          info: <span className="gt-toast-icon gt-toast-icon-info"><Info size={16} strokeWidth={2.5} /></span>,
          warning: <span className="gt-toast-icon gt-toast-icon-warn"><AlertTriangle size={16} strokeWidth={2.5} /></span>,
        }}
        toastOptions={{ unstyled: true, classNames: { toast: "gt-toast", title: "gt-toast-title", description: "gt-toast-desc" } }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
