// Hidden admin entry: console lives at /gg589-k7p2x by default (override with REACT_APP_ADMIN_PATH); /admin is a 404.
const DEFAULT_SECRET = "gg589-k7p2x";
const seg = (process.env.REACT_APP_ADMIN_PATH || DEFAULT_SECRET).replace(/^\/+|\/+$/g, "") || DEFAULT_SECRET;
export const ADMIN_BASE = `/${seg}`;
export const ADMIN_LOGIN = `${ADMIN_BASE}/login`;
export const isAdminPath = (pathname) => pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`) || pathname.startsWith(`${ADMIN_BASE}?`);
