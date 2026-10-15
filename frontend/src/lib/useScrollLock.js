import { useEffect, useRef } from "react";

// Freezes background scroll while a fixed modal/sheet is open — applied globally
// to every Dialog/Sheet/AlertDialog. Fixes the iOS Safari (incl. mobile "desktop
// mode") bug where focusing an input inside a position:fixed container scrolls the
// whole window and pushes the panel off-screen.
//
// Two layers of defense:
//  1. body:position:fixed removes the window-level scrollable area.
//  2. While locked, any layout-viewport scroll iOS still forces when the keyboard
//     opens is immediately undone (scrollTo 0,0), and the open panel is re-anchored
//     to the *visual* viewport (visualViewport.offsetTop/height) so the focused
//     input is already visible above the keyboard and Safari has no reason to pan.
//
// IMPORTANT: Must be rendered as a CHILD of the Radix *Primitive.Content, which is
// only mounted when the dialog is actually open (Radix Presence).
const activeLocks = new Set();
const followers = new Set();
let savedScrollY = 0;
let savedStyles = null;
let listening = false;
const FOLLOW_PROPS = ["top", "bottom", "height", "max-height", "overflow-y"];

function anchorToVisualViewport() {
  if (activeLocks.size === 0) return;
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  const vv = window.visualViewport;
  if (!vv) return;
  const shifted = vv.offsetTop > 1 || document.documentElement.clientHeight - vv.height > 60;
  followers.forEach(({ el, side }) => {
    if (!shifted) { FOLLOW_PROPS.forEach((p) => el.style.removeProperty(p)); return; }
    const set = (k, v) => el.style.setProperty(k, v, "important");
    set("max-height", `${vv.height}px`);
    set("overflow-y", "auto");
    if (side === "center") {
      set("top", `${vv.offsetTop + vv.height / 2}px`);
    } else if (side === "bottom") {
      const h = Math.min(el.offsetHeight, vv.height);
      set("bottom", "auto");
      set("top", `${vv.offsetTop + vv.height - h}px`);
    } else {
      set("bottom", "auto");
      set("top", `${vv.offsetTop}px`);
      if (side === "left" || side === "right") set("height", `${vv.height}px`);
    }
  });
}

let focusTimer = null;
function onFocusIn() {
  clearTimeout(focusTimer);
  focusTimer = setTimeout(anchorToVisualViewport, 350);
}

function setListening(on) {
  if (on === listening) return;
  listening = on;
  const vv = window.visualViewport;
  const m = on ? "addEventListener" : "removeEventListener";
  window[m]("scroll", anchorToVisualViewport, { passive: true });
  document[m]("focusin", onFocusIn);
  if (vv) { vv[m]("resize", anchorToVisualViewport); vv[m]("scroll", anchorToVisualViewport); }
}

function reconcile() {
  const b = document.body;
  if (activeLocks.size > 0 && !savedStyles) {
    savedScrollY = window.scrollY;
    const h = document.documentElement;
    savedStyles = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, height: b.style.height, overflow: b.style.overflow, htmlOverflow: h.style.overflow };
    b.style.position = "fixed";
    b.style.top = `-${savedScrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.height = "100%";
    b.style.overflow = "hidden";
    h.style.overflow = "hidden";
    b.classList.add("gt-scroll-locked");
    setListening(true);
  } else if (activeLocks.size === 0 && savedStyles) {
    setListening(false);
    b.classList.remove("gt-scroll-locked");
    b.style.position = savedStyles.position;
    b.style.top = savedStyles.top;
    b.style.left = savedStyles.left;
    b.style.right = savedStyles.right;
    b.style.width = savedStyles.width;
    b.style.height = savedStyles.height;
    b.style.overflow = savedStyles.overflow;
    document.documentElement.style.overflow = savedStyles.htmlOverflow;
    savedStyles = null;
    window.scrollTo(0, savedScrollY);
  }
}

export function useScrollLock(enabled = true) {
  const token = useRef(Symbol("scroll-lock"));
  useEffect(() => {
    if (!enabled) return;
    const t = token.current;
    activeLocks.add(t);
    reconcile();
    return () => { activeLocks.delete(t); reconcile(); };
  }, [enabled]);
}

// Render inside a Radix *Primitive.Content to lock background scroll only while open.
// `side`: "center" (dialog) | "left" | "right" | "top" | "bottom" (sheet).
export function ScrollLock({ side = "center" }) {
  useScrollLock(true);
  const marker = useRef(null);
  useEffect(() => {
    const el = marker.current?.parentElement;
    if (!el) return;
    const f = { el, side };
    followers.add(f);
    anchorToVisualViewport();
    return () => { followers.delete(f); FOLLOW_PROPS.forEach((p) => el.style.removeProperty(p)); };
  }, [side]);
  return <span ref={marker} hidden data-scroll-lock-marker="" />;
}
