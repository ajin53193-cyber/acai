// iOS "Add to Home Screen" (standalone) WebKit bug: the layout viewport
// (documentElement.clientHeight / 100dvh / position:fixed bottom) gets stuck at a
// stale height while the real window (innerHeight) is taller — e.g. after launch
// or after the keyboard closes. Every fixed bottom bar / full-height sheet then
// stops short of the screen bottom. Fix: force WebKit to re-run viewport layout
// (meta viewport rewrite, display flips) until clientHeight == innerHeight.
// Standalone only — in Safari the toolbar makes innerHeight legitimately dynamic.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let maxVH = window.innerHeight;
let lastW = window.innerWidth;
let timer = null;
let attempt = 0;
let probe = null;
let debugSent = 0;

const layoutH = () => document.documentElement.clientHeight;

function keyboardOpen() {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return true;
  const vv = window.visualViewport;
  return !!vv && layoutH() - vv.height > 60;
}

function isStuck() {
  const ih = window.innerHeight;
  return ih - layoutH() > 4 || maxVH - ih > 4;
}

function debug(stage) {
  if (debugSent >= 40) return;
  debugSent += 1;
  const vv = window.visualViewport;
  const root = document.getElementById("root");
  const body = JSON.stringify({ event: "vp_debug", source: stage, path: window.location.pathname, standalone: !!standalone, meta: {
    ih: window.innerHeight, iw: window.innerWidth, vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null, vvScale: vv ? +vv.scale.toFixed(2) : null,
    screenH: window.screen.height, screenW: window.screen.width, maxVH, stuck: isStuck(), kb: keyboardOpen(), attempt,
    clientH: layoutH(), docH: document.documentElement.scrollHeight, rootH: root ? Math.round(root.getBoundingClientRect().height) : null,
    bodyPos: document.body.style.position, scrollY: Math.round(window.scrollY), active: document.activeElement?.tagName || "" } });
  try { fetch(`${process.env.REACT_APP_BACKEND_URL}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch {}
}

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

function rewriteViewportMeta(extra) {
  const m = document.querySelector('meta[name="viewport"]');
  if (!m) return;
  const base = m.getAttribute("data-base") || m.getAttribute("content");
  m.setAttribute("data-base", base);
  m.setAttribute("content", extra ? `${base}, ${extra}` : base);
}

const STRATEGIES = [
  () => { rewriteViewportMeta("minimum-scale=1"); void document.documentElement.offsetHeight; rewriteViewportMeta(""); },
  () => { const r = document.getElementById("root"); if (r) flip(r); },
  () => flip(getProbe()),
  () => { const h = document.documentElement; const prev = h.style.height; h.style.height = `${window.innerHeight}px`; void h.offsetHeight; h.style.height = prev; },
  () => { const y = window.scrollY; flip(document.body); window.scrollTo(0, y); },
  () => { const y = window.scrollY; flip(document.documentElement); window.scrollTo(0, y); },
];
const MAX_ATTEMPTS = STRATEGIES.length * 2;

export function healViewport() {
  if (document.hidden || keyboardOpen() || !isStuck()) { if (attempt) debug("healed"); attempt = 0; return; }
  if (attempt === MAX_ATTEMPTS) { debug("gave_up"); attempt += 1; return; }
  if (attempt > MAX_ATTEMPTS) return;
  if (attempt === 0) debug("heal_start");
  const y = window.scrollY;
  STRATEGIES[attempt % STRATEGIES.length]();
  if (window.scrollY !== y) window.scrollTo(0, y);
  attempt += 1;
  clearTimeout(timer);
  timer = setTimeout(healViewport, 160);
}

function scheduleHeal(delay = 140) {
  attempt = 0;
  clearTimeout(timer);
  timer = setTimeout(healViewport, delay);
}

function onResize() {
  if (window.innerWidth !== lastW) { lastW = window.innerWidth; maxVH = window.innerHeight; return; }
  maxVH = Math.max(maxVH, window.innerHeight);
}

if (isIOS && standalone) {
  setTimeout(() => debug("load"), 1500);
  window.addEventListener("resize", () => { onResize(); scheduleHeal(300); });
  window.addEventListener("orientationchange", () => { setTimeout(() => { lastW = window.innerWidth; maxVH = window.innerHeight; scheduleHeal(300); }, 300); });
  window.addEventListener("load", () => scheduleHeal(600));
  document.addEventListener("focusin", () => setTimeout(() => debug("focusin"), 600), true);
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) scheduleHeal();
  }, true);
  window.visualViewport?.addEventListener("resize", () => { if (keyboardOpen()) debug("kb_open"); else scheduleHeal(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleHeal(); });
  document.addEventListener("touchend", () => { if (attempt === 0 && !keyboardOpen() && isStuck()) scheduleHeal(); }, { passive: true });
  setInterval(() => { if (!document.hidden && !keyboardOpen() && isStuck() && attempt === 0) scheduleHeal(); }, 1500);
}
