import { useState } from "react";
import { Headphones, X, MessageCircle } from "lucide-react";

export default function ServiceWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          data-testid="service-widget-panel"
          className="fixed bottom-24 right-4 md:bottom-24 md:right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-primary to-blue-700 text-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-head font-bold">線上客服</span>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-white/80 mt-1">7×24 人工客服，充值問題即時處理</p>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3 text-slate-600">
              您好！歡迎來到 GlobalTopUp 環球充值 👋<br />
              下單後如需加急，請提供訂單編號，客服將優先處理。
            </div>
            <div className="text-xs text-slate-400">常見問題</div>
            <div className="space-y-1.5">
              {["充值多久到帳？", "可以退款嗎？", "帳號填錯怎麼辦？"].map((q) => (
                <div key={q} className="text-xs bg-primary/5 text-primary rounded-lg px-3 py-2 cursor-pointer hover:bg-primary/10">
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        data-testid="service-widget-trigger"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-13 w-13 md:h-14 md:w-14 rounded-full bg-gradient-to-br from-primary to-blue-700 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform p-3.5"
      >
        {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
      </button>
    </>
  );
}
