// iOS "Add to Home Screen" (standalone) WebKit quirk: the layout viewport
// (documentElement.clientHeight / 100dvh / position:fixed bottom:0) can be shorter
// than the real window (innerHeight), leaving a band at the screen bottom that
// fixed bars and full-height sheets don't cover. WebKit won't re-layout (display
// flips / meta rewrites only cause flicker), so we expose the difference as a CSS
// variable (--vp-gap) and let bottom-anchored UI extend into the band.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let gap = 0;
let debugSent = 0;

function keyboardOpen() {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return true;
  const vv = window.visualViewport;
  return !!vv && document.documentElement.clientHeight - vv.height > 60;
}

function debug(stage) {
  if (debugSent >= 12) return;
  debugSent += 1;
  const vv = window.visualViewport;
  const body = JSON.stringify({ event: "vp_debug", source: stage, path: window.location.pathname, standalone: !!standalone, meta: {
    ih: window.innerHeight, iw: window.innerWidth, vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null,
    screenH: window.screen.height, screenW: window.screen.width, clientH: document.documentElement.clientHeight, gap, kb: keyboardOpen(),
    bodyPos: document.body.style.position, scrollY: Math.round(window.scrollY), active: document.activeElement?.tagName || "" } });
  try { fetch(`${process.env.REACT_APP_BACKEND_URL}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch {}
}

function updateGap() {
  if (keyboardOpen()) return;
  const g = window.innerHeight - document.documentElement.clientHeight;
  const next = g > 4 && g < 200 ? g : 0;
  if (next === gap) return;
  gap = next;
  document.documentElement.style.setProperty("--vp-gap", `${gap}px`);
  debug("gap_change");
}

if (isIOS && standalone) {
  updateGap();
  setTimeout(() => { updateGap(); debug("load"); }, 1500);
  window.addEventListener("resize", () => setTimeout(updateGap, 50));
  window.addEventListener("orientationchange", () => setTimeout(updateGap, 400));
  window.visualViewport?.addEventListener("resize", () => setTimeout(updateGap, 50));
  document.addEventListener("focusout", () => setTimeout(updateGap, 400), true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(updateGap, 100); });
  setInterval(updateGap, 1000);
}
