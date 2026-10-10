import { useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, Webhook, Save, KeyRound, Copy } from "lucide-react";

const CB_STATUS = {
  pending: { label: "待推送", cls: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  retrying: { label: "重试中", cls: "text-sky-400 bg-sky-400/10 border-sky-400/30" },
  success: { label: "成功", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  failed: { label: "失败", cls: "text-red-400 bg-red-400/10 border-red-400/30" },
};

function NotifySettings({ user }) {
  const [url, setUrl] = useState(user.notify_url || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const testUrl = `${process.env.REACT_APP_BACKEND_URL}/api/callbacks/test-receiver`;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/accounts/me/notify", { notify_url: url });
      toast.success("回调地址已保存");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  const loadPreview = () => api.get("/callbacks/sign-preview").then((r) => setPreview(r.data)).catch(() => {});

  return (
    <div className="glass rounded-xl p-5 space-y-4" data-testid="notify-settings">
      <div className="flex items-center gap-2 text-sm font-semibold"><Webhook className="w-4 h-4 text-cyan-400" /> 默认回调地址 (notify_url)</div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[260px] space-y-1.5">
          <Label className="text-xs text-slate-400">支付成功后 POST JSON 到此地址，返回 "success" 视为成功</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-site.com/api/usdt/notify" data-testid="notify-url-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" />
        </div>
        <Button onClick={save} disabled={saving} data-testid="notify-url-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" />保存</>}</Button>
        <Button variant="outline" onClick={() => { setUrl(testUrl); toast.info("已填入平台测试接收地址，点击保存生效"); }} data-testid="notify-url-use-test-btn" className="border-slate-700">使用测试接收器</Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <KeyRound className="w-3.5 h-3.5" /> 签名: 参数按 key 升序拼接 k=v&k=v（排除 sign、空值），HMAC-SHA256(api_secret) 取 hex。重试间隔 15s / 1m / 5m / 30m / 2h。
        <button onClick={loadPreview} className="text-cyan-400 hover:underline ml-auto" data-testid="sign-preview-btn">查看签名示例</button>
      </div>
      {preview && (
        <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 space-y-2 text-[11px] font-mono" data-testid="sign-preview">
          <div className="text-slate-400">sign_string:</div>
          <div className="break-all text-slate-300">{preview.sign_string}</div>
          <div className="text-slate-400 flex items-center gap-2">payload JSON <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(preview.payload, null, 2)); toast.success("已复制"); }} className="text-cyan-400"><Copy className="w-3 h-3" /></button></div>
          <pre className="whitespace-pre-wrap break-all text-slate-300">{JSON.stringify(preview.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function CallbacksPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    const params = status === "all" ? {} : { status };
    api.get("/callbacks", { params }).then((r) => { setRows(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const retry = async (cb) => {
    setBusy(cb.id);
    try {
      const { data } = await api.post(`/callbacks/${cb.id}/retry`);
      toast[data.status === "success" ? "success" : "warning"](data.status === "success" ? "回调推送成功" : `推送未成功: ${data.last_response || data.last_code}`);
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6" data-testid="callbacks-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">回调通知</h1>
          <p className="text-sm text-slate-400 mt-1">支付成功异步通知商户，带 HMAC-SHA256 签名，失败自动重试 5 次</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="callback-status-filter" className="w-[140px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待推送</SelectItem>
            <SelectItem value="retrying">重试中</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {user.role === "merchant" && <NotifySettings user={user} />}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">订单号</th>
                <th className="py-3 px-3 font-medium">商户</th>
                <th className="py-3 px-3 font-medium">回调地址</th>
                <th className="py-3 px-3 font-medium">状态</th>
                <th className="py-3 px-3 font-medium text-center">次数</th>
                <th className="py-3 px-3 font-medium">HTTP / 响应</th>
                <th className="py-3 px-3 font-medium">下次 / 更新时间</th>
                <th className="py-3 px-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">暂无回调记录（为订单设置 notify_url 后支付成功会自动推送）</td></tr>
              ) : rows.map((cb) => {
                const s = CB_STATUS[cb.status] || CB_STATUS.pending;
                return (
                  <tr key={cb.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`callback-row-${cb.order_no}`}>
                    <td className="py-3 px-3 font-mono text-xs">{cb.order_no}</td>
                    <td className="py-3 px-3">{cb.merchant_name}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 max-w-[220px] truncate" title={cb.url}>{cb.url}</td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-[11px] border ${s.cls}`} data-testid={`callback-status-${cb.order_no}`}>{s.label}</span></td>
                    <td className="py-3 px-3 text-center font-mono text-xs">{cb.attempts}/{cb.max_attempts}</td>
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-400 max-w-[200px] truncate" title={cb.last_response || ""}>{cb.last_code ?? "—"} {cb.last_response ? `· ${cb.last_response}` : ""}</td>
                    <td className="py-3 px-3 text-xs font-mono text-slate-500">{cb.status === "retrying" ? `下次 ${fmtDate(cb.next_at)}` : fmtDate(cb.updated_at)}</td>
                    <td className="py-3 px-3 text-right">
                      {cb.status !== "success" && (
                        <button onClick={() => retry(cb)} disabled={busy === cb.id} data-testid={`callback-retry-${cb.order_no}`} className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-50" title="立即重试">
                          {busy === cb.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
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
