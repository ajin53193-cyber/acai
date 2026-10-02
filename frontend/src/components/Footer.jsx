import { Link } from "react-router-dom";
import { Phone, MessageCircle, Clock, Mail } from "lucide-react";
import { LogoFull } from "@/components/Logo";

export const Footer = () => (
  <footer data-testid="site-footer" className="border-t border-amber-500/15 bg-[#080E1F]">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-3 lg:px-16">
      <div className="space-y-4">
        <LogoFull />
        <p className="max-w-xs text-sm leading-relaxed text-slate-400">
          专注优质项目资源对接、社群交流与商业合作，连接项目、资金、渠道与团队伙伴。
        </p>
      </div>

      <div>
        <h4 className="mb-4 font-display text-base font-bold text-[#E5C158]">快速导航</h4>
        <ul className="space-y-2.5 text-sm text-slate-400">
          <li><Link data-testid="footer-projects-link" className="transition-colors hover:text-[#FFE896]" to="/projects">项目中心</Link></li>
          <li><Link data-testid="footer-cooperation-link" className="transition-colors hover:text-[#FFE896]" to="/cooperation">合作共赢</Link></li>
          <li><Link data-testid="footer-about-link" className="transition-colors hover:text-[#FFE896]" to="/about">关于我们</Link></li>
          <li><Link data-testid="footer-contact-link" className="transition-colors hover:text-[#FFE896]" to="/contact">联系我们</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="mb-4 font-display text-base font-bold text-[#E5C158]">联系方式</h4>
        <ul className="space-y-3 text-sm text-slate-400">
          <li className="flex items-center gap-2.5" data-testid="footer-hotline">
            <Phone size={15} className="text-[#D4AF37]" /> 客服热线：400-888-6888
          </li>
          <li className="flex items-center gap-2.5" data-testid="footer-wechat">
            <MessageCircle size={15} className="text-[#D4AF37]" /> 微信客服：heyingkefu
          </li>
          <li className="flex items-center gap-2.5" data-testid="footer-hours">
            <Clock size={15} className="text-[#D4AF37]" /> 工作时间：9:00 - 21:00
          </li>
          <li className="flex items-center gap-2.5" data-testid="footer-email">
            <Mail size={15} className="text-[#D4AF37]" /> 邮箱：contact@heying.com
          </li>
        </ul>
      </div>
    </div>

    <div className="border-t border-amber-500/10 py-5 text-center text-xs text-slate-500">
      © 2026 合赢项目社 HEYING PROJECT CLUB · 聚力项目，合作共赢 ·{" "}
      <Link to="/admin" data-testid="footer-admin-link" className="transition-colors hover:text-[#E5C158]">
        管理后台
      </Link>
    </div>
  </footer>
);
