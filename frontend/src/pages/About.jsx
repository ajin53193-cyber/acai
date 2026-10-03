import { Unlock, ShieldCheck, Handshake, FolderKanban, Users, Newspaper, Timer } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { useSettings } from "@/lib/useSettings";

const STAT_ICONS = [FolderKanban, Users, Newspaper, Timer];

const VALUES = [
  { icon: Unlock, title: "开放", desc: "开放项目信息与合作机会，让每一位伙伴都能平等触达优质资源。", img: "/images/ui/value-open.webp" },
  { icon: ShieldCheck, title: "可信", desc: "重视资源真实与对接效率，项目层层审核，信息透明可查。", img: "/images/ui/value-trust.webp" },
  { icon: Handshake, title: "共赢", desc: "推动伙伴共同成长，构建长期稳定、互利共赢的合作生态。", img: "/images/ui/value-win.webp" },
];

const AVATARS_PLACEHOLDER = [];

export default function About() {
  const { team, stats } = useSettings();

  return (
    <main className="pt-28" data-testid="about-page">
      <section className="grid-texture relative overflow-hidden pb-14 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            关于我们
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">聚力项目，合作共赢</p>
        </Reveal>
      </section>

      <section className="pb-14 md:pb-20" data-testid="about-intro-section">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 sm:px-8 lg:grid-cols-5 lg:px-16">
          <Reveal className="lg:col-span-2">
            <div className="glass-card h-full overflow-hidden rounded-3xl">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/images/ui/about-intro.webp"
                  alt="合赢项目社"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
              </div>
              <div className="p-8 sm:p-9">
                <h2 className="font-display text-2xl font-bold text-gold-gradient">平台简介</h2>
                <div className="mt-4 h-px w-14 bg-gold-gradient" />
                <p className="mt-6 text-sm leading-loose text-slate-300 sm:text-base">
                  合赢项目社专注优质项目资源对接，主要面向全国招募团队长。团队通过专业的项目审核、项目评估、项目整合，为团队长提供稳定可靠的优质项目。
                </p>
                <p className="mt-4 text-sm leading-loose text-slate-400">
                  平台每月在微信群内分享最新项目，团队长带领团队发展即可获得持续收益。我们相信，好的项目值得被更多人看见，合赢项目社让每一次合作都有迹可循、有始有终。
                </p>
              </div>
            </div>
          </Reveal>

          <div className="relative lg:col-span-3">
            <div className="pointer-events-none absolute -bottom-12 left-1/2 h-24 w-4/5 -translate-x-1/2 rounded-[100%] bg-[#D4AF37]/20 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-5" data-testid="about-stats-grid">
              {stats.map((s, i) => {
                const Icon = STAT_ICONS[i % STAT_ICONS.length];
                return (
                  <Reveal key={`${s.label}-${i}`} delay={i * 0.1} className="h-full">
                    <div
                      className="glass-card group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border-amber-400/30 px-6 py-8 text-center transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_16px_50px_-12px_rgba(212,175,55,0.35)]"
                      data-testid={`stat-tile-${i}`}
                    >
                      <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#FFE896] to-transparent opacity-60" />
                      <div className="pointer-events-none absolute -top-10 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full bg-[#D4AF37]/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(255,232,150,0.5)]">
                        <Icon size={20} />
                      </div>
                      <div className="mt-4 font-display text-4xl font-black text-gold-gradient sm:text-5xl">
                        <CountUp value={s.num} />
                        {s.suffix && <span className="ml-1 text-base font-bold">{s.suffix}</span>}
                      </div>
                      <div className="mt-3 text-sm tracking-[0.2em] text-slate-300">{s.label}</div>
                      <div className="mt-4 h-0.5 w-8 rounded-full bg-gold-gradient opacity-40 transition-all duration-500 group-hover:w-14 group-hover:opacity-100" />
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#080E1F] py-14 md:py-20" data-testid="about-values-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="平台价值观" subtitle="开放 · 可信 · 共赢" />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.12}>
                <div className="glass-card group h-full overflow-hidden rounded-3xl transition-transform duration-200 active:scale-[0.98]" data-testid={`value-card-${i}`}>
                  <div className="relative h-28 overflow-hidden sm:h-36 md:h-40">
                    <img
                      src={v.img}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                    <div className="absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-amber-400/40 bg-[#060B18]/80 text-[#E5C158] shadow-[0_0_20px_rgba(212,175,55,0.35)] backdrop-blur-sm md:bottom-4 md:h-12 md:w-12">
                      <v.icon size={16} />
                    </div>
                  </div>
                  <div className="p-4 text-center md:p-8">
                    <h3 className="font-display text-base font-bold text-gold-gradient md:text-xl">{v.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400 md:mt-3 md:text-sm">{v.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="about-team-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="核心团队" subtitle="专业团队，为每一次合作保驾护航" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-6">
            {team.map((t, i) => (
              <Reveal key={`${t.role}-${i}`} delay={i * 0.08}>
                <div className="group text-center" data-testid={`team-member-${i}`}>
                  <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
                    <div className="absolute -inset-1.5 rounded-full bg-gold-gradient opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]" />
                    <img
                      src={t.image}
                      alt={t.person}
                      loading="lazy"
                      className="relative h-full w-full rounded-full border-4 border-[#060B18] object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-5 font-display text-base font-bold text-slate-50">{t.person}</div>
                  <div className="mt-1 text-xs tracking-[0.2em] text-[#D4AF37]">{t.role}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
