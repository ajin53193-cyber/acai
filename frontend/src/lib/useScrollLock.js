import { useEffect } from "react";

// Freezes background scroll while a fixed modal/sheet is open.
// Fixes iOS Safari (incl. mobile "desktop mode") bug where focusing an input
// inside a position:fixed container scrolls the whole window and pushes the
// panel off-screen. body:position:fixed removes any window-level scrollable
// area, so the browser scrolls the panel's internal overflow container instead.
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const scrollY = window.scrollY;
    const b = document.body;
    const prev = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width };
    b.style.position = "fixed";
    b.style.top = `-${scrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.left = prev.left;
      b.style.right = prev.right;
      b.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
