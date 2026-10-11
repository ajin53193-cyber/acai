import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Loader2, UserCog, ShieldCheck, Activity, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const ACTION_LABELS = {
  "balance.credit": "余额加款", "balance.debit": "余额扣款", "balance.freeze": "冻结余额", "balance.unfreeze": "解冻余额",
  "account.create": "创建账户", "account.freeze": "冻结账号", "account.unfreeze": "解冻账号", "account.reset_api_key": "重置API密钥", "account.permissions": "修改操作员权限",
  "account.require_2fa": "强制两步验证", "account.unrequire_2fa": "取消强制两步验证",
  "settings.notify": "Telegram推送设置", "payout.approve": "提现通过", "payout.reject": "提现驳回",
  "channel.create": "新增通道", "channel.update": "修改通道", "order.manual_verify": "手动核账", "order.reject": "驳回订单", "order.resend_callback": "手动回调", "merchant.notify_url": "设置回调地址",
  "auth.login_failed": "登录失败", "auth.locked": "账号锁定", "auth.unlock": "解除锁定", "auth.2fa_enable": "启用两步验证", "auth.2fa_disable": "关闭两步验证",
  "merchant.ip_whitelist": "设置IP白名单", "api.ip_rejected": "API IP拦截", "settings.checkout": "收银台设置", "settings.alerts": "预警阈值",
  "address.add": "添加地址", "address.remove": "移除地址", "address.update": "地址标签/暂停", "address.sweep": "冷钱包归集",
};

const GROUP_COLOR = {
  balance: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  account: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  payout: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  channel: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  order: "text-red-400 border-red-400/40 bg-red-400/10",
  auth: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  address: "text-violet-400 border-violet-400/40 bg-violet-400/10",
};

function Detail({ d }) {
  if (!d || Object.keys(d).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
      {Object.entries(d).map(([k, v]) => (
        <span key={k} className="text-[11px] font-mono"><span className="text-slate-500">{k}=</span><span className="text-slate-300">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></span>
      ))}
    </div>
  );
}

export default function OperatorTrailPage() {
  const [ops, setOps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingOps, setLoadingOps] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/operators").then((r) => {
      setOps(r.data); setLoadingOps(false);
      if (r.data.length) setSelected(r.data[0]);
    }).catch(() => setLoadingOps(false));
  }, []);

  const loadLogs = useCallback((id) => {
    setLoadingLogs(true);
    api.get("/audit-logs", { params: { actor_id: id, limit: 500 } })
      .then((r) => { setLogs(r.data); setLoadingLogs(false); })
      .catch(() => setLoadingLogs(false));
  }, []);

  useEffect(() => { if (selected) loadLogs(selected.id); }, [selected, loadLogs]);

  const filtered = ops.filter((o) => !q || o.name.includes(q) || o.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="operator-trail-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><UserCog className="w-6 h-6 text-cyan-400" /> 操作员留痕</h1>
        <p className="text-sm text-slate-400 mt-1">按员工查看完整操作时间线，快速审阅每位操作员的后台行为</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* operator list */}
        <div className="glass rounded-xl p-3 h-fit">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索操作员" data-testid="operator-search" className="pl-9 bg-slate-900/60 border-slate-700 h-9" />
          </div>
          {loadingOps ? (
            <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">暂无操作员</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  data-testid={`operator-item-${o.id}`}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${selected?.id === o.id ? "border-cyan-500/50 bg-cyan-500/10" : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{o.name}</span>
                    <span className="text-[11px] font-mono text-cyan-400 shrink-0">{o.action_count} 次</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{o.email}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${o.status === "active" ? "border-emerald-400/30 text-emerald-400" : "border-red-400/30 text-red-400"}`}>{o.status === "active" ? "正常" : "冻结"}</span>
                    {o.totp_enabled && <span className="px-1.5 py-0.5 rounded text-[10px] border border-cyan-400/30 text-cyan-400 flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />2FA</span>}
                    {o.last_action_at && <span className="text-[10px] text-slate-600 ml-auto">{fmtDate(o.last_action_at)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* timeline */}
        <div className="glass rounded-xl p-5 min-h-[400px]">
          {!selected ? (
            <div className="py-20 text-center text-slate-500">请选择一位操作员</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{selected.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-cyan-400">{logs.length}</div>
                  <div className="text-[11px] text-slate-500">操作记录</div>
                </div>
              </div>

              {loadingLogs ? (
                <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400 inline" /></div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2"><Activity className="w-8 h-8 opacity-40" />该操作员暂无操作记录</div>
              ) : (
                <div className="relative pl-6" data-testid="operator-timeline">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-800" />
                  <div className="space-y-5">
                    {logs.map((l) => {
                      const grp = l.action.split(".")[0];
                      return (
                        <div key={l.id} className="relative" data-testid={`trail-row-${l.id}`}>
                          <div className={`absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full border-2 ${(GROUP_COLOR[grp] || "text-slate-400 border-slate-500/40 bg-slate-500/10")}`} />
                          <div className="flex items-start gap-3 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] border whitespace-nowrap ${GROUP_COLOR[grp] || "text-slate-300 border-slate-600 bg-slate-700/30"}`}>{ACTION_LABELS[l.action] || l.action}</span>
                            <span className="text-[11px] font-mono text-slate-500">{fmtDate(l.created_at)}</span>
                            {l.target_type && <span className="text-[11px] font-mono text-slate-600">{l.target_type}:{String(l.target_id).slice(-8)}</span>}
                            {l.ip && <span className="text-[11px] font-mono text-slate-600">IP {l.ip}</span>}
                          </div>
                          <Detail d={l.detail} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
