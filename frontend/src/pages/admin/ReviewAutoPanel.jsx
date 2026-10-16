import { useCallback, useEffect, useState } from "react";
import { Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Btn, Input, Card, Field } from "@/pages/admin/ui";
import { tr } from "@/i18n";

export function ReviewAutoPanel({ callApi, products }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/reviews/auto" }).then((r) => setCfg(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { load(); }, [load]);
  if (!cfg) return null;
  const s = cfg.stats || {};
  const save = async (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      const r = await callApi({ method: "PUT", url: "/admin/reviews/auto", data: { enabled: !!next.enabled, daily_min: +next.daily_min, daily_max: +next.daily_max, product_id: next.product_id, seed_total: +next.seed_total, seed_from: next.seed_from, auto_after_days: +next.auto_after_days, other_enabled: !!next.other_enabled, other_pct: +next.other_pct, other_min: +next.other_min, other_max: +next.other_max, other_text_pct: +next.other_text_pct } });
      setCfg(r.data); toast.success(tr("已儲存"));
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };
  const seed = async (force) => {
    if (!window.confirm(force ? tr("將刪除已生成的歷史好評並重新生成 {0} 筆，確定？", cfg.seed_total) : tr("將從 {0} 至昨日隨機生成 {1} 筆歷史好評，確定？", cfg.seed_from, cfg.seed_total))) return;
    setBusy(true);
    try { const r = await callApi({ method: "POST", url: `/admin/reviews/auto/seed${force ? "?force=true" : ""}` }); toast.success(tr("已生成 {0} 筆歷史好評", r.data.added)); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("生成失敗")); }
    setBusy(false);
  };
  const runNow = async () => { setBusy(true); try { await callApi({ method: "POST", url: "/admin/reviews/auto/run-now" }); toast.success(tr("已執行")); load(); } catch { toast.error(tr("執行失敗")); } setBusy(false); };
  const num = (k, extra = {}) => <Input type="number" className="w-20" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} data-testid={`review-auto-${k}`} {...extra} />;

  return (
    <Card className="p-4 mb-4" data-testid="review-auto-panel">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-orange-500" />{tr("自動好評")}</div>
        <Switch data-testid="review-auto-enabled" checked={!!cfg.enabled} onCheckedChange={(v) => save({ enabled: v })} />
        <span className="text-xs text-slate-500">{cfg.enabled ? tr("每日自動新增中") : tr("已暫停每日自動新增")}</span>
        <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span data-testid="review-auto-stat-seeded">{tr("歷史好評")} <b className="text-slate-800">{s.seeded}</b> / {cfg.seed_total}</span>
          <span data-testid="review-auto-stat-today">{tr("今日")} <b className="text-slate-800">{s.today_done}</b> / {s.today_planned}</span>
          <span data-testid="review-auto-stat-daily">{tr("每日累計")} <b className="text-slate-800">{s.daily_total}</b></span>
          <span data-testid="review-auto-stat-order">{tr("訂單自動好評")} <b className="text-slate-800">{s.order_auto}</b> · {tr("用戶評價")} <b className="text-slate-800">{s.user_reviews}</b></span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Field label={tr("目標商品（每日自動好評 / 歷史補齊）")}>
          <select data-testid="review-auto-product" className="h-9 w-full rounded-lg bg-slate-100 px-3 text-sm outline-none" value={cfg.product_id} onChange={(e) => save({ product_id: e.target.value })}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={tr("每日新增區間（筆，香港時間 08:00–23:30 內隨機分佈，調整次日生效）")}>
          <div className="flex items-center gap-2 text-sm">{num("daily_min", { min: 0 })} ~ {num("daily_max", { min: 0 })}<Btn kind="ghost" data-testid="review-auto-save-range" onClick={() => save({})}>{tr("儲存")}</Btn></div>
        </Field>
        <Field label={tr("訂單完成後 N 天未評價自動 5 星好評（所有商品）")}>
          <div className="flex items-center gap-2 text-sm">{num("auto_after_days", { min: 0 })} {tr("天")}<Btn kind="ghost" data-testid="review-auto-save-days" onClick={() => save({})}>{tr("儲存")}</Btn></div>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-orange-50/70 px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-600">{tr("歷史好評補齊：")}</span>
        <Input type="date" className="w-40" value={cfg.seed_from} onChange={(e) => setCfg({ ...cfg, seed_from: e.target.value })} data-testid="review-auto-seed-from" />
        <span className="text-xs text-slate-400">{tr("至昨日，共")}</span>
        <Input type="number" className="w-24" value={cfg.seed_total} onChange={(e) => setCfg({ ...cfg, seed_total: e.target.value })} data-testid="review-auto-seed-total" />
        <span className="text-xs text-slate-400">{tr("筆")}</span>
        <Btn kind="ghost" data-testid="review-auto-save-seed" onClick={() => save({})}>{tr("儲存")}</Btn>
        <Btn data-testid="review-auto-seed" disabled={busy || s.seeded >= cfg.seed_total} onClick={() => seed(false)}><Sparkles className="h-4 w-4 inline -mt-0.5 mr-1" />{s.seeded >= cfg.seed_total ? tr("已補齊") : tr("一鍵補齊歷史好評")}</Btn>
        {s.seeded > 0 && <button data-testid="review-auto-reseed" disabled={busy} onClick={() => seed(true)} className="text-xs text-slate-500 underline">{tr("重新生成")}</button>}
        <Btn kind="ghost" data-testid="review-auto-run-now" disabled={busy} onClick={runNow} className="ml-auto"><Play className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("立即執行一次")}</Btn>
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 px-3 py-2.5" data-testid="review-auto-other">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-slate-700">{tr("其它商品每日自動好評")}</span>
          <Switch data-testid="review-auto-other_enabled" checked={!!cfg.other_enabled} onCheckedChange={(v) => save({ other_enabled: v })} />
          <span className="text-xs text-slate-500">{cfg.other_enabled ? tr("啟用中") : tr("已暫停")}</span>
          <span className="ml-auto text-xs text-slate-500" data-testid="review-auto-stat-other">{tr("今日")} <b className="text-slate-800">{s.other_done}</b> / {s.other_planned} · {tr("累計")} <b className="text-slate-800">{s.other_total}</b> · {tr("商品數")} {s.other_products}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-xs text-slate-500">{tr("每天隨機抽")}</span>{num("other_pct", { min: 0, max: 100 })}<span className="text-xs text-slate-500">{tr("% 的商品，每個商品")}</span>
          {num("other_min", { min: 0 })} ~ {num("other_max", { min: 0 })}<span className="text-xs text-slate-500">{tr("條；帶文字比例")}</span>{num("other_text_pct", { min: 0, max: 100 })}<span className="text-xs text-slate-500">%（{tr("調整次日生效")}）</span>
          <Btn kind="ghost" data-testid="review-auto-save-other" onClick={() => save({})}>{tr("儲存")}</Btn>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 mt-2">{tr("地區：香港 / 澳門 / 台灣 / 中國 / 馬來西亞 / 新加坡；帳號約六成脫敏郵箱、四成脫敏手機號；約 25% 附一句好評文字。")}</div>
    </Card>
  );
}
