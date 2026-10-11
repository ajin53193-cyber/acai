export function copyText(text) {
  const s = String(text ?? "");
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(s).catch(() => legacyCopy(s));
  }
  return Promise.resolve(legacyCopy(s));
}

function legacyCopy(s) {
  const ta = document.createElement("textarea");
  ta.value = s;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, s.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}
