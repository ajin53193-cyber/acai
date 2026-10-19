import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { FilePlus2, Link2, Users, Handshake, ChevronRight, ArrowRight, ShieldCheck, Flame } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { Marquee } from "@/components/Marquee";
import { HeroVisual } from "@/components/HeroVisual";
import { CountUp } from "@/components/CountUp";
import { toFullUrl } from "@/components/ImageUpload";
import { useSettings } from "@/lib/useSettings";
import { ProjectGateModal } from "@/components/ProjectGateModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_ICONS = [FilePlus2, Link2, Users, Handshake];

const lineReveal = {
  hidden: { y: "110%" },
  show: (i) => ({
    y: "0%",
    transition: { duration: 0.9, delay: 0.15 + i * 0.16, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const { stats, edges, copy } = useSettings();
  const home = copy.home;

  useEffect(() => {
    axios
      .get(`${API}/projects`)
      .then((res) => setProjects(res.data.projects.slice(0, 6)))
      .catch(() => {});
  }, []);

  return (
    <main data-testid="home-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-32 lg:pt-36">
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#D4AF37]/12 blur-[130px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-8 lg:grid-cols-2 lg:px-16">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 px-4 py-1.5 text-xs font-medium tracking-[0.25em] text-[#E5C158]"
              data-testid="hero-badge"
            >
              {home.hero_tag}
            </motion.div>

            <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block overflow-hidden pb-1">
                <motion.span custom={0} variants={lineReveal} initial="hidden" animate="show" className="block text-slate-50">
                  {home.hero_title1}
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-2">
                <motion.span custom={1} variants={lineReveal} initial="hidden" animate="show" className="block text-gold-gradient">
                  {home.hero_title2}
                </motion.span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0"
              data-testid="hero-subtitle"
            >
              {home.hero_subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.75 }}
              className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
            >
              <Link
                to="/projects"
                data-testid="hero-browse-projects-btn"
                className="rounded-full bg-gold-gradient px-8 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_36px_rgba(255,232,150,0.55)] active:scale-95"
              >
                {home.hero_btn_primary}
              </Link>
              <Link
                to="/cooperation"
                data-testid="hero-join-cooperation-btn"
                className="rounded-full border border-[#D4AF37] px-8 py-3.5 text-sm font-medium text-[#FFE896] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)]"
              >
                {home.hero_btn_secondary}
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
              data-testid="hero-compliance-badges"
            >
              {copy.compliance_badges.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.05] px-3 py-1 text-[11px] font-medium text-[#E5C158] sm:text-xs"
                >
                  <ShieldCheck size={12} className="text-[#D4AF37]" />
                  {t}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="mt-12 flex justify-center gap-8 sm:gap-10 lg:justify-start"
              data-testid="hero-stats"
            >
              {stats.slice(0, 3).map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl font-black text-gold-gradient sm:text-3xl">
                    <CountUp value={s.num} />{s.suffix}
                  </div>
                  <div className="mt-1 text-xs tracking-widest text-slate-400">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroVisual />
          </motion.div>
        </div>

        <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-50" viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none">
          <path className="wave-line" d="M0,90 C360,20 720,110 1080,50 C1260,22 1380,60 1440,40" stroke="url(#waveGold)" strokeWidth="1.5" />
          <defs>
            <linearGradient id="waveGold" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D4AF37" stopOpacity="0" />
              <stop offset="0.5" stopColor="#FFE896" />
              <stop offset="1" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </section>

      <Marquee />

      <section className="py-14 md:py-24" data-testid="services-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={home.services_title} subtitle={home.services_subtitle} />
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {home.services.map((s, i) => {
              const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
              return (
              <Reveal key={`${s.title}-${i}`} delay={i * 0.1}>
                <div className="glass-card group flex h-full flex-col overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]" data-testid={`service-card-${i}`}>
                  <div className="relative h-24 overflow-hidden sm:h-36">
                    <img
                      src={toFullUrl(s.img)}
                      alt={s.tag}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-[#060B18]/70 text-[#E5C158] backdrop-blur-sm sm:bottom-3 sm:left-4 sm:h-9 sm:w-9">
                      <Icon size={16} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-6">
                    <div className="text-[10px] font-medium tracking-[0.2em] text-[#D4AF37] sm:text-xs">{s.tag}</div>
                    <h3 className="mt-1.5 font-display text-base font-bold leading-snug text-slate-50 sm:mt-2 sm:text-xl">{s.title}</h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">{s.desc}</p>
                    <Link
                      to="/projects"
                      data-testid={`service-card-link-${i}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#E5C158] transition-all duration-300 hover:gap-2.5 hover:text-[#FFE896] sm:mt-5 sm:text-sm"
                    >
                      查看详情 <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 md:bg-[#080E1F] md:py-24" data-testid="featured-projects-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={home.projects_title} subtitle={home.projects_subtitle} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-3">
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <div role="button" tabIndex={0} onClick={() => setActiveProject(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveProject(p); } }} data-testid={`featured-project-card-${i}`} className="glass-card group block cursor-pointer overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]">
                  <div className="relative h-28 overflow-hidden sm:h-36 md:h-44">
                    <img
                      src={p.image}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A1228] via-transparent to-transparent" />
                    <span className="absolute left-2 top-2 rounded-full bg-gold-gradient px-2 py-0.5 text-[10px] font-bold text-[#060B18] md:left-4 md:top-4 md:px-3 md:py-1 md:text-xs">
                      {p.status}
                    </span>
                    {p.hot && (
                      <span data-testid={`featured-hot-badge-${i}`} className="hot-badge absolute right-2 top-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF6B3D] to-[#FF3D5A] px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_14px_rgba(255,90,70,0.55)] md:right-4 md:top-4 md:px-3 md:py-1 md:text-xs">
                        <Flame size={11} /> 热门
                      </span>
                    )}
                  </div>
                  <div className="p-3 md:p-6">
                    <div className="text-[10px] tracking-[0.15em] text-[#D4AF37] md:text-xs md:tracking-[0.2em]">{p.category} · {p.region}</div>
                    <h3 className="mt-1.5 font-display text-sm font-bold leading-snug text-slate-50 transition-colors group-hover:text-[#FFE896] md:mt-2 md:text-lg">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-400 md:mt-2 md:text-sm">{p.description}</p>
                    <div className="mt-2.5 flex items-center justify-between border-t border-amber-500/10 pt-2.5 md:mt-4 md:pt-4">
                      <span className="text-[10px] text-slate-300 md:text-sm">查看详情</span>
                      <ArrowRight size={16} className="text-[#D4AF37] transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 text-center">
            <Link
              to="/projects"
              data-testid="view-all-projects-btn"
              className="inline-block rounded-full border border-[#D4AF37] px-9 py-3 text-sm font-medium text-[#FFE896] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)]"
            >
              {home.projects_btn}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="py-14 md:py-24" data-testid="advantages-home-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={home.edges_title} subtitle={home.edges_subtitle} />
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {edges.map((a, i) => (
              <Reveal key={`${a.title}-${i}`} delay={i * 0.1}>
                <div className="glass-card group h-full overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]" data-testid={`advantage-home-card-${i}`}>
                  <div className="relative h-28 overflow-hidden sm:h-40">
                    <img
                      src={toFullUrl(a.image)}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                  </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="font-display text-base font-bold text-slate-50 sm:text-lg">{a.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">{a.desc}</p>
                    <div className="mt-4 h-0.5 w-7 rounded-full bg-gold-gradient opacity-40 transition-all duration-500 group-hover:w-12 group-hover:opacity-100" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="cta-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <Reveal>
            <div className="glass-card relative overflow-hidden rounded-3xl border-amber-400/40 px-8 py-12 text-center shadow-[0_0_60px_-15px_rgba(212,175,55,0.35)] sm:px-14">
              <img src="/images/ui/cta-banner.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A1228]/70 via-[#0A1228]/30 to-[#0A1228]/75" />
              <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-[#D4AF37]/15 blur-[80px]" />
              <div className="relative">
              <h3 className="font-display text-2xl font-bold text-slate-50 sm:text-3xl">
                <span className="text-gold-gradient">{home.cta_title}</span>
              </h3>
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
                {home.cta_desc}
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("hy:open-chat"))}
                data-testid="cta-contact-kefu-btn"
                className="mt-8 inline-block rounded-full bg-gold-gradient px-10 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_36px_rgba(255,232,150,0.6)] active:scale-95"
              >
                {home.cta_btn}
              </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <ProjectGateModal project={activeProject} onClose={() => setActiveProject(null)} />
    </main>
  );
}
