import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Lock, LogOut, Inbox, RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/Logo";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "hy_admin_token";
const STATUSES = ["待跟进", "跟进中", "已完成"];

const formatDetail = (detail) => {
  if (!detail) return "操作失败，请稍后重试";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || "").filter(Boolean).join("；");
  return String(detail);
};

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (t = token) => {
      if (!t) return;
      setLoading(true);
      try {
        const res = await axios.get(`${API}/admin/inquiries`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        setInquiries(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          toast.error("登录已过期，请重新登录");
        } else {
          toast.error("加载留言失败");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

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

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(
        `${API}/admin/inquiries/${id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInquiries((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
      toast.success("状态已更新");
    } catch {
      toast.error("更新失败");
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  if (!token) {
    return (
      <main className="grid-texture flex min-h-screen items-center justify-center px-4 pt-20" data-testid="admin-login-page">
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
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-32 sm:px-8" data-testid="admin-inbox-page">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-2xl font-bold text-gold-gradient">
            <Inbox size={24} /> 留言管理
          </h1>
          <p className="mt-1 text-sm text-slate-500" data-testid="admin-inbox-count">共 {inquiries.length} 条咨询留言</p>
        </div>
        <div className="flex gap-3">
          <button
            data-testid="admin-refresh-btn"
            onClick={() => load()}
            className="flex items-center gap-2 rounded-full border border-amber-500/25 px-5 py-2.5 text-sm text-[#E5C158] transition-colors hover:bg-amber-500/10"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> 刷新
          </button>
          <button
            data-testid="admin-logout-btn"
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-red-500/30 px-5 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
          >
            <LogOut size={15} /> 退出
          </button>
        </div>
      </div>

      {inquiries.length === 0 && !loading ? (
        <div className="glass-card rounded-3xl py-20 text-center text-sm text-slate-500" data-testid="admin-inbox-empty">
          暂无留言，访客提交咨询后将显示在这里
        </div>
      ) : (
        <div className="space-y-5" data-testid="admin-inbox-list">
          {inquiries.map((q, i) => (
            <div key={q.id} className="glass-card rounded-2xl p-6" data-testid={`admin-inquiry-${i}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-lg font-bold text-slate-50">{q.name}</span>
                    <span className="rounded-full border border-amber-500/30 px-3 py-0.5 text-xs text-[#E5C158]">{q.inquiry_type}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {q.phone} {q.city ? `· ${q.city}` : ""} · {new Date(q.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                <select
                  data-testid={`admin-inquiry-status-${i}`}
                  value={q.status}
                  onChange={(e) => updateStatus(q.id, e.target.value)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium outline-none ${
                    q.status === "已完成"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : q.status === "跟进中"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-amber-500/40 bg-amber-500/10 text-[#E5C158]"
                  }`}
                >
                  {STATUSES.map((s) => <option key={s} value={s} className="bg-[#0A1228]">{s}</option>)}
                </select>
              </div>
              <p className="mt-4 rounded-xl border border-amber-500/10 bg-[#060B18]/60 p-4 text-sm leading-relaxed text-slate-300">
                {q.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
