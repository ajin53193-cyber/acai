import { useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, STATUS_MAP, NETWORK_COLORS, fmtDate, shortHash } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Search, Copy, ExternalLink, Zap, Loader2, CheckCircle2,
} from "lucide-react";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [merchants, setMerchants] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState("TRC20");
  const [merchantId, setMerchantId] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const params = { limit: 300 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (networkFilter !== "all") params.network = networkFilter;
    if (keyword) params.keyword = keyword;
    api.get("/orders", { params }).then((r) => { setOrders(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [statusFilter, networkFilter, keyword]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user.role !== "merchant") api.get("/accounts", { params: { role: "merchant" } }).then((r) => setMerchants(r.data)).catch(() => {});
  }, [user.role]);

  const createOrder = async () => {
    setCreating(true);
    try {
      const body = { amount_usdt: Number(amount), network };
      if (user.role !== "merchant") body.merchant_id = merchantId;
      if (notifyUrl) body.notify_url = notifyUrl;
      const { data } = await api.post("/orders", body);
      toast.success(data.live ? `订单已创建，请向地址精确转账 ${data.pay_amount} USDT` : `订单已创建 ${data.order_no}`);
      setCreateOpen(false);
      setAmount(""); setMerchantId(""); setNotifyUrl("");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setCreating(false);
    }
  };

  const simulatePay = async (order) => {
    try {
      await api.post(`/orders/${order.order_no}/simulate-pay`);
      toast.success("模拟支付成功，已上链确认");
      load();
      if (detail) setDetail({ ...detail, status: "paid" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const copy = (text, msg) => {
    navigator.clipboard.writeText(text);
    toast.success(msg || "已复制");
  };

  const copyPayLink = (o) => copy(`${window.location.origin}/pay/${o.order_no}`, "收银台链接已复制");

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单与收款</h1>
          <p className="text-sm text-slate-400 mt-1">管理 USDT 收款订单，实时跟踪链上状态</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-order-btn" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
              <Plus className="w-4 h-4 mr-1" /> 创建收款单
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-slate-700" data-testid="create-order-dialog">
            <DialogHeader><DialogTitle>创建收款订单</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {user.role !== "merchant" && (
                <div className="space-y-1.5">
                  <Label>收款商户</Label>
                  <Select value={merchantId} onValueChange={setMerchantId}>
                    <SelectTrigger data-testid="order-merchant-select" className="bg-slate-900/60 border-slate-700"><SelectValue placeholder="选择商户" /></SelectTrigger>
                    <SelectContent>
                      {merchants.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>收款金额 (USDT)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="order-amount-input" className="bg-slate-900/60 border-slate-700 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>链网络</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger data-testid="order-network-select" className="bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRC20">TRC20</SelectItem>
                    <SelectItem value="ERC20">ERC20</SelectItem>
                    <SelectItem value="BEP20">BEP20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>回调地址 <span className="text-slate-500 text-xs">（可选，留空用商户默认）</span></Label>
                <Input value={notifyUrl} onChange={(e) => setNotifyUrl(e.target.value)} placeholder="https://..." data-testid="order-notify-url-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createOrder} disabled={creating || !amount} data-testid="order-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* filters */}
      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索订单号 / TxID / 商户单号 / 钱包地址 / 金额 / 商户" data-testid="order-search-input" className="pl-9 bg-slate-900/60 border-slate-700" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="status-filter" className="w-[140px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待支付</SelectItem>
            <SelectItem value="paid">已支付</SelectItem>
            <SelectItem value="expired">超时未付</SelectItem>
          </SelectContent>
        </Select>
        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger data-testid="network-filter" className="w-[130px] bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部网络</SelectItem>
            <SelectItem value="TRC20">TRC20</SelectItem>
            <SelectItem value="ERC20">ERC20</SelectItem>
            <SelectItem value="BEP20">BEP20</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-3 font-medium">订单号</th>
                <th className="py-3 px-3 font-medium">商户</th>
                <th className="py-3 px-3 font-medium">网络</th>
                <th className="py-3 px-3 font-medium text-right">金额</th>
                <th className="py-3 px-3 font-medium">TxID</th>
                <th className="py-3 px-3 font-medium">状态</th>
                <th className="py-3 px-3 font-medium">创建时间</th>
                <th className="py-3 px-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">暂无订单</td></tr>
              ) : orders.map((o) => {
                const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
                return (
                  <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors" data-testid={`order-row-${o.order_no}`}>
                    <td className="py-3 px-3 font-mono text-xs text-slate-300">{o.order_no}</td>
                    <td className="py-3 px-3">{o.merchant_name}</td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${NETWORK_COLORS[o.network]}`}>{o.network}</span></td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                      {fmtUSDT(o.amount_usdt)}
                      {o.live && <div className="text-[10px] text-slate-500 font-normal" title="链上精确匹配金额">到账 {o.pay_amount}</div>}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-400">{shortHash(o.tx_id)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${s.bg} ${s.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${o.status === "pending" ? "pulse-dot" : ""}`} />{s.label}
                      </span>
                      {o.live && <span className="ml-1 text-[10px] text-emerald-400/80 font-mono">链上</span>}
                      {o.callback_status && o.callback_status !== "none" && (
                        <span className={`ml-1 text-[10px] font-mono ${o.callback_status === "success" ? "text-emerald-400" : o.callback_status === "failed" ? "text-red-400" : "text-sky-400"}`} data-testid={`cb-status-${o.order_no}`}>
                          回调{{ pending: "待推", retrying: "重试", success: "成功", failed: "失败" }[o.callback_status]}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 font-mono">{fmtDate(o.created_at)}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {o.status === "pending" && !o.live && (
                          <button onClick={() => simulatePay(o)} data-testid={`simulate-pay-${o.order_no}`} title="模拟支付" className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => copyPayLink(o)} data-testid={`copy-link-${o.order_no}`} title="复制收银台链接" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDetail(o)} data-testid={`detail-${o.order_no}`} title="详情" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* detail dialog */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="glass border-slate-700" data-testid="order-detail-dialog">
          <DialogHeader><DialogTitle>订单详情</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {[
                ["订单号", detail.order_no],
                ["商户", detail.merchant_name],
                ["通道", detail.channel_name],
                ["收款地址", detail.wallet_address],
                ["TxID", detail.tx_id || "—"],
                ["商户单号", detail.out_trade_no || "—"],
                ["回调地址", detail.notify_url || "—"],
                ["收款模式", detail.live ? "真实链上监听 (TronGrid)" : "模拟到账"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-800/50">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-mono text-xs text-right break-all max-w-[65%] flex items-center gap-1.5">
                    {v}
                    {(k === "收款地址" || k === "TxID") && v !== "—" && (
                      <button onClick={() => copy(v)} className="text-slate-500 hover:text-cyan-400"><Copy className="w-3 h-3" /></button>
                    )}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">金额</span>
                <span className="font-mono font-bold text-emerald-400">{fmtUSDT(detail.amount_usdt)} USDT</span>
              </div>
              {detail.live && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">链上精确到账金额</span>
                  <span className="font-mono font-bold text-cyan-400" data-testid="detail-pay-amount">{detail.pay_amount} USDT</span>
                </div>
              )}
              {detail.status === "pending" && detail.live && (
                <div className="text-center text-xs text-slate-400 py-2 flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />正在通过 TronGrid 监听链上到账…</div>
              )}
              {detail.status === "pending" && !detail.live && (
                <Button onClick={() => simulatePay(detail)} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid="detail-simulate-pay-btn">
                  <Zap className="w-4 h-4 mr-1" /> 模拟到账确认
                </Button>
              )}
              {detail.status === "paid" && (
                <div className="flex items-center justify-center gap-2 text-emerald-400 py-2">
                  <CheckCircle2 className="w-5 h-5" /> 已完成支付
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
