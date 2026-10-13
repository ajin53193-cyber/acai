import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { publicApi } from "@/lib/api";
import { openService } from "@/components/ServiceWidget";
import { Star, Apple, CreditCard } from "lucide-react";

const PAY_BADGES = [
  <span className="font-black italic text-base text-[#1A1F71]">VISA</span>,
  <span className="flex items-center gap-1">
    <span className="flex items-center"><span className="h-4 w-4 rounded-full bg-[#EB001B]" /><span className="h-4 w-4 rounded-full bg-[#F79E1B] -ml-2" /></span>
    <span className="font-bold text-[9px] text-slate-700">MasterCard</span>
  </span>,
  <span className="flex items-center gap-0.5 font-extrabold italic text-sm">
    <span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span>
  </span>,
  <span className="flex items-center gap-0.5 font-semibold text-sm text-slate-900"><Apple className="h-4 w-4 fill-slate-900 text-slate-900" />Pay</span>,
  <span className="flex items-center gap-1">
    <span className="h-5 w-5 rounded-[5px] bg-[#1677FF] text-white text-[12px] font-black flex items-center justify-center">支</span>
    <span className="font-bold text-[11px] text-[#1677FF]">支付寶</span>
  </span>,
  <span className="font-black text-[11px] leading-none text-center text-[#0a7cc1]">Touch<br />'nGo</span>,
  <span className="font-black text-[11px] leading-none text-center"><span className="text-[#ec1c8e]">PAY</span><br /><span className="text-[#f6a623]">NOW</span></span>,
  <span className="flex items-center gap-1">
    <CreditCard className="h-4 w-4 text-slate-500" />
    <span className="font-bold text-[10px] text-slate-700 leading-tight">臺灣ATM<br />銀行轉帳</span>
  </span>,
  <span className="flex flex-col items-center gap-0.5">
    <span className="font-bold text-[9px] text-slate-700">台灣超商</span>
    <span className="flex gap-0.5">
      <span className="h-3.5 w-3.5 rounded-sm bg-[#ff7f00] text-white text-[7px] font-black flex items-center justify-center">7</span>
      <span className="h-3.5 w-3.5 rounded-sm bg-[#008a3e] text-white text-[7px] font-black flex items-center justify-center">F</span>
      <span className="h-3.5 w-3.5 rounded-sm bg-[#e60012] text-white text-[6px] font-black flex items-center justify-center">Hi</span>
      <span className="h-3.5 w-3.5 rounded-sm bg-[#005bac] text-white text-[6px] font-black flex items-center justify-center">OK</span>
    </span>
  </span>,
];

const COLS = [
  ["關於我們", [["公司介紹", "/info/about"], ["隱私權政策", "/info/privacy"], ["條款與條件", "/info/terms"], ["聯絡我們", "/info/contact"]]],
  ["購物指南", [["購物流程", "/info/shopping-flow"], ["出貨流程", "/info/shipping-flow"], ["退款政策", "/info/refund"], ["成為經銷商", "/info/reseller", true]]],
  ["幫助訊息", [["活動中心", "/article"], ["常見問題", "/info/faq"], ["我的訂單", "/orders"], ["我的認證", "/account/verify"], ["我的優惠券", "/account/coupons"]]],
];

export default function Footer() {
  const [settings, setSettings] = useState({ whatsapp_link: "https://wa.me/", cs_label: "WhatsApp 掃碼聯繫客服" });
  const [logos, setLogos] = useState(null);
  useEffect(() => {
    publicApi.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    publicApi.get("/payment-logos").then((r) => setLogos(r.data)).catch(() => setLogos([]));
  }, []);
  return (
    <footer className="mt-4 md:mt-14 bg-[#F0872E] md:bg-gradient-to-b md:from-[#F0872E] md:to-[#E8792A] text-white">
      {/* Top: payments + follow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-7">
        <div className="flex md:flex-wrap items-center gap-3.5 md:gap-5 overflow-x-auto no-scrollbar">
          {logos && logos.length > 0 ? logos.map((l) => (
            <span key={l.id} data-testid={`pay-logo-${l.id}`} title={l.name} className="h-8 md:h-9 flex items-center shrink-0">
              <img src={l.image} alt={l.name} className="h-7 md:h-8 w-auto object-contain" />
            </span>
          )) : PAY_BADGES.map((b, i) => (
            <span key={i} data-testid={`pay-badge-${i}`} className="bg-white rounded-md h-9 min-w-[48px] px-3 flex items-center justify-center shadow-sm shrink-0">
              {b}
            </span>
          ))}
          <span className="text-white/60 tracking-widest text-lg shrink-0">•••</span>
        </div>
      </div>

      <div className="border-t border-white/20 mx-4 md:mx-0" />

      {/* Middle: links + service */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          <div className="grid grid-cols-3 gap-3 md:gap-6 px-2 md:px-0">
            {COLS.map(([title, links]) => (
              <div key={title}>
                <h4 className="font-bold text-[17px] md:text-sm mb-4 md:mb-4 whitespace-nowrap">{title}</h4>
                <ul className="space-y-3.5 md:space-y-2.5 text-[15px] md:text-[13px] text-white/90 md:text-white/85 whitespace-nowrap">
                  {links.map(([label, to, hot]) => (
                    <li key={label}>
                      <Link to={to} className="hover:text-white inline-flex items-center gap-1.5 transition-colors">
                        {label}
                        {hot && <span className="text-[9px] font-bold bg-white text-[#E8792A] rounded px-1 py-px">HOT</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-5 lg:justify-end lg:flex-row">
            <div className="flex items-center md:items-start gap-3 md:gap-4 bg-white/10 rounded-2xl p-3 md:p-4">
              <div className="flex flex-col items-center shrink-0 md:border-r-0 border-r border-white/25 pr-3 md:pr-0">
                <a href={settings.whatsapp_link} target="_blank" rel="noreferrer" data-testid="footer-whatsapp-qr" className="inline-block bg-white rounded-xl p-1.5 leading-none">
                  <QRCodeSVG value={settings.whatsapp_link} size={84} fgColor="#E8792A" level="M" className="block" />
                </a>
                <div className="text-[11px] text-white/90 md:text-white/80 mt-1.5 whitespace-nowrap">{settings.cs_label}</div>
              </div>
              <div className="flex flex-col gap-2.5 md:gap-3 pt-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] md:text-sm text-white/90 whitespace-nowrap">7*24 小時線上客服</span>
                  <button type="button" onClick={openService} data-testid="footer-cs-btn" className="text-xs font-bold bg-white/25 md:bg-white text-white md:text-[#E8792A] rounded-full px-3 py-1 whitespace-nowrap hover:bg-orange-50 hover:text-[#E8792A]">在線客服</button>
                </div>
                <div className="text-[13px] md:text-sm text-white/90 whitespace-nowrap">WhatsApp 24 小時客服</div>
                <div className="hidden md:flex items-center gap-1.5">
                  <div className="flex">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-6 w-6 bg-white/20 flex items-center justify-center first:rounded-l last:rounded-r">
                        <Star className="h-3.5 w-3.5 fill-white text-white" />
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold ml-1"><Star className="h-3.5 w-3.5 fill-white text-white" />Trustpilot</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Trustpilot */}
      <div className="md:hidden flex items-center justify-center gap-2 pb-6">
        <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-7 w-7 flex items-center justify-center rounded-sm ${i < 4 ? "bg-white/30" : "bg-white/15"}`}><Star className="h-4 w-4 fill-white text-white" /></span>)}</div>
        <span className="flex items-center gap-1 text-base font-semibold ml-1"><Star className="h-4 w-4 fill-white text-white" />Trustpilot</span>
      </div>

      {/* Bottom bar */}
      <div className="bg-black/10 md:bg-black/10 max-md:bg-transparent max-md:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <img src="/gogo589-logo.png" alt="gogo589" className="hidden md:block h-6 w-auto opacity-80" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="text-[13px] md:text-[11px] text-white/70">© 2015-2026 gogo589.com 版權所有，並保留所有權利</span>
          </div>
          <div className="text-[12px] md:text-[11px] text-white/55 md:text-right leading-relaxed">
            <div>Element colors Electronic Entertainment Limited · 本站為示範項目，支付為測試模式</div>
            <div>Address: 19H MAXGRAND PLAZA NO. 3 TAI YAU STREET SAN PO KONG KL, Hong Kong</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
