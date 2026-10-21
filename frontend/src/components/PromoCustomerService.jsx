import { Headphones } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/useSettings";

const JOIN_BANNER_IMG = "https://customer-assets-v7afamib.emergentagent.net/job_corporate-web-95/artifacts/d144b05e42c9942b_image.webp";

// 三张含金色按钮的横幅图：图保持静态，按钮做成动态可点，叠在图里原按钮位置上。
// key 为图片 URL 中的唯一片段；pos 为按钮在图中的占比位置（覆盖图里画的金色按钮）。
const BANNER_CTAS = {
  "d144b05e": { text: "立即加入", font: "3cqw", pos: { left: "71.5%", top: "79.5%", width: "25.5%", height: "16%" } },
  "e2456e9f": { text: "立即加入", font: "3cqw", pos: { left: "74%", top: "81.5%", width: "20.5%", height: "12.5%" } },
  "856cc85c": { text: "了解项目详情", font: "2.4cqw", pos: { left: "78%", top: "49.5%", width: "19.5%", height: "13.5%" } },
};

export const bannerCtaForImage = (url = "") => {
  for (const key in BANNER_CTAS) if (url.includes(key)) return BANNER_CTAS[key];
  return null;
};

const openCs = (url) => {
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
        <button
          type="button"
          onClick={() => openCs(url)}
          data-testid="promo-action-cta"
          className="promo-cta-animate absolute flex items-center justify-center whitespace-nowrap rounded-full font-extrabold leading-none text-[#3B2A06] transition-transform active:scale-95"
          style={{
            ...cta.pos,
            fontSize: `clamp(8px, ${cta.font}, 16px)`,
            background: "linear-gradient(180deg,#FBE38C 0%,#E9C45A 42%,#CB9A2C 100%)",
            border: "1.5px solid #F6DF93",
          }}
        >
          {cta.text}
        </button>
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

  const open = () => openCs(url);

  return (
    <>
      <div className="mt-10 flex justify-center" data-testid="promo-cs-center-wrap">
        <button
          type="button"
          onClick={open}
          data-testid="promo-cs-button"
          className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FFE896] px-8 py-3.5 text-base font-bold text-[#1B1403] shadow-[0_6px_20px_rgba(212,175,55,0.4)] transition-transform duration-200 hover:scale-[1.03] active:scale-95"
        >
          <Headphones size={20} /> 联系客服
        </button>
      </div>

      <button
        type="button"
        onClick={open}
        aria-label="联系客服"
        data-testid="promo-cs-float"
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FFE896] text-[#1B1403] shadow-[0_0_24px_rgba(212,175,55,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Headphones size={24} />
      </button>
    </>
  );
};
