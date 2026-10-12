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

## 待辦（優先序）
- P0：用 testing_agent 跑端到端：登入 → 加入購物車 → 結帳（模擬付款）→ 後台改訂單狀態。
- P1：結帳頁多幣別匯率計算驗證。
- P1：模擬付款 webhook/callback 佔位。
- 備註：商標 logo 不內建，需由後台上傳。
- 重構：Home.jsx 過於龐大。
