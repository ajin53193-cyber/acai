import { Unlock, ShieldCheck, Handshake } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";

const STATS = [
  { num: "36+", label: "优质项目" },
  { num: "120+", label: "合作伙伴" },
  { num: "80+", label: "行业动态" },
  { num: "30", unit: "分钟内", label: "客服响应" },
];

const VALUES = [
  { icon: Unlock, title: "开放", desc: "开放项目信息与合作机会，让每一位伙伴都能平等触达优质资源。" },
  { icon: ShieldCheck, title: "可信", desc: "重视资源真实与对接效率，项目层层审核，信息透明可查。" },
  { icon: Handshake, title: "共赢", desc: "推动伙伴共同成长，构建长期稳定、互利共赢的合作生态。" },
];

const AVATARS = [
  "https://images.unsplash.com/photo-1665224752561-85f4da9a5658?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
  "https://images.unsplash.com/photo-1665224752136-4dbe2dfc8195?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
  "https://images.unsplash.com/photo-1520689728498-7dd1a9814607?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
  "https://images.unsplash.com/photo-1665224751641-8ea911ca2267?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
];

const TEAM = [
  { name: "项目负责人", person: "陈志远", img: AVATARS[0] },
  { name: "合作负责人", person: "林嘉豪", img: AVATARS[1] },
  { name: "资源负责人", person: "周明轩", img: AVATARS[2] },
  { name: "运营负责人", person: "吴国强", img: AVATARS[3] },
  { name: "客服负责人", person: "许文博", img: AVATARS[1] },
  { name: "品牌负责人", person: "郑立诚", img: AVATARS[2] },
];

export default function About() {
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

      <section className="pb-20" data-testid="about-intro-section">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 sm:px-8 lg:grid-cols-5 lg:px-16">
          <Reveal className="lg:col-span-2">
            <div className="glass-card h-full rounded-3xl p-8 sm:p-10">
              <h2 className="font-display text-2xl font-bold text-gold-gradient">平台简介</h2>
              <div className="mt-4 h-px w-14 bg-gold-gradient" />
              <p className="mt-6 text-sm leading-loose text-slate-300 sm:text-base">
                合赢项目社专注优质项目资源对接、社群交流与商业合作，汇聚各方伙伴，发掘优质项目，搭建开放可信的项目协作平台。
              </p>
              <p className="mt-4 text-sm leading-loose text-slate-400">
                我们相信，好的项目值得被更多人看见。通过严选审核机制、成熟社群网络与专业客服团队，合赢项目社让项目方、资源方与团长伙伴高效连接，让每一次合作都有迹可循、有始有终。
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 gap-5 lg:col-span-3" data-testid="about-stats-grid">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1} className="h-full">
                <div className="glass-card group relative h-full overflow-hidden rounded-2xl border-amber-400/30 p-7 text-center shadow-[inset_0_0_40px_rgba(212,175,55,0.06)]" data-testid={`stat-tile-${i}`}>
                  <div className="pointer-events-none absolute -top-10 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full bg-[#D4AF37]/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="font-display text-4xl font-black text-gold-gradient sm:text-5xl">
                    {s.num}
                    {s.unit && <span className="ml-1 text-base font-bold">{s.unit}</span>}
                  </div>
                  <div className="mt-3 text-sm tracking-[0.2em] text-slate-300">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#080E1F] py-20" data-testid="about-values-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="平台价值观" subtitle="开放 · 可信 · 共赢" />
          <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.12}>
                <div className="glass-card group h-full rounded-3xl p-9 text-center" data-testid={`value-card-${i}`}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_24px_rgba(212,175,55,0.25)] transition-transform duration-500 group-hover:scale-110">
                    <v.icon size={26} />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-gold-gradient">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20" data-testid="about-team-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="核心团队" subtitle="专业团队，为每一次合作保驾护航" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-6">
            {TEAM.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08}>
                <div className="group text-center" data-testid={`team-member-${i}`}>
                  <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
                    <div className="absolute -inset-1.5 rounded-full bg-gold-gradient opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]" />
                    <img
                      src={t.img}
                      alt={t.person}
                      loading="lazy"
                      className="relative h-full w-full rounded-full border-4 border-[#060B18] object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-5 font-display text-base font-bold text-slate-50">{t.person}</div>
                  <div className="mt-1 text-xs tracking-[0.2em] text-[#D4AF37]">{t.name}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
