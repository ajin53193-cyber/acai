import { useEffect, useRef, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { playChime } from "@/components/PaymentAlerts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, AlertTriangle, WifiOff, Settings2, Check, Snowflake, Send } from "lucide-react";

const KIND = {
  balance_change: { label: "余额突变", Icon: AlertTriangle, cls: "text-amber-400" },
  sync_failed: { label: "同步失败", Icon: WifiOff, cls: "text-red-400" },
  sweep_due: { label: "建议归集", Icon: Snowflake, cls: "text-cyan-400" },
};

function TelegramSettings({ onClose }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/notify/settings").then((r) => setS(r.data)); }, []);
  const save = async () => {
    try { await api.put("/notify/settings", { ...s, telegram_bot_token: s.telegram_bot_token || "" }); toast.success("Telegram 推送设置已保存"); const r = await api.get("/notify/settings"); setS(r.data); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const test = async () => {
    setBusy(true);
    try { await save(); await api.post("/notify/test"); toast.success("测试消息已发送到 Telegram"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  if (!s) return null;
  const cls = "h-8 bg-slate-900/60 border-slate-700 font-mono text-xs";
  return (
    <div className="space-y-3 p-2" data-testid="telegram-settings">
      <label className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-sky-400" />启用 Telegram 推送</span><input type="checkbox" checked={s.telegram_enabled} onChange={(e) => setS({ ...s, telegram_enabled: e.target.checked })} data-testid="tg-enabled" className="accent-cyan-500" /></label>
      <div className="space-y-1"><Label className="text-[11px]">Bot Token {s.telegram_bot_token_masked && <span className="text-slate-500">（已保存 {s.telegram_bot_token_masked}，留空不修改）</span>}</Label><Input value={s.telegram_bot_token || ""} onChange={(e) => setS({ ...s, telegram_bot_token: e.target.value })} data-testid="tg-token-input" className={cls} placeholder="123456:ABC-DEF..." /></div>
      <div className="space-y-1"><Label className="text-[11px]">Chat ID（群/频道，如 -1001234567890）</Label><Input value={s.telegram_chat_id} onChange={(e) => setS({ ...s, telegram_chat_id: e.target.value })} data-testid="tg-chat-input" className={cls} /></div>
      <div className="grid grid-cols-3 gap-1 text-[11px]">
        {[["notify_alerts", "地址预警"], ["notify_big_payment", "大额到账"], ["notify_sweep", "归集提醒"]].map(([k, l]) => (
          <label key={k} className="flex items-center gap-1 text-slate-300"><input type="checkbox" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} data-testid={`tg-${k}`} className="accent-cyan-500" />{l}</label>
        ))}
      </div>
      <div className="space-y-1"><Label className="text-[11px]">导出完成提醒阈值（行数 ≥ 此值才推送）</Label><Input type="number" min={1} value={s.export_notify_threshold ?? 500} onChange={(e) => setS({ ...s, export_notify_threshold: Number(e.target.value) })} data-testid="tg-export-threshold-input" className={cls} /></div>
      <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>返回</Button><Button size="sm" variant="outline" onClick={test} disabled={busy} data-testid="tg-test-btn" className="border-slate-700">发送测试</Button><Button size="sm" onClick={save} data-testid="tg-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">保存</Button></div>
    </div>
  );
}

function AlertSettings({ onClose }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/alerts/settings").then((r) => setS(r.data)); }, []);
  const save = async () => {
    try { await api.put("/alerts/settings", { pct: Number(s.pct), min_abs: Number(s.min_abs), sync_minutes: Number(s.sync_minutes), sweep_threshold: Number(s.sweep_threshold), big_payment: Number(s.big_payment) }); toast.success("预警阈值已保存"); onClose(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  if (!s) return null;
  return (
    <div className="space-y-3 p-1" data-testid="alert-settings">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label className="text-[11px]">变化 ≥ %</Label><Input type="number" value={s.pct} onChange={(e) => setS({ ...s, pct: e.target.value })} data-testid="alert-pct-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">且 ≥ USDT</Label><Input type="number" value={s.min_abs} onChange={(e) => setS({ ...s, min_abs: e.target.value })} data-testid="alert-minabs-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">同步失败 ≥ 分钟</Label><Input type="number" value={s.sync_minutes} onChange={(e) => setS({ ...s, sync_minutes: e.target.value })} data-testid="alert-sync-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">归集提醒 余额 ≥ USDT</Label><Input type="number" value={s.sweep_threshold} onChange={(e) => setS({ ...s, sweep_threshold: e.target.value })} data-testid="alert-sweep-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">大额支付推送 ≥ USDT</Label><Input type="number" value={s.big_payment} onChange={(e) => setS({ ...s, big_payment: e.target.value })} data-testid="alert-bigpay-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
      </div>
      <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>取消</Button><Button size="sm" onClick={save} data-testid="alert-settings-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">保存</Button></div>
    </div>
  );
}

export function AlertBell() {
  const [data, setData] = useState({ unread: 0, alerts: [] });
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tg, setTg] = useState(false);
  const seen = useRef(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const { data: d } = await api.get("/alerts", { params: { limit: 30 } });
        if (!alive) return;
        setData(d);
        const latest = d.alerts[0]?.id;
        if (seen.current !== null && latest && latest !== seen.current) {
          const fresh = d.alerts.filter((a) => !a.read).slice(0, 3);
          if (fresh.length) {
            playChime();
            fresh.forEach((a) => toast.warning(a.message, { description: `${a.network} · ${a.address}`, duration: 10000 }));
          }
        }
        seen.current = latest || "";
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const readAll = async () => { await api.post("/alerts/read-all"); setData((d) => ({ unread: 0, alerts: d.alerts.map((a) => ({ ...a, read: true })) })); };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSettings(false); setTg(false); } }}>
      <PopoverTrigger asChild>
        <button data-testid="alert-bell-btn" className="relative p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors" title="地址预警">
          <Bell className="w-4 h-4" />
          {data.unread > 0 && <span data-testid="alert-unread-badge" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{data.unread > 99 ? "99+" : data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 glass border-slate-700" data-testid="alert-popover">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <span className="text-sm font-semibold">地址预警 <span className="text-xs text-slate-500 font-normal">未读 {data.unread}</span></span>
          <div className="flex items-center gap-1">
            <button onClick={() => { setTg(!tg); setSettings(false); }} data-testid="alert-telegram-btn" className="p-1.5 rounded text-slate-400 hover:text-sky-400" title="Telegram 推送"><Send className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setSettings(!settings); setTg(false); }} data-testid="alert-settings-btn" className="p-1.5 rounded text-slate-400 hover:text-cyan-400" title="阈值设置"><Settings2 className="w-3.5 h-3.5" /></button>
            {data.unread > 0 && <button onClick={readAll} data-testid="alert-read-all-btn" className="p-1.5 rounded text-slate-400 hover:text-emerald-400" title="全部已读"><Check className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        {tg ? <TelegramSettings onClose={() => setTg(false)} /> : settings ? <AlertSettings onClose={() => setSettings(false)} /> : (
          <div className="max-h-[380px] overflow-y-auto">
            {data.alerts.length === 0 ? <div className="py-8 text-center text-xs text-slate-500">暂无预警，地址运行正常</div> : data.alerts.map((a) => {
              const k = KIND[a.type] || KIND.sync_failed;
              return (
                <div key={a.id} className={`px-3 py-2.5 border-b border-slate-800/60 ${a.read ? "opacity-60" : ""}`} data-testid={`alert-item-${a.id}`}>
                  <div className="flex items-start gap-2">
                    <k.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${k.cls}`} />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-100 leading-snug">{a.message}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{a.network} · {a.address} · {fmtDate(a.created_at)}</div>
                    </div>
                    {!a.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
