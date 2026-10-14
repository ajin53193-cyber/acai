import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ImagePlus, Loader2, Plug, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";
import { Btn, Card, Head } from "./ui";

const inp = "w-full h-10 rounded-lg bg-white border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-300";
const CATS = { usdt: "USDT", card: tr("卡支付"), ewallet: tr("電子錢包"), bank: tr("銀行轉賬") };
const PROVIDERS = { manual: tr("人工核對（無對接）"), stripe: "Stripe", paypal: "PayPal", alipay: tr("支付寶"), wechat: tr("微信支付"), crypto: tr("加密貨幣"), other: tr("其他") };
const CONFIG_FIELDS = {
  manual: [["bank_name", tr("銀行名稱")], ["account_name", tr("收款戶名")], ["account_no", tr("收款帳號")], ["swift", tr("SWIFT / 分行代碼（選填）")], ["bank_note", tr("轉帳說明（顯示給用戶，如：請備註轉帳碼）")]],
  stripe: [],
  paypal: [["client_id", "Client ID"], ["api_secret", "Client Secret"], ["env", tr("環境")], ["webhook_id", tr("Webhook ID（選填，用於驗簽）")]],
  alipay: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
  wechat: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
  crypto: [["base_url", tr("網關 API 網址（留空用系統預設）")], ["api_key", tr("網關 API Key")], ["api_secret", tr("網關 API Secret")], ["merchant_id", tr("網路（TRC20）")]],
  other: [["account_info", tr("收款帳戶資訊（顯示給用戶）")]],
};
const PROVIDER_HINT = {
  stripe: tr("Stripe 密鑰由系統 Secrets（STRIPE_API_KEY）統一管理，無需在此填寫；收銀台自動支援信用卡、Apple Pay、Google Pay，付款成功後自動入帳。"),
  paypal: tr("請至 developer.paypal.com 建立應用取得 Client ID / Secret；此處留空則使用系統 Secrets（PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV）。沙盒用於測試，正式環境請切換為 live。用戶付款返回後自動入帳；亦可在 PayPal 後台設定 Webhook（網址：/api/webhook/paypal，事件 CHECKOUT.ORDER.APPROVED、PAYMENT.CAPTURE.COMPLETED）並填入 Webhook ID。"),
  manual: tr("用戶會看到以上收款資訊與專屬轉帳碼，上傳轉帳憑證後由後台「充值訂單」審核入帳。"),
};
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const empty = { name: "", category: "card", provider: "manual", description: "", config: {}, min_usd: 50, max_usd: 10000, fee_percent: 0, active: true };

export default function PaymentMethodsAdmin({ callApi }) {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const testConn = async (m) => {
    try {
      const r = await callApi({ method: "POST", url: `/admin/payment-methods/${m.id}/test` });
      const src = r.data.source === "db" ? tr("後台配置") : tr("系統 Secrets");
      toast.success(r.data.provider === "paypal" ? tr("PayPal 連線成功（{0} · {1}）", r.data.env, src) : tr("Stripe 連線成功"), { description: tr("Webhook 網址：{0}", r.data.webhook_url), duration: 8000 });
    } catch (e) { toast.error(e.response?.data?.detail || tr("連線失敗")); }
  };
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

  const catTone = { usdt: "bg-emerald-50 text-emerald-700", card: "bg-sky-50 text-sky-700", ewallet: "bg-violet-50 text-violet-700", bank: "bg-amber-50 text-amber-700" };
  const iconBtn = "h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white transition-colors";
  return (
    <div data-testid="payment-methods-admin">
      <Head title={tr("支付管理 · 錢包充值方式")} sub={tr("會員在「我的錢包」充值時可選擇以下方式；Logo、付款說明、對接參數皆可在此維護。Stripe / PayPal 付款成功自動入帳；銀行轉帳需上傳憑證由後台審核。")}
        right={<Btn data-testid="pm-add-btn" onClick={() => setEditing({ ...empty })} className="h-10 px-4 text-sm"><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增支付方式")}</Btn>} />
      {list === null ? <Loader2 className="h-6 w-6 animate-spin text-orange-500" /> : (
        <div className="space-y-3">
          {list.length === 0 && <Card className="p-10 text-center text-sm text-slate-400">{tr("尚未設定支付方式")}</Card>}
          {list.map((m, i) => (
            <Card key={m.id} data-testid={`pm-row-${m.id}`} className={`p-4 flex flex-wrap items-center gap-4 ${m.active ? "" : "opacity-60"}`}>
              <span className="h-14 w-32 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden px-2">
                {m.image ? <img src={m.image} alt={m.name} className="max-h-10 max-w-full object-contain" /> : <span className="text-[11px] font-bold text-slate-500 text-center leading-tight">{m.name}</span>}
              </span>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-bold text-slate-900">{m.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${catTone[m.category] || "bg-slate-100 text-slate-600"}`}>{CATS[m.category] || m.category}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600">{PROVIDERS[m.provider] || m.provider}</span>
                  <span data-testid={`pm-status-${m.id}`} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.active ? "bg-emerald-500 text-white" : "bg-slate-300 text-white"}`}>{m.active ? tr("啟用中") : tr("已停用")}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{tr("限額")} <b className="text-slate-700">USD$ {m.min_usd} ~ {m.max_usd}</b> · {tr("手續費")} <b className="text-slate-700">{m.fee_percent > 0 ? `${m.fee_percent}%` : tr("免")}</b>{m.description && <span className="text-slate-400"> · {m.description}</span>}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <button data-testid={`pm-toggle-${m.id}`} onClick={() => update(m.id, { active: !m.active })} className={`h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${m.active ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200" : "bg-emerald-500 hover:bg-emerald-600 text-white"}`}>{m.active ? <><PowerOff className="h-3.5 w-3.5" />{tr("停用")}</> : <><Power className="h-3.5 w-3.5" />{tr("啟用")}</>}</button>
                <Btn kind="ghost" data-testid={`pm-edit-${m.id}`} onClick={() => setEditing({ ...empty, ...m, config: m.config || {} })} className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" />{tr("編輯")}</Btn>
                <div className="flex items-center gap-1 ml-1 pl-3 border-l border-slate-200">
                  <button aria-label="up" disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
                  <button aria-label="down" disabled={i === list.length - 1} onClick={() => move(i, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
                  <button data-testid={`pm-delete-${m.id}`} aria-label="delete" onClick={() => remove(m)} className="h-9 w-9 rounded-lg border border-red-200 bg-white text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <MethodForm f={editing} setF={setEditing} onSave={save} onClose={() => setEditing(null)} onTest={testConn} />}
    </div>
  );
}

function MethodForm({ f, setF, onSave, onClose, onTest }) {
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setCfg = (k, v) => setF((p) => ({ ...p, config: { ...p.config, [k]: v } }));
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-slate-900">{f.id ? tr("編輯支付方式") : tr("新增支付方式")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 font-medium">{tr("名稱")}</label><input data-testid="pm-form-name" className={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("例如 VISA / MasterCard")} /></div>
            <div><label className="text-xs text-slate-500 font-medium">{tr("分類")}</label>
              <select data-testid="pm-form-category" className={inp} value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-slate-500 font-medium">{tr("Logo 圖片（PNG/SVG，≤2M，建議透明底）")}</label>
            <div className="flex items-center gap-3 mt-1">
              {(f.image_b64 || f.image) && <span className="bg-slate-50 border border-slate-200 rounded-lg h-12 w-24 px-2 flex items-center justify-center"><img src={f.image_b64 || f.image} alt="" className="max-h-9 max-w-full object-contain" /></span>}
              <label className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors"><ImagePlus className="h-3.5 w-3.5" />{(f.image_b64 || f.image) ? tr("更換 Logo") : tr("上傳 Logo")}<input data-testid="pm-form-file" type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const img = await readFile(file); setF((p) => ({ ...p, ...img })); }} /></label>
              {f.image_b64 && <span className="text-[11px] text-emerald-600">{tr("已選擇新圖，儲存後生效")}</span>}
            </div>
          </div>
          <div><label className="text-xs text-slate-500 font-medium">{tr("付款說明（顯示給會員）")}</label><textarea data-testid="pm-form-description" className={inp + " h-24 py-2"} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder={tr("例如：轉帳後請聯繫客服提供憑證，人工核對後入帳。")} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-slate-500 font-medium">{tr("最低金額 USD")}</label><input type="number" className={inp} value={f.min_usd} onChange={(e) => set("min_usd", +e.target.value)} /></div>
            <div><label className="text-xs text-slate-500 font-medium">{tr("最高金額 USD")}</label><input type="number" className={inp} value={f.max_usd} onChange={(e) => set("max_usd", +e.target.value)} /></div>
            <div><label className="text-xs text-slate-500 font-medium">{tr("手續費 %")}</label><input type="number" step="0.1" className={inp} value={f.fee_percent} onChange={(e) => set("fee_percent", +e.target.value)} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div><label className="text-xs text-slate-500 font-medium">{tr("支付對接")}</label>
              <select data-testid="pm-form-provider" className={inp} value={f.provider} onChange={(e) => set("provider", e.target.value)}>{Object.entries(PROVIDERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {PROVIDER_HINT[f.provider] && <div className="col-span-2 text-[11px] text-slate-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">{PROVIDER_HINT[f.provider]}</div>}
            {f.id && ["paypal", "stripe"].includes(f.provider) && <button type="button" data-testid={`pm-test-${f.id}`} onClick={() => onTest(f)} className="h-9 px-3.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"><Plug className="h-3.5 w-3.5" />{tr("測試連線（使用已儲存的參數）")}</button>}
            <div className="grid grid-cols-2 gap-3">
              {(CONFIG_FIELDS[f.provider] || []).map(([k, l]) => (
                <div key={k} className={k === "account_info" ? "col-span-2" : ""}><label className="text-xs text-slate-500 font-medium">{l}</label>
                  {k === "env" ? <select data-testid="pm-form-cfg-env" className={inp} value={f.config.env || "sandbox"} onChange={(e) => setCfg("env", e.target.value)}><option value="sandbox">{tr("沙盒（測試）")}</option><option value="live">{tr("正式（live）")}</option></select>
                    : ["account_info", "bank_note"].includes(k) ? <textarea data-testid={`pm-form-cfg-${k}`} className={inp + " h-20 py-2"} value={f.config[k] || ""} onChange={(e) => setCfg(k, e.target.value)} />
                    : <input data-testid={`pm-form-cfg-${k}`} className={inp} value={f.config[k] || ""} onChange={(e) => setCfg(k, e.target.value)} placeholder={["api_key", "api_secret", "webhook_secret"].includes(k) ? tr("儲存後將遮罩顯示") : ""} />}
                </div>
              ))}
            </div>
            
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => set("active", v)} /> {tr("啟用（會員可選）")}</label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-600 text-sm">{tr("取消")}</button>
          <button data-testid="pm-form-save" onClick={() => onSave(f)} className="h-10 px-5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">{tr("儲存")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
