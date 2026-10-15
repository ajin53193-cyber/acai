import { useEffect } from "react";
import { track } from "@/lib/track";

const KEY = "a2hs_tip_until";
const DAY = 86400000;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

// Mobile browser only: auto-open the "add to home screen" tutorial dialog once per week.
export function A2HSTip({ onOpen, pathname }) {
  useEffect(() => {
    if (!isMobile || standalone || pathname.startsWith("/admin")) return;
    if (+(localStorage.getItem(KEY) || 0) > Date.now()) return;
    const t = setTimeout(() => {
      localStorage.setItem(KEY, String(Date.now() + 7 * DAY));
      track("a2hs_tip_shown", "auto");
      onOpen();
    }, 3000);
    return () => clearTimeout(t);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
