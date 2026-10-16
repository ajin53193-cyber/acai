// iOS diagnostics only (no layout side effects). Layout fixes live in CSS.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let debugSent = 0;
function rect(el) { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }
function safeBottom() {
  const p = document.createElement("div");
  p.style.cssText = "position:fixed;padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
  document.body.appendChild(p);
  const v = getComputedStyle(p).paddingBottom;
  p.remove();
  return v;
}
function debug(stage) {
  if (debugSent >= 8) return;
  debugSent += 1;
  const vv = window.visualViewport;
  const bar = document.querySelector("[data-testid='mobile-register-bar']");
  const modal = document.querySelector("[data-testid='auth-modal']");
  const body = JSON.stringify({ event: "vp_debug", source: stage, path: window.location.pathname, standalone: !!standalone, meta: {
    ih: window.innerHeight, iw: window.innerWidth, vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null,
    screenH: window.screen.height, clientH: document.documentElement.clientHeight, safeBottom: safeBottom(),
    bar: rect(bar), barVis: bar ? getComputedStyle(bar).visibility : null, barCss: bar ? [getComputedStyle(bar).height, getComputedStyle(bar).marginBottom, getComputedStyle(bar).paddingBottom] : null,
    modal: rect(modal), locked: document.body.classList.contains("gt-scroll-locked"), bodyPos: getComputedStyle(document.body).position,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content, scrollY: Math.round(window.scrollY) } });
  try { fetch(`${process.env.REACT_APP_BACKEND_URL}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch {}
}

if (isIOS) {
  setTimeout(() => debug("load"), 1500);
  new MutationObserver(() => { if (document.body.classList.contains("gt-scroll-locked")) setTimeout(() => debug("modal_open"), 500); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
