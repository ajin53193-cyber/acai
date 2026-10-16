import { publicApi } from "@/lib/api";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "pwa") sessionStorage.setItem("pwa_source", "1");
export const isStandalone = () =>
  window.navigator.standalone === true ||
  !!window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)")?.matches ||
  sessionStorage.getItem("pwa_source") === "1";

export function track(event, source = "") {
  publicApi.post("/track", { event, source, path: window.location.pathname, standalone: isStandalone() }).catch(() => {});
}

if (typeof window !== "undefined" && isStandalone()) {
  document.documentElement.classList.add("pwa");
  // Real screen height for the app shell (iOS 26 standalone: 100%/100dvh is ~68px short); ignore keyboard-induced shrinks
  const setH = () => {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (document.body?.classList.contains("gt-scroll-locked")) return;
    document.documentElement.style.setProperty("--app-h", `${window.innerHeight}px`);
  };
  setH();
  window.addEventListener("resize", () => setTimeout(setH, 60));
  window.addEventListener("orientationchange", () => setTimeout(setH, 300));
}
if (typeof window !== "undefined" && isStandalone() && !sessionStorage.getItem("pwa_launch_tracked")) {
  sessionStorage.setItem("pwa_launch_tracked", "1");
  track("pwa_launch", "standalone");
}
