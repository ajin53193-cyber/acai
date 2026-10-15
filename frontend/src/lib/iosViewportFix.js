// iOS standalone (Add to Home Screen) diagnostics only. Layout fixes live in CSS:
// fixed elements use inset/bottom:0 (fills the physical screen on iOS 26 PWA) instead
// of height:100% / 100dvh, which resolve to a shorter layout viewport there.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let debugSent = 0;
function debug(stage) {
  if (debugSent >= 6) return;
  debugSent += 1;
  const vv = window.visualViewport;
  const bar = document.querySelector("[data-testid='mobile-register-bar'], [data-testid='order-detail-drawer']");
  const body = JSON.stringify({ event: "vp_debug", source: stage, path: window.location.pathname, standalone: !!standalone, meta: {
    ih: window.innerHeight, iw: window.innerWidth, vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null,
    screenH: window.screen.height, screenW: window.screen.width, clientH: document.documentElement.clientHeight,
    barRect: bar ? [Math.round(bar.getBoundingClientRect().top), Math.round(bar.getBoundingClientRect().bottom)] : null,
    bodyPos: document.body.style.position, scrollY: Math.round(window.scrollY), active: document.activeElement?.tagName || "" } });
  try { fetch(`${process.env.REACT_APP_BACKEND_URL}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch {}
}

if (isIOS && standalone) {
  setTimeout(() => debug("load"), 1500);
  document.addEventListener("focusout", () => setTimeout(() => debug("after_keyboard"), 600), true);
}
