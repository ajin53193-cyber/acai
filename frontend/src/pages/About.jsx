import { Unlock, ShieldCheck, Handshake, FolderKanban, Users, Newspaper, Timer } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { useSettings } from "@/lib/useSettings";
import { toFullUrl } from "@/components/ImageUpload";

const STAT_ICONS = [FolderKanban, Users, Newspaper, Timer];

const VALUE_ICONS = [Unlock, ShieldCheck, Handshake];

export default function About() {
  const { stats, milestones, copy } = useSettings();
  const a = copy.about;

  return (
    <main className="pt-28" data-testid="about-page">
      <section className="grid-texture relative overflow-hidden pb-14 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            {a.title}
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">{a.subtitle}</p>
        </Reveal>
      </section>

      <section className="pb-14 md:pb-20" data-testid="about-intro-section">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 sm:px-8 lg:grid-cols-5 lg:px-16">
          <Reveal className="lg:col-span-2">
            <div className="glass-card h-full overflow-hidden rounded-3xl">
              <div className="relative h-44 overflow-hidden">
                <img
                  src={toFullUrl(a.intro_image)}
                  alt={a.intro_title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
              </div>
              <div className="p-8 sm:p-9">
                <h2 className="font-display text-2xl font-bold text-gold-gradient">{a.intro_title}</h2>
                <div className="mt-4 h-px w-14 bg-gold-gradient" />
                {a.intro.map((para, i) => (
                  <p key={i} className={i === 0 ? "mt-6 text-sm leading-loose text-slate-300 sm:text-base" : "mt-4 text-sm leading-loose text-slate-400"}>
                    {para}
                  </p>
                ))}
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

      <section className="py-14 md:bg-[#080E1F] md:py-20" data-testid="about-values-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={a.values_title} subtitle={a.values_subtitle} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-3">
            {a.values.map((v, i) => {
              const ValueIcon = VALUE_ICONS[i % VALUE_ICONS.length];
              return (
              <Reveal key={`${v.title}-${i}`} delay={i * 0.12}>
                <div className="glass-card group h-full overflow-hidden rounded-3xl transition-transform duration-200 active:scale-[0.98]" data-testid={`value-card-${i}`}>
                  <div className="relative h-28 overflow-hidden sm:h-36 md:h-40">
                    <img
                      src={toFullUrl(v.img)}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                    <div className="absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-amber-400/40 bg-[#060B18]/80 text-[#E5C158] shadow-[0_0_20px_rgba(212,175,55,0.35)] backdrop-blur-sm md:bottom-4 md:h-12 md:w-12">
                      <ValueIcon size={16} />
                    </div>
                  </div>
                  <div className="p-4 text-center md:p-8">
                    <h3 className="font-display text-base font-bold text-gold-gradient md:text-xl">{v.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400 md:mt-3 md:text-sm">{v.desc}</p>
                  </div>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="about-milestones-section">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <SectionHeading title={a.milestones_title} subtitle={a.milestones_subtitle} />
          <div className="relative ml-2 border-l border-amber-500/25 pl-8">
            {milestones.map((m, i) => (
              <Reveal key={`${m.year}-${i}`} delay={i * 0.08}>
                <div className="relative pb-8 last:pb-0 md:pb-10" data-testid={`milestone-item-${i}`}>
                  <span className="absolute -left-[39.5px] top-1 h-3.5 w-3.5 rounded-full bg-gold-gradient shadow-[0_0_12px_rgba(212,175,55,0.7)]" />
                  <div className="inline-block rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-[#E5C158] md:text-sm">{m.year}</div>
                  <h3 className="mt-2.5 font-display text-base font-bold text-slate-50 md:text-xl">{m.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400 md:text-sm">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
