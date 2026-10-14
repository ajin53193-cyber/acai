import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";

const inp = "w-full h-10 rounded-lg bg-slate-100 border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-300";
const CATS = { usdt: "USDT", card: tr("卡支付"), ewallet: tr("電子錢包"), bank: tr("銀行轉賬") };
const PROVIDERS = { manual: tr("人工核對（無對接）"), stripe: "Stripe", paypal: "PayPal", alipay: tr("支付寶"), wechat: tr("微信支付"), crypto: tr("加密貨幣"), other: tr("其他") };
const CONFIG_FIELDS = {
  manual: [["bank_name", tr("銀行名稱")], ["account_name", tr("收款戶名")], ["account_no", tr("收款帳號")], ["swift", tr("SWIFT / 分行代碼（選填）")], ["bank_note", tr("轉帳說明（顯示給用戶，如：請備註轉帳碼）")]],
  stripe: [],
  paypal: [["client_id", "Client ID"], ["api_secret", "Client Secret"], ["env", tr("環境")]],
  alipay: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
  wechat: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
  crypto: [["base_url", tr("網關 API 網址（留空用系統預設）")], ["api_key", tr("網關 API Key")], ["api_secret", tr("網關 API Secret")], ["merchant_id", tr("網路（TRC20）")]],
  other: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
};
const PROVIDER_HINT = {
  stripe: tr("Stripe 密鑰由系統 Secrets（STRIPE_API_KEY）統一管理，無需在此填寫；收銀台自動支援信用卡、Apple Pay、Google Pay，付款成功後自動入帳。"),
  paypal: tr("請至 developer.paypal.com 建立應用取得 Client ID / Secret；沙盒用於測試，正式環境請切換為 live。用戶付款返回後自動入帳。"),
  manual: tr("用戶會看到以上收款資訊與專屬轉帳碼，上傳轉帳憑證後由後台「充值訂單」審核入帳。"),
};
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const empty = { name: "", category: "card", provider: "manual", description: "", config: {}, min_usd: 50, max_usd: 10000, fee_percent: 0, active: true };

export default function PaymentMethodsAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/payment-methods" }).then((r) => setList(r.data)).catch(() => setList([])), [callApi]);
  useEffect(() => { load(); }, [load]);

  const update = async (id, data) => { try { await callApi({ method: "PUT", url: `/admin/payment-methods/${id}`, data }); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("更新失敗")); } };
  const remove = async (m) => { if (!window.confirm(tr("確定刪除「{0}」？", m.name))) return; await callApi({ method: "DELETE", url: `/admin/payment-methods/${m.id}` }); toast.success(tr("已刪除")); load(); };
  const move = async (i, dir) => { const j = i + dir; if (j < 0 || j >= list.length) return; await update(list[i].id, { sort_order: list[j].sort_order }); await update(list[j].id, { sort_order: list[i].sort_order }); };
  const save = async (f) => {
    if (!f.name.trim()) return toast.error(tr("請輸入名稱"));
    const { id, image, created_at, ...body } = f;
    try {
      if (id) await callApi({ method: "PUT", url: `/admin/payment-methods/${id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/payment-methods", data: body });
      toast.success(tr("已儲存")); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-head text-2xl font-bold text-white">{tr("支付管理 · 錢包充值方式")}</h1>
        <button data-testid="pm-add-btn" onClick={() => setEditing({ ...empty })} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> {tr("新增支付方式")}</button>
      </div>
      <p className="text-xs text-slate-500 mb-4">{tr("會員在「我的錢包」充值時可選擇以下方式；Logo、付款說明、對接參數皆可在此維護。Stripe / PayPal 付款成功自動入帳；銀行轉帳需上傳憑證由後台審核。")}</p>
      {list === null ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="space-y-2">
          {list.length === 0 && <div className="text-slate-500 text-sm py-10 text-center">{tr("尚無支付方式")}</div>}
          {list.map((m, i) => (
            <div key={m.id} data-testid={`pm-row-${m.id}`} className={`flex flex-wrap items-center gap-3 bg-slate-900 rounded-xl border border-slate-800 px-4 py-3 ${m.active ? "" : "opacity-50"}`}>
              <span className="bg-white rounded-lg h-12 w-24 px-2 flex items-center justify-center shrink-0">
                {m.image ? <img src={m.image} alt={m.name} className="max-h-9 max-w-full object-contain" /> : <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{m.name}</span>}
              </span>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-semibold text-white">{m.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{CATS[m.category] || m.category} {tr("· 對接：")}{PROVIDERS[m.provider] || m.provider} {tr("· 限額 $")}{m.min_usd} ~ ${m.max_usd}{m.fee_percent > 0 && tr(" · 手續費 {0}%", m.fee_percent)}</div>
                {m.description && <div className="text-xs text-slate-400 mt-1 line-clamp-1">{m.description}</div>}
              </div>
              <label className="h-9 px-3 rounded-full bg-slate-800 text-xs text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700"><ImagePlus className="h-3.5 w-3.5" />{m.image ? tr("更換 Logo") : tr("上傳 Logo")}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await update(m.id, await readFile(f)); toast.success(tr("Logo 已更新")); } }} /></label>
              <button data-testid={`pm-toggle-${m.id}`} onClick={() => update(m.id, { active: !m.active })} className={`h-9 px-3 rounded-full text-xs ${m.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{m.active ? tr("啟用中") : tr("已停用")}</button>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"><ArrowDown className="h-4 w-4" /></button>
                <button data-testid={`pm-edit-${m.id}`} onClick={() => setEditing({ ...empty, ...m, config: m.config || {} })} className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                <button data-testid={`pm-delete-${m.id}`} onClick={() => remove(m)} className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-300 hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <MethodForm f={editing} setF={setEditing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MethodForm({ f, setF, onSave, onClose }) {
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setCfg = (k, v) => setF((p) => ({ ...p, config: { ...p.config, [k]: v } }));
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-slate-900">{f.id ? tr("編輯支付方式") : tr("新增支付方式")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400">{tr("名稱")}</label><input data-testid="pm-form-name" className={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("例如 VISA / MasterCard")} /></div>
            <div><label className="text-xs text-slate-400">{tr("分類")}</label>
              <select data-testid="pm-form-category" className={inp} value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-slate-400">{tr("Logo 圖片（PNG/SVG，≤2M，建議透明底）")}</label>
            <div className="flex items-center gap-3 mt-1">
              {(f.image_b64 || f.image) && <span className="bg-white rounded-lg h-12 w-24 px-2 flex items-center justify-center"><img src={f.image_b64 || f.image} alt="" className="max-h-9 max-w-full object-contain" /></span>}
              <input data-testid="pm-form-file" type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const img = await readFile(file); setF((p) => ({ ...p, ...img })); }} className="text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white" />
            </div>
          </div>
          <div><label className="text-xs text-slate-400">{tr("付款說明（顯示給會員）")}</label><textarea data-testid="pm-form-description" className={inp + " h-24 py-2"} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder={tr("例如：轉帳後請聯繫客服提供憑證，人工核對後入帳。")} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-slate-400">{tr("最低金額 USD")}</label><input type="number" className={inp} value={f.min_usd} onChange={(e) => set("min_usd", +e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">{tr("最高金額 USD")}</label><input type="number" className={inp} value={f.max_usd} onChange={(e) => set("max_usd", +e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">{tr("手續費 %")}</label><input type="number" step="0.1" className={inp} value={f.fee_percent} onChange={(e) => set("fee_percent", +e.target.value)} /></div>
          </div>
          <div className="rounded-xl border border-slate-800 p-4 space-y-3">
            <div><label className="text-xs text-slate-400">{tr("支付對接")}</label>
              <select data-testid="pm-form-provider" className={inp} value={f.provider} onChange={(e) => set("provider", e.target.value)}>{Object.entries(PROVIDERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {PROVIDER_HINT[f.provider] && <div className="col-span-2 text-[11px] text-slate-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">{PROVIDER_HINT[f.provider]}</div>}
            <div className="grid grid-cols-2 gap-3">
              {(CONFIG_FIELDS[f.provider] || []).map(([k, l]) => (
                <div key={k} className={k === "account_info" ? "col-span-2" : ""}><label className="text-xs text-slate-400">{l}</label>
                  {k === "env" ? <select data-testid="pm-form-cfg-env" className={inp} value={f.config.env || "sandbox"} onChange={(e) => setCfg("env", e.target.value)}><option value="sandbox">{tr("沙盒（測試）")}</option><option value="live">{tr("正式（live）")}</option></select>
                    : ["account_info", "bank_note"].includes(k) ? <textarea data-testid={`pm-form-cfg-${k}`} className={inp + " h-20 py-2"} value={f.config[k] || ""} onChange={(e) => setCfg(k, e.target.value)} />
                    : <input data-testid={`pm-form-cfg-${k}`} className={inp} value={f.config[k] || ""} onChange={(e) => setCfg(k, e.target.value)} placeholder={["api_key", "api_secret", "webhook_secret"].includes(k) ? tr("儲存後將遮罩顯示") : ""} />}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">{tr("對接參數僅供後台保存，目前充值為測試支付（即時入帳），正式對接金流時啟用。")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => set("active", v)} /> {tr("啟用（會員可選）")}</label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-600 text-sm">{tr("取消")}</button>
          <button data-testid="pm-form-save" onClick={() => onSave(f)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">{tr("儲存")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
