import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AddToHomeDialog } from "@/components/AddToHomeDialog";
import { useIsMobile } from "@/lib/useIsMobile";
import { useSiteConfig } from "@/lib/siteConfig";

export function DetailBannerCarousel() {
  const isMobile = useIsMobile();
  const cfg = useSiteConfig();
  const SLIDES = (isMobile ? cfg.detail_banners.mobile : cfg.detail_banners.pc).filter((s) => s.image);
  const [idx, setIdx] = useState(0);
  const [a2hs, setA2hs] = useState(false);

  useEffect(() => {
    setIdx(0);
    if (SLIDES.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, [SLIDES.length, isMobile]);

  if (SLIDES.length === 0) return null;

  return (
    <>
      <div className="mt-0 md:mt-4 relative overflow-hidden rounded-2xl md:rounded-[10px] aspect-[710/120] md:aspect-[1330/80]" data-testid="detail-banner-carousel">
        <div className="absolute inset-0 transition-transform duration-700 ease-in-out" style={{ transform: `translateY(-${idx * 100}%)` }}>
          {SLIDES.map((s, i) => {
            const cls = "block h-full w-full";
            const img = <img src={s.image} alt={s.alt || ""} className="w-full h-full object-cover block" />;
            const external = /^https?:\/\//.test(s.link || "");
            return (
              <div key={i} className="h-full w-full" style={{ position: "absolute", top: `${i * 100}%` }}>
                {s.action === "a2hs" ? (
                  <button type="button" data-testid={`detail-banner-${i}`} onClick={() => setA2hs(true)} className={cls}>{img}</button>
                ) : external ? (
                  <a href={s.link} target="_blank" rel="noreferrer" data-testid={`detail-banner-${i}`} className={cls}>{img}</a>
                ) : (
                  <Link to={s.link || "#"} data-testid={`detail-banner-${i}`} className={cls}>{img}</Link>
                )}
              </div>
            );
          })}
        </div>
        {SLIDES.length > 1 && (
          <div className="absolute right-2.5 bottom-2 flex flex-col gap-1" data-testid="detail-banner-dots">
            {SLIDES.map((s, i) => (
              <button key={i} aria-label={`banner ${i + 1}`} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-1.5 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        )}
      </div>
      {a2hs && <AddToHomeDialog onClose={() => setA2hs(false)} />}
    </>
  );
}
