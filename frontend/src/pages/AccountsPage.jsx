import { copyText } from "@/lib/clipboard";
import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtUSDT, fmtDate, ROLE_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Loader2, KeyRound, Lock, Unlock, Copy, SlidersHorizontal, Snowflake, ShieldCheck, Fingerprint, Eye, Trash2,
} from "lucide-react";
import { Wallet } from "lucide-react";
import { MerchantDrawer } from "@/components/MerchantDrawer";

export default function AccountsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(user.role === "admin" ? "merchant" : "merchant");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "merchant", rate: 0.03, permissions: [] });
  const [perms, setPerms] = useState({});
  const [permEdit, setPermEdit] = useState(null);
  const [permVal, setPermVal] = useState([]);
  const [drawerId, setDrawerId] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  useEffect(() => { if (user.role === "admin") api.get("/accounts/permissions").then((r) => setPerms(r.data)).catch(() => {}); }, [user.role]);
  const savePerms = async () => {
    try { await api.patch(`/accounts/${permEdit.id}/permissions`, { permissions: permVal }); toast.success("权限已更新"); setPermEdit(null); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const togglePerm = (list, setList, p) => setList(list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  const [addrEdit, setAddrEdit] = useState(null);
  const [addrVal, setAddrVal] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);
  const saveAddr = async () => {
    setSavingAddr(true);
    try {
      const ips = addrVal.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      await api.patch(`/accounts/${addrEdit.id}/wallet-addresses`, { wallet_addresses: ips });
      toast.success(ips.length ? `已保存 ${ips.length} 个收款地址` : "已清空（将回退全局通道）");
      setAddrEdit(null); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSavingAddr(false); }
  };
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
      setForm({ email: "", password: "", name: "", role: "merchant", rate: 0.03, permissions: [] });
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

  const resetKey = async (a) => {    try {
      const { data } = await api.post(`/accounts/${a.id}/reset-api-key`);
      copyText(`API Key: ${data.api_key}\nSecret: ${data.api_secret}`);
      toast.success("密钥已重置并复制到剪贴板");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const copy = (t) => { copyText(t); toast.success("已复制"); };

  const toggleRequire2fa = async (a) => {
    try {
      const { data } = await api.post(`/accounts/${a.id}/require-2fa`);
      toast.success(data.totp_required ? "已强制开启两步验证" : "已取消强制两步验证");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${delTarget.id}`);
      toast.success(`账户「${delTarget.name}」已删除`);
      setDelTarget(null); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setDeleting(false); }
  };

  const doCleanup = async () => {
    setCleaning(true);
    try {
      const { data } = await api.post("/accounts/cleanup-test-merchants");
      toast.success(`已清理 ${data.removed_count} 个测试商户${data.skipped_count ? `，跳过 ${data.skipped_count} 个（有进行中订单/提现）` : ""}`);
      setCleanupOpen(false); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setCleaning(false); }
  };

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">账户权限</h1>
          <p className="text-sm text-slate-400 mt-1">{user.role === "admin" ? "管理代理商与商户账户、费率及 API 密钥" : "管理您的下级商户"}</p>
        </div>
        <div className="flex items-center gap-2">
        {user.role === "admin" && tab === "merchant" && (
          <Button variant="outline" onClick={() => setCleanupOpen(true)} data-testid="cleanup-test-merchants-btn" className="border-slate-700"><Trash2 className="w-4 h-4 mr-1" />清理测试商户</Button>
        )}
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
                    <SelectContent><SelectItem value="merchant">商户</SelectItem><SelectItem value="operator">操作员（员工）</SelectItem></SelectContent>
                  </Select></div>
              )}
              {form.role === "operator" && (
                <div className="space-y-1.5" data-testid="operator-perms"><Label>操作权限</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(perms).map(([k, l]) => (
                      <label key={k} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border cursor-pointer ${form.permissions.includes(k) ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400"}`}>
                        <input type="checkbox" checked={form.permissions.includes(k)} onChange={() => togglePerm(form.permissions, (v) => setForm({ ...form, permissions: v }), k)} data-testid={`perm-${k}`} className="accent-cyan-500" />{l}
                      </label>
                    ))}
                  </div></div>
              )}
              <div className="space-y-1.5"><Label>名称</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="account-name-input" className="bg-slate-900/60 border-slate-700" /></div>
              <div className="space-y-1.5"><Label>邮箱</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="account-email-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              <div className="space-y-1.5"><Label>初始密码</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="account-password-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
              {form.role !== "operator" && <div className="space-y-1.5"><Label>费率 (0-1)</Label><Input type="number" step="0.001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} data-testid="account-rate-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>}
            </div>
            <DialogFooter><Button onClick={create} disabled={saving || !form.email || !form.name || !form.password} data-testid="account-submit-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认创建"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {user.role === "admin" && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-900/60 border border-slate-800">
            <TabsTrigger value="merchant" data-testid="tab-merchants">商户</TabsTrigger>
            <TabsTrigger value="operator" data-testid="tab-operators">操作员</TabsTrigger>
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
                  <td className="py-3 px-3 font-medium">
                    {a.role !== "operator" ? (
                      <button onClick={() => setDrawerId(a.id)} data-testid={`account-name-${a.id}`} className="hover:text-cyan-400 transition-colors text-left">{a.name}</button>
                    ) : a.name}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-400">{a.email}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">{ROLE_LABELS[a.role]}</span>
                    {a.role === "operator" && <div className="text-[10px] text-slate-500 mt-0.5 max-w-[220px] truncate" data-testid={`perms-${a.id}`}>{(a.permissions || []).map((p) => perms[p] || p).join("、") || "无权限"}</div>}
                    {a.role === "operator" && (a.totp_required || a.totp_enabled) && (
                      <div className="flex items-center gap-1 mt-1" data-testid={`twofa-tag-${a.id}`}>
                        {a.totp_enabled && <span className="px-1.5 py-0.5 rounded text-[10px] border border-emerald-400/30 text-emerald-400 flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />2FA已绑定</span>}
                        {a.totp_required && <span className="px-1.5 py-0.5 rounded text-[10px] border border-amber-400/30 text-amber-400 flex items-center gap-0.5"><Fingerprint className="w-2.5 h-2.5" />强制2FA</span>}
                      </div>
                    )}</td>
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
                      {a.role !== "operator" && (
                        <button onClick={() => setDrawerId(a.id)} data-testid={`detail-${a.id}`} title="查看详情" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700"><Eye className="w-4 h-4" /></button>
                      )}
                        <button onClick={() => { setPermEdit(a); setPermVal(a.permissions || []); }} data-testid={`edit-perms-${a.id}`} title="编辑权限" className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-400/10"><ShieldCheck className="w-4 h-4" /></button>
                      )}
                      {user.role === "admin" && a.role === "operator" && (
                        <button onClick={() => toggleRequire2fa(a)} data-testid={`require-2fa-${a.id}`} title={a.totp_required ? "取消强制两步验证" : "强制两步验证"} className={`p-1.5 rounded-md ${a.totp_required ? "text-emerald-400 hover:bg-emerald-400/10" : "text-slate-400 hover:bg-slate-700"}`}><Fingerprint className="w-4 h-4" /></button>
                      )}
                      {user.role === "admin" && a.role !== "operator" && (
                        <button onClick={() => setAdjust(a)} data-testid={`adjust-${a.id}`} title="调整余额" className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-400/10"><SlidersHorizontal className="w-4 h-4" /></button>
                      )}
                      {a.role === "merchant" && (
                        <button onClick={() => { setAddrEdit(a); setAddrVal((a.wallet_addresses || []).join("\n")); }} data-testid={`edit-addresses-${a.id}`} title="收款地址" className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-400/10"><Wallet className="w-4 h-4" /></button>
                      )}
                      {a.role === "merchant" && (
                        <button onClick={() => resetKey(a)} data-testid={`reset-key-${a.id}`} title="重置密钥" className="p-1.5 rounded-md text-amber-400 hover:bg-amber-400/10"><KeyRound className="w-4 h-4" /></button>
                      )}
                      {user.role === "admin" && (
                        <button onClick={() => toggleStatus(a)} data-testid={`toggle-status-${a.id}`} title={a.status === "active" ? "冻结" : "解冻"} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700">
                          {a.status === "active" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      )}
                      {user.role === "admin" && (a.role === "operator" || a.role === "merchant") && (
                        <button onClick={() => setDelTarget(a)} data-testid={`delete-account-${a.id}`} title="删除账户" className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* merchant receiving addresses dialog */}
      <Dialog open={!!addrEdit} onOpenChange={(v) => !v && setAddrEdit(null)}>
        <DialogContent className="glass border-slate-700" data-testid="addr-edit-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400" /> 收款地址 · {addrEdit?.name}</DialogTitle><DialogDescription className="text-slate-400">配置该商户专属的 TRC20 收款地址池。</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">该商户专属 TRC20 收款地址（每行一个；留空则回退全局通道）</Label>
            <textarea value={addrVal} onChange={(e) => setAddrVal(e.target.value)} data-testid="addr-input" rows={6} placeholder={"T..."} className="w-full rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 text-xs font-mono p-2.5 outline-none focus:border-cyan-500" />
            <p className="text-[11px] text-slate-500">该商户的订单将只在以上地址中按「最少挂单优先 + 2 位小数金额唯一」分配。</p>
          </div>
          <DialogFooter><Button onClick={saveAddr} disabled={savingAddr} data-testid="addr-save-btn" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{savingAddr ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存收款地址"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* adjust dialog */}
      <Dialog open={!!permEdit} onOpenChange={(v) => !v && setPermEdit(null)}>
        <DialogContent className="glass border-slate-700" data-testid="perm-edit-dialog">
          <DialogHeader><DialogTitle>编辑操作员权限 · {permEdit?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-1.5 py-2">
            {Object.entries(perms).map(([k, l]) => (
              <label key={k} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border cursor-pointer ${permVal.includes(k) ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400"}`}>
                <input type="checkbox" checked={permVal.includes(k)} onChange={() => togglePerm(permVal, setPermVal, k)} data-testid={`edit-perm-${k}`} className="accent-cyan-500" />{l}
              </label>
            ))}
          </div>
          <DialogFooter><Button onClick={savePerms} data-testid="perm-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">保存权限</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent className="glass border-slate-700" data-testid="delete-account-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" /> 删除账户</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-slate-400 space-y-2">
                <div>确认删除{delTarget?.role === "operator" ? "操作员" : "商户"} <span className="text-slate-200 font-medium">「{delTarget?.name}」</span>（{delTarget?.email}）？此操作不可撤销。</div>
                {delTarget?.role === "merchant" && <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-300">若商户仍有可用/冻结余额、进行中订单或待处理提现，系统将阻止删除以保护资金安全。</div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-account-cancel" className="border-slate-700">取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete(); }} disabled={deleting} data-testid="delete-account-confirm" className="bg-red-500 text-white hover:bg-red-600">{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认删除"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent className="glass border-slate-700" data-testid="cleanup-test-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" /> 清理测试商户</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-slate-400 space-y-2">
                <div>将批量删除测试残留商户（邮箱 <code className="text-slate-300">test_*@test.com</code> / <code className="text-slate-300">*@citest.com</code> 或名称 TEST_M）。有进行中订单或待处理提现的账户会自动跳过。</div>
                <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-300">演示账户（@demo.com）不会被匹配。此操作不可撤销。</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cleanup-test-cancel" className="border-slate-700">取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doCleanup(); }} disabled={cleaning} data-testid="cleanup-test-confirm" className="bg-red-500 text-white hover:bg-red-600">{cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认清理"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MerchantDrawer accountId={drawerId} open={!!drawerId} onClose={() => setDrawerId(null)} isAdmin={user.role === "admin"} onReset={() => load()} />
    </div>
  );
}
