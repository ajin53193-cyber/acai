// Home-screen app (iOS standalone): on some iPhones the layout viewport is shorter than the screen by the status-bar
// height (vp_debug telemetry: innerHeight 912 vs clientHeight 844). At the end of a scroll iOS then slides the visible
// area past the layout viewport and `position: fixed` elements drift up. Pin the header to the visual viewport through
// --vv-top, which stays 0 whenever nothing drifts. Uses `top` (not transform) so the header's fixed children keep working.
import { isStandalone } from "@/lib/track";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

if (typeof window !== "undefined" && window.visualViewport && isStandalone()) {
  const vv = window.visualViewport;
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    frame = 0;
    // Keyboard open or pinch zoom: iOS moves the visual viewport on purpose, keep the previous behaviour.
    const typing = document.activeElement?.matches?.(EDITABLE);
    const top = typing || vv.scale > 1.01 ? 0 : Math.max(0, Math.round(vv.offsetTop));
    root.style.setProperty("--vv-top", `${top}px`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  vv.addEventListener("scroll", schedule);
  vv.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, { passive: true });
  document.addEventListener("focusout", () => setTimeout(schedule, 50));
  update();
}
