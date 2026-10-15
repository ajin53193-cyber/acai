import { useEffect, useState } from "react";
import { Smartphone, X, ChevronRight } from "lucide-react";
import { tr } from "@/i18n";
import { track } from "@/lib/track";

const KEY = "a2hs_tip_until";
const DAY = 86400000;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

export function A2HSTip({ onOpen, pathname }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isMobile || standalone || pathname.startsWith("/admin")) return;
    if (+(localStorage.getItem(KEY) || 0) > Date.now()) return;
    const t = setTimeout(() => { setShow(true); track("a2hs_tip_shown", "tip"); }, 4000);
    return () => clearTimeout(t);
  }, [pathname]);
  if (!show) return null;
  const dismiss = (days) => { localStorage.setItem(KEY, String(Date.now() + days * DAY)); setShow(false); };
  return (
    <div data-testid="a2hs-tip" className="md:hidden fixed left-3 right-[4.75rem] vp-bottom z-[45] animate-gt-pop" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl bg-white shadow-[0_12px_32px_-12px_rgba(232,121,42,0.45),0_2px_8px_rgba(0,0,0,0.08)] border border-orange-100 px-3.5 py-3 flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#F0872E] to-[#F6A04A] text-white flex items-center justify-center"><Smartphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 truncate">{tr("加到手機桌面")}</div>
          <div className="text-xs text-slate-500 truncate">{tr("像 App 一樣一鍵打開")}</div>
        </div>
        <button data-testid="a2hs-tip-open" onClick={() => { track("a2hs_tip_open", "tip"); dismiss(30); onOpen(); }} className="h-9 shrink-0 rounded-full bg-orange-500 text-white text-xs font-bold px-3 flex items-center gap-0.5">{tr("查看教學")}<ChevronRight className="h-3.5 w-3.5" /></button>
        <button data-testid="a2hs-tip-close" aria-label={tr("關閉")} onClick={() => { track("a2hs_tip_close", "tip"); dismiss(7); }} className="h-7 w-7 shrink-0 -mr-1 rounded-full text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
