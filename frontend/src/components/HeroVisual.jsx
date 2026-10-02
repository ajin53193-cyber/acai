import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { LogoMark } from "@/components/Logo";

const OrbitDot = ({ angle, radius, size = 8, delay = 0 }) => (
  <div
    className="absolute left-1/2 top-1/2"
    style={{ transform: `rotate(${angle}deg) translateX(${radius}px)` }}
  >
    <div
      className="animate-pulse-glow rounded-full bg-gradient-to-br from-[#FFE896] to-[#B8860B] shadow-[0_0_12px_rgba(255,232,150,0.8)]"
      style={{ width: size, height: size, animationDelay: `${delay}s`, marginLeft: -size / 2, marginTop: -size / 2 }}
    />
  </div>
);

const Cube = ({ className, delay = 0, size = 26 }) => (
  <motion.div
    className={`absolute ${className}`}
    animate={{ y: [0, -16, 0], rotate: [0, 8, 0] }}
    transition={{ duration: 6, repeat: Infinity, delay, ease: "easeInOut" }}
  >
    <div
      className="rounded-md border border-[#FFE896]/60 bg-gradient-to-br from-[#FFE896]/25 to-[#997316]/40 shadow-[0_0_24px_rgba(212,175,55,0.35)] backdrop-blur-sm"
      style={{ width: size, height: size }}
    />
  </motion.div>
);

export const HeroVisual = () => {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18 });
  const sy = useSpring(my, { stiffness: 50, damping: 18 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-12, 12]);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <div
      data-testid="hero-visual"
      className="relative mx-auto aspect-square w-full max-w-[520px]"
      style={{ perspective: 1000 }}
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.22),transparent_62%)]" />
      <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.35),transparent_70%)]" />

      <motion.div style={{ rotateX, rotateY }} className="absolute inset-0">
        <div className="animate-spin-slow absolute inset-[6%] rounded-full border border-dashed border-[#D4AF37]/40">
          <OrbitDot angle={20} radius={999} size={0} />
          <div className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#FFE896] to-[#B8860B] shadow-[0_0_14px_rgba(255,232,150,0.9)]" />
          <div className="absolute -bottom-[4px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.9)]" />
        </div>

        <div className="animate-spin-slower absolute inset-[20%] rounded-full border border-[#E5C158]/30">
          <div className="absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#FFE896] to-[#B8860B] shadow-[0_0_14px_rgba(255,232,150,0.9)]" />
          <div className="absolute -right-[4px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#E5C158] shadow-[0_0_10px_rgba(229,193,88,0.9)]" />
        </div>

        <div className="absolute inset-[34%] rounded-full border border-[#FFE896]/25 bg-[#0A1228]/60 shadow-[inset_0_0_60px_rgba(212,175,55,0.18)] backdrop-blur-md" />

        <div className="animate-pulse-glow absolute inset-[40%] flex items-center justify-center rounded-full bg-gold-gradient shadow-[0_0_70px_rgba(212,175,55,0.55)]">
          <div className="flex h-[82%] w-[82%] items-center justify-center rounded-full bg-[#0A1228]">
            <LogoMark size={64} />
          </div>
        </div>

        <Cube className="left-[4%] top-[16%]" size={30} delay={0.4} />
        <Cube className="right-[6%] top-[30%]" size={20} delay={1.6} />
        <Cube className="bottom-[14%] left-[12%]" size={22} delay={2.4} />
        <Cube className="bottom-[24%] right-[2%]" size={34} delay={0.9} />

        <div className="animate-float absolute right-[16%] top-[6%] rounded-xl border border-amber-500/25 bg-[#0D1730]/85 px-3.5 py-2.5 backdrop-blur-md" style={{ animationDelay: "1.2s" }}>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">优质项目</div>
          <div className="font-display text-lg font-black text-gold-gradient">36+</div>
        </div>
        <div className="animate-float absolute bottom-[8%] right-[20%] rounded-xl border border-amber-500/25 bg-[#0D1730]/85 px-3.5 py-2.5 backdrop-blur-md" style={{ animationDelay: "2.6s" }}>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">合作伙伴</div>
          <div className="font-display text-lg font-black text-gold-gradient">120+</div>
        </div>
      </motion.div>
    </div>
  );
};
