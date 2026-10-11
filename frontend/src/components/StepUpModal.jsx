import { useEffect, useRef, useState } from "react";
import { registerStepUp } from "@/lib/stepup";
import { ShieldCheck, X } from "lucide-react";

export default function StepUpModal() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState({ needOp: false, needTotp: false, error: null });
  const [opCode, setOpCode] = useState("");
  const [totp, setTotp] = useState("");
  const resolver = useRef(null);

  useEffect(() => {
    registerStepUp((o) => new Promise((resolve, reject) => {
      setOpts(o); setOpCode(""); setTotp(""); setOpen(true);
      resolver.current = { resolve, reject };
    }));
  }, []);

  const close = (ok) => {
    setOpen(false);
    const r = resolver.current; resolver.current = null;
    if (!r) return;
    if (ok) r.resolve({ opCode: opCode.trim(), totpCode: totp.trim() });
    else r.reject(new Error("cancelled"));
  };

  if (!open) return null;
  const canSubmit = (!opts.needOp || opCode.trim().length >= 6) && (!opts.needTotp || totp.trim().length >= 6);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" data-testid="stepup-modal">
      <div className="w-full max-w-sm glass border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-cyan-400" /> 安全验证</h3>
          <button onClick={() => close(false)} data-testid="stepup-cancel" className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">该操作较敏感，请完成验证以继续。</p>
        {opts.error && <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" data-testid="stepup-error">{opts.error}</div>}
        {opts.needOp && (
          <div className="mb-3">
            <label className="text-xs text-slate-400">操作安全码</label>
            <input type="password" value={opCode} onChange={(e) => setOpCode(e.target.value)} data-testid="stepup-opcode" autoFocus
              onKeyDown={(e) => e.key === "Enter" && canSubmit && close(true)}
              className="w-full mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 outline-none focus:border-cyan-500" placeholder="输入操作安全码" />
          </div>
        )}
        {opts.needTotp && (
          <div className="mb-3">
            <label className="text-xs text-slate-400">谷歌验证码</label>
            <input inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} data-testid="stepup-totp"
              onKeyDown={(e) => e.key === "Enter" && canSubmit && close(true)}
              className="w-full mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 font-mono tracking-widest outline-none focus:border-cyan-500" placeholder="6 位动态码" />
          </div>
        )}
        <button onClick={() => close(true)} disabled={!canSubmit} data-testid="stepup-submit"
          className="w-full h-10 rounded-lg bg-cyan-500 text-slate-950 font-semibold disabled:opacity-40">确认</button>
      </div>
    </div>
  );
}
