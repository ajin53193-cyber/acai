import { useEffect, useRef } from "react";

// Freezes background scroll while a fixed modal/sheet is open — applied globally
// to every Dialog/Sheet/AlertDialog. Fixes the iOS Safari (incl. mobile "desktop
// mode") bug where focusing an input inside a position:fixed container scrolls the
// whole window and pushes the panel off-screen. body:position:fixed removes any
// window-level scrollable area, so the browser scrolls the panel's internal
// overflow container instead.
//
// IMPORTANT: Must be rendered as a CHILD of the Radix *Primitive.Content, which is
// only mounted when the dialog is actually open (Radix Presence). Mounting the hook
// at the wrapper level would lock scroll even while closed, because wrappers like
// CartDrawer/AuthModal render <SheetContent>/<DialogContent> unconditionally.
const activeLocks = new Set();
let savedScrollY = 0;
let savedStyles = null;

function reconcile() {
  const b = document.body;
  if (activeLocks.size > 0 && !savedStyles) {
    savedScrollY = window.scrollY;
    savedStyles = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width };
    b.style.position = "fixed";
    b.style.top = `-${savedScrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
  } else if (activeLocks.size === 0 && savedStyles) {
    b.style.position = savedStyles.position;
    b.style.top = savedStyles.top;
    b.style.left = savedStyles.left;
    b.style.right = savedStyles.right;
    b.style.width = savedStyles.width;
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
