import { useEffect, useRef, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { playChime } from "@/components/PaymentAlerts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, AlertTriangle, WifiOff, Settings2, Check } from "lucide-react";

const KIND = {
  balance_change: { label: "余额突变", Icon: AlertTriangle, cls: "text-amber-400" },
  sync_failed: { label: "同步失败", Icon: WifiOff, cls: "text-red-400" },
};

function AlertSettings({ onClose }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/alerts/settings").then((r) => setS(r.data)); }, []);
  const save = async () => {
    try { await api.put("/alerts/settings", { pct: Number(s.pct), min_abs: Number(s.min_abs), sync_minutes: Number(s.sync_minutes) }); toast.success("预警阈值已保存"); onClose(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  if (!s) return null;
  return (
    <div className="space-y-3 p-1" data-testid="alert-settings">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label className="text-[11px]">变化 ≥ %</Label><Input type="number" value={s.pct} onChange={(e) => setS({ ...s, pct: e.target.value })} data-testid="alert-pct-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">且 ≥ USDT</Label><Input type="number" value={s.min_abs} onChange={(e) => setS({ ...s, min_abs: e.target.value })} data-testid="alert-minabs-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
        <div className="space-y-1"><Label className="text-[11px]">同步失败 ≥ 分钟</Label><Input type="number" value={s.sync_minutes} onChange={(e) => setS({ ...s, sync_minutes: e.target.value })} data-testid="alert-sync-input" className="h-8 bg-slate-900/60 border-slate-700 font-mono text-xs" /></div>
      </div>
      <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>取消</Button><Button size="sm" onClick={save} data-testid="alert-settings-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">保存</Button></div>
    </div>
  );
}

export function AlertBell() {
  const [data, setData] = useState({ unread: 0, alerts: [] });
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSettings(false); }}>
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
            <button onClick={() => setSettings(!settings)} data-testid="alert-settings-btn" className="p-1.5 rounded text-slate-400 hover:text-cyan-400" title="阈值设置"><Settings2 className="w-3.5 h-3.5" /></button>
            {data.unread > 0 && <button onClick={readAll} data-testid="alert-read-all-btn" className="p-1.5 rounded text-slate-400 hover:text-emerald-400" title="全部已读"><Check className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        {settings ? <AlertSettings onClose={() => setSettings(false)} /> : (
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
