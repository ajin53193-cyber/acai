import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS, fmtUSDT } from "@/lib/format";
import {
  LayoutDashboard, Receipt, Network, Wallet, Users, LogOut, ShieldCheck,
  Activity, ChevronRight, Menu, X, Webhook, ScrollText, Code2, HeartPulse,
  ArrowLeftRight, UserCog, Fingerprint, BarChart3,
} from "lucide-react";
import { PaymentAlerts } from "@/components/PaymentAlerts";
import { AlertBell } from "@/components/AlertBell";

const NAV = [
  { to: "/", label: "数据总览", icon: LayoutDashboard, roles: ["admin", "agent", "operator"], perm: "orders.view", end: true },
  { to: "/orders", label: "订单与收款", icon: Receipt, roles: ["admin", "agent", "operator"], perm: "orders.view" },
  { to: "/channels", label: "通道路由", icon: Network, roles: ["admin", "operator"], perm: "channels.manage" },
  { to: "/addresses", label: "收款地址", icon: HeartPulse, roles: ["admin", "operator"], perm: "channels.manage" },
  { to: "/settlements", label: "结算分润", icon: Wallet, roles: ["admin", "agent", "merchant", "operator"], perm: "payouts.review" },
  { to: "/ledger", label: "资金流水", icon: ArrowLeftRight, roles: ["admin", "agent", "merchant"] },
  { to: "/accounts", label: "账户权限", icon: Users, roles: ["admin", "agent", "operator"], perm: "accounts.view" },
  { to: "/merchant-stats", label: "商户统计", icon: BarChart3, roles: ["admin", "operator"], perm: "orders.view" },
  { to: "/callbacks", label: "回调通知", icon: Webhook, roles: ["admin", "agent", "operator"], perm: "callbacks.retry" },
  { to: "/api", label: "开发者 API", icon: Code2, roles: ["merchant"] },
  { to: "/audit", label: "审计日志", icon: ScrollText, roles: ["admin", "operator"], perm: "audit.view" },
  { to: "/operators", label: "操作员留痕", icon: UserCog, roles: ["admin"] },
];

export const hasPerm = (user, perm) => user.role === "admin" || (user.role === "operator" && (user.permissions || []).includes(perm));

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user.role) && (user.role !== "operator" || (user.permissions || []).includes(n.perm)));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background grain">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-40 h-screen w-[240px] shrink-0 flex flex-col border-r border-slate-800 bg-[#0B1120] transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="sidebar"
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <ShieldCheck className="w-5 h-5 text-slate-950" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">四方收款</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">USDT PAYMENT</div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              data-testid={`nav-${item.to === "/" ? "dashboard" : item.to.slice(1)}-link`}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-cyan-400">
              {user.name?.[0] || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500">{ROLE_LABELS[user.role]}</div>
            </div>
            {(user.role === "admin" || user.role === "operator") && (
              <NavLink
                to="/security"
                onClick={() => setOpen(false)}
                data-testid="nav-security-link"
                title="安全设置 / 两步验证"
                className={({ isActive }) => `p-2 rounded-md transition-colors relative ${isActive ? "text-cyan-400 bg-cyan-400/10" : "text-slate-500 hover:text-cyan-400 hover:bg-slate-700"}`}
              >
                <Fingerprint className="w-[18px] h-[18px]" />
                {user.totp_required && !user.totp_enabled && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </NavLink>
            )}
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 flex items-center gap-4 px-4 md:px-6 border-b border-slate-800 bg-[#0B1120] shadow-sm shadow-black/40">
          <button className="lg:hidden p-2 text-slate-400" onClick={() => setOpen(!open)} data-testid="menu-toggle">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400 pulse-dot" />
            <span>节点在线</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400">TRC20 32ms</span>
            <span className="text-sky-400">ERC20 88ms</span>
            <span className="text-amber-400">BEP20 45ms</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {user?.role === "admin" && <AlertBell />}
            <PaymentAlerts />
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60">
              <span className="text-[11px] text-slate-400">余额</span>
              <span className="font-mono text-sm font-semibold text-emerald-400" data-testid="header-balance">
                {fmtUSDT(user.balance)}
              </span>
              <span className="text-[11px] text-slate-500">USDT</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-[11px] font-medium text-cyan-400">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
