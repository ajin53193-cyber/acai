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
import { Plus, Network, Gauge, Loader2, Wallet, Radio, Pencil, Check, X, RefreshCw } from "lucide-react";
import { CheckoutSettingsDialog } from "@/components/CheckoutSettingsDialog";

function WalletField({ channel, onSaved }) {
  const addrs = channel.wallet_addresses || [];
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(addrs.join("\n"));
  const [saving, setSaving] = useState(false);
  const pending = channel.pending_by_address || {};
  const save = async () => {
    setSaving(true);
    const list = val.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    try {
      await api.patch(`/channels/${channel.id}`, { wallet_addresses: list });
      toast.success(list.length ? `已配置 ${list.length} 个收款地址，开始链上监听` : "已清除收款地址，切回模拟模式");
      setEditing(false); onSaved();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  if (editing) return (
    <div className="space-y-1">
      <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={Math.min(8, Math.max(3, val.split("\n").length + 1))}
        placeholder={channel.network === "TRC20" ? "每行一个 T 开头 34 位地址，可填多个" : "每行一个 0x 开头 42 位地址"}
        data-testid={`wallet-input-${channel.id}`} className="w-full rounded-md text-[11px] font-mono bg-slate-900/60 border border-slate-700 p-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
      <div className="flex items-center gap-1 justify-end">
        <span className="text-[10px] text-slate-500 mr-auto">多地址轮询分流，每地址最多 9999 笔并发待支付</span>
        <button onClick={save} disabled={saving} data-testid={`wallet-save-${channel.id}`} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
        <button onClick={() => { setEditing(false); setVal(addrs.join("\n")); }} className="p-1 text-slate-400 hover:bg-slate-700 rounded"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[11px] ${addrs.length ? "text-slate-200" : "text-slate-500"}`} data-testid={`wallet-address-${channel.id}`}>
          {addrs.length ? `${addrs.length} 个地址池` : "未配置（模拟模式）"}
        </span>
        <button onClick={() => setEditing(true)} data-testid={`wallet-edit-${channel.id}`} className="p-1 text-slate-500 hover:text-cyan-400 shrink-0"><Pencil className="w-3 h-3" /></button>
      </div>
      {addrs.slice(0, 4).map((a) => (
        <div key={a} className="flex items-center gap-2 font-mono text-[10px] text-slate-400" data-testid={`wallet-addr-row-${channel.id}`}>
          <span className="truncate">{a}</span>
          <span className={`ml-auto shrink-0 px-1.5 rounded ${pending[a] ? "text-amber-400 bg-amber-400/10" : "text-slate-600"}`}>{pending[a] || 0} 待付</span>
        </div>
      ))}
      {addrs.length > 4 && <div className="text-[10px] text-slate-500">… 另 {addrs.length - 4} 个地址</div>}
    </div>
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", network: "TRC20", fee_rate: 0.02, weight: 10, min_amount: 10, max_amount: 50000, wallet_address: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/chain/sync");
      toast[data.errors?.length ? "warning" : "success"](`已扫描 ${data.addresses} 个地址 / ${data.scanned} 笔转账，匹配 ${data.matched} 笔订单${data.errors?.length ? `，${data.errors.length} 个地址失败` : ""}`);
      (data.errors || []).slice(0, 2).forEach((e) => toast.error(e, { duration: 7000 }));
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSyncing(false); }
  };

  const load = () => api.get("/channels").then((r) => { setChannels(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/channels", {
        ...form, wallet_address: "", fee_rate: Number(form.fee_rate), weight: Number(form.weight),
        min_amount: Number(form.min_amount), max_amount: Number(form.max_amount),
        wallet_addresses: form.wallet_address.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean),
      });
      toast.success("通道已创建");
      setOpen(false);
      setForm({ name: "", network: "TRC20", fee_rate: 0.02, weight: 10, min_amount: 10, max_amount: 50000, wallet_address: "" });
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
          <p className="text-sm text-slate-400 mt-1">配置 USDT-TRC20 收款通道、权重路由与费率。配置收款地址后自动监听链上到账（TRC20 via TronGrid）</p>
        </div>
        <div className="flex gap-2">
        <CheckoutSettingsDialog />
        <Button variant="outline" onClick={syncNow} disabled={syncing} data-testid="chain-sync-btn" className="border-slate-700">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" /> 立即同步链上</>}
        </Button>
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
                <div data-testid="channel-network-fixed" className="flex items-center h-10 px-3 rounded-md bg-slate-900/60 border border-slate-700 text-sm font-mono text-emerald-400">USDT · TRC20</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>费率 (0-1)</Label><Input type="number" step="0.001" value={form.fee_rate} onChange={(e) => setForm({ ...form, fee_rate: e.target.value })} data-testid="channel-fee-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>权重</Label><Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} data-testid="channel-weight-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>最小金额</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className="bg-slate-900/60 border-slate-700 font-mono" /></div>
                <div className="space-y-1.5"><Label>最大金额</Label><Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              </div>
              <div className="space-y-1.5"><Label>收款钱包地址池 <span className="text-slate-500 text-xs">（可选，每行一个，填写后启用真实链上监听）</span></Label>
                <textarea value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} rows={3} data-testid="channel-wallet-input" className="w-full rounded-md bg-slate-900/60 border border-slate-700 font-mono text-xs p-2 text-slate-200 focus:outline-none focus:border-cyan-500" placeholder={form.network === "TRC20" ? "T 开头 34 位 TRON 地址，每行一个" : "0x 开头 42 位地址，每行一个"} /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={saving || !form.name} data-testid="channel-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认创建"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
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
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${NETWORK_COLORS[c.network]}`}>{c.network}</span>
                      {c.wallet_address ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border text-emerald-400 border-emerald-400/30 bg-emerald-400/10" data-testid={`live-badge-${c.id}`}><Radio className="w-2.5 h-2.5 pulse-dot" />链上监听 ×{(c.wallet_addresses || []).length}</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border text-slate-400 border-slate-600 bg-slate-700/30">模拟</span>
                      )}
                    </div>
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
                <div className="col-span-2"><div className="text-[11px] text-slate-500 mb-0.5">收款地址</div><WalletField channel={c} onSaved={load} /></div>
                {c.wallet_address && (
                  <div className="col-span-2 text-[10px] font-mono text-slate-500">
                    {c.sync_error ? <span className="text-red-400">同步异常: {c.sync_error}</span> : c.last_sync_at ? `最近同步 ${new Date(c.last_sync_at).toLocaleTimeString("zh-CN")}` : "等待待支付订单后开始轮询"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
