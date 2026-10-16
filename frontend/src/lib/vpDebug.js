// Hidden iOS viewport diagnostics panel: toggle by tapping the header logo 5 times (persists in localStorage.vpdebug)
const KEY = "vpdebug";
let el = null, timer = 0;

const read = () => {
  const vv = window.visualViewport;
  const h = document.querySelector("header");
  const probe = document.getElementById("vp-probe");
  const sat = probe ? getComputedStyle(probe).paddingTop : "?";
  return [
    `scrollY ${Math.round(window.scrollY)}  docScrollTop ${Math.round(document.scrollingElement?.scrollTop || 0)}`,
    `vv.offsetTop ${vv ? Math.round(vv.offsetTop) : "-"}  vv.pageTop ${vv ? Math.round(vv.pageTop) : "-"}  vv.h ${vv ? Math.round(vv.height) : "-"}  scale ${vv ? vv.scale.toFixed(2) : "-"}`,
    `innerH ${window.innerHeight}  clientH ${document.documentElement.clientHeight}  screenH ${window.screen.height}`,
    `header.top ${h ? Math.round(h.getBoundingClientRect().top) : "-"}  header.h ${h ? Math.round(h.getBoundingClientRect().height) : "-"}  safeTop ${sat}`,
    `locked ${document.body.classList.contains("gt-scroll-locked")}  active ${document.activeElement?.tagName || "-"}  standalone ${window.navigator.standalone === true}`,
  ].join("\n");
};

const fixes = {
  "scrollTo(0,0)": () => window.scrollTo(0, 0),
  "scrollBy(-vvTop)": () => window.scrollBy(0, -(window.visualViewport?.offsetTop || 0)),
  "scroll 1→0": () => { window.scrollTo(0, 1); requestAnimationFrame(() => window.scrollTo(0, 0)); },
  "reflow body": () => { document.body.style.display = "none"; void document.body.offsetHeight; document.body.style.display = ""; },
  "viewport meta": () => { const m = document.querySelector('meta[name="viewport"]'); const c = m.content; m.content = c + ", minimum-scale=1"; requestAnimationFrame(() => { m.content = c; }); },
  "focus+blur": () => { const i = document.createElement("input"); i.style.cssText = "position:fixed;top:0;left:0;opacity:0;height:1px;width:1px;font-size:16px"; i.setAttribute("inputmode", "none"); document.body.appendChild(i); i.focus(); setTimeout(() => { i.blur(); i.remove(); }, 50); },
  "html height 100%": () => { const r = document.documentElement; r.style.height = r.style.height ? "" : "100%"; },
  "hide": () => toggle(false),
};

function build() {
  el = document.createElement("div");
  el.id = "vp-debug";
  el.style.cssText = "position:fixed;left:6px;right:6px;bottom:90px;z-index:99999;background:rgba(0,0,0,.82);color:#9ff;font:11px/1.45 monospace;padding:8px;border-radius:10px;white-space:pre;pointer-events:auto";
  const pre = document.createElement("div");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;white-space:normal";
  Object.entries(fixes).forEach(([k, fn]) => {
    const b = document.createElement("button");
    b.textContent = k;
    b.style.cssText = "font:11px monospace;padding:4px 7px;border-radius:6px;border:1px solid #9ff;background:#123;color:#fff";
    b.onclick = (e) => { e.preventDefault(); fn(); setTimeout(() => { pre.textContent = read(); }, 120); };
    row.appendChild(b);
  });
  const probe = document.createElement("div");
  probe.id = "vp-probe";
  probe.style.cssText = "position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top)";
  el.append(pre, row, probe);
  document.body.appendChild(el);
  timer = setInterval(() => { pre.textContent = read(); }, 300);
}

export function toggle(on) {
  const next = on ?? !el;
  localStorage.setItem(KEY, next ? "1" : "0");
  if (next && !el) build();
  if (!next && el) { clearInterval(timer); el.remove(); el = null; }
}

if (typeof window !== "undefined" && (localStorage.getItem(KEY) === "1" || new URLSearchParams(window.location.search).get(KEY) === "1")) {
  window.addEventListener("DOMContentLoaded", () => toggle(true));
  if (document.readyState !== "loading") setTimeout(() => toggle(true), 0);
}

let taps = 0, last = 0;
export function logoTap() {
  const now = Date.now();
  taps = now - last < 600 ? taps + 1 : 1;
  last = now;
  if (taps >= 5) { taps = 0; toggle(); }
}
