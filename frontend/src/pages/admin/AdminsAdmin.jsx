import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { UserPlus, ShieldCheck, Crown, Trash2, BadgeCheck, KeyRound } from "lucide-react";
import { ChangePasswordDialog } from "@/pages/admin/ChangePasswordDialog";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Pill, Card } from "./ui";

export function AdminsAdmin({ callApi }) {
  const [admins, setAdmins] = useState(null);
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [roleId, setRoleId] = useState("");
  const load = useCallback(() => {
    callApi({ method: "GET", url: "/admin/admins" }).then((r) => setAdmins(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗")));
    callApi({ method: "GET", url: "/admin/roles" }).then((r) => setRoles(r.data)).catch(() => {});
  }, [callApi]);
  useEffect(() => { load(); }, [load]);

  const [pw, setPw] = useState("");
  const create = async () => {
    if (!email.trim() || !pw) return toast.error(tr("請輸入信箱與密碼"));
    try { await callApi({ method: "POST", url: "/admin/admins/create", data: { email: email.trim(), password: pw, role_id: roleId } }); toast.success(tr("管理員已建立")); setEmail(""); setPw(""); setRoleId(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const promote = async () => {
    if (!email.trim()) return toast.error(tr("請輸入用戶信箱"));
    try { await callApi({ method: "POST", url: "/admin/admins/promote", data: { email: email.trim(), role_id: roleId } }); toast.success(tr("已設為管理員")); setEmail(""); setRoleId(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const setRole = async (uid, role_id) => { try { await callApi({ method: "POST", url: `/admin/admins/${uid}/role`, data: { role_id, is_super: false } }); toast.success(tr("已更新角色")); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); } };
  const makeSuper = async (uid) => { try { await callApi({ method: "POST", url: `/admin/admins/${uid}/role`, data: { is_super: true } }); toast.success(tr("已設為超級管理員")); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); } };
  const revoke = async (uid) => { if (!window.confirm(tr("撤銷此管理員權限？"))) return; try { await callApi({ method: "POST", url: `/admin/admins/${uid}/revoke` }); toast.success(tr("已撤銷")); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); } };

  return (
    <div data-testid="admins-admin">
      <Head title={tr("管理員管理")} sub={tr("將已註冊用戶設為管理員並分配角色；超級管理員擁有全部權限")} />
      <Card className="p-4 mb-4 max-w-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><UserPlus className="h-4 w-4 text-orange-500" />{tr("新增管理員")}</div>
        <div className="text-xs text-slate-500 mb-2">{tr("填寫信箱＋密碼直接建立管理員帳號；若該信箱已是註冊用戶，留空密碼並點「設為管理員」即可提升")}</div>
        <div className="flex flex-wrap gap-2">
          <Input data-testid="admins-email" className="flex-1 min-w-[12rem]" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("登入信箱")} />
          <Input data-testid="admins-password" type="text" className="w-44" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tr("密碼（8~32位）")} />
          <select data-testid="admins-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
            <option value="">{tr("不指定角色（全部權限）")}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Btn data-testid="admins-create" onClick={create}><UserPlus className="h-4 w-4" />{tr("建立管理員")}</Btn>
          <Btn data-testid="admins-promote" kind="ghost" onClick={promote}>{tr("設為管理員")}</Btn>
        </div>
      </Card>
      <Table testId="admins-table" cols={[tr("管理員"), tr("角色"), tr("兩步驗證"), tr("操作")]}
        empty={admins === null ? tr("載入中…") : tr("暫無管理員")} rows={admins || []} render={(a) => (
          <tr key={a.user_id} data-testid={`admin-row-${a.user_id}`} className="hover:bg-orange-50/30">
            <td className="px-4 py-3"><div className="font-semibold text-slate-800 flex items-center gap-1.5">{a.email || "-"}{a.is_super && <Crown className="h-3.5 w-3.5 text-amber-500" />}{a.is_self && <Pill tone="sky">{tr("我")}</Pill>}</div><div className="text-[11px] text-slate-400">#{a.account}</div></td>
            <td className="px-4 py-3">
              {a.is_super ? <Pill tone="amber"><span className="inline-flex items-center gap-1"><Crown className="h-3 w-3" />{tr("超級管理員")}</span></Pill> : (
                <select data-testid={`admin-role-${a.user_id}`} value={a.role_id || ""} onChange={(e) => setRole(a.user_id, e.target.value)} className="h-8 rounded-lg bg-slate-100 px-2 text-xs outline-none" disabled={a.is_self}>
                  <option value="">{tr("全部權限")}</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
            </td>
            <td className="px-4 py-3">{a.twofa ? <Pill tone="emerald"><span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" />{tr("已啟用")}</span></Pill> : <Pill tone="slate">{tr("未啟用")}</Pill>}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1.5">
                <Btn kind="ghost" data-testid={`admin-reset-pw-${a.user_id}`} onClick={() => setResetTarget(a)}><KeyRound className="h-3.5 w-3.5" />{tr("重設密碼")}</Btn>
                {!a.is_super && <Btn kind="ghost" data-testid={`admin-super-${a.user_id}`} onClick={() => makeSuper(a.user_id)}><ShieldCheck className="h-3.5 w-3.5" />{tr("設超管")}</Btn>}
                {!a.is_self && <Btn kind="danger" data-testid={`admin-revoke-${a.user_id}`} onClick={() => revoke(a.user_id)}><Trash2 className="h-3.5 w-3.5" /></Btn>}
              </div>
            </td>
          </tr>
        )} />
      {resetTarget && <ChangePasswordDialog callApi={callApi} target={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}
