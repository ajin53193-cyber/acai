const SOURCE_KEY = "hy_source";

const SOURCE_LABELS = {
  pyq: "朋友圈",
  gzh: "公众号",
  haibao: "海报",
  wx: "微信",
  dy: "抖音",
  xhs: "小红书",
  zhihu: "知乎",
};

// 页面加载时从 URL 捕获 ?from= / ?utm_source= / ?channel= 参数，会话内持续携带
export const captureSource = () => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const src = sp.get("from") || sp.get("utm_source") || sp.get("channel") || "";
    if (src) sessionStorage.setItem(SOURCE_KEY, src.slice(0, 50));
  } catch { /* ignore */ }
};

export const getSource = () => {
  try {
    return sessionStorage.getItem(SOURCE_KEY) || "";
  } catch {
    return "";
  }
};

export const sourceLabel = (s) => SOURCE_LABELS[s] || s || "直接访问";
