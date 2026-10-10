import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtUSDT, NETWORK_COLORS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Network, Gauge, Loader2, Wallet } from "lucide-react";

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", network: "TRC20", fee_rate: 0.02, weight: 10, min_amount: 10, max_amount: 50000 });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/channels").then((r) => { setChannels(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/channels", {
        ...form, fee_rate: Number(form.fee_rate), weight: Number(form.weight),
        min_amount: Number(form.min_amount), max_amount: Number(form.max_amount),
      });
      toast.success("通道已创建");
      setOpen(false);
      setForm({ name: "", network: "TRC20", fee_rate: 0.02, weight: 10, min_amount: 10, max_amount: 50000 });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const toggle = async (c) => {
    try {
      await api.patch(`/channels/${c.id}`, { status: c.status === "active" ? "inactive" : "active" });
      toast.success(c.status === "active" ? "通道已停用" : "通道已启用");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="channels-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通道路由</h1>
          <p className="text-sm text-slate-400 mt-1">配置 USDT 收款通道、权重路由与费率</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-channel-btn" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
              <Plus className="w-4 h-4 mr-1" /> 新增通道
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-slate-700" data-testid="create-channel-dialog">
            <DialogHeader><DialogTitle>新增收款通道</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>通道名称</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="channel-name-input" className="bg-slate-900/60 border-slate-700" placeholder="例如：TRC20 极速通道" /></div>
              <div className="space-y-1.5"><Label>链网络</Label>
                <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
                  <SelectTrigger data-testid="channel-network-select" className="bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="TRC20">TRC20</SelectItem><SelectItem value="ERC20">ERC20</SelectItem><SelectItem value="BEP20">BEP20</SelectItem></SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>费率 (0-1)</Label><Input type="number" step="0.001" value={form.fee_rate} onChange={(e) => setForm({ ...form, fee_rate: e.target.value })} data-testid="channel-fee-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>权重</Label><Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} data-testid="channel-weight-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>最小金额</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>最大金额</Label><Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create} disabled={saving || !form.name} data-testid="channel-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认创建"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((c) => (
            <div key={c.id} className="glass rounded-xl p-5 fade-up" data-testid={`channel-card-${c.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><Network className="w-4 h-4 text-cyan-400" /></div>
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${NETWORK_COLORS[c.network]}`}>{c.network}</span>
                  </div>
                </div>
                <Switch checked={c.status === "active"} onCheckedChange={() => toggle(c)} data-testid={`channel-toggle-${c.id}`} />
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div><div className="text-[11px] text-slate-500">费率</div><div className="font-mono font-semibold">{(c.fee_rate * 100).toFixed(2)}%</div></div>
                <div><div className="text-[11px] text-slate-500 flex items-center gap-1"><Gauge className="w-3 h-3" />权重</div><div className="font-mono font-semibold">{c.weight}</div></div>
                <div><div className="text-[11px] text-slate-500">成功率</div><div className="font-mono font-semibold text-emerald-400">{c.success_rate}%</div></div>
                <div><div className="text-[11px] text-slate-500 flex items-center gap-1"><Wallet className="w-3 h-3" />钱包池</div><div className="font-mono font-semibold">{fmtUSDT(c.wallet_balance)}</div></div>
                <div className="col-span-2"><div className="text-[11px] text-slate-500">限额区间</div><div className="font-mono text-xs">{fmtUSDT(c.min_amount)} ~ {fmtUSDT(c.max_amount)} USDT</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
