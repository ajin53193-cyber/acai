import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Eye, EyeOff, Save, LayoutGrid } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Card } from "./ui";

export function HomeLayoutAdmin({ callApi }) {
  const [layout, setLayout] = useState(null);
  const [drag, setDrag] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: "/site-config" }).then((r) => setLayout(r.data.home_layout || [])).catch(() => toast.error(tr("載入失敗"))); }, [callApi]);
  if (!layout) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;

  const move = (from, to) => {
    if (to < 0 || to >= layout.length || from === to) return;
    const a = [...layout]; const [m] = a.splice(from, 1); a.splice(to, 0, m); setLayout(a);
  };
  const onDrop = (to) => { if (drag !== null) move(drag, to); setDrag(null); };
  const toggle = (i) => setLayout(layout.map((b, idx) => idx === i ? { ...b, visible: !b.visible } : b));
  const save = async () => {
    try { await callApi({ method: "PUT", url: "/admin/site-config", data: { home_layout: layout } }); toast.success(tr("首頁佈局已儲存")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };

  return (
    <div data-testid="homelayout-admin">
      <Head title={tr("首頁裝修")} sub={tr("拖曳調整首頁各板塊顯示順序，或隱藏不需要的板塊；儲存後立即生效")} right={<Btn data-testid="homelayout-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存佈局")}</Btn>} />
      <Card className="p-3 max-w-xl">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 px-1"><LayoutGrid className="h-3.5 w-3.5" />{tr("拖動左側手柄排序")}</div>
        <div className="space-y-2" data-testid="homelayout-list">
          {layout.map((b, i) => (
            <div key={b.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
              data-testid={`hl-row-${b.key}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-white cursor-move transition-shadow ${drag === i ? "shadow-lg border-orange-300" : "border-slate-200"} ${b.visible ? "" : "opacity-50"}`}>
              <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="h-6 w-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm font-medium text-slate-800">{tr(b.label)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200">↑</button>
                <button onClick={() => move(i, i + 1)} disabled={i === layout.length - 1} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200">↓</button>
                <button data-testid={`hl-toggle-${b.key}`} onClick={() => toggle(i)} className={`h-7 w-7 rounded-lg flex items-center justify-center ${b.visible ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{b.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
