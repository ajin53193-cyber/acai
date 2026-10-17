// Hidden admin entry: set REACT_APP_ADMIN_PATH (e.g. "admin-x7k9q") so the console lives at /admin-x7k9q and /admin is a 404.
const seg = (process.env.REACT_APP_ADMIN_PATH || "admin").replace(/^\/+|\/+$/g, "") || "admin";
export const ADMIN_BASE = `/${seg}`;
export const ADMIN_LOGIN = `${ADMIN_BASE}/login`;
export const isAdminPath = (pathname) => pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`) || pathname.startsWith(`${ADMIN_BASE}?`);
