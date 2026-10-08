import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, PlayCircle, MessageCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

const isDirectVideo = (url) => /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url) || url.startsWith("/api/") || url.includes("/api/files/");

export const TutorialVideo = ({ url, title }) => {
  if (!url) return null;
  if (isDirectVideo(url)) {
    return (
      <video
        src={toFullUrl(url)}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-2xl border border-amber-500/20 bg-black"
        data-testid="tutorial-video"
      >
        您的浏览器不支持视频播放
      </video>
    );
  }
  return (
    <iframe
      src={url}
      title={title}
      allowFullScreen
      allow="autoplay; fullscreen; picture-in-picture"
      className="aspect-video w-full rounded-2xl border border-amber-500/20 bg-black"
      data-testid="tutorial-video-iframe"
    />
  );
};

const CtaLink = ({ link, label }) => {
  const cls = "flex items-center gap-2 rounded-full bg-gold-gradient px-8 py-3 text-sm font-bold text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 active:scale-95";
  if (/^https?:\/\//i.test(link)) {
    return (
      <a href={link} target="_blank" rel="noreferrer" data-testid="tutorial-cta-btn" className={cls}>
        {label} <ArrowRight size={16} />
      </a>
    );
  }
  return (
    <Link to={link} data-testid="tutorial-cta-btn" className={cls}>
      {label} <ArrowRight size={16} />
    </Link>
  );
};

export default function Tutorial() {
  const { slug } = useParams();
  const [tutorial, setTutorial] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    axios
      .get(`${API}/tutorials/${slug}`)
      .then((res) => setTutorial(res.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  const openChat = () => window.dispatchEvent(new CustomEvent("hy:open-chat"));

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 pt-20" data-testid="tutorial-not-found">
        <p className="text-slate-400">教程不存在或已下架</p>
        <Link to="/" className="rounded-full border border-[#D4AF37] px-6 py-2.5 text-sm text-[#FFE896] hover:bg-[#D4AF37]/10">返回首页</Link>
      </main>
    );
  }

  if (!tutorial) {
    return <main className="min-h-screen pt-40 text-center text-sm text-slate-500" data-testid="tutorial-loading">加载中…</main>;
  }

  return (
    <main className="pt-28" data-testid="tutorial-page">
      <article className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Link to={tutorial.back_link || "/"} data-testid="tutorial-back-link" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-[#FFE896]">
            <ArrowLeft size={15} /> {tutorial.back_label || "返回首页"}
          </Link>
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 px-3 py-1 text-[11px] tracking-widest text-[#E5C158]">
            <PlayCircle size={12} /> 图文视频教程
          </div>
          <h1 className="mt-4 font-display text-2xl font-black leading-snug text-slate-50 sm:text-3xl lg:text-4xl" data-testid="tutorial-title">
            {tutorial.title}
          </h1>
          {tutorial.summary && <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{tutorial.summary}</p>}
          <div className="mt-6 h-px bg-gradient-to-r from-[#D4AF37]/60 via-[#D4AF37]/20 to-transparent" />

          {tutorial.video_url ? (
            <div className="mt-8"><TutorialVideo url={tutorial.video_url} title={tutorial.title} /></div>
          ) : tutorial.cover ? (
            <img src={toFullUrl(tutorial.cover)} alt={tutorial.title} decoding="async" className="mt-8 w-full rounded-2xl border border-amber-500/15 object-cover" />
          ) : null}

          <ol className="mt-10 space-y-8" data-testid="tutorial-steps">
            {(tutorial.steps || []).map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="glass-card rounded-2xl p-6 sm:p-7"
                data-testid={`tutorial-step-${i}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-gradient font-display text-sm font-black text-[#060B18]">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    {step.title && <h2 className="font-display text-base font-bold text-slate-50 md:text-lg">{step.title}</h2>}
                    {step.text && <p className="mt-2 whitespace-pre-line text-sm leading-loose text-slate-300">{step.text}</p>}
                    {step.image && (
                      <img src={toFullUrl(step.image)} alt={step.title || `步骤 ${i + 1}`} loading="lazy" decoding="async" className="mt-4 w-full rounded-xl border border-amber-500/15 object-cover" />
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>

          <div className="glass-card mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl px-7 py-7 text-center sm:flex-row sm:text-left">
            <div>
              <div className="font-display text-lg font-bold text-slate-50">看完教程还有疑问？</div>
              <div className="mt-1 text-sm text-slate-400">点击联系客服，扫码进群领取最新项目资料</div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
              {tutorial.cta_link && (
                <CtaLink link={tutorial.cta_link} label={tutorial.cta_label || "立即前往"} />
              )}
              <button
                type="button"
                onClick={openChat}
                data-testid="tutorial-contact-btn"
                className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-transform hover:scale-105 active:scale-95 ${
                  tutorial.cta_link
                    ? "border border-amber-500/50 text-[#E5C158] hover:bg-amber-500/10"
                    : "bg-gold-gradient text-[#060B18] shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                }`}
              >
                <MessageCircle size={16} /> 联系客服
              </button>
            </div>
          </div>
        </motion.div>
      </article>
    </main>
  );
}
