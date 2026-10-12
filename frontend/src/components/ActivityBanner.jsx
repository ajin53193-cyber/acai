import { Link } from "react-router-dom";
import { Gift, Ticket, Sparkles } from "lucide-react";

export function ActivityBanner() {
  return (
    <Link to="/article" data-testid="activity-banner" className="group relative block overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFE3C2] via-[#FFF1DF] to-[#FFD9B0] px-6 py-8 sm:py-10 hover:shadow-lg transition-shadow">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#fff_1.5px,transparent_1.5px)] [background-size:22px_22px]" />
      <Gift className="absolute -left-4 bottom-2 h-24 w-24 sm:h-36 sm:w-36 text-orange-300/70 -rotate-12" strokeWidth={1.2} />
      <Ticket className="absolute right-4 top-4 h-20 w-20 sm:h-32 sm:w-32 text-orange-300/60 rotate-12" strokeWidth={1.2} />
      <Sparkles className="absolute right-[28%] top-6 h-8 w-8 text-white/80" />
      <div className="relative mx-auto w-full max-w-xl rounded-[28px] border-2 border-white/80 bg-white/60 backdrop-blur-sm px-6 pt-8 pb-6 text-center shadow-[0_12px_40px_-16px_rgba(232,121,42,0.5)] group-hover:bg-white/70 transition-colors">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-1.5 text-sm font-bold text-white shadow-md whitespace-nowrap">活動中心</span>
        <div className="font-head text-2xl sm:text-4xl font-black text-[#5A3A17] tracking-wide">精選活動合集</div>
        <div className="font-head mt-1.5 text-2xl sm:text-4xl font-black text-[#E8792A] tracking-wide">優惠一站搞定</div>
      </div>
    </Link>
  );
}
