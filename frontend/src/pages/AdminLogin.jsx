import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignIn } from "@clerk/react/legacy";
import { useClerk } from "@clerk/react";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";

const inp = "w-full h-12 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
const err = (e, f) => e?.response?.data?.detail || e?.errors?.[0]?.message || f;

export default function AdminLogin() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signOut, session } = useClerk();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pre, setPre] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!identifier || !password) return toast.error(tr("請輸入帳號與密碼"));
    setBusy(true);
    try {
      const r = await publicApi.post("/admin/auth/login", { identifier: identifier.trim(), password });
      setPre(r.data);
    } catch (e) { toast.error(err(e, tr("登入失敗"))); }
    setBusy(false);
  };

  const verify = async () => {
    if (code.trim().length !== 6) return toast.error(tr("請輸入 6 位驗證碼"));
    setBusy(true);
    try {
      const r = await publicApi.post("/admin/auth/totp", { pre_token: pre.pre_token, code: code.trim() });
      sessionStorage.setItem("admin_token", r.data.admin_token);
      if (session) await signOut({ redirectUrl: null }).catch(() => {});
      if (!isLoaded) throw new Error(tr("請稍候再試"));
      const si = await signIn.create({ strategy: "ticket", ticket: r.data.ticket });
      await setActive({ session: si.createdSessionId });
      toast.success(tr("後台登入成功"));
      navigate("/admin", { replace: true });
    } catch (e) { toast.error(err(e, tr("驗證失敗"))); }
    setBusy(false);
  };

  const qr = pre?.setup ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pre.setup.otpauth_url)}` : null;
  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4" data-testid="admin-login-page">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)] p-7">
        <div className="flex items-center gap-2 mb-6"><div className="h-9 w-9 rounded-xl bg-orange-500 text-white font-black flex items-center justify-center">G</div><div><div className="font-head font-extrabold text-slate-900">gogo589</div><div className="text-[11px] text-slate-400 -mt-0.5">{tr("商戶管理後台")}</div></div></div>
        {!pre ? (
          <div className="space-y-3">
            <input data-testid="admin-login-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={tr("管理員帳號（信箱 / 手機號）")} className={inp} />
            <input data-testid="admin-login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("密碼")} className={inp} onKeyDown={(e) => e.key === "Enter" && login()} />
            <button data-testid="admin-login-submit" onClick={login} disabled={busy} className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-60">{busy ? tr("驗證中…") : tr("下一步")}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {pre.setup && (
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-xs text-slate-600" data-testid="admin-totp-setup">
                <div className="font-semibold text-slate-800 mb-2">{tr("首次登入：請用 Google Authenticator 掃描綁定")}</div>
                <img src={qr} alt="QR" className="mx-auto h-[150px] w-[150px] rounded-lg bg-white p-1" />
                <div className="mt-2 break-all">{tr("或手動輸入密鑰：")}<span className="font-mono text-slate-800" data-testid="admin-totp-secret">{pre.setup.secret}</span></div>
              </div>
            )}
            <input data-testid="admin-totp-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} placeholder={tr("Google 驗證器 6 位數驗證碼")} className={inp + " tracking-[0.3em] text-center font-head font-bold"} onKeyDown={(e) => e.key === "Enter" && verify()} />
            <button data-testid="admin-totp-submit" onClick={verify} disabled={busy} className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-60">{busy ? tr("驗證中…") : tr("登入後台")}</button>
            <button onClick={() => { setPre(null); setCode(""); }} className="w-full text-xs text-slate-400 hover:text-slate-600">{tr("返回")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
