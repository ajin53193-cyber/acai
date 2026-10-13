import { useState } from "react";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const full = toE164(dialCode, raw);

  const sendCode = async () => {
    if (!isValidPhone(full)) return toast.error("請輸入正確的手機號碼");
    setBusy(true);
    try {
      const existing = user.phoneNumbers.find((p) => p.phoneNumber === full);
      const res = existing || (await user.createPhoneNumber({ phoneNumber: full }));
      await res.prepareVerification();
      setPending(res);
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
      <DialogContent className="w-[86vw] max-w-sm rounded-2xl md:rounded-3xl p-5 md:p-6" data-testid="bind-phone-dialog">
        <DialogHeader><DialogTitle className="text-base md:text-lg font-bold text-slate-900">綁定手機號碼</DialogTitle></DialogHeader>
        <p className="text-[11px] md:text-xs text-slate-500 -mt-2">綁定後可使用手機號碼登入，並接收訂單通知。</p>
        <div className="space-y-3 mt-2">
          <PhoneInput dialCode={dialCode} setDialCode={setDialCode} value={raw} onChange={setRaw} testId="bind-phone-input" />
          {pending && (
            <div className="flex items-center gap-2">
              <input data-testid="bind-phone-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="簡訊驗證碼" className="flex-1 min-w-0 h-11 md:h-14 rounded-full md:rounded-2xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
              <button data-testid="bind-phone-resend" onClick={sendCode} disabled={busy} className="shrink-0 h-11 md:h-14 px-4 rounded-full md:rounded-2xl bg-orange-100 text-orange-600 font-bold text-sm hover:bg-orange-200 whitespace-nowrap disabled:opacity-60">重新發送</button>
            </div>
          )}
          <OrangeBtn data-testid="bind-phone-submit" onClick={pending ? verify : sendCode} disabled={busy} className="w-full max-md:h-11 max-md:text-sm max-md:px-6">
            {busy ? "處理中…" : pending ? "確認綁定" : "發送驗證碼"}
          </OrangeBtn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
