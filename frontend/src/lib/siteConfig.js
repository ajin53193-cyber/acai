import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";

export const DEFAULT_CONFIG = {
  logo: { image: "/gogo589-logo.png" },
  top_promo: { enabled: true, image: "/banners/top-ai-promo.png", link: "https://www.dbto.ai/zh-CN?-affi-100506", alt: tr("最強 AI 免費試用，價格超實惠 立即體驗") },
  hero: {
    kicker: tr("(UTC+8) 限時活動"), title: tr("低價氪金 戰力超神"), subtitle: tr("神券在手 下單省最高"), highlight: "7%",
    pills: [{ label: tr("手遊"), link: "/category/games" }, { label: tr("端遊"), link: "/category/games" }, { label: tr("點卡官方速充"), link: "/category/pointcard" }],
    image: "https://static.prod-images.emergentagent.com/jobs/8c0ad436-0c2e-49bb-a5bb-0efc73c32f62/images/2ad58532ad0f875a0c9c030d9069119b5960735a7e1383d2f707ce6813e0bc05.jpeg",
  },
  announcement: { enabled: true, text: tr("gogo589 介面升級公告：全新繁中介面上線，人工極速發貨，祝您購物愉快！"), text_mobile: tr("gogo589 用戶界面升級公告"), link: "/article" },
  promo_banners: [
    { image: "https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/b55a2354a230f99b_image.png", link: "/sign-up", alt: tr("新版上線有禮 5% OFF") },
    { image: "https://customer-assets-39nsmqrw.emergentagent.net/job_crossborder-topup/artifacts/3673631df7a58fe1_image.png", link: "/article", alt: tr("精選活動合集 優惠一站搞定") },
  ],
  detail_banners: {
    mobile: [
      { image: "/banners/detail-promo.png", link: "/sign-up", action: "", alt: tr("低價氪金 戰力超神 神券在手 下單省最高 7%") },
      { image: "/banners/detail-a2hs.png", link: "", action: "a2hs", alt: tr("添加 GOGO589 到桌面 快捷下單超方便") },
      { image: "/banners/detail-register.jpg", link: "/sign-up", action: "", alt: tr("註冊送新客優惠包 下單最高省 9%") },
    ],
    pc: [
      { image: "/banners/detail-promo-pc.png", link: "/sign-up", action: "", alt: tr("低價氪金 戰力超神 神券在手 下單省最高 7%") },
      { image: "/banners/detail-register-pc.png", link: "/sign-up", action: "", alt: tr("註冊送新客優惠包 下單最高省 9%") },
    ],
  },
  features: {
    tagline: tr("全球應用內購服務"), mobile_image: "/banners/features-mobile.png",
    items: [
      { title: tr("正版安全"), desc: tr("涵蓋 500+ 款全球正版 APP 內購服務") },
      { title: tr("自動化極速出貨"), desc: tr("90% 以上產品及服務線上自動秒發") },
      { title: tr("7x24 多語言服務"), desc: tr("全世界線上呼叫中心提供服務") },
      { title: tr("天天平價折扣不停"), desc: tr("享受每日全類目產品特價促銷") },
      { title: tr("全球 APP 發行"), desc: tr("為 APP 開發者提供全球用戶發行服務") },
    ],
  },
  register: {
    enabled: true, percent: "9%", bar_text: tr("新用戶註冊最高領"), bar_suffix: tr("優惠券"), button: tr("立即註冊"),
    title: tr("新用戶註冊，最高領 9% 優惠券"), subtitle: tr("註冊即享首單優惠，海量正版 App 充值等你來！"), mobile_image: "/banners/register-mobile.png",
  },
};

let cache = null;
let pending = null;
const listeners = new Set();

export function loadSiteConfig(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending || force) {
    pending = publicApi.get("/site-config").then((r) => { cache = r.data; listeners.forEach((fn) => fn(cache)); return cache; }).finally(() => { pending = null; });
  }
  return pending;
}

export function useSiteConfig() {
  const [cfg, setCfg] = useState(cache || DEFAULT_CONFIG);
  useEffect(() => {
    listeners.add(setCfg);
    loadSiteConfig().catch(() => {});
    return () => listeners.delete(setCfg);
  }, []);
  return cfg;
}
