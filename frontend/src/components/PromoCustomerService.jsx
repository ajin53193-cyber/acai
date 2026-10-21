import { Headphones } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/useSettings";
import { trackPromoClick } from "@/lib/promoTrack";

const JOIN_BANNER_IMG = "https://customer-assets-v7afamib.emergentagent.net/job_corporate-web-95/artifacts/d144b05e42c9942b_image.webp";

// 三张含金色按钮的横幅图：图保持静态，按钮做成动态可点，叠在图里原按钮位置上。
// key 为图片 URL 中的唯一片段；pos 为按钮在图中的占比位置（覆盖图里画的金色按钮）。target 为点击埋点标识。
const BANNER_CTAS = {
  "d144b05e": { text: "立即加入", target: "banner_join", pos: { left: "72.5%", top: "76%", width: "19%", height: "21%" } },
  "e2456e9f": { text: "立即加入", target: "recruit_join", pos: { left: "72%", top: "77%", width: "20%", height: "20%" } },
  "856cc85c": { text: "了解项目详情", target: "learn", pos: { left: "76.5%", top: "43%", width: "18%", height: "19%" } },
};

export const bannerCtaForImage = (url = "") => {
  for (const key in BANNER_CTAS) if (url.includes(key)) return BANNER_CTAS[key];
  return null;
};

const openCs = (url, target) => {
  if (target) trackPromoClick(target);
  if (!url) {
    toast.info("客服链接待配置：请在后台「客服设置 → 第三方客服链接」填写");
    return;
  }
  window.open(url, "_blank", "noopener");
};

// 通用：静态横幅图 + 叠在图里按钮位置上的动态金色按钮，点击跳转第三方客服链接
export const PromoActionBanner = ({ img, alt, cta, caption, className = "mt-5" }) => {
  const { chat } = useSettings();
  const url = (chat?.cs_url || "").trim();
  return (
    <figure className={className} data-testid="promo-action-banner">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm"
        style={{ containerType: "inline-size" }}
      >
        <img src={img} alt={alt || cta.text} loading="lazy" decoding="async" className="block w-full" />
        <span
          aria-hidden="true"
          className="promo-cta-animate pointer-events-none absolute rounded-full"
          style={{
            ...cta.pos,
            background: "radial-gradient(ellipse at center, rgba(255,221,130,.6) 0%, rgba(255,214,110,.28) 45%, rgba(255,214,110,0) 72%)",
            mixBlendMode: "screen",
          }}
        />
        <button
          type="button"
          onClick={() => openCs(url, cta.target)}
          aria-label={cta.text}
          data-testid="promo-action-cta"
          className="absolute bg-transparent"
          style={cta.pos}
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-base font-semibold text-slate-700 md:text-lg">{caption}</figcaption>
      )}
    </figure>
  );
};

// 文章中部「立即加入」横幅：静态图 + 动态「立即加入」按钮，点击跳转第三方客服链接
export const JoinBanner = () => (
  <PromoActionBanner img={JOIN_BANNER_IMG} alt="立即加入" cta={BANNER_CTAS["d144b05e"]} className="mt-8" />
);

// 推广页 / 工具页专用「联系客服」：跳转后台配置的第三方客服链接
export const PromoCustomerService = () => {
  const { chat } = useSettings();
  const url = (chat?.cs_url || "").trim();

  return (
    <>
      <div className="mt-10 flex justify-center" data-testid="promo-cs-center-wrap">
        <button
          type="button"
          onClick={() => openCs(url, "cs")}
          data-testid="promo-cs-button"
          className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FFE896] px-8 py-3.5 text-base font-bold text-[#1B1403] shadow-[0_6px_20px_rgba(212,175,55,0.4)] transition-transform duration-200 hover:scale-[1.03] active:scale-95"
        >
          <Headphones size={20} /> 联系客服
        </button>
      </div>

      <button
        type="button"
        onClick={() => openCs(url, "cs_float")}
        aria-label="联系客服"
        data-testid="promo-cs-float"
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FFE896] text-[#1B1403] shadow-[0_0_24px_rgba(212,175,55,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Headphones size={24} />
      </button>
    </>
  );
};
