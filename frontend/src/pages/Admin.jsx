import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Show, useUser } from "@clerk/react";
import { KeyRound, LayoutDashboard, Package, ShoppingBag, Star, DollarSign, Tag, Users, Plus, Pencil, Trash2, X, Loader2, ArrowLeft, TrendingUp, Clock, ShieldAlert, Settings, CreditCard, ArrowUp, ArrowDown, ImagePlus, Wallet, BadgeCheck, MessageSquare, Globe, Bell, Megaphone, LayoutGrid, Gift, ShieldCheck, ChevronDown, Construction, PanelLeftClose, PanelLeftOpen, Headphones, Volume2, VolumeX, Gauge, FileDown, Tags, Ban, ScrollText, Layers, BarChart3, FolderTree, Hash, PlusCircle, Search, Plug, FileBarChart, Home, Newspaper, Image, PanelBottom, Sparkles, Ticket, Receipt, Coins, Scale, UserCog, History, MessageSquareText, Mail, Languages, Dot } from "lucide-react";
import { toast } from "sonner";
import { useApi, publicApi } from "@/lib/api";
import { STATUS_LABELS, STATUS_ORDER, StatusBadge } from "@/lib/status";
import { Switch } from "@/components/ui/switch";
import { VerificationsAdmin, FeedbackAdmin } from "@/pages/admin/SupportAdmin";
import PaymentMethodsAdmin from "@/pages/admin/PaymentMethodsAdmin";
import { UsdtChannelAdmin } from "@/pages/admin/UsdtChannelAdmin";
import { MembersAdmin } from "@/pages/admin/MembersAdmin";
import { TopupsAdmin } from "@/pages/admin/TopupsAdmin";
import { ReportsAdmin } from "@/pages/admin/ReportsAdmin";
import { TranslationsAdmin } from "@/pages/admin/TranslationsAdmin";
import { NotificationsAdmin } from "@/pages/admin/NotificationsAdmin";
import { ActivitiesAdmin } from "@/pages/admin/ActivitiesAdmin";
import { SiteConfigAdmin } from "@/pages/admin/SiteConfigAdmin";
import { FooterAdmin } from "@/pages/admin/FooterAdmin";
import { ChangePasswordDialog } from "@/pages/admin/ChangePasswordDialog";
import { NewOrderAlert } from "@/pages/admin/NewOrderAlert";
import { ADMIN_BASE, ADMIN_LOGIN } from "@/lib/adminPath";
import { ProductsAdmin } from "@/pages/admin/ProductsAdmin";
import { CategoriesAdmin } from "@/pages/admin/CategoriesAdmin";
import { ReviewsAdmin } from "@/pages/admin/ReviewsAdmin";
import { OrdersHubAdmin } from "@/pages/admin/OrdersHubAdmin";
import { DashboardAdmin } from "@/pages/admin/DashboardAdmin";
import { Soon } from "@/pages/admin/Soon";
import { UserTagsAdmin } from "@/pages/admin/UserTagsAdmin";
import { MemberAssetsAdmin } from "@/pages/admin/MemberAssetsAdmin";
import { BlacklistAdmin } from "@/pages/admin/BlacklistAdmin";
import { UserLogsAdmin } from "@/pages/admin/UserLogsAdmin";
import { GiftCardPoolAdmin } from "@/pages/admin/GiftCardPoolAdmin";
import { GiftCardTxnAdmin, GiftCardApiAdmin } from "@/pages/admin/GiftCardTxnAdmin";
import { GiftCardNewAdmin } from "@/pages/admin/GiftCardNewAdmin";
import { GiftCardReportAdmin } from "@/pages/admin/GiftCardReportAdmin";
import { HomeLayoutAdmin } from "@/pages/admin/HomeLayoutAdmin";
import { IntegrationConfigAdmin } from "@/pages/admin/IntegrationConfigAdmin";
import { AdminsAdmin } from "@/pages/admin/AdminsAdmin";
import { RolesAdmin } from "@/pages/admin/RolesAdmin";
import { OperationLogsAdmin } from "@/pages/admin/OperationLogsAdmin";
import { OrderSettlementAdmin } from "@/pages/admin/OrderSettlementAdmin";
import { ChatAdmin } from "@/pages/admin/ChatAdmin";
import { loadSoundPrefs, saveSoundPrefs, playAlert, unlockAudio } from "@/lib/adminSounds";
import { ReconciliationAdmin } from "@/pages/admin/ReconciliationAdmin";
import { FinanceReportsAdmin } from "@/pages/admin/FinanceReportsAdmin";
import { SalesAnalysisAdmin } from "@/pages/admin/SalesAnalysisAdmin";
import { UserBatchAdmin } from "@/pages/admin/UserBatchAdmin";
import { UserReportsAdmin } from "@/pages/admin/UserReportsAdmin";
import { tr } from "@/i18n";
import { Modal, Input, Field, Btn } from "@/pages/admin/ui";

// Full admin IA — collapsible two-level menu. Keys map to real pages in PAGES; everything else renders <Soon/>.
const MENU = [
  { key: "dashboard", g: tr("儀表盤"), icon: LayoutDashboard, defaultOpen: true, items: [["overview", tr("數據概覽")], ["sales-analysis", tr("銷售分析")], ["download-reports", tr("下載報表")]] },
  { key: "users", g: tr("用戶管理"), icon: Users, defaultOpen: true, items: [["members", tr("用戶列表")], ["user-tags", tr("用戶標籤")], ["member-assets", tr("會員資產")], ["blacklist", tr("黑名單管理")], ["user-logs", tr("用戶日誌")], ["verifications", tr("用戶認證")], ["user-batch", tr("用戶批量操作")], ["feedback", tr("用戶反饋")], ["user-reports", tr("用戶報表統計")]] },
  { key: "support", g: tr("客服"), icon: Headphones, defaultOpen: true, items: [["chat-sessions", tr("客服會話")]] },
  { key: "products", g: tr("商品管理"), icon: Package, items: [["products", tr("商品列表")], ["categories", tr("商品分類")], ["reviews", tr("商品評論")]] },
  { key: "giftcards", g: tr("禮品卡"), icon: Gift, items: [["giftcard-list", tr("禮品卡列表")], ["giftcard-pool", tr("號碼庫")], ["giftcard-orders", tr("訂單管理")], ["giftcard-new", tr("添加禮品卡")], ["giftcard-trade-query", tr("交易號查詢")], ["giftcard-api", tr("核銷接口API")], ["giftcard-report", tr("稽核報表")]] },
  { key: "ops", g: tr("運營管理"), icon: Megaphone, items: [["home-decoration", tr("首頁裝修")], ["activities", tr("新聞 & 促銷")], ["banners", tr("橫幅 / 輪播圖")], ["footer", tr("頁尾管理")], ["recommendations", tr("推薦位管理")], ["promos", tr("優惠券管理")], ["notifications", tr("消息中心")], ["announcements", tr("公告管理")]] },
  { key: "finance", g: tr("財務管理"), icon: DollarSign, items: [["order-settlement", tr("訂單結算")], ["topups", tr("充值審核")], ["usdt-channel", tr("USDT 通道")], ["payments", tr("支付渠道配置")], ["reconciliation", tr("財務對賬")], ["currencies", tr("匯率配置")], ["finance-reports", tr("財務報表")]] },
  { key: "system", g: tr("系統配置"), icon: Settings, items: [["siteconfig", tr("基礎設置")], ["admins", tr("管理員管理")], ["roles", tr("角色權限管理")], ["operation-logs", tr("操作日誌")], ["sms-config", tr("短信配置")], ["email-config", tr("郵箱配置")], ["oauth-config", tr("授權配置")], ["translations", tr("翻譯管理")], ["paylogos", tr("頁尾支付Logo")]] },
];
const LEAVES = [["security", tr("安全配置"), ShieldCheck]];
const SECTION_LABEL = Object.fromEntries([...MENU.flatMap((m) => m.items), ...LEAVES.map(([k, l]) => [k, l])]);

const ALL_STATUSES = Object.keys(STATUS_LABELS);
const inputCls = "w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 outline-none focus:border-primary";
const selCls = "w-full h-10 rounded-lg bg-white border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400";

const Badge = ({ n, testId }) => (n > 0 ? <span data-testid={testId} className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">{n > 99 ? "99+" : n}</span> : null);

const ITEM_ICONS = {
  overview: Gauge, "sales-analysis": TrendingUp, "download-reports": FileDown,
  members: Users, "user-tags": Tags, "member-assets": Wallet, blacklist: Ban, "user-logs": ScrollText, verifications: BadgeCheck, "user-batch": Layers, feedback: MessageSquare, "user-reports": BarChart3,
  "chat-sessions": Headphones,
  products: Package, categories: FolderTree, reviews: Star,
  "giftcard-list": Gift, "giftcard-pool": Hash, "giftcard-orders": ShoppingBag, "giftcard-new": PlusCircle, "giftcard-trade-query": Search, "giftcard-api": Plug, "giftcard-report": FileBarChart,
  "home-decoration": Home, activities: Newspaper, banners: Image, footer: PanelBottom, recommendations: Sparkles, promos: Ticket, notifications: Bell, announcements: Megaphone,
  "order-settlement": Receipt, topups: Wallet, "usdt-channel": Coins, payments: CreditCard, reconciliation: Scale, currencies: DollarSign, "finance-reports": FileBarChart,
  siteconfig: Settings, admins: UserCog, roles: ShieldCheck, "operation-logs": History, "sms-config": MessageSquareText, "email-config": Mail, "oauth-config": KeyRound, translations: Languages, paylogos: Image,
};

const NavGroup = ({ gkey, g, Icon, items, section, setSection, open, toggle, badges = {}, collapsed }) => {
  const active = items.some(([k]) => k === section);
  const groupBadge = items.reduce((s, [k]) => s + (badges[k] || 0), 0);
  if (collapsed) return (
    <div className="relative group">
      <button data-testid={`admin-group-${gkey}`} title={g} className={`relative w-full h-10 flex items-center justify-center rounded-lg transition-colors ${active ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        <Icon className="h-[18px] w-[18px]" />
        {groupBadge > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </button>
      <div className="hidden group-hover:block absolute left-full top-0 pl-2 z-50">
        <div className="w-44 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 admin-flyout">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">{g}</div>
          {items.map(([k, label]) => { const It = ITEM_ICONS[k] || Dot; return (
            <a key={k} href={`${ADMIN_BASE}?s=${k}`} data-testid={`admin-nav-${k}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); setSection(k); }}
              className={`flex items-center gap-2 mx-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${section === k ? "bg-orange-500 text-white font-semibold" : "text-slate-600 hover:bg-slate-100"}`}>
              <It className="h-3.5 w-3.5 shrink-0 opacity-80" /><span className="truncate flex-1">{label}</span><Badge n={badges[k] || 0} testId={`admin-nav-badge-${k}`} />
            </a>
          ); })}
        </div>
      </div>
    </div>
  );
  return (
    <div>
      <button data-testid={`admin-group-${gkey}`} onClick={toggle}
        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? "text-orange-600 bg-orange-50/70" : "text-slate-600 hover:bg-slate-100"}`}>
        <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left truncate">{g}</span>
        {!open && <Badge n={groupBadge} testId={`admin-group-badge-${gkey}`} />}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 mb-1.5 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
          {items.map(([k, label]) => { const It = ITEM_ICONS[k] || Dot; return (
            <a key={k} href={`${ADMIN_BASE}?s=${k}`} data-testid={`admin-nav-${k}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); setSection(k); }}
              className={`relative w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors ${section === k ? "bg-orange-50 text-orange-600 font-semibold before:absolute before:-left-[13px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-orange-500" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
              <It className={`h-3.5 w-3.5 shrink-0 ${section === k ? "text-orange-500" : "text-slate-400"}`} /><span className="truncate flex-1">{label}</span>
              <Badge n={badges[k] || 0} testId={`admin-nav-badge-${k}`} />
            </a>
          ); })}
        </div>
      )}
    </div>
  );
};

const PAGES = {
  overview: (p) => <DashboardAdmin {...p} />,
  members: (p) => <MembersAdmin {...p} />,
  verifications: (p) => <VerificationsAdmin {...p} />,
  feedback: (p) => <FeedbackAdmin {...p} />,
  products: (p) => <ProductsAdmin {...p} />,
  "order-settlement": (p) => <OrderSettlementAdmin {...p} />,
  reconciliation: (p) => <ReconciliationAdmin {...p} />,
  "finance-reports": (p) => <FinanceReportsAdmin {...p} />,
  "sales-analysis": (p) => <SalesAnalysisAdmin {...p} />,
  "user-batch": (p) => <UserBatchAdmin {...p} />,
  "user-reports": (p) => <UserReportsAdmin {...p} />,
  categories: (p) => <CategoriesAdmin {...p} />,
  reviews: (p) => <ReviewsAdmin {...p} />,
  promos: (p) => <Promos {...p} />,
  notifications: (p) => <NotificationsAdmin {...p} />,
  activities: (p) => <ActivitiesAdmin {...p} />,
  topups: (p) => <TopupsAdmin {...p} />,
  payments: (p) => <PaymentMethodsAdmin {...p} scope="other" />,
  "usdt-channel": (p) => <UsdtChannelAdmin {...p} />,
  currencies: (p) => <Currencies {...p} />,
  siteconfig: (p) => <SiteConfigAdmin {...p} />,
  banners: (p) => <SiteConfigAdmin {...p} only={["top_promo", "hero", "promo_banners", "detail_banners", "announcement"]} title={tr("橫幅 / 輪播圖管理")} sub={tr("頂部推廣條、首頁主橫幅、活動橫幅、商品頁 Banner 與公告條皆在此修改；首頁輪播大圖請到「首頁裝修」。")} />,
  footer: (p) => <FooterAdmin {...p} />,
  translations: (p) => <TranslationsAdmin {...p} />,
  paylogos: (p) => <PaymentLogos {...p} />,
  "download-reports": (p) => <ReportsAdmin {...p} />,
  "user-tags": (p) => <UserTagsAdmin {...p} />,
  "member-assets": (p) => <MemberAssetsAdmin {...p} />,
  blacklist: (p) => <BlacklistAdmin {...p} />,
  "user-logs": (p) => <UserLogsAdmin {...p} />,
  "giftcard-pool": (p) => <GiftCardPoolAdmin {...p} />,
  "giftcard-orders": (p) => <OrdersHubAdmin {...p} defaultTab={sessionStorage.getItem("orders-hub-tab") || "gift"} />,
  "giftcard-list": (p) => <ProductsAdmin giftcardOnly {...p} />,
  "giftcard-new": (p) => <GiftCardNewAdmin {...p} />,
  "giftcard-trade-query": (p) => <GiftCardTxnAdmin {...p} />,
  "giftcard-api": (p) => <GiftCardApiAdmin {...p} />,
  "giftcard-report": (p) => <GiftCardReportAdmin {...p} />,
  "home-decoration": (p) => <HomeLayoutAdmin {...p} />,
  admins: (p) => <AdminsAdmin {...p} />,
  roles: (p) => <RolesAdmin {...p} />,
  "operation-logs": (p) => <OperationLogsAdmin {...p} />,
  "chat-sessions": (p) => <ChatAdmin {...p} />,
  "sms-config": (p) => <IntegrationConfigAdmin group="sms" title={tr("短信配置")} sub={tr("大狗 / SUBMAIL 短信網關配置")} canTest {...p} />,
  "email-config": (p) => <IntegrationConfigAdmin group="email" title={tr("郵箱配置")} sub={tr("SMTP 寄信配置")} canTest {...p} />,
  "oauth-config": (p) => <IntegrationConfigAdmin group="oauth" title={tr("授權配置")} sub={tr("Google OAuth 登入配置")} {...p} />,
};

const MAX_TABS = 12;
const readTabs = () => { try { const t = JSON.parse(localStorage.getItem("admin_tabs") || "[]"); return Array.isArray(t) ? t.filter((k) => SECTION_LABEL[k]) : []; } catch { return []; } };

function SoundControl() {
  const [prefs, setPrefs] = useState(loadSoundPrefs);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const update = (p) => { const n = { ...prefs, ...p }; setPrefs(n); saveSoundPrefs(n); };
  const toggleDesktop = async (v) => {
    if (!v) return update({ desktop: false });
    if (perm === "unsupported") return toast.error(tr("此瀏覽器不支援桌面通知"));
    const r = perm === "granted" ? "granted" : await Notification.requestPermission();
    setPerm(r);
    if (r !== "granted") return toast.error(tr("未取得通知權限，請在瀏覽器網址列的鎖頭圖示中允許通知"));
    update({ desktop: true });
    new Notification(tr("桌面通知已開啟"), { body: tr("收到新訂單 / 充值憑證 / 客服訊息時，瀏覽器會彈出提示"), icon: "/icons/app-icon-512.png" });
  };
  useEffect(() => { if (!open) return; const h = () => setOpen(false); window.addEventListener("click", h); return () => window.removeEventListener("click", h); }, [open]);
  useEffect(() => { const h = () => setPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported"); window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, []);
  return (
    <div className="relative self-center ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button data-testid="admin-sound-toggle" title={prefs.enabled ? tr("聲音提醒：開") : tr("聲音提醒：關")} onClick={() => { unlockAudio(); setOpen((o) => !o); }}
        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${prefs.enabled ? "text-orange-500 hover:bg-orange-50" : "text-slate-400 hover:bg-slate-100"}`}>
        {prefs.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      {open && (
        <div data-testid="admin-sound-panel" className="absolute right-0 top-10 z-50 w-64 rounded-xl bg-white shadow-xl border border-slate-200 p-3.5 text-slate-700">
          <label className="flex items-center justify-between text-sm font-semibold"><span>{tr("聲音提醒")}</span><Switch data-testid="admin-sound-enabled" checked={prefs.enabled} onCheckedChange={(v) => { unlockAudio(); update({ enabled: v }); }} /></label>
          <label className="flex items-center justify-between text-sm font-semibold mt-2"><span>{tr("桌面通知")}<span className="block text-[10px] font-normal text-slate-400">{perm === "denied" ? tr("已被瀏覽器封鎖") : tr("瀏覽器彈窗提示新訂單 / 充值 / 客服")}</span></span><Switch data-testid="admin-desktop-enabled" checked={prefs.desktop !== false && perm === "granted"} onCheckedChange={toggleDesktop} /></label>
          <div className="mt-3 text-xs text-slate-500">{tr("音量")} {Math.round(prefs.volume * 100)}%</div>
          <input data-testid="admin-sound-volume" type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={(e) => update({ volume: +e.target.value })} className="w-full accent-orange-500" />
          <div className="mt-3 text-xs text-slate-500">{tr("試聽")}</div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[["order", tr("新訂單")], ["topup", tr("充值審核")], ["chat", tr("客服訊息")]].map(([k, l]) => <button key={k} data-testid={`admin-sound-test-${k}`} onClick={() => playAlert(k, { ...prefs, enabled: true })} className="h-8 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-[11px] font-semibold">{l}</button>)}
          </div>
          <div className="mt-3 text-[10px] text-slate-400 leading-relaxed">{tr("支付成功的新訂單、提交憑證待審核的充值、客服新訊息會分別以不同提示音提醒。瀏覽器需在頁面點擊過一次後才會發聲。")}</div>
        </div>
      )}
    </div>
  );
}

// Polls /admin/alerts; plays a distinct sound + toast per event type (orders paid / topup proofs / chat messages).
function useAdminAlerts(callApi, go, onOrders) {
  const sinceRef = useRef(null);
  useEffect(() => {
    const unlock = () => { unlockAudio(); if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); };
    window.addEventListener("pointerdown", unlock, { once: true });
    const tick = async () => {
      try {
        const r = await callApi({ method: "GET", url: `/admin/alerts?since=${encodeURIComponent(sinceRef.current || "")}` });
        const d = r.data;
        if (sinceRef.current) {
          const prefs = loadSoundPrefs();
          const desktop = prefs.desktop !== false && typeof Notification !== "undefined" && Notification.permission === "granted";
          const notify = (title, body, tag, onClick) => { if (!desktop) return; try { const nt = new Notification(title, { body, icon: "/icons/app-icon-512.png", tag, renotify: true }); nt.onclick = () => { window.focus(); onClick?.(); nt.close(); }; } catch {} };
          const fire = (kind, n, title, desc, section) => {
            if (!n) return;
            playAlert(kind, prefs);
            const jump = () => { if (section === "orders") sessionStorage.setItem("orders-hub-tab", "all"); go(section === "orders" ? "giftcard-orders" : section); };
            toast(title, { description: desc, duration: 10000, action: { label: tr("查看"), onClick: jump } });
            notify(title, desc, `admin-${kind}`, jump);
          };
          if (d.orders.length) {
            playAlert("order", prefs);
            onOrders(d.orders);
            notify(tr("新訂單：{0} 筆已支付", d.orders.length), d.orders.slice(0, 3).map((o) => `#${o.order_no || o.id.slice(0, 8)} $${o.total_usd}`).join("、"), "admin-order");
          }
          if (d.manual?.length) {
            playAlert("order", prefs);
            onOrders(d.manual.map((o) => ({ ...o, manual: true })));
            notify(tr("待人工轉贈：{0} 筆", d.manual.length), d.manual.slice(0, 3).map((o) => `#${o.order_no || o.id.slice(0, 8)} ${o.recharge_account || ""}`).join("、"), "admin-manual", () => { sessionStorage.setItem("orders-hub-tab", "gift"); sessionStorage.setItem("gco-status", "manual"); go("giftcard-orders"); });
          }
          fire("topup", d.topups.length, tr("充值審核：{0} 筆新憑證", d.topups.length), d.topups.slice(0, 3).map((t) => `${t.method_name || t.provider || ""} $${t.amount_usd}`).join("、"), "topups");
          fire("chat", d.chats.length, tr("客服：{0} 則新訊息", d.chats.length), d.chats.slice(0, 2).map((c) => c.text || tr("[圖片]")).join(" / "), "chat-sessions");
          if (d.chats.length) window.dispatchEvent(new Event("admin-badge-refresh"));
        }
        sinceRef.current = d.now;
      } catch {}
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => { clearInterval(id); window.removeEventListener("pointerdown", unlock); };
  }, [callApi, go, onOrders]);
}

function TabBar({ tabs, section, onSelect, onClose, onCloseOthers, onCloseAll }) {
  const [menu, setMenu] = useState(null);
  useEffect(() => { if (!menu) return; const h = () => setMenu(null); window.addEventListener("click", h); window.addEventListener("scroll", h, true); return () => { window.removeEventListener("click", h); window.removeEventListener("scroll", h, true); }; }, [menu]);
  return (
    <div data-testid="admin-tabbar" className="sticky top-0 z-30 flex items-stretch gap-1 px-3 h-11 bg-white border-b border-slate-200 overflow-x-auto admin-tabbar">
      {tabs.map((k) => {
        const active = k === section;
        return (
          <div key={k} data-testid={`admin-tab-${k}`} role="tab" aria-selected={active} onClick={() => onSelect(k)} onContextMenu={(e) => { e.preventDefault(); setMenu({ k, x: e.clientX, y: e.clientY }); }}
            className={`group/tab flex items-center gap-1.5 self-end h-9 pl-3.5 pr-1.5 rounded-t-lg text-[13px] cursor-pointer select-none whitespace-nowrap border border-b-0 transition-colors ${active ? "bg-orange-50 border-orange-200 text-orange-600 font-semibold" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
            <span>{SECTION_LABEL[k] || k}</span>
            <button data-testid={`admin-tab-close-${k}`} onClick={(e) => { e.stopPropagation(); onClose(k); }} title={tr("關閉")}
              className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${active ? "text-orange-400 hover:bg-orange-200 hover:text-orange-700" : "text-slate-400 opacity-0 group-hover/tab:opacity-100 hover:bg-slate-200 hover:text-slate-700"}`}><X className="h-3 w-3" /></button>
          </div>
        );
      })}
      {tabs.length > 1 && <button data-testid="admin-tabs-close-all" onClick={onCloseAll} className="ml-auto self-center shrink-0 h-7 px-2.5 rounded-md text-[11px] text-slate-400 hover:text-red-500 hover:bg-red-50">{tr("關閉全部")}</button>}
      <div className={`flex items-center shrink-0 ${tabs.length > 1 ? "" : "ml-auto"}`}><SoundControl /></div>
      {menu && (
        <div data-testid="admin-tab-context-menu" className="fixed z-50 w-36 rounded-lg bg-white shadow-xl border border-slate-200 py-1 text-[13px] text-slate-700" style={{ left: menu.x, top: menu.y }}>
          <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100" onClick={() => onClose(menu.k)}>{tr("關閉")}</button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100" onClick={() => onCloseOthers(menu.k)}>{tr("關閉其他")}</button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100" onClick={onCloseAll}>{tr("關閉全部")}</button>
        </div>
      )}
    </div>
  );
}

function AdminInner() {
  const callApi = useApi();
  const initialSection = new URLSearchParams(window.location.search).get("s") || "overview";
  const [section, setSectionState] = useState(initialSection);
  // Multi-tab workspace: every visited section stays mounted as a tab (state preserved) until closed.
  const [tabs, setTabs] = useState(() => { const t = readTabs(); return t.includes(initialSection) ? t : [...t, initialSection].slice(-MAX_TABS); });
  useEffect(() => { localStorage.setItem("admin_tabs", JSON.stringify(tabs)); }, [tabs]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("admin_sidebar_collapsed") === "1");
  const [pwOpen, setPwOpen] = useState(false);
  const [newOrders, setNewOrders] = useState([]);
  const onOrders = useCallback((list) => setNewOrders((prev) => { const ids = new Set(list.map((o) => o.id)); return [...list, ...prev.filter((o) => !ids.has(o.id))].slice(0, 20); }), []);
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("admin_sidebar_collapsed", c ? "0" : "1"); return !c; });
  const pushUrl = (k) => { const u = new URL(window.location.href); u.searchParams.set("s", k); window.history.pushState({}, "", u); };
  const setSection = useCallback((k) => { setSectionState(k); setTabs((t) => (t.includes(k) ? t : [...t, k].slice(-MAX_TABS))); pushUrl(k); }, []);
  useEffect(() => { const onPop = () => { const k = new URLSearchParams(window.location.search).get("s") || "overview"; setSectionState(k); setTabs((t) => (t.includes(k) ? t : [...t, k].slice(-MAX_TABS))); }; window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const closeTab = (k) => {
    const next = tabs.filter((x) => x !== k);
    if (!next.length) next.push("overview");
    setTabs(next);
    if (k === section) { const i = Math.min(tabs.indexOf(k), next.length - 1); setSectionState(next[Math.max(0, i)]); pushUrl(next[Math.max(0, i)]); }
  };
  const closeOthers = (k) => { setTabs([k]); setSectionState(k); pushUrl(k); };
  const closeAll = () => { setTabs(["overview"]); setSectionState("overview"); pushUrl("overview"); };
  const [open, setOpen] = useState(MENU.filter((m) => m.defaultOpen).map((m) => m.key));
  const [me, setMe] = useState(null);
  const [badges, setBadges] = useState({});
  const badBadgeRef = useRef(null);
  const toggle = (k) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const go = (k) => { setSection(k); const grp = MENU.find((m) => m.items.some(([ik]) => ik === k)); if (grp) setOpen((o) => (o.includes(grp.key) ? o : [...o, grp.key])); };
  const goRef = useRef(go); goRef.current = go;
  const goStable = useCallback((k) => goRef.current(k), []);
  useAdminAlerts(callApi, goStable, onOrders);

  useEffect(() => { callApi({ method: "GET", url: "/admin/me" }).then((r) => setMe(r.data)).catch(() => setMe({ is_super: true, permissions: [] })); }, [callApi]);
  useEffect(() => {
    const tick = () => callApi({ method: "GET", url: "/admin/badges" }).then((r) => {
      setBadges(r.data);
      const prev = badBadgeRef.current;
      if (prev !== null && (r.data.reviews || 0) > prev) toast.warning(tr("有 {0} 則新的差評待處理", r.data.reviews - prev), { description: tr("前往「商品評論」查看並回覆"), duration: 8000 });
      badBadgeRef.current = r.data.reviews || 0;
    }).catch(() => {});
    tick();
    const onRefresh = () => tick();
    window.addEventListener("admin-badge-refresh", onRefresh);
    const id = setInterval(tick, 30000);
    return () => { clearInterval(id); window.removeEventListener("admin-badge-refresh", onRefresh); };
  }, [callApi]);

  const allowed = (k) => !me || me.is_super || (me.permissions || []).includes(k);
  const visibleMenu = (me && !me.is_super)
    ? MENU.map((m) => ({ ...m, items: m.items.filter(([k]) => allowed(k)) })).filter((m) => m.items.length)
    : MENU;

  useEffect(() => { if (me && !allowed(section)) { const first = visibleMenu[0]?.items[0]?.[0] || "security"; setSection(first); } }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderPage = (k) => (allowed(k) ? (PAGES[k] || ((p) => <Soon title={SECTION_LABEL[k]} {...p} />)) : (() => <div className="text-slate-400 text-sm">{tr("無此模組權限")}</div>))({ callApi, go });

  return (
    <div className="admin-light min-h-screen bg-slate-950 text-slate-200 flex">
      {/* Sidebar */}
      <aside data-testid="admin-sidebar" data-collapsed={collapsed ? "1" : "0"} className={`${collapsed ? "w-16" : "w-56 md:w-64"} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen z-40 transition-[width] duration-200`}>
        <div className={`h-16 flex items-center gap-2 border-b border-slate-800 shrink-0 ${collapsed ? "justify-center px-0" : "px-4"}`}>
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-black shrink-0">G</div>
          {!collapsed && <div className="min-w-0 flex-1"><span className="font-head font-bold text-white block leading-tight">{tr("管理後台")}</span>{me && <span className="text-[10px] text-slate-400 truncate block" data-testid="admin-me-role">{me.role_name || (me.is_super ? tr("超級管理員") : tr("管理員"))}</span>}</div>}
          {!collapsed && <button data-testid="admin-sidebar-toggle" onClick={toggleCollapsed} title={tr("收起導航")} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"><PanelLeftClose className="h-4 w-4" /></button>}
        </div>
        {collapsed && <button data-testid="admin-sidebar-toggle" onClick={toggleCollapsed} title={tr("展開導航")} className="mx-auto mt-2 h-8 w-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"><PanelLeftOpen className="h-4 w-4" /></button>}
        <nav className={`flex-1 py-3 space-y-0.5 px-2 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
          {visibleMenu.map((m) => <NavGroup key={m.key} gkey={m.key} g={m.g} Icon={m.icon} items={m.items} section={section} setSection={(k) => go(k)} open={open.includes(m.key)} toggle={() => toggle(m.key)} badges={badges} collapsed={collapsed} />)}
          <div className="pt-2 mt-2 border-t border-slate-800">
            {LEAVES.map(([k, label, Icon]) => (
              <a key={k} href={`${ADMIN_BASE}?s=${k}`} data-testid={`admin-nav-${k}`} title={label} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); setSection(k); }}
                className={`w-full flex items-center gap-2.5 rounded-lg text-sm font-semibold transition-colors ${collapsed ? "justify-center h-10 px-0" : "px-3 py-2"} ${section === k ? (collapsed ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600") : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon className={collapsed ? "h-[18px] w-[18px]" : "h-4 w-4 shrink-0"} />{!collapsed && <span className="truncate">{label}</span>}
              </a>
            ))}
          </div>
        </nav>
        <button data-testid="admin-change-password" title={tr("修改密碼")} onClick={() => setPwOpen(true)} className={`flex items-center gap-2 py-2.5 text-xs text-slate-400 hover:text-white border-t border-slate-800 shrink-0 ${collapsed ? "justify-center" : "px-4"}`}>
          <KeyRound className="h-4 w-4" /> {!collapsed && <span>{tr("修改密碼")}</span>}
        </button>
        {pwOpen && <ChangePasswordDialog callApi={callApi} onClose={() => setPwOpen(false)} />}
        <NewOrderAlert orders={newOrders} onClose={() => setNewOrders([])} onView={() => { const manual = newOrders.some((o) => o.manual); setNewOrders([]); sessionStorage.setItem("orders-hub-tab", manual ? "gift" : "all"); if (manual) sessionStorage.setItem("gco-status", "manual"); go("giftcard-orders"); }} />
        <button data-testid="admin-logout" title={tr("登出後台")} onClick={() => { localStorage.removeItem("admin_token"); window.location.href = ADMIN_LOGIN; }} className={`flex items-center gap-2 py-2.5 text-xs text-slate-500 hover:text-red-500 border-t border-slate-800 shrink-0 ${collapsed ? "justify-center" : "px-4"}`}><ShieldAlert className="h-4 w-4" /> {!collapsed && <span>{tr("登出後台")}</span>}</button>
        <Link to="/" title={tr("返回商城")} className={`flex items-center gap-2 py-3 text-xs text-slate-500 hover:text-white border-t border-slate-800 shrink-0 ${collapsed ? "justify-center" : "px-4"}`}>
          <ArrowLeft className="h-4 w-4" /> {!collapsed && <span>{tr("返回商城")}</span>}
        </Link>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <TabBar tabs={tabs} section={section} onSelect={(k) => { setSectionState(k); pushUrl(k); }} onClose={closeTab} onCloseOthers={closeOthers} onCloseAll={closeAll} />
        <div className="flex-1 p-4 md:p-8">
          {tabs.map((k) => <div key={k} data-testid={`admin-tab-panel-${k}`} className={k === section ? "" : "hidden"}>{renderPage(k)}</div>)}
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h1 className="font-head text-2xl font-bold text-white">{title}</h1>
      {action}
    </div>
  );
}

function Currencies({ callApi }) {
  const [list, setList] = useState([]);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/currencies" }).then((r) => setList(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);
  const save = async (c, patch) => {
    const body = { ...c, ...patch };
    await callApi({ method: "PUT", url: `/admin/currencies/${c.code}`, data: body });
    toast.success(tr("{0} 已更新", c.code)); load();
  };
  const refresh = async () => {
    const r = await callApi({ method: "POST", url: "/admin/currencies/refresh" });
    toast.success(tr("已自動更新 {0} 種貨幣匯率", r.data.updated || 0)); load();
  };
  return (
    <div>
      <SectionHeader title={tr("多幣種與匯率管理")} right={<button data-testid="admin-refresh-rates" onClick={refresh} className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold">{tr("立即更新匯率")}</button>} />
      <div className="text-xs text-slate-500 mb-3">{tr("匯率每日 02:00 (UTC) 自動從 open.er-api.com 更新；關閉「自動」後將保留手動輸入的匯率。")}</div>
      <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
        {list.map((c) => (
          <div key={c.code} className="p-4 flex items-center gap-4 flex-wrap" data-testid={`admin-currency-${c.code}`}>
            <span className="text-2xl">{c.flag}</span>
            <div className="w-28"><div className="font-semibold text-white">{c.code}</div><div className="text-xs text-slate-500">{c.name}</div></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">1 USD =</span>
              <input type="number" step="0.0001" key={c.rate_to_usd} defaultValue={c.rate_to_usd} className={inputCls + " w-32"}
                onBlur={(e) => { const v = +e.target.value; if (v && v !== c.rate_to_usd) save(c, { rate_to_usd: v, auto_rate: false }); }} data-testid={`admin-rate-${c.code}`} />
              <span className="text-xs text-slate-400">{c.symbol}</span>
              {c.rate_updated_at && <span className="text-[10px] text-slate-500">{tr("更新於")} {c.rate_updated_at.slice(0, 16).replace("T", " ")}</span>}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300"><Switch checked={c.auto_rate !== false} onCheckedChange={(v) => save(c, { auto_rate: v })} data-testid={`admin-auto-rate-${c.code}`} /> {tr("自動")}</label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><Switch checked={c.active} onCheckedChange={(v) => save(c, { active: v })} /> {tr("啟用")}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyPromo = { code: "", discount_type: "percent", value: 10, min_order_usd: 0, active: true, expires_at: "" };

function Promos({ callApi }) {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/promos" }).then((r) => setList(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);
  const save = async (d) => {
    const body = { ...d, expires_at: d.expires_at || null };
    try {
      if (d.id) await callApi({ method: "PUT", url: `/admin/promos/${d.id}`, data: body });
      else await callApi({ method: "POST", url: "/admin/promos", data: body });
      toast.success(tr("已儲存")); setEditing(null); load();
    } catch { toast.error(tr("失敗")); }
  };
  const del = async (id) => { if (!window.confirm(tr("刪除優惠碼？"))) return; await callApi({ method: "DELETE", url: `/admin/promos/${id}` }); load(); };
  return (
    <div>
      <SectionHeader title={tr("優惠活動管理")} action={<button data-testid="admin-add-promo-btn" onClick={() => setEditing({ ...emptyPromo })} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> {tr("新增優惠碼")}</button>} />
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4">
            <div className="font-mono font-bold text-primary text-lg">{p.code}</div>
            <div className="text-sm text-slate-300">{p.discount_type === "percent" ? tr("{0}% 折扣", p.value) : tr("折抵 ${0}", p.value)} {p.min_order_usd > 0 && <span className="text-xs text-slate-500">{tr("· 滿 $")}{p.min_order_usd}</span>}</div>
            {!p.active && <span className="text-xs text-red-400">{tr("停用")}</span>}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setEditing({ ...p, expires_at: p.expires_at ? p.expires_at.slice(0, 10) : "" })} className="p-1.5 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(p.id)} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal testId="promo-dialog" title={editing.id ? tr("編輯優惠碼") : tr("新增優惠碼")} onClose={() => setEditing(null)}
          footer={<><Btn kind="secondary" onClick={() => setEditing(null)}>{tr("取消")}</Btn><Btn data-testid="promo-save-btn" onClick={() => save(editing)}>{tr("儲存")}</Btn></>}>
          <Field label={tr("優惠碼")}><Input data-testid="promo-code-input" className="w-full" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("類型")}>
              <select className={selCls} value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                <option value="percent">{tr("百分比 %")}</option><option value="fixed_usd">{tr("固定金額 USD")}</option>
              </select></Field>
            <Field label={tr("折扣值")}><Input type="number" step="0.01" className="w-full" value={editing.value} onChange={(e) => setEditing({ ...editing, value: +e.target.value })} /></Field>
            <Field label={tr("最低訂單 USD")}><Input type="number" step="0.01" className="w-full" value={editing.min_order_usd} onChange={(e) => setEditing({ ...editing, min_order_usd: +e.target.value })} /></Field>
            <Field label={tr("到期日")}><Input type="date" className="w-full" value={editing.expires_at} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> {tr("啟用")}</label>
        </Modal>
      )}
    </div>
  );
}



export default function Admin() {
  const navigate = useNavigate();
  const callApi = useApi();
  const { isSignedIn, isLoaded } = useUser();
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !localStorage.getItem("admin_token")) { navigate(ADMIN_LOGIN, { replace: true }); return; }
    callApi({ method: "GET", url: "/me" }).then((r) => setRole(r.data.role)).catch(() => setRole("member"));
    callApi({ method: "GET", url: "/admin/notifications" }).catch((e) => { if (e.response?.status === 401) { localStorage.removeItem("admin_token"); navigate(ADMIN_LOGIN, { replace: true }); } });
  }, [isLoaded, isSignedIn, callApi, navigate]);

  if (!isLoaded || (isSignedIn && role === null)) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (role && role !== "admin") return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
      <ShieldAlert className="h-12 w-12 text-red-400" />
      <p>{tr("您沒有管理權限")}</p>
      <Link to="/" className="text-primary text-sm">{tr("返回商城")}</Link>
    </div>
  );
  return <Show when="signed-in"><AdminInner /></Show>;
}


const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });

function LogoThumb({ src, name }) {
  const [err, setErr] = useState(false);
  return (
    <span className="bg-white border border-slate-200 rounded-md h-10 min-w-[76px] px-3 flex items-center justify-center overflow-hidden shrink-0">
      {src && !err ? <img src={src} alt={name} className="h-6 max-w-[110px] object-contain" onError={() => setErr(true)} />
        : <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[70px]">{name || tr("無圖")}</span>}
    </span>
  );
}

function PaymentLogos({ callApi }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/payment-logos" }).then((r) => setList(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!file) return toast.error(tr("請選擇 Logo 圖片"));
    setBusy(true);
    try { await callApi({ method: "POST", url: "/admin/payment-logos", data: { name, ...(await readFile(file)) } }); toast.success(tr("已新增")); setName(""); setFile(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("新增失敗")); }
    setBusy(false);
  };
  const update = async (id, data) => { try { await callApi({ method: "PUT", url: `/admin/payment-logos/${id}`, data }); load(); } catch { toast.error(tr("更新失敗")); } };
  const remove = async (id) => { if (!window.confirm(tr("確定刪除此 Logo？"))) return; await callApi({ method: "DELETE", url: `/admin/payment-logos/${id}` }); toast.success(tr("已刪除")); load(); };
  const move = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    await update(list[i].id, { sort_order: list[j].sort_order }); await update(list[j].id, { sort_order: list[i].sort_order });
  };
  const replaceImg = async (id, f) => { if (!f) return; await update(id, await readFile(f)); toast.success(tr("圖片已更新")); };
  const inp = "h-11 rounded-xl bg-slate-100 border border-slate-200 px-4 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-orange-300";

  return (
    <div>
      <SectionHeader title={tr("支付方式 Logo（頁尾顯示）")} />
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">{tr("名稱")}<br /><input data-testid="paylogo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("例如 VISA")} className={`${inp} mt-1 w-48`} /></label>
        <label className="text-sm text-slate-600">{tr("圖片（PNG/SVG/JPG，≤2M，建議透明底）")}<br />
          <input data-testid="paylogo-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-white" />
        </label>
        <button data-testid="paylogo-add" onClick={add} disabled={busy} className="h-11 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60 flex items-center gap-2"><Plus className="h-4 w-4" />{tr("新增")}</button>
        <span className="text-xs text-slate-400">{tr("未新增任何 Logo 時，頁尾顯示系統內建的預設樣式。")}</span>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="text-slate-400 text-sm">{tr("尚無上傳的 Logo")}</div>}
        {list.map((l, i) => (
          <div key={l.id} data-testid={`paylogo-row-${l.id}`} className={`flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3 ${l.active ? "" : "opacity-60"}`}>
            <LogoThumb src={l.image} name={l.name} />
            <input defaultValue={l.name} onBlur={(e) => e.target.value !== l.name && update(l.id, { name: e.target.value })} className={`${inp} w-44`} data-testid={`paylogo-name-${l.id}`} />
            <label className="h-9 px-3 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-1 cursor-pointer hover:bg-slate-200"><ImagePlus className="h-3.5 w-3.5" />{tr("更換圖片")}<input type="file" accept="image/*" className="hidden" onChange={(e) => replaceImg(l.id, e.target.files?.[0])} /></label>
            <button onClick={() => update(l.id, { active: !l.active })} data-testid={`paylogo-toggle-${l.id}`} className={`h-9 px-3 rounded-full text-xs font-semibold border ${l.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>{l.active ? tr("顯示中") : tr("已隱藏")}</button>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-orange-600"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-orange-600"><ArrowDown className="h-4 w-4" /></button>
              <button onClick={() => remove(l.id)} data-testid={`paylogo-delete-${l.id}`} className="h-8 w-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-100"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
