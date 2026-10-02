import { Link, useLocation } from "react-router-dom";
import { Home, LayoutGrid, Handshake, User, Headset } from "lucide-react";

const TABS = [
  { name: "首页", path: "/", icon: Home, testid: "tab-home" },
  { name: "项目", path: "/projects", icon: LayoutGrid, testid: "tab-projects" },
  { name: "合作", path: "/cooperation", icon: Handshake, testid: "tab-cooperation" },
  { name: "我的", path: "/about", icon: User, testid: "tab-mine" },
];

export const MobileTabBar = () => {
  const { pathname } = useLocation();

  return (
    <nav
      data-testid="mobile-tab-bar"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-500/20 bg-[#0A1228]/90 backdrop-blur-xl lg:hidden"
    >
      <div className="flex items-stretch justify-between px-2 py-2">
        <div className="flex flex-1 items-center justify-around">
          {TABS.map((tab) => {
            const active = pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                data-testid={tab.testid}
                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 transition-colors duration-300 ${
                  active ? "text-[#FFE896]" : "text-slate-400"
                }`}
              >
                <tab.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium">{tab.name}</span>
                <span
                  className={`absolute -bottom-0.5 h-0.5 rounded-full bg-gold-gradient transition-all duration-300 ${
                    active ? "w-6" : "w-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>
        <Link
          to="/contact"
          data-testid="tab-contact-kefu-btn"
          className="ml-2 flex shrink-0 items-center gap-1.5 self-center rounded-full bg-gold-gradient px-4 py-2.5 text-xs font-bold text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.4)] active:scale-95"
        >
          <Headset size={14} />
          {pathname === "/cooperation" ? "合作咨询" : "联系客服"}
        </Link>
      </div>
    </nav>
  );
};
