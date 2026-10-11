import { useState, useEffect, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, Loader2, PlayCircle, Code2, RefreshCw, Webhook, ChevronDown } from "lucide-react";

const BASE = process.env.REACT_APP_BACKEND_URL;

function Code({ children, testid }) {
  const copy = () => { navigator.clipboard.writeText(children); toast.success("已复制"); };
  return (
    <div className="relative group">
      <pre data-testid={testid} className="rounded-lg bg-slate-950/80 border border-slate-800 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">{children}</pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1 rounded text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100"><Copy className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Credentials({ merchant, isAdmin, onReset }) {
  const [show, setShow] = useState(false);
  const [resetting, setResetting] = useState(false);
  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };
  const reset = async () => {
    if (!window.confirm(`确定重置「${merchant.name}」的 API 密钥？旧密钥将立即失效。`)) return;
    setResetting(true);
    try {
      const { data } = await api.post(`/accounts/${merchant.id}/reset-api-key`);
      onReset(merchant.id, data);
      setShow(true);
      toast.success("已重置，新 api_secret 已显示，请妥善保管");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setResetting(false); }
  };
  return (
    <div className="glass rounded-xl p-5 space-y-3" data-testid="api-credentials">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="w-4 h-4 text-cyan-400" /> 商户凭证 · {merchant.name}</div>
        {isAdmin && (
          <Button onClick={reset} disabled={resetting} size="sm" variant="outline" data-testid="reset-key-btn"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 h-8">
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}重置密钥
          </Button>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs text-slate-400">api_key</Label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-xs"><span className="flex-1 truncate" data-testid="api-key-value">{merchant.api_key}</span><button onClick={() => copy(merchant.api_key)} className="text-cyan-400"><Copy className="w-3.5 h-3.5" /></button></div></div>
        <div className="space-y-1"><Label className="text-xs text-slate-400">api_secret（请妥善保管）</Label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-xs"><span className="flex-1 truncate" data-testid="api-secret-value">{show ? merchant.api_secret : "•".repeat(40)}</span>
            <button onClick={() => setShow(!show)} data-testid="toggle-secret-btn" className="text-slate-400">{show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
            <button onClick={() => copy(merchant.api_secret)} className="text-cyan-400"><Copy className="w-3.5 h-3.5" /></button></div></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div><span className="text-slate-400">默认回调地址 (notify_url)：</span><span className="font-mono text-slate-200 break-all" data-testid="merchant-notify-url">{merchant.notify_url || "未设置"}</span></div>
        <div><span className="text-slate-400">IP 白名单：</span><span className="font-mono text-slate-200" data-testid="merchant-ip-whitelist">{merchant.ip_whitelist?.length ? merchant.ip_whitelist.join(", ") : "未启用（不限制）"}</span></div>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [merchants, setMerchants] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("100");
  const [outNo, setOutNo] = useState(() => "M" + Date.now());
  const [network, setNetwork] = useState("TRC20");
  const [result, setResult] = useState(null);
  const [reqBody, setReqBody] = useState(null);
  const [signStr, setSignStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [callbackSample, setCallbackSample] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dev/merchants");
      setMerchants(data);
      setSel((prev) => prev || data[0] || null);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sel) { setCallbackSample(null); return; }
    api.get(`/dev/callback-sample?merchant_id=${sel.id}`).then((r) => setCallbackSample(r.data)).catch(() => setCallbackSample(null));
  }, [sel]);

  const onReset = (id, keys) => {
    setMerchants((ms) => ms.map((m) => (m.id === id ? { ...m, ...keys } : m)));
    setSel((s) => (s && s.id === id ? { ...s, ...keys } : s));
  };

  const tryIt = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const { data } = await api.post("/dev/test-order", {
        merchant_id: sel.id, amount_usdt: Number(amount), network, out_trade_no: outNo, remark: "api-console-test",
      });
      setReqBody(data.request); setSignStr(data.sign_string); setResult(data.response);
      toast.success(`下单成功 ${data.response?.data?.order_no || ""}`);
      setOutNo("M" + Date.now());
    } catch (err) {
      setResult(err.response?.data || { error: err.message });
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;

  return (
    <div className="space-y-6" data-testid="api-docs-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">对接文档 / 开发者 API</h1>
          <p className="text-sm text-slate-400 mt-1">代商户查看凭证、对接文档与在线测试：使用 api_key + HMAC-SHA256 签名创建 USDT 收款订单</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">选择商户</Label>
          <div className="relative">
            <select
              data-testid="merchant-select"
              value={sel?.id || ""}
              onChange={(e) => { setSel(merchants.find((m) => m.id === e.target.value) || null); setResult(null); setReqBody(null); }}
              className="w-[260px] h-10 rounded-md bg-slate-900/60 border border-slate-700 text-sm px-3 pr-8 appearance-none focus:outline-none focus:border-cyan-500"
            >
              {merchants.length === 0 && <option value="">暂无商户</option>}
              {merchants.map((m) => (<option key={m.id} value={m.id}>{m.name} · {m.email}{m.status === "frozen" ? "（已冻结）" : ""}</option>))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-3 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {sel && <Credentials merchant={sel} isAdmin={isAdmin} onReset={onReset} />}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Code2 className="w-4 h-4 text-cyan-400" /> 接口说明</div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-slate-400 mb-1">1. 创建订单</div>
              <Code>{`POST ${BASE}/api/v1/orders\nContent-Type: application/json\n\n{\n  "api_key": "mk_xxx",\n  "timestamp": 1718000000,        // Unix 秒，±300s 内有效\n  "nonce": "随机字符串",            // 10 分钟内不可重复\n  "amount_usdt": 100.00,\n  "network": "TRC20",             // TRC20 | ERC20 | BEP20\n  "out_trade_no": "您的订单号",     // 幂等键，重复返回原订单\n  "notify_url": "https://...",    // 可选，默认用商户设置\n  "remark": "可选",\n  "sign": "HMAC-SHA256 签名"\n}`}</Code>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">2. 查询订单</div>
              <Code>{`POST ${BASE}/api/v1/orders/query\n{ api_key, timestamp, nonce, sign, order_no 或 out_trade_no }`}</Code>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">3. 签名算法（下单 / 查询 / 回调通知通用）</div>
              <Code>{`1) 取所有参数（排除 sign 与空值），按 key ASCII 升序\n2) 拼接 k1=v1&k2=v2...（数字按原样，如 100 或 100.5）\n3) sign = hex( HMAC_SHA256(api_secret, 拼接串) )\n\n回调时请用同样方式验签，并返回纯文本 "success"`}</Code>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">4. 响应示例</div>
              <Code>{`{ "code": 0, "msg": "success", "data": {\n  "order_no": "SF2026...", "out_trade_no": "...",\n  "amount_usdt": 100, "pay_amount": 100.0137,   // 用户需精确转账 pay_amount\n  "network": "TRC20", "wallet_address": "T...",\n  "status": "pending", "expires_at": "...",\n  "pay_url": "https://.../pay/SF2026..."        // 可直接跳转收银台\n} }`}</Code>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4" data-testid="api-try-panel">
          <div className="flex items-center gap-2 text-sm font-semibold"><PlayCircle className="w-4 h-4 text-emerald-400" /> 在线测试（用所选商户密钥签名下单）</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">金额 USDT</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="try-amount-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
            <div className="space-y-1"><Label className="text-xs">网络</Label>
              <div data-testid="try-network-fixed" className="w-full h-10 flex items-center rounded-md bg-slate-900/60 border border-slate-700 text-sm px-2 font-mono text-emerald-400">TRC20</div></div>
            <div className="space-y-1"><Label className="text-xs">out_trade_no</Label><Input value={outNo} onChange={(e) => setOutNo(e.target.value)} data-testid="try-out-no-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
          </div>
          <Button onClick={tryIt} disabled={busy || !amount || !sel} data-testid="try-submit-btn" className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "发送签名请求 POST /api/v1/orders"}
          </Button>
          {signStr && (<div><div className="text-xs text-slate-400 mb-1">签名串 (sign_string)</div><Code testid="try-sign-string">{signStr}</Code></div>)}
          {reqBody && (<div><div className="text-xs text-slate-400 mb-1">请求体（含 sign）</div><Code testid="try-request">{JSON.stringify(reqBody, null, 2)}</Code></div>)}
          {result && (<div><div className="text-xs text-slate-400 mb-1">响应</div><Code testid="try-response">{JSON.stringify(result, null, 2)}</Code>
            {result?.data?.pay_url && <a href={result.data.pay_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-cyan-400 hover:underline" data-testid="try-pay-link">打开收银台 →</a>}</div>)}
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3" data-testid="callback-sample">
        <div className="flex items-center gap-2 text-sm font-semibold"><Webhook className="w-4 h-4 text-cyan-400" /> 回调通知验签示例</div>
        <p className="text-xs text-slate-500">订单支付成功后平台 POST 回调商户 notify_url；请以下列 sign_string 重新计算签名并与 sign 比对，一致则回复纯文本 <span className="font-mono text-cyan-400">success</span>。</p>
        {callbackSample ? (
          <div className="grid lg:grid-cols-2 gap-4">
            <div><div className="text-xs text-slate-400 mb-1">回调 Body（示例，sign 用该商户密钥计算）</div><Code testid="callback-payload">{JSON.stringify(callbackSample.payload, null, 2)}</Code></div>
            <div className="space-y-3">
              <div><div className="text-xs text-slate-400 mb-1">待签名串</div><Code testid="callback-sign-string">{callbackSample.sign_string}</Code></div>
              <div><div className="text-xs text-slate-400 mb-1">算法</div><Code>{callbackSample.algorithm}</Code></div>
            </div>
          </div>
        ) : <div className="text-xs text-slate-500">请选择商户以生成验签示例</div>}
      </div>
    </div>
  );
}
