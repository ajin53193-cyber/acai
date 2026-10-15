import { useEffect, useRef } from "react";

// Freezes background scroll while a fixed modal/sheet is open — applied globally
// to every Dialog/Sheet/AlertDialog. body becomes position:fixed (inset-based, see
// `html body.gt-scroll-locked` in index.css which also beats react-remove-scroll's
// `position: relative !important`) so iOS cannot scroll the window when the
// keyboard opens inside a modal. Any residual window scroll while locked is undone.
//
// IMPORTANT: Must be rendered as a CHILD of the Radix *Primitive.Content, which is
// only mounted when the dialog is actually open (Radix Presence).
const activeLocks = new Set();
let savedScrollY = 0;
let savedStyles = null;
let listening = false;

function resetWindowScroll() {
  if (activeLocks.size === 0) return;
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
}

function setListening(on) {
  if (on === listening) return;
  listening = on;
  const m = on ? "addEventListener" : "removeEventListener";
  window[m]("scroll", resetWindowScroll, { passive: true });
}

function reconcile() {
  const b = document.body;
  if (activeLocks.size > 0 && !savedStyles) {
    const h = document.documentElement;
    savedScrollY = window.scrollY;
    savedStyles = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, bottom: b.style.bottom, overflow: b.style.overflow, htmlOverflow: h.style.overflow };
    b.style.position = "fixed";
    b.style.top = `-${savedScrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.bottom = "0";
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
    b.style.bottom = savedStyles.bottom;
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
export function ScrollLock() {
  useScrollLock(true);
  return null;
}
