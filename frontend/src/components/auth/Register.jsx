import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { PhoneInput, toE164, isValidPhone } from "./PhoneInput";
import { tr } from "@/i18n";

const field = "w-full min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
const apiErr = (e, fallback) => e?.response?.data?.detail || e?.errors?.[0]?.message || fallback;
const validPassword = (p) => p.length >= 8 && p.length <= 32 && [/[0-9]/, /[a-zA-Z]/, /[^0-9a-zA-Z]/].filter((r) => r.test(p)).length >= 2;

export function Register({ onBack, onClose, finishTicket }) {
  const [kind, setKind] = useState("phone");
  const refCode = (typeof window !== "undefined" && localStorage.getItem("ref_code")) || "";
  const [dialCode, setDialCode] = useState("+886");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const switchKind = (k) => { setKind(k); setEmail(""); setCode(""); setSent(false); };

  const sendCode = async () => {
    if (!email.trim()) return toast.error(kind === "phone" ? tr("請輸入手機號碼") : tr("請輸入信箱"));
    setLoading(true);
    try {
      if (kind === "phone") {
        const phone = toE164(dialCode, email);
        if (!isValidPhone(phone)) throw { detail: tr("請輸入正確的手機號碼") };
        await publicApi.post("/auth/email/phone/send-code", { phone, purpose: "register" });
      } else {
        await publicApi.post("/auth/email/send-code", { email: email.trim(), purpose: "register" });
      }
      setSent(true);
      toast.success(tr("驗證碼已發送"));
    } catch (e) {
      toast.error(e?.detail || apiErr(e, tr("發送失敗，請稍後再試")));
    }
    setLoading(false);
  };

  const submit = async () => {
    if (!agree) return toast.error(tr("請先勾選同意條款與條件"));
    if (!sent) return sendCode();
    if (!code.trim()) return toast.error(tr("請輸入驗證碼"));
    if (!validPassword(pw1)) return toast.error(tr("密碼長度為8~32位，數字、字母、符號至少包含兩種"));
    if (pw1 !== pw2) return toast.error(tr("兩次輸入的密碼不一致"));
    setLoading(true);
    try {
      if (kind === "phone") {
        const r = await publicApi.post("/auth/email/phone/register", { phone: toE164(dialCode, email), code: code.trim(), password: pw1 });
        toast.success(tr("註冊成功"));
        await finishTicket(r.data.ticket);
        return;
      }
      const r = await publicApi.post("/auth/email/register", { email: email.trim(), code: code.trim(), password: pw1 });
      toast.success(tr("註冊成功"));
      await finishTicket(r.data.ticket);
    } catch (e) { toast.error(e?.detail || apiErr(e, tr("註冊失敗，請稍後再試"))); }
    setLoading(false);
  };

  return (
    <div className="px-5 md:px-6 pb-6 pt-3 w-full min-w-0 max-w-full" data-testid="register-view">
      <div className="flex items-center gap-6 mb-4">
        <span className="relative text-lg font-bold pb-1 text-orange-600">{tr("註冊帳號")}<span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-7 rounded-full bg-orange-500" /></span>
      </div>
      {refCode && (
        <div data-testid="register-ref-banner" className="flex items-center gap-2 mb-4 rounded-2xl bg-orange-50 px-4 py-2.5 text-sm text-orange-600">
          <span className="font-semibold">{tr("邀請碼")}</span>
          <span className="font-head font-extrabold tracking-widest">{refCode}</span>
          <span className="text-xs text-orange-400 ml-auto">{tr("註冊後自動綁定，好友獲得抽獎機會")}</span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4" data-testid="register-kind">
        {[["phone", tr("手機號碼註冊")], ["email", tr("郵箱註冊")]].map(([k, l]) => (
          <button key={k} data-testid={`register-kind-${k}`} onClick={() => switchKind(k)}
            className={`h-8 px-4 rounded-full text-[13px] font-semibold transition-colors ${kind === k ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-500 hover:bg-orange-100"}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-3">
        {kind === "phone" ? (
          <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={email} onChange={setEmail} testId="register-email" />
        ) : (
          <input data-testid="register-email" size={1} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("請輸入信箱")} className={field} />
        )}
        <div className="relative">
          <input data-testid="register-code" size={1} value={code} onChange={(e) => setCode(e.target.value)} placeholder={tr("驗證碼")} inputMode="numeric" maxLength={6} className={`${field} pr-32`} />
          <button data-testid="register-send-code" onClick={sendCode} disabled={loading}
            className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 h-8 md:h-10 px-3 rounded-full md:rounded-xl bg-orange-100 text-orange-500 md:text-orange-600 font-semibold md:font-bold text-sm hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap transition-colors">
            {sent ? tr("重新發送") : tr("發送驗證碼")}
          </button>
        </div>
        <input data-testid="register-password" size={1} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder={tr("請設定密碼")} className={field} />
        <input data-testid="register-password-confirm" size={1} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={tr("請再次輸入密碼")} className={field} />
      </div>
      <div className="mt-3 text-xs text-slate-400 leading-relaxed">
        <div>{tr("1.密碼長度為8~32位，數字、字母、符號至少包含兩種；")}</div>
        <div>{tr("2.如未收到驗證碼請檢查廣告或垃圾郵件匣。")}</div>
      </div>
      <label className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-600 cursor-pointer select-none">
        <input type="checkbox" data-testid="register-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-4 w-4 accent-orange-500" />
        <span>
          {tr("已閱讀並同意")} <Link to="/article/terms-conditions" className="hover:text-orange-600" onClick={onClose}>{tr("條款與條件")}</Link> {tr("和")} <Link to="/article/privacy-policy" className="hover:text-orange-600" onClick={onClose}>{tr("隱私權政策")}</Link>
        </span>
      </label>
      <button data-testid="register-submit" onClick={submit} disabled={loading}
        className="w-full h-12 md:h-14 mt-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base md:text-lg font-bold transition-colors disabled:opacity-60">
        {loading ? tr("處理中…") : sent ? tr("立即註冊") : tr("發送驗證碼")}
      </button>
      <div className="text-center mt-4 text-sm text-slate-700">
        {tr("已有帳號？")} <button data-testid="register-back" onClick={onBack} className="text-orange-500 font-semibold hover:underline mx-1">{tr("返回登入")}</button>
      </div>
    </div>
  );
}
