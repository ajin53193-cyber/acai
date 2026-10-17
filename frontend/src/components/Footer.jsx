import { Link } from "react-router-dom";
import { Clock, Mail, Phone, MessageCircle, ShieldCheck } from "lucide-react";
import { LogoFull } from "@/components/Logo";
import { useSettings } from "@/lib/useSettings";

const FOOTER_LINKS = [
  { key: "projects", path: "/projects" },
  { key: "news", path: "/news" },
  { key: "cooperation", path: "/cooperation" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
];

export const Footer = () => {
  const { contact, copy } = useSettings();
  const f = copy.footer;

  return (
    <footer data-testid="site-footer" className="border-t border-amber-500/15 bg-[#080E1F]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-8 md:grid-cols-3 md:py-14 lg:px-16">
        <div className="space-y-4">
          <LogoFull />
          <p className="max-w-xs text-sm leading-relaxed text-slate-400">{f.description}</p>
        </div>

        <div>
          <h4 className="mb-4 font-display text-base font-bold text-[#E5C158]">快速导航</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            {FOOTER_LINKS.map((l) => (
              <li key={l.key}>
                <Link data-testid={`footer-${l.key}-link`} className="transition-colors hover:text-[#FFE896]" to={l.path}>
                  {copy.nav[l.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-display text-base font-bold text-[#E5C158]">联系方式</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2.5" data-testid="footer-hours">
              <Clock size={15} className="text-[#D4AF37]" /> 工作时间：{contact.hours}
            </li>
            <li className="flex items-center gap-2.5" data-testid="footer-email">
              <Mail size={15} className="text-[#D4AF37]" /> 邮箱：{contact.email}
            </li>
            {contact.hotline && (
              <li className="flex items-center gap-2.5" data-testid="footer-hotline">
                <Phone size={15} className="text-[#D4AF37]" /> 电话：<a href={`tel:${contact.hotline}`} className="hover:text-[#FFE896]">{contact.hotline}</a>
              </li>
            )}
            {contact.wechat && (
              <li className="flex items-center gap-2.5" data-testid="footer-wechat">
                <MessageCircle size={15} className="text-[#D4AF37]" /> 微信：{contact.wechat}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-amber-500/10 py-5 pb-24 text-center text-xs text-slate-500 lg:pb-5">
        {copy.compliance_badges.length > 0 && (
          <div className="mb-3 flex items-center justify-center gap-1.5 text-[#D4AF37]/80" data-testid="footer-compliance-badge">
            <ShieldCheck size={13} /> {copy.compliance_badges.join(" · ")}
          </div>
        )}
        <div>{f.copyright}</div>
        {f.icp && (
          <a
            href={f.icp_link || "https://beian.miit.gov.cn/"}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-icp-link"
            className="mt-2 inline-block text-slate-600 transition-colors hover:text-slate-400"
          >
            {f.icp}
          </a>
        )}
      </div>
    </footer>
  );
};
