import { useCallback, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Lock, LogOut, Inbox, FolderKanban, Settings2, Newspaper, MessagesSquare, BarChart3 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { API, formatDetail } from "@/lib/api";
import InboxAdmin from "@/pages/admin/InboxAdmin";
import ProjectsAdmin from "@/pages/admin/ProjectsAdmin";
import ArticlesAdmin from "@/pages/admin/ArticlesAdmin";
import ChatAdmin from "@/pages/admin/ChatAdmin";
import SettingsAdmin from "@/pages/admin/SettingsAdmin";
import StatsAdmin from "@/pages/admin/StatsAdmin";

const TOKEN_KEY = "hy_admin_token";

const TABS = [
  { key: "inbox", name: "留言管理", icon: Inbox, testid: "admin-tab-inbox" },
  { key: "projects", name: "项目管理", icon: FolderKanban, testid: "admin-tab-projects" },
  { key: "articles", name: "新闻管理", icon: Newspaper, testid: "admin-tab-articles" },
  { key: "chat", name: "在线客服", icon: MessagesSquare, testid: "admin-tab-chat" },
  { key: "stats", name: "访问统计", icon: BarChart3, testid: "admin-tab-stats" },
  { key: "settings", name: "站点设置", icon: Settings2, testid: "admin-tab-settings" },
];

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("inbox");

  const onUnauthorized = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    toast.error("登录已过期，请重新登录");
  }, []);

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/admin/login`, { username, password });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      toast.success("登录成功");
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  if (!token) {
    return (
      <main className="grid-texture flex min-h-screen items-center justify-center px-4" data-testid="admin-login-page">
        <form onSubmit={login} className="glass-card w-full max-w-sm rounded-3xl p-9" data-testid="admin-login-form">
          <div className="mb-8 flex flex-col items-center">
            <LogoMark size={52} />
            <h1 className="mt-4 font-display text-xl font-bold text-gold-gradient">管理后台</h1>
            <p className="mt-1 text-xs tracking-widest text-slate-500">HEYING PROJECT CLUB ADMIN</p>
          </div>
          <label className="mb-2 block text-xs tracking-widest text-slate-400">用户名</label>
          <input
            data-testid="admin-username-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            className="mb-5 w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60"
          />
          <label className="mb-2 block text-xs tracking-widest text-slate-400">密码</label>
          <input
            data-testid="admin-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            className="mb-7 w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60"
          />
          <button
            type="submit"
            data-testid="admin-login-btn"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,232,150,0.55)] active:scale-[0.98]"
          >
            <Lock size={15} /> 登录后台
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-14 sm:px-8" data-testid="admin-dashboard">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-gold-gradient">管理后台</h1>
        <button
          data-testid="admin-logout-btn"
          onClick={logout}
          className="flex items-center gap-2 rounded-full border border-red-500/30 px-5 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
        >
          <LogOut size={15} /> 退出
        </button>
      </div>

      <div className="mb-8 flex flex-wrap gap-2" data-testid="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={t.testid}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
              tab === t.key
                ? "bg-gold-gradient text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.4)]"
                : "border border-amber-500/20 text-slate-300 hover:border-[#D4AF37]/60 hover:text-[#FFE896]"
            }`}
          >
            <t.icon size={15} /> {t.name}
          </button>
        ))}
      </div>

      {tab === "inbox" && <InboxAdmin token={token} onUnauthorized={onUnauthorized} />}
      {tab === "projects" && <ProjectsAdmin token={token} onUnauthorized={onUnauthorized} />}
      {tab === "articles" && <ArticlesAdmin token={token} onUnauthorized={onUnauthorized} />}
      {tab === "chat" && <ChatAdmin token={token} onUnauthorized={onUnauthorized} />}
      {tab === "stats" && <StatsAdmin token={token} onUnauthorized={onUnauthorized} />}
      {tab === "settings" && <SettingsAdmin token={token} onUnauthorized={onUnauthorized} />}
    </main>
  );
}
