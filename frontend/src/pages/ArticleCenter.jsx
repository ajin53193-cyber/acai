import { useState } from "react";
import { Link } from "react-router-dom";
import { Percent, FileText, Sparkles } from "lucide-react";
import { NEWS } from "@/lib/news";

const PAGE_SIZE = 15;

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
        <div className="aspect-[2/1] overflow-hidden rounded-lg border-[3px] border-white shadow-sm">
          <img src={n.img} alt={n.t} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      </div>
      <div className="px-3 py-3 flex items-center gap-2">
        {n.type === "promo" ? (
          <span className="shrink-0 h-5 w-5 rounded bg-red-500 text-white flex items-center justify-center"><Percent className="h-3 w-3" strokeWidth={3} /></span>
        ) : (
          <span className="shrink-0 h-5 w-5 rounded bg-orange-100 text-orange-500 flex items-center justify-center"><FileText className="h-3 w-3" /></span>
        )}
        <span className="text-[14px] font-medium text-slate-800 truncate group-hover:text-orange-600">{n.t}</span>
      </div>
    </Link>
  );
}

export default function ArticleCenter() {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(NEWS.length / PAGE_SIZE));
  const shown = NEWS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-[#FFF6EC] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:18px_18px] min-h-[70vh]" data-testid="article-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-sm text-slate-400 mb-6 flex items-center gap-1.5" data-testid="article-breadcrumb">
          <Link to="/" className="hover:text-orange-600">首頁</Link><span>/</span><span className="text-slate-600">新聞資訊</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-8">
          {shown.map((n, i) => <ArticleCard key={n.id} n={n} testId={`article-card-${i}`} />)}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3" data-testid="article-pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              data-testid={`article-page-${p}`}
              onClick={() => setPage(p)}
              className={`h-9 w-9 rounded-full text-sm font-semibold transition-colors ${p === page ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:text-orange-600 shadow-sm"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
