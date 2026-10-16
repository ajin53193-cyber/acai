// The window is the page scroller everywhere; #site-scroll helpers stay harmless if an inner scroller is ever reintroduced.
export const getScroller = () => document.getElementById("site-scroll");

export function scrollPageTo(opts = { top: 0 }) {
  const o = typeof opts === "number" ? { top: opts } : opts;
  getScroller()?.scrollTo(o);
  window.scrollTo(o);
}

export const pageScrollY = () => Math.max(window.scrollY || 0, getScroller()?.scrollTop || 0);

export function onPageScroll(fn, opts = { passive: true }) {
  const el = getScroller();
  window.addEventListener("scroll", fn, opts);
  el?.addEventListener("scroll", fn, opts);
  return () => { window.removeEventListener("scroll", fn); el?.removeEventListener("scroll", fn); };
}
