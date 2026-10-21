import axios from "axios";
import { API } from "@/lib/api";
import { getSource, getVisitorId } from "@/lib/source";

// 当前正在浏览的推文 slug（单页同一时刻只有一篇），供按钮点击埋点使用
let currentSlug = "";

const send = (slug, type, target) => {
  if (!slug) return;
  axios
    .post(`${API}/promos/${slug}/hit`, {
      type,
      target: target || "",
      source: getSource(),
      referrer: document.referrer || "",
      visitor_id: getVisitorId(),
    })
    .catch(() => {});
};

// 推文打开时上报一次浏览（含来源渠道 ?from= 与 referrer 来源网站）
// 防止 StrictMode/重渲染导致同一次打开重复上报：同一 slug 2 秒内只记一次。
let lastView = { slug: "", at: 0 };
export const trackPromoView = (slug) => {
  currentSlug = slug;
  const now = Date.now();
  if (lastView.slug === slug && now - lastView.at < 2000) return;
  lastView = { slug, at: now };
  send(slug, "view");
};

// 引导按钮点击埋点：立即加入 / 了解项目详情 / 联系客服 / 悬浮客服
export const trackPromoClick = (target) => send(currentSlug, "click", target);
