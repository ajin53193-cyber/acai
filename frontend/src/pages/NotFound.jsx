import { Link } from "react-router-dom";
import { tr } from "@/i18n";

export default function NotFound() {
  return (
    <div data-testid="not-found-page" className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="font-head text-6xl font-extrabold text-orange-500">404</div>
      <div className="text-slate-700 font-semibold">{tr("找不到此頁面")}</div>
      <Link to="/" data-testid="not-found-home" className="h-10 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold inline-flex items-center hover:bg-orange-600">{tr("返回首頁")}</Link>
    </div>
  );
}
