// iOS App Shell 配套：窗口本身不滚动（body fixed），但键盘弹出时 WebKit 仍可能把视口整体上推；键盘收起后把窗口归零。
import { isIOS } from "@/lib/track";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

if (typeof window !== "undefined" && isIOS()) {
  const reset = () => {
    if (document.activeElement?.matches?.(EDITABLE)) return;
    if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  document.addEventListener("focusout", () => { setTimeout(reset, 60); setTimeout(reset, 300); });
  window.visualViewport?.addEventListener("resize", () => setTimeout(reset, 60));
  window.addEventListener("scroll", () => { if (document.documentElement.classList.contains("shell")) reset(); }, { passive: true });
}
