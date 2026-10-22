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

- 2026-07-08 客服「加入海鸥官方群」→ 独立教程页：TutorialStep 新增 copy_label/copy_text（Tutorial.jsx 渲染 CopyField 一键复制框，填了 copy_text 才显示）；TutorialsAdmin 每步新增「可复制文本」区块；SettingsAdmin 客服配置可编辑 welcome_group_link；ChatWidget group-link 动作改为路由跳转 /tutorials/join-group（启动时自动种子三步教程：下载 App → 注册登录 → 扫码/群 ID 进群）。Playwright 验证：教程页复制框渲染、客服按钮点击跳转成功。群二维码（第三步图片）、群 ID、下载链接需用户在后台「教程管理」填写

- 2026-07-08 项目教程链接：ProjectInput 新增 tutorial_link（站内 /tutorials/slug 或外链）；ProjectsAdmin 表单新增「项目教程链接」（下拉选站内教程 + 可手填），列表显示「已配教程」标签；Projects.jsx 卡片底部与详情弹窗显示「查看项目教程」按钮（卡片改为 div role=button 避免嵌套交互元素，外链新窗口）。客服快捷问题移除「礼品卡项目教程」chip（预览库 + 生产库 eztyv.com 已通过 admin API 删除）。预览库礼品卡项目已配 /tutorials/gift-card。Playwright 验证通过。生产需部署新代码后在后台给礼品卡项目配置教程链接

- 2026-07-08 欢迎语改为引导进群：「您好，欢迎来到合赢项目社！最新优质项目与合作资料都会第一时间在海鸥官方群内发布，点击下方按钮加入官方群抢先获取；有任何问题也可直接留言，客服会尽快回复您。」server.py 默认值同步；预览库 + 生产库（eztyv.com）已通过 admin API 写入，正式站已验证生效（无需重新发布）

- 2026-07-08 关键词进群推送改为按钮：chat_send 的 QR_KEYWORDS 规则在配置了 welcome_group_link 时推送带 actions:[group-link] 的消息（「加入海鸥官方群」按钮 → 进群教程页），不再发二维码图片；最近 5 条内已有按钮/二维码则不重复推送（AI 开启时由 AI 引导点按钮）；仅在未配教程链接时回退二维码。AI prompt、AI_FALLBACK_TEXT、默认常见问题答案同步改为「点击按钮」口径；预览库 + 生产库常见问题 answer 已通过 admin API 更新。curl 验证：关键词触发推送 actions 消息、无 image。代码需重新发布

- 2026-07-08 宝塔自托管部署包 `deploy/baota/`（用户因 Cloudflare 国内可达性差决定迁回国内服务器）：README_BAOTA.md（七步指南）、deploy.sh（git pull → venv+阿里云 pip 镜像 → 剔除 @emergentbase devDeps 后 npmmirror yarn build，REACT_APP_BACKEND_URL="" 走相对 /api → systemd heying-backend 127.0.0.1:8001 → 健康检查）、nginx-site.conf（/api 反代、SPA fallback、100m 上传、静态缓存）、heying-backend.service、backend.env.example、import_from_live.py（登录线上后台拉 settings/projects/articles/tutorials 并下载 /api/files 引用文件到 UPLOAD_DIR、写 files 记录；已在预览验证 10 项目/14 文章/3 教程/3 文件）；backend/requirements-selfhost.txt（不含 emergentintegrations）。server.py 恢复 LOCAL_STORAGE=1/UPLOAD_DIR 本地存储分支（put/get_object，startup 跳过对象存储初始化；已验证上传+访问）、新增 `_ai_complete`：AI_API_KEY 存在时走 openai SDK OpenAI 兼容接口（AI_BASE_URL 默认 DeepSeek、AI_MODEL 默认 deepseek-chat，未实测需真实密钥），否则走 Emergent 通用密钥。Emergent 部署行为不变

- 2026-07-08 用户服务器实为宝塔 Windows 版（D:\BtSoft\panel），选择不重装 Linux：新增 `deploy/windows/`：deploy.bat（git pull → 检测 py -3.12/3.11/3.10/python → venv + 阿里云 pip → 剔除 @emergentbase devDeps → npmmirror yarn install → 写 .env.production.local `REACT_APP_BACKEND_URL=` 空值后 yarn build → schtasks 注册 HeyingBackend 开机任务(SYSTEM) 调 run-backend.bat → curl 健康检查）、run-backend.bat（uvicorn 127.0.0.1:8001 崩溃 5s 自动拉起，日志 logs/backend.log）、nginx-site.conf、backend.env.example（UPLOAD_DIR 正斜杠）、README_WINDOWS.md 七步指南（Python/Node/Git 官方安装包 + 宝塔 Nginx/MongoDB）。.gitattributes 强制 *.bat CRLF。GitHub 仓库：ajin53193-cyber/acai。⚠️ Windows 脚本无 Windows 环境未实测，用户执行报错需据截图修正

- 2026-10-09 宝塔 Windows 自托管上线成功（eztyv.com）。实战修复脚本：所有 .bat 改纯 ASCII+CRLF（中文乱码/`call :label` 失效根因）、.gitattributes `*.bat -text` 保证仓库存 CRLF；新增 `deploy/windows/setup.bat` 一键引导（宝塔网页终端直接下载运行：codeload 直连+ghfast/ghproxy 镜像兜底下载代码 → 静默装 Python3.11(华为云)/Node20(npmmirror) → robocopy 覆盖写入避免 Access denied → 传 HEYING_PY 完整路径给 deploy.bat）；deploy.bat 优先用 HEYING_PY、yarn 用 `npm config get prefix`\yarn.cmd 完整路径调用（SYSTEM 下 npm 全局目录不在 PATH）、timeout 改 ping（终端重定向报错）。部署结果：前端 build + 后端 schtasks 常驻 + MongoDB 本地 + Let's Encrypt HTTPS + /api 反代全部外网实测 200。两个坑：①宝塔「添加HTML站点」会往根目录写默认 index.html（nginx 欢迎页）覆盖 build/index.html → 重跑 setup.bat 重新构建即可；②server_name 加服务器 IP 会与默认站点冲突并导致 eztyv.com 落到默认块 → 去掉 IP。数据迁移用 LIVE_URL=预览地址 跑 import_from_live.py 成功（10 项目/14 文章/3 教程/3 文件）
- 2026-10-09 按用户要求聚焦「加入海鸥官方群」引导：移除客服欢迎语「查看最新项目」按钮（server.py /chat/start 只保留 group-link/qr）、移除项目卡片与详情弹窗「查看项目教程」按钮（Projects.jsx，顺带删除未用的 TutorialLink/PlayCircle/isExternal）。进群转化：GET /tutorials/{slug} 对 slug=join-group 自动把客服设置 qr_image 注入到「含二维码的那一步」step.image（后台换码即同步，群 ID/链接仍需后台填 copy_text/按钮）。预览验证：/chat/start 仅返回 group-link；项目页无教程按钮；进群教程第三步自动显示群二维码（330px 加载成功）。待用户 Save to GitHub + 服务器 `D:\setup.bat` 重建发布
- 2026-10-09 进群按钮转化优化：客服欢迎/关键词推送的「加入海鸥官方群」按钮文案改为更吸睛的「立即加入官方群 · 抢先获取一手项目」（ChatConfig.welcome_group_label 默认值更新 + 启动时一次性迁移：存量等于旧默认「加入海鸥官方群」的自动升级为新文案，用户自定义的其它文案保留）；样式由金色描边改为**金色实心高亮 + 呼吸脉冲动效**（index.css 新增 @keyframes joinPulse / .animate-join-pulse，box-shadow 金色光晕缩放呼吸；ChatWidget group-link/qr 按钮用 bg-gold-gradient + ring + animate-join-pulse）。curl 验证 /chat/start messages 返回新 label；Playwright 截图确认实心金按钮渲染正常。待用户 Save to GitHub + 服务器 `D:\setup.bat` 发布；群号/群链接由用户在后台「教程管理→加入海鸥官方群教程→第三步」自行填写
- 2026-10-09 进群教程图片清理 + 二维码注入修正：get_tutorial 自动注入群二维码时改为「只注入真正讲二维码/群 ID 的步骤，绝不回退到第一步」（修复第三步已存图时二维码被误塞进下载步骤的隐患）；启动一次性迁移（migrations.join_group_clear_step_images）清空 join-group 教程中非二维码步骤（下载/注册）的图片。curl 验证第一二步 image 为空、第三步保留二维码
- 2026-10-09 内容合规整改（去「高收益/月入X万」避免微信外链风控拦截「打开外部网站风险提示·刷单/高收益理财/网赚」）：①「团长收益体系」整体改为「团队协作激励」——档位金额 10万/20万/50万 → 基础激励/进阶激励/合伙激励，「月入参考/月」标签 → 「协作激励层级」，免责声明改为「不构成任何收益承诺」口径（Cooperation.jsx、api.js tiers 默认、PosterAdmin 海报模板与绘制、SettingsAdmin 后台标签与 placeholder 全同步）；②FAQ「收益怎么样？」→「合作模式是怎样的？」答案去金额改团队协作激励口径（api.js + server.py DEFAULT_CHAT_QUESTIONS + AI system prompt 同步）；③项目种子去敏感词（礼品卡「收益稳定/共享收益」→「合规运营/协作共进」、光伏「收益稳定/20年长期回报/并网收益保障」、智链「现金流稳定」→「经营稳健」）；④启动一次性迁移 migrations.income_compliance_v1：生产库 settings.tiers（含「万」即整体替换）、含金额的常见问题答案、全部项目 description/highlights 按替换表（收益稳定→合规运营、现金流稳定→经营稳健、20年长期回报→长期运营项目、并网收益保障→并网合作模式、持续收益→协作成长、高收益→多劳多得等）自动清洗。注：项目「投入区间 5-20万」等为资金投入信息非收益承诺，保留。预览库 curl 验证 tiers/FAQ/projects 已清洗 + Cooperation 页截图确认「团队协作激励」渲染正常。待用户 Save to GitHub + `D:\setup.bat` 发布；发布后到微信公众平台配「业务域名 eztyv.com」(校验文件 MP_verify_SOutmnBmEpHiUJPi.txt 已在根目录生效) + 到 urlsec.qq.com/110.qq.com 申诉解除风控
- 2026-10-13 生产 502 修复（运维）：根因 = 服务器 Python 3.11 文件被删但安装器「已安装」注册残留，重跑安装包进入修改模式忽略 TargetDir 并以 0x3 退出。修复：`py311-setup.exe /uninstall /quiet` 清除残留 → `/passive InstallAllUsers=1 TargetDir=C:\Python311` 重装 → `D:\wwwroot\heying\backend` 重建 .venv + 清华源装 requirements-selfhost.txt → `schtasks /run /tn HeyingBackend`，127.0.0.1:8001/api/settings 200，外网用户访问恢复。注意：宝塔网页终端不支持 `timeout`（用 ping 代替），交互终端 curl -w 用单 `%`
- 2026-10-13 合规标识扩展：首页 Hero 按钮下方新增三枚徽章（平台不收取任何费用 / 不承诺收益 / 正规合规项目，data-testid=hero-compliance-badges）；全站页脚版权行上方新增一行合规文案（footer-compliance-badge）。按用户要求移除项目卡片/详情中的「投入区间」展示（Home.jsx 卡片底部改「查看详情」、Projects.jsx 列表卡片改显示 status、详情弹窗删除该字段；AI prompt 项目上下文同步去掉投入区间；后台编辑表单 investment 字段保留不动）。进群按钮文案由「立即加入官方群 · 抢先获取一手项目」改为「立即加入项目交流群」（默认值 + 启动迁移覆盖两种旧默认，用户自定义文案保留）。预览 Playwright 验证：hero 徽章 1 个、页脚文案渲染、页面无「投入区间」、/api/settings 返回新 label。待用户 Save to GitHub + 服务器 `cd /d D:\wwwroot\heying && deploy\windows\deploy.bat` 发布
- 2026-10-17 后台「页面文案」+ 联系电话/微信 + 动态 sitemap：新增 backend/site_copy.py（SiteCopy 模型：compliance_badges/nav/home/cooperation/about/contact/footer，默认值与 frontend/src/lib/defaultCopy.js 一致）；GET /api/settings 返回 copy（服务端填默认），PUT /api/admin/settings/copy 单独保存（不影响 SiteSettings 保存）。前台 Home/Cooperation/About/Contact/Header/Footer 全部改为读取 copy（图标按索引固定，图片走 toFullUrl 支持后台上传）。后台新增 Tab「页面文案」(CopyAdmin.jsx + copySchema.js 声明式 + copyFields.jsx 通用编辑器，分区折叠、恢复默认)。ContactInfo.hotline/wechat 默认改为空 + 迁移清掉占位值，站点设置新增两输入框，前台联系页/页脚/合作页 CTA 非空才显示。GET /api/sitemap.xml 动态生成（静态页+已发布新闻+教程，SITE_URL env 默认 https://eztyv.com），nginx-site.conf 将 /sitemap.xml 代理到后端，README_WINDOWS.md 新增百度/Google 提交指南。测试：iteration_4.json 全部通过（后端 pytest backend/tests/test_copy_sitemap_contact.py 5/5，前端全流程）。待用户 Save to GitHub + deploy.bat + 宝塔更新 nginx 配置
- 2026-10-17 一键更新部署：deploy.bat 新增第 6 步调用 deploy/windows/patch-nginx.ps1（自动在宝塔 vhost 中把 /sitemap.xml 改为代理后端并 nginx -t/-s reload，失败自动还原 .bak）；setup.bat Python 候选路径加入 C:\Python311；README 第七节改为一行 PowerShell 命令（多镜像下载最新 setup.bat → 拉 zip → 构建 → 重启 → nginx 补丁 → 健康检查）。服务器目录不是 git 仓库，更新靠 setup.bat 下载 GitHub zip 覆盖，故每次更新前必须先 Save to GitHub
- 2026-10-19 项目卡片改「进群查看」弹窗：按用户要求，项目中心点击卡片不再展示详情，而是弹窗提示「项目详情已在官方交流群内分享」+「加入官方交流群」按钮（跳转 settings.chat.welcome_group_link，默认 /tutorials/join-group）+「咨询客服」按钮（触发 hy:open-chat）。文案在后台「页面文案 → 项目中心页」可改（SiteCopy 新增 projects 分区）。Playwright 验证弹窗与跳转教程页正常。待 Save to GitHub + 一键更新命令发布
- 2026-10-19 首页卡片直达 + 进群点击统计：抽出共用组件 components/ProjectGateModal.jsx（首页精选卡片与项目中心卡片点击均弹出；进群按钮去掉箭头图标）。埋点 POST /api/projects/{id}/events {type: open|group, visitor_id} → db.project_events；后台 GET /api/admin/stats/projects?days= 按项目聚合打开次数/人数、进群点击次数/人数、转化率，StatsAdmin 新增「项目进群点击统计」表（stats-projects-card）。Playwright 验证首页弹窗、跳转教程、统计表显示正常
- 2026-10-19 进群教程多二维码小卡片：QrCodeItem 新增 group_id（站点设置 → 群二维码每行新增「群 ID」输入框）；GET /tutorials/join-group 把所有启用的群码以 qr_codes[{image,label,group_id}] 注入第三步（不再注入单张大图，若步骤 image 与群码相同则清空避免重复）；Tutorial.jsx 新增 QrCard（150px 卡片：118px 二维码 + 群名 + 可复制群 ID），有群 ID 时隐藏步骤级 copy_text；普通步骤图片改为 max-h-360 自适应不再铺满。预览验证通过
- 2026-10-19 热门项目角标：GET /api/projects 每个项目新增 hot 字段（hot_project_ids：近 7 天 project_events type=group 聚合，前 3 名且 ≥1 次点击）；首页精选卡片右上、项目中心卡片图片右下显示红橙渐变「热门」角标（Flame 图标 + .hot-badge 呼吸动画）。预览验证通过
- 2026-10-19 热门标签后台控制：项目新增 hot_mode（auto 默认 / on 常驻 / off 关闭），PATCH /api/admin/projects/{id}/hot；GET /admin/projects 附带 hot/hot_auto/group_clicks_7d；项目管理列表显示「热门」标签（常驻注明）、近 7 天进群点击次数，新增循环切换按钮「热门：自动→常驻→关闭」。预览验证通过
- 2026-10-19 访问统计只记录中国 IP：track_visit 用 ip-api 地区判断，非中国（含港澳台）直接跳过不入库（本地访问 / 查询失败的「未知地区」保留）；启动迁移 visits_china_only_v1 一次性删除历史海外访问记录（预览删了 154 条）。curl 验证 8.8.8.8 → skipped，114.114.114.114 → 记录
- 2026-10-19 省份地图 + 推广图文 + 热门工具（iteration_5.json 全部通过）：
  - 省份访客热力图：GET /api/admin/stats/provinces?days=（按独立 IP、province_of 解析省名）；frontend/public/geo/china.json（DataV 省界，坐标 2 位小数、已按 d3-geo 顺时针外环重绕）；components/ChinaMap.jsx（d3-geo mercator 固定 center/scale，悬停提示，金色热度）；StatsAdmin 新增 stats-provinces-card + TOP10 排行
  - 推广图文：db.promos {id, slug(8hex), title, subtitle, cover, blocks[{type: heading|text|image|button, text, image, link}], published, views}；公开 GET /api/promos/{slug}、POST /view；后台 /admin/promos CRUD + publish。前台 /p/{slug} 白底页（PromoPage.jsx，Block 渲染在 components/PromoBlocks.jsx），不显示站点页头/页脚/客服。后台 Tab「推广图文」PromosAdmin.jsx（区块编辑器 blockEditor.jsx 共用，创建后自动复制分享链接、列表复制/预览/上下线/编辑/删除、浏览数）
  - 热门工具：db.tools {id, slug, name, icon, tagline, download_link, download_text, blocks, published, sort, views, downloads}；公开 GET /api/tools 列表、GET /api/tools/{slug}、POST /events {view|download}；后台 /admin/tools CRUD。前台 /tools 白底列表（图标+名称+简介）→ /tools/{slug} 教程页（图标、名称、下载按钮、图文教学）。后台 Tab「热门工具」ToolsAdmin.jsx（复制列表链接 / 单个工具链接）
  - 推广页底部热门工具位（2026-07）：components/ToolsStrip.jsx 拉取 GET /api/tools，在每个 /p/{slug} 推广图文正文下方、页脚上方展示「热门工具」卡片列表（App 图标+名称+简介），点击任一工具跳转 /tools/{slug} 使用下载教程页。无工具时不渲染。
  - 工具数据排行（2026-07）：ToolsAdmin「热门工具」Tab 顶部新增 tools-ranking 看板卡（总查看/总下载、查看次数 TOP10、下载次数 TOP10），数据取自 GET /admin/tools 的 views/downloads 字段。
  - 推广页配工具（2026-07）：PromoInput 新增 tool_slugs: List[str]（空=展示全部已上线工具，否则只展示勾选工具并按勾选顺序）；PromosAdmin 编辑器新增 promo-tools-picker 多选（勾选框 + 图标 + 名称）；PromoPage 把 promo.tool_slugs 传给 ToolsStrip 过滤。
  - 一键分享海报 + 一键转发文案（2026-07）：components/SharePoster.jsx 用 qrcode 库在 canvas 绘制深蓝/金色品牌海报（品牌名 + 徽章 + 标题 + 副标题 + 二维码白卡 + 「长按识别二维码」+ 合规页脚）→ PNG dataURL 弹窗预览 + 保存。打开弹窗时自动把「转发文案」（lib/api.js buildShareText：【合赢项目社】标题 + 简介 + 链接 + 引导语）复制到剪贴板并 toast；弹窗内含文案只读框 + 复制推荐话术按钮。接入：公开 /tools/{slug}，后台 ToolsAdmin / PromosAdmin 每行「海报」按钮；两处后台「复制文案」按钮直接复制 buildShareText 话术。无后端依赖、无跨域污染。
  - 工具/推广页 LOGO（2026-07）：/tools 列表页、/tools/{slug} 教程页、/p/{slug} 推广页顶部改用新版 HY 蓝橙 LOGO（public/images/logo-hy.png，已裁白边），替换原深蓝 LogoFull；首页页头金色「合」保持不变。
  - 推广页热门工具位样式（2026-07）：ToolsStrip 改为「仅 App 图标」网格，一行 5 个（grid-cols-5），图标下带小字名称；超过 5 个自动换行；推广页底部不再显示「生成分享海报」按钮（转发从后台操作）。

## 待处理（等用户确认）
- （暂无）

## 热门工具内容采集脚本（2026-07）
- `deploy/baota/seed_okx_tool.py`：欧易 OKX 新手总攻略（slug=okx-guide，63 区块）。
- `deploy/baota/seed_tools.py`：统一脚本，一次性 upsert 全部 4 个工具（okx-guide / kuaifan / binance / htx），幂等可重复跑，保留浏览/下载计数。图片直接引用各官网 CDN；币安已去除原作者返佣邀请码，注册按钮指向官方注册页。
- 正式站同步：Save to GitHub → 服务器 `cd /www/wwwroot/heying && git pull && backend/.venv/bin/python deploy/baota/seed_tools.py`。

## 宝塔/Ubuntu 一键部署（2026-07）
- 新增 `deploy/baota/setup.sh`：首次引导脚本，自动 git clone（失败回落 zip）到 /www/wwwroot/heying 后调用 deploy.sh。
- 一句命令（宝塔终端）：`bash <(curl -fsSL https://raw.githubusercontent.com/ajin53193-cyber/acai/main/deploy/baota/setup.sh)`
- 前提：先装 Nginx / MongoDB / Node20 / Python3.11，并 Save to GitHub；首次会生成 backend/.env 停下改密钥，再跑一次；之后更新同命令或 deploy.sh。
- requirements-selfhost.txt 已覆盖全部后端依赖（近期 tool_slugs / 分享海报均无新增后端依赖）。

## 待办优先级
- P0：用户按 deploy/windows/README_WINDOWS.md 在宝塔 Windows 搭建，等待终端截图反馈
- P0：用户按 deploy/baota/README_BAOTA.md 在宝塔搭建；Save to GitHub → 服务器 clone → deploy.sh → Nginx 配置 → import_from_live.py → 切 DNS
- P0：部署新代码（Save to GitHub → 服务器 deploy.sh）后，在生产后台「项目管理 → 礼品卡合作项目 → 编辑」选择教程链接
- P0：用户在后台「教程管理 → 加入海鸥官方群教程」填写：第一步下载链接、第三步群二维码图片 + 官方群 ID；随后 Re-publish 上线
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

## 更新记录
- 2026-07-21：纠正图片位置——中部动态横幅改回「立即加入」图(d144b05e)；/p/about「招募团队长」板块图改为「团队长招募」横幅(e2456e9f)。seed_promo_about.py 已更新重跑。
- 2026-07-21：中部横幅换用「团队长招募」新图(e2456e9f..._image.webp)。「立即加入」按钮位置叠 join-cta-glow 柔和脉冲光晕(模糊box-shadow非硬边框,避免错位,right5.5%/bottom2%/w19.5%/h16%)，整张保留 join-breath+join-shine。纯前端。
- 2026-07-21：「立即加入」横幅换用用户上传的新图(d144b05e..._image.webp)，并做成动态：整张横幅 join-breath 呼吸脉冲(scale+glow) + join-shine 流光扫过(keyframes 加在 index.css)。移除此前错位的「马上加入」按钮脉冲框(烤进图片的按钮无法精准叠框)。点击仍跳 cs_url。纯前端，生产需 deploy.sh。
- 2026-07-21：推广文章中部自动插入「立即加入」横幅图（JoinBanner 组件，图片为生成的金色"立即加入·抢占名额·专业对接"横幅），点击跳转 cs_url 第三方客服链接（留空提示待配置）。PromoPage.jsx 在 blocks 中点(Math.floor((len-1)/2))后用 Fragment 注入，所有推广页生效。纯前端，生产需 deploy.sh。
- 2026-07-21：推广页/工具页「第三方客服链接」。后端 ChatConfig 新增 cs_url 字段；后台「客服设置」加输入框(data-testid=settings-chat-cs-url)。新增组件 PromoCustomerService（底部中部金色「联系客服」按钮 + 右下角悬浮按钮，点击新标签打开 cs_url；留空则点击提示"待配置"）。渲染于 PromoPage 与 Tools(Shell)。主站仍用自带 ChatWidget 聊天(App.js 已复原 !bare)。客服按钮图(JPEG不透明)弃用，改用 CSS 金色按钮+Headphones图标。前后端改动，生产需 deploy.sh。cs_url 当前留空(预留)，上线后在后台填真实链接。
- 2026-07-21：客服悬浮按钮扩展到推广页与工具页。App.js 中 ChatWidget 由 `{!bare&&...}` 改为 `{!isAdmin&&...}`，使 /p/ 推广页、/tools 工具页也显示在线客服悬浮按钮（页头/页脚/移动Tab仍只在主站显示，后台不显示）。前端改动，生产需 deploy.sh 重建。
- 2026-07-21：新增平台介绍页 /p/about（seed_promo_about.py，18区块）。封面=品牌横幅A，含四重体系/四大核心服务/多元赛道(配图)/真实10项目/招募团队长(配海报)/温馨提示；tool_slugs=["__hidden__"]隐藏热门工具栏。配套群发素材：品牌横幅A/B、欢迎图、招募团队长海报、本周项目速递、多元赛道图；社群运营SOP文档 deploy/baota/社群运营SOP.md。合规口径统一(不承诺收益/平台0费用/正规合规/风险自担)，已拒绝资金盘式"首码/油车/0撸/保本稳收益"话术。生产：git pull + 运行 seed_promo_about.py。
- 2026-07-19：汇率自动更新。后端新增 GET /api/rates/usdt-cny（多源回退 currency-api(usdt.cny)→open.er-api(USD/CNY)→coingecko→静态6.65兜底，内存缓存 TTL 12h≈每日刷新，requests+asyncio.to_thread）。前端 GiftCardCalculator 挂载时 axios 拉取并带入实时汇率(显示绿色「实时」徽章)，用户仍可手动改。实测实时值≈6.67-6.68，1000卡净赚≈+¥39(+5.4%)。前后端均改动，生产需 deploy.sh 重建+后端重启。
- 2026-07-19：搬砖页计算器升级为「净赚人民币」口径：新增可调 USDT 汇率输入(默认6.65，来自实时查询USDT/CNY≈6.64-6.68)，显示 买入成本$USDT(≈¥) / 核销实得¥ / 净赚人民币¥(=核销¥−买入折¥) / 收益率%(正绿负红)。1000卡@6.65≈+¥42.24(+5.8%)，8000卡≈+¥337.88。证实约5%价差成立(此前误用7.2汇率致判断偏差)。纯前端改动，生产需 build。
- 2026-07-19：代理页 /p/agent-recruit 新增「代理收益计算器」（PromoBlocks 复用 calculator 区块，text="agent" → AgentCommissionCalculator；text="" → GiftCardCalculator）。输入一级/二级月核销额，算 一级0.7%+二级0.3% 佣金与合计。搬砖页计算器按用户决定保持核销实得只显示人民币¥(不加USDT换算,因折算后约5%价差被汇率抵消)。seed_promo_agent.py=19区块。生产需重新 build 前端(deploy.sh)+重跑 seed_promo_agent.py。
- 2026-07-19：《搬砖项目》新增「收益计算器」互动组件（前端 PromoBlocks.jsx 新增 calculator 区块类型 + GiftCardCalculator 组件；后端 PromoBlock pattern 增加 calculator）。输入面值实时算 买入USDT(面值×0.1087) 与 核销实得¥(面值×0.76509)，预设 200/500/1000/5000/8000。并在文章加注转赠账户 65159201 仅为示例、以实际页面为准。生产需重新 build 前端(deploy.sh) + 重跑 seed_promo_giftcard.py。
- 2026-07-19：《搬砖项目》重大更新为真实统一流程 + 12 张实拍截图（gogo589 买卡 3 图 + 闲礼会馆/订单 9 图）。关键：两平台通过「AlipayHK 转赠账户(卖卡平台提供,示例65159201)+28-36位交易号」打通，用户无需自有 AlipayHK；核销实得为人民币(HK$1000→¥765.06, HK$8000→¥6120.47)，买入用USDT($108.70/$869.60)，约5%价差、3分钟到账(如实列出,保留"约5%"说法)。脚本 deploy/baota/seed_promo_giftcard.py(37区块)。
- 2026-07-19：新增《成为代理·躺赚两级佣金》招募图文 /p/agent-recruit，主打一级0.7%/二级0.3%分佣+裂变。脚本 deploy/baota/seed_promo_agent.py(18区块)。生产上线需运行该脚本。
- 2026-07-19：新增推广图文《新地礼品卡搬砖项目》，分享链接 /p/giftcard-project。邀请链接含邀请码 https://lzmur.com/?ref=LD4QSU 。生产上线：Save to GitHub → 服务器 git pull → 运行 seed_promo_giftcard.py 与 seed_promo_agent.py。
- 2026-07-19：新增推广图文《USDT 充值教程》（TRC20 通用版），分享链接 /p/usdt-recharge。幂等种子脚本 deploy/baota/seed_promo_recharge.py（固定 slug=usdt-recharge），底部挂 okx-guide + binance 工具。生产上线需 Save to GitHub → 服务器 git pull → `cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_promo_recharge.py`。预览已验证渲染正常。
- 2026-07-21：更换《平台介绍》推文 /p/about 两张配图：封面 Hero 换为「合赢项目社·稳定项目供给·专业护航」金色新图（297b3d32d5a32475_image.png），「多元赛道」配图换为「多元赛道·优质项目」四卡横幅图（e85d468cedea4fa0_image.webp）。改动在 deploy/baota/seed_promo_about.py（COVER、IMG_SECTORS），预览库已重跑 seed 并验证。生产上线：Save to GitHub → 服务器 git pull → 重跑 seed_promo_about.py。
- 2026-07-21：横幅按钮改造。3 张含金色按钮的横幅图（d144b05e 立即加入 / e2456e9f 团队长招募 / e85d468c 多元赛道）改为「图静态 + 按钮动态」：移除整图呼吸/流光动画，在图里原金色按钮位置叠一个动态脉冲金色按钮（promo-cta-animate），文字统一（立即加入×2、了解项目详情×1），点击全部跳第三方客服链接。实现：PromoCustomerService.jsx 新增 BANNER_CTAS 配置+bannerCtaForImage()+通用 PromoActionBanner 组件；PromoBlocks.jsx 的 image 区块命中横幅时改用 PromoActionBanner；index.css 用 promoCtaBtn 关键帧替换旧 join* 动画。纯前端改动，生产需重新 build 前端(deploy.sh)。预览已截图验证按钮覆盖对齐、文案正确。
- 2026-07-21：再次更换《平台介绍》/p/about 的「多元赛道」配图为用户最新上传横幅（856cc85c4fd61523_image.webp，2000x787，含右侧「了解项目详情」按钮）。同步更新 seed_promo_about.py 的 IMG_SECTORS；前端 PromoCustomerService.jsx 的 BANNER_CTAS 把旧 key e85d468c 换为 856cc85c 并重标定动态按钮位置（right 侧居中：left 78% / top 49.5% / w 19.5% / h 13.5%）。预览已重跑 seed + 截图验证按钮精准覆盖、文案「了解项目详情」正确、点击跳客服。生产需 git pull + 重 build 前端 + 重跑 seed_promo_about.py。
- 2026-07-21：修正「团队长招募」横幅（e2456e9f）动态「立即加入」按钮位置偏移：重新标定为 left 74% / top 81.5% / w 20.5% / h 12.5%（原 72%/80%/21%/15.5% 偏左偏上偏大）。预览截图确认精准覆盖图里原金色按钮。
- 2026-07-21：再修「团队长招募」(e2456e9f)「立即加入」按钮：原叠加按钮过宽向右溢出；按图里实际按钮外框重标定为 left 74.5% / top 80.8% / w 16% / h 14.5%（font 2.6cqw），现精准贴合、无溢出露边。预览截图确认。
- 2026-07-21：横幅按钮改为「发光呼吸 + 可点击」方案（用户确认）。放弃用金色按钮盖住原按钮（像素对齐太脆弱、易错位）。现在图片完全静态，在按钮位置叠一个透明可点区域 + promoCtaBtn 呼吸发光描边（gold ring + glow，1.5s 循环），点击跳第三方客服。涉及 3 张图：d144b05e(马上加入)/e2456e9f(立即加入)/856cc85c(了解项目详情)。改动 index.css（promoCtaBtn 关键帧改为描边发光）与 PromoCustomerService.jsx（按钮改透明无填充无文字、aria-label 保留）。位置误差对柔光描边不敏感，视觉自然。预览三张均已截图验证。生产需重新 build 前端。
- 2026-07-21：修正发光描边错位。按原图实测各按钮外框像素重标定：join d144b05e(马上加入) left76.2%/top80%/w17%/h15.5%；sectors 856cc85c(了解项目详情) left80%/top49.5%/w13.5%/h11%；recruit e2456e9f(立即加入) left74.5%/top80.8%/w16%/h14.5%。之前 join/sectors 描边过宽且偏左导致错位。三张均截图确认描边紧贴按钮。
- 2026-07-21：彻底解决横幅按钮"错位"问题。放弃硬边描边/金块叠加（像素对齐太脆弱，右边缘总切到按钮）。改为「柔和径向发光聚光 + 呼吸」：按钮位置叠一个 radial-gradient 金色柔光（mix-blend-mode:screen），opacity .35↔1 + scale .96↔1.06 呼吸，无任何硬边；再叠一个透明可点 button 覆盖按钮区→跳客服。柔光中心亮边缘淡出，位置误差±40px 也看不出来。三张图均截图确认发光聚在对应按钮上。index.css promoCtaBtn 关键帧与 PromoCustomerService.jsx 均已更新。

## 2026-07-21 推文独立 IP 统计（新功能，测试通过 后端100%/前端100%）
- 需求：推文 /p/about 作为"B落地页"，用户用多个带 ?from= 的"A链接"引流，需独立统计。
- 顶部 logo 不再跳官网（PromoPage.jsx 由 Link 改为纯 <img data-testid=promo-logo>）。
- 新集合 db.promo_hits：{slug,type(view|click),target,ip,region,province,source(渠道/A链接),referrer(域名),referrer_full,visitor_id,ua,device,browser,is_bot,bot_reason,date(CN),created_at}。索引(slug,date,type)/(slug,ip,date)。
- 埋点：前端 lib/promoTrack.js（trackPromoView 打开上报+2秒去重；trackPromoClick 按钮点击）。PromoPage 加载上报 view；PromoCustomerService 的 openCs(url,target) 上报 click，target：banner_join/recruit_join/learn/cs/cs_float。
- 后端 POST /api/promos/{slug}/hit：取 X-Forwarded-For IP，lookup_geo_full(ip)（ip-api 含 hosting/proxy 标记），is_bot = UA含爬虫关键词 OR 数据中心 OR 代理；记录全部命中（含 bot，带标记）。
- 后端 GET /api/admin/promos/{slug}/analytics?days&date（require_admin，默认排除 is_bot）：summary(PV/UV/点击/点击UV/已过滤爬虫)、daily[]、sources[](渠道)、referrers[](来源网站)、provinces{}(省份去重,供地图)、targets[](按钮点击分布)、ip_detail[](指定日去重IP明细)。
- 后台新增「推文数据」标签页 PromoAnalytics.jsx：选推文+时间范围(7/30/90)+IP明细日期；汇总卡/每日趋势/来源渠道/来源网站/按钮点击分布/中国省份热力图(复用 ChinaMap)/当日IP明细表。
- 生产上线：Save to GitHub → git pull → 重新 build 前端(deploy.sh)。无需新密钥（ip-api 免费）。
- 待办(可选)：promo_hits 长期增长可加 TTL/定期清理；ip-api 免费限 45/分钟，量大可换离线库。

## 2026-07-21 站内多坐席客服系统（新功能，测试通过 后端100% 23/23 / 前端100%）
- 需求：推文/工具页用站内实时客服替代单个外链；每个坐席=可登录独立工作台的账号；加权轮流分配；坐席自管快捷回复；管理员设全局欢迎语；按坐席统计接待量。
- 集合：cs_agents{id,name,avatar,username,password_hash,weight,enabled,remark,quick_replies[],assigned_count,last_assigned_at}、cs_sessions{id,agent_id,slug,source,referrer,ip,region,unread_agent,unread_visitor,last_message...}、cs_messages{id,session_id,sender(visitor|agent),text,created_at}、cs_config{key:cs,welcome,enabled}。
- 后端：复用 bcrypt+JWT（role=agent）。require_agent/create_agent_token。assign_cs_agent=加权最少分配(assigned_count/weight 最小)。端点：公开 /cs/config、/cs/start、/cs/{sid}/message、/cs/{sid}/messages；坐席 /cs/agent/login|me|sessions|sessions/{sid}/messages|reply|read、/cs/agent/quick-replies；管理 /admin/cs/agents(CRUD)、/admin/cs/config、/admin/cs/stats。实时=2秒轮询。
- 前端：lib/csWidget.js(共享开窗+启用标志+会话ID)；components/CSWidget.jsx(访客聊天窗,乐观消息去重)；PromoCustomerService.openCs 启用则开站内窗否则回退外链；pages/CSWorkbench.jsx(路由/cs，坐席登录+会话列表+聊天+右侧快捷回复)；pages/admin/CSAdmin.jsx(后台「在线客服」标签：系统开关+欢迎语+坐席CRUD+接待统计)。App.js 加 /cs 路由(bare)。
- 坐席工作台：你的域名/cs。演示坐席 agent01/Pass@123。
- 生产上线：Save to GitHub → git pull → 重新 build 前端+重启后端(deploy.sh)。无需新密钥。

## 2026-07-21 客服补充：图片发送 + 3天自动清除（已自测）
- 图片发送：访客端 CSWidget 与坐席工作台均加图片按钮。上传端点：访客 POST /cs/{sid}/upload、坐席 POST /cs/agent/upload（复用 save_image_upload 助手，转 webp、5MB 限制）。消息模型 CSMessageInput 加 image 字段，text/image 至少一个（否则 400）。消息气泡渲染图片（点击新标签查看大图）。
- 3天自动清除：cs_messages 存 created_at_dt(Date)、cs_sessions 存 last_activity_dt(Date)，建 MongoDB TTL 索引 expireAfterSeconds=259200。消息按创建时间、会话按最后活动时间自动清除。标准 MongoDB 特性，宝塔也生效，无需 cron。
- 预览环境已临时设 LOCAL_STORAGE=1 + UPLOAD_DIR=/app/uploads 以便测试图片上传（生产宝塔本就 LOCAL_STORAGE=1）。
- 注：图片上传依赖 LOCAL_STORAGE=1（自托管写本地磁盘）；生产需确保 backend/.env 有此项。

## 2026-07-21 客服改为新窗口 + 消息头像 + 并发修复（已自测）
- 点「联系客服/悬浮/横幅CTA」改为 window.open 打开独立聊天页（新窗口）而非页内弹窗。新增页面 VisitorChat.jsx，路由 /chat（bare，不计入 /track），参数 slug/src(来源渠道)/ref。移除页内 CSWidget.jsx（已删除），PromoCustomerService 挂载时拉取 /cs/config 设置启用标志，openCs 启用则 openCSChatWindow(slug,source) 否则回退外链。
- 客服消息头像：VisitorChat 中客服(agent)每条消息气泡左侧显示坐席头像（无头像则「客服」圆形占位），顶部也有头像。
- 并发修复：cs_start 用 $setOnInsert+upsert 原子创建会话，欢迎语用确定性 id welcome-{sid} upsert，彻底避免 StrictMode/双击导致的重复会话与重复欢迎语。
- 演示坐席 agent01 已设头像（客服小海）。图片发送 + 3天TTL（上一轮）保持不变。

## 2026-07-22 客服页面 UI 高级化升级（前端视觉，逻辑零改动，功能流已测通过）
- 需求：客服页面优化、UI 高级。用户选定：访客聊天页按参照图样式（清爽浅蓝风格）；客服工作台改米白色暖色调。
- 访客页 VisitorChat.jsx：浅蓝主题（页面底色 #eef4fc；顶部状态栏与底部输入区浅蓝 #dceafd/90 玻璃拟态）。底部参照样式=两行布局：第1行 圆角输入框(占位「在这里输入消息」)+✈️发送；第2行 📎发图片 / 🔊新消息提示音开关 / 🔒安全加密标识。消息气泡 framer-motion 弹入动画(visitor=蓝渐变，agent=白底)，带时间戳。空状态欢迎语。
- 新功能 新消息提示音开关：soundOn 持久化 localStorage(hy_cs_sound_on)；Web Audio 轻量 ping（无需音频文件）；仅在非首次加载且开关开启且收到 agent 新消息时响；data-testid=visitor-chat-sound-btn。
- 移动端修复：根容器用 h-[100dvh]（替代 h-screen/100vh），底部输入区加 pb-[max(0.75rem,env(safe-area-inset-bottom))]，解决手机 Safari 工具栏遮挡发送按钮问题。
- 工作台 CSWorkbench.jsx：米白色暖色调（底色 #f6f2e9，侧栏 #fbf9f3，聊天区 #faf8f2，白卡+金色#D4AF37点缀）。三栏(会话列表/聊天/快捷回复)保留；登录页米白卡；会话未读红点脉冲动画；消息 framer-motion 弹入+时间戳；在线状态脉冲点；自定义浅色滚动条。
- index.css 新增工具类：cs-scroll-light/cs-scroll-dark(滚动条)、cs-light-bg(金色点阵底纹)、cs-online-dot(在线脉冲)、cs-glass-light(浅色玻璃)。
- 所有 data-testid 保留；轮询/乐观消息去重逻辑完全未改；后端未改。测试代理 iteration_8 验证双向聊天/去重/快捷回复/图片按钮全通过、零控制台错误。
