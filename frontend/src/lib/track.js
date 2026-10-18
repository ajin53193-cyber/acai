import { publicApi } from "@/lib/api";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "pwa") sessionStorage.setItem("pwa_source", "1");
// iOS exposes navigator.standalone (true in the home-screen app, false in Safari) — trust it so a "?source=pwa" URL
// opened in Safari can never flip the page into PWA mode. Other platforms fall back to display-mode / the start_url flag.
export const isStandalone = () =>
  typeof window.navigator.standalone === "boolean"
    ? window.navigator.standalone
    : (!!window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)")?.matches || sessionStorage.getItem("pwa_source") === "1");

export const isIOS = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function track(event, source = "") {
  publicApi.post("/track", { event, source, path: window.location.pathname, standalone: isStandalone() }).catch(() => {});
}

if (typeof window !== "undefined" && isStandalone()) document.documentElement.classList.add("pwa");
if (typeof window !== "undefined" && isIOS()) document.documentElement.classList.add("ios");
if (typeof window !== "undefined" && isStandalone() && !sessionStorage.getItem("pwa_launch_tracked")) {
  sessionStorage.setItem("pwa_launch_tracked", "1");
  track("pwa_launch", "standalone");
}
