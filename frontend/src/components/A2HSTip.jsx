import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { tr } from "@/i18n";
import { track } from "@/lib/track";

const KEY = "a2hs_tip_until";
const DAY = 86400000;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

// Mobile browser only: poster popup inviting the visitor to add the site to the home screen.
export function A2HSTip({ onOpen, pathname }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isMobile || standalone || pathname.startsWith("/admin")) return;
    if (+(localStorage.getItem(KEY) || 0) > Date.now()) return;
    const t = setTimeout(() => { setShow(true); track("a2hs_tip_shown", "popup"); }, 3000);
    return () => clearTimeout(t);
  }, [pathname]);
  if (!show) return null;
  const dismiss = (days) => { localStorage.setItem(KEY, String(Date.now() + days * DAY)); setShow(false); };
  return (
    <div data-testid="a2hs-tip" className="md:hidden fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 bg-black/55 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-[330px] aspect-[3/4] rounded-[26px] overflow-hidden shadow-[0_30px_70px_-20px_rgba(120,60,10,0.6)] animate-gt-pop bg-[#FFF4EA]">
        <img src="/banners/a2hs-popup.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 top-0 pt-7 px-5 text-center">
          <div className="font-head text-[30px] font-black leading-tight text-[#E8732A] drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]">{tr("加到手機桌面")}</div>
          <div className="mt-1.5 text-[15px] font-bold text-slate-800">{tr("像")} <span className="text-[#E8732A]">App</span> {tr("一樣一鍵打開")} · {tr("充值更快更方便")}</div>
        </div>
        <button data-testid="a2hs-tip-open" onClick={() => { track("a2hs_tip_open", "popup"); dismiss(30); onOpen(); }}
          className="absolute left-1/2 -translate-x-1/2 bottom-5 h-12 w-[72%] rounded-full bg-gradient-to-r from-[#F0872E] to-[#F6A04A] text-white text-base font-bold shadow-[0_12px_26px_-10px_rgba(240,135,46,0.9)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
          {tr("查看教學")}<ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <button data-testid="a2hs-tip-close" aria-label={tr("關閉")} onClick={() => { track("a2hs_tip_close", "popup"); dismiss(7); }} className="mt-6 h-11 w-11 rounded-full border-2 border-white/90 text-white flex items-center justify-center active:scale-95 transition-transform"><X className="h-5 w-5" /></button>
    </div>
  );
}
