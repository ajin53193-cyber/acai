import { publicApi } from "@/lib/api";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "pwa") sessionStorage.setItem("pwa_source", "1");
export const isStandalone = () =>
  window.navigator.standalone === true ||
  !!window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)")?.matches ||
  sessionStorage.getItem("pwa_source") === "1";

export function track(event, source = "") {
  publicApi.post("/track", { event, source, path: window.location.pathname, standalone: isStandalone() }).catch(() => {});
}

if (typeof window !== "undefined" && isStandalone()) document.documentElement.classList.add("pwa");
if (typeof window !== "undefined" && isStandalone() && !sessionStorage.getItem("pwa_launch_tracked")) {
  sessionStorage.setItem("pwa_launch_tracked", "1");
  track("pwa_launch", "standalone");
}
