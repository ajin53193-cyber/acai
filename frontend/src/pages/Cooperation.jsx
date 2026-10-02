import { Link } from "react-router-dom";
import { Users, User, Target, Layers, Hexagon, ShieldCheck, Zap, Crown, Package, Gem } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { useSettings } from "@/lib/useSettings";

const STEPS = [
  { icon: ShieldCheck, title: "项目审核", desc: "专业机制层层审核" },
  { icon: Target, title: "项目评估", desc: "全面评估项目价值" },
  { icon: Layers, title: "项目整合", desc: "整合优质资源项目" },
  { icon: Users, title: "合作落地", desc: "团队对接稳定落地" },
];

const TIER_ICONS = [User, Users, Crown, Gem, Package, Hexagon];

const MODES = [
  {
    icon: Crown,
    title: "团长合作",
    desc: "招募团队长，平台提供稳定项目，共建团队持续收益",
    points: ["专属城市团长席位", "平台稳定项目直供", "团队发展收益分成", "新项目每月群内分享"],
  },
  {
    icon: Package,
    title: "项目方合作",
    desc: "提交项目信息，获取对接机会与社群曝光",
    points: ["项目免费上架展示", "精准匹配资金渠道", "百人社群同步曝光", "客服一对一跟进"],
  },
  {
    icon: Gem,
    title: "资源方合作",
    desc: "提供资金、渠道、技术或服务资源",
    points: ["优质项目优先对接", "资源价值高效变现", "平台信用背书保障", "长期战略合作机制"],
  },
];

const ADVANTAGES = [
  { icon: Layers, title: "平台项目资源", desc: "严选项目库持续更新，覆盖多行业赛道", img: "/images/ui/adv-resources.png" },
  { icon: Hexagon, title: "社群协作体系", desc: "成熟社群网络，信息高效流转共享", img: "/images/ui/adv-network.png" },
  { icon: ShieldCheck, title: "客服全程对接", desc: "专业客服团队，合作全程跟进护航", img: "/images/ui/adv-service.png" },
  { icon: Zap, title: "高效信息匹配", desc: "需求快速响应，精准撮合合作双方", img: "/images/ui/adv-match.png" },
];

export default function Cooperation() {
  const { contact, tiers } = useSettings();

  return (
    <main className="pt-28" data-testid="cooperation-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            合作共赢
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">招募团队长 · 平台提供稳定项目 · 每月新项目群内分享</p>
        </Reveal>
      </section>

      <section className="pb-14 md:pb-20" data-testid="cooperation-flow-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="合作模式" subtitle="四步闭环，从发布到落地全程护航" />
          <Reveal>
            <div className="glass-card relative overflow-hidden rounded-3xl px-5 py-8 sm:px-12 sm:py-12">
              <img src="/images/ui/cta-banner.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15" />
              <div className="absolute left-[12%] right-[12%] top-[64px] hidden h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent md:block" />
              <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-10">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="relative flex items-center gap-4 text-left md:block md:text-center" data-testid={`flow-step-${i}`}>
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_24px_rgba(212,175,55,0.25)] md:mx-auto md:h-16 md:w-16">
                      <s.icon size={24} />
                      <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient text-xs font-black text-[#060B18]">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-50 md:mt-5 md:text-lg">{s.title}</h3>
                      <p className="mt-1 text-xs text-slate-400 md:mt-1.5 md:text-sm">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="cooperation-tiers-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="团长收益体系" subtitle="团队发展收益参考 · 具体以正式合作协议为准" />
          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-3">
            {tiers.map((t, i) => {
              const TierIcon = TIER_ICONS[i % TIER_ICONS.length];
              return (
              <Reveal key={`${t.count}-${i}`} delay={i * 0.12}>
                <div
                  className={`glass-card group relative flex h-full flex-col items-center overflow-hidden rounded-3xl px-8 py-10 text-center ${
                    t.featured ? "border-amber-400/50 shadow-[0_0_50px_-10px_rgba(212,175,55,0.35)]" : ""
                  }`}
                  data-testid={`tier-card-${i}`}
                >
                  {t.featured && (
                    <span className="absolute right-5 top-5 rounded-full bg-gold-gradient px-3 py-1 text-[10px] font-black text-[#060B18]">
                      热门
                    </span>
                  )}
                  <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#FFE896] to-transparent opacity-60" />
                  <div className="pointer-events-none absolute -top-10 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full bg-[#D4AF37]/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-transform duration-500 group-hover:scale-110">
                    <TierIcon size={24} />
                  </div>
                  <div className="mt-5 text-sm tracking-[0.25em] text-slate-400">{t.count}</div>
                  <div className="mt-3 font-display text-4xl font-black text-gold-gradient sm:text-5xl">{t.income}</div>
                  <div className="mt-2 text-xs tracking-[0.2em] text-[#D4AF37]">月入参考 / 月</div>
                  <div className="mt-6 h-0.5 w-8 rounded-full bg-gold-gradient opacity-40 transition-all duration-500 group-hover:w-16 group-hover:opacity-100" />
                </div>
              </Reveal>
              );
            })}
          </div>
          <Reveal className="mt-8 text-center">
            <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500" data-testid="tier-disclaimer">
              以上收益为团队发展规模的参考区间，实际收益与团队运营情况相关，不构成收益承诺，具体以正式合作协议为准。
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#080E1F] py-14 md:py-20" data-testid="cooperation-modes-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="合作方式" subtitle="三种身份，总有一个适合你" />
          <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
            {MODES.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.12}>
                <div className="glass-card group flex h-full flex-col rounded-3xl p-8 text-center" data-testid={`cooperation-mode-card-${i}`}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-gradient text-[#060B18] shadow-[0_0_28px_rgba(212,175,55,0.4)] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                    <m.icon size={28} />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-slate-50">{m.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{m.desc}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-left">
                    {m.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <span className="h-1.5 w-1.5 rotate-45 bg-[#D4AF37]" /> {pt}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/contact"
                    data-testid={`cooperation-apply-btn-${i}`}
                    className="mt-8 rounded-full bg-gold-gradient py-3 text-sm font-bold text-[#060B18] shadow-[0_0_18px_rgba(212,175,55,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,232,150,0.55)]"
                  >
                    申请合作
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" data-testid="cooperation-advantages-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="合作优势" subtitle="为什么选择合赢项目社" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.1}>
                <div className="glass-card group h-full overflow-hidden rounded-2xl" data-testid={`advantage-card-${i}`}>
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={a.img}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/20 to-transparent" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                        <a.icon size={18} />
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-50">{a.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{a.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16">
            <div className="glass-card relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border-amber-400/40 px-8 py-10 text-center shadow-[0_0_60px_-15px_rgba(212,175,55,0.3)] md:flex-row md:text-left">
              <img src="/images/ui/cta-banner.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A1228]/70 via-[#0A1228]/40 to-[#0A1228]/70" />
              <div className="relative">
                <h3 className="font-display text-xl font-bold text-slate-50 sm:text-2xl">联系客服加入团长</h3>
                <p className="mt-2 text-sm text-slate-300">工作时间 {contact.hours} · 邮箱 {contact.email}</p>
              </div>
              <Link
                to="/contact"
                data-testid="cooperation-consult-btn"
                className="relative shrink-0 rounded-full bg-gold-gradient px-9 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
              >
                在线咨询
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
