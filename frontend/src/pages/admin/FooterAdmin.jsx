import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, RotateCcw, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RichEditor } from "@/components/admin/RichEditor";
import { Card, Btn, Input, Head, Field, fmt } from "@/pages/admin/ui";
import { tr } from "@/i18n";

const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };

function LinkColumns({ callApi, pages }) {
  const [cols, setCols] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/footer" }).then((r) => setCols(r.data.cols)).catch(() => toast.error(tr("載入失敗"))); }, [callApi]);
  if (!cols) return null;
  const setCol = (ci, patch) => setCols(cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setLink = (ci, li, patch) => setCol(ci, { links: cols[ci].links.map((l, i) => (i === li ? { ...l, ...patch } : l)) });
  const save = async () => { setSaving(true); try { const r = await callApi({ method: "PUT", url: "/admin/footer", data: { cols } }); setCols(r.data.cols); toast.success(tr("已儲存，頁尾已更新")); } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); } setSaving(false); };
  const reset = async () => { if (!window.confirm(tr("恢復為系統預設的三欄連結？"))) return; const r = await callApi({ method: "POST", url: "/admin/footer/reset" }); setCols(r.data.cols); toast.success(tr("已恢復預設")); };
  return (
    <Card className="p-4 mb-4" data-testid="footer-links-card">
      <div className="flex items-center gap-2 mb-3"><div className="font-semibold text-slate-800">{tr("頁尾連結欄")}</div><span className="text-xs text-slate-400">{tr("最多 4 欄；連結可填站內路徑（如 /article/faq）或完整網址")}</span>
        <div className="ml-auto flex gap-2"><Btn kind="ghost" data-testid="footer-links-reset" onClick={reset}><RotateCcw className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("恢復預設")}</Btn><Btn data-testid="footer-links-save" onClick={save} disabled={saving}><Save className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("儲存")}</Btn></div></div>
      <datalist id="footer-page-list">{pages.map((p) => <option key={p.id} value={`/article/${p.id}`}>{p.title}</option>)}<option value="/orders">{tr("我的訂單")}</option><option value="/account/verify">{tr("我的認證")}</option><option value="/account/coupons">{tr("我的優惠券")}</option><option value="/article">{tr("新聞資訊")}</option></datalist>
      <div className="grid lg:grid-cols-3 gap-3">
        {cols.map((c, ci) => (
          <div key={ci} className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid={`footer-col-${ci}`}>
            <div className="flex items-center gap-1"><Input data-testid={`footer-col-title-${ci}`} className="flex-1 font-semibold" value={c.title} onChange={(e) => setCol(ci, { title: e.target.value })} placeholder={tr("欄位標題")} />
              <button onClick={() => setCols(move(cols, ci, -1))} className="text-slate-400 hover:text-orange-500"><ArrowUp className="h-4 w-4" /></button><button onClick={() => setCols(move(cols, ci, 1))} className="text-slate-400 hover:text-orange-500"><ArrowDown className="h-4 w-4" /></button>
              <button data-testid={`footer-col-del-${ci}`} onClick={() => window.confirm(tr("刪除整欄？")) && setCols(cols.filter((_, i) => i !== ci))} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div>
            {c.links.map((l, li) => (
              <div key={li} className="rounded-lg bg-slate-50 p-2 space-y-1.5" data-testid={`footer-link-${ci}-${li}`}>
                <div className="flex items-center gap-1.5"><Input data-testid={`footer-link-label-${ci}-${li}`} className="flex-1 h-8" value={l.label} onChange={(e) => setLink(ci, li, { label: e.target.value })} placeholder={tr("顯示文字")} />
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap"><input type="checkbox" checked={!!l.hot} onChange={(e) => setLink(ci, li, { hot: e.target.checked })} className="accent-orange-500" />HOT</label></div>
                <div className="flex items-center gap-1.5"><Input list="footer-page-list" data-testid={`footer-link-to-${ci}-${li}`} className="flex-1 h-8 font-mono text-xs" value={l.to} onChange={(e) => setLink(ci, li, { to: e.target.value })} placeholder="/article/faq" />
                  <button onClick={() => setCol(ci, { links: move(c.links, li, -1) })} className="text-slate-400 hover:text-orange-500"><ArrowUp className="h-3.5 w-3.5" /></button><button onClick={() => setCol(ci, { links: move(c.links, li, 1) })} className="text-slate-400 hover:text-orange-500"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button data-testid={`footer-link-del-${ci}-${li}`} onClick={() => setCol(ci, { links: c.links.filter((_, i) => i !== li) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>
            ))}
            <button data-testid={`footer-link-add-${ci}`} onClick={() => setCol(ci, { links: [...c.links, { label: "", to: "", hot: false }] })} className="text-xs text-orange-600 flex items-center gap-1"><Plus className="h-3.5 w-3.5" />{tr("新增連結")}</button>
          </div>
        ))}
        {cols.length < 4 && <button data-testid="footer-col-add" onClick={() => setCols([...cols, { title: "", links: [] }])} className="rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500 min-h-[120px] flex items-center justify-center gap-1 text-sm"><Plus className="h-4 w-4" />{tr("新增一欄")}</button>}
      </div>
    </Card>
  );
}

function PageEditor({ callApi, page, onClose, onSaved }) {
  const [f, setF] = useState({ id: page?.id || "", title: page?.title || "", content_html: "", active: page ? page.active !== false : true });
  const [loading, setLoading] = useState(!!page);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (page) callApi({ method: "GET", url: `/admin/articles/${page.id}` }).then((r) => { setF((p) => ({ ...p, content_html: r.data.content_html || "" })); setLoading(false); }).catch(() => toast.error(tr("載入失敗"))); }, [callApi, page]);
  const upload = useCallback(async (img) => { try { return (await callApi({ method: "POST", url: "/admin/articles/upload", data: img })).data.url; } catch (e) { toast.error(e.response?.data?.detail || tr("圖片上傳失敗")); return null; } }, [callApi]);
  const save = async () => {
    if (!f.title.trim()) return toast.error(tr("請輸入標題"));
    setBusy(true);
    try { await callApi(page ? { method: "PUT", url: `/admin/articles/pages/${page.id}`, data: f } : { method: "POST", url: "/admin/articles/pages", data: f }); toast.success(tr("已儲存")); onSaved(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-white rounded-3xl max-h-[92vh] overflow-y-auto" data-testid="footer-page-editor">
        <DialogHeader><DialogTitle className="font-head">{page ? tr("編輯頁面") : tr("新增頁面")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid md:grid-cols-[1fr_200px_auto] gap-3 items-end">
            <Field label={tr("頁面標題")}><Input data-testid="footer-page-title" className="w-full" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label={tr("網址代號（/article/…）")}><Input data-testid="footer-page-slug" className="w-full font-mono" value={f.id} disabled={!!page} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="about-us" /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 h-9"><Switch data-testid="footer-page-active" checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />{tr("前台顯示")}</label>
          </div>
          {loading ? <div className="text-sm text-slate-400 py-10 text-center">{tr("載入中…")}</div> : <RichEditor testId="footer-page-content" value={f.content_html} onChange={(v) => setF({ ...f, content_html: v })} onUpload={upload} placeholder={tr("輸入頁面內容，可插入圖片…")} />}
        </div>
        <DialogFooter className="gap-2"><Btn kind="ghost" onClick={onClose}>{tr("取消")}</Btn><Btn data-testid="footer-page-save" onClick={save} disabled={busy || loading}>{busy ? tr("儲存中…") : tr("儲存")}</Btn></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TEXT_FIELDS = [["cs_title", "客服標題（二維碼右側第一行）"], ["cs_btn", "在線客服按鈕文字"], ["cs_sub", "客服副標題（第二行）"], ["copyright", "版權聲明"], ["company", "公司名稱 / 說明（留空則隱藏）"], ["address", "地址（留空則隱藏）"], ["trustpilot_url", "Trustpilot 連結（選填，填了可點擊）"]];

function FooterTexts({ callApi }) {
  const [t, setT] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/footer" }).then((r) => setT(r.data.texts)).catch(() => {}); }, [callApi]);
  if (!t) return null;
  const save = async () => { setSaving(true); try { const r = await callApi({ method: "PUT", url: "/admin/footer", data: { texts: t } }); setT(r.data.texts); toast.success(tr("已儲存，頁尾已更新")); } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); } setSaving(false); };
  return (
    <Card className="p-4 mb-4" data-testid="footer-texts-card">
      <div className="flex items-center gap-2 mb-3"><div className="font-semibold text-slate-800">{tr("頁尾文案")}</div><span className="text-xs text-slate-400">{tr("客服區文字、Trustpilot、版權與公司資訊")}</span>
        <Btn className="ml-auto" data-testid="footer-texts-save" onClick={save} disabled={saving}><Save className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("儲存")}</Btn></div>
      <div className="grid md:grid-cols-2 gap-3">
        {TEXT_FIELDS.map(([k, label]) => <Field key={k} label={tr(label)}><Input data-testid={`footer-text-${k}`} className="w-full" value={t[k] || ""} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></Field>)}
        <label className="flex items-center gap-2 text-sm text-slate-700 h-9 self-end"><Switch data-testid="footer-text-show_trustpilot" checked={!!t.show_trustpilot} onCheckedChange={(v) => setT({ ...t, show_trustpilot: v })} />{tr("顯示 Trustpilot 五星評分")}</label>
      </div>
    </Card>
  );
}

export function FooterAdmin({ callApi }) {
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/articles/pages" }).then((r) => setPages(r.data.rows)).catch(() => toast.error(tr("載入失敗"))), [callApi]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (p, v) => { try { await callApi({ method: "PUT", url: `/admin/articles/pages/${p.id}`, data: { title: p.title, active: v } }); load(); } catch { toast.error(tr("操作失敗")); } };
  const del = async (p) => { if (!window.confirm(tr("刪除頁面「{0}」？頁尾若有連結到此頁將變成 404。", p.title))) return; try { await callApi({ method: "DELETE", url: `/admin/articles/${p.id}` }); toast.success(tr("已刪除")); load(); } catch { toast.error(tr("刪除失敗")); } };
  return (
    <div data-testid="footer-admin">
      <Head title={tr("頁尾管理")} sub={tr("編輯頁尾三欄連結，以及公司介紹 / 隱私權政策 / 常見問題等固定頁面的標題與正文。二維碼與支付 Logo 請到「系統配置 → 基礎設置」。")}
        right={<Btn data-testid="footer-page-add" onClick={() => setEditing(null)}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增頁面")}</Btn>} />
      <FooterTexts callApi={callApi} />
      <LinkColumns callApi={callApi} pages={pages} />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="footer-pages-table">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50/70">{[tr("頁面"), tr("網址"), tr("瀏覽"), tr("更新時間"), tr("前台顯示"), tr("操作")].map((c) => <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {pages.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{tr("暫無頁面")}</td></tr>}
            {pages.map((p) => (
              <tr key={p.id} data-testid={`footer-page-row-${p.id}`} className="hover:bg-orange-50/40">
                <td className="px-4 py-3 font-semibold text-slate-800">{p.title}</td>
                <td className="px-4 py-3"><a href={`/article/${p.id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-slate-500 hover:text-orange-600 inline-flex items-center gap-1">/article/{p.id}<ExternalLink className="h-3 w-3" /></a></td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.view_count || 0}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(p.updated_at || p.published_at)}</td>
                <td className="px-4 py-3"><Switch data-testid={`footer-page-active-${p.id}`} checked={p.active !== false} onCheckedChange={(v) => toggle(p, v)} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><button data-testid={`footer-page-edit-${p.id}`} onClick={() => setEditing(p)} className="text-slate-500 hover:text-orange-600 mr-3"><Pencil className="h-4 w-4" /></button><button data-testid={`footer-page-del-${p.id}`} onClick={() => del(p)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing !== undefined && <PageEditor callApi={callApi} page={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </div>
  );
}
