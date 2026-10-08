import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DEFAULT_SETTINGS = {
  contact: {
    hotline: "400-888-6888",
    wechat: "heyingkefu",
    hours: "9:00 - 21:00",
    email: "contact@heying.com",
  },
  team: [],
  stats: [
    { num: "36", suffix: "+", label: "优质项目" },
    { num: "120", suffix: "+", label: "合作伙伴" },
    { num: "80", suffix: "+", label: "行业动态" },
    { num: "30", suffix: "分钟内", label: "客服响应" },
  ],
  categories: ["绿色能源", "科技创新", "商业渠道", "实体产业"],
  chat: {
    welcome: "您好，欢迎来到合赢项目社！请描述您想咨询的问题，客服会尽快回复您。",
    welcome_tutorial_label: "查看最新项目",
    welcome_tutorial_link: "/tutorials/gift-card",
    welcome_group_label: "加入微信群",
    ai_enabled: true,
    qr_image: "",
    qr_codes: [],
    questions: [
      { text: "你们有什么项目？", image: "", answer: "平台每月发布安全稳定的优质项目，涵盖绿色能源、科技创新、商业渠道、实体产业等类别。您可以到「项目中心」查看在架项目详情，或扫码进群获取最新项目清单。" },
      { text: "怎么合作？", image: "", answer: "合作方式有团长合作、项目方合作、资源方合作。请扫描上方微信群二维码进群，或留下您的姓名和电话，人工客服会尽快与您一对一对接。" },
      { text: "收益怎么样？", image: "", answer: "团队收益参考：10人团队月入约2-3万元，20人团队约5-6万元，50人团队10万元以上。收益与团队运营情况相关，不构成收益承诺，具体以正式合作协议为准。" },
      { text: "怎么联系客服？", image: "", answer: "您可以直接在本窗口留言（请留下姓名和电话），人工客服会在工作时间 9:00-21:00 内尽快回复；也可以扫描上方二维码进群咨询。" },
    ],
  },
  tiers: [
    { count: "10人团队", income: "2-3万", featured: false },
    { count: "20人团队", income: "5-6万", featured: true },
    { count: "50人团队", income: "10万以上", featured: false },
  ],
  milestones: [
    { year: "2022", title: "平台创立", desc: "合赢项目社正式成立，确立“专业审核、稳定供给”的项目标准。" },
    { year: "2023", title: "团长体系上线", desc: "面向全国招募团队长，跑通项目审核、评估、整合全流程。" },
    { year: "2024", title: "项目库扩容", desc: "在架优质项目突破 30 个，覆盖绿色能源、科技创新、商业渠道、实体产业。" },
    { year: "2025", title: "服务升级", desc: "专属客服一对一护航机制上线，合作伙伴突破 100 家。" },
    { year: "2026", title: "全新升级", desc: "官网与 AI 在线客服系统全新上线，每月新项目在微信群内同步分享。" },
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
          team: [],
          stats: res.data.stats && res.data.stats.length ? res.data.stats : DEFAULT_SETTINGS.stats,
          categories: res.data.categories && res.data.categories.length ? res.data.categories : DEFAULT_SETTINGS.categories,
          chat: { ...DEFAULT_SETTINGS.chat, ...(res.data.chat || {}) },
          tiers: res.data.tiers && res.data.tiers.length ? res.data.tiers : DEFAULT_SETTINGS.tiers,
          edges: res.data.edges && res.data.edges.length ? res.data.edges : DEFAULT_SETTINGS.edges,
          milestones: res.data.milestones && res.data.milestones.length ? res.data.milestones : DEFAULT_SETTINGS.milestones,
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
