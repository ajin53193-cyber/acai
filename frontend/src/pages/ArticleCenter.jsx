import { useEffect, useState } from "react";
import { scrollPageTo } from "@/lib/scroller";
import { Link } from "react-router-dom";
import { Percent, FileText, Sparkles } from "lucide-react";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";

const PAGE_SIZE = 15;

export const ARTICLE_TYPES = [["", tr("全部")], ["promo", tr("優惠活動")], ["tutorial", tr("充值教學")], ["news", tr("新聞公告")]];
export const isPromo = (a) => a.type === "promo" || (!a.type && /優惠|优惠|折扣|OFF|%|活動|活动|盛惠|大禮包|大礼包|好券|會員日|会员日|coupon|discount|promo|event|sale/i.test(a.title || ""));

export function ArticleCard({ n, testId }) {
  return (
    <Link to={`/article/${n.id}`} data-testid={testId} className="group block bg-white rounded-2xl shadow-[0_6px_20px_-10px_rgba(232,121,42,0.35)] overflow-hidden hover:shadow-[0_12px_28px_-10px_rgba(232,121,42,0.45)] hover:-translate-y-0.5 transition-all">
      <div className="h-[18px] bg-[#F08A3C] flex items-center justify-between px-2.5">
        <span className="flex gap-[3px]">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/80" />)}</span>
        <span className="flex gap-[3px]">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/80" />)}</span>
      </div>
      <div className="relative bg-[#FFF3E6] px-3 pt-3 pb-3">
        <Sparkles className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-white" />
        <Sparkles className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-white" />
        <div className="aspect-[2/1] overflow-hidden rounded-lg border-[3px] border-white shadow-sm bg-white">
          {n.cover ? <img src={n.cover} alt={n.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <div className="h-full w-full bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center text-white font-bold text-sm px-3 text-center leading-snug">{n.title}</div>}
        </div>
      </div>
      <div className="px-3 py-3 flex items-center gap-2">
        {isPromo(n) ? (
          <span className="shrink-0 h-5 w-5 rounded bg-red-500 text-white flex items-center justify-center"><Percent className="h-3 w-3" strokeWidth={3} /></span>
        ) : (
          <span className="shrink-0 h-5 w-5 rounded bg-orange-100 text-orange-500 flex items-center justify-center"><FileText className="h-3 w-3" /></span>
        )}
        <span className="text-[13px] md:text-[14px] text-slate-800 truncate group-hover:text-orange-600">{n.title}</span>
      </div>
    </Link>
  );
}

export default function ArticleCenter() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [data, setData] = useState({ total: 0, rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    publicApi.get("/articles", { params: { page, size: PAGE_SIZE, type } }).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
    scrollPageTo({ top: 0 });
  }, [page, type]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="min-h-[70vh]" data-testid="article-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        <div className="text-sm text-slate-400 mb-4 md:mb-6 flex items-center gap-1.5" data-testid="article-breadcrumb">
          <Link to="/" className="hover:text-orange-600">{tr("首頁")}</Link><span>/</span><span className="text-slate-600">{tr("新聞資訊")}</span>
        </div>

        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto no-scrollbar" data-testid="article-type-tabs">
          {ARTICLE_TYPES.map(([k, label]) => (
            <button key={k} data-testid={`article-type-${k || "all"}`} onClick={() => { setType(k); setPage(1); }}
              className={`shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold transition-colors ${type === k ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:text-orange-600 shadow-sm"}`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 md:gap-x-5 gap-y-5 md:gap-y-8">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[4/3] bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 md:gap-x-5 gap-y-5 md:gap-y-8">
            {data.rows.map((n, i) => <ArticleCard key={n.id} n={n} testId={`article-card-${i}`} />)}
          </div>
        )}

        {pages > 1 && (
          <div className="mt-8 md:mt-10 flex items-center justify-center gap-2 md:gap-3 flex-wrap" data-testid="article-pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} data-testid={`article-page-${p}`} onClick={() => setPage(p)}
                className={`h-9 w-9 rounded-full text-sm transition-colors ${p === page ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:text-orange-600 shadow-sm"}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
