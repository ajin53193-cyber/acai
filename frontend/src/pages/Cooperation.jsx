import { Link } from "react-router-dom";
import { Users, User, Target, Layers, Hexagon, ShieldCheck, Zap, Crown, Package, Gem } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { useSettings } from "@/lib/useSettings";
import { toFullUrl } from "@/components/ImageUpload";

const STEP_ICONS = [ShieldCheck, Target, Layers, Users];
const TIER_ICONS = [User, Users, Crown, Gem, Package, Hexagon];
const MODE_ICONS = [Crown, Package, Gem];
const ADV_ICONS = [Layers, Hexagon, ShieldCheck, Zap];

export default function Cooperation() {
  const { contact, tiers, copy } = useSettings();
  const c = copy.cooperation;

  return (
    <main className="pt-28" data-testid="cooperation-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            {c.title}
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">{c.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3" data-testid="cooperation-compliance-badges">
            {copy.compliance_badges.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#E5C158] sm:text-sm"
              >
                <ShieldCheck size={14} className="shrink-0 text-[#D4AF37]" />
                {t}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="pb-14 md:pb-20" data-testid="cooperation-flow-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={c.steps_title} subtitle={c.steps_subtitle} />
          <Reveal>
            <div className="glass-card relative overflow-hidden rounded-3xl px-5 py-8 sm:px-12 sm:py-12">
              <img src="/images/ui/cta-banner.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15" />
              <div className="absolute left-[12%] right-[12%] top-[64px] hidden h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent md:block" />
              <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-10">
                {c.steps.map((s, i) => {
                  const StepIcon = STEP_ICONS[i % STEP_ICONS.length];
                  return (
                  <div key={`${s.title}-${i}`} className="relative flex items-center gap-3 text-left md:block md:text-center" data-testid={`flow-step-${i}`}>
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_24px_rgba(212,175,55,0.25)] md:mx-auto md:h-16 md:w-16 md:rounded-2xl">
                      <StepIcon size={20} />
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold-gradient text-[10px] font-black text-[#060B18] md:h-6 md:w-6 md:text-xs">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-50 md:mt-5 md:text-lg">{s.title}</h3>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-400 md:mt-1.5 md:text-sm">{s.desc}</p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="cooperation-tiers-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={c.tiers_title} subtitle={c.tiers_subtitle} />
          <div className="grid grid-cols-3 items-stretch gap-2.5 sm:gap-4 md:gap-6">
            {tiers.map((t, i) => {
              const TierIcon = TIER_ICONS[i % TIER_ICONS.length];
              return (
              <Reveal key={`${t.count}-${i}`} delay={i * 0.12}>
                <div
                  className={`glass-card group relative flex h-full flex-col items-center overflow-hidden rounded-2xl px-1.5 py-4 text-center transition-transform duration-200 active:scale-[0.98] md:rounded-3xl md:px-8 md:py-10 ${
                    t.featured ? "border-amber-400/50 shadow-[0_0_50px_-10px_rgba(212,175,55,0.35)]" : ""
                  }`}
                  data-testid={`tier-card-${i}`}
                >
                  {t.featured && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-gold-gradient px-1.5 py-px text-[8px] font-black text-[#060B18] md:right-5 md:top-5 md:px-3 md:py-1 md:text-[10px]">
                      热门
                    </span>
                  )}
                  <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#FFE896] to-transparent opacity-60" />
                  <div className="pointer-events-none absolute -top-10 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full bg-[#D4AF37]/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-transform duration-500 group-hover:scale-110 md:h-14 md:w-14 md:rounded-2xl">
                    <TierIcon size={15} />
                  </div>
                  <div className="mt-2 text-[9px] tracking-[0.1em] text-slate-400 md:mt-5 md:text-sm md:tracking-[0.25em]">{t.count}</div>
                  <div className="mt-1 font-display text-lg font-black leading-tight text-gold-gradient sm:text-2xl md:mt-3 lg:text-5xl">{t.income}</div>
                  <div className="mt-1 text-[8px] tracking-[0.05em] text-[#D4AF37] md:mt-2 md:text-xs md:tracking-[0.2em]">{c.tier_level_label}</div>
                  <div className="mt-2 h-0.5 w-6 rounded-full bg-gold-gradient opacity-40 transition-all duration-500 group-hover:w-16 group-hover:opacity-100 md:mt-6 md:w-8" />
                </div>
              </Reveal>
              );
            })}
          </div>
          <Reveal className="mt-8 text-center">
            <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500" data-testid="tier-disclaimer">
              {c.tiers_disclaimer}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 md:bg-[#080E1F] md:py-20" data-testid="cooperation-modes-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={c.modes_title} subtitle={c.modes_subtitle} />
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-7">
            {c.modes.map((m, i) => {
              const ModeIcon = MODE_ICONS[i % MODE_ICONS.length];
              return (
              <Reveal key={`${m.title}-${i}`} delay={i * 0.12}>
                <div className="glass-card group flex h-full flex-col rounded-2xl p-2.5 text-center transition-transform duration-200 active:scale-[0.98] md:rounded-3xl md:p-8" data-testid={`cooperation-mode-card-${i}`}>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-gold-gradient text-[#060B18] shadow-[0_0_28px_rgba(212,175,55,0.4)] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 md:h-16 md:w-16 md:rounded-2xl">
                    <ModeIcon size={16} />
                  </div>
                  <h3 className="mt-2 font-display text-xs font-bold text-slate-50 md:mt-6 md:text-xl">{m.title}</h3>
                  <p className="hidden md:mt-2 md:block md:text-sm md:text-slate-400">{m.desc}</p>
                  <ul className="mt-2 flex-1 space-y-1 text-left md:mt-6 md:space-y-2.5">
                    {(m.points || []).map((pt, j) => (
                      <li key={`${pt}-${j}`} className="flex items-start gap-1 text-[9px] leading-snug text-slate-300 md:items-center md:gap-2.5 md:text-sm">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rotate-45 bg-[#D4AF37] md:mt-0 md:h-1.5 md:w-1.5" /> {pt}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/contact"
                    data-testid={`cooperation-apply-btn-${i}`}
                    className="mt-2.5 rounded-full bg-gold-gradient py-1.5 text-[10px] font-bold text-[#060B18] shadow-[0_0_18px_rgba(212,175,55,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,232,150,0.55)] md:mt-8 md:py-3 md:text-sm"
                  >
                    {c.apply_btn}
                  </Link>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="cooperation-advantages-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title={c.adv_title} subtitle={c.adv_subtitle} />
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {c.advantages.map((a, i) => {
              const AdvIcon = ADV_ICONS[i % ADV_ICONS.length];
              return (
              <Reveal key={`${a.title}-${i}`} delay={i * 0.1}>
                <div className="glass-card group h-full overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]" data-testid={`advantage-card-${i}`}>
                  <div className="relative h-24 overflow-hidden sm:h-32 md:h-36">
                    <img
                      src={toFullUrl(a.img)}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                  </div>
                  <div className="p-3.5 md:p-6">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] md:h-10 md:w-10">
                        <AdvIcon size={16} />
                      </div>
                      <h3 className="font-display text-sm font-bold text-slate-50 md:text-lg">{a.title}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400 md:mt-3 md:text-sm">{a.desc}</p>
                  </div>
                </div>
              </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-16">
            <div className="glass-card relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border-amber-400/40 px-8 py-10 text-center shadow-[0_0_60px_-15px_rgba(212,175,55,0.3)] md:flex-row md:text-left">
              <img src="/images/ui/cta-banner.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A1228]/70 via-[#0A1228]/40 to-[#0A1228]/70" />
              <div className="relative">
                <h3 className="font-display text-xl font-bold text-slate-50 sm:text-2xl">{c.cta_title}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  工作时间 {contact.hours} · 邮箱 {contact.email}
                  {contact.hotline && <> · 电话 {contact.hotline}</>}
                  {contact.wechat && <> · 微信 {contact.wechat}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("hy:open-chat"))}
                data-testid="cooperation-consult-btn"
                className="relative shrink-0 rounded-full bg-gold-gradient px-9 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
              >
                {c.cta_btn}
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
