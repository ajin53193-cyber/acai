import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Gift, Package, Percent, Users, Wallet, Sparkles, ChevronRight } from "lucide-react";
import { publicApi } from "@/lib/api";
import { ArticleCard } from "@/pages/ArticleCenter";
import { tr } from "@/i18n";

const CARDS = [
  { key: "flash", title: tr("限時秒殺"), desc: tr("超低價限時搶購"), to: "/", icon: Zap, grad: "from-rose-500 to-orange-400" },
  { key: "lottery", title: tr("幸運大轉盤"), desc: tr("積分換好禮，100% 有獎"), to: "/lottery", icon: Gift, grad: "from-orange-500 to-amber-400" },
  { key: "combo", title: tr("超值套餐"), desc: tr("組合購買更划算"), to: "/", icon: Package, grad: "from-violet-500 to-fuchsia-400" },
  { key: "recharge", title: tr("充值有禮"), desc: tr("充值達標送錢包 / 積分"), to: "/account/wallet/topup", icon: Wallet, grad: "from-emerald-500 to-teal-400" },
  { key: "cartpromo", title: tr("滿減優惠"), desc: tr("下單滿額自動立減"), to: "/", icon: Percent, grad: "from-sky-500 to-blue-400" },
  { key: "invite", title: tr("邀請好友"), desc: tr("邀請得積分，雙方受益"), to: "/invite", icon: Users, grad: "from-pink-500 to-rose-400" },
];

function Badge({ live, text }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${live ? "bg-white/25 text-white" : "bg-white/15 text-white/80"}`} data-testid="activity-card-badge">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-300 animate-pulse" : "bg-white/50"}`} />{text}
    </span>
  );
}

export default function ActivityCenter() {
  const [data, setData] = useState({ flash: [], combos: [], recharge: [], cartpromo: [], lottery: { enabled: true } });
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    Promise.all([
      publicApi.get("/flash-sales/public").then((r) => r.data).catch(() => []),
      publicApi.get("/combos/public").then((r) => r.data).catch(() => []),
      publicApi.get("/recharge-bonus/public").then((r) => r.data).catch(() => []),
      publicApi.get("/cart-promotions/public").then((r) => r.data).catch(() => []),
      publicApi.get("/lottery/config").then((r) => r.data).catch(() => ({ enabled: true })),
    ]).then(([flash, combos, recharge, cartpromo, lottery]) => setData({ flash, combos, recharge, cartpromo, lottery }));
    publicApi.get("/articles", { params: { page: 1, size: 12, type: "promo" } }).then((r) => setArticles(r.data.rows || [])).catch(() => {});
  }, []);

  const badge = (key) => {
    switch (key) {
      case "flash": { const n = data.flash?.length || 0; return <Badge live={n > 0} text={n > 0 ? tr("{0} 場進行中", n) : tr("敬請期待")} />; }
      case "lottery": return <Badge live={!!data.lottery?.enabled} text={data.lottery?.enabled ? tr("天天可抽") : tr("暫停中")} />;
      case "combo": { const n = (data.combos || []).filter((c) => c.status === "active" || !c.status).length; return <Badge live={n > 0} text={n > 0 ? tr("{0} 款在售", n) : tr("敬請期待")} />; }
      case "recharge": { const n = data.recharge?.length || 0; return <Badge live={n > 0} text={n > 0 ? tr("{0} 檔好禮", n) : tr("敬請期待")} />; }
      case "cartpromo": { const n = data.cartpromo?.length || 0; return <Badge live={n > 0} text={n > 0 ? tr("{0} 檔滿減", n) : tr("敬請期待")} />; }
      case "invite": return <Badge live text={tr("邀請得積分")} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:py-8" data-testid="activity-center">
      {/* header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-5 md:px-8 py-6 md:py-9 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 text-white/10" />
        <div className="relative">
          <h1 className="font-head text-2xl md:text-4xl font-extrabold drop-shadow flex items-center gap-2"><Sparkles className="h-6 w-6 md:h-8 md:w-8" />{tr("活動中心")}</h1>
          <p className="text-white/90 text-sm md:text-base mt-1.5">{tr("秒殺、抽獎、套餐、充值、滿減、邀請，好康活動一站逛完")}</p>
        </div>
      </div>

      {/* functional activity cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-5 md:mt-7" data-testid="activity-cards">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.key} to={c.to} data-testid={`activity-card-${c.key}`}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} p-4 md:p-5 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all`}>
              <Icon className="absolute -right-3 -bottom-3 h-20 w-20 text-white/15 group-hover:scale-110 transition-transform" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                  {badge(c.key)}
                </div>
                <div className="font-head font-extrabold text-base md:text-lg mt-3 leading-tight">{c.title}</div>
                <div className="text-[12px] md:text-sm text-white/85 mt-0.5 leading-snug">{c.desc}</div>
                <div className="inline-flex items-center gap-0.5 text-[12px] font-bold mt-2.5 text-white/95">{tr("立即參與")}<ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* promo articles */}
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
