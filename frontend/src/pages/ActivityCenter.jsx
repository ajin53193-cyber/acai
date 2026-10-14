import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Gift, Package, Percent, Users, Wallet, Sparkles, ChevronRight, Ticket, Star, Flame, Crown, Coins } from "lucide-react";
import { publicApi } from "@/lib/api";
import { ArticleCard } from "@/pages/ArticleCenter";
import { tr } from "@/i18n";

const ICONS = { Zap, Gift, Package, Percent, Users, Wallet, Sparkles, Ticket, Star, Flame, Crown, Coins };
const GRADS = {
  rose: "from-rose-500 to-orange-400", orange: "from-orange-500 to-amber-400", violet: "from-violet-500 to-fuchsia-400",
  emerald: "from-emerald-500 to-teal-400", sky: "from-sky-500 to-blue-400", pink: "from-pink-500 to-rose-400",
  amber: "from-amber-500 to-yellow-400", teal: "from-teal-500 to-cyan-400", blue: "from-blue-500 to-indigo-400", slate: "from-slate-600 to-slate-400",
};

function Badge({ live, text }) {
  if (!text) return <span />;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${live ? "bg-white/25 text-white" : "bg-white/15 text-white/80"}`} data-testid="activity-card-badge">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-300 animate-pulse" : "bg-white/50"}`} />{text}
    </span>
  );
}

export default function ActivityCenter() {
  const [cfg, setCfg] = useState({ header_title: tr("活動中心"), header_subtitle: "", cards: [] });
  const [data, setData] = useState({ flash: [], combos: [], recharge: [], cartpromo: [], lottery: { enabled: true } });
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    publicApi.get("/activity-center").then((r) => setCfg(r.data)).catch(() => {});
    Promise.all([
      publicApi.get("/flash-sales/public").then((r) => r.data).catch(() => []),
      publicApi.get("/combos/public").then((r) => r.data).catch(() => []),
      publicApi.get("/recharge-bonus/public").then((r) => r.data).catch(() => []),
      publicApi.get("/cart-promotions/public").then((r) => r.data).catch(() => []),
      publicApi.get("/lottery/config").then((r) => r.data).catch(() => ({ enabled: true })),
    ]).then(([flash, combos, recharge, cartpromo, lottery]) => setData({ flash, combos, recharge, cartpromo, lottery }));
    publicApi.get("/articles", { params: { page: 1, size: 12, type: "promo" } }).then((r) => setArticles(r.data.rows || [])).catch(() => {});
  }, []);

  // live badge for a card based on its type; custom override text wins
  const liveBadge = (card) => {
    if (card.badge) return { live: true, text: card.badge };
    switch (card.type) {
      case "flash": { const n = data.flash?.length || 0; return { live: n > 0, text: n > 0 ? tr("{0} 場進行中", n) : tr("敬請期待") }; }
      case "lottery": return { live: !!data.lottery?.enabled, text: data.lottery?.enabled ? tr("天天可抽") : tr("暫停中") };
      case "combo": { const n = (data.combos || []).filter((c) => c.status === "active" || !c.status).length; return { live: n > 0, text: n > 0 ? tr("{0} 款在售", n) : tr("敬請期待") }; }
      case "recharge": { const n = data.recharge?.length || 0; return { live: n > 0, text: n > 0 ? tr("{0} 檔好禮", n) : tr("敬請期待") }; }
      case "cartpromo": { const n = data.cartpromo?.length || 0; return { live: n > 0, text: n > 0 ? tr("{0} 檔滿減", n) : tr("敬請期待") }; }
      case "invite": return { live: true, text: tr("邀請得積分") };
      default: return { live: true, text: "" };
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:py-8" data-testid="activity-center">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-5 md:px-8 py-6 md:py-9 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 text-white/10" />
        <div className="relative">
          <h1 className="font-head text-2xl md:text-4xl font-extrabold drop-shadow flex items-center gap-2"><Sparkles className="h-6 w-6 md:h-8 md:w-8" />{cfg.header_title || tr("活動中心")}</h1>
          {cfg.header_subtitle && <p className="text-white/90 text-sm md:text-base mt-1.5">{cfg.header_subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-5 md:mt-7" data-testid="activity-cards">
        {(cfg.cards || []).map((c) => {
          const Icon = ICONS[c.icon] || Sparkles;
          const b = liveBadge(c);
          return (
            <Link key={c.key} to={c.to || "/"} data-testid={`activity-card-${c.key}`}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${GRADS[c.color] || GRADS.orange} p-4 md:p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all`}>
              <Icon className="absolute -right-3 -bottom-3 h-20 w-20 text-white/15 group-hover:scale-110 transition-transform" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                  <Badge live={b.live} text={b.text} />
                </div>
                <div className="font-head font-extrabold text-base md:text-lg mt-3 leading-tight">{c.title}</div>
                <div className="text-[12px] md:text-sm text-white/85 mt-0.5 leading-snug">{c.desc}</div>
                <div className="inline-flex items-center gap-0.5 text-[12px] font-bold mt-2.5 text-white/95">{tr("立即參與")}<ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></div>
              </div>
            </Link>
          );
        })}
      </div>

      {articles.length > 0 && (
        <div className="mt-8 md:mt-10" data-testid="activity-articles">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2"><Gift className="h-5 w-5 text-orange-500" />{tr("最新活動公告")}</h2>
            <Link to="/article" className="text-sm text-orange-500 font-semibold inline-flex items-center gap-0.5" data-testid="activity-more-articles">{tr("更多")}<ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {articles.map((n) => <ArticleCard key={n.id} n={n} testId={`activity-article-${n.id}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}
