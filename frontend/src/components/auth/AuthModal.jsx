import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { Link } from "react-router-dom";
import { X, Apple, Home, Gift } from "lucide-react";
import { INFO_CONTENT } from "@/pages/Info";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput, toE164, isValidPhone } from "./PhoneInput";
import { ForgotPassword } from "./ForgotPassword";
import { Register } from "./Register";
import { tr } from "@/i18n";
import { publicApi } from "@/lib/api";

const apiErr = (e, fallback) => e?.response?.data?.detail || e?.errors?.[0]?.message || fallback;

const Ctx = createContext({ openAuth: () => {} });
export const useAuthModal = () => useContext(Ctx);

export function AuthModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openAuth = useCallback(() => setOpen(true), []);
  return (
    <Ctx.Provider value={{ openAuth }}>
      {children}
      <AuthModal open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

const TABS = [
  ["account", tr("帳號登入")],
  ["email", tr("驗證碼登入")],
];

function AuthModal({ open, onOpenChange }) {
  const { signIn, setActive: setSignInActive, isLoaded: siLoaded } = useSignIn();
  const [tab, setTab] = useState("account");
  const [doc, setDoc] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dialCode, setDialCode] = useState("+886");
  const [view, setView] = useState("login");
  const [trust, setTrust] = useState(null);

  const switchTab = (t) => {
    setTab(t);
    setSent(false);
    setCode("");
    setTrust(null);
  };

  const resendTrust = async () => {
    if (!trust) return;
    await signIn.prepareSecondFactor(
      trust.strategy === "email_code" ? { strategy: "email_code", emailAddressId: trust.emailAddressId } : { strategy: "phone_code", phoneNumberId: trust.phoneNumberId }
    );
    toast.success(tr("驗證碼已重新發送"));
  };

  const close = () => { onOpenChange(false); setView("login"); };

  // iOS PWA: keyboard open/close shifts fixed sheets; snap the window back and re-sync the sheet height.
  useEffect(() => {
    if (!open) return;
    const sync = () => {
      window.scrollTo(0, 0);
      const el = document.querySelector('[data-testid="auth-modal"]');
      if (el && window.innerWidth < 768) el.style.height = `${window.innerHeight}px`;
    };
    const onFocusOut = () => setTimeout(sync, 80);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    document.addEventListener("focusout", onFocusOut);
    sync();
    return () => { vv?.removeEventListener("resize", sync); document.removeEventListener("focusout", onFocusOut); };
  }, [open, view]);

  const finish = async (sessionId, setter) => {
    await setter({ session: sessionId });
    toast.success(tr("登入成功"));
    close();
  };

  const finishTicket = async (ticket) => {
    const r = await signIn.create({ strategy: "ticket", ticket });
    if (r.status !== "complete") throw new Error("ticket");
    await finish(r.createdSessionId, setSignInActive);
  };

  async function sendCode() {
    if (!siLoaded) return;
    if (!identifier) return toast.error(tab === "phone" ? tr("請輸入手機號碼") : tr("請輸入信箱"));
    const phoneFull = toE164(dialCode, identifier);
    if (tab === "phone" && !isValidPhone(phoneFull))
      return toast.error(tr("請輸入正確的手機號碼"));
    setLoading(true);
    try {
      if (tab === "email") await publicApi.post("/auth/email/send-code", { email: identifier.trim(), purpose: "login" });
      else await publicApi.post("/auth/email/phone/send-code", { phone: phoneFull, purpose: "login" });
      setSent(true);
      toast.success(tr("驗證碼已發送"));
    } catch (e) {
      toast.error(apiErr(e, tr("發送失敗，請稍後再試")));
    }
    setLoading(false);
  }

  async function submit() {
    if (!agree) return toast.error(tr("請先勾選同意條款與條件"));
    if (!siLoaded) return;
    setLoading(true);
    try {
      if (tab === "account") {
        if (!identifier || !password) {
          setLoading(false);
          return toast.error(tr("請輸入帳號與密碼"));
        }
        const raw = identifier.trim();
        const ident = raw.includes("@") ? raw : /^\+?\d[\d\s-]{5,}$/.test(raw) ? (raw.startsWith("+") ? raw.replace(/[\s-]/g, "") : toE164(dialCode, raw)) : raw;
        const r = await publicApi.post("/auth/email/password-login", { identifier: ident, password });
        return await finishTicket(r.data.ticket);
      } else {
        if (!sent) {
          setLoading(false);
          return sendCode();
        }
        if (!code) {
          setLoading(false);
          return toast.error(tr("請輸入驗證碼"));
        }
        if (tab === "email") {
          const r = await publicApi.post("/auth/email/verify", { email: identifier.trim(), code: code.trim() });
          return await finishTicket(r.data.ticket);
        }
        const r = await publicApi.post("/auth/email/phone/verify", { phone: toE164(dialCode, identifier), code: code.trim() });
        return await finishTicket(r.data.ticket);
      }
    } catch (e) {
      toast.error(apiErr(e, tr("登入失敗，請檢查輸入")));
    }
    setLoading(false);
  }

  async function oauth(strategy) {
    if (strategy === "oauth_google") {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("g_oauth_state", state);
      sessionStorage.setItem("g_oauth_return", window.location.pathname + window.location.search);
      const params = new URLSearchParams({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        redirect_uri: window.location.origin + "/auth/google",
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      return;
    }
    if (!siLoaded) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (e) {
      toast.error(e?.errors?.[0]?.message || tr("第三方登入暫時無法使用"));
    }
  }

  const codeTabs = tab !== "account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="auth-sheet !gap-0 max-md:!flex max-md:!flex-col safe-top-pad max-md:!inset-0 max-md:!translate-x-0 max-md:!translate-y-0 max-md:!left-0 max-md:!top-0 max-md:!w-full max-md:!max-w-none max-md:!h-full max-md:!max-h-none max-md:!rounded-none md:w-[calc(100%-1.5rem)] md:max-w-[420px] md:max-h-[92vh] overflow-x-hidden overflow-y-auto p-0 border-0 md:rounded-3xl grid-cols-[minmax(0,1fr)] [&>*]:min-w-0 bg-white"
        data-testid="auth-modal"
      >
        <DialogTitle className="sr-only">{tr("登入")}</DialogTitle>
        {/* mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 pt-3 pb-3 bg-white">
          <button onClick={close} data-testid="auth-home" className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#FDEBD9] text-orange-500 text-sm font-medium"><Home className="h-4 w-4" />{tr("首頁")}</button>
          <button onClick={close} data-testid="auth-close" className="h-8 w-8 -mt-3 rounded-full bg-[#FDEBD9] text-orange-500 flex items-center justify-center"><X className="h-5 w-5" /></button>
        </div>
        <div className="md:hidden flex items-center gap-2 bg-[#FCE7D2] px-4 py-2.5 text-sm font-bold text-orange-500"><Gift className="h-4 w-4" />{tr("新用戶註冊最高領9%優惠券")}</div>
        {/* desktop accent + close */}
        <div className="hidden md:block h-1.5 w-20 mx-auto mt-4 rounded-full bg-orange-500" />
        <button
          onClick={close}
          data-testid="auth-close-desktop"
          className="hidden md:flex absolute top-4 right-4 h-9 w-9 rounded-full bg-orange-50 text-orange-500 items-center justify-center hover:bg-orange-100"
        >
          <X className="h-5 w-5" />
        </button>

        {view === "forgot" ? (
          <ForgotPassword onBack={() => setView("login")} onClose={close} />
        ) : view === "register" ? (
          <Register onBack={() => setView("login")} onClose={close} finishTicket={finishTicket} />
        ) : (
        <div className="px-5 md:px-6 pb-6 pt-5 md:pt-3 w-full min-w-0 max-w-full">
          {/* tabs */}
          <div className="flex items-center gap-6 mb-6 md:mb-5">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                data-testid={`auth-tab-${key}`}
                onClick={() => switchTab(key === "email" && tab === "email" ? "email" : key === "email" ? "phone" : key)}
                className={`relative text-lg md:text-lg font-bold pb-1 transition-colors ${
                  (key === "account" ? tab === "account" : tab !== "account") ? "text-orange-500 md:text-orange-600" : "text-slate-800 md:text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                {(key === "account" ? tab === "account" : tab !== "account") && (
                  <span className="hidden md:block absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-7 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </div>

          {codeTabs && (
            <div className="flex items-center gap-2 mb-4" data-testid="auth-code-kind">
              {[["phone", tr("手機驗證碼")], ["email", tr("郵箱驗證碼")]].map(([k, l]) => (
                <button key={k} data-testid={`auth-code-kind-${k}`} onClick={() => switchTab(k)}
                  className={`h-8 px-4 rounded-full text-[13px] font-semibold transition-colors ${tab === k ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-500 hover:bg-orange-100"}`}>{l}</button>
              ))}
              <span className="ml-auto text-[11px] text-slate-400">{tr("僅限已註冊帳號")}</span>
            </div>
          )}
          {tab === "account" && trust && (
            <div className="text-sm font-bold text-orange-500 mb-4" data-testid="auth-trust-hint">{tr("新裝置安全驗證：請輸入發送至")} {trust.safeIdentifier || tr("您信箱")} {tr("的驗證碼")}</div>
          )}

          {/* fields */}
          <div className="space-y-3">
            {tab === "phone" ? (
              <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={identifier} onChange={setIdentifier} />
            ) : (
              <input
                data-testid="auth-identifier"
                size={1}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={tab === "account" ? tr("信箱 / 手機號 / 帳號") : tr("信箱")}
                className="w-full min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
              />
            )}

            {tab === "account" && trust ? (
              <div className="relative flex items-center gap-2 w-full">
                <input
                  data-testid="auth-trust-code"
                  size={1}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tr("新裝置驗證碼")}
                  inputMode="numeric"
                  className="flex-1 min-w-0 basis-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
                />
                <button data-testid="auth-trust-resend" onClick={resendTrust} className="shrink-0 h-12 md:h-14 px-3 md:px-4 rounded-full md:rounded-2xl bg-orange-100 text-orange-500 md:text-orange-600 font-medium md:font-bold text-sm hover:bg-orange-200 whitespace-nowrap max-md:absolute max-md:right-1.5 max-md:top-1/2 max-md:-translate-y-1/2 max-md:h-8 max-md:text-xs transition-colors">{tr("重新發送")}</button>
              </div>
            ) : tab === "account" ? (
              <input
                data-testid="auth-password"
                size={1}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr("密碼")}
                className="w-full min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
              />
            ) : (
              <div className="relative flex items-center gap-2 w-full">
                <input
                  data-testid="auth-code"
                  size={1}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tr("驗證碼")}
                  inputMode="numeric"
                  className="flex-1 min-w-0 basis-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
                />
                <button
                  data-testid="auth-send-code"
                  onClick={sendCode}
                  disabled={loading}
                  className="shrink-0 h-12 md:h-14 px-3 md:px-4 rounded-full md:rounded-2xl bg-orange-100 md:bg-orange-100 text-orange-500 md:text-orange-600 font-medium md:font-bold text-sm hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap transition-colors max-md:absolute max-md:right-1.5 max-md:top-1/2 max-md:-translate-y-1/2 max-md:h-8 max-md:text-xs"
                >
                  {tr("發送驗證碼")}
                </button>
              </div>
            )}
          </div>

          {/* agree */}
          <label className="flex items-center justify-center md:justify-start gap-2 mt-5 text-[13px] md:text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="peer sr-only"
              data-testid="auth-agree"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span className="h-5 w-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center peer-checked:[&>svg]:opacity-100 shrink-0"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-0 transition-opacity" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>

            <span>
              {tr("已閱讀並同意")}{" "}
              <button type="button" data-testid="auth-terms-link" className="text-orange-500 hover:underline" onClick={(e) => { e.preventDefault(); setDoc("terms"); }}>{tr("條款與條件")}</button>{" "}
              {tr("和")}{" "}
              <button type="button" data-testid="auth-privacy-link" className="text-orange-500 hover:underline" onClick={(e) => { e.preventDefault(); setDoc("privacy"); }}>{tr("隱私權政策")}</button>
            </span>
          </label>

          {/* submit */}
          <div className="flex gap-3 mt-4 md:mt-5">
            <button
              data-testid="auth-submit"
              onClick={submit}
              disabled={loading}
              className="flex-1 h-12 md:h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base md:text-lg font-bold transition-colors disabled:opacity-60"
            >
              {loading ? tr("處理中…") : tr("登入")}
            </button>
            <button
              data-testid="auth-register"
              onClick={() => setView("register")}
              className="flex-1 h-12 md:h-14 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 text-base md:text-lg font-bold transition-colors"
            >
              {tr("註冊")}
            </button>
          </div>

          {/* helper links */}
          <div className="flex items-center justify-between mt-3 md:mt-4 px-3 md:px-0 text-[13px] md:text-sm text-slate-500">
            <button data-testid="auth-resend" onClick={sendCode} className="hover:text-orange-500">{tr("收不到驗證碼？")}</button>
            <button data-testid="auth-forgot" onClick={() => setView("forgot")} className="hover:text-orange-500">{tr("忘記密碼？")}</button>
          </div>

          {/* divider */}
          <div className="flex items-center gap-3 my-6 max-md:my-3 max-md:-mx-5 max-md:px-5 max-md:py-3 max-md:[background-image:radial-gradient(#E5E7EB_1.5px,transparent_1.6px)] max-md:[background-size:14px_14px]">
            <span className="hidden md:block flex-1 h-px bg-slate-200" />
            <span className="text-sm text-slate-500 md:text-slate-400 mx-auto md:mx-0">{tr("其他方式登入")}</span>
            <span className="hidden md:block flex-1 h-px bg-slate-200" />
          </div>

          {/* social: Google + Apple only */}
          <div className="flex items-center justify-center gap-5">
            <button
              data-testid="auth-google"
              onClick={() => oauth("oauth_google")}
              className="h-11 w-11 md:h-14 md:w-14 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:shadow-md transition-shadow"
              aria-label={tr("Google 登入")}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-7 md:w-7">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
              </svg>
            </button>
            <button
              data-testid="auth-apple"
              onClick={() => oauth("oauth_apple")}
              className="h-11 w-11 md:h-14 md:w-14 rounded-full bg-black flex items-center justify-center hover:shadow-md transition-shadow"
              aria-label={tr("Apple 登入")}
            >
              <Apple className="h-5 w-5 md:h-7 md:w-7 text-white fill-white" />
            </button>
          </div>
        </div>
        )}
      {doc && (
          <div data-testid="auth-doc-overlay" className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-6" onClick={() => setDoc(null)}>
            <div data-testid="auth-doc-dialog" className="bg-white w-full max-w-md max-h-[80%] rounded-3xl p-5 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900">{INFO_CONTENT[doc].title}</h3>
                <button data-testid="auth-doc-close" onClick={() => setDoc(null)} className="h-8 w-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                {INFO_CONTENT[doc].body.map((t, i) => <p key={i}>{t}</p>)}
              </div>
              <button data-testid="auth-doc-ok" onClick={() => { setAgree(true); setDoc(null); }} className="mt-5 w-full h-11 rounded-full bg-orange-500 text-white font-bold text-sm">{tr("我已閱讀並同意")}</button>
            </div>
          </div>
        )}
        </DialogContent>
    </Dialog>
  );
}
