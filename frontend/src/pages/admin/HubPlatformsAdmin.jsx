import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Plug, Copy, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Card, Btn, Input, Head, Field } from "@/pages/admin/ui";
import { tr } from "@/i18n";

const SPEC = ["GET /hub/stats?days=30", "GET /hub/orders?since=&status=&page=&size=", "GET /hub/topups?since=&status=&page=&size=", "GET /hub/members?q=&page=&size="];

export function HubPlatformsAdmin({ callApi }) {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/hub/platforms" }).then((r) => { setData(r.data); setRows(r.data.platforms); }).catch(() => toast.error(tr("載入失敗"))), [callApi]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;
  const set = (i, patch) => setRows(rows.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const save = async () => { setBusy("save"); try { const r = await callApi({ method: "PUT", url: "/admin/hub/platforms", data: rows }); setData(r.data); setRows(r.data.platforms); toast.success(tr("已儲存")); } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); } setBusy(""); };
  const test = async (p) => { setBusy(p.id); try { const r = await callApi({ method: "POST", url: `/admin/hub/platforms/${p.id}/test` }); r.data.ok ? toast.success(tr("連線成功：{0}，近 7 天訂單 {1} 筆", r.data.platform?.name || p.name, r.data.stats?.orders ?? 0)) : toast.error(tr("連線失敗：{0}", r.data.error)); } catch (e) { toast.error(e.response?.data?.detail || tr("測試失敗")); } setBusy(""); };
  const base = window.location.origin + "/api";
  return (
    <div data-testid="hub-platforms-admin">
      <Head title={tr("平台接入")} sub={tr("把其他商城（如 Giftray）的訂單、充值、會員與統計接進本後台。對方需按下方規範提供接口並用 X-Hub-Key 鑒權。")}
        right={<Btn data-testid="hub-save" onClick={save} disabled={busy === "save"}><Save className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("儲存")}</Btn>} />
      <Card className="p-4 mb-4" data-testid="hub-inbound-card">
        <div className="font-semibold text-slate-800 mb-1">{tr("本站對外 Hub 接口（供其他後台拉取 gogo589 數據）")}</div>
        <div className="text-xs text-slate-500 mb-2">{tr("接口地址前綴")}：<code className="bg-slate-100 px-1.5 py-0.5 rounded">{base}/hub/…</code></div>
        <div className="flex items-center gap-2 text-xs"><span className="text-slate-500">X-Hub-Key：</span><code data-testid="hub-inbound-key" className="bg-slate-100 px-2 py-1 rounded font-mono">{data.inbound_key}</code>
          <button data-testid="hub-inbound-copy" onClick={() => { navigator.clipboard?.writeText(data.inbound_key); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-slate-400 hover:text-orange-500">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div>
        <div className="mt-3 text-xs text-slate-500">{tr("對接規範（對方平台需實作同樣 4 個接口，返回 JSON：{ platform:{id,name}, total, page, size, rows:[…] } / stats 返回 revenue_usd, orders, topup_usd, topups, new_members, members, pending_orders, pending_topups, open_chats）")}</div>
        <ul className="mt-1.5 grid sm:grid-cols-2 gap-1 text-[11px] font-mono text-slate-600">{SPEC.map((s) => <li key={s} className="bg-slate-50 rounded px-2 py-1">{s}</li>)}</ul>
      </Card>
      <div className="space-y-3">
        {rows.map((p, i) => (
          <Card key={i} className="p-4" data-testid={`hub-platform-${i}`}>
            <div className="grid md:grid-cols-[120px_1fr_1fr_auto_auto] gap-3 items-end">
              <Field label={tr("平台代號")}><Input data-testid={`hub-platform-id-${i}`} className="w-full font-mono" value={p.id} onChange={(e) => set(i, { id: e.target.value })} placeholder="giftray" /></Field>
              <Field label={tr("平台名稱")}><Input data-testid={`hub-platform-name-${i}`} className="w-full" value={p.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Giftray 商城" /></Field>
              <Field label={tr("接口地址前綴（含 /api）")}><Input data-testid={`hub-platform-url-${i}`} className="w-full font-mono text-xs" value={p.base_url} onChange={(e) => set(i, { base_url: e.target.value })} placeholder={p.kind === "sifang" ? "https://四方域名/api/admin-api" : "https://lpw-888.com/api"} /></Field>
              <Field label={tr("平台類型")}><select data-testid={`hub-platform-kind-${i}`} value={p.kind || "shop"} onChange={(e) => set(i, { kind: e.target.value })} className="h-9 rounded-lg bg-slate-100 px-2 text-sm outline-none"><option value="shop">{tr("商城（Hub 規範接口）")}</option><option value="giftray">{tr("Giftray 商城（直接對接後台 API）")}</option><option value="sifang">{tr("四方 USDT 收款平台（直接對接 Admin API）")}</option><option value="topup">{tr("充值平台（Hub 規範接口）")}</option></select></Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 h-9"><Switch data-testid={`hub-platform-enabled-${i}`} checked={p.enabled !== false} onCheckedChange={(v) => set(i, { enabled: v })} />{tr("啟用")}</label>
            </div>
            <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end mt-3">
              <Field label={p.kind === "giftray" ? tr("Giftray 後台管理 API 金鑰（ak_…）") : p.kind === "sifang" ? tr("四方平台 X-Api-Key（ak_…）") : tr("X-Hub-Key（對方提供）")}><Input data-testid={`hub-platform-key-${i}`} className="w-full font-mono text-xs" value={p.api_key} onChange={(e) => set(i, { api_key: e.target.value })} /></Field>
              <Field label={tr("客服後台地址（客服菜單入口）")}><Input data-testid={`hub-platform-cs-${i}`} className="w-full text-xs" value={p.cs_url} onChange={(e) => set(i, { cs_url: e.target.value })} placeholder="https://www.giftray.com/admin/chat" /></Field>
              <Field label={tr("後台地址（選填）")}><Input className="w-full text-xs" value={p.admin_url} onChange={(e) => set(i, { admin_url: e.target.value })} /></Field>
              <div className="flex gap-2"><Btn kind="ghost" data-testid={`hub-platform-test-${i}`} onClick={() => test(p)} disabled={!!busy}><Plug className="h-4 w-4 inline -mt-0.5 mr-1" />{busy === p.id ? tr("測試中…") : tr("測試連線")}</Btn>
                <button data-testid={`hub-platform-del-${i}`} onClick={() => window.confirm(tr("移除此平台？")) && setRows(rows.filter((_, j) => j !== i))} className="h-9 w-9 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          </Card>
        ))}
        <button data-testid="hub-platform-add" onClick={() => setRows([...rows, { id: "", name: "", base_url: "", api_key: "", cs_url: "", admin_url: "", kind: "shop", enabled: true }])} className="w-full rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500 h-14 flex items-center justify-center gap-1 text-sm"><Plus className="h-4 w-4" />{tr("新增平台")}</button>
      </div>
    </div>
  );
}
