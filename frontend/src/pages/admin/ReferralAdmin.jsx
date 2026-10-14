import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Gift, Trophy, Image as ImageIcon, Save, CheckCircle2, Clock, Target, Repeat, Play, BarChart3, TrendingUp, Filter } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, Card, useLoad, ImgField, fmt } from "./ui";

const TABS = [
  ["config", tr("獎勵配置"), Gift],
  ["analytics", tr("數據看板"), BarChart3],
  ["posters", tr("海報模板"), ImageIcon],
  ["records", tr("邀請記錄"), Users],
  ["leaderboard", tr("排行榜與週獎"), Trophy],
];

const DEFAULT_STYLE = { title_color: "#ffffff", subtitle_color: "#ffffff", code_color: "#ea580c", title_x: 0.5, title_y: 0.08, title_align: "center", card_x: 0.5, card_y: 0.64 };

function StatCard({ label, value, tone = "orange" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div>
    </Card>
  );
}

// type/value(+coupon) inline editor for a single reward row
function RewardFields({ row, onChange, promos, testPrefix }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select data-testid={`${testPrefix}-type`} value={row.type || "points"} onChange={(e) => onChange({ ...row, type: e.target.value })} className="h-9 rounded-lg bg-slate-100 px-2.5 text-sm outline-none">
        <option value="points">{tr("積分")}</option>
        <option value="coupon">{tr("優惠券")}</option>
      </select>
      {(row.type || "points") === "points" ? (
        <Input data-testid={`${testPrefix}-value`} type="number" className="w-28" value={row.value ?? 0} onChange={(e) => onChange({ ...row, value: +e.target.value })} />
      ) : (
        <select data-testid={`${testPrefix}-coupon`} value={row.coupon_code || ""} onChange={(e) => onChange({ ...row, coupon_code: e.target.value })} className="h-9 rounded-lg bg-slate-100 px-2.5 text-sm outline-none min-w-[9rem]">
          <option value="">{tr("選擇優惠券")}</option>
          {(promos || []).map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
        </select>
      )}
    </div>
  );
}

function AnalyticsTab({ callApi }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  useEffect(() => {
    callApi({ method: "GET", url: `/admin/referral/trend?days=${days}` }).then((r) => setData(r.data)).catch(() => {});
    callApi({ method: "GET", url: `/admin/referral/funnel?days=${days}` }).then((r) => setFunnel(r.data)).catch(() => {});
  }, [callApi, days]);
  if (!data) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  const rows = data.rows || [];
  const max = Math.max(1, ...rows.flatMap((d) => [d.bound, d.converted]));
  const series = [{ key: "bound", label: tr("新綁定"), color: "#f97316" }, { key: "converted", label: tr("首充轉化"), color: "#10b981" }];
  const fp = funnel?.period;
  const steps = fp ? [
    { key: "visits", label: tr("訪問"), value: fp.visits, color: "#38bdf8", step: null },
    { key: "registers", label: tr("註冊"), value: fp.registers, color: "#f97316", step: fp.reg_rate },
    { key: "topups", label: tr("首充"), value: fp.topups, color: "#10b981", step: fp.topup_rate },
  ] : [];
  const fmax = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-4" data-testid="ref-analytics">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} data-testid={`ref-trend-days-${d}`} onClick={() => setDays(d)}
              className={`h-8 px-3 rounded-full text-xs font-semibold ${days === d ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>{tr("近 {0} 日", d)}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={tr("期間新綁定")} value={data.period_bound} tone="orange" />
        <StatCard label={tr("期間首充轉化")} value={data.period_converted} tone="emerald" />
        <StatCard label={tr("期間轉化率")} value={`${data.period_rate}%`} tone="sky" />
        <StatCard label={tr("累計轉化率")} value={`${data.total_rate}%`} tone="amber" />
      </div>

      {fp && (
        <Card className="p-4" data-testid="ref-funnel">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Filter className="h-4 w-4 text-orange-500" />{tr("轉化漏斗（訪問 → 註冊 → 首充）")}</div>
            <div className="text-[11px] text-slate-500">{tr("整體轉化率")} <span className="font-bold text-emerald-600">{fp.overall_rate}%</span></div>
          </div>
          <div className="space-y-2.5">
            {steps.map((s, i) => (
              <div key={s.key} data-testid={`ref-funnel-${s.key}`} className="flex items-center gap-3">
                <span className="w-12 text-xs text-slate-500 shrink-0">{s.label}</span>
                <div className="flex-1 h-9 rounded-lg bg-slate-100 overflow-hidden relative">
                  <div className="h-full rounded-lg flex items-center px-3 text-white text-xs font-bold transition-all" style={{ width: `${Math.max(8, (s.value / fmax) * 100)}%`, background: s.color }}>{s.value}</div>
                </div>
                <span className="w-16 text-right text-[11px] shrink-0">{i === 0 ? <span className="text-slate-400">—</span> : <span className="text-emerald-600 font-semibold">{s.step}%</span>}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">{tr("「訪問」為帶邀請碼連結的去重瀏覽；百分比為相對上一步的轉化率")}</div>
        </Card>
      )}

      <Card className="p-4" data-testid="ref-trend-chart">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-orange-500" />{tr("每日新綁定與首充轉化")}</div>
          <div className="flex gap-3">{series.map((s) => <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
        </div>
        <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
          {rows.map((d) => {
            const rate = d.bound ? Math.round((d.converted / d.bound) * 100) : 0;
            return (
              <div key={d.date} className="flex-1 min-w-[18px] flex flex-col items-center gap-1" data-testid={`ref-trend-day-${d.date}`}>
                <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                  {series.map((s) => (
                    <div key={s.key} className="w-2 sm:w-2.5 rounded-t transition-all" title={`${s.label} ${d[s.key]}`}
                      style={{ height: `${Math.max(2, (d[s.key] / max) * 96)}px`, background: s.color }} />
                  ))}
                </div>
                <span className="text-[9px] text-emerald-600 font-semibold">{d.bound ? `${rate}%` : "-"}</span>
                <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ConfigTab({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const [promos, setPromos] = useState([]);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/referral/config" }).then((r) => setCfg(r.data)), [callApi]);
  useEffect(() => { load(); callApi({ method: "GET", url: "/admin/promos" }).then((r) => setPromos(r.data || [])).catch(() => {}); }, [load, callApi]);
  const save = async () => {
    try { await callApi({ method: "PUT", url: "/admin/referral/config", data: cfg }); toast.success(tr("已儲存")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const runWeekly = async () => {
    if (!window.confirm(tr("立即依『過去 7 天』成功邀請數結算週榜並發獎？"))) return;
    try { await callApi({ method: "POST", url: "/admin/referral/weekly/run" }); toast.success(tr("已結算，獎勵已發放")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("結算失敗")); }
  };
  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;

  const setMs = (i, v) => { const a = [...(cfg.milestones || [])]; a[i] = v; setCfg({ ...cfg, milestones: a }); };
  const addMs = () => setCfg({ ...cfg, milestones: [...(cfg.milestones || []), { count: 1, type: "points", value: 100, coupon_code: "" }] });
  const delMs = (i) => setCfg({ ...cfg, milestones: (cfg.milestones || []).filter((_, j) => j !== i) });
  const setWk = (i, v) => { const a = [...(cfg.weekly_rewards || [])]; a[i] = { ...v, rank: i + 1 }; setCfg({ ...cfg, weekly_rewards: a }); };
  const addWk = () => setCfg({ ...cfg, weekly_rewards: [...(cfg.weekly_rewards || []), { rank: (cfg.weekly_rewards?.length || 0) + 1, type: "points", value: 100, coupon_code: "" }] });
  const delWk = (i) => setCfg({ ...cfg, weekly_rewards: (cfg.weekly_rewards || []).filter((_, j) => j !== i).map((r, k) => ({ ...r, rank: k + 1 })) });

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-5 space-y-4">
        <div className="font-head font-bold text-slate-800 flex items-center gap-2"><Gift className="h-4 w-4 text-orange-500" />{tr("基礎邀請獎勵")}</div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" data-testid="ref-cfg-enabled" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />
          {tr("啟用邀請返利活動")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("邀請人獲得積分")}><Input data-testid="ref-cfg-referrer" type="number" className="w-full" value={cfg.referrer_points} onChange={(e) => setCfg({ ...cfg, referrer_points: +e.target.value })} /></Field>
          <Field label={tr("受邀人獲得積分")}><Input data-testid="ref-cfg-referee" type="number" className="w-full" value={cfg.referee_points} onChange={(e) => setCfg({ ...cfg, referee_points: +e.target.value })} /></Field>
        </div>
        <Field label={tr("海報主標題")}><Input data-testid="ref-cfg-title" className="w-full" value={cfg.poster_title} onChange={(e) => setCfg({ ...cfg, poster_title: e.target.value })} /></Field>
        <Field label={tr("海報副標題")}><Input data-testid="ref-cfg-subtitle" className="w-full" value={cfg.poster_subtitle} onChange={(e) => setCfg({ ...cfg, poster_subtitle: e.target.value })} /></Field>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-head font-bold text-slate-800 flex items-center gap-2"><Target className="h-4 w-4 text-orange-500" />{tr("邀請階梯任務（達標自動發獎）")}</div>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" data-testid="ref-cfg-ms-enabled" checked={cfg.milestones_enabled} onChange={(e) => setCfg({ ...cfg, milestones_enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用")}</label>
        </div>
        <div className="space-y-2" data-testid="ref-cfg-milestones">
          {(cfg.milestones || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap bg-slate-50 rounded-xl p-2.5" data-testid={`ref-cfg-ms-row-${i}`}>
              <span className="text-xs text-slate-500">{tr("邀請滿")}</span>
              <Input data-testid={`ref-cfg-ms-count-${i}`} type="number" className="w-20" value={m.count} onChange={(e) => setMs(i, { ...m, count: +e.target.value })} />
              <span className="text-xs text-slate-500">{tr("人，發")}</span>
              <RewardFields row={m} onChange={(v) => setMs(i, v)} promos={promos} testPrefix={`ref-cfg-ms-${i}`} />
              <button data-testid={`ref-cfg-ms-del-${i}`} onClick={() => delMs(i)} className="ml-auto h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <Btn kind="ghost" data-testid="ref-cfg-ms-add" onClick={addMs}><Plus className="h-4 w-4" />{tr("新增階梯")}</Btn>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-head font-bold text-slate-800 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />{tr("每週邀請榜獎勵（每週一 00:05 自動結算）")}</div>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" data-testid="ref-cfg-wk-enabled" checked={cfg.weekly_enabled} onChange={(e) => setCfg({ ...cfg, weekly_enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用")}</label>
        </div>
        <div className="space-y-2" data-testid="ref-cfg-weekly">
          {(cfg.weekly_rewards || []).map((w, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap bg-amber-50/60 rounded-xl p-2.5" data-testid={`ref-cfg-wk-row-${i}`}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white font-head font-bold text-sm">{i + 1}</span>
              <span className="text-xs text-slate-500">{tr("名，發")}</span>
              <RewardFields row={w} onChange={(v) => setWk(i, v)} promos={promos} testPrefix={`ref-cfg-wk-${i}`} />
              <button data-testid={`ref-cfg-wk-del-${i}`} onClick={() => delWk(i)} className="ml-auto h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Btn kind="ghost" data-testid="ref-cfg-wk-add" onClick={addWk}><Plus className="h-4 w-4" />{tr("新增名次")}</Btn>
            <Btn kind="ok" data-testid="ref-cfg-wk-run" onClick={runWeekly}><Play className="h-4 w-4" />{tr("立即結算本週榜")}</Btn>
          </div>
        </div>
      </Card>

      <Btn data-testid="ref-cfg-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存全部配置")}</Btn>
    </div>
  );
}

// draggable poster style editor
function PosterStyleEditor({ style, image, title, subtitle, code, onChange }) {
  const boxRef = useRef(null);
  const st = { ...DEFAULT_STYLE, ...(style || {}) };
  const drag = (key) => (e) => {
    e.preventDefault();
    const move = (ev) => {
      const r = boxRef.current.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      onChange({ ...st, [`${key}_x`]: +x.toFixed(3), [`${key}_y`]: +y.toFixed(3) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3">
      <div ref={boxRef} className="relative aspect-[3/5] rounded-xl overflow-hidden bg-slate-200 select-none touch-none" data-testid="ref-poster-preview">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover pointer-events-none" /> : <div className="absolute inset-0 bg-gradient-to-b from-orange-500 to-amber-400" />}
        <div onPointerDown={drag("title")} data-testid="ref-poster-drag-title"
          className="absolute cursor-move max-w-[85%]" style={{ left: `${st.title_x * 100}%`, top: `${st.title_y * 100}%`, transform: st.title_align === "left" ? "none" : "translateX(-50%)", textAlign: st.title_align }}>
          <div className="text-[10px] font-extrabold leading-tight drop-shadow" style={{ color: st.title_color }}>{title || tr("邀請好友")}</div>
          <div className="text-[7px] leading-tight drop-shadow" style={{ color: st.subtitle_color }}>{subtitle || tr("掃碼註冊得積分")}</div>
        </div>
        <div onPointerDown={drag("card")} data-testid="ref-poster-drag-card"
          className="absolute cursor-move bg-white/95 rounded px-1.5 py-1 shadow" style={{ left: `${st.card_x * 100}%`, top: `${st.card_y * 100}%`, transform: "translateX(-50%)", width: "76%" }}>
          <div className="text-[6px] text-slate-400">{tr("我的邀請碼")}</div>
          <div className="text-[11px] font-extrabold leading-none" style={{ color: st.code_color }}>{code || "XXXXXXXX"}</div>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="text-[11px] text-slate-400">{tr("拖動上圖的標題與卡片調整位置")}</div>
        <div className="grid grid-cols-3 gap-2">
          {[["title_color", tr("標題色")], ["subtitle_color", tr("副標色")], ["code_color", tr("邀請碼色")]].map(([k, l]) => (
            <label key={k} className="text-[11px] text-slate-500">{l}
              <input type="color" data-testid={`ref-poster-color-${k}`} value={st[k]} onChange={(e) => onChange({ ...st, [k]: e.target.value })} className="block w-full h-8 mt-0.5 rounded-md border border-slate-200 bg-white cursor-pointer" />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{tr("標題對齊")}</span>
          {[["center", tr("置中")], ["left", tr("靠左")]].map(([v, l]) => (
            <button key={v} data-testid={`ref-poster-align-${v}`} onClick={() => onChange({ ...st, title_align: v })} className={`h-7 px-3 rounded-full text-[11px] font-semibold ${st.title_align === v ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onChange({ ...st, title_y: 0.07 })} className="h-7 px-2.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{tr("標題置頂")}</button>
          <button onClick={() => onChange({ ...st, title_y: 0.4 })} className="h-7 px-2.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{tr("標題居中")}</button>
          <button onClick={() => onChange({ ...st, card_y: 0.42 })} className="h-7 px-2.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{tr("卡片居中")}</button>
          <button onClick={() => onChange({ ...st, card_y: 0.64 })} className="h-7 px-2.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{tr("卡片置底")}</button>
        </div>
      </div>
    </div>
  );
}

const emptyPoster = { name: "", image: "", image_b64: "", image_name: "poster.png", active: true, sort: 0, style: { ...DEFAULT_STYLE } };

function PostersTab({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/referral/posters");
  const [edit, setEdit] = useState(null);
  const onImg = (v) => setEdit((s) => v?.startsWith("data:") ? { ...s, image_b64: v, image: "" } : { ...s, image: v, image_b64: "" });
  const save = async () => {
    try {
      if (edit.id) await callApi({ method: "PUT", url: `/admin/referral/posters/${edit.id}`, data: edit });
      else await callApi({ method: "POST", url: "/admin/referral/posters", data: edit });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (r) => { if (!window.confirm(tr("刪除此海報模板？"))) return; await callApi({ method: "DELETE", url: `/admin/referral/posters/${r.id}` }); load(); };
  return (
    <div>
      <Head title="" right={<Btn data-testid="ref-poster-add" onClick={() => setEdit({ ...emptyPoster })}><Plus className="h-4 w-4" />{tr("新增海報模板")}</Btn>} />
      <div className="text-xs text-slate-500 -mt-3 mb-3">{tr("上傳背景圖（建議直式 3:5，≤4M），並可自定文字顏色與邀請碼/標題位置")}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ref-poster-grid">
        {(list || []).map((r) => (
          <Card key={r.id} data-testid={`ref-poster-${r.id}`} className={`overflow-hidden ${r.active ? "" : "opacity-50"}`}>
            <div className="aspect-[3/5] bg-slate-100"><img src={r.image} alt={r.name} className="h-full w-full object-cover" /></div>
            <div className="p-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                {r.active ? <Pill tone="emerald">{tr("啟用")}</Pill> : <Pill tone="slate">{tr("停用")}</Pill>}
              </div>
              <div className="flex gap-1.5 mt-2">
                <Btn kind="ghost" data-testid={`ref-poster-edit-${r.id}`} onClick={() => setEdit({ ...r, image_b64: "", image_name: "poster.png", style: { ...DEFAULT_STYLE, ...(r.style || {}) } })}><Pencil className="h-3.5 w-3.5" /></Btn>
                <Btn kind="danger" data-testid={`ref-poster-del-${r.id}`} onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Btn>
              </div>
            </div>
          </Card>
        ))}
        {list !== null && list.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-10">{tr("暫無海報模板")}</div>}
      </div>
      {edit && (
        <Modal testId="ref-poster-modal" title={<span className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-orange-500" />{edit.id ? tr("編輯海報模板") : tr("新增海報模板")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="ref-poster-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("模板名稱")}><Input data-testid="ref-poster-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label={tr("背景圖（直式 3:5）")}><ImgField testId="ref-poster-img" ratio="aspect-[3/5]" value={edit.image_b64 || edit.image} onChange={onImg} /></Field>
          <Field label={tr("文字樣式與位置")}>
            <PosterStyleEditor style={edit.style} image={edit.image_b64 || edit.image} title={edit.name} subtitle="" code="GOGO1234" onChange={(style) => setEdit({ ...edit, style })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("排序（小在前）")}><Input data-testid="ref-poster-sort" type="number" className="w-full" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: +e.target.value })} /></Field>
            <label className="flex items-end gap-2 text-sm text-slate-700 pb-2"><input type="checkbox" data-testid="ref-poster-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用")}</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RecordsTab({ callApi }) {
  const [q, setQ] = useState("");
  const [rewarded, setRewarded] = useState("");
  const [list, setList] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/referral/records?q=${encodeURIComponent(q)}&rewarded=${rewarded}` }).then((r) => setList(r.data)).catch(() => {}), [callApi, q, rewarded]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input data-testid="ref-rec-search" placeholder={tr("搜尋帳號/郵箱/手機")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="w-56" />
        <select data-testid="ref-rec-filter" value={rewarded} onChange={(e) => setRewarded(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
          <option value="">{tr("全部狀態")}</option>
          <option value="yes">{tr("已發獎")}</option>
          <option value="no">{tr("未發獎")}</option>
        </select>
        <Btn kind="ghost" data-testid="ref-rec-refresh" onClick={load}>{tr("查詢")}</Btn>
      </div>
      <Table testId="ref-rec-table" cols={[tr("受邀人"), tr("邀請人"), tr("綁定時間"), tr("狀態"), tr("積分獎勵"), tr("發獎時間")]}
        empty={list === null ? tr("載入中…") : tr("暫無邀請記錄")} rows={list || []} render={(r, i) => (
          <tr key={i} data-testid={`ref-rec-row-${i}`} className="hover:bg-orange-50/30">
            <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.referee_label || "-"}</div><div className="text-[11px] text-slate-400">#{r.referee_account}</div></td>
            <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.inviter_label || "-"}</div><div className="text-[11px] text-slate-400">#{r.inviter_account}</div></td>
            <td className="px-4 py-3 text-slate-500">{fmt(r.referred_at)}</td>
            <td className="px-4 py-3">{r.rewarded ? <Pill tone="emerald"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{tr("已發獎")}</span></Pill> : <Pill tone="amber"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{tr("待首充")}</span></Pill>}</td>
            <td className="px-4 py-3 text-xs">{r.rewarded ? <span className="text-emerald-600 font-semibold">{tr("邀請人")} +{r.referrer_points} · {tr("受邀人")} +{r.referee_points}</span> : <span className="text-slate-400">-</span>}</td>
            <td className="px-4 py-3 text-slate-500">{fmt(r.rewarded_at)}</td>
          </tr>
        )} />
    </div>
  );
}

function LeaderboardTab({ callApi }) {
  const [list] = useLoad(callApi, "/admin/referral/leaderboard");
  const [awards] = useLoad(callApi, "/admin/referral/weekly/awards");
  const medal = ["bg-amber-400 text-white", "bg-slate-300 text-white", "bg-orange-300 text-white"];
  return (
    <div className="space-y-6">
      <div>
        <div className="font-head font-bold text-slate-800 mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />{tr("邀請排行榜（累計）")}</div>
        <Table testId="ref-lb-table" cols={[tr("排名"), tr("邀請人"), tr("成功邀請"), tr("累計積分")]}
          empty={list === null ? tr("載入中…") : tr("暫無排行數據")} rows={list || []} render={(r, i) => (
            <tr key={r.account} data-testid={`ref-lb-row-${i}`} className="hover:bg-amber-50/30">
              <td className="px-4 py-3"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-head font-bold text-sm ${medal[i] || "bg-slate-100 text-slate-500"}`}>{i + 1}</span></td>
              <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.label || "-"}</div><div className="text-[11px] text-slate-400">#{r.account}</div></td>
              <td className="px-4 py-3 font-head font-bold text-orange-600">{r.invited}</td>
              <td className="px-4 py-3 font-head font-bold text-amber-600">{r.points_earned}</td>
            </tr>
          )} />
      </div>
      <div>
        <div className="font-head font-bold text-slate-800 mb-2 flex items-center gap-2"><Repeat className="h-4 w-4 text-emerald-500" />{tr("週榜發獎記錄")}</div>
        <Table testId="ref-weekly-table" cols={[tr("週次"), tr("名次"), tr("邀請人"), tr("本週邀請"), tr("獎勵"), tr("發放時間")]}
          empty={awards === null ? tr("載入中…") : tr("尚無週榜發獎記錄")} rows={awards || []} render={(r, i) => (
            <tr key={i} data-testid={`ref-weekly-row-${i}`} className="hover:bg-emerald-50/30">
              <td className="px-4 py-3 text-slate-600">{r.week}</td>
              <td className="px-4 py-3"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-head font-bold text-xs ${medal[r.rank - 1] || "bg-slate-100 text-slate-500"}`}>{r.rank}</span></td>
              <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.label || "-"}</div><div className="text-[11px] text-slate-400">#{r.account}</div></td>
              <td className="px-4 py-3 font-head font-bold text-orange-600">{r.count}</td>
              <td className="px-4 py-3 text-emerald-600 font-semibold text-xs">{r.reward_label}</td>
              <td className="px-4 py-3 text-slate-500">{fmt(r.created_at)}</td>
            </tr>
          )} />
      </div>
    </div>
  );
}

export function ReferralAdmin({ callApi }) {
  const [tab, setTab] = useState("config");
  const [stats, setStats] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: "/admin/referral/stats" }).then((r) => setStats(r.data)).catch(() => {}); }, [callApi]);
  return (
    <div data-testid="referral-admin">
      <Head title={tr("邀請返利管理")} sub={tr("配置邀請獎勵、階梯任務、週榜獎勵與海報模板，查看邀請記錄與排行榜")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label={tr("綁定邀請數")} value={stats?.total_bound ?? "—"} tone="orange" />
        <StatCard label={tr("已發獎人數")} value={stats?.total_rewarded ?? "—"} tone="emerald" />
        <StatCard label={tr("邀請人數")} value={stats?.total_inviters ?? "—"} tone="sky" />
        <StatCard label={tr("已發放積分")} value={stats?.points_granted ?? "—"} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} data-testid={`ref-tab-${k}`} onClick={() => setTab(k)}
            className={`h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${tab === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {tab === "config" && <ConfigTab callApi={callApi} />}
      {tab === "analytics" && <AnalyticsTab callApi={callApi} />}
      {tab === "posters" && <PostersTab callApi={callApi} />}
      {tab === "records" && <RecordsTab callApi={callApi} />}
      {tab === "leaderboard" && <LeaderboardTab callApi={callApi} />}
    </div>
  );
}
