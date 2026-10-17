// 前台页面文案默认值（与 backend/site_copy.py 保持一致），后台「页面文案」可覆盖
export const DEFAULT_COPY = {
  compliance_badges: ["平台不收取任何费用", "不承诺收益", "正规合规项目"],
  nav: { home: "首页", projects: "项目中心", news: "新闻动态", cooperation: "合作共赢", about: "关于我们", contact: "联系我们", kefu: "联系客服" },
  home: {
    hero_tag: "HEYING PROJECT CLUB",
    hero_title1: "合赢项目社",
    hero_title2: "聚力项目，合作共赢",
    hero_subtitle: "招募团队长，平台提供优质稳定项目。专业项目审核、评估、整合，每月新项目海鸥官方群内同步分享。",
    hero_btn_primary: "浏览项目",
    hero_btn_secondary: "加入合作",
    services_title: "优质项目推荐",
    services_subtitle: "四大核心服务，构建项目合作全链路",
    services: [
      { tag: "项目发布", title: "绿色能源合作项目", desc: "汇聚光伏、储能、充电桩等绿色能源优质项目，严选审核，长期价值清晰可见。", img: "/images/ui/service-publish.webp" },
      { tag: "资源对接", title: "社群共建项目", desc: "为项目方精准匹配资金、渠道与团队伙伴，高效撮合，全程跟进对接进度。", img: "/images/ui/service-link.webp" },
      { tag: "社群共建", title: "资源对接平台项目", desc: "开放本地社群与团长席位，共建活跃商业社群，共享平台流量与资源红利。", img: "/images/ui/service-community.webp" },
      { tag: "合作落地", title: "新项目推荐", desc: "客服团队全程护航合作落地，从意向对接到签约执行，一站式陪伴成长。", img: "/images/ui/service-deal.webp" },
    ],
    projects_title: "精选合作项目",
    projects_subtitle: "严选优质项目，真实可靠，持续更新",
    projects_btn: "查看全部项目",
    edges_title: "我们的优势",
    edges_subtitle: "专业审核 · 稳定供给 · 每月分享 · 专属对接",
    cta_title: "准备好加入合作了吗？",
    cta_desc: "联系客服获取团长入驻与项目合作详情，工作时间 9:00 - 21:00 全程在线。",
    cta_btn: "立即联系客服",
  },
  cooperation: {
    title: "合作共赢",
    subtitle: "招募团队长 · 平台提供优质项目 · 每月新项目群内分享",
    steps_title: "合作模式",
    steps_subtitle: "四步闭环，从发布到落地全程护航",
    steps: [
      { title: "项目审核", desc: "专业机制层层审核" },
      { title: "项目评估", desc: "全面评估项目价值" },
      { title: "项目整合", desc: "整合优质资源项目" },
      { title: "合作落地", desc: "团队对接稳定落地" },
    ],
    tiers_title: "团队协作激励",
    tiers_subtitle: "团队协作成长 · 多劳多得 · 具体以正式合作协议为准",
    tier_level_label: "协作激励层级",
    tiers_disclaimer: "团队协作激励与团队规模、运营情况相关，多劳多得，不构成任何收益承诺，具体权益以正式合作协议为准。",
    modes_title: "合作方式",
    modes_subtitle: "三种身份，总有一个适合你",
    modes: [
      { title: "团长合作", desc: "招募团队长，平台提供优质项目，共建团队协作成长", points: ["专属城市团长席位", "平台优质项目直供", "团队协作激励机制", "新项目每月群内分享"] },
      { title: "项目方合作", desc: "提交项目信息，获取对接机会与社群曝光", points: ["项目免费上架展示", "精准匹配资金渠道", "百人社群同步曝光", "客服一对一跟进"] },
      { title: "资源方合作", desc: "提供资金、渠道、技术或服务资源", points: ["优质项目优先对接", "资源价值高效变现", "平台信用背书保障", "长期战略合作机制"] },
    ],
    apply_btn: "申请合作",
    adv_title: "合作优势",
    adv_subtitle: "为什么选择合赢项目社",
    advantages: [
      { title: "平台项目资源", desc: "严选项目库持续更新，覆盖多行业赛道", img: "/images/ui/adv-resources.webp" },
      { title: "社群协作体系", desc: "成熟社群网络，信息高效流转共享", img: "/images/ui/adv-network.webp" },
      { title: "客服全程对接", desc: "专业客服团队，合作全程跟进护航", img: "/images/ui/adv-service.webp" },
      { title: "高效信息匹配", desc: "需求快速响应，精准撮合合作双方", img: "/images/ui/adv-match.webp" },
    ],
    cta_title: "联系客服加入团长",
    cta_btn: "在线咨询",
  },
  about: {
    title: "关于我们",
    subtitle: "聚力项目，合作共赢",
    intro_title: "平台简介",
    intro_image: "/images/ui/about-intro.webp",
    intro: [
      "合赢项目社专注优质项目资源对接，主要面向全国招募团队长。团队通过专业的项目审核、项目评估、项目整合，为团队长提供稳定可靠的优质项目。",
      "平台每月在海鸥官方群内分享最新项目，团队长带领团队协作发展，多劳多得。我们相信，好的项目值得被更多人看见，合赢项目社让每一次合作都有迹可循、有始有终。",
    ],
    values_title: "平台价值观",
    values_subtitle: "开放 · 可信 · 共赢",
    values: [
      { title: "开放", desc: "开放项目信息与合作机会，让每一位伙伴都能平等触达优质资源。", img: "/images/ui/value-open.webp" },
      { title: "可信", desc: "重视资源真实与对接效率，项目层层审核，信息透明可查。", img: "/images/ui/value-trust.webp" },
      { title: "共赢", desc: "推动伙伴共同成长，构建长期稳定、互利共赢的合作生态。", img: "/images/ui/value-win.webp" },
    ],
    milestones_title: "平台发展历程",
    milestones_subtitle: "一步一个脚印，与合作伙伴共同成长",
  },
  contact: {
    title: "联系我们",
    subtitle: "客服团队为您提供项目合作咨询",
    info_title: "联系方式",
    mp_hint: "微信扫码关注，获取最新项目",
    consult_btn: "在线咨询",
    form_title: "在线留言",
    submit_btn: "提交咨询",
    form_note: "咨询信息将进入后台管理系统，由客服人员及时跟进处理。",
  },
  footer: {
    description: "专注优质项目资源对接、社群交流与商业合作，连接项目、资金、渠道与团队伙伴。",
    copyright: "© 2026 合赢项目社 HEYING PROJECT CLUB · 聚力项目，合作共赢",
    icp: "桂ICP备2026019806号-2",
    icp_link: "https://beian.miit.gov.cn/",
  },
};

// 按一级分区浅合并，保证后端缺字段时前台仍有默认文案
export const mergeCopy = (remote) => {
  if (!remote) return DEFAULT_COPY;
  const out = { ...DEFAULT_COPY, ...remote };
  for (const k of Object.keys(DEFAULT_COPY)) {
    if (DEFAULT_COPY[k] && !Array.isArray(DEFAULT_COPY[k]) && typeof DEFAULT_COPY[k] === "object") {
      out[k] = { ...DEFAULT_COPY[k], ...(remote[k] || {}) };
    }
  }
  return out;
};
