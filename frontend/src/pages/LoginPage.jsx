import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";

const DEMO = [
  { label: "平台管理员", email: "ajin53193@gmail.com", password: "admin888" },
  { label: "代理商", email: "agent@demo.com", password: "agent888" },
  { label: "商户", email: "merchant@demo.com", password: "merchant888" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      toast.success(`欢迎回来，${data.user.name}`);
      navigate("/");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.4)]">
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">四方收款平台</h1>
            <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">USDT AGGREGATED PAYMENT</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-7 shadow-2xl">
          <h2 className="text-lg font-semibold mb-1">登录控制台</h2>
          <p className="text-sm text-slate-400 mb-6">使用账号密码进入您的管理后台</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="login-email-input"
                className="bg-slate-900/60 border-slate-700 h-11 font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password-input"
                className="bg-slate-900/60 border-slate-700 h-11 font-mono"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>登录 <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-mono">演示账号 · 点击快速填充</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  data-testid={`demo-${d.label}`}
                  className="px-2 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
