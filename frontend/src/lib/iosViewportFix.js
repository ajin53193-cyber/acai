// iOS (esp. "Add to Home Screen" standalone PWA) bug: once the software keyboard
// has opened, window.innerHeight / 100dvh shrink and never grow back, so every
// position:fixed bottom bar / full-height sheet floats too high for the session.
// Fix: after the keyboard closes, force WebKit to re-measure the viewport by
// flipping display on full-viewport-height elements with a synchronous reflow.
// Several strategies are tried in turn until innerHeight recovers.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let maxVH = window.innerHeight;
let lastW = window.innerWidth;
let timer = null;
let attempt = 0;
let probe = null;
let debugSent = 0;

function debug(stage) {
  if (debugSent >= 40) return;
  debugSent += 1;
  const vv = window.visualViewport;
  const root = document.getElementById("root");
  const body = JSON.stringify({ event: "vp_debug", source: stage, path: window.location.pathname, standalone: !!standalone, meta: {
    ih: window.innerHeight, iw: window.innerWidth, vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null, vvScale: vv ? +vv.scale.toFixed(2) : null,
    screenH: window.screen.height, screenW: window.screen.width, maxVH, expected: expectedHeight(), stuck: isStuck(), kb: keyboardOpen(), attempt,
    clientH: document.documentElement.clientHeight, docH: document.documentElement.scrollHeight, rootH: root ? Math.round(root.getBoundingClientRect().height) : null,
    bodyPos: document.body.style.position, scrollY: Math.round(window.scrollY), active: document.activeElement?.tagName || "" } });
  try { fetch(`${process.env.REACT_APP_BACKEND_URL}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch {}
}

function expectedHeight() {
  if (!standalone) return maxVH;
  const portrait = window.innerWidth <= Math.min(window.screen.width, window.screen.height);
  const full = portrait ? Math.max(window.screen.width, window.screen.height) : Math.min(window.screen.width, window.screen.height);
  return Math.max(maxVH, full);
}

function keyboardOpen() {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return true;
  const vv = window.visualViewport;
  return !!vv && window.innerHeight - vv.height > 60;
}

const isStuck = () => expectedHeight() - window.innerHeight > 4;

function flip(el) {
  const prev = el.style.display;
  el.style.display = "none";
  void el.offsetHeight;
  el.style.display = prev;
}

function getProbe() {
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("data-vp-probe", "");
    probe.style.cssText = "position:fixed;inset:0;pointer-events:none;visibility:hidden;z-index:-1";
    document.body.appendChild(probe);
  }
  return probe;
}

const STRATEGIES = [
  () => { const r = document.getElementById("root"); if (r) flip(r); },
  () => flip(getProbe()),
  () => { const y = window.scrollY; flip(document.body); window.scrollTo(0, y); },
  () => { const h = document.documentElement; const prev = h.style.height; h.style.height = "100.5vh"; void h.offsetHeight; h.style.height = prev; },
  () => { const y = window.scrollY; flip(document.documentElement); window.scrollTo(0, y); },
];

export function healViewport() {
  if (document.hidden || keyboardOpen() || !isStuck()) { if (attempt) debug("healed"); attempt = 0; return; }
  if (attempt === STRATEGIES.length * 2) { debug("gave_up"); attempt += 1; return; }
  if (attempt > STRATEGIES.length * 2) return;
  if (attempt === 0) debug("heal_start");
  const y = window.scrollY;
  STRATEGIES[attempt % STRATEGIES.length]();
  if (window.scrollY !== y) window.scrollTo(0, y);
  attempt += 1;
  clearTimeout(timer);
  timer = setTimeout(healViewport, 160);
}

function scheduleHeal() {
  attempt = 0;
  clearTimeout(timer);
  timer = setTimeout(healViewport, 140);
}

function onResize() {
  if (window.innerWidth !== lastW) { lastW = window.innerWidth; maxVH = window.innerHeight; return; }
  maxVH = Math.max(maxVH, window.innerHeight);
}

if (isIOS) {
  setTimeout(() => debug("load"), 1500);
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", () => { if (keyboardOpen()) debug("kb_open"); });
  document.addEventListener("focusin", () => setTimeout(() => debug("focusin"), 600), true);
  window.addEventListener("orientationchange", () => { setTimeout(() => { lastW = window.innerWidth; maxVH = window.innerHeight; }, 300); });
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) scheduleHeal();
  }, true);
  window.visualViewport?.addEventListener("resize", () => { if (!keyboardOpen()) scheduleHeal(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleHeal(); });
  document.addEventListener("touchend", () => { if (!keyboardOpen() && isStuck()) scheduleHeal(); }, { passive: true });
  setInterval(() => { if (!document.hidden && !keyboardOpen() && isStuck() && attempt === 0) scheduleHeal(); }, 1500);
}
