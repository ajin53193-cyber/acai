// 站内客服聊天：供推文页按钮共享「是否启用」判断 + 在新窗口打开聊天页
let enabled = false;

export const setCSEnabled = (v) => { enabled = !!v; };
export const isCSEnabled = () => enabled;

// 在新窗口打开独立客服聊天页，携带推文 slug 与来源渠道（供分配/统计）
export const openCSChatWindow = (slug, source) => {
  const qs = new URLSearchParams();
  if (slug) qs.set("slug", slug);
  if (source) qs.set("src", source);
  if (document.referrer) qs.set("ref", document.referrer);
  const url = `/chat?${qs.toString()}`;
  window.open(url, "hy_cs_chat", "width=420,height=680,menubar=no,toolbar=no,location=no,resizable=yes");
};

const CS_SESSION_KEY = "hy_cs_session";

// 访客会话 ID（浏览器级持久化，保证刷新/再次访问能接上同一个客服会话）
export const csSessionId = () => {
  try {
    let v = localStorage.getItem(CS_SESSION_KEY);
    if (!v) {
      v = (crypto.randomUUID ? crypto.randomUUID() : `cs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(CS_SESSION_KEY, v);
    }
    return v;
  } catch {
    return `cs-${Date.now()}`;
  }
};
