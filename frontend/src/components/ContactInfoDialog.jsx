import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/lib/api";
import { useScrollLock } from "@/lib/useScrollLock";
import { tr } from "@/i18n";

export const TYPES = [tr("微信"), "Telegram", "WhatsApp", "LINE", "QQ"];
export const profileComplete = (p) => !!(p?.name?.trim() && p?.contact?.trim());
const inp = "w-full min-w-0 h-11 md:h-12 rounded-full md:rounded-2xl bg-[#F5F5F5] md:bg-slate-100 px-5 text-sm md:text-base outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";

export function ContactInfoDialog({ initial, onSaved, onClose }) {
  const callApi = useApi();
  const [form, setForm] = useState({ name: "", gender: "male", contact_type: TYPES[0], contact: "", ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  useScrollLock(true);
  useEffect(() => { if (initial) setForm((f) => ({ ...f, ...initial })); }, [initial]);

  const save = async () => {
    if (!form.name.trim()) return toast.error(tr("請填寫姓名"));
    if (!form.contact.trim()) return toast.error(tr("請填寫聯絡方式"));
    setBusy(true);
    try {
      await callApi({ method: "PUT", url: "/me/profile", data: form });
      toast.success(tr("聯絡資訊已儲存"));
      onSaved(form);
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && onClose) onClose(); }}>
      <DialogContent className="w-[88vw] max-w-sm rounded-2xl md:rounded-3xl p-5 md:p-6 border-0 bg-white [&>button]:hidden" data-testid="contact-info-dialog" onInteractOutside={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-base md:text-lg font-bold text-slate-900">{tr("完善個人聯絡資訊")}</DialogTitle>
          {onClose && <button onClick={onClose} aria-label={tr("關閉")} data-testid="contact-info-close" className="h-8 w-8 rounded-full bg-[#FDEBD9] text-orange-500 flex items-center justify-center"><X className="h-4 w-4" /></button>}
        </div>
        <p className="text-xs text-slate-500 -mt-1">{tr("首次下單需先填寫聯絡資訊，充值遇到問題時客服才能及時聯繫您。")}</p>
        <div className="space-y-3 mt-1">
          <input data-testid="contact-info-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("姓名 / 暱稱")} className={inp} />
          <div className="flex items-center gap-5 px-1 text-sm">
            <span className="text-slate-500">{tr("性別：")}</span>
            {[["male", tr("男")], ["female", tr("女")]].map(([v, l]) => (
              <button key={v} data-testid={`contact-info-gender-${v}`} onClick={() => setForm({ ...form, gender: v })} className="flex items-center gap-1.5">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center ${form.gender === v ? "text-orange-500" : "bg-slate-200 text-white"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
                <span className={form.gender === v ? "text-orange-500 font-semibold" : "text-slate-600"}>{l}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 w-full">
            <select data-testid="contact-info-type" value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className={`${inp} px-4`}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input data-testid="contact-info-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={tr("請輸入聯絡方式")} className={inp} />
          </div>
          <button data-testid="contact-info-save" onClick={save} disabled={busy} className="w-full h-11 md:h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-60 transition-colors">{busy ? tr("儲存中…") : tr("儲存並繼續")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
