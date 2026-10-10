import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Loader2 } from "lucide-react";

export function CheckoutSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tutorials, setTutorials] = useState("");

  useEffect(() => {
    if (!open) return;
    api.get("/checkout/settings").then((r) => { setS(r.data); setTutorials((r.data.tutorial_links || []).map((t) => `${t.title}|${t.url}`).join("\n")); });
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const tutorial_links = tutorials.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [title, url = ""] = l.split("|"); return { title: title.trim(), url: url.trim() }; });
      await api.put("/checkout/settings", { ...s, tutorial_links });
      toast.success("收银台设置已保存"); setOpen(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="checkout-settings-btn" className="border-slate-700"><Settings2 className="w-4 h-4 mr-1" /> 收银台设置</Button>
      </DialogTrigger>
      <DialogContent className="glass border-slate-700 max-w-lg" data-testid="checkout-settings-dialog">
        <DialogHeader><DialogTitle>收银台设置</DialogTitle></DialogHeader>
        {!s ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-700 p-3">
              <div><div className="text-sm font-medium">能量租赁板块</div><div className="text-xs text-slate-500">在 TRC20 待付页展示 TRX 能量租赁地址</div></div>
              <Switch checked={s.energy_enabled} onCheckedChange={(v) => setS({ ...s, energy_enabled: v })} data-testid="energy-enabled-switch" />
            </div>
            <div className="space-y-1.5"><Label>TRX 收款地址（只收 TRX）</Label><Input value={s.energy_trx_address} onChange={(e) => setS({ ...s, energy_trx_address: e.target.value })} data-testid="energy-trx-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" placeholder="T 开头 34 位" /></div>
            <div className="space-y-1.5"><Label>租赁价格文案</Label><Input value={s.energy_price_text} onChange={(e) => setS({ ...s, energy_price_text: e.target.value })} data-testid="energy-price-input" className="bg-slate-900/60 border-slate-700" /></div>
            <div className="space-y-1.5"><Label>客服链接（可选）</Label><Input value={s.support_url} onChange={(e) => setS({ ...s, support_url: e.target.value })} data-testid="support-url-input" className="bg-slate-900/60 border-slate-700 font-mono text-xs" placeholder="https://t.me/..." /></div>
            <div className="space-y-1.5"><Label>常见教程（每行：标题|链接，留空用默认文案）</Label>
              <textarea value={tutorials} onChange={(e) => setTutorials(e.target.value)} rows={4} data-testid="tutorials-input" className="w-full rounded-md bg-slate-900/60 border border-slate-700 text-xs p-2 text-slate-200 focus:outline-none focus:border-cyan-500" placeholder={"什么是USDT|https://...\n如何购买|https://..."} /></div>
          </div>
        )}
        <DialogFooter><Button onClick={save} disabled={saving || !s} data-testid="checkout-settings-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
