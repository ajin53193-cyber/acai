import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Headset } from "lucide-react";
import { LogoFull } from "@/components/Logo";

const NAV_ITEMS = [
  { name: "首页", path: "/", testid: "nav-home-link" },
  { name: "项目中心", path: "/projects", testid: "nav-projects-link" },
  { name: "合作共赢", path: "/cooperation", testid: "nav-cooperation-link" },
  { name: "关于我们", path: "/about", testid: "nav-about-link" },
  { name: "联系我们", path: "/contact", testid: "nav-contact-link" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header
      data-testid="site-header"
      className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/15 bg-[#0A1228]/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8 lg:px-16">
        <Link to="/" aria-label="合赢项目社首页">
          <LogoFull />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" data-testid="desktop-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={item.testid}
              className={({ isActive }) =>
                `group relative py-1 text-sm font-medium tracking-wide transition-colors duration-300 ${
                  isActive ? "text-[#FFE896]" : "text-slate-300 hover:text-[#E5C158]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.name}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-0.5 bg-gold-gradient transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
          <Link
            to="/contact"
            data-testid="nav-contact-kefu-btn"
            className="flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2 text-sm font-bold text-[#060B18] shadow-[0_0_18px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_28px_rgba(255,232,150,0.55)] active:scale-95"
          >
            <Headset size={15} />
            联系客服
          </Link>
        </nav>

        <button
          data-testid="mobile-menu-btn"
          className="rounded-lg border border-amber-500/25 p-2 text-[#E5C158] lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="打开菜单"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            data-testid="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden border-t border-amber-500/15 bg-[#0A1228]/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`mobile-${item.testid}`}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-amber-500/10 text-[#FFE896]"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                to="/contact"
                data-testid="mobile-nav-contact-kefu-btn"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-gold-gradient px-5 py-2.5 text-center text-sm font-bold text-[#060B18]"
              >
                联系客服
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};
