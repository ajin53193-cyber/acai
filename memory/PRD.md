# 合赢项目社官网 - PRD

## 原始需求
做一个公司官网网站。公司：合赢项目社（HEYING PROJECT CLUB），全中文。用户提供了 4 张 UI 参考图：深海军蓝 + 香槟金高端商务风，页面含首页 / 项目中心 / 合作共赢 / 关于我们 / 联系我们，联系表单提交进入后台管理系统。

## 技术架构
- 前端：React 19 + React Router 7 + Tailwind CSS + framer-motion + lenis（平滑滚动）+ sonner（Toast）+ lucide-react
- 后端：FastAPI + motor（MongoDB 异步驱动）
- 数据库：MongoDB（MONGO_URL / DB_NAME 环境变量）
- 认证：JWT Bearer（admin 后台，bcrypt 哈希，启动时播种，仅不存在时创建）

## 用户角色
- 访客：浏览页面、查看项目、提交合作咨询留言
- 管理员：登录 /admin 查看留言、更新跟进状态

## 核心需求（静态）
1. 五个中文页面 + 管理后台
2. 项目中心：分类筛选、搜索、项目详情弹窗、申请合作入口
3. 联系表单：姓名/电话/城市/咨询类型/留言内容，入库保存
4. 管理后台：JWT 登录、留言列表、状态管理（待跟进/跟进中/已完成）
5. 深蓝+金视觉、金色六边形「合」Logo（SVG，同作 favicon）、动效（遮罩标题揭示、跑马灯、视差轨道动效、滚动显现）

## 已实现（2026-07）
- 2026-07-02 全部五个页面 + /admin 后台上线预览环境
- 2026-07-02 移动端底部固定标签导航（首页/项目/合作 + 情境式金色客服按钮），移动端双列卡片布局
- 2026-07-02 管理后台升级为三版块：留言管理 / 项目管理（新建、编辑、上架、下架、删除，前台项目中心实时同步）/ 站点设置（客服热线、微信、工作时间、邮箱 + 核心团队成员姓名、职务、形象照链接，前台联系页、页脚、关于页实时同步）
- 2026-07-02 后台与前台完全分离（/admin 独立布局，无官网导航头/页脚/底栏）；图片直接上传（对象存储，团队形象照与项目封面均可本地上传，≤5MB，JPG/PNG/WEBP/GIF，经 /api/files 回源）
- 2026-07-02 全站 UI 配图：AI 生成 9 张深蓝+金 3D 视觉图（/app/frontend/public/images/ui/），接入首页四大服务卡、合作优势四卡、两处 CTA 横幅背景、合作流程底纹
- 2026-07-02 项目中心 9 个示例项目封面全部替换为同风格 AI 生成图（/app/frontend/public/images/projects/）
- 2026-07-02 新闻动态：/news 列表 + /news/:id 详情页，后台「新闻管理」支持发布/编辑/上下架/删除（配图直传）；共 14 篇文章，日期跨度 2022-06 至 2026-10，封面按主题匹配站内同风格 AI 图
- 2026-07-02 在线客服增强：后台「站点设置 → 在线客服」可配置欢迎语与 AI 自动回复开关（gpt-5.4，Emergent 通用密钥）；AI 回复带"AI客服"标识，人工可随时接管；AI 当前已开启，欢迎语为自定义文案；AI 知识库已接入：每次回复实时读取在架项目（名称/类别/区域/投入区间/状态/亮点），可准确回答具体项目问题
- 2026-07-02 真实业务模式落地：合作共赢页新增「团长收益体系」版块（10人团队月入2-3万 / 20人5-6万 / 50人10万以上，含合规免责说明）；合作流程改为 项目审核→项目评估→项目整合→合作落地；首页与关于页简介更新为"招募团队长、平台提供稳定项目、每月新项目微信群分享"；AI 客服知识库同步收益体系与业务信息
- 2026-07-02 上线主打项目「外区礼品卡合作项目」（收益稳定、项目合规，金色礼品卡 AI 配图）；微信群二维码功能：后台「站点设置 → 在线客服」可上传/更换二维码，访客在聊天窗询问"怎么加入/联系方式/人工"时自动发送二维码引导进群，联系我们页同步显示扫码进群区块（当前二维码为占位图，需上传真实群二维码）
- 2026-07-02 团长收益体系后台可编辑（站点设置 → 团长收益体系：团队规模/月入参考/热门标记，可增删档位），合作共赢页实时同步；项目主打功能：后台项目管理可设"主打"，主打项目在项目中心排第一位并带皇冠"主打"角标（外区礼品卡已设为主打）
- 2026-07-02 访问统计仪表盘：后台新增「访问统计」版块——按日期查询访问量/独立IP/覆盖地区/访问页面，近14天趋势柱状图、热门页面排行、访问明细表（时间/IP/IP归属地/页面）；前端每次页面切换自动上报（/admin 不计入），IP 地区经 ip-api 解析并缓存；设备/浏览器来源分析：上报时解析 UA（手机/平板/电脑、微信内置/Chrome/Safari/Edge/Firefox 等），仪表盘显示占比条；访问防刷：同一 IP 当天只计一次（按 IP+日期去重，visits 表索引）；首页新增「我们的优势」版块（专业项目审核/稳定项目供给/每月项目分享/专属客服对接，4 张同风格 AI 配图）；「我们的优势」版块后台可编辑（站点设置 → 我们的优势：标题/介绍/配图，可增删）
- 2026-07-02 手机端排版优化：首页服务卡紧凑化（小图/小字号/描述3行截断）、合作流程改为手机端横向条目式、首屏视觉缩小留白、全站手机端段落间距收紧、底部导航适配安全区
- 2026-07-02 手机端输入框防放大：全站 input/textarea/select 在 767px 以下强制 16px 字号，修复 iOS 点击输入框页面自动放大的问题（桌面端保持 14px）
- 2026-07-02 性能优化：全站 29 张 PNG（17MB）全部转为 WebP（共 1.7MB，缩小 90%），前端引用与数据库（项目封面/文章封面/优势配图）同步更新，手机打开速度大幅提升：首页服务卡紧凑化（小图/小字号/描述3行截断）、合作流程改为手机端横向条目式、首屏视觉缩小留白、全站手机端段落间距收紧、底部导航适配安全区
- 2026-07-02 平台数据（36+/120+/80+/30分钟内）可在后台「站点设置」直接增删改，首页首屏、首页数据条、关于页数据墙实时同步；关于我们页 UI 升级：平台简介卡与平台价值观三卡接入同风格 AI 配图（城市天际线、开放之门、信任之盾、共赢齿轮）；数据墙四卡升级：金色发光图标 + 顶部光束 + 奖台光晕 + 悬停浮起效果；数字滚动动画（进入可视区从 0 缓动递增到目标值，只播放一次，关于页数据墙 + 首页首屏统计均已接入，CountUp 组件复用）
- 2026-07-02 项目分类后台可增删（站点设置 → 项目分类），前台筛选标签与后台新建项目选项实时同步；全站移除客服电话与微信（联系我们页、页脚、合作共赢页 CTA、后台站点设置均仅保留工作时间与邮箱）
- 2026-07-03 全站去除「外区」表述：AI 客服提示词、数据库项目标题/简介、历史聊天记录中的「外区礼品卡」统一改为「礼品卡」，全库扫描确认零残留；AI 提示词同步新业务口径（平台每月发布安全稳定合法项目、不收取任何费用、引导团队长扫码进微信群）；AI 欢迎语下方新增「常见问题卡片」（默认4个：你们有什么项目？/怎么合作？/收益怎么样？/怎么联系客服？），点击即自动发送提问，发送首条消息后自动隐藏；问题卡片后台可编辑（站点设置 → 在线客服 → 常见问题卡片，可增删改，settings.chat.questions 字段）
- 2026-07-03 后台上传图片自动压缩转 WebP：/api/admin/upload 用 Pillow 处理（GIF 除外保留原格式），超大图自动缩到 1920px 内、quality=82 转 WebP，防止大图拖慢网站；requirements.txt 补 pillow==12.3.0
- 2026-07-03 问题卡片支持图文回复：questions 升级为 {text, image} 对象（后端 field_validator 兼容旧字符串格式），后台每个问题卡片可选配图；访客点击带配图的卡片时，后台自动发出该图（如项目海报/收益图）+ AI 文字回答
- 2026-07-03 手机端全站卡片一排 2 个：首页精选项目、项目中心、新闻列表、合作页（合作模式/收益体系/合作方式/合作优势）、关于页价值观全部由 1 列改为 2 列，并同步做手机端紧凑化（图片高度、角标、字号、内边距响应式缩小），桌面端布局不变
- 2026-07-03 收益海报配置：用 Canvas 绘制 900×1200 深蓝金「团长收益体系」海报（10人2-3万/20人5-6万热门/50人10万以上 + 每月发布项目·不收费卖点 + 免责声明），上传转 WebP 后配置为「收益怎么样？」问题卡片的配图，访客点击即看到月收入海报；聊天图片展示加宽（w-36 → 气泡全宽）
- 2026-07-03 问题卡片点击统计：访客消息命中问题卡片即落库（question_clicks 集合），新增 GET /api/admin/chat/question-stats（每问题总点击 + 近7天），后台「在线客服」顶部新增统计条，按点击量排序
- 2026-07-03 手机端高级感升级：首屏居中排版 + 顶部金色径向光晕（仅手机）、按钮与数据居中；版块标题两侧金色细线手机端可见；全站卡片增加 active:scale-[0.98] 触摸回弹反馈；副标题间距收紧
- 2026-07-03 国内访问提速：Google Fonts（Noto Sans/Serif SC）全部本地化——202 个 woff2 分片下载到 /public/fonts/ 并按 unicode-range 按需加载，index.html 移除 fonts.googleapis.com/gstatic 外链（该域在国内被墙，是页面加载慢的根因）；团队形象照从 Unsplash 换成本地 WebP（/public/images/team/，数据库 settings.team 与前端默认值同步）；实测页面零外部字体/图库请求。底部标签切页自动回顶部（lenis scrollTo immediate）已确认正常
- 2026-07-03 手机端滑动卡顿根治：① 手机端关闭全站 glass-card 的 backdrop-filter 毛玻璃（blur 18px × 几十张卡片是 GPU 卡顿主因），改用 92% 不透明度纯色底；② 大面积光晕模糊（blur 120/130px）手机端统一降到 40px；③ 触屏设备不再初始化 Lenis 平滑滚动（移除逐帧插值循环），用原生滚动。合作页「团长收益体系」「合作方式」两个板块按用户要求改为一行 3 个（图标/字号/按钮同步缩小），桌面端不变
- 2026-07-03 手机端背景统一：三个交替色版块（首页精选项目、合作方式、关于页价值观）的浅藏青底 #080E1F 改为仅桌面端（md:），手机端全页统一 #060B18；移除首页手机端顶部金色径向光晕；手机端顶栏/底部导航/汉堡菜单的毛玻璃一并去掉（纯色 #0A1228，省 GPU）；逐屏取色验证全页背景一致（仅页脚保留深色区分）
- 2026-07-03 修复：手机端页面标题区出现偏亮蓝色补丁（光晕降模糊后边缘硬化）——手机端光晕统一加 opacity 0.35 保持若有若无；「在线咨询/联系客服/立即联系客服」按钮（合作页 CTA、联系页、底部导航、首页 CTA）统一改为直接弹出在线客服聊天窗（hy:open-chat 全局事件），不再跳转页面
- 2026-07-07 应用户要求移除「核心团队」版块（示例头像+姓名，真实业务不适用）：关于我们页整节删除；后台「站点设置 → 核心团队」编辑卡片同步删除；前端默认值与本地团队照片（/public/images/team/）清理完毕，后端 settings.team 字段保留但不再使用
- 2026-07-07 Logo 重设计进行中：AI 生成 4 款候选（/public/images/logo-concepts/logo-1~4.webp：六合徽/双环/元宝/星盾），等用户选定后抠图透明化并替换全站 Logo + favicon
- 2026-07-07 关于页新增「平台发展历程」时间轴版块（金线+节点圆点+年份徽章，5 个默认节点 2022-2026），后台「站点设置 → 平台发展历程」可增删改（settings.milestones，MilestoneItem: year/title/desc）；用户确认阿里云自部署路径（域名已备案），DEPLOY_ALIYUN.md 已就绪；2026-07-07 已触发 redeploy 上线
- 2026-07-07 自定义域名 eztyv.com 上线：DNS 在聚名网（julydns，非阿里云），用户已加 4 条 A 记录（@/www → 162.159.142.117/172.66.2.113），平台侧 Domains 绑定完成、SSL 生效，https://eztyv.com 全站正常（项目10/文章14 已同步）；微信服务号物料已交付：头像（/images/logo-concepts/wechat-avatar.png 600×600）、功能介绍文案、被关注回复与关键词回复文案；页脚已挂备案号「桂ICP备2026019806号-2」（链接 beian.miit.gov.cn）
- 2026-07-07 用户决定**沿用现有金色六边形「合」SVG Logo**（4 款 AI 候选 logo-1~4.webp 弃用保留在 /public/images/logo-concepts/）
- 2026-07-07 用户已将代码 Docker 化部署到自有阿里云 ECS（eztyv.com）：AI 客服从 Emergent LLM 迁移至 DeepSeek API 直连（.env AI_API_KEY，绕过 GFW）；图片存储从 Emergent 对象存储迁移至本地磁盘（/api/files/upload → 本地保存，/api/files/{path} 回源，WebP 自动压缩保留）
- 2026-07-07 阿里云 3M 带宽白屏提速：873KB 的 fonts.css（808 个 @font-face 规则）改为异步加载（rel=preload + media=print onload 切换 + noscript 兜底）；font-display: swap 确认全覆盖（808/808）；nginx 已配 gzip(text/css) + /fonts/ 30 天 immutable 缓存 + /images/ 7 天缓存；测试代理前端验证 100% 通过（首屏无白屏、定制字体生效、15 图零破图、聊天窗/后台登录/移动端 375px 均正常，FCP ~972ms）；注意：修改 public/index.html 后预览环境需 supervisorctl restart frontend 生效，阿里云需重新 yarn build（docker compose up -d --build 自动完成）
- 2026-07-07 图片加载提速（用户服务器实为 5M 带宽）：①全站 30 张 UI/项目 WebP 由 1408px 降到 1080px q75（cta-banner 1200px q68），总体积 1703KB→881KB（省 49%），路径不变无需改库；②全站 img 补齐 loading="lazy" + decoding="async"（首页/合作页 CTA 背景、聊天图、联系页二维码、后台缩略图等 11 处），新闻详情封面保持 eager + fetchPriority="high"，项目弹窗图 eager + decoding async
- 2026-07-07 AI 客服修复：预览 backend/.env 补上 DeepSeek 三键（AI_BASE_URL=https://api.deepseek.com / AI_API_KEY=用户sk-a751...f05d / AI_MODEL=deepseek-chat，.env 已被 gitignore 不会泄露）；端到端实测 DeepSeek 3 秒返回基于项目知识库的准确回复 ✅。线上"AI 不回复"根因 = 服务器跑旧代码（git pull 显示 Already up to date，新代码未推送）+ 服务器 backend/.env 可能缺 AI 三键 + 后台 ai_enabled 开关需确认打开
- 2026-07-07 客服体验提速：ChatWidget 新增"AI客服 正在输入…"三点跳动指示器（发送后立即显示，收到回复自动消失，45s 超时兜底，仅 chat.ai_enabled 时触发）；轮询从固定 5s 改为等待回复时 2s、平时 5s
- 2026-07-07 微信群二维码主动推送（核心转化目标）：QR_KEYWORDS 扩充至 19 个（怎么合作/如何合作/合作方式/怎么加入/如何加入/怎么参与/如何参与/加入/加盟/代理/团长/联系方式/人工/微信/二维码/扫码/进群/加群），访客命中即秒推群二维码+进群引导文案；防重复：最近 5 条消息内已发过则不再发；文案从「微信服务号」全面改为「微信群」（推送文案、AI 提示词、联系我们页「官方微信群」、后台上传入口标签「微信群二维码」）；预览环境已重新上传测试二维码验证全链路（发「怎么合作」→2 秒内二维码弹出→AI 跟进引导进群）✅；测试脚本沉淀在 backend/tests/test_qr_trigger.py
- ⚠️ 注意：微信群二维码 7 天过期、满 200 人失效，需在后台定期重新上传（或换用活码工具）
- 2026-07-07 二维码防过期提醒：ChatConfig 新增 qr_updated_at 字段，PUT /admin/settings 检测到 qr_image 变更时自动打时间戳（未换码则保留旧时间）；后台「站点设置 → 在线客服 → 微信群二维码」下方显示上传时间与天数，≥5 天琥珀色预警、≥6 天红色警告「请立即换码」
- 2026-07-07 进群转化统计：每次二维码自动推送落库 qr_pushes 集合；新增 GET /api/admin/chat/qr-stats（今日/累计/近14天分桶，按 UTC+8 中国时间统计）；后台「在线客服」页顶部新增统计卡片（今日+累计数字 + 14 天金色柱状图，复用访问统计样式，15 秒自动刷新）
- 2026-07-07 CDN 指南：/app/CDN_ALIYUN.md（阿里云 CDN 添加域名→回源HOST→/api/ 不缓存 + /images//fonts/ 30 天缓存→HTTPS→聚名网 DNS 改 CNAME→验证 X-Cache→部署后需刷新缓存）
- 2026-07-07 活码管理（多群二维码）：ChatConfig 新增 qr_codes: List[QrCodeItem{image,label,uploaded_at,active}]；migrate_qr_codes/sync_active_qr 两个辅助函数保证旧单码数据自动迁移、qr_image 始终同步为当前启用码（全部停用则自动停止推送）；PUT settings 按 image 对比为新图打上传时间戳；后台「站点设置 → 在线客服」改为多码列表编辑器（每行：换图/群序号标签/启用开关/过期提醒/已推送次数，推送 ≥150 次琥珀色预警满员、≥180 次红色警告换群）；qr_pushes 记录 image+label，qr-stats 新增 by_image 分群统计
- 2026-07-07 访客来源追踪：新增 /frontend/src/lib/source.js（captureSource 从 URL ?from=/utm_source=/channel= 捕获到 sessionStorage 会话内持续携带，sourceLabel 映射 pyq→朋友圈/gzh→公众号/haibao→海报/xhs→小红书/dy→抖音等）；TrackInput/ChatStart 新增 source 字段；visits 与 chat_sessions 落库来源；stats overview 新增 sources 聚合（空值归入"直接访问"）；访问统计页新增「来源渠道占比」卡片（三列网格与设备/浏览器并列）；客服会话列表访客名旁显示来源标签（如"公众号"金色小标）
- 2026-07-07 渠道海报生成：后台新增「推广海报」页签（PosterAdmin.jsx，前端 Canvas 绘制 900×1200 深蓝金海报，yarn add qrcode 客户端生成二维码），预设 pyq/gzh/haibao/xhs/dy 五个渠道+自定义渠道代号，二维码内容自动带 ?from= 追踪参数，一键复制追踪链接、一键下载 PNG；注意：需在正式站后台生成，二维码才指向 eztyv.com
- 2026-07-07 新代码终于部署上线（Save to GitHub 成功 → git stash 收起服务器本地改动 → git pull → deploy.sh 真构建 116s ✅）；但 HTTPS 中断：443 无人监听（旧 SSL 配置在服务器本地 docker-compose.yml 里被 stash 收走，证书 /etc/letsencrypt/live/eztyv.com/ 仍在）
- 2026-07-07 HTTPS 永久内置到部署流程：新增 nginx-ssl.conf（80→301 跳 HTTPS + 443 ssl + http2 + ACME 续期路径，证书路径 /etc/letsencrypt/live/eztyv.com/）与 docker-compose.ssl.yml（443 映射 + letsencrypt 只读挂载 + ssl conf 挂载）；deploy.sh 自动检测证书存在则生成 docker-compose.override.yml 启用 HTTPS、否则仅 HTTP（新服务器零配置）；docker-compose.override.yml 已 gitignore；DEPLOY_ALIYUN.md 修正 HTTPS 章节（certbot standalone 申请 + pre/post-hook 自动续期 cron）。服务器上 stash 的 4 项本地改动已全部被仓库覆盖（阿里云 pip 镜像✓ npmmirror✓ 去 litellm✓ uploads 卷✓），可 git stash drop
- 2026-07-07 正式站"很慢很卡"根因定位与修复：实测 eztyv.com 仍跑旧代码（无 canonical 标签、og-cover 404、robots.txt 返回 SPA 壳、fonts.css 同步阻塞）；发现 index.html 第 42 行 emergent-main.js 为**同步阻塞境外脚本**+ PostHog（ap.emergent.sh）境外统计——国内访问会白屏等待加载/超时，是卡顿最大元凶。已改为仅 location.hostname 以 emergentagent.com 结尾时才加载（document.write 保持预览同步加载语义，PostHog 整段包 if），正式站零境外请求；预览环境验证 PostHog 仍正常加载、页面渲染无回归
- 2026-07-07 渠道效果对比：GET /api/admin/stats/channel-funnel?days=30（visits 按 source 聚合 + chat_sessions 按 source + qr_pushes 经 session_id 关联会话来源，三方交叉）；访问统计页新增对比表（渠道/访问/咨询/收码/访问→咨询率/访问→收码率，全链路转化率最高行自动标"最优"金徽章，除零显示"—"）
- 2026-07-07 海报模板多样化：PosterAdmin 重构为三模板——品牌邀请（原版）/ 团长收益（实时读取后台收益档位，热门档金框高亮+免责声明）/ 项目推广（下拉选择项目默认主打，标题自动换行+分类区域投入状态 meta+封面图金边横幅+亮点+二维码）；公共绘制件抽离（drawBase/drawDivider/drawQR/wrapText/drawCover）；下载文件名含模板与渠道
- 2026-07-07 进群转化漏斗：GET /api/admin/stats/funnel?days=14（visits 按 date 字段、chat_sessions/qr_pushes 按 created_at 转 UTC+8 分日聚合）；访问统计页新增漏斗卡片（访问→发起咨询→收到二维码 三级金条 + 步间转化率 + 近14天每日明细表）
- 2026-07-07 SEO 全套（按 farm-seo-setup 技能实施）：index.html 静态 head 补齐 canonical/robots/OG 全套/Twitter card/JSON-LD Organization（均用已确认域名 https://eztyv.com，og:image 为新生成的 1200×630 og-cover.jpg）；noscript 改为真实内容（h1+首页原文案+导航）；新增 robots.txt（含 AI 爬虫独立组 + Disallow /api/ /admin）、sitemap.xml（6 条公开路由）、llms.txt（不含占位电话邮箱与收益承诺）；apple-touch-icon.png 180×180；App.js 按路由切换 document.title（未用 react-helmet-async——自托管无预渲染，Helmet 对爬虫无效且有其 React19 依赖风险）；已验证 robots/sitemap/llms 以真实文件 MIME 返回（无 SPA 兜底陷阱）、JSON-LD 合法、无 preview 域名残留。待办（需用户确认后才能补）：联系电话/邮箱为占位值未进结构化数据；部署后需到百度/Google Search Console 提交 sitemap
- 后端接口：GET /api/projects、GET /api/settings、POST /api/contact、POST /api/admin/login、GET/PATCH /api/admin/inquiries、GET/POST/PUT/DELETE /api/admin/projects、PATCH /api/admin/projects/{id}/publish、PUT /api/admin/settings、POST /api/admin/upload、GET /api/files/{path}
- 9 个种子项目（绿色能源/科技创新/商业渠道/实体产业）
- 响应式：375 / 768 / 1366 均验证通过

- 2026-07-07 客服去 AI 化（用户决定不再接 AI）：server.py 删除 DeepSeek 调用，chat_send 改为纯规则：①新会话自动发欢迎语+微信群二维码 ②访客点击常见问题卡片（文本完全匹配）→ 回复该问题预设 answer（+可选图片）③消息含 QR_KEYWORDS → 推二维码（近 5 条内已推则仅文字提醒）④未命中 → 每会话一次 auto_fallback 转人工提示。SettingsAdmin 每个问题卡片新增「自动回复文案」textarea，删除 AI 开关；ChatWidget 去掉 awaitingReply/打字动画，标签「人工客服/客服」；ChatAdmin 自动回复统一显示"自动回复"。DB 已迁移：welcome 去掉"AI助手"措辞，4 个默认问题补齐 answer。curl + 截图验证通过
- 2026-07-07 部署目标回到 Emergent 平台（用户放弃阿里云）：已确认 .env 未设 LOCAL_STORAGE=1，上传走 Emergent 对象存储（持久化，无 Pod 重启丢图风险）；阿里云相关文件（deploy.sh/DEPLOY_ALIYUN.md/CDN_ALIYUN.md/Dockerfile×2/docker-compose×2/nginx×2）已于 2026-07-07 全部删除；server.py 删除 LOCAL_STORAGE/UPLOAD_DIR 本地磁盘分支，仅保留 Emergent 对象存储；backend/.env 删除无用的 AI_BASE_URL/AI_API_KEY/AI_MODEL

- 2026-07-07 AI 客服回归（用户选用 Emergent 通用密钥 + GPT-5.4-mini，不再用 DeepSeek）：server.py 新增 generate_ai_reply（emergentintegrations LlmChat，system prompt 含平台介绍/收益档位/常见问题标准答案/在架项目知识库，80 字内中文回复，失败兜底转人工提示）；chat_send 逻辑 = 新会话欢迎语+二维码 → 卡片点击固定回复(via=auto) → 自由留言 AI 回复(via=ai，二维码关键词仅补发图片不重复提醒) → AI 关闭时每会话一次 auto_fallback；ChatConfig.ai_enabled 默认 True；公开 /settings 返回 questions[].answer（修复后台保存会清空回复文案的 bug）。前端：ChatWidget 恢复 awaitingReply 打字指示（1.5s 轮询，45s 超时）与「AI客服」标签；SettingsAdmin 恢复 AI 开关（标注 GPT-5.4-mini）；ChatAdmin 区分「AI客服/自动回复」。测试：iteration_2.json 全部通过

- 2026-07-07 欢迎语与微信群二维码合并为一条消息（chat_start 单条 admin/auto 消息：welcome 文本 + 二维码图片；欢迎语未提及二维码时自动追加一句引导）；聊天气泡支持换行（whitespace-pre-line）；问题卡片移到欢迎消息下方。截图验证通过

- 2026-07-07 二维码「保存到相册」按钮（ChatWidget SaveQrButton）：仅在群二维码消息下显示；fetch → canvas 转 PNG → a[download]（兼容微信相册识别），失败回退新窗口打开；微信内置浏览器（MicroMessenger UA）不支持下载，改显示「长按二维码 → 识别图中二维码」提示。已通过 Playwright 验证下载为 330×330 PNG
- 2026-07-07 线上数据修正：通过 eztyv.com 管理员 API（PUT /api/admin/settings）把生产库欢迎语从「我是AI助手」改为新文案，补齐 4 条常见问题 answer，二维码与其它设置保留

- 2026-07-07 修复「点发送没反应」：ChatWidget 改为乐观更新——点击即在列表显示访客消息并清空输入框，再请求后端；轮询时保留 temp- 消息避免闪烁；chat/start 仅在会话未就绪时调用一次（减少国内访问的往返延迟）；失败时回滚消息、恢复输入并显示 chat-send-error 红字。Playwright 验证：150ms 内消息可见、无重复、AI 回复正常

- 2026-07-08 礼品卡项目教程（图文+视频）：
  - 后端 tutorials 集合 + TutorialInput{title,slug,summary,cover,video_url,steps[{title,text,image}]}；公开 GET /api/tutorials、/api/tutorials/{slug}；后台 CRUD /api/admin/tutorials(+/publish, DELETE)；启动时 seed「礼品卡项目教程」slug=gift-card（5 步占位文案，待用户替换）
  - 视频：POST /api/admin/upload-video（mp4/webm/mov ≤60MB，实测 25MB 过 ingress）；serve_file 对 video/* 支持 Range→206（iOS Safari 必需）；也可粘贴外链（mp4 直链用 <video>，腾讯/B站播放器地址用 iframe）
  - 客服：QuestionCard 新增 link；点卡片 → 发送消息 + 前端 navigate(link)（外链新窗口）；自动回复消息带 link → 聊天内显示「查看图文视频教程」按钮；SettingsAdmin 每个问题新增「跳转链接」输入框
  - 前端：/tutorials/:slug 页面 Tutorial.jsx（视频/封面、编号步骤卡片、底部「联系客服」触发 hy:open-chat）；后台新 Tab「教程管理」TutorialsAdmin.jsx（步骤增删排序、封面/步骤图上传、VideoUpload 组件带进度）；sitemap 加 /tutorials/gift-card
  - 数据：预览库与生产库(eztyv.com 通过 admin API)均已加「礼品卡项目教程」卡片置顶。注意：生产旧代码会丢弃 link 字段，**重新发布后需再执行一次 PUT /api/admin/settings 或在后台填上 /tutorials/gift-card**（scripts/add_tutorial_card.py 幂等可修 link）
  - 测试：iteration_3.json 后端 14/14 + 前端全流程通过

- 2026-07-08 客服欢迎语改为「文字 + 两个按钮」：chat_start 欢迎消息带 actions=[{type:link,label,link}（教程，默认 /tutorials/gift-card）,{type:qr,label}（加入微信群）]，二维码不再内嵌；新增 POST /api/chat/{sid}/join-group（记录访客点击、推送当前群二维码 + 保存按钮、写 qr_pushes/question_clicks）；ChatConfig 新增 welcome_tutorial_label / welcome_tutorial_link / welcome_group_label，SettingsAdmin 可配；AI 兜底与 system prompt 改为引导点「加入微信群」按钮
- 2026-07-08 修复「上滑看记录被拉回底部」：load() 消息 id 序列未变时不 setState；滚动到底只在打开窗口 / 新消息且用户在底部附近 / 自己刚发消息时触发（onScroll 维护 nearBottom）。Playwright 验证：滚到顶后轮询 7s scrollTop 仍为 0

- 2026-07-08 会话自动结束：关闭客服时记 hy_chat_closed_at；再次打开若已超 2 分钟 → 调 POST /api/chat/{old}/end（会话打 ended_at，ChatAdmin 显示「已结束」）、清本地 sid 与消息、生成新会话并自动 chat/start（称呼复用，无需再填）→ 立即收到欢迎语+按钮；2 分钟内重开则继续原会话。打开窗口时若会话未就绪也会自动 chat/start。Playwright 验证通过

- 2026-07-08 欢迎语按钮点击统计：POST /api/chat/{sid}/action-click 记录「查看最新项目」点击（question_clicks, kind=welcome_action）；join-group 同样打 kind；GET /api/admin/stats/welcome-actions?days=14 返回 labels/每日 clicks+visitors(按会话去重)/totals；StatsAdmin 新增「客服按钮点击（近 14 天）」卡片（汇总 + 日表）。curl + 截图验证

- 2026-07-08 教程页按钮可配：TutorialInput 新增 cta_label/cta_link（底部金色跳转按钮，填链接才显示，外链新窗口）、back_label/back_link（左上角返回，默认 返回首页 → /）；TutorialsAdmin 编辑器新增「页面按钮」区块；gift-card 示例已设为「立即加入合作 → /cooperation」「返回项目中心 → /projects」。截图验证

- 2026-07-08 教程观看统计：POST /api/tutorials/{slug}/events {type:view|cta, visitor_id}（view 同访客 30s 去重）；visitor_id 由 lib/source.js getVisitorId() localStorage 持久化；GET /api/admin/stats/tutorials?days=14 → 每教程 views/view_visitors/cta_clicks/cta_visitors/cta_rate；StatsAdmin 新增「教程观看统计」表。截图验证。随后再次触发发布（第二次，第一次未上线）

- 2026-07-08 会话结束机制加固：改用 hy_chat_active_at「最后活跃时间」（窗口打开期间每 15s 刷新 + pagehide/关闭时写入），打开客服时距最后活跃 >2 分钟即结束旧会话并新建（覆盖关页面/切后台/点 X/跳转教程等所有离开方式）；新增聊天头部「结束会话」按钮（有访客消息时显示）→ 立即清空并重新收到欢迎语；ensureSession 抽取复用。Playwright 验证：离开 3 分钟回来 → 新会话；手动结束 → 新会话+欢迎语

- 2026-07-08 教程步骤增强：TutorialStep 新增 video_url（上传/外链，复用 VideoUpload+TutorialVideo）、button_label/button_link（步骤内小号金色按钮，填链接才显示，点击计入 cta 统计）；TutorialsAdmin 每个步骤编辑器新增「本步骤视频」「本步骤按钮」区块。截图验证

- 2026-07-08 教程内容运营：礼品卡教程正式文案（Giftray 9折购卡 → 闲礼汇馆 95折回收，每日限购1张，邀请返佣一级0.7%/二级0.3%，20人解锁VIP群，USDT/信用卡/Google Pay 推荐USDT；文案源 backend/scripts/gift_card_copy.json）；新增教程「欧意（OKX）购买 USDT 教程」slug=okx-usdt（backend/scripts/okx_usdt_copy.json）；收益口径全站改为 10人10万/20人20万/50人50万+（settings.tiers、常见问题答案、AI prompt、海报默认、教程第六步）。均已通过 admin API 写入预览库 + 生产库
- 2026-07-08 步骤多按钮：TutorialStep.buttons[{label,link}]（model_validator 自动把旧 button_label/link 合并进 buttons）；TutorialsAdmin 每步「添加按钮」可加多个；Tutorial.jsx 横向渲染。礼品卡第三步按钮：「注册 Giftray 商城账户 → https://www.lpk-888.com」「查看欧意购买 USDT 教程 → /tutorials/okx-usdt」。已发布上线并写入生产数据

- 2026-07-08 「微信群」→「海鸥官方群」全站改口径：欢迎语按钮默认标签、join-group/关键词推送文案（改为'保存二维码后打开海鸥 App 扫一扫'）、AI prompt、兜底文案、常见问题答案、首页/关于/联系页文案、后台标签、SaveQr 按钮文案与文件名、两篇教程文案（源 JSON 同步）。预览库 + 生产库数据已通过 admin API 更新（按钮标签、答案、里程碑、教程）。代码部分需发布

- 2026-07-08 联系页二维码改为「官方微信服务号」：ContactInfo 新增 mp_qr_image / mp_name；SettingsAdmin 联系方式卡片新增服务号二维码上传 + 显示名称；Contact.jsx 改用 contact.mp_qr_image（不再用群二维码），文案「微信扫码关注，获取最新项目」，未上传则不显示。预览已验证（占位白图）；需发布 + 用户在后台上传真实服务号二维码

## 待办优先级
- P0：eztyv.com DNS 仍残留阿里云 A 记录 47.115.133.9（约 23% 解析到旧服务器），需在 DNS 服务商删除该记录，只保留 Emergent 自定义域名给的 CNAME/记录
- P0：Emergent 再次 Re-publish（含欢迎语+二维码合并、保存二维码按钮、发送乐观更新、礼品卡教程）；发布后补生产 link 字段；用户在后台「教程管理」替换礼品卡教程真实图文与视频
- P1：Emergent 通用密钥余额不足时 AI 会自动回落为转人工提示，需在 Profile → Manage plan → Universal Key 充值或开自动续费
- P1：留言邮件/短信通知客服（需集成 Resend / Twilio）
- P2：百度/Google Search Console 提交 sitemap
- P2：真实联系电话/邮箱替换占位信息

## 下一步
- 项目管理后台 CRUD
- 留言实时通知
- SEO 元信息与分享卡片优化
