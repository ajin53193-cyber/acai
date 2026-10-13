import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, X, MessageCircle, Clock, HelpCircle, ChevronRight, ArrowUpToLine } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { publicApi } from "@/lib/api";

export const openService = () => window.dispatchEvent(new Event("open-service"));

const FAQ = [
  ["充值多久到帳？", "/info/faq"],
  ["可以退款嗎？", "/info/refund"],
  ["帳號填錯怎麼辦？", "/info/faq"],
  ["查看我的訂單", "/orders"],
];

export default function ServiceWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({ whatsapp_link: "https://wa.me/", cs_label: "WhatsApp 掃碼聯繫客服" });
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("open-service", on);
    window.addEventListener("scroll", onScroll, { passive: true });
    publicApi.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    return () => { window.removeEventListener("open-service", on); window.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-40 md:hidden bg-black/30" onClick={() => setOpen(false)} />
          <div data-testid="service-widget-panel" className="fixed bottom-24 right-4 md:bottom-24 md:right-6 z-50 w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-orange-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#F0872E] to-[#E8792A] text-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-head font-bold flex items-center gap-2"><Headphones className="h-4 w-4" />線上客服</span>
                <button data-testid="service-widget-close" onClick={() => setOpen(false)} className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-white/85 mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />7×24 小時人工客服，充值問題即時處理</p>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center gap-3 bg-orange-50 rounded-xl p-3">
                <a href={settings.whatsapp_link} target="_blank" rel="noreferrer" className="bg-white rounded-lg p-1 shrink-0"><QRCodeSVG value={settings.whatsapp_link || "https://wa.me/"} size={72} fgColor="#E8792A" level="M" /></a>
                <div className="min-w-0">
                  <div className="text-xs text-slate-600 leading-relaxed">{settings.cs_label}</div>
                  <a data-testid="service-widget-whatsapp" href={settings.whatsapp_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#25D366] text-white text-xs font-bold hover:brightness-95">
                    <MessageCircle className="h-4 w-4" />開啟 WhatsApp
                  </a>
                </div>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" />常見問題</div>
              <div className="space-y-1.5">
                {FAQ.map(([q, to]) => (
                  <Link key={q} to={to} onClick={() => setOpen(false)} className="flex items-center justify-between text-xs bg-slate-50 text-slate-700 rounded-lg px-3 py-2 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                    {q}<ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {showTop && (
        <button data-testid="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[9.5rem] right-4 md:bottom-24 md:right-6 z-50 h-14 w-14 rounded-full bg-white/90 shadow-xl flex items-center justify-center text-orange-500 hover:bg-white">
          <ArrowUpToLine className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}
      <button
        data-testid="service-widget-trigger"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full bg-white/90 md:bg-gradient-to-br md:from-[#F0872E] md:to-[#E8792A] text-orange-500 md:text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
      </button>
    </>
  );
}
