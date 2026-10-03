import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

export default function News() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/articles`)
      .then((res) => setArticles(res.data.articles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="pt-28" data-testid="news-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-10">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <Reveal>
            <h1 className="text-center font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
              新闻动态
            </h1>
            <p className="mt-4 text-center text-base text-slate-400 sm:text-lg">行业洞察 · 平台进展 · 合作机会</p>
          </Reveal>

          <div className="mt-14">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-500" data-testid="news-loading">加载中…</div>
            ) : articles.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-500" data-testid="news-empty">暂无动态</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-3" data-testid="news-grid">
                {articles.map((a, i) => (
                  <Reveal key={a.id} delay={(i % 3) * 0.08}>
                    <Link
                      to={`/news/${a.id}`}
                      data-testid={`news-card-${i}`}
                      className="glass-card group block h-full overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]"
                    >
                      {a.cover && (
                        <div className="relative h-28 overflow-hidden sm:h-36 md:h-44">
                          <img
                            src={toFullUrl(a.cover)}
                            alt={a.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="p-3 md:p-6">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 md:text-xs">
                          <CalendarDays size={13} className="text-[#D4AF37]" />
                          {new Date(a.created_at).toLocaleDateString("zh-CN")}
                        </div>
                        <h3 className="mt-2 font-display text-sm font-bold leading-snug text-slate-50 transition-colors group-hover:text-[#FFE896] md:mt-3 md:text-lg">
                          {a.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400 md:mt-2 md:text-sm">{a.summary}</p>
                        <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-[#E5C158] transition-all duration-300 group-hover:gap-2.5 group-hover:text-[#FFE896] md:mt-4 md:text-sm">
                          阅读全文 <ArrowRight size={15} />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
