import { useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2, Smartphone, Copy, Lock, KeyRound } from "lucide-react";

export default function SecurityPage() {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState("idle"); // idle | setup
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setSetupData(data); setStep("setup"); setCode("");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const enable = async () => {
    setBusy(true);
    try {
      await api.post("/auth/2fa/enable", { code });
      toast.success("两步验证已启用");
      setStep("idle"); setSetupData(null); setCode("");
      await refresh();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post("/auth/2fa/disable", { code: disableCode });
      toast.success("两步验证已关闭");
      setDisableCode("");
      await refresh();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="security-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Lock className="w-6 h-6 text-cyan-400" /> 安全设置</h1>
        <p className="text-sm text-slate-400 mt-1">使用验证器 App（Google Authenticator、1Password 等）保护你的登录</p>
      </div>

      <div className="glass rounded-xl p-6" data-testid="twofa-card">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${user.totp_enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
              {user.totp_enabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <div className="font-semibold">两步验证 (2FA / TOTP)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {user.totp_enabled ? "已启用 · 每次登录需输入验证码" : "未启用 · 账户仅靠密码保护"}
              </div>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] border shrink-0 ${user.totp_enabled ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10" : "border-slate-600 text-slate-400"}`} data-testid="twofa-status">
            {user.totp_enabled ? "已开启" : "已关闭"}
          </span>
        </div>

        {user.totp_required && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs flex items-center gap-2" data-testid="twofa-required-note">
            <ShieldAlert className="w-4 h-4 shrink-0" /> 管理员已为此账户强制开启两步验证，请务必完成绑定且不可关闭。
          </div>
        )}

        {/* Not enabled */}
        {!user.totp_enabled && step === "idle" && (
          <Button onClick={startSetup} disabled={busy} data-testid="start-2fa-btn" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Smartphone className="w-4 h-4 mr-1.5" /> 开始绑定验证器</>}
          </Button>
        )}

        {/* Setup flow */}
        {!user.totp_enabled && step === "setup" && setupData && (
          <div className="space-y-4" data-testid="twofa-setup">
            <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
              <li>打开验证器 App，扫描下方二维码</li>
              <li>App 会每 30 秒生成一个 6 位验证码</li>
              <li>输入当前验证码完成绑定</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-5 items-center">
              <img src={setupData.qr} alt="2FA QR" className="w-44 h-44 rounded-lg bg-white p-2" data-testid="twofa-qr" />
              <div className="flex-1 w-full space-y-3">
                <div>
                  <Label className="text-xs text-slate-400">无法扫码？手动输入密钥</Label>
                  <button onClick={() => copy(setupData.secret)} className="mt-1 flex items-center gap-2 text-xs font-mono text-cyan-400 break-all text-left hover:text-cyan-300" data-testid="twofa-secret">
                    {setupData.secret} <Copy className="w-3 h-3 shrink-0" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label>验证码</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位数字" inputMode="numeric" maxLength={6} data-testid="twofa-code-input" className="bg-slate-900/60 border-slate-700 font-mono tracking-widest text-lg" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={enable} disabled={busy || code.length < 6} data-testid="confirm-2fa-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认启用"}</Button>
                  <Button variant="outline" onClick={() => { setStep("idle"); setSetupData(null); }} className="border-slate-700 hover:bg-slate-800">取消</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enabled -> disable */}
        {user.totp_enabled && !user.totp_required && (
          <div className="space-y-3 pt-2 border-t border-slate-800" data-testid="twofa-disable">
            <Label className="text-slate-400 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> 关闭两步验证（需输入当前验证码）</Label>
            <div className="flex gap-2">
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="6 位验证码" inputMode="numeric" maxLength={6} data-testid="disable-code-input" className="bg-slate-900/60 border-slate-700 font-mono max-w-[180px]" />
              <Button onClick={disable} disabled={busy || disableCode.length < 6} data-testid="disable-2fa-btn" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "关闭"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
