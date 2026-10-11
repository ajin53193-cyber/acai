import { ShieldCheck } from "lucide-react";

export const StepUpBadge = ({ su }) => {
  if (!su) return null;
  const parts = [su.op_code && "安全码", su.totp && "谷歌验证"].filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-violet-400/40 text-violet-300 bg-violet-400/10 whitespace-nowrap" title={`已通过二次验证：${parts.join(" + ")}`} data-testid="step-up-badge">
      <ShieldCheck className="w-3 h-3" />{parts.join("+") || "二次验证"}
    </span>
  );
};
