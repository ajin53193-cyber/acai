"""前台页面文案配置（后台「页面文案」可编辑）。所有默认值与 frontend/src/lib/defaultCopy.js 保持一致。"""
from typing import List

from pydantic import BaseModel, Field


class NavCopy(BaseModel):
    home: str = Field(default="首页", max_length=20)
    projects: str = Field(default="项目中心", max_length=20)
    news: str = Field(default="新闻动态", max_length=20)
    cooperation: str = Field(default="合作共赢", max_length=20)
    about: str = Field(default="关于我们", max_length=20)
    contact: str = Field(default="联系我们", max_length=20)
    kefu: str = Field(default="联系客服", max_length=20)


class CardItem(BaseModel):
    tag: str = Field(default="", max_length=30)
    title: str = Field(default="", max_length=60)
    desc: str = Field(default="", max_length=300)
    img: str = Field(default="", max_length=500)
    points: List[str] = Field(default_factory=list)


DEFAULT_SERVICES = [
    {"tag": "项目发布", "title": "绿色能源合作项目", "desc": "汇聚光伏、储能、充电桩等绿色能源优质项目，严选审核，长期价值清晰可见。", "img": "/images/ui/service-publish.webp"},
    {"tag": "资源对接", "title": "社群共建项目", "desc": "为项目方精准匹配资金、渠道与团队伙伴，高效撮合，全程跟进对接进度。", "img": "/images/ui/service-link.webp"},
    {"tag": "社群共建", "title": "资源对接平台项目", "desc": "开放本地社群与团长席位，共建活跃商业社群，共享平台流量与资源红利。", "img": "/images/ui/service-community.webp"},
    {"tag": "合作落地", "title": "新项目推荐", "desc": "客服团队全程护航合作落地，从意向对接到签约执行，一站式陪伴成长。", "img": "/images/ui/service-deal.webp"},
]


class HomeCopy(BaseModel):
    hero_tag: str = Field(default="HEYING PROJECT CLUB", max_length=40)
    hero_title1: str = Field(default="合赢项目社", max_length=30)
    hero_title2: str = Field(default="聚力项目，合作共赢", max_length=30)
    hero_subtitle: str = Field(default="招募团队长，平台提供优质稳定项目。专业项目审核、评估、整合，每月新项目海鸥官方群内同步分享。", max_length=200)
    hero_btn_primary: str = Field(default="浏览项目", max_length=20)
    hero_btn_secondary: str = Field(default="加入合作", max_length=20)
    services_title: str = Field(default="优质项目推荐", max_length=30)
    services_subtitle: str = Field(default="四大核心服务，构建项目合作全链路", max_length=80)
    services: List[CardItem] = Field(default_factory=lambda: [CardItem(**s) for s in DEFAULT_SERVICES])
    projects_title: str = Field(default="精选合作项目", max_length=30)
    projects_subtitle: str = Field(default="严选优质项目，真实可靠，持续更新", max_length=80)
    projects_btn: str = Field(default="查看全部项目", max_length=20)
    edges_title: str = Field(default="我们的优势", max_length=30)
    edges_subtitle: str = Field(default="专业审核 · 稳定供给 · 每月分享 · 专属对接", max_length=80)
    cta_title: str = Field(default="准备好加入合作了吗？", max_length=40)
    cta_desc: str = Field(default="联系客服获取团长入驻与项目合作详情，工作时间 9:00 - 21:00 全程在线。", max_length=200)
    cta_btn: str = Field(default="立即联系客服", max_length=20)


DEFAULT_STEPS = [
    {"title": "项目审核", "desc": "专业机制层层审核"},
    {"title": "项目评估", "desc": "全面评估项目价值"},
    {"title": "项目整合", "desc": "整合优质资源项目"},
    {"title": "合作落地", "desc": "团队对接稳定落地"},
]
DEFAULT_MODES = [
    {"title": "团长合作", "desc": "招募团队长，平台提供优质项目，共建团队协作成长", "points": ["专属城市团长席位", "平台优质项目直供", "团队协作激励机制", "新项目每月群内分享"]},
    {"title": "项目方合作", "desc": "提交项目信息，获取对接机会与社群曝光", "points": ["项目免费上架展示", "精准匹配资金渠道", "百人社群同步曝光", "客服一对一跟进"]},
    {"title": "资源方合作", "desc": "提供资金、渠道、技术或服务资源", "points": ["优质项目优先对接", "资源价值高效变现", "平台信用背书保障", "长期战略合作机制"]},
]
DEFAULT_ADVANTAGES = [
    {"title": "平台项目资源", "desc": "严选项目库持续更新，覆盖多行业赛道", "img": "/images/ui/adv-resources.webp"},
    {"title": "社群协作体系", "desc": "成熟社群网络，信息高效流转共享", "img": "/images/ui/adv-network.webp"},
    {"title": "客服全程对接", "desc": "专业客服团队，合作全程跟进护航", "img": "/images/ui/adv-service.webp"},
    {"title": "高效信息匹配", "desc": "需求快速响应，精准撮合合作双方", "img": "/images/ui/adv-match.webp"},
]


class CooperationCopy(BaseModel):
    title: str = Field(default="合作共赢", max_length=30)
    subtitle: str = Field(default="招募团队长 · 平台提供优质项目 · 每月新项目群内分享", max_length=120)
    steps_title: str = Field(default="合作模式", max_length=30)
    steps_subtitle: str = Field(default="四步闭环，从发布到落地全程护航", max_length=80)
    steps: List[CardItem] = Field(default_factory=lambda: [CardItem(**s) for s in DEFAULT_STEPS])
    tiers_title: str = Field(default="团队协作激励", max_length=30)
    tiers_subtitle: str = Field(default="团队协作成长 · 多劳多得 · 具体以正式合作协议为准", max_length=80)
    tier_level_label: str = Field(default="协作激励层级", max_length=20)
    tiers_disclaimer: str = Field(default="团队协作激励与团队规模、运营情况相关，多劳多得，不构成任何收益承诺，具体权益以正式合作协议为准。", max_length=300)
    modes_title: str = Field(default="合作方式", max_length=30)
    modes_subtitle: str = Field(default="三种身份，总有一个适合你", max_length=80)
    modes: List[CardItem] = Field(default_factory=lambda: [CardItem(**m) for m in DEFAULT_MODES])
    apply_btn: str = Field(default="申请合作", max_length=20)
    adv_title: str = Field(default="合作优势", max_length=30)
    adv_subtitle: str = Field(default="为什么选择合赢项目社", max_length=80)
    advantages: List[CardItem] = Field(default_factory=lambda: [CardItem(**a) for a in DEFAULT_ADVANTAGES])
    cta_title: str = Field(default="联系客服加入团长", max_length=40)
    cta_btn: str = Field(default="在线咨询", max_length=20)


DEFAULT_VALUES = [
    {"title": "开放", "desc": "开放项目信息与合作机会，让每一位伙伴都能平等触达优质资源。", "img": "/images/ui/value-open.webp"},
    {"title": "可信", "desc": "重视资源真实与对接效率，项目层层审核，信息透明可查。", "img": "/images/ui/value-trust.webp"},
    {"title": "共赢", "desc": "推动伙伴共同成长，构建长期稳定、互利共赢的合作生态。", "img": "/images/ui/value-win.webp"},
]


class AboutCopy(BaseModel):
    title: str = Field(default="关于我们", max_length=30)
    subtitle: str = Field(default="聚力项目，合作共赢", max_length=120)
    intro_title: str = Field(default="平台简介", max_length=30)
    intro_image: str = Field(default="/images/ui/about-intro.webp", max_length=500)
    intro: List[str] = Field(default_factory=lambda: [
        "合赢项目社专注优质项目资源对接，主要面向全国招募团队长。团队通过专业的项目审核、项目评估、项目整合，为团队长提供稳定可靠的优质项目。",
        "平台每月在海鸥官方群内分享最新项目，团队长带领团队协作发展，多劳多得。我们相信，好的项目值得被更多人看见，合赢项目社让每一次合作都有迹可循、有始有终。",
    ])
    values_title: str = Field(default="平台价值观", max_length=30)
    values_subtitle: str = Field(default="开放 · 可信 · 共赢", max_length=80)
    values: List[CardItem] = Field(default_factory=lambda: [CardItem(**v) for v in DEFAULT_VALUES])
    milestones_title: str = Field(default="平台发展历程", max_length=30)
    milestones_subtitle: str = Field(default="一步一个脚印，与合作伙伴共同成长", max_length=80)


class ProjectsCopy(BaseModel):
    title: str = Field(default="项目中心", max_length=30)
    subtitle: str = Field(default="汇聚优质资源 · 精准对接合作", max_length=120)
    gate_title: str = Field(default="项目详情已在官方交流群内分享", max_length=60)
    gate_desc: str = Field(default="完整项目资料、合作细则与最新进展均在官方交流群内同步发布，加入群聊即可查看并与客服一对一沟通。", max_length=300)
    gate_btn: str = Field(default="加入官方交流群", max_length=20)
    gate_secondary_btn: str = Field(default="咨询客服", max_length=20)


class ContactCopy(BaseModel):
    title: str = Field(default="联系我们", max_length=30)
    subtitle: str = Field(default="客服团队为您提供项目合作咨询", max_length=120)
    info_title: str = Field(default="联系方式", max_length=30)
    mp_hint: str = Field(default="微信扫码关注，获取最新项目", max_length=60)
    consult_btn: str = Field(default="在线咨询", max_length=20)
    form_title: str = Field(default="在线留言", max_length=30)
    submit_btn: str = Field(default="提交咨询", max_length=20)
    form_note: str = Field(default="咨询信息将进入后台管理系统，由客服人员及时跟进处理。", max_length=200)


class FooterCopy(BaseModel):
    description: str = Field(default="专注优质项目资源对接、社群交流与商业合作，连接项目、资金、渠道与团队伙伴。", max_length=200)
    copyright: str = Field(default="© 2026 合赢项目社 HEYING PROJECT CLUB · 聚力项目，合作共赢", max_length=120)
    icp: str = Field(default="桂ICP备2026019806号-2", max_length=60)
    icp_link: str = Field(default="https://beian.miit.gov.cn/", max_length=300)


class SiteCopy(BaseModel):
    compliance_badges: List[str] = Field(default_factory=lambda: ["平台不收取任何费用", "不承诺收益", "正规合规项目"])
    nav: NavCopy = NavCopy()
    home: HomeCopy = HomeCopy()
    cooperation: CooperationCopy = CooperationCopy()
    about: AboutCopy = AboutCopy()
    projects: ProjectsCopy = ProjectsCopy()
    contact: ContactCopy = ContactCopy()
    footer: FooterCopy = FooterCopy()
