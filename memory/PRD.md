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
- P1：訂單狀態郵件/站內通知（用戶暫緩）。
- P0：testing_agent 跑後台訂單狀態流轉 + 回歸（前台 E2E 已由主代理手測通過）。
- P1：結帳頁多幣別匯率計算驗證。
- P1：模擬付款 webhook/callback 佔位。
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
