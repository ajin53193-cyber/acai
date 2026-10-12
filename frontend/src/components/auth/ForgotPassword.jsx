import { useState } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PhoneInput, toE164, isValidPhone } from "./PhoneInput";

const TABS = [
  ["email", "透過信箱"],
  ["phone", "透過手機"],
];

const field = "w-full min-w-0 h-14 rounded-2xl bg-slate-100 px-5 text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";

const validPassword = (p) => {
  if (p.length < 6 || p.length > 16) return false;
  const kinds = [/[0-9]/, /[a-zA-Z]/, /[^0-9a-zA-Z]/].filter((r) => r.test(p)).length;
  return kinds >= 2;
};

export function ForgotPassword({ onBack, onClose }) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [tab, setTab] = useState("email");
  const [identifier, setIdentifier] = useState("");
  const [dialCode, setDialCode] = useState("+886");
  const [code, setCode] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const strategy = tab === "email" ? "reset_password_email_code" : "reset_password_phone_code";

  const switchTab = (t) => { setTab(t); setSent(false); setCode(""); setIdentifier(""); };

  async function sendCode() {
    if (!isLoaded) return;
    const id = tab === "email" ? identifier.trim() : toE164(dialCode, identifier);
    if (!identifier) return toast.error(tab === "email" ? "請輸入註冊信箱" : "請輸入手機號碼");
    if (tab === "phone" && !isValidPhone(id)) return toast.error("請輸入正確的手機號碼");
    setLoading(true);
    try {
      await signIn.create({ strategy, identifier: id });
      setSent(true);
      toast.success("驗證碼已發送");
    } catch (e) {
      toast.error(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || "發送失敗，請確認帳號是否已註冊");
    }
    setLoading(false);
  }

  async function submit() {
    if (!agree) return toast.error("請先勾選同意條款與條件");
    if (!sent) return sendCode();
    if (!code) return toast.error("請輸入驗證碼");
    if (!validPassword(pw1)) return toast.error("密碼長度為6~16位，數字、字母、字元至少包含兩種");
    if (pw1 !== pw2) return toast.error("兩次輸入的密碼不一致");
    setLoading(true);
    try {
      const r = await signIn.attemptFirstFactor({ strategy, code: code.trim(), password: pw1 });
      if (r.status === "complete") {
        await setActive({ session: r.createdSessionId });
        toast.success("密碼已重設，已為您登入");
        onClose();
        return;
      }
      toast.error("需要額外驗證步驟，請聯繫客服");
    } catch (e) {
      toast.error(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || "重設失敗，請檢查驗證碼");
    }
    setLoading(false);
  }

  return (
    <div className="px-6 pb-6 pt-3 w-full min-w-0 max-w-full" data-testid="forgot-view">
      <div className="flex items-center gap-6 mb-6">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            data-testid={`forgot-tab-${key}`}
            onClick={() => switchTab(key)}
            className={`relative text-lg font-bold pb-1 transition-colors ${tab === key ? "text-orange-600" : "text-slate-700 hover:text-slate-900"}`}
          >
            {label}
            {tab === key && <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-7 rounded-full bg-orange-500" />}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === "phone" ? (
          <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={identifier} onChange={setIdentifier} testId="forgot-identifier" />
        ) : (
          <input data-testid="forgot-identifier" size={1} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="註冊信箱" className={field} />
        )}
        <div className="relative">
          <input data-testid="forgot-code" size={1} value={code} onChange={(e) => setCode(e.target.value)} placeholder="驗證碼" inputMode="numeric" className={`${field} pr-32`} />
          <button
            data-testid="forgot-send-code"
            onClick={sendCode}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3 rounded-xl bg-orange-100 text-orange-600 font-bold text-sm hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            發送驗證碼
          </button>
        </div>
        <input data-testid="forgot-password" size={1} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="請輸入新密碼" className={field} />
        <input data-testid="forgot-password-confirm" size={1} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="請確認新密碼" className={field} />
      </div>

      <div className="mt-3 text-xs text-slate-400 leading-relaxed">
        <div>1.密碼長度為6~16位，數字、字母、字元至少包含兩種；</div>
        <div>2.如未收到驗證碼請檢查廣告或垃圾郵件匣。</div>
      </div>

      <label className="flex items-center justify-center gap-2 mt-8 text-sm text-slate-600 cursor-pointer select-none">
        <input type="checkbox" data-testid="forgot-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-4 w-4 accent-orange-500" />
        <span>
          已閱讀並同意 <Link to="/info/terms" className="hover:text-orange-600" onClick={onClose}>條款與條件</Link> 和 <Link to="/info/privacy" className="hover:text-orange-600" onClick={onClose}>隱私權政策</Link>
        </span>
      </label>

      <button
        data-testid="forgot-submit"
        onClick={submit}
        disabled={loading}
        className="w-full h-14 mt-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold transition-colors disabled:opacity-60"
      >
        {loading ? "處理中…" : "重設密碼"}
      </button>

      <div className="text-center mt-4 text-sm text-slate-700">
        暫不重置，回傳 <button data-testid="forgot-back" onClick={onBack} className="text-orange-500 font-semibold hover:underline mx-1">登入</button> 頁
      </div>
    </div>
  );
}
