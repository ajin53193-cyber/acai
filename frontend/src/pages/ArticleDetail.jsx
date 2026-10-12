import { useParams, Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { NEWS, ARTICLE_BODY } from "@/lib/news";
import { ArticleCard } from "./ArticleCenter";

export default function ArticleDetail() {
  const { id } = useParams();
  const n = NEWS.find((x) => x.id === id);
  if (!n) return <Navigate to="/article" replace />;
  const related = NEWS.filter((x) => x.id !== id && x.type === n.type).slice(0, 4);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="article-detail">
      <Link to="/article" data-testid="article-back" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-orange-600">
        <ChevronLeft className="h-4 w-4" /> 返回活動中心
      </Link>
      <article className="mt-4 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <img src={n.img} alt={n.t} className="w-full aspect-[3/1.4] object-cover" />
        <div className="p-6 sm:p-8">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${n.type === "promo" ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-600"}`}>
            {n.type === "promo" ? "優惠活動" : "充值教學"}
          </span>
          <h1 className="font-head mt-3 text-2xl sm:text-3xl font-bold text-slate-900" data-testid="article-title">{n.t}</h1>
          <div className="mt-2 text-xs text-slate-400">發布日期：{n.date}</div>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700">
            {ARTICLE_BODY[n.type].map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <Link to="/" data-testid="article-cta" className="mt-8 inline-flex h-12 items-center rounded-full bg-orange-500 px-8 text-base font-bold text-white hover:bg-orange-600 transition-colors">
            立即前往充值
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-head text-lg font-bold text-slate-900 mb-4">相關內容</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((r, i) => <ArticleCard key={r.id} n={r} testId={`related-card-${i}`} />)}
          </div>
        </section>
      )}
    </div>
  );
}
