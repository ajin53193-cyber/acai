import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ScrollText } from "lucide-react";

const ACTION_GROUPS = [
  ["all", "全部操作"], ["balance", "余额调整"], ["account", "账户/冻结/密钥"],
  ["payout", "提现审核"], ["channel", "通道配置"], ["order", "手动核账"], ["merchant", "商户设置"],
];

const ACTION_LABELS = {
  "balance.credit": "余额加款", "balance.debit": "余额扣款", "balance.freeze": "冻结余额", "balance.unfreeze": "解冻余额",
  "account.create": "创建账户", "account.freeze": "冻结账号", "account.unfreeze": "解冻账号", "account.reset_api_key": "重置API密钥",
  "payout.approve": "提现通过", "payout.reject": "提现驳回", "channel.create": "新增通道", "channel.update": "修改通道",
  "order.manual_verify": "手动核账", "merchant.notify_url": "设置回调地址",
};

const ACTION_COLORS = {
  balance: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  account: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  payout: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  channel: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  order: "text-red-400 bg-red-400/10 border-red-400/30",
  merchant: "text-slate-300 bg-slate-400/10 border-slate-500/30",
};

function Detail({ d }) {
  if (!d || Object.keys(d).length === 0) return <span className="text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {Object.entries(d).map(([k, v]) => (
        <span key={k} className="text-[11px] font-mono"><span className="text-slate-500">{k}=</span><span className="text-slate-300">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></span>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("");

  const load = useCallback(() => {
    const params = {};
    if (action !== "all") params.action = action;
    if (actor) params.actor = actor;
    api.get("/audit-logs", { params }).then((r) => { setLogs(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [action, actor]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="audit-logs-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">操作审计日志</h1>
        <p className="text-sm text-slate-400 mt-1">余额调整、冻结、提现审核、通道修改、密钥重置等敏感操作留痕</p>
      </div>

      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="按操作人邮箱筛选" data-testid="audit-actor-input" className="pl-9 bg-slate-900/60 border-slate-700" />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger data-testid="audit-action-filter" className="w-[170px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTION_GROUPS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><ScrollText className="w-3.5 h-3.5" />{logs.length} 条</div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">时间</th>
                <th className="py-3 px-3 font-medium">操作人</th>
                <th className="py-3 px-3 font-medium">操作</th>
                <th className="py-3 px-3 font-medium">对象</th>
                <th className="py-3 px-3 font-medium">详情</th>
                <th className="py-3 px-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">暂无审计记录</td></tr>
              ) : logs.map((l) => {
                const grp = l.action.split(".")[0];
                return (
                  <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 align-top" data-testid={`audit-row-${l.id}`}>
                    <td className="py-3 px-3 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                    <td className="py-3 px-3 text-xs"><div>{l.actor_email}</div><div className="text-[10px] text-slate-500">{l.actor_role}</div></td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[11px] border whitespace-nowrap ${ACTION_COLORS[grp] || ACTION_COLORS.merchant}`}>{ACTION_LABELS[l.action] || l.action}</span></td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-400">{l.target_type}:{String(l.target_id).slice(-8)}</td>
                    <td className="py-3 px-3"><Detail d={l.detail} /></td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-500">{l.ip || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
