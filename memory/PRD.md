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

## 待辦（優先序）
- P0：testing_agent 跑後台訂單狀態流轉 + 回歸（前台 E2E 已由主代理手測通過）。
- P1：結帳頁多幣別匯率計算驗證。
- P1：模擬付款 webhook/callback 佔位。
- 備註：商標 logo 不內建，需由後台上傳。
- 重構：Home.jsx 過於龐大。
