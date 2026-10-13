import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Show, useClerk } from "@clerk/react";
import { UserRound, ClipboardList, ShieldCheck, Ticket, CircleHelp, LogOut, Wallet } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModal";

const NAV = [
  ["/account", "我的帳戶", UserRound],
  ["/account/wallet", "我的錢包", Wallet],
  ["/orders", "我的訂單", ClipboardList],
  ["/account/verify", "我的認證", ShieldCheck],
  ["/account/coupons", "我的優惠券", Ticket],
  ["/account/help", "幫助中心", CircleHelp],
];

export const Panel = ({ title, right, children, testId }) => (
  <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 min-h-[70vh]" data-testid={testId}>
    <div className="flex items-center justify-between gap-4 mb-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {right}
    </div>
    {children}
  </div>
);

export const Tag = ({ children }) => <span className="inline-block rounded-md bg-slate-800 text-white text-sm px-3 py-1">{children}</span>;
export const Box = ({ children, className = "" }) => <div className={`rounded-2xl bg-slate-50 p-6 ${className}`}>{children}</div>;
export const OrangeBtn = ({ children, className = "", ...p }) => <button {...p} className={`h-12 px-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-60 ${className}`}>{children}</button>;
export const SubTabs = ({ tabs, value, onChange, testPrefix = "subtab" }) => (
  <div className="flex items-center gap-6 mb-6 flex-wrap">
    {tabs.map(([k, label]) => (
      <button key={k} data-testid={`${testPrefix}-${k}`} onClick={() => onChange(k)} className={`text-sm font-medium transition-colors ${value === k ? "text-orange-500" : "text-slate-600 hover:text-orange-500"}`}>{label}</button>
    ))}
  </div>
);

export default function AccountLayout() {
  const { signOut } = useClerk();
  const { openAuth } = useAuthModal();
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-b from-[#FFE9D2] via-[#FFF3E6] to-[#FFF8F1] [background-image:radial-gradient(rgba(255,255,255,0.8)_1.5px,transparent_1.5px)] [background-size:18px_18px] min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Show when="signed-out">
          <div className="bg-white rounded-3xl p-16 text-center">
            <p className="text-slate-500 mb-4">請先登入以進入會員中心</p>
            <OrangeBtn onClick={openAuth} data-testid="account-login-btn">登入 / 註冊</OrangeBtn>
          </div>
        </Show>
        <Show when="signed-in">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <aside className="w-full lg:w-60 shrink-0 bg-white rounded-3xl shadow-sm py-6 px-4 lg:min-h-[70vh]" data-testid="account-sidebar">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                {NAV.map(([to, label, Icon]) => (
                  <NavLink key={to} to={to} end={to === "/account"} data-testid={`account-nav-${to.replace(/\//g, "-").slice(1)}`} className={({ isActive }) => `flex items-center gap-3 px-5 py-4 rounded-2xl text-base whitespace-nowrap transition-colors ${isActive ? "text-orange-500 font-medium" : "text-slate-600 hover:text-orange-500"}`}>
                    <Icon className="h-5 w-5" />{label}
                  </NavLink>
                ))}
                <button data-testid="account-nav-logout" onClick={() => signOut({ redirectUrl: "/" }).then(() => navigate("/"))} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-base text-slate-600 hover:text-orange-500 whitespace-nowrap">
                  <LogOut className="h-5 w-5" />登出帳戶
                </button>
              </nav>
            </aside>
            <div className="flex-1 min-w-0 w-full"><Outlet /></div>
          </div>
        </Show>
      </div>
    </div>
  );
}
