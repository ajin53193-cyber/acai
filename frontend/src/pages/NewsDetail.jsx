import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { CalendarDays, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

export default function NewsDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/articles/${id}`)
      .then((res) => setArticle(res.data))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 pt-20" data-testid="news-not-found">
        <p className="text-slate-400">文章不存在或已下架</p>
        <Link to="/news" className="rounded-full border border-[#D4AF37] px-6 py-2.5 text-sm text-[#FFE896] hover:bg-[#D4AF37]/10">
          返回新闻动态
        </Link>
      </main>
    );
  }

  if (!article) {
    return <main className="min-h-screen pt-40 text-center text-sm text-slate-500" data-testid="news-detail-loading">加载中…</main>;
  }

  return (
    <main className="pt-28" data-testid="news-detail-page">
      <article className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Link
            to="/news"
            data-testid="news-back-link"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-[#FFE896]"
          >
            <ArrowLeft size={15} /> 返回新闻动态
          </Link>
          <h1 className="mt-6 font-display text-2xl font-black leading-snug text-slate-50 sm:text-3xl lg:text-4xl">
            {article.title}
          </h1>
          <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarDays size={14} className="text-[#D4AF37]" />
            {new Date(article.created_at).toLocaleDateString("zh-CN")} · 合赢项目社
          </div>
          <div className="mt-6 h-px bg-gradient-to-r from-[#D4AF37]/60 via-[#D4AF37]/20 to-transparent" />
          {article.cover && (
            <img
              src={toFullUrl(article.cover)}
              alt={article.title}
              decoding="async"
              fetchPriority="high"
              className="mt-8 w-full rounded-2xl border border-amber-500/15 object-cover"
            />
          )}
          <div className="mt-8 space-y-5" data-testid="news-detail-content">
            {article.content.split("\n").filter((p) => p.trim()).map((p, i) => (
              <p key={i} className="text-sm leading-loose text-slate-300 sm:text-base">{p}</p>
            ))}
          </div>
          <div className="glass-card mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl px-7 py-7 text-center sm:flex-row sm:text-left">
            <div>
              <div className="font-display text-lg font-bold text-slate-50">对这个方向感兴趣？</div>
              <div className="mt-1 text-sm text-slate-400">前往项目中心查看合作项目，或直接联系客服咨询</div>
            </div>
            <Link
              to="/contact"
              data-testid="news-detail-contact-btn"
              className="shrink-0 rounded-full bg-gold-gradient px-8 py-3 text-sm font-bold text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95"
            >
              联系客服
            </Link>
          </div>
        </motion.div>
      </article>
    </main>
  );
}
