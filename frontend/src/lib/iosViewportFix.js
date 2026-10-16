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

if (isIOS && standalone) {
  // Home-screen app: after the keyboard WebKit can leave the layout viewport offset from the visual viewport
  // (header + content drift up under the status bar on the next scroll). Re-sync whenever we detect the drift.
  let healing = false;
  const heal = () => {
    const vv = window.visualViewport;
    if (healing || !vv || Math.abs(vv.scale - 1) > 0.01) return;
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (document.body.classList.contains("gt-scroll-locked")) return;
    const off = Math.round(vv.offsetTop);
    if (Math.abs(off) < 1) return;
    healing = true;
    const y = window.scrollY;
    window.scrollTo(0, Math.max(0, y + off));
    requestAnimationFrame(() => {
      if (Math.abs(vv.offsetTop) >= 1) { window.scrollTo(0, window.scrollY + 1); window.scrollTo(0, Math.max(0, window.scrollY - 1)); }
      healing = false;
      debug("heal_" + off);
    });
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; heal(); }); };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("touchend", () => setTimeout(heal, 120), { passive: true });
  document.addEventListener("focusout", () => { setTimeout(heal, 150); setTimeout(heal, 600); });
  window.visualViewport?.addEventListener("resize", () => setTimeout(heal, 250));
  window.visualViewport?.addEventListener("scroll", schedule);
}

if (isIOS) {
  // Safari ignores user-scalable=no: block pinch zoom (gesture events) and double-tap zoom (touch-action in CSS)
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (e) => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
  // If the page is left zoomed (input focus / pinch), snap back to scale 1 by re-applying the viewport meta
  const resetZoom = () => {
    const vv = window.visualViewport;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!vv || !meta || vv.scale <= 1.01) return;
    const c = meta.content;
    meta.content = c + ", minimum-scale=1";
    requestAnimationFrame(() => { meta.content = c; });
  };
  document.addEventListener("focusout", () => setTimeout(resetZoom, 150));
  document.addEventListener("touchend", () => setTimeout(resetZoom, 300), { passive: true });
  window.visualViewport?.addEventListener("resize", () => setTimeout(resetZoom, 200));
  setTimeout(() => debug("load"), 1500);
  new MutationObserver(() => { if (document.body.classList.contains("gt-scroll-locked")) setTimeout(() => debug("modal_open"), 500); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
