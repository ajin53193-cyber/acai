import { useState, useEffect, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Save, Server } from "lucide-react";

const ENDPOINTS = [
  ["GET", "/ping", "连通测试"],
  ["GET", "/stats?date=", "统计概览"],
  ["GET", "/orders", "订单列表(分页/筛选)"],
  ["GET", "/orders/{order_no}", "订单详情"],
  ["GET", "/accounts?role=", "账户列表+余额"],
  ["GET", "/support/threads", "客服会话列表"],
  ["GET", "/support/threads/{order_no}", "会话消息"],
  ["POST", "/support/threads/{order_no}/reply", "回复客服"],
  ["POST", "/orders/{order_id}/manual-callback", "手动补单"],
  ["POST", "/accounts/{account_id}/adjust", "调整余额"],
  ["POST", "/accounts/{account_id}/toggle-status", "冻结/解冻"],
  ["GET", "/settlements/payouts", "提现单列表"],
  ["POST", "/settlements/payouts/{id}/approve", "审核通过"],
  ["POST", "/settlements/payouts/{id}/reject", "审核驳回"],
  ["GET/PUT", "/checkout/settings", "读取/修改配置"],
];

export default function AdminApiPanel() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [savingWl, setSavingWl] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [wl, setWl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin-api/key");
      setInfo(data);
      setWl((data.ip_whitelist || []).join("\n"));
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = (t) => { copyText(t); toast.success("已复制"); };

  const rotate = async () => {
    if (info?.enabled && !window.confirm("重新生成将使旧 Key 立即失效，确定继续？")) return;
    setRotating(true);
    try {
      const { data } = await api.post("/admin-api/key/rotate");
      setNewKey(data.api_key);
      toast.success("已生成新 Key，请立即复制保存（只显示一次）");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setRotating(false); }
  };

  const saveWl = async () => {
    const ips = wl.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    setSavingWl(true);
    try {
      const { data } = await api.put("/admin-api/key/ip-whitelist", { ips });
      setWl((data.ip_whitelist || []).join("\n"));
      toast.success(ips.length ? `白名单已保存（${ips.length} 个 IP）` : "已清空白名单（不限制）");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSavingWl(false); }
  };

  if (loading) return null;
  const base = info?.base_url || "";

  return (
    <div className="glass rounded-xl p-5 space-y-5" data-testid="admin-api-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Server className="w-4 h-4 text-cyan-400" /> 平台管理 API（聚合后台对接）
        </div>
        <Button onClick={rotate} disabled={rotating} size="sm" data-testid="admin-api-rotate-btn"
          className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90 h-8">
          {rotating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          {info?.enabled ? "重新生成 Key" : "生成 API Key"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Base URL（对接地址）</Label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono">
            <span className="flex-1 truncate" data-testid="admin-api-base-url">{base}</span>
            <button onClick={() => copy(base)} className="text-cyan-400"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">鉴权方式</Label>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-slate-300">
            请求头 <span className="text-cyan-400">X-Api-Key: &lt;你的Key&gt;</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">当前状态：</span>
        {info?.enabled
          ? <span className="text-emerald-400 font-mono" data-testid="admin-api-key-status">已启用（{info.key_prefix}••••，更新于 {info.rotated_at ? new Date(info.rotated_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}）</span>
          : <span className="text-amber-400" data-testid="admin-api-key-status">未启用，请先生成 Key</span>}
      </div>

      {newKey && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1.5" data-testid="admin-api-new-key">
          <div className="text-xs text-emerald-300 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> 新 API Key（仅此一次显示，请立即复制保存）</div>
          <div className="flex items-center gap-2 p-2.5 rounded bg-slate-950/70 border border-slate-700 font-mono text-xs">
            <span className="flex-1 break-all" data-testid="admin-api-new-key-value">{newKey}</span>
            <button onClick={() => copy(newKey)} className="text-cyan-400 shrink-0"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-400">IP 白名单（每行一个 IP，留空=不限制；仅白名单 IP 可调用）</Label>
        <textarea value={wl} onChange={(e) => setWl(e.target.value)} data-testid="admin-api-wl-input" rows={3}
          placeholder={"例如：\n203.0.113.10\n203.0.113.11"}
          className="w-full rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 text-xs font-mono p-2.5 outline-none focus:border-cyan-500" />
        <Button onClick={saveWl} disabled={savingWl} size="sm" variant="outline" data-testid="admin-api-wl-save-btn"
          className="border-slate-700 h-8">
          {savingWl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}保存白名单
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-400">可用接口（均需 X-Api-Key，前缀 {base || "/api/admin-api"}）</Label>
        <div className="rounded-lg bg-slate-950/70 border border-slate-800 divide-y divide-slate-800/70 max-h-56 overflow-y-auto" data-testid="admin-api-endpoints">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={m + p} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono">
              <span className={`w-16 shrink-0 ${m.startsWith("GET") ? "text-cyan-400" : "text-amber-400"}`}>{m}</span>
              <span className="flex-1 text-slate-300 break-all">{p}</span>
              <span className="text-slate-500 font-sans">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
