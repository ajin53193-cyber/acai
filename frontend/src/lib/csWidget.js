// 站内客服聊天窗：供推文页多个按钮共享「打开聊天窗」能力，并判断客服系统是否启用
let opener = null;
let enabled = false;

export const registerCSWidget = (fn) => { opener = fn; };
export const setCSEnabled = (v) => { enabled = !!v; };
export const isCSEnabled = () => enabled;
export const openCSWidget = () => { if (opener) opener(); };

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
