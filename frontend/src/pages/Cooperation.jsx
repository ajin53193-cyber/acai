import { Link } from "react-router-dom";
import { FilePlus2, Link2, Users, Target, Layers, Hexagon, ShieldCheck, Zap, Crown, Package, Gem } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";

const STEPS = [
  { icon: FilePlus2, title: "项目发布", desc: "提交项目信息" },
  { icon: Link2, title: "资源对接", desc: "匹配各方资源" },
  { icon: Users, title: "团队共建", desc: "发展团队伙伴" },
  { icon: Target, title: "合作落地", desc: "推动合作落地" },
];

const MODES = [
  {
    icon: Crown,
    title: "团长合作",
    desc: "开放团长席位，共建本地社群与项目渠道",
    points: ["专属城市团长席位", "平台项目优先代理权", "社群运营全程扶持", "团队业绩阶梯分成"],
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
  { icon: Layers, title: "平台项目资源", desc: "严选项目库持续更新，覆盖多行业赛道" },
  { icon: Hexagon, title: "社群协作体系", desc: "成熟社群网络，信息高效流转共享" },
  { icon: ShieldCheck, title: "客服全程对接", desc: "专业客服团队，合作全程跟进护航" },
  { icon: Zap, title: "高效信息匹配", desc: "需求快速响应，精准撮合合作双方" },
];

export default function Cooperation() {
  return (
    <main className="pt-28" data-testid="cooperation-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            合作共赢
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">连接项目、资金、渠道与团队伙伴</p>
        </Reveal>
      </section>

      <section className="pb-20" data-testid="cooperation-flow-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="合作模式" subtitle="四步闭环，从发布到落地全程护航" />
          <Reveal>
            <div className="glass-card relative rounded-3xl px-6 py-12 sm:px-12">
              <div className="absolute left-[12%] right-[12%] top-[64px] hidden h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent md:block" />
              <div className="grid grid-cols-2 gap-6 gap-y-10 md:grid-cols-4 md:gap-10">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="relative text-center" data-testid={`flow-step-${i}`}>
                    <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-[#060B18] text-[#E5C158] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                      <s.icon size={26} />
                      <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient text-xs font-black text-[#060B18]">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-bold text-slate-50">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-400">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#080E1F] py-20" data-testid="cooperation-modes-section">
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

      <section className="py-20" data-testid="cooperation-advantages-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <SectionHeading title="合作优势" subtitle="为什么选择合赢项目社" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.1}>
                <div className="glass-card group h-full rounded-2xl p-7" data-testid={`advantage-card-${i}`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                    <a.icon size={20} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold text-slate-50">{a.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16">
            <div className="glass-card flex flex-col items-center justify-between gap-6 rounded-3xl border-amber-400/40 px-8 py-10 text-center shadow-[0_0_60px_-15px_rgba(212,175,55,0.3)] md:flex-row md:text-left">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-50 sm:text-2xl">联系客服加入团长</h3>
                <p className="mt-2 text-sm text-slate-400">客服热线：400-888-6888 · 微信客服：heyingkefu</p>
              </div>
              <Link
                to="/contact"
                data-testid="cooperation-consult-btn"
                className="shrink-0 rounded-full bg-gold-gradient px-9 py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
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
