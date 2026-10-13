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
  <div className="md:bg-white md:rounded-3xl md:shadow-sm md:p-8 md:min-h-[70vh]" data-testid={testId}>
    <div className="flex items-center justify-between gap-4 mb-5 md:mb-6 max-md:px-1">
      <h1 className="font-head text-xl md:text-lg font-bold md:font-semibold text-slate-900 relative inline-block whitespace-nowrap shrink-0"><span className="relative z-10">{title}</span><span className="md:hidden absolute left-0 right-0 bottom-0.5 h-2 bg-orange-200/80 rounded-sm" /></h1>
      {right}
    </div>
    {children}
  </div>
);

export const Tag = ({ children }) => <span className="inline-block rounded-md bg-slate-800 text-white text-sm px-3 py-1 max-md:absolute max-md:left-0 max-md:top-0 max-md:rounded-none max-md:rounded-tl-2xl max-md:rounded-br-xl max-md:text-[13px] max-md:px-3.5 max-md:py-1.5">{children}</span>;
export const Box = ({ children, className = "" }) => <div className={`rounded-2xl bg-slate-50 p-6 max-md:relative max-md:bg-white max-md:shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] max-md:p-4 max-md:pt-12 ${className}`}>{children}</div>;
export const OrangeBtn = ({ children, className = "", ...p }) => <button {...p} className={`h-12 px-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-60 ${className}`}>{children}</button>;
export const SubTabs = ({ tabs, value, onChange, testPrefix = "subtab" }) => (
  <div className="flex items-center gap-6 max-md:gap-2 mb-6 max-md:mb-4 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto no-scrollbar max-md:-mx-1 max-md:px-1">
    {tabs.map(([k, label]) => (
      <button key={k} data-testid={`${testPrefix}-${k}`} onClick={() => onChange(k)} className={`text-sm max-md:text-[13px] font-medium transition-colors whitespace-nowrap max-md:h-8 max-md:px-3.5 max-md:rounded-full ${value === k ? "text-orange-500 max-md:bg-orange-500 max-md:text-white" : "text-slate-600 hover:text-orange-500 max-md:bg-white max-md:shadow-sm"}`}>{label}</button>
    ))}
  </div>
);

export default function AccountLayout() {
  const { signOut } = useClerk();
  const { openAuth } = useAuthModal();
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-b from-[#FFE9D2] via-[#FFF3E6] to-[#FFF8F1] [background-image:radial-gradient(rgba(255,255,255,0.8)_1.5px,transparent_1.5px)] [background-size:18px_18px] min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8">
        <Show when="signed-out">
          <div className="bg-white rounded-3xl p-16 text-center">
            <p className="text-slate-500 mb-4">請先登入以進入會員中心</p>
            <OrangeBtn onClick={openAuth} data-testid="account-login-btn">登入 / 註冊</OrangeBtn>
          </div>
        </Show>
        <Show when="signed-in">
          <div className="flex flex-col lg:flex-row gap-5 md:gap-6 items-start">
            <aside className="w-full lg:w-60 shrink-0 bg-white rounded-2xl lg:rounded-3xl shadow-sm py-2 px-0 lg:py-6 lg:px-4 lg:min-h-[70vh]" data-testid="account-sidebar">
              <nav className="flex lg:flex-col gap-1 max-lg:gap-0 overflow-x-auto no-scrollbar w-full">
                {NAV.map(([to, label, Icon]) => (
                  <NavLink key={to} to={to} end={to === "/account"} data-testid={`account-nav-${to.replace(/\//g, "-").slice(1)}`} className={({ isActive }) => `flex max-lg:flex-col max-lg:flex-none max-lg:w-1/5 items-center gap-3 max-lg:gap-1.5 px-5 max-lg:px-0.5 py-4 max-lg:py-1.5 rounded-2xl text-base max-lg:text-[11px] whitespace-nowrap transition-colors ${isActive ? "text-orange-500 font-medium" : "text-slate-600 hover:text-orange-500"}`}>
                    <Icon className="h-5 w-5 max-lg:h-[22px] max-lg:w-[22px]" />{label}
                  </NavLink>
                ))}
                <button data-testid="account-nav-logout" onClick={() => signOut({ redirectUrl: "/" }).then(() => navigate("/"))} className="flex max-lg:flex-col max-lg:flex-none max-lg:w-1/5 items-center gap-3 max-lg:gap-1.5 px-5 max-lg:px-0.5 py-4 max-lg:py-1.5 rounded-2xl text-base max-lg:text-[11px] text-slate-600 hover:text-orange-500 whitespace-nowrap">
                  <LogOut className="h-5 w-5 max-lg:h-[22px] max-lg:w-[22px]" />登出帳戶
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
