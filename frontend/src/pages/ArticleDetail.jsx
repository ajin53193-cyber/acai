import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { publicApi } from "@/lib/api";

export default function ArticleDetail() {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setA(null);
    window.scrollTo({ top: 0 });
    publicApi.get(`/articles/${id}`).then((r) => setA(r.data)).catch(() => setMissing(true));
  }, [id]);

  if (missing) return <Navigate to="/article" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6" data-testid="article-detail">
      <div className="text-sm text-slate-400 mb-4 md:mb-6 flex items-center gap-1.5" data-testid="article-breadcrumb">
        <Link to="/" className="hover:text-orange-600">首頁</Link><span>/</span>
        {!a?.page && <><Link to="/article" data-testid="article-back" className="hover:text-orange-600">新聞資訊</Link><span>/</span></>}
        <span className="text-slate-600">{a?.page ? a.title : "新聞詳情"}</span>
      </div>
      {!a ? (
        <div className="bg-white rounded-3xl h-[60vh] animate-pulse" />
      ) : (
        <article className="bg-white rounded-2xl md:rounded-3xl px-4 py-6 sm:px-10 sm:py-10">
          <h1 className="font-head text-xl sm:text-3xl font-bold text-slate-900 text-center leading-snug" data-testid="article-title">{a.title}</h1>
          <div className="mt-3 md:mt-4 flex items-center justify-center gap-4 text-xs md:text-sm text-slate-400">
            <span data-testid="article-date">{a.published_at}</span>
            <span data-testid="article-views">閱讀量：{a.view_count}次</span>
          </div>
          <div className="mt-6 md:mt-8 kavip-content article-content text-[15px] leading-relaxed text-slate-700" data-testid="article-content" dangerouslySetInnerHTML={{ __html: a.content_html }} />
          <div className="mt-8 md:mt-10 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between gap-3 text-sm">
            {a.prev ? (
              <Link to={`/article/${a.prev.id}`} data-testid="article-prev" className="inline-flex items-center gap-1 text-slate-600 hover:text-orange-600 min-w-0">
                <ChevronLeft className="h-4 w-4 shrink-0" /><span className="truncate">上一篇：{a.prev.title}</span>
              </Link>
            ) : <span />}
            {a.next && (
              <Link to={`/article/${a.next.id}`} data-testid="article-next" className="inline-flex items-center gap-1 text-slate-600 hover:text-orange-600 min-w-0 sm:justify-end">
                <span className="truncate">下一篇：{a.next.title}</span><ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
