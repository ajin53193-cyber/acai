import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DEFAULT_SETTINGS = {
  contact: {
    hotline: "400-888-6888",
    wechat: "heyingkefu",
    hours: "9:00 - 21:00",
    email: "contact@heying.com",
  },
  team: [
    { role: "项目负责人", person: "陈志远", image: "https://images.unsplash.com/photo-1665224752561-85f4da9a5658?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
    { role: "合作负责人", person: "林嘉豪", image: "https://images.unsplash.com/photo-1665224752136-4dbe2dfc8195?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
    { role: "资源负责人", person: "周明轩", image: "https://images.unsplash.com/photo-1520689728498-7dd1a9814607?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
    { role: "运营负责人", person: "吴国强", image: "https://images.unsplash.com/photo-1665224751641-8ea911ca2267?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
    { role: "客服负责人", person: "许文博", image: "https://images.unsplash.com/photo-1665224752136-4dbe2dfc8195?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
    { role: "品牌负责人", person: "郑立诚", image: "https://images.unsplash.com/photo-1520689728498-7dd1a9814607?crop=entropy&cs=srgb&fm=jpg&q=85&w=400" },
  ],
  stats: [
    { num: "36", suffix: "+", label: "优质项目" },
    { num: "120", suffix: "+", label: "合作伙伴" },
    { num: "80", suffix: "+", label: "行业动态" },
    { num: "30", suffix: "分钟内", label: "客服响应" },
  ],
  categories: ["绿色能源", "科技创新", "商业渠道", "实体产业"],
  chat: {
    welcome: "您好，欢迎来到合赢项目社！请描述您想咨询的问题，客服会尽快回复您。",
    ai_enabled: false,
    qr_image: "",
    questions: [
      { text: "你们有什么项目？", image: "" },
      { text: "怎么合作？", image: "" },
      { text: "收益怎么样？", image: "" },
      { text: "怎么联系客服？", image: "" },
    ],
  },
  tiers: [
    { count: "10人团队", income: "2-3万", featured: false },
    { count: "20人团队", income: "5-6万", featured: true },
    { count: "50人团队", income: "10万以上", featured: false },
  ],
  edges: [
    { title: "专业项目审核", desc: "每个项目经过资质、模式、现金流三重审核评估，真实可靠才上架。", image: "/images/ui/edge-audit.webp" },
    { title: "稳定项目供给", desc: "团队对接资源项目，专业评估整合，为团队长持续输出稳定项目。", image: "/images/ui/edge-stable.webp" },
    { title: "每月项目分享", desc: "最新项目每月在群内同步分享，团队长第一时间掌握合作机会。", image: "/images/ui/edge-share.webp" },
    { title: "专属客服对接", desc: "一对一客服全程对接，工作时间 30 分钟内响应，合作全程护航。", image: "/images/ui/edge-service.webp" },
  ],
};

let cache = null;
let promise = null;

export const fetchSettings = () => {
  if (!promise) {
    promise = axios
      .get(`${API}/settings`)
      .then((res) => {
        cache = {
          contact: { ...DEFAULT_SETTINGS.contact, ...(res.data.contact || {}) },
          team: res.data.team && res.data.team.length ? res.data.team : DEFAULT_SETTINGS.team,
          stats: res.data.stats && res.data.stats.length ? res.data.stats : DEFAULT_SETTINGS.stats,
          categories: res.data.categories && res.data.categories.length ? res.data.categories : DEFAULT_SETTINGS.categories,
          chat: { ...DEFAULT_SETTINGS.chat, ...(res.data.chat || {}) },
          tiers: res.data.tiers && res.data.tiers.length ? res.data.tiers : DEFAULT_SETTINGS.tiers,
          edges: res.data.edges && res.data.edges.length ? res.data.edges : DEFAULT_SETTINGS.edges,
        };
        return cache;
      })
      .catch(() => DEFAULT_SETTINGS);
  }
  return promise;
};

export const getCachedSettings = () => cache || DEFAULT_SETTINGS;

export const invalidateSettings = () => {
  cache = null;
  promise = null;
};

export const formatDetail = (detail) => {
  if (!detail) return "操作失败，请稍后重试";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || "").filter(Boolean).join("；");
  return String(detail);
};
