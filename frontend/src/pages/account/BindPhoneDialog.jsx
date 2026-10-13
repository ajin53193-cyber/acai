import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput, toE164, isValidPhone } from "@/components/auth/PhoneInput";
import { OrangeBtn } from "./AccountLayout";

const errMsg = (e) => {
  const err = e?.errors?.[0];
  if (err?.code === "form_param_unknown" || /phone_number is not a valid parameter/i.test(err?.message || "")) return "手機號碼功能尚未在 Clerk 後台啟用（User & Authentication → Phone），請聯繫站方開啟後再試";
  return err?.longMessage || err?.message || e?.message || "操作失敗";
};

export function BindPhoneDialog({ onClose }) {
  const { user } = useUser();
  const [dialCode, setDialCode] = useState("+886");
  const [raw, setRaw] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const full = toE164(dialCode, raw);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const sendCode = async () => {
    if (!isValidPhone(full)) return toast.error("請輸入正確的手機號碼");
    setBusy(true);
    try {
      const existing = user.phoneNumbers.find((p) => p.phoneNumber === full);
      const res = existing || (await user.createPhoneNumber({ phoneNumber: full }));
      await res.prepareVerification();
      setPending(res);
      setLeft(60);
      toast.success("驗證碼已發送");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const verify = async () => {
    if (code.trim().length < 4) return toast.error("請輸入驗證碼");
    setBusy(true);
    try {
      const r = await pending.attemptVerification({ code: code.trim() });
      if (r.verification?.status !== "verified") throw new Error("驗證未通過，請重試");
      await user.update({ primaryPhoneNumberId: pending.id });
      await user.reload();
      toast.success("手機號碼綁定成功");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[88vw] max-w-sm rounded-2xl md:rounded-3xl p-5 md:p-6 border-0 bg-white [&>button]:hidden" data-testid="bind-phone-dialog">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-base md:text-lg font-bold text-slate-900">綁定手機號碼</DialogTitle>
          <button onClick={onClose} aria-label="關閉" data-testid="bind-phone-close" className="h-8 w-8 rounded-full bg-[#FDEBD9] text-orange-500 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-slate-500 -mt-1">綁定後可使用手機號碼登入，並接收訂單通知。</p>
        <div className="space-y-3 mt-1">
          <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={raw} onChange={(v) => { setRaw(v); if (pending) { setPending(null); setCode(""); setLeft(0); } }} testId="bind-phone-input" />
          <div className="relative">
            <input data-testid="bind-phone-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="請輸入簡訊驗證碼" className="w-full min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 pl-5 pr-28 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400" />
            <button data-testid="bind-phone-send" onClick={sendCode} disabled={busy || left > 0} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 md:h-10 px-3 md:px-4 rounded-full bg-orange-100 text-orange-500 text-xs md:text-sm font-medium whitespace-nowrap disabled:text-slate-400 disabled:bg-slate-200/70 transition-colors">
              {left > 0 ? `${left}s 後重發` : pending ? "重新發送" : "發送驗證碼"}
            </button>
          </div>
          <OrangeBtn data-testid="bind-phone-submit" onClick={verify} disabled={busy || !pending || code.length < 4} className="w-full max-md:h-11 max-md:text-sm max-md:px-6">{busy ? "處理中…" : "確認綁定"}</OrangeBtn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
