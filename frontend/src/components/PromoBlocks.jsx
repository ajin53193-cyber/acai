import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toFullUrl } from "@/components/ImageUpload";

export const isExternal = (link) => /^https?:\/\//i.test(link || "");

export const Block = ({ block, index }) => {
  if (block.type === "heading") {
    return (
      <h2 className="mt-8 border-l-4 border-[#D4AF37] pl-3 text-lg font-bold text-slate-900 md:text-xl" data-testid={`promo-block-${index}`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "image") {
    return (
      <figure className="mt-5" data-testid={`promo-block-${index}`}>
        <img src={toFullUrl(block.image)} alt={block.text || `图 ${index + 1}`} loading="lazy" decoding="async" className="w-full rounded-xl border border-slate-200 shadow-sm" />
        {block.text && <figcaption className="mt-2 text-center text-xs text-slate-500">{block.text}</figcaption>}
      </figure>
    );
  }
  if (block.type === "button") {
    const cls = "mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FFE896] to-[#D4AF37] py-3.5 text-sm font-bold text-[#1B1403] shadow-[0_6px_20px_rgba(212,175,55,0.35)] transition-transform active:scale-[0.98]";
    return isExternal(block.link) ? (
      <a href={block.link} target="_blank" rel="noopener noreferrer" className={cls} data-testid={`promo-block-${index}`}>
        {block.text} <ArrowRight size={16} />
      </a>
    ) : (
      <Link to={block.link || "/"} className={cls} data-testid={`promo-block-${index}`}>
        {block.text} <ArrowRight size={16} />
      </Link>
    );
  }
  return (
    <div className="mt-4 space-y-3" data-testid={`promo-block-${index}`}>
      {(block.text || "").split("\n").filter((p) => p.trim()).map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-slate-700">{p}</p>
      ))}
    </div>
  );
};

