import { Construction, Hammer, Sparkles } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card } from "./ui";

export function Soon({ title }) {
  return (
    <div data-testid="admin-soon">
      <Head title={title} sub={tr("此模塊正在開發中")} />
      <Card className="p-10 sm:p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/60 via-white to-slate-50 pointer-events-none" />
        <div className="relative">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center shadow-lg shadow-orange-200/60">
            <Construction className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 font-head text-2xl font-bold text-slate-900">{tr("功能開發中")}</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{tr("「{0}」模塊即將上線。我們正按規劃分批開發後台功能，敬請期待。", title)}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 text-xs font-semibold text-amber-700">
            <Hammer className="h-3.5 w-3.5" />{tr("建設中")}<Sparkles className="h-3.5 w-3.5" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Soon;
