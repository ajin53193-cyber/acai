import { Headphones } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/useSettings";

const JOIN_BANNER_IMG = "https://customer-assets-v7afamib.emergentagent.net/job_corporate-web-95/artifacts/d144b05e42c9942b_image.webp";

const openCs = (url) => {
  if (!url) {
    toast.info("客服链接待配置：请在后台「客服设置 → 第三方客服链接」填写");
    return;
  }
  window.open(url, "_blank", "noopener");
};

// 文章中部「立即加入」横幅，点击跳转第三方客服链接
export const JoinBanner = () => {
  const { chat } = useSettings();
  const url = (chat?.cs_url || "").trim();
  return (
    <button
      type="button"
      onClick={() => openCs(url)}
      data-testid="promo-join-banner"
      className="join-breath group relative mt-8 block w-full overflow-hidden rounded-2xl shadow-md"
    >
      <img src={JOIN_BANNER_IMG} alt="立即加入" loading="lazy" className="block w-full" />
      {/* 流光扫过 */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="join-shine absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </span>
      {/* 「立即加入」按钮柔和脉冲光晕 */}
      <span
        className="join-cta-glow pointer-events-none absolute rounded-full"
        style={{ right: "5.5%", bottom: "2%", width: "19.5%", height: "16%" }}
      />
    </button>
  );
};

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
