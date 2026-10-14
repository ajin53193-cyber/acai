import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Field, Table, Pill, fmt } from "./ui";

const TYPES = { none: tr("謝謝惠顧"), balance: tr("錢包餘額 USD"), points: tr("積分"), coupon: tr("優惠券碼"), physical: tr("實物獎品") };
const COLORS = ["#fb923c", "#fed7aa", "#f97316", "#fbbf24", "#fb7185", "#f43f5e", "#a78bfa", "#34d399"];

export function InviteLotteryAdmin({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const [draws, setDraws] = useState([]);
  const [saving, setSaving] = useState(false);
  const load = () => {
    callApi({ method: "GET", url: "/admin/lottery" }).then((r) => setCfg(r.data)).catch(() => toast.error(tr("載入失敗")));
    callApi({ method: "GET", url: "/admin/lottery/draws?limit=100" }).then((r) => setDraws(r.data.rows || r.data || [])).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const setP = (i, k, v) => set("prizes", cfg.prizes.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  const save = async () => {
    setSaving(true);
    try { const r = await callApi({ method: "PUT", url: "/admin/lottery", data: { ...cfg, cost_points: 0, free_daily: false, invite_only: true, prizes: cfg.prizes.map((p) => ({ ...p, weight: Number(p.weight) || 0, stock: Number(p.stock ?? -1) })) } }); setCfg(r.data); toast.success(tr("已儲存")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
    setSaving(false);
  };
  const totalW = cfg.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  return (
    <div data-testid="invite-lottery-admin">
      <Head title={tr("邀請抽獎活動")} sub={tr("邀請好友註冊獲得抽獎次數，消耗次數抽獎；顯示於前台「活動中心」(/activities)")} right={<Btn data-testid="il-save" onClick={save} disabled={saving}>{saving ? tr("儲存中…") : tr("儲存")}</Btn>} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">{tr("啟用活動")}</span><Switch data-testid="il-enabled" checked={!!cfg.enabled} onCheckedChange={(v) => set("enabled", v)} /></div>
          <Field label={tr("每成功邀請 1 人獲得抽獎次數")}><Input data-testid="il-invite-draws" type="number" min="1" className="w-full" value={cfg.invite_draws ?? 1} onChange={(e) => set("invite_draws", e.target.value)} /></Field>
          <Field label={tr("活動標題")}><Input data-testid="il-title" className="w-full" value={cfg.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label={tr("副標題")}><Input data-testid="il-subtitle" className="w-full" value={cfg.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} /></Field>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <Field label={tr("活動規則（前台顯示）")}><textarea data-testid="il-rules" rows={7} className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" value={cfg.rules || ""} onChange={(e) => set("rules", e.target.value)} /></Field>
        </Card>
      </div>
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold text-slate-700">{tr("獎品設定")}<span className="text-xs text-slate-400 ml-2">{tr("機率 = 權重 / 總權重 {0}", totalW)}</span></div><Btn kind="ghost" data-testid="il-add-prize" onClick={() => set("prizes", [...cfg.prizes, { id: "", label: "", type: "none", value: 0, weight: 10, stock: -1, color: COLORS[cfg.prizes.length % COLORS.length] }])}><Plus className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("新增獎品")}</Btn></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 bg-slate-50/70 border-b border-slate-200"><th className="px-3 py-2">{tr("名稱")}</th><th className="px-3 py-2 w-40">{tr("類型")}</th><th className="px-3 py-2 w-28">{tr("數值")}</th><th className="px-3 py-2 w-24">{tr("權重")}</th><th className="px-3 py-2 w-24">{tr("庫存(-1不限)")}</th><th className="px-3 py-2 w-24">{tr("顏色")}</th><th className="px-3 py-2 w-12"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {cfg.prizes.map((p, i) => (
              <tr key={i} data-testid={`il-prize-${i}`}>
                <td className="px-3 py-1.5"><Input className="w-full" value={p.label} onChange={(e) => setP(i, "label", e.target.value)} placeholder={tr("如 USD$2 餘額")} /></td>
                <td className="px-3 py-1.5"><select className="h-9 w-full rounded-lg bg-slate-100 px-2 text-sm" value={p.type} onChange={(e) => setP(i, "type", e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="px-3 py-1.5"><Input className="w-full" value={p.value ?? ""} onChange={(e) => setP(i, "value", e.target.value)} disabled={p.type === "none" || p.type === "physical"} /></td>
                <td className="px-3 py-1.5"><Input type="number" min="0" className="w-full" value={p.weight} onChange={(e) => setP(i, "weight", e.target.value)} /></td>
                <td className="px-3 py-1.5"><Input type="number" className="w-full" value={p.stock ?? -1} onChange={(e) => setP(i, "stock", e.target.value)} /></td>
                <td className="px-3 py-1.5"><input type="color" value={p.color || "#fb923c"} onChange={(e) => setP(i, "color", e.target.value)} className="h-9 w-14 rounded border border-slate-200" /></td>
                <td className="px-3 py-1.5"><button data-testid={`il-prize-del-${i}`} onClick={() => set("prizes", cfg.prizes.filter((_, idx) => idx !== i))} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      <Card className="overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-slate-700 border-b border-slate-100">{tr("最近抽獎紀錄")}</div>
        <Table testId="il-draws" cols={[tr("時間"), tr("帳戶"), tr("獎品"), tr("來源")]} rows={draws} empty={tr("暫無紀錄")} render={(d, i) => (
          <tr key={d.id || i} className="hover:bg-slate-50"><td className="px-4 py-2.5 text-xs text-slate-500">{fmt(d.created_at)}</td><td className="px-4 py-2.5 font-mono text-xs">{d.account || d.account_no || d.user_id}</td><td className="px-4 py-2.5"><Pill tone={d.prize_type === "none" ? "slate" : "orange"}>{d.prize_label}</Pill></td><td className="px-4 py-2.5 text-xs text-slate-500">{d.free_kind === "bonus" ? tr("邀請次數") : d.free_kind === "daily" ? tr("每日免費") : tr("積分")}</td></tr>
        )} />
      </Card>
    </div>
  );
}
