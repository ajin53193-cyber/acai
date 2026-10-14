import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Search, Settings2, ListOrdered, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Table, fmt, useLoad, Pill } from "./ui";

const SOURCE_TONE = { order: "sky", topup: "emerald", admin: "violet" };
const SOURCE_LABEL = { order: tr("消費"), topup: tr("充值"), admin: tr("管理員") };

function Rules({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/points/config" }).then((r) => setCfg(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);
  const save = async () => { try { await callApi({ method: "PUT", url: "/admin/points/config", data: cfg }); toast.success(tr("規則已儲存")); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); } };
  if (!cfg) return <Card className="p-6 text-sm text-slate-400">{tr("載入中…")}</Card>;
  const Row = ({ label, hint, children }) => <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-50 last:border-0"><div><div className="text-sm font-medium text-slate-800">{label}</div>{hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}</div>{children}</div>;
  return (
    <Card className="p-5 max-w-2xl" data-testid="points-rules">
      <Row label={tr("啟用積分系統")} hint={tr("關閉後不再發放任何積分")}><Switch data-testid="points-earn-enabled" checked={cfg.earn_enabled} onCheckedChange={(v) => setCfg({ ...cfg, earn_enabled: v })} /></Row>
      <Row label={tr("每消費 USD$ 1 獲得積分")}><Input data-testid="points-per-usd" type="number" className="w-28" value={cfg.earn_per_usd} onChange={(e) => setCfg({ ...cfg, earn_per_usd: +e.target.value })} /></Row>
      <Row label={tr("下單支付贈送積分")} hint={tr("訂單付款成功後按訂單金額發放")}><Switch data-testid="points-order-enabled" checked={cfg.order_enabled} onCheckedChange={(v) => setCfg({ ...cfg, order_enabled: v })} /></Row>
      <Row label={tr("錢包充值贈送積分")} hint={tr("充值到賬後按充值金額發放")}><Switch data-testid="points-topup-enabled" checked={cfg.topup_enabled} onCheckedChange={(v) => setCfg({ ...cfg, topup_enabled: v })} /></Row>
      <Row label={tr("允許積分抵現")} hint={tr("（前台結算抵扣，後續開放）")}><Switch data-testid="points-redeem-enabled" checked={cfg.redeem_enabled} onCheckedChange={(v) => setCfg({ ...cfg, redeem_enabled: v })} /></Row>
      <Row label={tr("多少積分抵 USD$ 1")}><Input type="number" className="w-28" value={cfg.points_per_usd_redeem} onChange={(e) => setCfg({ ...cfg, points_per_usd_redeem: +e.target.value })} /></Row>
      <Row label={tr("最低可用積分門檻")}><Input type="number" className="w-28" value={cfg.min_redeem} onChange={(e) => setCfg({ ...cfg, min_redeem: +e.target.value })} /></Row>
      <div className="pt-4"><Btn data-testid="points-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存規則")}</Btn></div>
    </Card>
  );
}

function Ledger({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [rows] = useLoad(callApi, `/admin/points/ledger?q=${encodeURIComponent(qq)}`); // eslint-disable-line
  return (
    <div>
      <Card className="p-3 mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" /><input data-testid="ledger-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("用戶 / 來源 / 說明")} className="w-full h-9 rounded-lg bg-slate-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></div>
        <Btn data-testid="ledger-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
      </Card>
      <Table testId="ledger-table" cols={[tr("時間"), tr("用戶"), tr("來源"), tr("變動"), tr("餘額"), tr("說明")]} empty={rows === null ? tr("載入中…") : tr("暫無積分記錄")} rows={rows || []} render={(r) => (
        <tr key={r.id} data-testid={`ledger-row-${r.id}`} className="hover:bg-amber-50/30">
          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
          <td className="px-4 py-3"><div className="text-slate-800 truncate max-w-[160px]">{r.user_label}</div><div className="text-[10px] text-slate-400 font-mono">{r.account_no}</div></td>
          <td className="px-4 py-3"><Pill tone={SOURCE_TONE[r.source] || "slate"}>{SOURCE_LABEL[r.source] || r.source}</Pill></td>
          <td className={`px-4 py-3 font-head font-bold ${r.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>{r.delta >= 0 ? "+" : ""}{r.delta}</td>
          <td className="px-4 py-3 text-slate-700">{r.balance_after}</td>
          <td className="px-4 py-3 text-slate-500">{r.reason}</td>
        </tr>
      )} />
    </div>
  );
}

export function PointsAdmin({ callApi }) {
  const [tab, setTab] = useState("rules");
  return (
    <div data-testid="points-admin">
      <Head title={tr("積分管理")} sub={tr("配置積分獲取規則，查看積分明細。積分已與下單、充值打通")} right={
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button data-testid="points-tab-rules" onClick={() => setTab("rules")} className={`h-8 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === "rules" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><Settings2 className="h-3.5 w-3.5" />{tr("規則配置")}</button>
          <button data-testid="points-tab-ledger" onClick={() => setTab("ledger")} className={`h-8 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === "ledger" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><ListOrdered className="h-3.5 w-3.5" />{tr("積分明細")}</button>
        </div>} />
      {tab === "rules" ? <Rules callApi={callApi} /> : <Ledger callApi={callApi} />}
    </div>
  );
}
