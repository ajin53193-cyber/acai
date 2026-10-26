import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput, toE164, isValidPhone } from "@/components/auth/PhoneInput";
import { useApi } from "@/lib/api";
import { OrangeBtn } from "./AccountLayout";
import { tr } from "@/i18n";

const errMsg = (e) => e?.response?.data?.detail || e?.message || tr("操作失敗，請稍後再試");
const inputCls = "w-full min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 pl-5 pr-28 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";

export function BindPhoneDialog({ onClose, kind = "phone" }) {
  const { user } = useUser();
  const callApi = useApi();
  const isPhone = kind === "phone";
  const [dialCode, setDialCode] = useState("+86");
  const [raw, setRaw] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const identifier = isPhone ? toE164(dialCode, raw) : raw.trim();

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const sendCode = async () => {
    if (isPhone ? !isValidPhone(identifier) : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) return toast.error(isPhone ? tr("請輸入正確的手機號碼") : tr("請輸入正確的信箱"));
    setBusy(true);
    try {
      await callApi({ method: "POST", url: "/auth/email/me/bind/send-code", data: { identifier } });
      setSent(true); setLeft(90);
      toast.success(isPhone ? tr("驗證碼將在 90 秒內發送至您的手機號") : tr("驗證碼將在 90 秒內發送至您的信箱"));
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const verify = async () => {
    if (code.trim().length < 4) return toast.error(tr("請輸入驗證碼"));
    setBusy(true);
    try {
      await callApi({ method: "POST", url: "/auth/email/me/bind", data: { identifier, code: code.trim() } });
      await user.reload();
      toast.success(isPhone ? tr("手機號碼綁定成功") : tr("信箱綁定成功"));
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[88vw] max-w-sm rounded-2xl md:rounded-3xl p-5 md:p-6 border-0 bg-white [&>button]:hidden" data-testid={`bind-${kind}-dialog`}>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-base md:text-lg font-bold text-slate-900">{isPhone ? tr("綁定手機號碼") : tr("綁定信箱")}</DialogTitle>
          <button onClick={onClose} aria-label={tr("關閉")} data-testid="bind-close" className="h-8 w-8 rounded-full bg-[#FDEBD9] text-orange-500 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-slate-500 -mt-1">{isPhone ? tr("綁定後可使用手機號碼登入，並接收訂單通知。") : tr("綁定後可使用信箱登入與找回密碼。")}</p>
        <div className="space-y-3 mt-1">
          {isPhone ? (
            <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={raw} onChange={(v) => { setRaw(v); setSent(false); setCode(""); setLeft(0); }} testId="bind-phone-input" />
          ) : (
            <input data-testid="bind-email-input" type="email" value={raw} onChange={(e) => { setRaw(e.target.value); setSent(false); setCode(""); setLeft(0); }} placeholder={tr("請輸入信箱")} className={inputCls.replace(" pr-28", " pr-5")} />
          )}
          <div className="relative">
            <input data-testid="bind-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={isPhone ? tr("請輸入簡訊驗證碼") : tr("請輸入信箱驗證碼")} className={inputCls} />
            <button data-testid="bind-send" onClick={sendCode} disabled={busy || left > 0} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 md:h-10 px-3 md:px-4 rounded-full bg-orange-100 text-orange-500 text-xs md:text-sm font-medium whitespace-nowrap disabled:text-slate-400 disabled:bg-slate-200/70 transition-colors">
              {left > 0 ? tr("{0}s 後重發", left) : sent ? tr("重新發送") : tr("發送驗證碼")}
            </button>
          </div>
          <OrangeBtn data-testid="bind-submit" onClick={verify} disabled={busy || !sent || code.length < 4} className="w-full max-md:h-11 max-md:text-sm max-md:px-6">{busy ? tr("處理中…") : tr("確認綁定")}</OrangeBtn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
