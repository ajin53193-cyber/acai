import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Mail, MessageSquare, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";
import { Btn, Card, Head, useLoad } from "./ui";

const EVENTS = [["order_paid", tr("訂單付款成功")], ["order_completed", tr("訂單充值完成")], ["order_cancelled", tr("訂單已取消")], ["order_rejected", tr("充值資料被駁回")], ["topup_paid", tr("錢包充值到帳")]];
const EVENT_LABEL = Object.fromEntries(EVENTS);
const VARS = { order_paid: "{order_id} {product} {amount}", order_completed: "{order_id} {product} {amount}", order_cancelled: "{order_id} {product} {amount} {reason}", order_rejected: "{order_id} {product} {amount} {reason}", topup_paid: "{amount} {balance}" };

const fmt = (s) => (s ? new Date(s).toLocaleString("zh-CN", { hour12: false }) : "-");

function NotifyLogs({ callApi }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [event, setEvent] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/notifications/logs?event=${event}&status=${status}&q=${encodeURIComponent(qq)}&limit=100` }).then((r) => { setRows(r.data.rows); setTotal(r.data.total); }).catch(() => toast.error(tr("載入失敗"))), [callApi, event, status, qq]);
  useEffect(() => { load(); }, [load]);
  const resend = async (l) => {
    try { await callApi({ method: "POST", url: `/admin/notifications/logs/${l.id}/resend` }); toast.success(tr("已重新發送")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("重發失敗")); }
  };
  const sel = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none";
  return (
    <Card className="p-4 mt-4" data-testid="notify-logs">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="font-semibold text-slate-800 text-sm mr-auto">{tr("發送記錄")} <span className="text-xs text-slate-400 font-normal" data-testid="notify-logs-total">{tr("共 {0} 筆", total)}</span></div>
        <select data-testid="notify-logs-event" value={event} onChange={(e) => setEvent(e.target.value)} className={sel}><option value="">{tr("全部事件")}</option>{EVENTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select data-testid="notify-logs-status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="">{tr("全部狀態")}</option><option value="sent">{tr("已發送")}</option><option value="failed">{tr("失敗")}</option></select>
        <input data-testid="notify-logs-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("收件人 / 標題 / 用戶ID")} className={sel + " w-52"} />
        <Btn kind="ghost" data-testid="notify-logs-refresh" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Btn>
      </div>
      {rows.length === 0 ? <div className="py-10 text-center text-sm text-slate-400" data-testid="notify-logs-empty">{tr("尚無發送記錄")}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200"><th className="py-2 pr-3">{tr("時間")}</th><th className="py-2 pr-3">{tr("事件")}</th><th className="py-2 pr-3">{tr("管道")}</th><th className="py-2 pr-3">{tr("收件人")}</th><th className="py-2 pr-3">{tr("標題 / 內容")}</th><th className="py-2 pr-3">{tr("狀態")}</th><th className="py-2"></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} data-testid={`notify-log-${l.id}`} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{fmt(l.created_at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap font-semibold text-slate-700">{EVENT_LABEL[l.event] || l.event}</td>
                  <td className="py-2 pr-3">{l.channel === "email" ? <span className="inline-flex items-center gap-1 text-slate-600"><Mail className="h-3 w-3" />{tr("郵件")}</span> : <span className="inline-flex items-center gap-1 text-slate-600"><MessageSquare className="h-3 w-3" />{tr("簡訊")}</span>}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.to}</td>
                  <td className="py-2 pr-3 max-w-[360px]"><div className="truncate font-medium text-slate-800">{l.subject}</div>{open === l.id && <div className="mt-1 text-slate-600 whitespace-pre-wrap">{l.body}{l.error && <div className="text-red-500 mt-1">{l.error}</div>}</div>}</td>
                  <td className="py-2 pr-3"><span data-testid={`notify-log-status-${l.id}`} className={`rounded-full px-2 py-0.5 font-semibold ${l.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{l.status === "sent" ? tr("已發送") : tr("失敗")}</span></td>
                  <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}><button data-testid={`notify-log-resend-${l.id}`} onClick={() => resend(l)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-orange-500"><Send className="h-3 w-3" />{tr("重發")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

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
    <div data-testid="notifications-admin">
      <Head title={tr("通知設定")} sub={tr("訂單付款 / 完成 / 取消 / 駁回、錢包到帳時自動通知會員；郵件經 Mailgun，簡訊經 SUBMAIL（中國大陸號碼暫不支援通知簡訊）")} right={<><Btn kind="ghost" data-testid="notify-test" onClick={test}>{tr("發送測試郵件")}</Btn><Btn data-testid="notify-save" onClick={save}>{tr("儲存設定")}</Btn></>} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between"><div><div className="font-semibold text-slate-800 text-sm">{tr("郵件通知")}</div><div className="text-xs text-slate-500">GOGO589 &lt;gogo589@www.gogo589.com&gt;</div></div><Switch data-testid="notify-email" checked={cfg.email_enabled} onCheckedChange={(v) => setCfg({ ...cfg, email_enabled: v })} /></Card>
        <Card className="p-4 flex items-center justify-between"><div><div className="font-semibold text-slate-800 text-sm">{tr("簡訊通知")}</div><div className="text-xs text-slate-500">{tr("向已綁定手機的會員發送（會消耗簡訊條數）")}</div></div><Switch data-testid="notify-sms" checked={cfg.sms_enabled} onCheckedChange={(v) => setCfg({ ...cfg, sms_enabled: v })} /></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        {EVENTS.map(([k, label]) => (
          <Card key={k} className="p-4" data-testid={`notify-event-${k}`}>
            <div className="flex items-center justify-between mb-3"><div><div className="font-semibold text-slate-800 text-sm">{label}</div><div className="text-[11px] text-slate-400">{tr("可用變數：")}{VARS[k]}</div></div><Switch data-testid={`notify-event-switch-${k}`} checked={!!cfg.events[k]} onCheckedChange={(v) => setCfg({ ...cfg, events: { ...cfg.events, [k]: v } })} /></div>
            <input data-testid={`notify-subject-${k}`} value={cfg.templates[k]?.subject || ""} onChange={(e) => setTpl(k, "subject", e.target.value)} placeholder={tr("郵件標題")} className={inp + " mb-2"} />
            <textarea data-testid={`notify-body-${k}`} value={cfg.templates[k]?.body || ""} onChange={(e) => setTpl(k, "body", e.target.value)} rows={3} placeholder={tr("內容（郵件正文 / 簡訊內容）")} className={inp} />
          </Card>
        ))}
      </div>
      <NotifyLogs callApi={callApi} />
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
