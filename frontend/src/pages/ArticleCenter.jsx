import { useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Ticket, Percent, FileText, Sparkles } from "lucide-react";
import { NEWS } from "@/lib/news";

const PAGE_SIZE = 8;
const FILTERS = [["all", "全部"], ["promo", "優惠活動"], ["article", "充值教學"]];

export function ActivityBanner() {
  return (
    <div data-testid="activity-banner" className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFE3C2] via-[#FFF1DF] to-[#FFD9B0] px-6 py-10 sm:py-12">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#fff_1.5px,transparent_1.5px)] [background-size:22px_22px]" />
      <Gift className="absolute -left-4 bottom-2 h-28 w-28 sm:h-40 sm:w-40 text-orange-300/70 -rotate-12" strokeWidth={1.2} />
      <Ticket className="absolute right-4 top-4 h-24 w-24 sm:h-36 sm:w-36 text-orange-300/60 rotate-12" strokeWidth={1.2} />
      <Sparkles className="absolute right-[28%] top-6 h-8 w-8 text-white/80" />
      <div className="relative mx-auto w-full max-w-xl rounded-[28px] border-2 border-white/80 bg-white/60 backdrop-blur-sm px-6 pt-9 pb-7 text-center shadow-[0_12px_40px_-16px_rgba(232,121,42,0.5)]">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-1.5 text-sm font-bold text-white shadow-md whitespace-nowrap">活動中心</span>
        <div className="font-head text-3xl sm:text-4xl lg:text-5xl font-black text-[#5A3A17] tracking-wide">精選活動合集</div>
        <div className="font-head mt-2 text-3xl sm:text-4xl lg:text-5xl font-black text-[#E8792A] tracking-wide">優惠一站搞定</div>
      </div>
    </div>
  );
}

export function ArticleCard({ n, testId }) {
  return (
    <Link to={`/article/${n.id}`} data-testid={testId} className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="aspect-[3/2] overflow-hidden bg-orange-50">
        <img src={n.img} alt={n.t} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5">
          {n.type === "promo" ? (
            <span className="shrink-0 h-4 w-4 rounded bg-red-500 text-white flex items-center justify-center"><Percent className="h-2.5 w-2.5" strokeWidth={3} /></span>
          ) : (
            <span className="shrink-0 h-4 w-4 rounded bg-orange-100 text-orange-500 flex items-center justify-center"><FileText className="h-2.5 w-2.5" /></span>
          )}
          <span className="text-[13px] font-medium text-slate-700 truncate group-hover:text-orange-600">{n.t}</span>
        </div>
        <div className="mt-1.5 text-xs text-slate-400">{n.date}</div>
      </div>
    </Link>
  );
}

export default function ArticleCenter() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const list = NEWS.filter((n) => filter === "all" || n.type === filter);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="article-center">
      <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Link to="/" className="hover:text-orange-600">首頁</Link><span>/</span><span className="text-slate-700">活動中心</span>
      </div>
      <ActivityBanner />

      <div className="mt-8 flex items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            data-testid={`article-filter-${k}`}
            onClick={() => { setFilter(k); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${filter === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {shown.map((n, i) => <ArticleCard key={n.id} n={n} testId={`article-card-${i}`} />)}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2" data-testid="article-pagination">
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            data-testid={`article-page-${p}`}
            onClick={() => setPage(p)}
            className={`h-9 w-9 rounded-full text-sm font-semibold transition-colors ${p === page ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300"}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
