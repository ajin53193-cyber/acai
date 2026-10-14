import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, Check } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Modal, Field, Card, Pill } from "./ui";

// permission groups mirror the admin menu (key -> label)
const PERM_GROUPS = [
  [tr("儀表盤"), [["overview", tr("數據概覽")], ["sales-analysis", tr("銷售分析")], ["download-reports", tr("下載報表")]]],
  [tr("用戶管理"), [["members", tr("用戶列表")], ["user-tags", tr("用戶標籤")], ["member-assets", tr("會員資產")], ["blacklist", tr("黑名單")], ["user-logs", tr("用戶日誌")], ["verifications", tr("用戶認證")], ["user-batch", tr("批量操作")], ["feedback", tr("用戶反饋")], ["user-reports", tr("用戶報表")]]],
  [tr("商品管理"), [["products", tr("商品列表")], ["product-new", tr("新增商品")], ["categories", tr("商品分類")], ["specs", tr("規格管理")], ["inventory", tr("庫存管理")], ["reviews", tr("商品評論")]]],
  [tr("禮品卡"), [["giftcard-list", tr("禮品卡列表")], ["giftcard-pool", tr("號碼庫")], ["giftcard-orders", tr("訂單管理")], ["giftcard-new", tr("添加禮品卡")], ["giftcard-trade-query", tr("交易號查詢")], ["giftcard-api", tr("核銷接口API")]]],
  [tr("運營管理"), [["home-decoration", tr("首頁裝修")], ["activities", tr("新聞 & 促銷")], ["banners", tr("輪播圖")], ["recommendations", tr("推薦位")], ["promos", tr("優惠券")], ["notifications", tr("消息中心")], ["announcements", tr("公告")]]],
  [tr("財務管理"), [["orders", tr("訂單管理")], ["order-settlement", tr("訂單結算")], ["topups", tr("充值審核")], ["payments", tr("支付渠道")], ["reconciliation", tr("財務對賬")], ["currencies", tr("匯率配置")], ["finance-reports", tr("財務報表")]]],
  [tr("系統配置"), [["siteconfig", tr("基礎設置")], ["admins", tr("管理員管理")], ["roles", tr("角色權限")], ["operation-logs", tr("操作日誌")], ["sms-config", tr("短信配置")], ["email-config", tr("郵箱配置")], ["oauth-config", tr("授權配置")], ["translations", tr("翻譯管理")], ["paylogos", tr("支付Logo")]]],
];

const empty = { name: "", permissions: [] };

export function RolesAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/roles" }).then((r) => setList(r.data)).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi]);
  useEffect(() => { load(); }, [load]);

  const toggle = (k) => setEdit((s) => ({ ...s, permissions: s.permissions.includes(k) ? s.permissions.filter((x) => x !== k) : [...s.permissions, k] }));
  const toggleGroup = (keys, all) => setEdit((s) => ({ ...s, permissions: all ? s.permissions.filter((x) => !keys.includes(x)) : [...new Set([...s.permissions, ...keys])] }));
  const save = async () => {
    if (!edit.name.trim()) return toast.error(tr("請輸入角色名稱"));
    try { if (edit.id) await callApi({ method: "PUT", url: `/admin/roles/${edit.id}`, data: edit }); else await callApi({ method: "POST", url: "/admin/roles", data: edit }); toast.success(tr("已儲存")); setEdit(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (r) => { if (!window.confirm(tr("刪除角色「{0}」？使用此角色的管理員將變為無權限", r.name))) return; await callApi({ method: "DELETE", url: `/admin/roles/${r.id}` }); load(); };

  return (
    <div data-testid="roles-admin">
      <Head title={tr("角色權限管理")} sub={tr("建立角色並勾選可訪問的後台模組，分配給管理員")} right={<Btn data-testid="role-add" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" />{tr("新增角色")}</Btn>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="roles-grid">
        {(list || []).map((r) => (
          <Card key={r.id} data-testid={`role-${r.id}`} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-head font-bold text-slate-800 flex items-center gap-1.5"><Shield className="h-4 w-4 text-orange-500" />{r.name}</div>
              <div className="flex gap-1.5"><Btn kind="ghost" data-testid={`role-edit-${r.id}`} onClick={() => setEdit({ ...r })}><Pencil className="h-3.5 w-3.5" /></Btn><Btn kind="danger" data-testid={`role-del-${r.id}`} onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Btn></div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              <Pill tone="sky">{tr("{0} 項權限", r.permissions?.length || 0)}</Pill>
              <Pill tone="slate">{tr("{0} 位管理員", r.admin_count || 0)}</Pill>
            </div>
          </Card>
        ))}
        {list !== null && list.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-10">{tr("暫無角色，點右上角新增")}</div>}
      </div>

      {edit && (
        <Modal testId="role-modal" title={edit.id ? tr("編輯角色") : tr("新增角色")} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="role-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("角色名稱")}><Input data-testid="role-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("如：客服、運營、財務")} /></Field>
          <div className="mt-2 space-y-3 max-h-[52vh] overflow-y-auto pr-1">
            {PERM_GROUPS.map(([g, items]) => {
              const keys = items.map(([k]) => k);
              const all = keys.every((k) => edit.permissions.includes(k));
              return (
                <div key={g} className="rounded-xl border border-slate-100 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <input type="checkbox" checked={all} onChange={() => toggleGroup(keys, all)} className="h-4 w-4 accent-orange-500" data-testid={`role-group-${g}`} />{g}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {items.map(([k, label]) => (
                      <label key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input type="checkbox" data-testid={`role-perm-${k}`} checked={edit.permissions.includes(k)} onChange={() => toggle(k)} className="h-3.5 w-3.5 accent-orange-500" />{label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
