# PRD — 跨境代儲商城（Kavip 風格，gogo589）

## 原始需求
- 響應式 Web App（PC + 手機），高度還原 Kavip 版面（橘色主題、mega menu、圖示網格），不使用原商標 logo。
- 前台：首頁、分類、商品詳情（規格/數量）、購物車、結帳（模擬付款）、會員（登入/註冊、訂單）、多幣別顯示（結帳時鎖定價格）。
- 後台：商品、訂單（pending → paid → topping_up → delivered/completed）、客服備註、匯率、優惠碼、評價、用戶管理。
- 技術：React + FastAPI + MongoDB + Clerk Auth（自訂登入 Modal：信箱/手機驗證碼、帳號密碼、Google/Apple）。
- 用戶語言：簡體中文（介面文案為繁體）。

## 架構
- `/app/backend/server.py`（FastAPI + Mongo + seed）、`clerk_auth.py`
- `/app/frontend/src/components/auth/AuthModal.jsx`（自訂 Clerk 登入彈窗）
- pages: Home, Category, ProductDetail, Checkout, MyOrders, Admin, Info

## 已完成（摘要）
- 2026-06 之前：完整 UI（首頁、mega menu、快速下單/熱門分類網格、新聞促銷、頁尾、資訊中心頁）、Clerk 自訂登入 Modal、國碼選擇器。
- 2026-06-12：**修正登入 Modal 在桌機被切掉/溢出**。根因：shadcn `DialogContent` 使用 `grid`，單一 `auto` 欄會被 `<input>` 的固有寬度（Safari/Mac + CJK 字型下很寬）撐大到 >420px，內容被 `overflow-x-hidden` 裁切。修法：`grid-cols-[minmax(0,1fr)] [&>*]:min-w-0`、內層 `min-w-0`、所有 input `size={1}` + `min-w-0`。已用「強制 input size=80」壓力測試三個分頁，scrollWidth === clientWidth === 420。

- 2026-06-12：**修正登入實際不可用的隱患**：`@clerk/react` 6.x 主入口的 `useSignIn` 已是新 Signal API（無 `isLoaded`/`setActive`/`signIn.create`），改從 `@clerk/react/legacy` 匯入，實測信箱送驗證碼已真正呼叫 Clerk sign_ins/sign_ups。
- 2026-06-12：登入 Modal 新增**忘記密碼**視圖（`ForgotPassword.jsx`，透過信箱/手機，`reset_password_email_code` / `reset_password_phone_code`，驗證碼+新密碼+確認密碼+規則提示+返回登入）；抽出 `PhoneInput.jsx`（國碼選擇器）；帳號登入分頁移除「新用戶首次登入將自動註冊」。
- 2026-06-12：新增**活動中心** `/article`（CSS 版 banner「活動中心 / 精選活動合集 / 優惠一站搞定」、全部/優惠活動/充值教學篩選、卡片網格、分頁）與 `/article/:id` 詳情頁（含相關內容）；首頁「新聞 & 促銷」卡片與「查看更多」、頁尾「活動中心」皆連到此。資料在 `src/lib/news.js`（靜態）。

- 2026-06-12：商品購買頁 `/product/:id` 依 Kavip detail 版面重做（麵包屑、橫幅、商品頭、權益條、規格膠囊、數量/總計/原價/購物車/加入購物車/立即購買條、產品說明/評價分頁、相關推薦）。
- 2026-06-12：語言/貨幣選單改為 Popover 面板「選擇您的語言和貨幣」+ 儲存設定。
- 2026-06-12：登入修正：Clerk **Device Trust** 開啟 → 密碼登入回 `needs_client_trust`，modal 新增第二因子驗證碼輸入（prepareSecondFactor/attemptSecondFactor）。移除 Clerk 內建 /sign-in /sign-up 頁（改為回首頁並開啟自家 modal）；結賬/訂單頁登入按鈕改開 modal；登入成功不再整頁 reload。測試帳號見 test_credentials.md（`+clerk_test` 帳號驗證碼 424242）。
- 2026-06-12：結賬頁 `/checkout` 依 Kavip cart 版面重做：購物車（可改數量/刪除）→ 商品總額 → 遞送訊息(ID/備註) + 聯絡資訊(姓名/信箱/手機/其他) → 優惠券卡片（新端點 `GET /api/promos/public`，點卡片套用）→ 支付方式(測試) + 明細 → 支付總額 + 立即支付。E2E 實測：登入→商品→立即購買→套券→模擬付款→訂單詳情 全通。

- 2026-06-12：**Kavip 全站商品同步**：`/app/scripts/kavip_crawl.py`（API `pro-api/openapi/product/all` + SSR detail 頁 Nuxt payload 解碼 `nuxt_decode.py`）抓取 11 分類 / 2,498 商品：規格與價格（specialPrice/salePrice、每日一單等角標）、購買需填資料 `delivery_fields`（text/select/password/textarea + 提示）、副標題、HTML 商品說明、評價。`import_kavip.py` 寫入 Mongo（OpenCC 簡→繁），產品 id = Kavip productId；圖片直接引用 image.vpayfast.com。資料檔 `/app/scripts/kavip_data.json`。
- 後端：Product 新增 subtitle/content_html/delivery_fields/source_id，Spec 新增 sale_price_usd/badge；OrderIn 新增 delivery_info；新端點 `GET /api/products/home`（快速下單/熱門/各分類前 20）；`/api/products` 列表排除大欄位。
- 前端：首頁改用 /products/home；商品頁顯示副標題、角標、原價刪除線、Kavip HTML 說明與「下單需填寫」；結賬頁依商品 `delivery_fields` 動態產生表單（含下拉/密碼）並送出 delivery_info；我的訂單/後台顯示填寫資料；分類頁分頁（42/頁）+ 圖片 lazy。E2E 實測（杏雨直播：登入方式下拉+手機+密碼+暱稱）下單成功。

- 2026-06-12：**圖片本地化**：`scripts/migrate_images.py` 將 2,498 張商品圖上傳至 Emergent Object Storage（`gogo589/products/{id}.ext`），`backend/storage.py`；後端 `GET /api/img/{path}` 代理輸出（記憶體快取 + 30 天 Cache-Control）；product.image 改為 `/api/img/...`（原網址存 image_source）。
- 2026-06-12：**限購規則**：依規格角標判斷 — 含「每日一單」→每帳號 24h 限 1 份；「每月一單」→30 天 1 份；「新客/新用戶/新使用者」→僅首單 1 份。後端 `_check_daily_limit` 於 POST /orders 強制（409），`GET /api/products/{id}/daily-limit` 回傳已鎖規格；前台商品頁顯示提示條、已達限購灰角標、阻擋加入。
- 2026-06-12：**搜尋聯想**：`GET /api/products/suggest?q=`（名稱/品牌/副標題，8 筆含圖）；Header `SearchBox.jsx` 下拉（關鍵字高亮、鍵盤上下、查看全部）。
- 2026-06-12：**分類頁**改 Kavip 版面（橘色漸層＋裝飾、7 欄白卡、21/頁、‹ 1 2 3 … 12 › 分頁器 `Pager`）。
- 2026-06-12：**評價同步**：`scripts/crawl_comments.py` 經 `pro-api/openapi/product-comment/list` 抓全站 464 則評價（日期、國家/地區、回購次數、客服回覆）；用戶名改為遮罩信箱 `首字****末字@domain`；語言依地區：CN→簡體(OpenCC)、TW/HK/MO/MY/SG/未知→繁體、其他→英文（gpt-5.4-mini 翻譯，快取於 kavip_translations.json）；英文評價地區顯示英文國名。商品 rating/review_count 依評價重算。商品頁評價區改版（平均分、地區數、載入更多）。

- 2026-06-13：**會員中心**（Kavip 版面，左側欄：我的帳戶/我的訂單/我的認證/我的優惠券/幫助中心/登出帳戶）`pages/account/*`，路由 /account, /orders, /account/verify, /account/coupons, /account/help。頁首登入後顯示帳號膠囊（信箱）下拉選單。
  - 我的帳戶：帳戶ID/信箱/手機&Google 綁定狀態、個人聯絡資訊（姓名/性別/聯絡方式，`GET/PUT /api/me/profile`）、密碼修改（Clerk user.updatePassword）。
  - 我的訂單：兩欄卡片（訂單編號複製/時間/狀態、圖、規格*數量、填寫資料、金額、刪除訂單(僅未付款 `DELETE /api/orders/{id}`)/再來一單/去付款/查看詳情）；分頁籤 全部/未付款/待審核/認證中/出貨失敗/出貨完成。
  - 我的認證：列表+狀態篩選+空狀態；新增表單（身份認證/金融卡、證件類型、姓名、圖片上傳 ≤2M → Object Storage `gogo589/kyc/...`），`GET/POST /api/me/verifications`；後台 `GET/PUT /api/admin/verifications`。
  - 我的優惠券：優惠券碼兌換 `POST /api/me/coupons/redeem`、已領列表 `GET /api/me/coupons`（折價券/滿減券卡片、已使用/有效期）。
  - 幫助中心：用戶建議/投訴/缺貨登記 → 主題膠囊、內容(≤2000)、聯繫資訊，`POST /api/me/feedback`；後台 `GET /api/admin/feedback`。
  - 全部頁面已用測試帳號實測（儲存資料、訂單列表、兌換券、提交建議、上傳證件）。後台 UI 尚未加入「認證審核 / 反饋」頁籤（P1）。

- 2026-06-13：頁首帳號膠囊改為直接進入 /account（移除下拉）。頁尾客服改 WhatsApp 二維碼（qrcode.react，`GET /api/settings`，後台「網站設定」`PUT /api/admin/settings` 可改號碼/連結/文字）。頁尾支付 Logo 可由後台「支付Logo」上傳/更名/換圖/排序/隱藏/刪除（`/api/payment-logos`、`/api/admin/payment-logos`，圖存 Object Storage）；未上傳時顯示內建樣式。
- 2026-06-13：**修復**首頁熱門分類網格點擊無反應（PagedGrid setPointerCapture 吞掉 click；改為滑鼠拖曳 8px 門檻、不用 pointer capture）。testing_agent iteration_1 全部通過（點擊跳轉、拖曳翻頁、快速下單/熱門商品/搜尋聯想回歸、4 個 API）。

- 2026-06-13：**錢包與錢包付款流程**：`GET /api/me/wallet`、`POST /api/me/wallet/topup`（模擬支付即時入帳，users.wallet_balance_usd + wallet_transactions）；結賬改為**僅錢包餘額付款** `POST /api/orders/{id}/pay-wallet`（餘額不足 402 → 前端導向錢包頁）；充值資料可於付款後補填 `POST /api/orders/{id}/info`；狀態：paid + info_submitted=false →「待填寫資料」，paid →「等待中」，後台「確認充值完成」`POST /api/admin/orders/{id}/confirm` → completed「已完成」。頁首新增「錢包 · 充值」按鈕，會員中心新增「我的錢包」（餘額橫幅/累計充值消費、充值金額/付款方式、交易紀錄）。testing_agent iteration_2 全 12 項通過；錢包頁排版已重做。

- 2026-06-13：**後台三個新頁籤**（拆至 `pages/admin/WalletAdmin.jsx`、`pages/admin/SupportAdmin.jsx`）：
  - 錢包管理：`GET /api/admin/wallets?q=`（餘額/累計入帳/累計消費/交易數，搜尋信箱/姓名/ID）、`GET /api/admin/wallets/{uid}/transactions`、`POST /api/admin/wallets/{uid}/adjust`（credit/debit/refund + 備註；扣款超額 402；交易 kind=admin_*、note 前綴 後台加款/扣款/退款、ref=操作者信箱），會員「我的錢包」同步顯示。
  - 認證審核：篩選、查看證件 `GET /api/admin/verifications/{vid}/image`（回 data_url）、一鍵通過/拒絕 + 備註（會員端同步）。
  - 用戶反饋：待處理/已處理篩選、`PUT /api/admin/feedback/{fid}` 標記已處理（備註、handled_by）/重新開啟。
  - testing_agent iteration_3 全數通過（11 後端 + 前端 E2E）。`tests/mint_token.py <clerk_user_id>` 可鑄造測試用 session JWT。
  - 用戶選擇：**暫不做**訂單狀態郵件通知。

- 2026-06-13：**修復**頁首耳機「客服」按鈕無反應（原本沒有 onClick）。`ServiceWidget` 改橘色主題、加入 WhatsApp 二維碼/按鈕（讀 `/api/settings`）與常見問題連結；匯出 `openService()`（自訂事件），頁首耳機與頁尾「網路客服」皆可開啟右下角客服面板。

- 2026-06-13：**支付管理 + 錢包三頁拆分 + 訂單頁籤**（testing_agent iteration_4 全數通過：16 後端 + 前端 E2E）
  - 後台「支付管理」`pages/admin/PaymentMethodsAdmin.jsx`：錢包充值支付方式 CRUD（名稱、分類 卡支付/電子錢包/銀行轉賬、Logo 上傳、付款說明、支付對接 provider + config（api_key/api_secret/webhook_secret 回傳遮罩、送回遮罩值則保留原值）、限額、手續費、啟用、排序）。`GET /api/payment-methods`（公開、無 config）、`/api/admin/payment-methods*`。首次自動種入 5 筆預設。原「支付Logo」頁籤改名「頁尾支付Logo」。
  - 會員錢包：`/account/wallet` 首頁（餘額橫幅 + 兩張 AI 生成橫幅圖片按鈕 `public/banners/wallet-*.jpg`（Gemini Nano Banana，腳本 `scripts/gen_wallet_banners.py`）+ 最近一筆）、`/account/wallet/topup`（金額 + Kavip 式支付方式網格：分類頁籤、最近使用角標、選中橙框打勾、付款說明、限額；`POST /me/wallet/topup` 帶 `method_id`，記錄 `users.last_payment_method_id`）、`/account/wallet/transactions`（全部/入帳/支出）。側欄「我的錢包」子頁維持高亮。
  - 我的訂單頁籤改為 全部/未付款/等待填寫資料/等待中/已完成（後端 `?status=awaiting_info|waiting`）；卡片標題列改兩行（編號+狀態 / 日期），按鈕統一置於卡片底部一列。
  - 頁首「錢包 · 充值」改為淺橘膠囊「我的錢包」。

- 2026-06-13：**我的帳戶**：移除「刪除帳號」；「綁定手機號」改為真正的 Clerk 綁定流程 `BindPhoneDialog.jsx`（國碼選擇 → `user.createPhoneNumber` → `prepareVerification` → 輸入簡訊驗證碼 `attemptVerification` → 設為主要號碼 `user.update({primaryPhoneNumberId})`，已綁定顯示號碼 + 更換）；標籤欄寬統一（w-20、不換行），提示文字縮小為灰色小字。
  - ⚠️ **阻塞**：目前 Clerk 開發實例（brave-opossum-8609）`phone_number` 屬性為 **停用**（`/v1/environment` 回 enabled=false），`createPhoneNumber` 回 `phone_number is not a valid parameter`。需到 Clerk Dashboard → User & Authentication → Email, phone, username → 啟用 Phone number（驗證方式 SMS code、允許登入）。前端已將此錯誤轉為中文提示。登入視窗的「手機登入」分頁同受此設定影響。測試號碼：+1 201 555 01xx，驗證碼 424242。

- 2026-06-13：**手機版首頁依 Kavip 截圖重做**（<768px）：頂欄橘底白字 AI 公告（連 dbto.ai）；頁首 ☰ / Logo / 右側三圓鈕（會員、客服、幣別），購物車與錢包鈕僅桌機顯示；搜尋列白色圓角常駐於頁首下方；Hero 字級縮小；公告列（喇叭圖示塊 + 文字 + ›）；標題「快捷下單/熱門產品/熱門分類」加橘色底線高亮（`MTitle`，`max-md:after`）；輪播 2.85 卡露出、隱藏箭頭；熱門產品「折扣」角標；活動橫幅兩欄；熱門分類每頁 4×2（`useIsMobile` → perPage 8）、圖示放大、橘色分頁點；底部固定「新用戶註冊最高領 9%優惠券｜立即註冊」深棕列（未登入）；浮動「回頂部」+ 客服白色圓鈕；頁尾手機版：純橘底、支付 Logo 橫向捲動、三欄連結、關注我們、客服方塊（QR + 在線客服）、Trustpilot 置中、版權置中。頁首頂欄桌機維持桃色漸層。

## 待辦（優先序）
- P1：手機版其餘頁面（分類、商品詳情、結帳、會員中心）依用戶截圖逐頁調整。
- P0：testing_agent 跑後台訂單狀態流轉 + 回歸（前台 E2E 已由主代理手測通過）。
- P1：結帳頁多幣別匯率計算驗證。
- 備註：商標 logo 不內建，需由後台上傳。
- 重構：Home.jsx 過於龐大。


## 2026-06 更新
- 移动端商品详情页：分组切换按钮(13px/h-36)、规格按钮(14px/min-h-44 自适应换行)、角标(10px) 文字缩小以匹配 Kavip。
- 相關推薦：爬取 Kavip get-product-related-recommend 存入 products.related_ids，API 回傳 related(補足 8 個)，移動端 4 欄近方形卡片。
- 新聞資訊：爬取 Kavip 51 篇文章(scripts/crawl_articles.py)，品牌字樣改為 GOGO589/gogo589.com，圖片轉存 Object Storage；GET /api/articles、/api/articles/{id}（含閱讀量、上/下一篇）；ArticleCenter/ArticleDetail/Home 改為 API 驅動。
- 移動端分類頁：分類選擇按鈕(Drawer 選單)+行內搜尋欄，隱藏頁首二級搜尋、麵包屑與分類 Tab；商品頁移動端隱藏頁腳。
- 註：部分文章內 135editor.com 裝飾圖片仍為遠端連結（本機無法下載）。
- 商品頁頂部改為 3 張 Banner 上下輪播(DetailBannerCarousel.jsx)：低價氪金 / 添加GOGO589到桌面(重製去除KAVIP, 點擊開教學彈窗) / 註冊送新客優惠包。
- 手機狀態欄顏色：iOS26 Safari 取 sticky header 背景色，header 設為米白 #FFF4EA；加入 manifest.json 與桌面圖示。
- 手機端購物車/結帳頁(Checkout.jsx)重構為 Kavip 樣式：獨立遞送/聯絡卡片、聯絡資訊可折疊、底部固定「支付總額+立即支付」欄；修復其他聯絡方式列橫向溢出。手機端輸入框統一 16px 防 iOS 自動縮放。
- 充值資料提交後鎖定，僅後台「駁回充值資料」(POST /api/admin/orders/{id}/reject-info) 後用戶可重填；結帳頁移除遞送/聯絡區塊；訂單詳情抽屜改為平台米白圓點背景 + 白色圓角卡片風格。(iteration_8 通過)
- 手機端會員中心(/account)改為 Kavip 風格：圖示在上的白卡導航、標題高亮底線、各區塊白卡+左上深色標籤、刪除帳號按鈕；訂單詳情移除帳號/聯絡/金額小計，底部「查看訂單 / 返回首頁」+ 頂部首頁按鈕。(iteration_9 通過)
- 錢包充值頁支付方式：5 個分類 Tab（全部/USDT/卡支付/電子錢包/銀行轉賬，手機一排不換行），卡片顯示品牌 Logo（/frontend/public/payments/*.svg）+ 名稱；付款說明卡改為橘框 + 標籤膠囊風格。後台分類新增 usdt。
- **USDT TRC20 真實網關接入**（print8.2bc8uyz.com，HMAC-SHA256 簽名）：金鑰在 backend/.env（USDT_PAY_API_KEY/SECRET/BASE_URL、APP_PUBLIC_URL 作 notify_url），後台 USDT 方法 config(base_url/api_key/api_secret) 可覆蓋。
  - POST /api/me/wallet/topup/usdt → 建單(topup_orders, 1 USD=1 USDT) 回 pay_url/pay_amount/wallet_address；前端新分頁開收銀台 + 等待面板每 5 秒輪詢 GET /api/me/wallet/topup/{id}（主動查詢網關）。
  - POST /api/payments/usdt/notify 驗簽後冪等入帳，回純文字 success。(iteration_14 全數通過，含 notify 重放不重複入帳)

## 2026-06 三語 + 多幣種（iteration_15 全數通過）
- 語言：zh-CN（預設）/ zh-TW / en。`frontend/src/i18n/index.js` 匯出 `tr(key,...args)`（key 為繁體原文）；字典 `zh-CN.json`（OpenCC 產生）、`en.json`（LLM 產生）；切換語言 = 寫入 localStorage `gt_lang` 後整頁 reload。所有 API 帶 `X-Lang` 標頭。
- 後端 `localize_response` middleware：zh-CN 用 OpenCC 轉換所有 CJK 字串；en 查 `translations` 集合（2 萬筆預翻，`scripts/pretranslate_db.py`），缺漏回傳簡體並由 `Translator` 背景 LLM(gpt-4.1-mini) 補翻（長文如 content_html 只在單筆回應時排程）。跳過 /api/admin、/api/payments、/api/cron、錢包充值等。
- 後台 /admin：介面簡體（tr 字典），API 不轉換（避免存回簡體覆蓋繁體資料）。
- 新增/維護 UI 文案流程：寫繁體並用 `tr("…")` 包住 → `python3 scripts/i18n_codemod.py keys` → `python3 scripts/gen_i18n_dicts.py`（增量產生兩本字典）。
- 搜尋：q 同時以 原文/簡體/繁體 regex 及英文反查比對。
- 貨幣：18 種（USD 預設，KRW/VND/IDR/JPY/TWD 0 位小數），`auto_rate` 旗標；每日 02:00 UTC 平台 cron（.emergent/crons.yml → POST /api/cron/refresh-rates，Bearer WEBHOOK_CRON_SECRET，X-Webhook-Id 去重）從 open.er-api.com 更新；後台手動改匯率即關閉自動。
- 已知限制：含中文文字的圖片（頂部 AI 推廣條、商品頁權益/活動 banner 圖、新用戶註冊角標圖）不會翻譯；英文模式商品頁權益條已改為文字卡。
- 部署需設定 Secrets：USDT_PAY_API_KEY/SECRET/BASE_URL、APP_PUBLIC_URL、WEBHOOK_CRON_SECRET、EMERGENT_LLM_KEY。

## 2026-06 Mailgun 郵件驗證碼 + 充值記錄（iteration_16 全數通過）
- `backend/mailer.py`：Mailgun SMTP（smtp.mailgun.org:587 STARTTLS），env：SMTP_HOST/PORT/USER/PASSWORD、MAIL_FROM、MAIL_FROM_NAME；簡體中文橘色品牌 OTP 郵件模板。
- `backend/email_auth.py`（/api/auth/email/*）：send-code（purpose login/reset/change_password，60 秒冷卻、每小時 6 次、10 分鐘有效、5 次錯誤作廢、HMAC 雜湊儲存於 `email_codes`）、verify（登入/自動註冊 → Clerk Backend API 建用戶 → sign_in_token）、password-login（Clerk verify_password → ticket，繞過新裝置二次驗證）、reset-password、me/send-code、me/change-password。`+clerk_test@` 信箱固定碼 424242 且不寄信。
- 前端：AuthModal 信箱/帳號登入、ForgotPassword 信箱分頁、MyAccount 修改密碼（信箱驗證碼）皆改走後端；手機登入仍走 Clerk SMS。密碼規則 8~32 位、兩種字元。
- 錢包「充值記錄」`/account/wallet/topups`（GET /api/me/wallet/topups，過期自動標記）：狀態分頁、重新開啟收銀台、查詢到帳、複製地址/TX。
- 部署 Secrets 需新增：SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASSWORD、MAIL_FROM、MAIL_FROM_NAME。

## 2026-06 登入視窗重構 + SUBMAIL 國際簡訊
- 登入分頁：帳號登入（預設）/ 驗證碼登入（子選項：手機驗證碼(預設)/郵箱驗證碼，僅限已註冊）；登入旁「註冊」→ Register.jsx（手機號碼註冊(預設)/郵箱註冊）；我的帳戶底部「退出帳戶」。手機版 /article、/info 隱藏頁尾。iOS PWA 鍵盤位移修正（AuthModal useEffect scrollTo + 高度同步，PhoneInput 搜尋框不自動聚焦）。
- 手機 OTP：`backend/sms.py` SUBMAIL internationalsms xsend（env SUBMAIL_APPID/APPKEY/PROJECT=VS8zK，模板 @var(code) @var(time)）。**+86 中國大陸不支援**（回 400 提示用郵箱）；待用戶提供中國簡訊平台再接。測試號 +1201555xxxx 固定碼 424242 不發送。
- 手機帳號：Clerk 不支援 phone，故以佔位信箱 `p{digits}@phone.gogo589.com` 建 Clerk 用戶 + public_metadata.phone，映射存 `phone_accounts {phone,user_id}`；前端 `userLabel/userEmail/userPhone`(lib/api.js) 顯示手機而非佔位信箱。端點：/api/auth/email/phone/{send-code,register,verify,reset-password}；password-login 支援 + 開頭手機識別。
- 部署 Secrets 新增：SUBMAIL_APPID、SUBMAIL_APPKEY、SUBMAIL_PROJECT。

## 2026-06 後台重做（iteration_17 後端 24/24、前端通過）
- 獨立後台登入 `/admin/login`：帳密（Clerk verify_password）→ Google Authenticator TOTP（pyotp，首登顯示 QR/密鑰綁定，存 `admin_2fa`）→ 回 Clerk ticket + `admin_token`(HMAC 12h)。前端 sessionStorage `admin_token`，`useApi` 自動帶 `X-Admin-Token`；已綁定 2FA 的管理員呼叫 /api/admin/* 必須帶此標頭（否則 401 admin_2fa_required）。
- `backend/admin_api.py`：/api/admin/topups(+requery/credit 手動補單)、/members(+詳情/ban/unban/reset-password)、/translations(+retranslate)、/notifications(+test、/sms/balance)、/reports(json/csv)。通知 hook：USDT 到帳、訂單完成、資料駁回 → 依 settings.notifications 模板寄郵件/簡訊。
- 前端：淺色 Kavip 商戶風（index.css `.admin-light` 覆寫舊深色 class）、側欄分組（總覽 / 財務管理 / 運營管理 / 活動管理(活動配置=網站設定, 優惠碼) / 會員與數據 / 系統設定）、新頁面 pages/admin/{Topups,Members,Reports,Translations,Notifications}Admin.jsx + ui.jsx。
- 業主後台帳號：admin@gogo589.com（見 test_credentials.md）。

## 2026-06 活動配置 + 網站配置 CMS（iteration_18 後端 15/15、前端全通）
- `backend/cms_api.py`：
  - 網站配置 `GET /api/site-config`（公開，回預設+DB 合併）、`PUT /api/admin/site-config`（分區塊儲存；`data:image` 字串自動上傳 Object Storage `gogo589/cms`；中文自動轉繁體）、`POST /api/admin/site-config/reset {section}`。區塊：logo / top_promo / hero / announcement / promo_banners / detail_banners(mobile,pc) / features / register。
  - 活動（沿用 `articles` 集合，新增 type promo|tutorial|news、start_at/end_at、link）：`GET/POST /api/admin/articles`、`GET/PUT/DELETE /api/admin/articles/{id}`、`POST /api/admin/articles/upload`（富文本插圖）。公開 `GET /api/articles?type=` 只回上架且在活動時間內的項目（到期自動隱藏）。既有 51 篇文章已補 type。
- 前端：`lib/siteConfig.js` `useSiteConfig()`（模組快取 + 監聽）；Home / Header / Footer / DetailBannerCarousel 全部改讀配置。後台新頁 `admin/ActivitiesAdmin.jsx`（表格、篩選、搜尋、新增/編輯對話框、封面上傳、react-quill-new 富文本、活動時間、上下架）與 `admin/SiteConfigAdmin.jsx`（9 個分頁、儲存此區塊/恢復預設、客服 WhatsApp 併入）。側欄：活動管理 → 活動配置 / 優惠碼；系統設定 → 網站配置。
- 活動中心 `/article` 新增類型頁籤（全部/優惠活動/充值教學/新聞公告）；詳情頁若有 link 顯示「立即參與」。

## 2026-06 商品管理重做 + 分類管理（iteration_19 後端 18/18、前端全通）
- 後端：`GET /api/admin/products`（q/category/active/ids/page/size 分頁）、`GET /api/admin/products/badges`（角標建議）、`GET /api/admin/products/{id}`（含 related 名稱）、POST/PUT（`_prep_product`：圖片 data URL 上傳、簡→繁、規格 new-id 換 uuid、第一個下單欄位同步 account_field_label/hint）、`PATCH`（active/sort_order/sales_count/tags 快速改）。ProductIn 新增 related_ids。
- 分類：`GET/POST /api/admin/categories`、`PUT/DELETE /api/admin/categories/{id}`（有商品時 409）；新增 active 旗標，公開 `/api/categories` 與 `/api/products/home` 只回顯示中的分類。
- 前端：`admin/ProductsAdmin.jsx`（表格 30/頁、搜尋防抖、分類/狀態篩選、行內排序與上下架；編輯對話框 5 分頁：基本資訊+圖片上傳 / 規格與價格(售價、原價、角標 datalist、有貨、排序) / 下單需填寫(欄位類型、必填、提示、下拉選項) / 商品說明(富文本) / 相關推薦(搜尋加入)）、`admin/CategoriesAdmin.jsx`。側欄運營管理新增「分類管理」。

## 2026-06 批量商品操作 + 訂單管理升級 + 規格限購設定（iteration_20 後端 30/30、前端全通）
- 批量：`POST /api/admin/products/bulk {ids, action: set_active|set_category|add_tags|remove_tags|delete, value}`；前端表格勾選（全選/單選）→ 批量列（上架/下架/移動分類/加標籤/移除標籤/刪除）。
- 訂單：`GET /api/admin/orders?status&q&date_from&date_to&info&page&size` → {total, rows, summary{total_usd, paid_usd, by_status}}；`GET /api/admin/orders/export`（CSV, BOM, 繁體表頭）。`admin/OrdersAdmin.jsx`：統計卡、搜尋、日期區間+快捷（今天/7天/30天/本月）、狀態頁籤含數量、展開列顯示填寫資料與操作按鈕、匯出 CSV。
- 限購：Spec 新增 `limit`（'' 依角標自動 / none 不限 / daily / weekly / monthly / lifetime / newcomer）與 `limit_count`；後端 `_spec_limit` 統一判斷，下單按視窗內已購份數扣減；`/daily-limit` 回傳 remaining。商品頁提示文案支援每週/終生/多份。後台規格表新增「限購」欄（下拉 + 份數）。

## 2026-06 錢包充值前台驗證 + 訂單狀態通知（iteration_22 前端 24/24、iteration_23 後端 20/20 + 前端全通）
- 錢包充值前台（金額/支付方式分類/銀行轉帳上傳憑證/Stripe 跳轉收銀台/後台審核入帳/支付方式停用啟用）全部實測通過；先前 E2E 失敗純因腳本以繁體文字定位（UI 為簡體）。
- 通知：`admin_api.notify_user` 事件 order_paid（pay-wallet / pay）、order_completed（confirm 與 PATCH completed）、order_cancelled（PATCH cancelled）、order_rejected、topup_paid；`order_ctx()` 提供 {order_id} {product} {amount} {reason} {balance}；品牌 HTML 郵件 `mailer.notify_email`；簡訊改用 `sms.send_sms_text`（SUBMAIL send.json 自由內容，+86 不支援）；每次發送寫入 `notification_logs`（channel/to/subject/body/status/error）。
- 端點：`GET /api/admin/notifications/logs?event&status&q&limit`、`POST /api/admin/notifications/logs/{lid}/resend`。
- 訂單新增狀態 `cancelled`（已取消）：PATCH 為 cancelled 且原狀態已付款(錢包)→自動 refund 入錢包（refunded_at/refund_usd，冪等）；後台訂單列「取消訂單」按鈕（prompt 原因→通知用戶）、已退回錢包提示；狀態頁籤/統計含已取消。
- 後台「通知設定」頁：5 事件卡（含訂單已取消）、模板變數提示、發送記錄表（事件/狀態/搜尋篩選、展開內容、重發）。

## 2026-06 PayPal 接入收尾（iteration_24 後端 9/9、前端全通）
- `payments_api._paypal_cfg`：後台 PayPal 配置留空時回退 `.env` PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV(sandbox|live) / PAYPAL_WEBHOOK_ID（目前皆為空 → 下單回 503「PayPal 尚未設定」；憑證錯誤回 502「PayPal 憑證無效」）。流程：Orders v2 建單 → 跳轉 approve → 返回 /account/wallet/topups?topup=id 輪詢 → APPROVED 自動 capture → settle 入帳。
- 新增 `POST /api/webhook/paypal`（CHECKOUT.ORDER.APPROVED / PAYMENT.CAPTURE.COMPLETED，依 custom_id/order_id 找單；設定 webhook_id 時以 verify-webhook-signature 驗簽）。
- 新增 `POST /api/admin/payment-methods/{id}/test`（PayPal/Stripe 連線測試，回 env/來源/webhook_url；webhook_url 優先 APP_PUBLIC_URL）。後台支付管理列新增「測試連線」按鈕、PayPal 配置新增 Webhook ID 欄；充值頁底部提示依方式顯示。
- **待用戶**：提供 PayPal Client ID / Secret（填入 .env 或後台 PayPal 配置），並於 PayPal 後台設定 Webhook 指向 {APP_PUBLIC_URL}/api/webhook/paypal。部署 Secrets 新增：PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET、PAYPAL_ENV、PAYPAL_WEBHOOK_ID。

## 2026-06 後台 UI 調整（用戶逐頁審閱）
- 移除側欄「錢包管理」頁；加款/扣款/退款表單併入「會員管理 → 會員詳情」抽屜（`MembersAdmin.jsx` WalletAdjust，`MemberDetail` 已 export 供其他頁重用）。`WalletAdmin.jsx` 已刪除。
- 支付管理 `PaymentMethodsAdmin.jsx` 改淺色高對比設計：列只保留 停用/啟用、編輯、排序、刪除；「更換 Logo」與「測試連線」移入編輯對話框。
- 充值訂單 `TopupsAdmin.jsx` 重做：工具列（日期區間 + 今天/7天/30天/本月 + 查詢 + 清除）、狀態頁籤含數量、欄位僅 日期時間 / 帳戶ID（點擊開會員詳情）/ 付款方式（Logo）/ 付款金額（應付）/ 單號·轉帳碼（可複製）/ 操作（狀態膠囊 + 憑證預覽彈窗 + 審核通過/駁回/手動入帳/重查網關）。後端 `GET /api/admin/topups` 改回 `{rows, counts, total}` 並支援 date_from/date_to、信箱/手機/轉帳碼搜尋。

## 2026-10 帳戶ID統一 + 支付管理精簡 + 會員管理改版（iteration_25 後端 7/7、前端全通）
- **帳戶ID統一**：後台所有「帳戶ID」改用與前台「我的帳戶」一致的數字帳號 `account_no`（md5(user_id) → 9 位數字，`admin_api.account_no()`，與 `/api/me/profile` 同公式）。充值訂單列、會員列表/詳情均顯示數字帳號；移除舊的 email 副標與長 clerk user_id 行。充值搜尋支援輸入數字帳號。
- **通道編號**：支付方式/充值訂單新增 `channel_no`（`CH` + 5 位數字，由 method_id 生成，`server.py._channel_no`）。充值訂單「付款方式」欄只顯示 Logo 圖標 + 通道編號（移除名稱文字）。
- **支付管理 `PaymentMethodsAdmin.jsx`** 改為規整表格：欄位＝通道編號 / 收款方式(圖標) / 狀態 / 操作(停用啟用+配置) / 排序；刪除移入「配置」彈窗底部。表頭+懸停高亮，與充值訂單表風格統一。
- **會員管理移至側欄第二位**（`Admin.jsx` NAV = [overview, members]；原「會員與數據」群組改名「數據」僅含報表）。
- **會員管理 `MembersAdmin.jsx` 改版**：頂部 4 統計卡（總用戶/活躍/近30天新增/封禁，`GET /api/admin/members/stats` 回 {total, active, new, banned}）；表格含 帳戶ID / 頭像(漸層首字) / 會員 / 手機 / 等級(依累計消費 普通<300≤白銀<1000≤黃金) / 訂單數·消費 / 餘額 / 註冊時間 / 狀態 / 詳情；右側詳情面板（深色漸層頭像卡 + 已實名/高價值徽章 + 基本信息 + 帳戶數據 + 封禁/重置密碼/餘額調整 + 最近訂單/流水）。`GET /api/admin/members/{uid}` 新增 account_no/verified/order_count/spent_usd 並以聚合計算餘額與消費。
- data-testid：member-stat-{total|active|new|banned}、members-table、members-search、members-tab-{all|active|banned}、member-view-{uid}、member-detail、pm-table、pm-channel-{id}。

## 2026-10 後台資訊架構重構 Round 1（iteration_26 前端 100% 功能通過）
- 後台側欄改為**可展開/收起的二級菜單**（`Admin.jsx` MENU 常數 + NavGroup 元件 + PAGES 映射 + Soon 占位頁）。使用者點擊分組標題展開/收起子項；儀表盤、用戶管理預設展開。
- 完整菜單（分組 → 子項）：儀表盤(數據概覽/銷售分析/實時監控/下載報表)、用戶管理(用戶列表/用戶等級/用戶標籤/會員資產/黑名單/用戶日誌/用戶認證/用戶批量操作/用戶反饋/用戶報表統計)、商品管理(商品列表/新增商品/商品分類/規格管理/庫存管理/商品評論)、禮品卡管理(列表/創建/卡券核銷記錄/訂單/核銷API配置)、運營管理(首頁裝修/輪播圖/推薦位/優惠券/積分/消息中心/公告)、活動管理(活動列表/秒殺/充值活動/滿減滿折/抽獎/組合套餐/活動記錄)、財務管理(訂單管理/訂單結算/資金流水/支付渠道配置/財務對賬/匯率配置/財務報表)、系統配置(基礎設置/管理員管理/角色權限/操作日誌/短信配置/郵箱配置/授權配置/翻譯管理/頁尾Logo) + 葉節點 安全配置。
- 已接現有頁面（18 個 slot）：overview→Dashboard、members→會員管理、verifications、feedback、products、categories、reviews、promos、notifications、activities、orders、topups(資金流水)、payments(支付渠道配置)、currencies(匯率配置)、siteconfig(基礎設置)、translations、paylogos、download-reports→ReportsAdmin。其餘 ~37 個子項渲染 `Soon` 占位頁（data-testid admin-soon，標「功能開發中」）。
- data-testid：分組 `admin-group-{ascii key}`（dashboard/users/products/giftcards/ops/activities/finance/system，已與 i18n 標籤解耦）；子項 `admin-nav-{key}`；葉 `admin-nav-security`。
- **待辦（後續 Round 分批開發真實模組）**，建議順序：用戶管理子模組（用戶等級/標籤/會員資產/黑名單/用戶日誌/批量操作/報表）→ 積分管理 → 禮品卡管理 → 活動管理（秒殺/充值活動/滿減滿折/抽獎/組合套餐）→ 運營（首頁裝修/輪播圖/推薦位/公告）→ 系統（管理員/角色權限/操作日誌/短信郵箱授權配置/安全配置）→ 財務（訂單結算/財務對賬/財務報表）→ 儀表盤（銷售分析/實時監控）。

## 2026-10 後台 Round 2：用戶管理模組 + 積分管理（iteration_27 後端 15/15、前端 100%）
- **用戶等級**（`UserLevelsAdmin.jsx` + `/api/admin/member-levels` CRUD）：可配置等級（名稱/累計消費門檻/專屬折扣%/顏色），依累計消費自動判級；首次 GET 自動播種 普通/白銀/黃金/鑽石。`_levels()`/`_level_of()` in admin_api。會員列表與詳情回傳 `level{name,color,discount_percent}`。
- **用戶標籤**（`UserTagsAdmin.jsx` + `/api/admin/user-tags` CRUD + `/members/{uid}/tags`）：自定義標籤（名稱/顏色），在會員詳情 TagsEditor 打標籤；刪除標籤會從所有用戶移除。
- **會員資產**（`MemberAssetsAdmin.jsx` + `/api/admin/member-assets`）：總餘額/總積分/會員數統計卡 + 餘額/積分/優惠券明細表。
- **黑名單管理**（`BlacklistAdmin.jsx` + `/api/admin/blacklist`）：列出被封禁會員（原因/時間）、一鍵解封。ban/unban 擴充 `ban_reason`+`banned_at`，並寫入用戶日誌。
- **用戶日誌**（`UserLogsAdmin.jsx` + `/api/admin/user-logs`）：記錄 下單/訂單付款/充值到賬/積分調整/封禁解封 等行為；類型頁籤 + 搜尋。`log_user()` in server.py。
- **積分管理**（`PointsAdmin.jsx` + `/api/admin/points/config` GET/PUT、`/points/ledger`、`/members/{uid}/points/adjust`）：規則配置（每 USD$1 積分、下單/充值開關、抵現比例）+ 積分明細。`award_points()` in server.py 在**訂單付款**（pay-wallet 與 admin /pay）與**充值到賬**（_usdt_settle）時按金額發放，依 (user_id, source, ref) 冪等；會員詳情可手動加/扣積分。
- 會員詳情新增：積分顯示、等級（含折扣）、標籤編輯、積分調整。
- data-testid：levels-admin/levels-table/level-*、tags-admin/tags-grid/tag-*、assets-admin/assets-table/asset-*、blacklist-admin/blacklist-*、userlogs-admin/userlogs-*、points-admin/points-tab-*/points-*、member-tags/member-tag-*/member-points-adjust/points-add/points-sub。
- 修復：`/points/adjust` 投影 `{points:1}` 在用戶無 points 欄位時塌陷為 `{}` 誤報 404 → 改為 `if u is None`（已測 15/15 通過）。
- **後續**：Round 3 禮品卡管理（列表/創建/核銷記錄/訂單/核銷API）、Round 4 營銷活動（秒殺/充值贈送/滿減滿折/抽獎）。建議後續補：point_transactions 建 (user_id,source,ref) 唯一索引防併發重複發放。

## 2026-10 後台 Round 3：積分抵現前台 + 等級權益前台（iteration_28 前端 6/6 + 下單 e2e 全通，後端 curl 已驗）
- **新增** `POST /api/orders/quote`（會員）：回傳即時報價 {subtotal_usd, discount_usd(promo), level_discount_usd, level_name, level_discount_percent, points_used, points_discount_usd, total_usd, points_available, level, redeem_enabled, points_per_usd_redeem, min_redeem}。
- `_compute_order(order, member_ctx)`：先套 promo，再套**等級專屬折扣**（按 level.discount_percent），再套**積分抵現**（受 min_redeem / 可用積分 / 剩餘金額 上限約束）。`_member_context()` 計算累計消費→等級、積分。
- `OrderIn` 新增 `use_points`。`create_order` 落盤 level_discount/points_used 等欄位並在下單時扣積分（point_transactions source=redeem）；訂單取消時退回積分（source=redeem_refund，冪等）。
- `/me/profile` 補 level{name,color,discount_percent}、points、spent_usd。
- **前台 Checkout.jsx**：拉 `/orders/quote`，顯示「等級專屬折扣」行（checkout-level-discount）、「使用積分抵現」卡片+開關（checkout-points-card/checkout-points-toggle）、積分抵現行（checkout-points-discount），總額以 quote.total_usd 為準；下單送 use_points。promo + 等級折扣 + 積分可疊加。
- **前台 MyAccount.jsx**：帳戶基礎資訊顯示「會員等級」徽章（account-level，含專屬折扣文案）與「我的積分」（account-points）。
- 積分配置預設啟用抵現：redeem_enabled=true, min_redeem=100, points_per_usd_redeem=100（管理員可在「積分管理」調整/關閉）。
- 驗證：subtotal 5.38 → 白銀2%(-0.11) → 5.27；開積分→抵至 0.00；+promo GLOBAL2026(10%) 疊加正確；下單後積分正確扣減並落賬。
- **後續**：Round 4 禮品卡管理、Round 5 營銷活動（秒殺/充值贈送/滿減滿折/抽獎）。建議：point_transactions 加 (user_id,source,ref) 唯一索引；積分抵現可擴充為「自訂抵扣數量」而非單一開關。

## 2026-10 後台 Round 4：自定義抵扣 + 等級進度條（後端 curl 驗證、前端編譯通過）
- **自定義抵扣**：Checkout 積分卡改為「開關 + 自訂數量輸入框（checkout-points-input）+ 全部按鈕（checkout-points-max）」，可輸入任意抵扣積分；後端 `_compute_order` 仍以 可用積分/min_redeem/剩餘金額 封頂，低於 min_redeem 顯示提示。
- **等級進度條**：`_member_context`/`/me/profile` 新增 `next_level{name,min_spend_usd,remaining}`（下一等級門檻與差額）；MyAccount 新增「升級進度」進度條（account-level-progress）顯示「再消費 USD$ X 即可升級至 Y」，已達頂級顯示 account-level-max。
- 驗證：profile 返回 白銀(spent 832.79)→next 黃金(1000, remaining 167.21)；quote use_points>持有 時正確封頂（5<min_redeem100 → 不抵）。
- **後續大模組**：Round 5 禮品卡管理（列表/創建/核銷記錄/訂單/核銷API）、Round 6 營銷活動（秒殺/充值贈送/滿減滿折/抽獎）。

## 2026-10 後台 Round 5：充值贈送 + 升級禮包（後端直測驗證通過，前端編譯通過）
- **充值贈送**（`RechargeBonusAdmin.jsx` → 活動管理「充值活動」slot；`/api/admin/recharge-bonus` CRUD）：規則 {min_usd, bonus_type(fixed_usd|percent|points), bonus_value, active}。充值到賬時 `apply_recharge_bonus()` 取「最高符合門檻」規則發放（固定金額/比例→錢包 topup_bonus；積分→point_transactions source=recharge_bonus）。公開端點 `/api/recharge-bonus/public`；錢包充值頁顯示動態贈送橫幅（topup-bonus-banner）。已播種 2 條示例規則（充值50送$5、充值100送500積分）。
- **升級禮包**：member_levels 新增 `reward_points` + `reward_coupon_code`（UserLevelsAdmin 表單「升級禮包」區：level-reward-points / level-reward-coupon）。訂單付款後 `check_levelup()` 偵測等級提升（以 user.level_name 為基準，首次下單設基準不獎勵），升級時發放積分（source=levelup）+ 認領指定優惠券到 user_coupons（source=levelup，已領則冪等跳過）+ 寫日誌。
- 驗證：apply_recharge_bonus(120)→命中100檔+500積分；check_levelup 普通→白銀 +200積分、等級更新、優惠券因已領取而正確跳過（冪等）。
- data-testid：recharge-bonus-admin/rb-table/rb-add/rb-row-*/rb-modal/rb-min/rb-type/rb-value/rb-save、topup-bonus-banner、level-reward-points/level-reward-coupon。
- 說明：前端管理頁與充值頁橫幅已編譯通過但未跑視覺測試；後端邏輯已直測。**後續**：Round 6 禮品卡管理、Round 7 其餘營銷活動（秒殺/滿減滿折/抽獎）。

## 2026-10 後台 Round 6：禮品卡管理 + 升級禮包提醒 + 充值贈送回執（後端 curl/直測通過，前端編譯通過）
- **禮品卡管理**（`GiftCardsAdmin.jsx` 導出 3 頁；admin_api `/admin/gift-cards*`）：
  - 禮品卡列表(giftcards)+創建(giftcard-new)→ GiftCardsAdmin：統計卡(未使用/已核銷/發行總額/已核銷額) + 列表(卡號/面額/狀態/批次/時間/停用/刪除) + 批量創建 modal(數量1~500、面額、備註，生成後可複製全部卡號)。
  - 卡券核銷記錄(giftcard-redeem)+禮品卡訂單(giftcard-orders)→ GiftCardRedemptionsAdmin：已核銷卡列表（卡號/面額/用戶/方式[用戶充值|外部API]/時間）。
  - 核銷API配置(giftcard-api)→ GiftCardApiAdmin：X-Api-Key + endpoint + curl 示例 + 重新生成。
  - 核銷流程：卡 {code,face_value_usd,status(active|redeemed|disabled),batch_no,redeemed_by/at/via}。會員 `POST /api/me/redeem-giftcard {code}` → 原子認領 + `_wallet_tx(kind=giftcard)` 充值錢包（WalletTopUp 頁新增禮品卡充值框 giftcard-redeem-box/giftcard-code-input/giftcard-redeem-btn）。外部 `POST /api/giftcard/redeem`（X-Api-Key，來自 settings.giftcard_api）→ 核銷返回 {valid,face_value_usd}；重複 400、錯誤 key 401。
- **升級禮包提醒**：admin_api 新增 `level_up` 通知事件（EVENT_TITLES/DEFAULT_NOTIFY 模板「恭喜升級為 {level}，{reward}」）；`check_levelup` 升級時 `notify_user(level_up)`（郵件；站內以 MyAccount 等級/積分/優惠券更新呈現）。
- **充值贈送回執**：MyWallet 的 KIND_LABEL/TX_ICONS 新增 `topup_bonus`(充值贈送, 禮物圖標橙) 與 `giftcard`(禮品卡充值, 紫)，使贈送/禮品卡入帳在錢包流水中單獨標識。
- 驗證：member redeem 100→125；external api redeem OK/reuse 400/bad-key 401；topup_bonus 與 levelup 於前幾輪已驗。
- **後續**：Round 7 營銷活動補全（秒殺 / 滿減滿折 / 抽獎）。

## 2026-10 後台 Round 7：滿減/滿折活動 + 結算頁自動應用（後端 curl 驗證通過，前端編譯通過）
- **滿減/滿折**（`CartPromoAdmin.jsx` → 活動管理「滿減/滿折活動」discount-activity slot；admin_api `/admin/cart-promotions` CRUD）：規則 {title, promo_type(reduce|percent), threshold_usd, value, active, start_at, end_at}。
- `_compute_order` 在 promo 之後、等級折扣之前自動套用「訂單滿額」最優惠的一檔（多檔取 discount 最大），寫入 extras.cart_discount_usd / cart_promo_title，並落盤到訂單。公開端點 `/api/cart-promotions/public`。
- **結算頁自動應用**：Checkout 報價顯示 checkout-cart-discount 行（活動名稱 + 減免），與 促銷碼 / 等級折扣 / 積分抵現 疊加，總額即時更新。
- 驗證：subtotal 104.28 → 命中「滿100減15」(-15) → 白銀2%(-1.79) → total 87.49，正確取最優檔並疊加。已播種 2 條示例（滿50減5 / 滿100減15）。
- data-testid：cartpromo-admin/cp-table/cp-add/cp-row-*/cp-modal/cp-type/cp-threshold/cp-value/cp-save、checkout-cart-discount。
- **後續**：秒殺活動、抽獎活動（積分抽獎）、禮品卡當商品賣（下單自動發卡）。

## 2026-10 後台 Round 8：秒殺 + 積分抽獎轉盤 + 禮品卡當商品賣 + 滿減進度提示（iteration_29/30，前端 E2E 6/6 通過；後端 curl 全驗）
- **秒殺活動（限時特價+限量+每人限購）**（`FlashSaleAdmin.jsx` → 活動管理「秒殺活動」flashsale slot；admin_api `/admin/flash-sales` CRUD）：規則 {title, product_id, spec_id, flash_price_usd, stock, per_user_limit, start_at, end_at, active, sold}。後台可搜尋商品→選規格、設秒殺價/庫存/每人限購/時間。
  - `_flash_for(product_id, spec_id)`（server.py）回傳在時間窗內、未售罄的秒殺；`_compute_order` 以秒殺價替代規格原價（在滿減之前生效），items_out 帶 `flash_id/flash`。
  - `create_order`：原子預扣庫存 `find_one_and_update($expr sold+qty<=stock, $inc sold)`；per_user_limit 以 `_user_flash_bought`（跨未取消訂單累計）校驗，超限回 409。訂單取消（admin PATCH cancelled）時以 `flash_released` 旗標冪等回補 sold。
  - 公開 `GET /api/flash-sales/public`（join 商品名/圖/原價、remaining、end_at）。首頁 `FlashSaleSection`（秒殺卡 + 原價刪除線 + 搶購進度條 + `Countdown` 倒計時）。
  - **結算頁秒殺價顯示修復**（iteration_29 發現 HIGH bug）：Checkout 原本用 CartContext 原價算小計 → 顯示原價。改為 fetch `/flash-sales/public` 建 flashMap，`effUnit/effSubtotal` 覆蓋購物車行價、小計、滿減提示與優惠券門檻；購物車行加「秒殺價」角標 + 原價刪除線。總額仍以 `/orders/quote`（後端已套秒殺）為準。
- **積分抽獎轉盤**（`LotteryAdmin.jsx` → 活動管理「抽獎活動」lottery slot；admin_api `/admin/lottery` GET/PUT、`/admin/lottery/draws`、`/draws/{id}/fulfill`）：設定存 settings key=lottery，含 {enabled, cost_points, prizes:[{id,label,type,value,weight,stock,color}]}。獎品類型 points/balance/coupon/physical/none；後台配置權重（即時顯示概率%）、庫存、顏色；中獎記錄表可標記實物已發放。`get_lottery_cfg()` 首次自動播種 6 檔預設。
  - 會員 `GET /api/lottery/config`（公開，隱藏權重）、`POST /api/lottery/draw`（扣 cost 積分→加權隨機→發放：積分/餘額`_wallet_tx(lottery)`/優惠券(user_coupons)/實物記錄/空獎；限量獎品原子扣庫存；寫 lottery_draws + user_log）、`GET /api/lottery/my-draws`。
  - 前台 `Lottery.jsx`（/lottery 路由）：conic-gradient 大轉盤 + 中心抽獎鈕 + ~4s 旋轉動畫 + 結果彈窗 + 我的中獎記錄；未登入點抽獎開 AuthModal。首頁 `home-lottery-entry` 入口卡 + 我的帳戶積分列 `account-lottery-btn` 入口。
- **禮品卡當商品賣**（下單自動發卡，c2 付款時即時生成新卡號）：Product/ProductIn 新增 `is_giftcard`，Spec 新增 `giftcard_value_usd`。ProductsAdmin 基本資訊加「禮品卡商品」開關，規格表（開啟時）加「卡面額 USD」欄。
  - `dispatch_giftcards(order)`（server.py）在 pay-wallet 與 mock /pay 付款成功後，對 is_giftcard 商品每份生成一張 `gift_cards`（status active, batch_no=ORDER, source_order, sold_to, 面額=giftcard_value_usd||售價），冪等旗標 `giftcards_dispatched`，卡號寫入 `order.giftcard_codes`。MyOrders 訂單詳情 `order-giftcard-codes` 區顯示卡號 + 複製鈕，引導至「我的錢包→禮品卡充值」兌換。
- **滿減進度提示**：Checkout `promoHint`（讀 `/cart-promotions/public`）：未達門檻顯示 `checkout-cartpromo-hint`「再買 USD$ X 即可立減/享N折（活動名）」，已達顯示「已滿足滿減」。
- data-testid：flashsale-admin/fs-*、lottery-admin/lottery-*、flash-sale-section/flash-item-*/flash-countdown、home-lottery-entry、lottery-page/lottery-wheel/lottery-draw-btn/lottery-points/lottery-result、cart-flash-badge-*、checkout-cartpromo-hint、order-giftcard-codes/order-giftcard-copy-*、pf-giftcard/pf-spec-giftcard-*、account-lottery-btn。
- 驗證：秒殺 quote 8.68（=4.34×2）、per-user limit 2 超限 409、sold 原子預扣；抽獎扣 100 積分並發 50 積分/$0.5 餘額；禮品卡付款生成 2 張 $10 卡掛單；admin flash/lottery CRUD 全通；結算秒殺價 6/6 E2E 通過。
- **後續（未做）**：活動管理剩餘 slot（組合套餐 combo、活動記錄 activity-records）；秒殺倒計時歸零自動刷新/下架；首頁裝修/輪播圖/推薦位等運營 slot。

## 2026-10 後台 Round 9：組合套餐 + 秒殺收尾態 + 抽獎進階 + 首頁裝修（iteration_31 前端 10/10 通過；後端 curl 全驗）
- **組合套餐**（`CombosAdmin.jsx` → 活動管理「組合套餐」combo slot；admin_api `/admin/combos` CRUD + `_enrich_combo` 回原價）：規則 {title, image, items:[{product_id,spec_id,quantity}], price_usd, active, sort_order}。公開 `GET /api/combos/public`（含每項 price_usd、original_total_usd）。
  - OrderItemIn 新增 `combo_id`；`_compute_order` 將同 combo_id 的商品組折價至套餐價（combo_discount_usd，在 promo/滿減之前），extras + 訂單落盤 combo_discount_usd/combo_title。CartContext 新增 `addCombo`（展開套餐商品帶 combo_id 入購物車）；首頁 `CombosSection`（套餐卡 + 原價刪除線 + 立即搶購→加購物車跳結算）；結算頁 `checkout-combo-discount` 行。
  - 驗證：subtotal 60.67 → 套餐 -50.68 → 9.99 → 滿50減5 → 2% → 4.89。
- **秒殺收尾態**：`Countdown` 歸零顯示「已結束」並回調 `onExpire` 重新拉 `/flash-sales/public`；秒殺卡 remaining<=0 顯示「已搶光」遮罩（flash-soldout-*）。
- **抽獎進階**：lottery 設定新增 `free_daily`；`GET /api/lottery/my-status`（points/cost/free_available）；`POST /api/lottery/draw {count}` 支援 count=1/10，單抽每日首次免費（free_used，`_free_draw_used_today`），連抽十次扣 cost×10；`_pick_and_grant` 抽出到為批次共用。前台 Lottery 加「連抽十次」按鈕（lottery-draw-btn-10）、今日免費徽章（lottery-free-badge）、批次結果彈窗列出 10 項。
- **首頁裝修**（`HomeLayoutAdmin.jsx` → 運營管理「首頁裝修」home-decoration slot）：拖曳（HTML5 draggable，無新依賴）+ 上下箭頭排序、顯示/隱藏切換、儲存至 site-config `home_layout`。Home.jsx 改為依 `cfg.home_layout` 順序與 visible 渲染 7 個板塊（flash_sale/lottery_entry/combos/quick_order/hot_products/promo_banners/hot_categories）。cms_api DEFAULT_CONFIG 新增 home_layout。
- data-testid：combos-admin/combo-*、homelayout-admin/hl-row-*/hl-toggle-*/homelayout-save、combos-section/combo-card-*/combo-buy-*、checkout-combo-discount、lottery-draw-btn-10/lottery-free-badge、flash-soldout-*/flash-ended。
- 驗證：組合套餐 10/10 E2E；免費抽/連抽十次後端直測；首頁裝修 PUT/讀回/reset 全通。
- **後續（未做）**：活動記錄 activity-records slot；輪播圖/推薦位/公告等運營 slot；系統配置（管理員/角色權限/操作日誌）。

## 2026-10 後台 Round 10：活動記錄頁 + 連抽保底 + 套餐省額角標
- **活動記錄頁**（`ActivityRecordsAdmin.jsx` → 活動管理「活動記錄」activity-records slot；admin_api `GET /admin/activity-records?type=all|seckill|lottery|combo`）：統一匯總秒殺搶購（orders.items.flash_id）、積分抽獎（lottery_draws）、套餐下單（orders.combo_discount_usd>0），含時間/帳戶ID/用戶/內容/明細/金額/狀態，Tab 篩選。`_user_labels` 批量解析用戶標籤。
- **連抽惊喜保底**：`_pick_and_grant` 新增 `exclude_none`；`/lottery/draw` 當 count>=10 且有真實獎品時隨機指定一格強制中非「謝謝惠顧」獎，確保連抽十次至少中 1 個真實獎（實測 3 輪皆 ≥6/10）。
- **套餐省額角標**：首頁套餐卡右上角 `combo-save-<id>`「立省 $X（N%）」紅色角標（已上線實測顯示「立省 $50.68（84%）」）。
- data-testid：activity-records-admin/act-tab-*/act-table、combo-save-*。
- 驗證：activity-records curl 回 26 筆（25 抽獎+1 秒殺）；連抽保底 3 輪通過；首頁角標截圖確認。

## 2026-10 後台 Round 11：套餐限時+庫存 + 首頁輪播裝修 + 活動數據看板 + 抽獎分享得次數
- **套餐限時+庫存**：ComboIn 新增 start_at/end_at/stock（sold 自動）；`/combos/public` 依時間窗 + 剩餘過濾並回 remaining/end_at；create_order 對每個 combo_id 原子預扣 1 份（stock>0 時），售罄回 409「套餐已售罄」，取消訂單回補。CombosAdmin 加限量/起訖時間欄 + 列表顯示餘量/限時；首頁套餐卡顯示倒計時 + 「僅剩 N 份」（combo-remaining-*）。驗證：2→1→0→售罄。
- **首頁輪播裝修**：cms DEFAULT_CONFIG 新增 `hero_slides:[]`；HomeLayoutAdmin 加輪播圖管理（上傳 base64→`_process` 自動傳物件儲存、連結/替代文字、上下排序、刪除），與板塊排序一起存。Home 當 hero_slides 有值時渲染 `HeroCarousel`（4s 自動輪播 + 指示點），否則用預設富文本 hero。config PUT/讀回已驗證。
- **活動數據看板**：`GET /admin/activity-stats` 回今日秒殺件數/營收、抽獎次數/真實中獎、套餐單數/營收/省額；ActivityRecordsAdmin 頂部三張統計卡（activity-stats）。
- **抽獎分享得次數**：user 新增 lottery_bonus_draws / lottery_share_date；`POST /api/lottery/share` 每日首次分享 +1 次免費抽獎（當日重複不給）；my-status 回 daily_free_available + bonus_draws + free_available；draw 免費優先用每日免費（free_kind=daily），否則用 bonus（free_kind=bonus 並扣減），`_free_draw_used_today` 只認 daily。Lottery 頁加「分享得抽獎次數」按鈕（lottery-share-btn）+ 免費/分享次數徽章。
- data-testid：combo-remaining-*/combo-stock、hero-slides-list/hero-slide-*/hero-slide-add/hero-carousel、activity-stats、lottery-share-btn。
- 驗證：iteration_32 storefront 11/11 通過（套餐限時庫存卡+結算、分享得次數、連抽）；套餐庫存/活動看板/輪播 config 後端 curl 全驗。

## 2026-10 後台 Round 12：套餐售罄態 + 輪播圖連結選擇器 + 看板7日趨勢 + 邀請好友返積分
- **套餐售罄態**：`/combos/public` 不再隱藏已結束/售罄的上架套餐，改回傳 `status`（active/soldout/ended，未開始仍隱藏）。首頁套餐卡 status!=active 時圖片加「已售罄/已結束」遮罩（combo-dead-*）且按鈕禁用。
- **輪播圖連結選擇器**：HomeLayoutAdmin 輪播圖的連結改用 `LinkPicker`——下拉選首頁/抽獎/邀請/註冊/公告 + 分類頁（載 /admin/categories）+ 商品頁（搜 /admin/products）+ 自定義網址，取代手打 URL。
- **看板7日趨勢**：`GET /admin/activity-trend?days=7` 回每日秒殺件數/抽獎次數/套餐單數；ActivityRecordsAdmin 統計卡下方 `TrendChart` CSS 柱狀圖（三色圖例）。
- **邀請好友返積分**：settings key `referral`（REFERRAL_DEFAULT referrer 500 / referee 200 / enabled）。user 新增 referral_code/referred_by/referral_rewarded/referral_invited/referral_points_earned。
  - `GET /api/me/referral`（懶生成 8 位碼、回 code/link 統計/can_bind）、`POST /api/me/referral/bind`（首充前綁定、禁自綁/重綁）、首充結算 `_usdt_settle` 觸發 `apply_referral_reward`（受邀 +200、邀請人 +500、冪等，`_grant_points` 寫 point_transactions）。
  - 前台 `/invite`（Invite.jsx）：邀請碼 + 連結複製/分享 + 邀請數/積分統計 + 綁定碼輸入；首頁 `?ref=CODE` 存 localStorage，/invite 自動預填；我的帳戶 `account-invite-btn` 入口。
- data-testid：combo-dead-*、slide-link-mode/slide-link-cat、activity-trend/trend-day-*、invite-page/invite-code/invite-link/invite-copy-btn/invite-count/invite-points/invite-bind-*、account-invite-btn。
- 驗證：referral 獎勵腳本實測（A+500/B+200/冪等）、trend/stats/combo status curl 全驗；iteration_33 storefront 套餐售罄態 + ?ref 捕獲通過（登入後 /invite DOM 因 Clerk 無頭機器人攔截未跑，屬環境限制，端點已 curl 驗）。

## 2026-10 後台 Round 13：邀請海報 + 後台邀請返利完整管理
- **邀請海報（用戶端 /invite）**：Invite.jsx 新增「生成邀請海報」。用 `qrcode.react` v4 `QRCodeCanvas`（離屏隱藏，ref 取 canvas）合成到 `<canvas>`（750×1250）：背景=後台海報模板圖（同源 /api/img，不污染 canvas，覆蓋式繪製）或橙→琥珀漸層兜底；頂部標題/副標題（poster_title/subtitle）+ 底部白卡（我的邀請碼大字 + 邀請人/好友積分 + QR + gogo589.com）。`canvas.toDataURL` → 保存圖片（下載）/分享海報（navigator.share files 兜底下載）。多模板時顯示縮圖切換（invite-poster-tpl-*）。
- **後台邀請返利管理**（運營管理 > 邀請返利，Admin.jsx key `referral`，ReferralAdmin.jsx）：頂部 4 統計卡（綁定數/已發獎/邀請人數/已發放積分）+ 4 分頁：
  - 獎勵配置：enabled + referrer_points + referee_points + poster_title + poster_subtitle（`GET/PUT /api/admin/referral/config`，存 settings.referral，含海報文案）。
  - 海報模板：上傳背景（3:5，≤4M，走 upload_b64→物件儲存）、名稱/排序/啟用，CRUD（`GET/POST/PUT/DELETE /api/admin/referral/posters`，collection referral_posters）。已預置 2 張模板（喜慶橙/福氣紅）。
  - 邀請記錄：`GET /api/admin/referral/records`（q 搜尋 + rewarded 篩選 yes/no），顯示受邀人/邀請人/綁定時間/發獎狀態/積分/發獎時間。
  - 邀請排行榜：`GET /api/admin/referral/leaderboard`（按 referral_invited 排序 Top N）。
  - `GET /api/admin/referral/stats` 回彙總。
- **後端連動**：`/api/me/referral` 增回 posters[]/poster_title/poster_subtitle；bind 寫 referred_at；apply_referral_reward 寫 referral_rewarded_at。server.py 新增 `admin_api.upload_b64 = _upload_b64` 連線。
- data-testid：invite-poster-btn/invite-poster-modal/invite-poster-img/invite-poster-tpl-*/invite-poster-save/invite-poster-share、referral-admin/ref-tab-*/ref-cfg-*/ref-poster-*/ref-rec-*/ref-lb-*、admin-nav-referral。
- 驗證：iteration_34 後端 13/13 PASS（config 持久化、stats、records 含篩選、leaderboard、posters CRUD+上傳、admin_token 守衛、/me/referral）；後台 UI 無頭登入實測 4 卡 4 分頁 + 配置保存 + 2 模板顯示通過。用戶端海報 UI 因 Clerk 無頭機器人攔截未跑（環境限制），其消費的後端資料已驗（同源海報圖→canvas 不污染）。

## 2026-10 後台 Round 14：海報自定義樣式 + 邀請裂變週榜獎 + 掃碼直達註冊 + 邀請階梯任務
- **海報自定義樣式（每模板）**：referral_posters 新增 `style`{title_color/subtitle_color/code_color/title_x/title_y/title_align/card_x/card_y}。後台 PostersTab 模板編輯加 `PosterStyleEditor`：可拖曳預覽（拖動標題 ref-poster-drag-title、卡片 ref-poster-drag-card）+ 三個顏色選擇器 + 對齊檔位（置中/靠左）+ 快捷檔位（標題置頂/居中、卡片居中/置底）。用戶端 Invite.buildPoster 讀 poster.style 繪製（normalized 座標、clamp 防溢出），缺省用 DEFAULT_STYLE。admin posters GET 與 /me/referral 皆把 style 正規化為 {}。
- **邀請裂變週榜獎（定時任務）**：settings.referral 增 `weekly_enabled`+`weekly_rewards[]`（預設 1st 2000 / 2nd 1000 / 3rd 500 積分，後台可改數值或改發優惠券）。`run_referral_weekly()` 依「過去7天 referral_rewarded_at」按 referred_by 聚合排名發獎，idempotent（referral_weekly_awards 以 week+user_id 去重）。cron `POST /api/cron/referral-weekly`（Bearer WEBHOOK_CRON_SECRET，run_id 冪等），`.emergent/crons.yml` 加 `referral-weekly`（"5 0 * * 1" 每週一 00:05 UTC）。後台 `POST /admin/referral/weekly/run`（立即結算）+ `GET /admin/referral/weekly/awards`（發獎記錄，排行榜分頁下方 ref-weekly-table）。
- **掃碼直達註冊**：AuthModal `openAuth(view)` 支援直開註冊視圖；Register 顯示 `register-ref-banner`（待綁定邀請碼）；Home：`?ref=CODE` 存 localStorage，未登入自動 `openAuth('register')`，登入後自動 `POST /me/referral/bind`（成功即清除）。
- **邀請階梯任務（達標自動發放）**：settings.referral 增 `milestones_enabled`+`milestones[]`（預設 3→300 / 5→800 / 10→2000 積分，後台可改門檻/積分/券）。`_apply_referral_milestones()` 在 apply_referral_reward 內觸發，用戶 `referral_milestones_granted`（$addToSet 冪等）記已達成門檻，達標即 `_grant_reward`（積分或券）。/me/referral 回 milestones + milestones_granted；Invite 頁顯示進度條 + 階梯卡（invite-milestones-card / invite-milestone-bar / invite-milestone-<count>，已達成標「已達成」）。
- **通用獎勵發放** `_grant_reward(user_id, type, value, coupon_code, source, reason)`：type=points 走 _grant_points；type=coupon 校驗 promos.active 且未領過後寫 user_coupons。
- **配置 PUT 防覆蓋**：`PUT /admin/referral/config` 改用 `body.dict(exclude_unset=True)` 合併既有值，部分提交不會清空 milestones/weekly。
- data-testid：ref-cfg-ms-*/ref-cfg-wk-*/ref-cfg-wk-run/ref-cfg-ms-add/ref-cfg-wk-add、ref-poster-preview/ref-poster-drag-title/ref-poster-drag-card/ref-poster-color-*/ref-poster-align-*、ref-weekly-table、invite-milestones-card/invite-milestone-bar/invite-milestone-*、register-ref-banner。
- 驗證：iteration_35 後端 24/24 PASS（含 test_referral_round35.py）；DB 模擬實測 milestone 自動發放+冪等、週榜7天聚合發獎+冪等、config 還原預設；cron 401/ok/duplicate curl 驗；後台 UI 無頭登入實測 3 區塊配置+保存+立即結算+海報樣式編輯+週榜記錄表全通過。用戶端 Invite 進度卡/海報樣式與 Home 掃碼直達因 Clerk 無頭攔截未跑（環境限制），消費的後端資料已驗。

## 2026-10 後台 Round 15：邀請數據看板（趨勢圖 + 轉化率）
- **後端** `GET /api/admin/referral/trend?days=14`（7/14/30，上限60）：回每日 {date, bound（當日新綁定 referred_at）, converted（當日首充轉化 referral_rewarded_at）} + period_bound/period_converted/period_rate（期間轉化率%）+ total_bound/total_converted/total_rate（累計轉化率%）。
- **後台** ReferralAdmin 新增「數據看板」分頁（ref-tab-analytics → ref-analytics）：天數切換（ref-trend-days-7/14/30）、4 張統計卡（期間新綁定/期間首充轉化/期間轉化率/累計轉化率）、雙色柱狀趨勢圖（新綁定橙 + 首充轉化綠，每日下方標當日轉化率%）ref-trend-chart / ref-trend-day-<date>。
- 驗證：DB 模擬實測 trend 每日 bound/converted 計數與轉化率正確（今日 2 綁定/1 轉化、昨日 1 綁定；period_rate 33.3%）；前後端編譯通過。圖表沿用既有 activity-trend 柱狀樣式。

## 2026-10 後台 Round 16：邀請轉化漏斗（訪問 → 註冊 → 首充）
- **訪問追蹤**：公開 `POST /api/referral/visit`{code,vid}，以 (code,vid) `$setOnInsert` 去重寫 referral_visits（每瀏覽器每碼計一次）。Home 在 `?ref=CODE` 時生成/復用 localStorage `rv_id` 並上報訪問。
- **漏斗聚合** `GET /api/admin/referral/funnel?days=14`：回 period 與 total 的 {visits（referral_visits）, registers（users.referred_at/referred_by）, topups（referral_rewarded_at/referral_rewarded）} + reg_rate（註冊/訪問）、topup_rate（首充/註冊）、overall_rate（首充/訪問）。
- **後台看板**：AnalyticsTab 在趨勢圖上方新增漏斗卡（ref-funnel / ref-funnel-visits|registers|topups）：三段橫向條（訪問藍/註冊橙/首充綠，寬度按量），右側標相對上一步轉化率，右上角顯示整體轉化率。
- 驗證：訪問端點去重 curl 驗（同 vid+code 2 次 →1 筆）；DB 模擬實測漏斗 3→2→1 = reg 66.7%/topup 50%/overall 33.3%；前後端編譯通過。

## 2026-10 前台 Round 17：活動中心（活動大廳）+ 首頁橫幅入口
- **新頁面** `/activities`（ActivityCenter.jsx，掛在 StoreLayout 下）：頂部漸層標題橫幅 +「功能活動入口卡」網格 6 張：限時秒殺、幸運大轉盤(/lottery)、超值套餐、充值有禮(/account/wallet/topup)、滿減優惠、邀請好友(/invite)。每卡帶狀態角標（即時數據）：秒殺「N 場進行中/敬請期待」、抽獎「天天可抽/暫停中」、套餐「N 款在售」、充值「N 檔好禮」、滿減「N 檔滿減」、邀請「邀請得積分」。下方列促銷活動文章（/articles?type=promo，復用 ArticleCard，無資料時隱藏）。狀態數據來自 /flash-sales/public、/combos/public、/recharge-bonus/public、/cart-promotions/public、/lottery/config。
- **首頁入口**：將原「積分幸運大轉盤」橫幅（home-lottery-entry → /lottery）改為「活動中心」橫幅（home-activity-center-entry → /activities，Sparkles 圖示 + 「進入活動」按鈕）。
- data-testid：activity-center、activity-cards、activity-card-<key>、activity-card-badge、activity-articles、activity-article-<id>、home-activity-center-entry。
- 驗證：/activities 截圖確認橫幅 + 6 卡 + 角標（抽獎天天可抽、邀請得積分、其餘敬請期待）正常渲染；首頁橫幅已替換為活動中心入口；前端編譯通過。
- 備註：使用者先前要求的「渠道來源分析/流失提醒/商品帶貨海報」已起頭（後端 referral_visits 記錄 source、config 加 funnel 阈值欄位，皆為相容新增、不影響現有功能），本輪優先完成活動中心，後續可回頭續做該三項。

## 2026-10 後台 Round 18：活動中心後台配置（可自訂入口卡/排序/文案）
- **後端**：settings.activity_center 存配置（header_title/header_subtitle/cards[]）。公開 `GET /api/activity-center` 回「已啟用且按 sort 排序」的卡片 + 頁首文案（無配置回 ACTIVITY_CENTER_DEFAULT 6 卡）。後台 `GET/PUT /api/admin/activity-center`（GET 回含停用卡的完整配置）。每張卡：{key,type,enabled,sort,title,desc,badge,to,icon,color}；type∈flash/lottery/combo/recharge/cartpromo/invite/custom（前6自動角標，custom 用 badge 文字）。
- **前台** ActivityCenter 改為配置驅動：頁首與卡片全部讀 `/activity-center`；角標 badge 有填用自訂，否則按 type 即時計算；icon 走 ICONS 映射、color 走 GRADS 固定漸層類（Tailwind 安全）。
- **後台頁** ActivityCenterAdmin（運營管理 → 活動中心，Admin.jsx key `activity-center`）：編輯頁首主/副標題；卡片列表可上下移排序、啟用/停用、改標題/描述/類型/連結/角標文字/圖示/顏色、刪除、新增自訂卡；儲存。
- data-testid：activity-center-admin、ac-header-title/subtitle、ac-cards、ac-card-<i>（title/desc/type/to/badge/icon/color/enabled/del/up/down）、ac-add、ac-save。
- 驗證：DB 模擬實測 PUT→公開 GET 只回啟用卡且按 sort 排序、custom 角標生效、停用卡排除、admin GET 含停用卡、刪除配置回預設 6 卡；前端編譯通過；/activities 公開頁先前截圖正常。

## 2026-10 後台 Round 19：系統配置批次（RBAC + 管理員 + 操作日誌 + SMS/郵箱/OAuth 配置）
【完善後台 Batch 1/5：系統配置類】
- **RBAC 角色權限**：admin_roles{id,name,permissions[],created_at}。權限鍵=後台菜單 section keys（ALL_PERMISSIONS 共 54 項）。角色 CRUD（super-only）：GET/POST/PUT/DELETE /api/admin/roles。
- **管理員管理**：users.role==admin 為管理員；admin_super(bool)/admin_role_id 區分超管與角色管理員；`_is_super`（legacy 無欄位=超管 bootstrap）。GET /admin/admins、POST /admin/admins/promote（依信箱提升現有用戶）、/admins/{uid}/role（設角色/設超管）、/admins/{uid}/revoke（防撤銷自己、至少留一超管）。全部 super-only。
- **/admin/me**：回 {is_super, permissions, role_name, all_permissions}。前台 Admin.jsx 以此對菜單做權限門控（超管見全部；非超管僅見角色授權 section；無權限 section 顯示「無此模組權限」）。側欄顯示角色標籤。
- **操作日誌**：server.py `@app.middleware("http")` audit_admin 記錄所有 /api/admin 的 POST/PUT/DELETE/PATCH（從 X-Admin-Token 解出 uid）→ admin_logs{admin_user_id,admin_email,method,path,status,created_at}。GET /admin/operation-logs（分頁+搜尋）+ /export（CSV）。super-only。
- **集成配置（可編輯入庫）**：integration_settings{key,value}；啟動時 load_integration_settings() 載入 os.environ（DB 覆蓋 .env），保存時即時寫 os.environ。GET/PUT /admin/integration-settings（group=sms/email/oauth，secret 遮罩回傳 ••••後4位，PUT 遇遮罩佔位/空值則不覆蓋）+ /test（發測試短信/郵件）。對應三頁：短信(DAGOU/SUBMAIL)、郵箱(SMTP)、授權(GOOGLE_CLIENT_ID/SECRET)。
- 前端新頁：AdminsAdmin / RolesAdmin / OperationLogsAdmin / IntegrationConfigAdmin（通用 group）。data-testid：admins-admin/roles-admin/operation-logs-admin/integration-<group>、role-*/admin-*/oplog-*/int-* 等。
- 驗證：iteration_36 後端 20/20 + 前端 100% 全通過（/admin/me、roles CRUD、admins promote/revoke、integration 遮罩與不覆蓋、test-send、operation-logs+CSV、401/403 授權）；另 DB 模擬先行驗證過 super 判定/角色權限/遮罩不覆蓋/require_super。無問題。
- 代碼審查備註（非阻斷）：admin_api.py 已 ~1780 行，後續可拆分；非超管即使有 sms-config 權限也看不到集成配置（目前系統配置為 super-only，符合預期）；RolesAdmin 彈窗 Esc 未關閉（小 UX）。
- 後台完善剩餘批次（待續）：商品類(規格/庫存/新增商品頁)、財務類(訂單結算/對賬/財報)、儀表盤類(銷售分析/實時監控)、用戶類(批量操作/報表統計)。另：referral「渠道來源分析/流失提醒」與「商品帶貨海報」仍為已起頭待續（後端已記錄 visit source、config 阈值欄位，相容新增）。

## 2026-10 後台 Round 20：商品類批次（庫存管理 + 規格模板 + 獨立新增商品頁）【Batch 2/5】
- Spec 模型加 `stock: Optional[int]=None`（留空=不限量）。
- 庫存管理：GET/PUT /api/admin/inventory（跨商品攤平所有規格，支持 q 搜尋、only_low≤5 篩選；PUT 改 in_stock/stock，array_filters）。前端 InventoryAdmin：售罄開關 + 庫存數量內聯編輯 + 低庫存角標。
- 規格模板：spec_templates CRUD /api/admin/spec-templates。前端 SpecTemplatesAdmin（模板=名稱+規格行）。ProductsAdmin 的 SpecsEditor 新增「套用規格模板」下拉，一鍵追加模板規格。
- 獨立新增商品頁：product-new → <ProductsAdmin autoCreate/>，進入即自動彈出新增表單。
- data-testid：inventory-admin/inv-*、spec-templates-admin/spectpl-*、pf-apply-tpl、product-add 等。
- 驗證：DB 模擬實測 inventory 攤平/改 stock/售罄/低庫存篩選/清空回不限量、spec-templates 增改刪，皆通過；前端編譯通過（因使用者催促，未另跑 testing_agent 瀏覽器 E2E，後端已驗）。

## 2026-10 後台 Round 21-22：財務批次 + 儀表盤批次 + 用戶批次【Batch 3-5/5 完成】
- 財務(Batch3)：訂單結算 GET /admin/finance/settlement + POST /finance/settle（勾選標記/取消結算，待結算金額彙總）；財務對賬 GET /finance/reconciliation（按渠道×狀態彙總充值+訂單，待確認高亮）；財務報表 FinanceReportsAdmin 復用 /admin/reports（recharts 柱狀圖+CSV 匯出）。
- 儀表盤(Batch4)：銷售分析 GET /admin/analytics/sales（熱銷商品 Top15 + 充值渠道佔比）；實時監控 GET /admin/analytics/realtime（今日訂單/營收/充值/新會員/待確認 + 最新訂單，前端 15s 自動刷新）。
- 用戶(Batch5)：用戶批量 POST /admin/users/batch（封禁/解封/打標籤/發積分）；用戶報表 GET /admin/user-reports（總數/新增/封禁 + 等級分佈 + 消費排行 Top15）。
- 前端新頁：OrderSettlementAdmin/ReconciliationAdmin/FinanceReportsAdmin/SalesAnalysisAdmin/RealtimeAdmin/UserBatchAdmin/UserReportsAdmin，均註冊進 Admin.jsx PAGES。至此 Batch 1-5 將原「即將上線」占位的 16 個模組全部替換為可用模組。
- 驗證：DB 模擬實測 settlement/settle、reconciliation、analytics sales/realtime、user-reports、users/batch(加積分+標籤) 全通過；前端全部編譯成功。因使用者催促，批次 2-5 未跑 testing_agent 瀏覽器 E2E（批次1已跑並 100%），後端均已模擬驗證。

## 2026-10 後台 Round 23：依使用者要求移除「新增商品 / 規格管理 / 庫存管理」
- 使用者明確要求不要庫存管理、商品規格、添加商品三個後台模組。已從 Admin.jsx 菜單與 PAGES 移除，刪除 InventoryAdmin.jsx / SpecTemplatesAdmin.jsx，ProductsAdmin 的 SpecsEditor 去掉「套用規格模板」下拉；後端 ALL_PERMISSIONS 同步移除三個 key（API 路由保留，無害）。商品管理菜單現為：商品列表 / 商品分類 / 商品評論。
- 驗證：後台 2FA 登入 + 儀表盤截圖正常，前端編譯通過。
