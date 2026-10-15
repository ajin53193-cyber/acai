import { publicApi } from "@/lib/api";

export const isStandalone = () => window.navigator.standalone === true || !!window.matchMedia?.("(display-mode: standalone)")?.matches;

export function track(event, source = "") {
  publicApi.post("/track", { event, source, path: window.location.pathname, standalone: isStandalone() }).catch(() => {});
}

if (typeof window !== "undefined" && isStandalone()) document.documentElement.classList.add("pwa");
if (typeof window !== "undefined" && isStandalone() && !sessionStorage.getItem("pwa_launch_tracked")) {
  sessionStorage.setItem("pwa_launch_tracked", "1");
  track("pwa_launch", "standalone");
}
