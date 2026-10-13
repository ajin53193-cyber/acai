import zhCN from "./zh-CN.json";
import en from "./en.json";

export const LANGS = [["zh-CN", "简体中文"], ["zh-TW", "繁體中文"], ["en", "English"]];
const stored = typeof localStorage !== "undefined" ? localStorage.getItem("gt_lang") : null;
export const LANG = LANGS.some(([k]) => k === stored) ? stored : "zh-CN";
const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
export const API_LANG = isAdmin ? "" : LANG;
const UI_LANG = isAdmin ? "zh-CN" : LANG;
const dict = UI_LANG === "en" ? en : UI_LANG === "zh-CN" ? zhCN : null;

if (typeof document !== "undefined") document.documentElement.lang = UI_LANG;

export function tr(s, ...args) {
  let out = dict ? dict[s] ?? (UI_LANG === "en" ? zhCN[s] ?? s : s) : s;
  if (args.length) out = out.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m));
  return out;
}

export const setLang = (lang) => {
  localStorage.setItem("gt_lang", lang);
  window.location.reload();
};
