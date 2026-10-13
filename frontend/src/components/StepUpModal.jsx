import { useEffect, useRef, useState } from "react";
import { registerStepUp } from "@/lib/stepup";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";

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

  const canSubmit = (!opts.needOp || opCode.trim().length >= 6) && (!opts.needTotp || totp.trim().length >= 6);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(false); }}>
      <DialogContent className="glass border-slate-700 max-w-sm z-[90]" data-testid="stepup-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <ShieldCheck className="w-5 h-5 text-cyan-400" /> 安全验证
          </DialogTitle>
          <DialogDescription className="text-slate-400">该操作较敏感，请完成验证以继续。</DialogDescription>
        </DialogHeader>
        {opts.error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" data-testid="stepup-error">{opts.error}</div>}
        {opts.needOp && (
          <div>
            <label className="text-xs text-slate-400">操作安全码</label>
            <input type="password" value={opCode} onChange={(e) => setOpCode(e.target.value)} data-testid="stepup-opcode" autoFocus
              onKeyDown={(e) => e.key === "Enter" && canSubmit && close(true)}
              className="w-full mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 outline-none focus:border-cyan-500" placeholder="输入操作安全码" />
          </div>
        )}
        {opts.needTotp && (
          <div>
            <label className="text-xs text-slate-400">谷歌验证码</label>
            <input inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} data-testid="stepup-totp"
              autoFocus={!opts.needOp}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && close(true)}
              className="w-full mt-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 font-mono tracking-widest outline-none focus:border-cyan-500" placeholder="6 位动态码" />
          </div>
        )}
        <button onClick={() => close(true)} disabled={!canSubmit} data-testid="stepup-submit"
          className="w-full h-10 rounded-lg bg-cyan-500 text-slate-950 font-semibold disabled:opacity-40">确认</button>
      </DialogContent>
    </Dialog>
  );
}
