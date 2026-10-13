import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AddToHomeDialog } from "@/components/AddToHomeDialog";
import { useIsMobile } from "@/lib/useIsMobile";
import { tr } from "@/i18n";

const MOBILE_SLIDES = [
  { key: "promo", src: "/banners/detail-promo.png", alt: tr("低價氪金 戰力超神 神券在手 下單省最高 7%"), to: "/sign-up" },
  { key: "a2hs", src: "/banners/detail-a2hs.png", alt: tr("添加 GOGO589 到桌面 快捷下單超方便"), action: "a2hs" },
  { key: "register", src: "/banners/detail-register.jpg", alt: tr("註冊送新客優惠包 下單最高省 9%"), to: "/sign-up" },
];
const PC_SLIDES = [
  { key: "promo", src: "/banners/detail-promo-pc.png", alt: tr("低價氪金 戰力超神 神券在手 下單省最高 7%"), to: "/sign-up" },
  { key: "register", src: "/banners/detail-register-pc.png", alt: tr("註冊送新客優惠包 下單最高省 9%"), to: "/sign-up" },
];

export function DetailBannerCarousel() {
  const isMobile = useIsMobile();
  const SLIDES = isMobile ? MOBILE_SLIDES : PC_SLIDES;
  const [idx, setIdx] = useState(0);
  const [a2hs, setA2hs] = useState(false);

  useEffect(() => {
    setIdx(0);
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, [SLIDES]);

  return (
    <>
      <div className="mt-0 md:mt-4 relative overflow-hidden rounded-2xl md:rounded-[10px] aspect-[710/120] md:aspect-[1330/80]" data-testid="detail-banner-carousel">
        <div className="absolute inset-0 transition-transform duration-700 ease-in-out" style={{ transform: `translateY(-${idx * 100}%)` }}>
          {SLIDES.map((s, i) => {
            const cls = "block h-full w-full";
            const img = <img src={s.src} alt={s.alt} className="w-full h-full object-cover block" />;
            return (
              <div key={s.key} className="h-full w-full" style={{ position: "absolute", top: `${i * 100}%` }}>
                {s.action === "a2hs" ? (
                  <button type="button" data-testid={`detail-banner-${s.key}`} onClick={() => setA2hs(true)} className={cls}>{img}</button>
                ) : (
                  <Link to={s.to} data-testid={`detail-banner-${s.key}`} className={cls}>{img}</Link>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute right-2.5 bottom-2 flex flex-col gap-1" data-testid="detail-banner-dots">
          {SLIDES.map((s, i) => (
            <button key={s.key} aria-label={`banner ${i + 1}`} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-1.5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      </div>
      {a2hs && <AddToHomeDialog onClose={() => setA2hs(false)} />}
    </>
  );
}
