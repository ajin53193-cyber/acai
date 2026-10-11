import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { TUTORIAL_CONTENT, I18N } from "@/lib/checkoutI18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings2, Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

const inputCls = "bg-slate-900/60 border-slate-700";
const taCls = "w-full rounded-md bg-slate-900/60 border border-slate-700 text-xs p-2 text-slate-200 focus:outline-none focus:border-cyan-500";

function defaultTutorials() {
  return I18N["zh-CN"].defaultTutorials.map((title, i) => ({ title, url: "", content: TUTORIAL_CONTENT[i] }));
}

function TutorialEditor({ items, onChange }) {
  const [idx, setIdx] = useState(0);
  const cur = items[idx];
  const upd = (patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const move = (d) => { const j = idx + d; if (j < 0 || j >= items.length) return; const a = [...items]; [a[idx], a[j]] = [a[j], a[idx]]; onChange(a); setIdx(j); };
  const remove = () => { const a = items.filter((_, i) => i !== idx); onChange(a); setIdx(Math.max(0, idx - 1)); };
  const add = () => { onChange([...items, { title: "新教程", url: "", content: "" }]); setIdx(items.length); };
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3" data-testid="tutorial-editor">
      <div className="space-y-1">
        {items.map((it, i) => (
          <button key={i} onClick={() => setIdx(i)} data-testid={`tutorial-item-${i}`} className={`w-full text-left text-xs px-2 py-1.5 rounded truncate ${i === idx ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-800"}`}>{i + 1}、{it.title || "(未命名)"}</button>
        ))}
        <button onClick={add} data-testid="tutorial-add-btn" className="w-full text-xs px-2 py-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-1"><Plus className="w-3 h-3" />新增</button>
        {items.length === 0 && <button onClick={() => onChange(defaultTutorials())} className="w-full text-xs px-2 py-1.5 rounded text-slate-400 hover:bg-slate-800">载入默认 5 篇</button>}
      </div>
      {cur ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={cur.title} onChange={(e) => upd({ title: e.target.value })} placeholder="标题" data-testid="tutorial-title-input" className={inputCls} />
            <button onClick={() => move(-1)} className="p-2 text-slate-400 hover:text-slate-100"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => move(1)} className="p-2 text-slate-400 hover:text-slate-100"><ChevronDown className="w-4 h-4" /></button>
            <button onClick={remove} data-testid="tutorial-remove-btn" className="p-2 text-red-400 hover:bg-red-400/10 rounded"><Trash2 className="w-4 h-4" /></button>
          </div>
          <Input value={cur.url} onChange={(e) => upd({ url: e.target.value })} placeholder="外部链接（可选，填写后点击直接跳转，不显示正文）" data-testid="tutorial-url-input" className={`${inputCls} font-mono text-xs`} />
          <textarea value={cur.content} onChange={(e) => upd({ content: e.target.value })} rows={9} placeholder="教程正文，支持换行，网址自动变为链接" data-testid="tutorial-content-input" className={taCls} />
        </div>
      ) : <div className="text-xs text-slate-500 flex items-center">暂无教程，点击「载入默认」或「新增」</div>}
    </div>
  );
}

export function CheckoutSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/checkout/settings").then((r) => {
      const d = r.data;
      setS({ ...d, tutorial_links: d.tutorial_links?.length ? d.tutorial_links.map((t, i) => ({ title: t.title || "", url: t.url || "", content: t.content ?? TUTORIAL_CONTENT[i] ?? "" })) : defaultTutorials(), energy_rules: (d.energy_rules || []).map((t) => ({ title: t.title || "", text: t.text || "" })) });
    });
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const energy_rules = (s.energy_rules || []).filter((r) => (r.title || r.text || "").trim());
      await api.put("/checkout/settings", { ...s, energy_rules, tutorial_links: s.tutorial_links.filter((t) => t.title.trim()) });
      toast.success("收银台设置已保存"); setOpen(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="checkout-settings-btn" className="border-slate-700"><Settings2 className="w-4 h-4 mr-1" /> 收银台设置</Button>
      </DialogTrigger>
      <DialogContent className="glass border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="checkout-settings-dialog">
        <DialogHeader><DialogTitle>收银台设置</DialogTitle></DialogHeader>
        {!s ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div> : (
          <Tabs defaultValue="brand" className="py-1">
            <TabsList className="bg-slate-900/60 border border-slate-800">
              <TabsTrigger value="brand" data-testid="tab-brand">品牌</TabsTrigger>
              <TabsTrigger value="energy" data-testid="tab-energy">能量租赁</TabsTrigger>
              <TabsTrigger value="tutorials" data-testid="tab-tutorials">常见教程</TabsTrigger>
            </TabsList>
            <TabsContent value="brand" className="space-y-4 pt-3">
              <p className="text-xs text-slate-500">收银台顶部显示「收款商户名称」+ 副标题；Logo 不填则显示商户名称首字头像。</p>
              <div className="space-y-1.5"><Label>Logo 图片 URL（可选，建议正方形 PNG/SVG）</Label><Input value={s.logo_url} onChange={(e) => setS({ ...s, logo_url: e.target.value })} data-testid="logo-url-input" className={`${inputCls} font-mono text-xs`} placeholder="https://.../logo.png" />
                {s.logo_url && <img src={s.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain bg-white mt-2" />}</div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>副标题（简体）</Label><Input value={s.brand_subtitle} onChange={(e) => setS({ ...s, brand_subtitle: e.target.value })} data-testid="subtitle-input" className={inputCls} /></div>
                <div className="space-y-1.5"><Label>副标题（繁體）</Label><Input value={s.brand_subtitle_tw} onChange={(e) => setS({ ...s, brand_subtitle_tw: e.target.value })} className={inputCls} /></div>
                <div className="space-y-1.5"><Label>副标题（English）</Label><Input value={s.brand_subtitle_en} onChange={(e) => setS({ ...s, brand_subtitle_en: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="space-y-1.5"><Label>收银台主题色（链接、Logo 头像、二维码标识）</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={s.theme_color || "#26A17B"} onChange={(e) => setS({ ...s, theme_color: e.target.value })} data-testid="theme-color-picker" className="w-10 h-10 rounded cursor-pointer bg-transparent border border-slate-700" />
                  <Input value={s.theme_color || ""} onChange={(e) => setS({ ...s, theme_color: e.target.value })} data-testid="theme-color-input" className={`${inputCls} font-mono text-xs w-32`} placeholder="#26A17B" />
                  <div className="flex gap-1.5">{["#26A17B", "#2563EB", "#7C3AED", "#DC2626", "#EA580C", "#0F766E", "#111827"].map((c) => <button key={c} onClick={() => setS({ ...s, theme_color: c })} className="w-6 h-6 rounded-full border border-white/20" style={{ background: c }} title={c} />)}</div>
                </div></div>
              <div className="space-y-1.5"><Label>客服链接（可选）</Label><Input value={s.support_url} onChange={(e) => setS({ ...s, support_url: e.target.value })} data-testid="support-url-input" className={`${inputCls} font-mono text-xs`} placeholder="https://t.me/..." /></div>
            </TabsContent>
            <TabsContent value="energy" className="space-y-4 pt-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-700 p-3">
                <div><div className="text-sm font-medium">能量租赁板块</div><div className="text-xs text-slate-500">在 TRC20 待付页展示（默认折叠，点击展开）</div></div>
                <Switch checked={s.energy_enabled} onCheckedChange={(v) => setS({ ...s, energy_enabled: v })} data-testid="energy-enabled-switch" />
              </div>
              <div className="space-y-1.5"><Label>TRX 收款地址（只收 TRX）</Label><Input value={s.energy_trx_address} onChange={(e) => setS({ ...s, energy_trx_address: e.target.value })} data-testid="energy-trx-input" className={`${inputCls} font-mono text-xs`} placeholder="T 开头 34 位" /></div>
              <div className="space-y-1.5"><Label>租赁价格文案</Label><Input value={s.energy_price_text} onChange={(e) => setS({ ...s, energy_price_text: e.target.value })} data-testid="energy-price-input" className={inputCls} /></div>
              <div className="space-y-1.5"><Label>快捷购买金额（TRX，逗号分隔）</Label><Input value={s.energy_amounts ?? "2,4"} onChange={(e) => setS({ ...s, energy_amounts: e.target.value })} data-testid="energy-amounts-input" className={inputCls} placeholder="例如 2,4" /></div>
              <div className="space-y-1.5"><Label>租赁说明条款（标题 + 内容，留空则用内置 4 条默认文案，自动跟随语言）</Label>
                <div className="space-y-2" data-testid="energy-rules-editor">
                  {(s.energy_rules || []).map((r, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input value={r.title} onChange={(e) => { const a = [...s.energy_rules]; a[i] = { ...a[i], title: e.target.value }; setS({ ...s, energy_rules: a }); }} data-testid={`energy-rule-title-${i}`} className={`${inputCls} w-36`} placeholder="标题" />
                      <Input value={r.text} onChange={(e) => { const a = [...s.energy_rules]; a[i] = { ...a[i], text: e.target.value }; setS({ ...s, energy_rules: a }); }} data-testid={`energy-rule-text-${i}`} className={`${inputCls} flex-1`} placeholder="内容" />
                      <button onClick={() => setS({ ...s, energy_rules: s.energy_rules.filter((_, j) => j !== i) })} data-testid={`energy-rule-del-${i}`} className="p-2 text-red-400 hover:bg-red-400/10 rounded shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setS({ ...s, energy_rules: [...(s.energy_rules || []), { title: "", text: "" }] })} data-testid="energy-rule-add" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 添加条款</button>
                </div></div>
            </TabsContent>
            <TabsContent value="tutorials" className="pt-3">
              <TutorialEditor items={s.tutorial_links} onChange={(tutorial_links) => setS({ ...s, tutorial_links })} />
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter><Button onClick={save} disabled={saving || !s} data-testid="checkout-settings-save-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
