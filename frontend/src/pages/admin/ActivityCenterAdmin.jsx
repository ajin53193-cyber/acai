import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, GripVertical, LayoutGrid } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Field, Card } from "./ui";

const TYPES = [
  ["flash", tr("秒殺（自動顯示場次）")], ["lottery", tr("抽獎（自動顯示狀態）")], ["combo", tr("套餐（自動顯示款數）")],
  ["recharge", tr("充值（自動顯示檔數）")], ["cartpromo", tr("滿減（自動顯示檔數）")], ["invite", tr("邀請好友")], ["custom", tr("自訂（用下方角標文字）")],
];
const ICONS = ["Zap", "Gift", "Package", "Percent", "Users", "Wallet", "Sparkles", "Ticket", "Star", "Flame", "Crown", "Coins"];
const COLORS = ["rose", "orange", "violet", "emerald", "sky", "pink", "amber", "teal", "blue", "slate"];
const COLOR_DOT = { rose: "bg-rose-500", orange: "bg-orange-500", violet: "bg-violet-500", emerald: "bg-emerald-500", sky: "bg-sky-500", pink: "bg-pink-500", amber: "bg-amber-500", teal: "bg-teal-500", blue: "bg-blue-500", slate: "bg-slate-500" };

const newCard = () => ({ key: "c" + Math.random().toString(36).slice(2, 8), type: "custom", enabled: true, sort: 99, title: tr("新活動"), desc: "", badge: "", to: "/", icon: "Sparkles", color: "amber" });

export function ActivityCenterAdmin({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/activity-center" }).then((r) => setCfg(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);

  const setCard = (i, patch) => { const a = [...cfg.cards]; a[i] = { ...a[i], ...patch }; setCfg({ ...cfg, cards: a }); };
  const delCard = (i) => setCfg({ ...cfg, cards: cfg.cards.filter((_, j) => j !== i) });
  const addCard = () => setCfg({ ...cfg, cards: [...cfg.cards, { ...newCard(), sort: (cfg.cards.length + 1) }] });
  const move = (i, dir) => { const a = [...cfg.cards]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; a.forEach((c, k) => (c.sort = k + 1)); setCfg({ ...cfg, cards: a }); };
  const save = async () => {
    const cards = cfg.cards.map((c, k) => ({ ...c, sort: c.sort || k + 1 }));
    try { await callApi({ method: "PUT", url: "/admin/activity-center", data: { ...cfg, cards } }); toast.success(tr("已儲存")); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };

  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;

  return (
    <div data-testid="activity-center-admin">
      <Head title={tr("活動中心配置")} sub={tr("自訂前台活動中心顯示哪些入口卡、排序與文案（角標會依類型自動顯示，可用自訂文字覆蓋）")}
        right={<Btn data-testid="ac-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存配置")}</Btn>} />

      <Card className="p-5 space-y-3 mb-4 max-w-2xl">
        <div className="font-head font-bold text-slate-800 flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-orange-500" />{tr("頁首橫幅")}</div>
        <Field label={tr("主標題")}><Input data-testid="ac-header-title" className="w-full" value={cfg.header_title} onChange={(e) => setCfg({ ...cfg, header_title: e.target.value })} /></Field>
        <Field label={tr("副標題")}><Input data-testid="ac-header-subtitle" className="w-full" value={cfg.header_subtitle} onChange={(e) => setCfg({ ...cfg, header_subtitle: e.target.value })} /></Field>
      </Card>

      <div className="space-y-3" data-testid="ac-cards">
        {cfg.cards.map((c, i) => (
          <Card key={c.key} data-testid={`ac-card-${i}`} className={`p-4 ${c.enabled ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <GripVertical className="h-4 w-4 text-slate-300" />
                <button data-testid={`ac-card-up-${i}`} onClick={() => move(i, -1)} className="text-slate-400 hover:text-orange-500 text-xs">▲</button>
                <button data-testid={`ac-card-down-${i}`} onClick={() => move(i, 1)} className="text-slate-400 hover:text-orange-500 text-xs">▼</button>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Field label={tr("標題")}><Input data-testid={`ac-card-title-${i}`} className="w-full" value={c.title} onChange={(e) => setCard(i, { title: e.target.value })} /></Field>
                <Field label={tr("描述")}><Input data-testid={`ac-card-desc-${i}`} className="w-full" value={c.desc} onChange={(e) => setCard(i, { desc: e.target.value })} /></Field>
                <Field label={tr("類型")}>
                  <select data-testid={`ac-card-type-${i}`} value={c.type} onChange={(e) => setCard(i, { type: e.target.value })} className="h-9 w-full rounded-lg bg-slate-100 px-2.5 text-sm outline-none">
                    {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label={tr("跳轉連結")}><Input data-testid={`ac-card-to-${i}`} className="w-full" value={c.to} onChange={(e) => setCard(i, { to: e.target.value })} placeholder="/lottery" /></Field>
                <Field label={tr("角標文字（留空自動）")}><Input data-testid={`ac-card-badge-${i}`} className="w-full" value={c.badge} onChange={(e) => setCard(i, { badge: e.target.value })} placeholder={tr("如：限時 3 天")} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={tr("圖示")}>
                    <select data-testid={`ac-card-icon-${i}`} value={c.icon} onChange={(e) => setCard(i, { icon: e.target.value })} className="h-9 w-full rounded-lg bg-slate-100 px-2.5 text-sm outline-none">
                      {ICONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label={tr("顏色")}>
                    <select data-testid={`ac-card-color-${i}`} value={c.color} onChange={(e) => setCard(i, { color: e.target.value })} className="h-9 w-full rounded-lg bg-slate-100 px-2.5 text-sm outline-none">
                      {COLORS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 pt-1">
                <span className={`h-5 w-5 rounded-full ${COLOR_DOT[c.color] || "bg-orange-500"}`} title={c.color} />
                <label className="flex flex-col items-center text-[11px] text-slate-500 gap-1">
                  <input type="checkbox" data-testid={`ac-card-enabled-${i}`} checked={c.enabled} onChange={(e) => setCard(i, { enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("顯示")}
                </label>
                <button data-testid={`ac-card-del-${i}`} onClick={() => delCard(i)} className="h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Btn kind="ghost" data-testid="ac-add" onClick={addCard}><Plus className="h-4 w-4" />{tr("新增入口卡")}</Btn>
        <Btn data-testid="ac-save-2" onClick={save}><Save className="h-4 w-4" />{tr("儲存配置")}</Btn>
      </div>
    </div>
  );
}
