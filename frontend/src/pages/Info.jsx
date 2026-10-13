import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { tr } from "@/i18n";

export const INFO_CONTENT = {
  about: {
    title: tr("公司介紹"),
    body: [
      tr("gogo589 是專為海外華人打造的跨境數字商品與直播幣充值平台，涵蓋直播、遊戲、社交、視頻音訊、平臺點卡等 500+ 款全球正版 App 內購服務。"),
      tr("我們以「安全、極速、平價」為核心理念，提供 7×24 多語言客服與人工極速發貨，讓身在海外的用戶也能輕鬆為常用 App 充值。"),
      tr("平台支援多種貨幣即時換算與多元支付方式，下單價格於結帳當下鎖定，透明無隱藏費用，讓每一筆充值都安心。"),
    ],
  },
  privacy: {
    title: tr("隱私權政策"),
    body: [
      tr("我們非常重視您的個人資料保護。註冊與下單時所收集的資訊（如電子郵件、充值帳號），僅用於訂單處理與客戶服務用途。"),
      tr("我們不會將您的個人資料出售或轉讓予第三方，除非法律要求或為完成您的交易所必需。"),
      tr("您可隨時透過線上客服要求查詢、更正或刪除您的個人資料。"),
    ],
  },
  terms: {
    title: tr("條款與條件"),
    body: [
      tr("使用本平台即表示您同意遵守相關服務條款。本站所售商品均為虛擬數字商品。"),
      tr("下單前請務必確認充值帳號 / ID 正確無誤；因帳號填寫錯誤導致之損失，恕無法退款。"),
      tr("平台保留於法律允許範圍內調整價格、活動內容與服務條款之權利。"),
    ],
  },
  contact: {
    title: tr("聯絡我們"),
    body: [
      tr("線上客服：7×24 小時全天候服務，於網站右下角點擊客服圖標即可聯繫。"),
      tr("微信客服：CS-KA-CS（24 小時）。"),
      tr("商務合作 / 經銷洽詢：請透過線上客服留言，我們將盡速與您聯繫。"),
    ],
  },
  "shopping-flow": {
    title: tr("購物流程"),
    body: [
      tr("1. 選擇商品與規格（如幣值、VIP 時長）。"),
      tr("2. 填寫正確的充值帳號 / ID，部分商品需附上區服資訊。"),
      tr("3. 選擇顯示貨幣與付款方式。"),
      tr("4. 完成付款（本站為測試支付模式）。"),
      tr("5. 於「我的訂單」即時查看充值進度。"),
    ],
  },
  "shipping-flow": {
    title: tr("出貨流程"),
    body: [
      tr("付款完成後訂單進入「已支付」狀態，系統或客服隨即開始處理（充值中）。"),
      tr("90% 以上商品支援線上自動秒發，其餘由人工極速處理，完成後狀態更新為「已發貨 / 已完成」。"),
      tr("如遇異常，客服將主動與您聯繫並即時更新訂單狀態。"),
    ],
  },
  refund: {
    title: tr("退款政策"),
    body: [
      tr("本站所售為虛擬數字商品，由人工 / 系統即時作業，完成充值後恕不退款。"),
      tr("若因平台原因導致充值失敗，我們將全額退回或為您重新充值。"),
      tr("下單前請務必確認帳號資訊，並詳閱商品頁的充值說明。"),
    ],
  },
  reseller: {
    title: tr("成為經銷商"),
    body: [
      tr("歡迎各地經銷商與工作室加入 gogo589 夥伴計畫，享批量優惠價與專屬對接支援。"),
      tr("提供專屬客服與結算對帳服務，助您快速拓展海外充值業務。"),
      tr("申請方式：聯繫線上客服並提供您的業務資訊，審核通過後即可開通。"),
    ],
  },
  faq: {
    title: tr("常見問題"),
    body: [
      tr("Q：海外帳號可以充值嗎？ A：可以，多數商品支援全球帳號。"),
      tr("Q：多久到帳？ A：自動商品數秒內，人工商品通常數分鐘內完成。"),
      tr("Q：支援哪些付款方式？ A：VISA / MasterCard / PayPal / Apple Pay / 支付寶 等（本站為測試模式）。"),
      tr("Q：下錯帳號怎麼辦？ A：請立即聯繫客服，若尚未充值可協助更正。"),
    ],
  },
  verify: {
    title: tr("我的認證"),
    body: [
      tr("完成實名 / 帳號認證可提升下單額度與交易安全。"),
      tr("於會員中心上傳認證資訊，客服審核後即可生效。"),
      tr("（本站為示範項目，認證為模擬流程。）"),
    ],
  },
  coupons: {
    title: tr("我的優惠券"),
    body: [
      tr("於會員中心可查看目前可用的優惠券與折扣活動。"),
      tr("新用戶註冊最高領 9% 優惠券；會員日每月可領最高 8% OFF。"),
      tr("結帳時輸入優惠碼（如 GLOBAL2026）即可折抵。"),
    ],
  },
};

const NAV = [
  [tr("關於我們"), [[tr("公司介紹"), "/info/about"], [tr("隱私權政策"), "/info/privacy"], [tr("條款與條件"), "/info/terms"], [tr("聯絡我們"), "/info/contact"]]],
  [tr("購物指南"), [[tr("購物流程"), "/info/shopping-flow"], [tr("出貨流程"), "/info/shipping-flow"], [tr("退款政策"), "/info/refund"], [tr("成為經銷商"), "/info/reseller"]]],
  [tr("幫助訊息"), [[tr("常見問題"), "/info/faq"], [tr("我的訂單"), "/orders"], [tr("我的認證"), "/info/verify"], [tr("我的優惠券"), "/info/coupons"]]],
];

export default function Info() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const data = INFO_CONTENT[slug] || INFO_CONTENT.about;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-5">
        <Link to="/" className="hover:text-orange-500">{tr("首頁")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-700 font-medium" data-testid="info-title">{data.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 h-fit">
          {NAV.map(([group, links]) => (
            <div key={group} className="mb-5 last:mb-0">
              <h4 className="font-bold text-sm text-slate-900 mb-2.5">{group}</h4>
              <ul className="space-y-1.5">
                {links.map(([label, to]) => {
                  const active = to === `/info/${slug}`;
                  return (
                    <li key={to}>
                      <Link to={to} data-testid={`info-nav-${to.split("/").pop()}`}
                        className={`block text-[13px] rounded-lg px-3 py-2 transition-colors ${active ? "bg-orange-50 text-orange-600 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-orange-500"}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* Content */}
        <article className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 sm:p-8">
          <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6 flex items-center gap-3">
            <span className="h-7 w-1.5 rounded-full bg-gradient-to-b from-orange-400 to-amber-500" />
            {data.title}
          </h1>
          <div className="space-y-4 text-[15px] leading-8 text-slate-600">
            {data.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">{tr("需要協助？")}</span>
            <button onClick={() => navigate("/orders")} data-testid="info-orders-btn" className="text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-4 py-2 hover:bg-orange-100">{tr("查看我的訂單")}</button>
            <Link to="/" data-testid="info-home-btn" className="text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-4 py-2 hover:bg-slate-100">{tr("返回首頁")}</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
