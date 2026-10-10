import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, fmtDate, PAYOUT_STATUS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Loader2, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import { CommissionExport } from "@/components/CommissionExport";
import { MerchantStatementExport } from "@/components/MerchantStatementExport";

export default function SettlementsPage() {
  const { user, refresh } = useAuth();
  const [recon, setRecon] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const load = () => {
    api.get("/settlements/reconciliation").then((r) => setRecon(r.data)).catch(() => {});
    api.get("/settlements/payouts").then((r) => { setPayouts(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const header = "商户,订单数,交易总额,手续费,商户实收,代理分润,平台利润\n";
    const rows = recon.map((r) => `${r.merchant_name},${r.order_count},${r.total_amount},${r.total_fee},${r.total_receive},${r.total_commission},${r.total_platform}`).join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `对账报表_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("对账报表已导出");
  };

  const requestPayout = async () => {
    try {
      await api.post("/settlements/payouts", { amount: Number(amount) });
      toast.success("提现申请已提交");
      setPayoutOpen(false); setAmount("");
      load(); refresh();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const act = async (p, action) => {
    try {
      await api.post(`/settlements/payouts/${p.id}/${action}`);
      toast.success(action === "approve" ? "已放款" : "已驳回");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="settlements-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">结算分润</h1>
          <p className="text-sm text-slate-400 mt-1">对账报表、分润明细与提现管理</p>
        </div>
        <div className="flex gap-2">
          <MerchantStatementExport user={user} />
          {user.role !== "merchant" && <CommissionExport isAdmin={user.role === "admin"} />}
          <Button onClick={exportCsv} variant="outline" data-testid="export-csv-btn" className="border-slate-700 hover:bg-slate-800">
            <Download className="w-4 h-4 mr-1" /> 导出对账
          </Button>
          {user.role !== "admin" && (
            <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
              <DialogTrigger asChild>
                <Button data-testid="request-payout-btn" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
                  <ArrowUpRight className="w-4 h-4 mr-1" /> 申请提现
                </Button>
              </DialogTrigger>
              <DialogContent className="glass border-slate-700" data-testid="payout-dialog">
                <DialogHeader><DialogTitle>申请提现</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="text-sm text-slate-400">可用余额：<span className="font-mono text-emerald-400 font-semibold">{fmtUSDT(user.balance)} USDT</span></div>
                  <div className="space-y-1.5"><Label>提现金额 (USDT)</Label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="payout-amount-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                </div>
                <DialogFooter><Button onClick={requestPayout} disabled={!amount} data-testid="payout-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">提交申请</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="recon">
        <TabsList className="bg-slate-900/60 border border-slate-800">
          <TabsTrigger value="recon" data-testid="tab-recon">对账报表</TabsTrigger>
          <TabsTrigger value="payouts" data-testid="tab-payouts">提现队列</TabsTrigger>
        </TabsList>

        <TabsContent value="recon" className="mt-4">
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                  <th className="py-3 px-3 font-medium">商户</th>
                  <th className="py-3 px-3 font-medium text-right">订单数</th>
                  <th className="py-3 px-3 font-medium text-right">交易总额</th>
                  <th className="py-3 px-3 font-medium text-right">手续费</th>
                  <th className="py-3 px-3 font-medium text-right">商户实收</th>
                  <th className="py-3 px-3 font-medium text-right">代理分润</th>
                  <th className="py-3 px-3 font-medium text-right">平台利润</th>
                </tr></thead>
                <tbody>
                  {recon.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">暂无结算数据</td></tr>
                  ) : recon.map((r) => (
                    <tr key={r.merchant_id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">{r.merchant_name}</td>
                      <td className="py-3 px-3 text-right font-mono">{r.order_count}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">{fmtUSDT(r.total_amount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400">{fmtUSDT(r.total_fee)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">{fmtUSDT(r.total_receive)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sky-400">{fmtUSDT(r.total_commission)}</td>
                      <td className="py-3 px-3 text-right font-mono text-cyan-400">{fmtUSDT(r.total_platform)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                  <th className="py-3 px-3 font-medium">申请方</th>
                  <th className="py-3 px-3 font-medium text-right">金额</th>
                  <th className="py-3 px-3 font-medium">状态</th>
                  <th className="py-3 px-3 font-medium">申请时间</th>
                  {user.role === "admin" && <th className="py-3 px-3 font-medium text-right">操作</th>}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
                  ) : payouts.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-500">暂无提现记录</td></tr>
                  ) : payouts.map((p) => {
                    const s = PAYOUT_STATUS[p.status];
                    return (
                      <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">{p.merchant_name}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(p.amount)}</td>
                        <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-[11px] border ${s.bg} ${s.color}`}>{s.label}</span></td>
                        <td className="py-3 px-3 text-xs text-slate-500 font-mono">{fmtDate(p.created_at)}</td>
                        {user.role === "admin" && (
                          <td className="py-3 px-3 text-right">
                            {p.status === "pending" && (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => act(p, "approve")} data-testid={`approve-payout-${p.id}`} className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-400/10"><CheckCircle2 className="w-4 h-4" /></button>
                                <button onClick={() => act(p, "reject")} data-testid={`reject-payout-${p.id}`} className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10"><XCircle className="w-4 h-4" /></button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
