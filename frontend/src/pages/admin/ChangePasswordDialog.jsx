import { useState } from "react";
import { toast } from "sonner";
import { Btn, Input, Field, Modal } from "@/pages/admin/ui";
import { tr } from "@/i18n";
import { useSession } from "@/lib/auth";

export const pwOk = (p) => p.length >= 8 && p.length <= 32 && /[0-9]/.test(p) && /[a-zA-Z]/.test(p);
const RULE = tr("密碼需 8~32 位，且同時包含字母與數字");

export function ChangePasswordDialog({ callApi, onClose, target }) {
  const [f, setF] = useState({ old: "", pw: "", pw2: "" });
  const [busy, setBusy] = useState(false);
  const self = !target;
  const { signIn } = useSession();
  const submit = async () => {
    if (self && !f.old) return toast.error(tr("請輸入舊密碼"));
    if (!pwOk(f.pw)) return toast.error(RULE);
    if (f.pw !== f.pw2) return toast.error(tr("兩次輸入的新密碼不一致"));
    setBusy(true);
    try {
      const r = await callApi(self ? { method: "POST", url: "/admin/me/password", data: { old_password: f.old, new_password: f.pw } }
        : { method: "POST", url: `/admin/admins/${target.user_id}/password`, data: { new_password: f.pw } });
      if (r?.data?.token) await signIn(r.data.token);
      toast.success(self ? tr("密碼已更新") : tr("已重設 {0} 的密碼", target.email));
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || tr("修改失敗")); }
    setBusy(false);
  };
  return (
    <Modal testId="change-password-dialog" title={self ? tr("修改密碼") : tr("重設管理員密碼")} onClose={() => !busy && onClose()}
      footer={<><Btn kind="ghost" onClick={onClose} disabled={busy}>{tr("取消")}</Btn><Btn data-testid="change-password-submit" onClick={submit} disabled={busy}>{busy ? tr("提交中…") : tr("確認修改")}</Btn></>}>
      {!self && <div className="text-sm text-slate-600" data-testid="reset-password-target">{target.email}</div>}
      {self && <Field label={tr("舊密碼")}><Input data-testid="change-password-old" type="password" autoComplete="current-password" className="w-full" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} /></Field>}
      <Field label={tr("新密碼")}><Input data-testid="change-password-new" type="password" autoComplete="new-password" className="w-full" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} placeholder={RULE} /></Field>
      <Field label={tr("再次輸入新密碼")}><Input data-testid="change-password-confirm" type="password" autoComplete="new-password" className="w-full" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
      <div className="text-[11px] text-slate-400">{tr("修改後其他已登入裝置將被登出。")}</div>
    </Modal>
  );
}
