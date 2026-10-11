import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Headphones, RefreshCw, ArrowRight, Inbox, CheckCircle2, Users } from "lucide-react";

export default function SupportHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(false);

  const load = useCallback(() => {
    api.get("/support/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/support/seats").then((r) => {
      const me = (r.data || []).find((s) => s.id === user.id);
      setOnline(me ? me.online : true);
    }).catch(() => {});
  }, [user.id]);

  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);

  const cards = [
    { k: "mine", label: "分配给我的待处理", value: stats?.mine_open ?? 0, icon: Headphones, color: "text-cyan-400" },
    { k: "open", label: "全部待处理", value: stats?.open ?? 0, icon: Inbox, color: "text-amber-400" },
    { k: "resolved", label: "已解决", value: stats?.resolved ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
    { k: "online", label: "在线坐席", value: stats?.online ?? 0, icon: Users, color: "text-indigo-400" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8" data-testid="support-home">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-500"}`} data-testid="home-online-dot" />
            坐席工作台
          </h1>
          <p className="text-sm text-slate-400 mt-1">你好，{user.name} · {online ? "当前在线接单中" : "当前离线"}</p>
        </div>
        <button onClick={load} data-testid="home-refresh" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400">
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="home-stats">
        {cards.map((c) => (
          <div key={c.k} className="glass rounded-2xl p-5" data-testid={`home-stat-${c.k}`}>
            <div className="flex items-center gap-2 text-xs text-slate-400"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
            <div className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="home-quick-links">
        <button onClick={() => navigate("/support")} data-testid="home-go-support"
          className="glass rounded-2xl p-6 text-left hover:border-cyan-500/40 border border-transparent transition-colors group">
          <div className="flex items-center justify-between">
            <MessageSquare className="w-7 h-7 text-cyan-400" />
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          <div className="mt-3 font-semibold text-slate-100">进入在线客服</div>
          <div className="text-xs text-slate-400 mt-1">查看并回复所有访客会话</div>
        </button>
        <button onClick={() => navigate("/support?mine=1")} data-testid="home-go-mine"
          className="glass rounded-2xl p-6 text-left hover:border-cyan-500/40 border border-transparent transition-colors group">
          <div className="flex items-center justify-between">
            <Headphones className="w-7 h-7 text-emerald-400" />
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <div className="mt-3 font-semibold text-slate-100">我负责的会话</div>
          <div className="text-xs text-slate-400 mt-1">{stats?.mine_open ?? 0} 条待处理，优先跟进</div>
        </button>
      </div>
    </div>
  );
}
