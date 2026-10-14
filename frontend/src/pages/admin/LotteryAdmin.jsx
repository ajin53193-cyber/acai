import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Gift, Save, Check } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Card, Table, Pill, fmt } from "./ui";

const selCls = "h-9 rounded-lg bg-slate-100 px-2 text-sm outline-none focus:ring-2 focus:ring-orange-300";
const TYPES = { points: tr("積分"), balance: tr("錢包餘額 USD"), coupon: tr("優惠券（填券碼）"), physical: tr("實物（人工發放）"), none: tr("謝謝惠顧（空獎）") };
const COLORS = ["#fb923c", "#fed7aa", "#f97316", "#fbbf24", "#fb7185", "#f43f5e", "#34d399", "#60a5fa"];
const newPrize = () => ({ id: "", label: "", type: "points", value: 0, weight: 10, stock: -1, color: COLORS[Math.floor(Math.random() * COLORS.length)] });

export function LotteryAdmin({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const [draws, setDraws] = useState([]);
  const load = () => callApi({ method: "GET", url: "/admin/lottery" }).then((r) => setCfg(r.data)).catch(() => toast.error(tr("載入失敗")));
  const loadDraws = () => callApi({ method: "GET", url: "/admin/lottery/draws" }).then((r) => setDraws(r.data)).catch(() => {});
  useEffect(() => { load(); loadDraws(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;

  const setPrize = (i, k, v) => setCfg({ ...cfg, prizes: cfg.prizes.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)) });
  const totalW = cfg.prizes.reduce((a, p) => a + (+p.weight || 0), 0) || 1;

  const save = async () => {
    if (!cfg.prizes.length) return toast.error(tr("請至少新增一個獎品"));
    if (cfg.prizes.some((p) => !p.label.trim())) return toast.error(tr("獎品名稱不可為空"));
    const body = { enabled: cfg.enabled, cost_points: +cfg.cost_points || 0, prizes: cfg.prizes.map((p) => ({ ...p, weight: +p.weight || 0, stock: p.stock === "" ? -1 : +p.stock, value: p.type === "coupon" ? String(p.value) : (+p.value || 0) })) };
    try { const r = await callApi({ method: "PUT", url: "/admin/lottery", data: body }); setCfg(r.data); toast.success(tr("已儲存")); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const fulfill = async (d) => { await callApi({ method: "POST", url: `/admin/lottery/draws/${d.id}/fulfill` }); loadDraws(); };

  return (
    <div data-testid="lottery-admin">
      <Head title={tr("抽獎活動")} sub={tr("積分大轉盤，配置獎品與中獎概率（權重）；前台首頁與我的帳戶均有入口")} right={<Btn data-testid="lottery-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存設定")}</Btn>} />

      <Card className="p-4 mb-5 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid="lottery-enabled" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("開啟抽獎活動")}</label>
        <label className="flex items-center gap-2 text-sm text-slate-700">{tr("每次抽獎消耗積分")}<Input data-testid="lottery-cost" type="number" className="w-24" value={cfg.cost_points} onChange={(e) => setCfg({ ...cfg, cost_points: e.target.value })} /></label>
      </Card>

      <Card className="overflow-x-auto mb-6">
        <table className="w-full text-sm" data-testid="lottery-prizes-table">
          <thead><tr className="text-left text-xs text-slate-500 bg-slate-50/70 border-b border-slate-200"><th className="px-3 py-2">{tr("獎品名稱")}</th><th className="px-3 py-2 w-40">{tr("類型")}</th><th className="px-3 py-2 w-28">{tr("面額/數值")}</th><th className="px-3 py-2 w-28">{tr("權重")}</th><th className="px-3 py-2 w-24">{tr("概率")}</th><th className="px-3 py-2 w-28">{tr("庫存(-1不限)")}</th><th className="px-3 py-2 w-20">{tr("顏色")}</th><th className="px-3 py-2 w-12"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {cfg.prizes.map((p, i) => (
              <tr key={i} data-testid={`lottery-prize-${i}`}>
                <td className="px-3 py-1.5"><Input data-testid={`lottery-prize-label-${i}`} className="w-full" value={p.label} onChange={(e) => setPrize(i, "label", e.target.value)} placeholder={tr("如 50 積分")} /></td>
                <td className="px-3 py-1.5"><select data-testid={`lottery-prize-type-${i}`} className={selCls + " w-full"} value={p.type} onChange={(e) => setPrize(i, "type", e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="px-3 py-1.5">{p.type === "none" || p.type === "physical" ? <span className="text-slate-300 text-xs">-</span> : <Input type={p.type === "coupon" ? "text" : "number"} step="0.01" className="w-full" value={p.value} onChange={(e) => setPrize(i, "value", e.target.value)} placeholder={p.type === "coupon" ? tr("券碼") : ""} />}</td>
                <td className="px-3 py-1.5"><Input data-testid={`lottery-prize-weight-${i}`} type="number" className="w-full" value={p.weight} onChange={(e) => setPrize(i, "weight", e.target.value)} /></td>
                <td className="px-3 py-1.5 text-xs text-slate-500">{(((+p.weight || 0) / totalW) * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5"><Input type="number" className="w-full" value={p.stock} onChange={(e) => setPrize(i, "stock", e.target.value)} /></td>
                <td className="px-3 py-1.5"><input type="color" value={p.color} onChange={(e) => setPrize(i, "color", e.target.value)} className="h-8 w-10 rounded cursor-pointer border border-slate-200" /></td>
                <td className="px-3 py-1.5"><button data-testid={`lottery-prize-del-${i}`} onClick={() => setCfg({ ...cfg, prizes: cfg.prizes.filter((_, idx) => idx !== i) })} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Btn kind="ghost" className="mb-8" data-testid="lottery-add-prize" onClick={() => setCfg({ ...cfg, prizes: [...cfg.prizes, newPrize()] })}><Plus className="h-4 w-4" />{tr("新增獎品")}</Btn>

      <h2 className="font-head font-bold text-slate-900 mb-3 flex items-center gap-2"><Gift className="h-4 w-4 text-orange-500" />{tr("中獎記錄")}</h2>
      <Table testId="lottery-draws-table" cols={[tr("時間"), tr("帳戶ID"), tr("用戶"), tr("獎品"), tr("類型"), tr("狀態")]} empty={tr("暫無記錄")} rows={draws} render={(d) => (
        <tr key={d.id} data-testid={`lottery-draw-${d.id}`} className="hover:bg-orange-50/30">
          <td className="px-4 py-2 text-xs text-slate-500">{fmt(d.created_at)}</td>
          <td className="px-4 py-2 text-xs font-mono text-slate-600">{d.account_no}</td>
          <td className="px-4 py-2 text-xs text-slate-600 truncate max-w-[160px]">{d.user_label}</td>
          <td className="px-4 py-2 text-sm font-semibold text-slate-800">{d.prize_label}</td>
          <td className="px-4 py-2"><Pill tone={d.prize_type === "physical" ? "rose" : "orange"}>{TYPES[d.prize_type] || d.prize_type}</Pill></td>
          <td className="px-4 py-2">{d.prize_type === "physical" ? (d.fulfilled ? <Pill tone="emerald">{tr("已發放")}</Pill> : <Btn kind="ok" data-testid={`lottery-fulfill-${d.id}`} onClick={() => fulfill(d)}><Check className="h-3.5 w-3.5" />{tr("標記發放")}</Btn>) : <Pill tone="emerald">{tr("已到帳")}</Pill>}</td>
        </tr>
      )} />
    </div>
  );
}
