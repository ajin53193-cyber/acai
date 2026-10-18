// 全站统一按北京时间 (Asia/Shanghai, UTC+8) 显示时间
export const BJ_TZ = "Asia/Shanghai";

const toDate = (s) => {
  if (s instanceof Date) return s;
  if (typeof s === "number") return new Date(s);
  if (!s) return null;
  let str = String(s);
  // 无时区标记的 ISO 字符串一律按 UTC 解析（后端存的是 UTC）
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str) && !/(Z|[+-]\d{2}:?\d{2})$/.test(str)) str = str.replace(" ", "T") + "Z";
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: BJ_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function bjParts(s) {
  const d = toDate(s);
  if (!d) return null;
  const p = {};
  FMT.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  if (p.hour === "24") p.hour = "00";
  return p;
}

// mode: datetime(默认 YYYY-MM-DD HH:mm:ss) | minute(YYYY-MM-DD HH:mm) | date(YYYY-MM-DD) | short(MM-DD HH:mm) | time(HH:mm:ss)
export function fmtBJ(s, mode = "datetime") {
  const p = bjParts(s);
  if (!p) return s ? String(s) : "-";
  const date = `${p.year}-${p.month}-${p.day}`;
  if (mode === "date") return date;
  if (mode === "minute") return `${date} ${p.hour}:${p.minute}`;
  if (mode === "short") return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
  if (mode === "time") return `${p.hour}:${p.minute}:${p.second}`;
  return `${date} ${p.hour}:${p.minute}:${p.second}`;
}

export const bjToday = () => fmtBJ(new Date(), "date");

// 让全站所有 Date.prototype.toLocale*String() 默认使用北京时区
export function installBJLocale() {
  ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].forEach((k) => {
    const orig = Date.prototype[k];
    Date.prototype[k] = function (loc, opts) { return orig.call(this, loc, { timeZone: BJ_TZ, ...(opts || {}) }); };
  });
}
