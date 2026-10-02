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
  },
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
