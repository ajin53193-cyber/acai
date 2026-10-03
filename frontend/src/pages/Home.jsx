import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { FilePlus2, Link2, Users, Handshake, ChevronRight, ArrowRight } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { Marquee } from "@/components/Marquee";
import { HeroVisual } from "@/components/HeroVisual";
import { CountUp } from "@/components/CountUp";
import { toFullUrl } from "@/components/ImageUpload";
import { useSettings } from "@/lib/useSettings";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICES = [
  {
    icon: FilePlus2,
    tag: "项目发布",
    title: "绿色能源合作项目",
    desc: "汇聚光伏、储能、充电桩等绿色能源优质项目，严选审核，长期收益清晰可见。",
    img: "/images/ui/service-publish.webp",
  },
  {
    icon: Link2,
    tag: "资源对接",
    title: "社群共建项目",
    desc: "为项目方精准匹配资金、渠道与团队伙伴，高效撮合，全程跟进对接进度。",
    img: "/images/ui/service-link.webp",
  },
  {
    icon: Users,
    tag: "社群共建",
    title: "资源对接平台项目",
    desc: "开放本地社群与团长席位，共建活跃商业社群，共享平台流量与资源红利。",
    img: "/images/ui/service-community.webp",
  },
  {
    icon: Handshake,
    tag: "合作落地",
    title: "新项目推荐",
    desc: "客服团队全程护航合作落地，从意向对接到签约执行，一站式陪伴成长。",
    img: "/images/ui/service-deal.webp",
  },
];

const lineReveal = {
  hidden: { y: "110%" },
  show: (i) => ({
    y: "0%",
    transition: { duration: 0.9, delay: 0.15 + i * 0.16, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Home() {
  const [projects, setProjects] = useState([]);
  const { stats, edges } = useSettings();

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
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 px-4 py-1.5 text-xs font-medium tracking-[0.25em] text-[#E5C158]"
              data-testid="hero-badge"
            >
              HEYING PROJECT CLUB
            </motion.div>

            <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block overflow-hidden pb-1">
                <motion.span custom={0} variants={lineReveal} initial="hidden" animate="show" className="block text-slate-50">
                  合赢项目社
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-2">
                <motion.span custom={1} variants={lineReveal} initial="hidden" animate="show" className="block text-gold-gradient">
                  聚力项目，合作共赢
                </motion.span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="mt-6 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg"
              data-testid="hero-subtitle"
            >
              招募团队长，平台提供优质稳定项目。专业项目审核、评估、整合，每月新项目微信群内同步分享。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.75 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <Link
                to="/projects"
                data-testid="hero-browse-projects-btn"
                className="rounded-full bg-gold-gradient px-8 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_36px_rgba(255,232,150,0.55)] active:scale-95"
              >
                浏览项目
              </Link>
              <Link
                to="/cooperation"
                data-testid="hero-join-cooperation-btn"
                className="rounded-full border border-[#D4AF37] px-8 py-3.5 text-sm font-medium text-[#FFE896] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)]"
              >
                加入合作
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="mt-12 flex gap-10"
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
          <SectionHeading title="优质项目推荐" subtitle="四大核心服务，构建项目合作全链路" />
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.tag} delay={i * 0.1}>
                <div className="glass-card group flex h-full flex-col overflow-hidden rounded-2xl" data-testid={`service-card-${i}`}>
                  <div className="relative h-24 overflow-hidden sm:h-36">
                    <img
                      src={s.img}
                      alt={s.tag}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-[#060B18]/70 text-[#E5C158] backdrop-blur-sm sm:bottom-3 sm:left-4 sm:h-9 sm:w-9">
                      <s.icon size={16} />
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
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#080E1F] py-14 md:py-24" data-testid="featured-projects-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="精选合作项目" subtitle="严选优质项目，真实可靠，持续更新" />
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <Link to="/projects" data-testid={`featured-project-card-${i}`} className="glass-card group block overflow-hidden rounded-2xl">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A1228] via-transparent to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-gold-gradient px-3 py-1 text-xs font-bold text-[#060B18]">
                      {p.status}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="text-xs tracking-[0.2em] text-[#D4AF37]">{p.category} · {p.region}</div>
                    <h3 className="mt-2 font-display text-lg font-bold text-slate-50 transition-colors group-hover:text-[#FFE896]">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-amber-500/10 pt-4">
                      <span className="text-sm text-slate-300">投入区间 <span className="font-bold text-[#E5C158]">{p.investment}</span></span>
                      <ArrowRight size={16} className="text-[#D4AF37] transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 text-center">
            <Link
              to="/projects"
              data-testid="view-all-projects-btn"
              className="inline-block rounded-full border border-[#D4AF37] px-9 py-3 text-sm font-medium text-[#FFE896] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)]"
            >
              查看全部项目
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="py-14 md:py-24" data-testid="advantages-home-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="我们的优势" subtitle="专业审核 · 稳定供给 · 每月分享 · 专属对接" />
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {edges.map((a, i) => (
              <Reveal key={`${a.title}-${i}`} delay={i * 0.1}>
                <div className="glass-card group h-full overflow-hidden rounded-2xl" data-testid={`advantage-home-card-${i}`}>
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
              <img src="/images/ui/cta-banner.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A1228]/70 via-[#0A1228]/30 to-[#0A1228]/75" />
              <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-[#D4AF37]/15 blur-[80px]" />
              <div className="relative">
              <h3 className="font-display text-2xl font-bold text-slate-50 sm:text-3xl">
                准备好加入<span className="text-gold-gradient">合作</span>了吗？
              </h3>
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
                联系客服获取团长入驻与项目合作详情，工作时间 9:00 - 21:00 全程在线。
              </p>
              <Link
                to="/contact"
                data-testid="cta-contact-kefu-btn"
                className="mt-8 inline-block rounded-full bg-gold-gradient px-10 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_36px_rgba(255,232,150,0.6)] active:scale-95"
              >
                立即联系客服
              </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
