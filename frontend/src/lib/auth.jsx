import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const KEY = "auth_token";
const Ctx = createContext(null);
const signedOut = { isLoaded: true, isSignedIn: false, user: null };

const toUser = (d, reload) => ({
  id: d.user_id,
  email: d.email || "",
  phone: d.phone || "",
  name: d.name || "",
  role: d.role,
  passwordEnabled: !!d.password_enabled,
  google: !!d.google,
  externalAccounts: d.google ? [{ provider: "google" }] : [],
  reload,
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({ isLoaded: false, isSignedIn: false, user: null });

  const load = useCallback(async () => {
    const token = localStorage.getItem(KEY);
    if (!token) return setState(signedOut);
    try {
      const r = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      setState({ isLoaded: true, isSignedIn: true, user: toUser(r.data, load) });
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) {
        localStorage.removeItem(KEY);
        localStorage.removeItem("admin_token");
        setState(signedOut);
      } else {
        setState((s) => ({ ...s, isLoaded: true }));
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => ({
    ...state,
    userId: state.user?.id || null,
    getToken: async () => localStorage.getItem(KEY) || null,
    signIn: async (token) => { localStorage.setItem(KEY, token); await load(); },
    signOut: async () => { localStorage.removeItem(KEY); localStorage.removeItem("admin_token"); setState(signedOut); },
    reload: load,
  }), [state, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const useAuthCtx = () => useContext(Ctx);
export const useUser = () => { const a = useAuthCtx(); return { user: a.user, isLoaded: a.isLoaded, isSignedIn: a.isSignedIn }; };
export const useAuth = () => { const a = useAuthCtx(); return { getToken: a.getToken, isLoaded: a.isLoaded, isSignedIn: a.isSignedIn, userId: a.userId, signOut: a.signOut }; };
export const useClerk = () => { const a = useAuthCtx(); return { signOut: a.signOut, session: a.isSignedIn ? { id: a.userId } : null, user: a.user }; };
export const useSession = () => { const a = useAuthCtx(); return { signIn: a.signIn, signOut: a.signOut, isLoaded: a.isLoaded, isSignedIn: a.isSignedIn, reload: a.reload }; };
export function Show({ when, children }) {
  const a = useAuthCtx();
  if (!a.isLoaded) return null;
  return (when === "signed-in") === a.isSignedIn ? children : null;
}
