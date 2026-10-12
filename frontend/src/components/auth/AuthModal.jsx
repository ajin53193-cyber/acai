import { createContext, useContext, useState, useCallback } from "react";
import { useSignIn, useSignUp } from "@clerk/react/legacy";
import { Link } from "react-router-dom";
import { X, Apple } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput, toE164, isValidPhone } from "./PhoneInput";
import { ForgotPassword } from "./ForgotPassword";

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
  ["email", "信箱登入"],
  ["phone", "手機登入"],
  ["account", "帳號登入"],
];

function AuthModal({ open, onOpenChange }) {
  const { signIn, setActive: setSignInActive, isLoaded: siLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: suLoaded } = useSignUp();
  const [tab, setTab] = useState("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dialCode, setDialCode] = useState("+886");
  const [view, setView] = useState("login");

  const switchTab = (t) => {
    setTab(t);
    setSent(false);
    setCode("");
    setIsSignUp(false);
  };

  const close = () => { onOpenChange(false); setView("login"); };

  const finish = async (sessionId, setter) => {
    await setter({ session: sessionId });
    toast.success("登入成功");
    close();
    window.location.assign("/");
  };

  async function sendCode() {
    if (!siLoaded || !suLoaded) return;
    if (!identifier) return toast.error(tab === "phone" ? "請輸入手機號碼" : "請輸入信箱");
    const phoneFull = toE164(dialCode, identifier);
    if (tab === "phone" && !isValidPhone(phoneFull))
      return toast.error("請輸入正確的手機號碼");
    setLoading(true);
    try {
      try {
        const createId = tab === "phone" ? phoneFull : identifier;
        const r = await signIn.create({ identifier: createId });
        const strat = tab === "email" ? "email_code" : "phone_code";
        const f = r.supportedFirstFactors?.find((x) => x.strategy === strat);
        if (!f) throw new Error("no-factor");
        await signIn.prepareFirstFactor(
          tab === "email"
            ? { strategy: "email_code", emailAddressId: f.emailAddressId }
            : { strategy: "phone_code", phoneNumberId: f.phoneNumberId }
        );
        setIsSignUp(false);
      } catch (e) {
        if (tab === "email") {
          await signUp.create({ emailAddress: identifier });
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        } else {
          await signUp.create({ phoneNumber: phoneFull });
          await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        }
        setIsSignUp(true);
      }
      setSent(true);
      toast.success("驗證碼已發送");
    } catch (e) {
      toast.error(e?.errors?.[0]?.message || "發送失敗，請稍後再試");
    }
    setLoading(false);
  }

  async function submit() {
    if (!agree) return toast.error("請先勾選同意條款與條件");
    if (!siLoaded || !suLoaded) return;
    setLoading(true);
    try {
      if (tab === "account") {
        if (!identifier || !password) {
          setLoading(false);
          return toast.error("請輸入帳號與密碼");
        }
        const r = await signIn.create({ identifier, password });
        if (r.status === "complete") return await finish(r.createdSessionId, setSignInActive);
        toast.error(r.status === "needs_client_trust" ? "瀏覽器環境驗證未通過，請改用一般瀏覽器重試" : "需要額外驗證步驟");
      } else {
        if (!sent) {
          setLoading(false);
          return sendCode();
        }
        if (!code) {
          setLoading(false);
          return toast.error("請輸入驗證碼");
        }
        if (isSignUp) {
          const r =
            tab === "email"
              ? await signUp.attemptEmailAddressVerification({ code })
              : await signUp.attemptPhoneNumberVerification({ code });
          if (r.status === "complete") return await finish(r.createdSessionId, setSignUpActive);
          toast.error("註冊尚需補充資料");
        } else {
          const r = await signIn.attemptFirstFactor({
            strategy: tab === "email" ? "email_code" : "phone_code",
            code,
          });
          if (r.status === "complete") return await finish(r.createdSessionId, setSignInActive);
          toast.error("驗證未完成");
        }
      }
    } catch (e) {
      toast.error(e?.errors?.[0]?.message || "登入失敗，請檢查輸入");
    }
    setLoading(false);
  }

  async function oauth(strategy) {
    if (!siLoaded) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (e) {
      toast.error(e?.errors?.[0]?.message || "第三方登入暫時無法使用");
    }
  }

  const codeTabs = tab !== "account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        style={{ width: "calc(100% - 1.5rem)", maxWidth: "420px" }}
        className="max-h-[92vh] overflow-x-hidden overflow-y-auto p-0 rounded-3xl border-0 grid-cols-[minmax(0,1fr)] [&>*]:min-w-0"
        data-testid="auth-modal"
      >
        {/* top accent */}
        <DialogTitle className="sr-only">登入</DialogTitle>
        <div className="h-1.5 w-20 mx-auto mt-4 rounded-full bg-orange-500" />
        <button
          onClick={close}
          data-testid="auth-close"
          className="absolute top-4 right-4 h-9 w-9 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-100"
        >
          <X className="h-5 w-5" />
        </button>

        {view === "forgot" ? (
          <ForgotPassword onBack={() => setView("login")} onClose={close} />
        ) : (
        <div className="px-6 pb-6 pt-3 w-full min-w-0 max-w-full">
          {/* tabs */}
          <div className="flex items-center gap-6 mb-5">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                data-testid={`auth-tab-${key}`}
                onClick={() => switchTab(key)}
                className={`relative text-lg font-bold pb-1 transition-colors ${
                  tab === key ? "text-orange-600" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                {tab === key && (
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-7 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </div>

          {codeTabs && (
            <div className="text-sm font-bold text-orange-500 mb-4">新用戶首次登入將自動註冊</div>
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
                placeholder={tab === "account" ? "信箱 / 帳號" : "信箱"}
                className="w-full min-w-0 h-14 rounded-2xl bg-slate-100 px-5 text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
              />
            )}

            {tab === "account" ? (
              <input
                data-testid="auth-password"
                size={1}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密碼"
                className="w-full min-w-0 h-14 rounded-2xl bg-slate-100 px-5 text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
              />
            ) : (
              <div className="flex items-center gap-2 w-full">
                <input
                  data-testid="auth-code"
                  size={1}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="驗證碼"
                  inputMode="numeric"
                  className="flex-1 min-w-0 basis-0 h-14 rounded-2xl bg-slate-100 px-5 text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
                />
                <button
                  data-testid="auth-send-code"
                  onClick={sendCode}
                  disabled={loading}
                  className="shrink-0 h-14 px-4 rounded-2xl bg-orange-100 text-orange-600 font-bold text-sm hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  發送驗證碼
                </button>
              </div>
            )}
          </div>

          {/* agree */}
          <label className="flex items-center gap-2 mt-5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="auth-agree"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="h-4 w-4 accent-orange-500"
            />
            <span>
              已閱讀並同意{" "}
              <Link to="/info/terms" className="text-orange-600 hover:underline" onClick={close}>條款與條件</Link>{" "}
              和{" "}
              <Link to="/info/privacy" className="text-orange-600 hover:underline" onClick={close}>隱私權政策</Link>
            </span>
          </label>

          {/* submit */}
          <button
            data-testid="auth-submit"
            onClick={submit}
            disabled={loading}
            className="w-full h-14 mt-5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold transition-colors disabled:opacity-60"
          >
            {loading ? "處理中…" : "登入"}
          </button>

          {/* helper links */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <button data-testid="auth-resend" onClick={sendCode} className="hover:text-orange-500">收不到驗證碼？</button>
            <button data-testid="auth-forgot" onClick={() => setView("forgot")} className="hover:text-orange-500">忘記密碼？</button>
          </div>

          {/* divider */}
          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-sm text-slate-400">其他方式登入</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          {/* social: Google + Apple only */}
          <div className="flex items-center justify-center gap-5">
            <button
              data-testid="auth-google"
              onClick={() => oauth("oauth_google")}
              className="h-14 w-14 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:shadow-md transition-shadow"
              aria-label="Google 登入"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
              </svg>
            </button>
            <button
              data-testid="auth-apple"
              onClick={() => oauth("oauth_apple")}
              className="h-14 w-14 rounded-full bg-black flex items-center justify-center hover:shadow-md transition-shadow"
              aria-label="Apple 登入"
            >
              <Apple className="h-7 w-7 text-white fill-white" />
            </button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
