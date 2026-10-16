import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Switch } from "@/components/ui/switch";
import { Card, Btn, Input, Head, ImgField as Img } from "@/pages/admin/ui";
import { loadSiteConfig } from "@/lib/siteConfig";
import { tr } from "@/i18n";

const TABS = [
  ["logo", tr("網站 Logo")], ["top_promo", tr("頂部推廣條")], ["hero", tr("首頁主橫幅")], ["announcement", tr("首頁公告")],
  ["promo_banners", tr("首頁活動橫幅")], ["detail_banners", tr("商品頁 Banner")], ["features", tr("服務特色")], ["register", tr("註冊引導")], ["whatsapp", tr("客服 WhatsApp")],
];
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
const lbl = "block text-xs font-semibold text-slate-500 mb-1";

const Field = ({ label, hint, children }) => <div><label className={lbl}>{label}</label>{children}{hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}</div>;
const Txt = ({ value, onChange, ...p }) => <Input className="w-full" value={value || ""} onChange={(e) => onChange(e.target.value)} {...p} />;
const Toggle = ({ label, value, onChange, testId }) => <label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={value !== false} onCheckedChange={onChange} data-testid={testId} /> {label}</label>;

function BannerList({ items, onChange, withAction, max, ratio }) {
  const set = (i, k, v) => onChange(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-3">
      {items.map((b, i) => (
        <Card key={i} className="p-4 grid md:grid-cols-2 gap-3 relative">
          <Img value={b.image} onChange={(v) => set(i, "image", v)} testId={`banner-img-${i}`} ratio={ratio} />
          <div className="space-y-2">
            <Field label={tr("跳轉連結")}><Txt value={b.link} onChange={(v) => set(i, "link", v)} placeholder="/article 或 https://..." /></Field>
            <Field label={tr("替代文字（無障礙/SEO）")}><Txt value={b.alt} onChange={(v) => set(i, "alt", v)} /></Field>
            {withAction && <Field label={tr("特殊動作")}><select className="h-9 w-full rounded-lg bg-slate-100 px-3 text-sm" value={b.action || ""} onChange={(e) => set(i, "action", e.target.value)}><option value="">{tr("無（使用連結）")}</option><option value="a2hs">{tr("開啟「添加到桌面」教學")}</option></select></Field>}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-xs text-red-500 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />{tr("移除此張")}</button>
          </div>
        </Card>
      ))}
      {(!max || items.length < max) && <Btn kind="ghost" onClick={() => onChange([...items, { image: "", link: "", alt: "", ...(withAction ? { action: "" } : {}) }])}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增一張")}</Btn>}
    </div>
  );
}

export function SiteConfigAdmin({ callApi, go, only, title, sub }) {
  const tabs = only ? TABS.filter(([k]) => only.includes(k)) : TABS;
  const [tab, setTab] = useState(tabs[0][0]);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/site-config" }).then((r) => setCfg(r.data)).catch(() => toast.error(tr("載入失敗"))); }, [callApi]);

  const setSec = (sec, patch) => setCfg((c) => ({ ...c, [sec]: typeof patch === "function" ? patch(c[sec]) : { ...c[sec], ...patch } }));
  const save = async () => {
    setSaving(true);
    try { const r = await callApi({ method: "PUT", url: "/admin/site-config", data: { [tab]: cfg[tab] } }); setCfg(r.data); await loadSiteConfig(true).catch(() => {}); toast.success(tr("已儲存，前台已更新")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setSaving(false);
  };
  const reset = async () => {
    if (!window.confirm(tr("確定恢復此區塊為系統預設？"))) return;
    const r = await callApi({ method: "POST", url: "/admin/site-config/reset", data: { section: tab } }); setCfg(r.data); await loadSiteConfig(true).catch(() => {}); toast.success(tr("已恢復預設"));
  };

  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const s = cfg[tab];
  const S = (k) => (v) => setSec(tab, { [k]: v });

  return (
    <div data-testid="siteconfig-admin">
      <Head title={title || tr("網站配置")} sub={sub || tr("前台所有橫幅、文案、Logo 皆可在此修改，儲存後即時生效。")}
        right={only && go && <Btn kind="ghost" data-testid="banners-goto-home" onClick={() => go("home-decoration")}>{tr("首頁輪播大圖 → 首頁裝修")}</Btn>} />
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map(([k, label]) => <button key={k} data-testid={`siteconfig-tab-${k}`} onClick={() => setTab(k)} className={`shrink-0 h-9 px-4 rounded-lg text-xs font-semibold ${tab === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300"}`}>{label}</button>)}
      </div>

      {tab === "whatsapp" ? <WhatsAppSettings callApi={callApi} /> : (
        <>
          <Card className="p-5 space-y-4 max-w-4xl">
            {tab === "logo" && <Field label={tr("網站 Logo（頁首、頁尾、首頁服務區）")} hint={tr("建議透明底 PNG，高度 ≥ 80px")}><div className="max-w-sm"><Img value={s.image} onChange={S("image")} testId="cfg-logo-img" /></div></Field>}

            {tab === "top_promo" && <>
              <Toggle label={tr("顯示頂部推廣條")} value={s.enabled} onChange={S("enabled")} testId="cfg-top-enabled" />
              <Img value={s.image} onChange={S("image")} testId="cfg-top-img" hint={tr("橫向長圖，高度約 40~48px 顯示")} ratio="aspect-[8/1]" />
              <div className="grid md:grid-cols-2 gap-3">
                <Field label={tr("點擊跳轉連結")}><Txt value={s.link} onChange={S("link")} data-testid="cfg-top-link" /></Field>
                <Field label={tr("替代文字")}><Txt value={s.alt} onChange={S("alt")} /></Field>
              </div>
            </>}

            {tab === "hero" && <>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label={tr("小標題")}><Txt value={s.kicker} onChange={S("kicker")} data-testid="cfg-hero-kicker" /></Field>
                <Field label={tr("主標題")}><Txt value={s.title} onChange={S("title")} data-testid="cfg-hero-title" /></Field>
                <Field label={tr("副標題")}><Txt value={s.subtitle} onChange={S("subtitle")} data-testid="cfg-hero-subtitle" /></Field>
                <Field label={tr("高亮文字（如 7%）")}><Txt value={s.highlight} onChange={S("highlight")} data-testid="cfg-hero-highlight" /></Field>
              </div>
              <Field label={tr("右側圖片")}><div className="max-w-md"><Img value={s.image} onChange={S("image")} testId="cfg-hero-img" ratio="aspect-[2/1]" /></div></Field>
              <Field label={tr("分類膠囊按鈕")}>
                <div className="space-y-2">
                  {(s.pills || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="w-40" placeholder={tr("名稱")} value={p.label} onChange={(e) => setSec(tab, { pills: s.pills.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                      <Input className="flex-1" placeholder="/category/games" value={p.link} onChange={(e) => setSec(tab, { pills: s.pills.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)) })} />
                      <button onClick={() => setSec(tab, { pills: s.pills.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <Btn kind="ghost" onClick={() => setSec(tab, { pills: [...(s.pills || []), { label: "", link: "" }] })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增膠囊")}</Btn>
                </div>
              </Field>
            </>}

            {tab === "announcement" && <>
              <Toggle label={tr("顯示公告列")} value={s.enabled} onChange={S("enabled")} testId="cfg-ann-enabled" />
              <Field label={tr("公告文字（電腦版）")}><Txt value={s.text} onChange={S("text")} data-testid="cfg-ann-text" /></Field>
              <Field label={tr("公告文字（手機版，較短）")}><Txt value={s.text_mobile} onChange={S("text_mobile")} data-testid="cfg-ann-text-mobile" /></Field>
              <Field label={tr("點擊跳轉連結")}><Txt value={s.link} onChange={S("link")} /></Field>
            </>}

            {tab === "promo_banners" && <Field label={tr("首頁兩欄活動橫幅（建議 2 張，比例一致）")}><BannerList items={s} onChange={(v) => setCfg((c) => ({ ...c, promo_banners: v }))} max={4} ratio="aspect-[2.4/1]" /></Field>}

            {tab === "detail_banners" && <>
              <Field label={tr("手機版輪播（710×120）")}><BannerList items={s.mobile || []} onChange={(v) => setSec(tab, { mobile: v })} withAction ratio="aspect-[710/120]" /></Field>
              <Field label={tr("電腦版輪播（1330×80）")}><BannerList items={s.pc || []} onChange={(v) => setSec(tab, { pc: v })} withAction ratio="aspect-[1330/80]" /></Field>
            </>}

            {tab === "features" && <>
              <Field label={tr("Logo 下方標語")}><Txt value={s.tagline} onChange={S("tagline")} data-testid="cfg-feat-tagline" /></Field>
              <Field label={tr("手機版服務特色圖")}><div className="max-w-md"><Img value={s.mobile_image} onChange={S("mobile_image")} testId="cfg-feat-mobile-img" ratio="aspect-[2/1]" /></div></Field>
              <Field label={tr("服務特色（電腦版 5 項）")}>
                <div className="space-y-2">
                  {(s.items || []).map((it, i) => (
                    <div key={i} className="grid grid-cols-[180px_1fr_auto] gap-2 items-center">
                      <Input placeholder={tr("標題")} value={it.title} data-testid={`cfg-feat-title-${i}`} onChange={(e) => setSec(tab, { items: s.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                      <Input placeholder={tr("描述")} value={it.desc} onChange={(e) => setSec(tab, { items: s.items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) })} />
                      <button onClick={() => setSec(tab, { items: s.items.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {(s.items || []).length < 5 && <Btn kind="ghost" onClick={() => setSec(tab, { items: [...(s.items || []), { title: "", desc: "" }] })}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增一項")}</Btn>}
                </div>
              </Field>
            </>}

            {tab === "register" && <>
              <Toggle label={tr("顯示註冊引導（底部列與 CTA 區塊）")} value={s.enabled} onChange={S("enabled")} testId="cfg-reg-enabled" />
              <div className="grid md:grid-cols-3 gap-3">
                <Field label={tr("手機底部列文字")}><Txt value={s.bar_text} onChange={S("bar_text")} data-testid="cfg-reg-bar-text" /></Field>
                <Field label={tr("高亮百分比")}><Txt value={s.percent} onChange={S("percent")} data-testid="cfg-reg-percent" /></Field>
                <Field label={tr("後綴文字")}><Txt value={s.bar_suffix} onChange={S("bar_suffix")} /></Field>
                <Field label={tr("按鈕文字")}><Txt value={s.button} onChange={S("button")} /></Field>
                <Field label={tr("電腦版標題")}><Txt value={s.title} onChange={S("title")} data-testid="cfg-reg-title" /></Field>
                <Field label={tr("電腦版副標題")}><Txt value={s.subtitle} onChange={S("subtitle")} /></Field>
              </div>
              <Field label={tr("手機版註冊 CTA 圖")}><div className="max-w-md"><Img value={s.mobile_image} onChange={S("mobile_image")} testId="cfg-reg-mobile-img" ratio="aspect-[2/1]" /></div></Field>
            </>}
          </Card>
          <div className="flex items-center gap-2 mt-4">
            <Btn data-testid="siteconfig-save" onClick={save} disabled={saving}><Save className="h-4 w-4 inline -mt-0.5 mr-1" />{saving ? tr("儲存中…") : tr("儲存此區塊")}</Btn>
            <Btn kind="ghost" data-testid="siteconfig-reset" onClick={reset}><RotateCcw className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("恢復預設")}</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function WhatsAppSettings({ callApi }) {
  const [form, setForm] = useState({ whatsapp_number: "", whatsapp_link: "", cs_label: "", cs_qr_image: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/settings" }).then((r) => setForm(r.data)).catch(() => {}); }, [callApi]);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (body.whatsapp_number && !body.whatsapp_link?.includes("wa.me/" + body.whatsapp_number.replace(/\D/g, ""))) body.whatsapp_link = "https://wa.me/" + body.whatsapp_number.replace(/\D/g, "");
      const r = await callApi({ method: "PUT", url: "/admin/settings", data: body });
      setForm(r.data); toast.success(tr("已儲存，頁尾二維碼已更新"));
    } catch { toast.error(tr("儲存失敗")); }
    setSaving(false);
  };
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-6 max-w-4xl">
      <div className="space-y-4">
        <Field label={tr("WhatsApp 號碼（含國碼，選填）")}><Txt data-testid="settings-whatsapp-number" value={form.whatsapp_number} onChange={(v) => setForm({ ...form, whatsapp_number: v })} placeholder="+85261234567" /></Field>
        <Field label={tr("WhatsApp 連結（二維碼內容）")}><Txt data-testid="settings-whatsapp-link" value={form.whatsapp_link} onChange={(v) => setForm({ ...form, whatsapp_link: v })} placeholder={tr("https://wa.me/85261234567 或群組邀請連結")} /></Field>
        <Field label={tr("二維碼下方文字")}><Txt data-testid="settings-cs-label" value={form.cs_label} onChange={(v) => setForm({ ...form, cs_label: v })} /></Field>
        <Field label={tr("自訂二維碼圖片（選填）")} hint={tr("上傳後頁尾直接顯示此圖（如微信 / WhatsApp 群二維碼）；留空則依上方連結自動生成。建議正方形 PNG。")}>
          <div className="max-w-[200px]"><Img value={form.cs_qr_image} onChange={(v) => setForm({ ...form, cs_qr_image: v })} testId="settings-qr-img" ratio="aspect-square" /></div>
        </Field>
        <Btn data-testid="settings-save" onClick={save} disabled={saving}>{saving ? tr("儲存中…") : tr("儲存")}</Btn>
      </div>
      <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-6">
        <div className="bg-white rounded-xl p-2 shadow-sm">{form.cs_qr_image ? <img src={form.cs_qr_image} alt="" className="h-40 w-40 object-contain" /> : <QRCodeSVG value={form.whatsapp_link || "https://wa.me/"} size={160} fgColor="#E8792A" />}</div>
        <div className="text-xs text-slate-500 mt-3">{form.cs_label}</div>
        <div className="text-[11px] text-slate-400 mt-1 break-all text-center">{form.whatsapp_link}</div>
      </div>
    </Card>
  );
}
