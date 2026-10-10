import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, NETWORK_COLORS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy, ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, Zap, Wallet,
} from "lucide-react";

function Countdown({ expiresAt, status }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (status !== "pending") return null;
  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  const pct = Math.min(100, (left / 900) * 100);
  return (
    <div className="flex items-center gap-2 text-amber-400">
      <Clock className="w-4 h-4" />
      <span className="font-mono text-lg font-bold">{m}:{s}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden ml-2">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    api.get(`/orders/${orderNo}/public`).then((r) => setOrder(r.data)).catch(() => setNotFound(true));
  }, [orderNo]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const simulate = async () => {
    setPaying(true);
    try {
      await api.post(`/orders/${orderNo}/simulate-pay`);
      toast.success("支付成功！");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setPaying(false); }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };

  if (notFound)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background grain">
        <div className="text-center"><XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" /><p className="text-slate-400">订单不存在或已失效</p></div>
      </div>
    );

  if (!order)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background grain">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=0F172A&color=F8FAFC&qzone=1&data=${encodeURIComponent(order.wallet_address)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain p-4 relative overflow-hidden" data-testid="checkout-page">
      <div className="absolute top-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md fade-up">
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-slate-950" /></div>
          <span className="font-semibold">四方收款 · USDT 收银台</span>
        </div>

        <div className="glass rounded-2xl p-7 shadow-2xl">
          <div className="text-center mb-5">
            <div className="text-xs text-slate-400 mb-1">应付金额</div>
            <div className="font-mono text-4xl font-bold text-emerald-400">{fmtUSDT(order.amount_usdt)}</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">USDT · {order.merchant_name}</div>
          </div>

          {order.status === "paid" ? (
            <div className="py-8 flex flex-col items-center gap-3" data-testid="checkout-paid">
              <div className="w-16 h-16 rounded-full bg-emerald-400/15 flex items-center justify-center"><CheckCircle2 className="w-9 h-9 text-emerald-400" /></div>
              <div className="text-lg font-semibold text-emerald-400">支付成功</div>
              {order.tx_id && <div className="font-mono text-[11px] text-slate-500 break-all text-center px-4">TxID: {order.tx_id}</div>}
            </div>
          ) : order.status === "expired" ? (
            <div className="py-8 flex flex-col items-center gap-3" data-testid="checkout-expired">
              <div className="w-16 h-16 rounded-full bg-red-400/15 flex items-center justify-center"><XCircle className="w-9 h-9 text-red-400" /></div>
              <div className="text-lg font-semibold text-red-400">订单已超时</div>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                  <img src={qrUrl} alt="USDT 收款二维码" width={200} height={200} className="rounded-lg" data-testid="checkout-qr" />
                </div>
              </div>

              <div className="flex items-center justify-center mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-mono border ${NETWORK_COLORS[order.network]}`}>{order.network} 网络</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-xs text-slate-400">收款地址</div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-700">
                  <span className="font-mono text-xs break-all flex-1" data-testid="checkout-address">{order.wallet_address}</span>
                  <button onClick={() => copy(order.wallet_address)} data-testid="copy-address-btn" className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-400/10 shrink-0"><Copy className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-700">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400">精确金额</span>
                  <span className="font-mono text-sm font-semibold ml-auto text-cyan-300" data-testid="checkout-pay-amount">{order.pay_amount}</span>
                  <button onClick={() => copy(String(order.pay_amount))} className="p-1 rounded text-cyan-400 hover:bg-cyan-400/10"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                {order.live && <p className="text-[11px] text-amber-400/90">请务必按精确金额（含小数尾数）转账，系统通过金额自动匹配订单，金额不符将无法自动到账</p>}
              </div>

              <div className="mb-5"><Countdown expiresAt={order.expires_at} status={order.status} /></div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" /> {order.live ? "正在通过 TronGrid 监听 TRC20 链上到账..." : "正在监听链上到账..."}
              </div>

              {!order.live && <Button onClick={simulate} disabled={paying} data-testid="simulate-payment-btn" className="w-full h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> 模拟支付（演示）</>}
              </Button>}
            </>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-4 font-mono">订单号 {order.order_no}</p>
      </div>
    </div>
  );
}
