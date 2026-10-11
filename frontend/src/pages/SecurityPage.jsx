import { useState, useEffect } from "react";
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

      <OpCodeCard user={user} refresh={refresh} />
      <ChangePasswordCard />
      <SecurityPolicyCard user={user} />
    </div>
  );
}

function OpCodeCard({ user, refresh }) {
  const [opSet, setOpSet] = useState(null);
  const [newCode, setNewCode] = useState("");
  const [curCode, setCurCode] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/auth/op-code/status").then((r) => setOpSet(r.data.op_code_set)).catch(() => {}); }, []);
  const save = async () => {
    setBusy(true);
    try {
      await api.post("/auth/op-code/set", { new_code: newCode, current_code: curCode || null, totp_code: totp || null });
      toast.success(opSet ? "操作安全码已更新" : "操作安全码已设置");
      setNewCode(""); setCurCode(""); setTotp(""); setOpSet(true);
      if (refresh) await refresh();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  if (opSet === null) return null;
  return (
    <div className="glass rounded-xl p-6" data-testid="opcode-card">
      <div className="flex items-center gap-2 mb-1"><KeyRound className="w-5 h-5 text-cyan-400" /><span className="font-semibold">操作安全码</span>
        <span className={`ml-auto px-2.5 py-1 rounded-full text-[11px] border ${opSet ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10" : "border-slate-600 text-slate-400"}`} data-testid="opcode-status">{opSet ? "已设置" : "未设置"}</span>
      </div>
      <p className="text-xs text-slate-400 mb-4">用于增删收款地址、增删商户、余额调整、冻结账户、改密码、改安全策略等敏感操作的二次确认（与谷歌验证码一起校验）。</p>
      <div className="space-y-3 max-w-sm">
        {opSet && (
          <div className="space-y-1.5"><Label>当前操作安全码</Label>
            <Input type="password" value={curCode} onChange={(e) => setCurCode(e.target.value)} data-testid="opcode-current" className="bg-slate-900/60 border-slate-700" placeholder="输入当前安全码" /></div>
        )}
        <div className="space-y-1.5"><Label>{opSet ? "新操作安全码" : "设置操作安全码"}（至少 6 位）</Label>
          <Input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} data-testid="opcode-new" className="bg-slate-900/60 border-slate-700" placeholder="至少 6 位" /></div>
        {user.totp_enabled && (
          <div className="space-y-1.5"><Label>谷歌验证码</Label>
            <Input inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} data-testid="opcode-totp" className="bg-slate-900/60 border-slate-700 font-mono tracking-widest max-w-[180px]" placeholder="6 位动态码" /></div>
        )}
        <Button onClick={save} disabled={busy || newCode.length < 6 || (opSet && !curCode) || (user.totp_enabled && totp.length < 6)} data-testid="opcode-save" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (opSet ? "更新安全码" : "设置安全码")}</Button>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: nw });
      toast.success("登录密码已修改");
      setCur(""); setNw("");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="glass rounded-xl p-6" data-testid="change-password-card">
      <div className="flex items-center gap-2 mb-4"><Lock className="w-5 h-5 text-cyan-400" /><span className="font-semibold">修改登录密码</span></div>
      <div className="space-y-3 max-w-sm">
        <div className="space-y-1.5"><Label>当前密码</Label>
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} data-testid="cp-current" className="bg-slate-900/60 border-slate-700" /></div>
        <div className="space-y-1.5"><Label>新密码（至少 6 位）</Label>
          <Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} data-testid="cp-new" className="bg-slate-900/60 border-slate-700" /></div>
        <Button onClick={save} disabled={busy || !cur || nw.length < 6} data-testid="cp-save" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认修改"}</Button>
      </div>
    </div>
  );
}

function SecurityPolicyCard({ user }) {
  const [pol, setPol] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/security/policy").then((r) => setPol(r.data)).catch(() => {}); }, []);
  const set = (k, v) => setPol((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const { enforce_admin_2fa, enforce_operator_2fa, enforce_operator_op_code, login_alert } = pol;
      await api.put("/security/policy", { enforce_admin_2fa, enforce_operator_2fa, enforce_operator_op_code, login_alert });
      toast.success("安全策略已保存");
    } catch (e) { toast.error("保存失败"); } finally { setSaving(false); }
  };
  if (!pol) return null;
  const isAdmin = user.role === "admin";
  const Row = ({ k, label, desc }) => (
    <label className={`flex items-start gap-3 p-3 rounded-lg border ${pol[k] ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-800"} ${isAdmin ? "cursor-pointer" : "opacity-80"}`}>
      <input type="checkbox" checked={!!pol[k]} disabled={!isAdmin} onChange={(e) => set(k, e.target.checked)} data-testid={`policy-${k}`} className="mt-0.5 accent-cyan-500" />
      <span><span className="text-sm text-slate-200">{label}</span><span className="block text-xs text-slate-500 mt-0.5">{desc}</span></span>
    </label>
  );
  return (
    <div className="glass rounded-xl p-6" data-testid="security-policy-card">
      <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-cyan-400" /><span className="font-semibold">平台安全策略</span>{!isAdmin && <span className="text-[11px] text-slate-500">（仅管理员可修改）</span>}</div>
      {pol.enforced_for_me && !user.totp_enabled && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs" data-testid="policy-enforced-note">平台已要求你的角色开启两步验证，请尽快完成上方绑定。</div>
      )}
      {pol.op_code_required_for_me && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-rose-400/10 border border-rose-400/30 text-rose-300 text-xs" data-testid="policy-opcode-required-note">平台已要求操作员设置操作安全码，设置完成前所有写操作将被拒绝，请在上方「操作安全码」卡片完成设置。</div>
      )}
      <div className="space-y-2">
        <Row k="enforce_admin_2fa" label="要求管理员开启两步验证" desc="开启后管理员在安全页收到强制绑定提示" />
        <Row k="enforce_operator_2fa" label="要求操作员开启两步验证" desc="开启后操作员在安全页收到强制绑定提示" />
        <Row k="enforce_operator_op_code" label="强制操作员设置操作安全码" desc="开启后未设置操作安全码的操作员无法执行任何写操作（客服会话除外），直到完成设置" />
        <Row k="login_alert" label="新设备 / 新 IP 登录邮件提醒" desc="账户从陌生 IP 成功登录时发送安全邮件" />
      </div>
      {isAdmin && <Button onClick={save} disabled={saving} data-testid="policy-save-btn" className="mt-4 bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存策略"}</Button>}
    </div>
  );
}
