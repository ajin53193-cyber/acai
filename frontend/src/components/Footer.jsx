import { Link } from "react-router-dom";
import { Music2, Heart, Star, Apple, CreditCard } from "lucide-react";

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
  ["關於我們", [["公司介紹", "/"], ["隱私權政策", "/"], ["條款與條件", "/"], ["聯絡我們", "/"]]],
  ["購物指南", [["購物流程", "/"], ["出貨流程", "/"], ["退款政策", "/"], ["成為經銷商", "/", true]]],
  ["幫助訊息", [["常見問題", "/"], ["我的訂單", "/orders"], ["我的認證", "/"], ["我的優惠券", "/"]]],
];

export default function Footer() {
  return (
    <footer className="mt-14 bg-gradient-to-b from-[#F0872E] to-[#E8792A] text-white">
      {/* Top: payments + follow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-2.5">
            {PAY_BADGES.map((b, i) => (
              <span key={i} data-testid={`pay-badge-${i}`} className="bg-white rounded-md h-9 min-w-[48px] px-3 flex items-center justify-center shadow-sm">
                {b}
              </span>
            ))}
            <span className="text-white/70 tracking-widest text-lg">•••</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-bold text-sm">關注我們</span>
            <a href="/" data-testid="social-tiktok" className="h-9 w-9 rounded-full bg-black flex items-center justify-center hover:scale-105 transition-transform">
              <Music2 className="h-4 w-4 text-white" />
            </a>
            <a href="/" data-testid="social-red" className="h-9 w-9 rounded-full bg-[#FF2442] flex items-center justify-center hover:scale-105 transition-transform">
              <Heart className="h-4 w-4 text-white fill-white" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15" />

      {/* Middle: links + service */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="grid grid-cols-3 gap-6">
            {COLS.map(([title, links]) => (
              <div key={title}>
                <h4 className="font-bold text-sm mb-4">{title}</h4>
                <ul className="space-y-2.5 text-[13px] text-white/85">
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

          <div className="flex flex-col sm:flex-row gap-5 lg:justify-end">
            <div className="flex items-start gap-4 bg-white/10 rounded-2xl p-4">
              <div className="text-center shrink-0">
                <div className="bg-white rounded-xl p-1.5">
                  <img src="/wechat-qr.png" alt="客服 QR" className="h-24 w-24" />
                </div>
                <div className="text-[11px] text-white/80 mt-2">微信掃一掃關注公眾號</div>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/90">7*24 小時線上客服</span>
                  <Link to="/" data-testid="footer-cs-btn" className="text-xs font-bold bg-white text-[#E8792A] rounded-full px-3 py-1 hover:bg-orange-50">網路客服</Link>
                </div>
                <div className="text-sm text-white/90">微信 24 小時客服：<span className="font-semibold">CS-KA-CS</span></div>
                <div className="flex items-center gap-1.5">
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

      {/* Bottom bar */}
      <div className="bg-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <img src="/gogo589-logo.png" alt="gogo589" className="h-6 w-auto opacity-80" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="text-[11px] text-white/70">© 2015-2026 gogo589.com 版權所有，並保留所有權利</span>
          </div>
          <div className="text-[11px] text-white/55 md:text-right leading-relaxed">
            <div>Element colors Electronic Entertainment Limited · 本站為示範項目，支付為測試模式</div>
            <div>Address: 19H MAXGRAND PLAZA NO. 3 TAI YAU STREET SAN PO KONG KL, Hong Kong</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
