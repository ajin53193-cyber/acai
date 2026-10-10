import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, fmtDate, ROLE_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Loader2, KeyRound, Lock, Unlock, Copy, SlidersHorizontal, Snowflake,
} from "lucide-react";

export default function AccountsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(user.role === "admin" ? "merchant" : "merchant");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "merchant", rate: 0.03 });
  const [adjForm, setAdjForm] = useState({ amount: "", action: "credit", remark: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    const params = user.role === "admin" ? { role: tab } : {};
    api.get("/accounts", { params }).then((r) => { setAccounts(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { setLoading(true); load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setSaving(true);
    try {
      const body = { ...form, rate: Number(form.rate) };
      if (user.role === "agent") body.role = "merchant";
      await api.post("/accounts", body);
      toast.success("账户已创建");
      setCreateOpen(false);
      setForm({ email: "", password: "", name: "", role: "merchant", rate: 0.03 });
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const doAdjust = async () => {
    try {
      await api.post(`/accounts/${adjust.id}/adjust`, { ...adjForm, amount: Number(adjForm.amount) });
      toast.success("余额已调整");
      setAdjust(null); setAdjForm({ amount: "", action: "credit", remark: "" });
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const toggleStatus = async (a) => {
    try {
      const { data } = await api.post(`/accounts/${a.id}/toggle-status`);
      toast.success(data.status === "frozen" ? "账户已冻结" : "账户已解冻");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const resetKey = async (a) => {
    try {
      const { data } = await api.post(`/accounts/${a.id}/reset-api-key`);
      navigator.clipboard.writeText(`API Key: ${data.api_key}\nSecret: ${data.api_secret}`);
      toast.success("密钥已重置并复制到剪贴板");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("已复制"); };

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">账户权限</h1>
          <p className="text-sm text-slate-400 mt-1">{user.role === "admin" ? "管理代理商与商户账户、费率及 API 密钥" : "管理您的下级商户"}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-account-btn" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-90">
              <Plus className="w-4 h-4 mr-1" /> 新增账户
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-slate-700" data-testid="create-account-dialog">
            <DialogHeader><DialogTitle>新增账户</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {user.role === "admin" && (
                <div className="space-y-1.5"><Label>账户类型</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger data-testid="account-role-select" className="bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="merchant">商户</SelectItem><SelectItem value="agent">代理商</SelectItem></SelectContent>
                  </Select></div>
              )}
              <div className="space-y-1.5"><Label>名称</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="account-name-input" className="bg-slate-900/60 border-slate-700" /></div>
              <div className="space-y-1.5"><Label>邮箱</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="account-email-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              <div className="space-y-1.5"><Label>初始密码</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="account-password-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              <div className="space-y-1.5"><Label>费率 (0-1)</Label><Input type="number" step="0.001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} data-testid="account-rate-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={saving || !form.email || !form.name || !form.password} data-testid="account-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认创建"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {user.role === "admin" && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-900/60 border border-slate-800">
            <TabsTrigger value="merchant" data-testid="tab-merchants">商户</TabsTrigger>
            <TabsTrigger value="agent" data-testid="tab-agents">代理商</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
              <th className="py-3 px-3 font-medium">名称</th>
              <th className="py-3 px-3 font-medium">邮箱</th>
              <th className="py-3 px-3 font-medium">角色</th>
              <th className="py-3 px-3 font-medium text-right">费率</th>
              <th className="py-3 px-3 font-medium text-right">余额</th>
              <th className="py-3 px-3 font-medium">API Key</th>
              <th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium text-right">操作</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 inline" /></td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">暂无账户</td></tr>
              ) : accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors" data-testid={`account-row-${a.id}`}>
                  <td className="py-3 px-3 font-medium">{a.name}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-400">{a.email}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">{ROLE_LABELS[a.role]}</span></td>
                  <td className="py-3 px-3 text-right font-mono">{(a.rate * 100).toFixed(2)}%</td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">{fmtUSDT(a.balance)}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-400">
                    {a.api_key ? (
                      <button onClick={() => copy(a.api_key)} className="flex items-center gap-1 hover:text-cyan-400">{a.api_key.slice(0, 12)}... <Copy className="w-3 h-3" /></button>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${a.status === "active" ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400" : "bg-red-400/10 border-red-400/30 text-red-400"}`}>
                      {a.status === "active" ? "正常" : "冻结"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.role === "admin" && (
                        <button onClick={() => setAdjust(a)} data-testid={`adjust-${a.id}`} title="调整余额" className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-400/10"><SlidersHorizontal className="w-4 h-4" /></button>
                      )}
                      {a.role === "merchant" && (
                        <button onClick={() => resetKey(a)} data-testid={`reset-key-${a.id}`} title="重置密钥" className="p-1.5 rounded-md text-amber-400 hover:bg-amber-400/10"><KeyRound className="w-4 h-4" /></button>
                      )}
                      {user.role === "admin" && (
                        <button onClick={() => toggleStatus(a)} data-testid={`toggle-status-${a.id}`} title={a.status === "active" ? "冻结" : "解冻"} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700">
                          {a.status === "active" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* adjust dialog */}
      <Dialog open={!!adjust} onOpenChange={(v) => !v && setAdjust(null)}>
        <DialogContent className="glass border-slate-700" data-testid="adjust-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Snowflake className="w-4 h-4 text-cyan-400" /> 余额调整 · {adjust?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-slate-400">当前余额：<span className="font-mono text-emerald-400 font-semibold">{fmtUSDT(adjust?.balance)}</span> · 冻结：<span className="font-mono text-amber-400">{fmtUSDT(adjust?.frozen_balance)}</span></div>
            <div className="space-y-1.5"><Label>操作类型</Label>
              <Select value={adjForm.action} onValueChange={(v) => setAdjForm({ ...adjForm, action: v })}>
                <SelectTrigger data-testid="adjust-action-select" className="bg-slate-900/60 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">增加余额</SelectItem>
                  <SelectItem value="debit">扣减余额</SelectItem>
                  <SelectItem value="freeze">冻结</SelectItem>
                  <SelectItem value="unfreeze">解冻</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>金额 (USDT)</Label><Input type="number" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} data-testid="adjust-amount-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
            <div className="space-y-1.5"><Label>备注</Label><Input value={adjForm.remark} onChange={(e) => setAdjForm({ ...adjForm, remark: e.target.value })} className="bg-slate-900/60 border-slate-700" /></div>
          </div>
          <DialogFooter><Button onClick={doAdjust} disabled={!adjForm.amount} data-testid="adjust-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">确认调整</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
