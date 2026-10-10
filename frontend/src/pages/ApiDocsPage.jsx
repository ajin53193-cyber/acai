import { useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, Loader2, PlayCircle, Code2 } from "lucide-react";

const BASE = process.env.REACT_APP_BACKEND_URL;

async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function signString(obj) {
  return Object.keys(obj).filter((k) => k !== "sign" && obj[k] !== null && obj[k] !== undefined && obj[k] !== "")
    .sort().map((k) => `${k}=${obj[k]}`).join("&");
}

function Code({ children, testid }) {
  const copy = () => { navigator.clipboard.writeText(children); toast.success("已复制"); };
  return (
    <div className="relative group">
      <pre data-testid={testid} className="rounded-lg bg-slate-950/80 border border-slate-800 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">{children}</pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1 rounded text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100"><Copy className="w-3.5 h-3.5" /></button>
    </div>
  );
}

export default function ApiDocsPage() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState("100");
  const [outNo, setOutNo] = useState(() => "M" + Date.now());
  const [network, setNetwork] = useState("TRC20");
  const [result, setResult] = useState(null);
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);

  const tryIt = async () => {
    setBusy(true);
    try {
      const body = { api_key: user.api_key, timestamp: Math.floor(Date.now() / 1000), nonce: Math.random().toString(36).slice(2, 14),
        amount_usdt: Number(amount), network, out_trade_no: outNo, remark: "api-test" };
      body.sign = await hmacHex(user.api_secret, signString(body));
      setReq(body);
      const { data } = await api.post("/v1/orders", body);
      setResult(data);
      toast.success(`下单成功 ${data.data.order_no}`);
      setOutNo("M" + Date.now());
    } catch (err) {
      setResult(err.response?.data || { error: err.message });
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };

  return (
    <div className="space-y-6" data-testid="api-docs-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">开发者 API</h1>
        <p className="text-sm text-slate-400 mt-1">使用 api_key + HMAC-SHA256 签名从您的系统直接创建 USDT 收款订单</p>
      </div>

      <div className="glass rounded-xl p-5 space-y-3" data-testid="api-credentials">
        <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="w-4 h-4 text-cyan-400" /> 商户凭证</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs text-slate-400">api_key</Label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-xs"><span className="flex-1 truncate" data-testid="api-key-value">{user.api_key}</span><button onClick={() => copy(user.api_key)} className="text-cyan-400"><Copy className="w-3.5 h-3.5" /></button></div></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">api_secret（请妥善保管）</Label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono text-xs"><span className="flex-1 truncate" data-testid="api-secret-value">{show ? user.api_secret : "•".repeat(40)}</span>
              <button onClick={() => setShow(!show)} data-testid="toggle-secret-btn" className="text-slate-400">{show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
              <button onClick={() => copy(user.api_secret)} className="text-cyan-400"><Copy className="w-3.5 h-3.5" /></button></div></div>
        </div>
      </div>

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
          <div className="flex items-center gap-2 text-sm font-semibold"><PlayCircle className="w-4 h-4 text-emerald-400" /> 在线调试（浏览器本地签名）</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">金额 USDT</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="try-amount-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
            <div className="space-y-1"><Label className="text-xs">网络</Label>
              <select value={network} onChange={(e) => setNetwork(e.target.value)} data-testid="try-network-select" className="w-full h-10 rounded-md bg-slate-900/60 border border-slate-700 text-sm px-2">
                <option>TRC20</option><option>ERC20</option><option>BEP20</option></select></div>
            <div className="space-y-1"><Label className="text-xs">out_trade_no</Label><Input value={outNo} onChange={(e) => setOutNo(e.target.value)} data-testid="try-out-no-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
          </div>
          <Button onClick={tryIt} disabled={busy || !amount} data-testid="try-submit-btn" className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "发送签名请求 POST /api/v1/orders"}
          </Button>
          {req && (<div><div className="text-xs text-slate-400 mb-1">请求体</div><Code testid="try-request">{JSON.stringify(req, null, 2)}</Code></div>)}
          {result && (<div><div className="text-xs text-slate-400 mb-1">响应</div><Code testid="try-response">{JSON.stringify(result, null, 2)}</Code>
            {result?.data?.pay_url && <a href={result.data.pay_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-cyan-400 hover:underline" data-testid="try-pay-link">打开收银台 →</a>}</div>)}
        </div>
      </div>
    </div>
  );
}
