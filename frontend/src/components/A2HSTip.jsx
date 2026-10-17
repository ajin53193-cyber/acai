import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { tr } from "@/i18n";
import { track, isStandalone } from "@/lib/track";

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Mobile browser only: poster popup inviting the visitor to add the site to the home screen.
export function A2HSTip({ onOpen, pathname }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isMobile || isStandalone() || isAdminPath(pathname) || sessionStorage.getItem("a2hs_tip_shown")) return;
    const t = setTimeout(() => { sessionStorage.setItem("a2hs_tip_shown", "1"); setShow(true); track("a2hs_tip_shown", "popup"); }, 3000);
    return () => clearTimeout(t);
  }, [pathname]);
  if (!show) return null;
  const dismiss = () => setShow(false);
  return (
    <div data-testid="a2hs-tip" className="md:hidden fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 bg-black/55 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-[330px] rounded-[26px] overflow-hidden bg-white shadow-[0_30px_70px_-20px_rgba(120,60,10,0.6)] animate-gt-pop">
        <div className="px-5 pt-5 pb-3 text-center bg-gradient-to-b from-white to-[#FFF4EA]">
          <img src="/icons/app-logo.png" alt="gogo589" className="mx-auto mb-2 h-12 w-12 rounded-xl shadow-[0_6px_16px_-6px_rgba(232,121,42,0.6)] ring-2 ring-white" />
          <div className="font-head text-[22px] font-black leading-tight text-[#E8732A]">{tr("添加輕量版桌面 App")}</div>
          <div className="mt-1.5 text-[13px] font-semibold text-slate-700 leading-5">{tr("手機端數據實時同步，同一賬號桌面登錄")}<br />{tr("訂單、餘額、優惠全面通用")}</div>
        </div>
        <div className="relative aspect-square bg-[#FFF4EA]">
          <img src="/banners/a2hs-popup.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_72%]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FFF4EA] via-[#FFF4EA]/70 to-transparent" />
          <button data-testid="a2hs-tip-open" onClick={() => { track("a2hs_tip_open", "popup"); dismiss(); onOpen(); }}
            className="absolute left-1/2 -translate-x-1/2 bottom-4 h-12 w-[72%] rounded-full bg-gradient-to-r from-[#F0872E] to-[#F6A04A] text-white text-base font-bold shadow-[0_12px_26px_-10px_rgba(240,135,46,0.9)] active:scale-[0.98] transition-transform">
            {tr("查看教學")}
          </button>
        </div>
      </div>
      <button data-testid="a2hs-tip-close" aria-label={tr("關閉")} onClick={() => { track("a2hs_tip_close", "popup"); dismiss(); }} className="mt-6 h-11 w-11 rounded-full border-2 border-white/90 text-white flex items-center justify-center active:scale-95 transition-transform"><X className="h-5 w-5" /></button>
    </div>
  );
}
