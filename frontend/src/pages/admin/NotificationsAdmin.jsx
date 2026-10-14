import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";
import { Btn, Card, Head, useLoad } from "./ui";

const EVENTS = [["order_paid", tr("訂單付款成功")], ["order_completed", tr("訂單充值完成")], ["order_rejected", tr("充值資料被駁回")], ["topup_paid", tr("USDT 錢包到帳")]];
const VARS = { order_paid: "{order_id} {amount}", order_completed: "{order_id} {amount}", order_rejected: "{order_id} {reason}", topup_paid: "{amount} {balance}" };

export function NotificationsAdmin({ callApi }) {
  const [data] = useLoad(callApi, "/admin/notifications");
  const [cfg, setCfg] = useState(null);
  const [bal, setBal] = useState(null);
  useEffect(() => { if (data) setCfg(data); }, [data]);
  const save = async () => {
    try { await callApi({ method: "PUT", url: "/admin/notifications", data: { value: cfg } }); toast.success(tr("通知設定已儲存")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };
  const test = async () => {
    try { const r = await callApi({ method: "POST", url: "/admin/notifications/test" }); toast.success(tr("測試郵件已發送至 {0}", r.data.to)); }
    catch (e) { toast.error(e.response?.data?.detail || tr("發送失敗")); }
  };
  const loadBal = () => callApi({ method: "GET", url: "/admin/sms/balance" }).then((r) => setBal(r.data)).catch(() => toast.error(tr("查詢失敗")));
  if (!cfg) return null;
  const setTpl = (k, f, v) => setCfg({ ...cfg, templates: { ...cfg.templates, [k]: { ...cfg.templates[k], [f]: v } } });
  const inp = "w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300";
  return (
    <div>
      <Head title={tr("通知設定")} sub={tr("訂單 / 到帳通知的郵件與簡訊模板；郵件經 Mailgun，簡訊經 SUBMAIL / 大狗")} right={<><Btn kind="ghost" data-testid="notify-test" onClick={test}>{tr("發送測試郵件")}</Btn><Btn data-testid="notify-save" onClick={save}>{tr("儲存設定")}</Btn></>} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between"><div><div className="font-semibold text-slate-800 text-sm">{tr("郵件通知")}</div><div className="text-xs text-slate-500">GOGO589 &lt;gogo589@www.gogo589.com&gt;</div></div><Switch data-testid="notify-email" checked={cfg.email_enabled} onCheckedChange={(v) => setCfg({ ...cfg, email_enabled: v })} /></Card>
        <Card className="p-4 flex items-center justify-between"><div><div className="font-semibold text-slate-800 text-sm">{tr("簡訊通知")}</div><div className="text-xs text-slate-500">{tr("向已綁定手機的會員發送（會消耗簡訊條數）")}</div></div><Switch data-testid="notify-sms" checked={cfg.sms_enabled} onCheckedChange={(v) => setCfg({ ...cfg, sms_enabled: v })} /></Card>
      </div>
      <div className="space-y-3">
        {EVENTS.map(([k, label]) => (
          <Card key={k} className="p-4" data-testid={`notify-event-${k}`}>
            <div className="flex items-center justify-between mb-3"><div><div className="font-semibold text-slate-800 text-sm">{label}</div><div className="text-[11px] text-slate-400">{tr("可用變數：")}{VARS[k]}</div></div><Switch checked={!!cfg.events[k]} onCheckedChange={(v) => setCfg({ ...cfg, events: { ...cfg.events, [k]: v } })} /></div>
            <input value={cfg.templates[k]?.subject || ""} onChange={(e) => setTpl(k, "subject", e.target.value)} placeholder={tr("郵件標題")} className={inp + " mb-2"} />
            <textarea value={cfg.templates[k]?.body || ""} onChange={(e) => setTpl(k, "body", e.target.value)} rows={2} placeholder={tr("內容（郵件正文 / 簡訊內容）")} className={inp} />
          </Card>
        ))}
      </div>
      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between"><div className="font-semibold text-slate-800 text-sm">{tr("簡訊餘額")}</div><Btn kind="ghost" data-testid="sms-balance" onClick={loadBal}>{tr("查詢餘額")}</Btn></div>
        {bal && <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs">
          <div className="rounded-lg bg-slate-50 p-3"><div className="font-semibold text-slate-700 mb-1">{tr("大狗短信（中國大陸）")}</div>{bal.dagou?.status === 1 ? <div>{tr("可用條數")} <b className="text-orange-600">{bal.dagou.data.items}</b> · {tr("已用")} {bal.dagou.data.use_items} · {tr("餘額")} {bal.dagou.data.balance}</div> : <div className="text-red-500">{bal.dagou?.msg}</div>}</div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="font-semibold text-slate-700 mb-1">SUBMAIL（{tr("國際")}）</div>{bal.submail?.status === "success" ? <div>{tr("餘額")} <b className="text-orange-600">{bal.submail.balance ?? JSON.stringify(bal.submail)}</b></div> : <div className="text-red-500">{bal.submail?.msg || JSON.stringify(bal.submail)}</div>}</div>
        </div>}
      </Card>
    </div>
  );
}
