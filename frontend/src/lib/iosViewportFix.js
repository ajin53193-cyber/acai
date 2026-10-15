// iOS (esp. "Add to Home Screen" standalone PWA) bug: once the software keyboard
// has opened, window.innerHeight / 100dvh shrink and never grow back, so every
// position:fixed bottom bar floats too high for the rest of the session.
// Fix: after the keyboard closes, force WebKit to re-measure the viewport by
// flipping display on the full-height #root element with a synchronous reflow.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;

let maxVH = window.innerHeight;
let lastW = window.innerWidth;
const timers = [];

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

export function healViewport() {
  if (keyboardOpen() || expectedHeight() - window.innerHeight <= 4) return;
  const el = document.getElementById("root");
  if (!el) return;
  const y = window.scrollY;
  el.style.display = "none";
  void el.offsetHeight;
  el.style.display = "";
  window.scrollTo(0, y);
}

function scheduleHeal() {
  timers.forEach(clearTimeout);
  timers.length = 0;
  [140, 450, 900].forEach((ms) => timers.push(setTimeout(healViewport, ms)));
}

function onResize() {
  if (window.innerWidth !== lastW) { lastW = window.innerWidth; maxVH = window.innerHeight; return; }
  maxVH = Math.max(maxVH, window.innerHeight);
}

if (isIOS) {
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => { setTimeout(() => { lastW = window.innerWidth; maxVH = window.innerHeight; }, 300); });
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) scheduleHeal();
  }, true);
  window.visualViewport?.addEventListener("resize", () => { if (!keyboardOpen()) scheduleHeal(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleHeal(); });
}
