import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Show, useUser } from "@clerk/react";
import { LayoutDashboard, Package, ShoppingBag, Star, DollarSign, Tag, Users, Plus, Pencil, Trash2, X, Loader2, ArrowLeft, TrendingUp, Clock, ShieldAlert, Settings, CreditCard, ArrowUp, ArrowDown, ImagePlus, Wallet, BadgeCheck, MessageSquare, Globe, Bell, Megaphone, LayoutGrid, Gift, Zap, ShieldCheck, ChevronDown, Construction } from "lucide-react";
import { toast } from "sonner";
import { useApi, publicApi } from "@/lib/api";
import { STATUS_LABELS, STATUS_ORDER, StatusBadge } from "@/lib/status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VerificationsAdmin, FeedbackAdmin } from "@/pages/admin/SupportAdmin";
import PaymentMethodsAdmin from "@/pages/admin/PaymentMethodsAdmin";
import { MembersAdmin } from "@/pages/admin/MembersAdmin";
import { TopupsAdmin } from "@/pages/admin/TopupsAdmin";
import { ReportsAdmin } from "@/pages/admin/ReportsAdmin";
import { TranslationsAdmin } from "@/pages/admin/TranslationsAdmin";
import { NotificationsAdmin } from "@/pages/admin/NotificationsAdmin";
import { ActivitiesAdmin } from "@/pages/admin/ActivitiesAdmin";
import { SiteConfigAdmin } from "@/pages/admin/SiteConfigAdmin";
import { ProductsAdmin } from "@/pages/admin/ProductsAdmin";
import { CategoriesAdmin } from "@/pages/admin/CategoriesAdmin";
import { OrdersAdmin } from "@/pages/admin/OrdersAdmin";
import { DashboardAdmin } from "@/pages/admin/DashboardAdmin";
import { Soon } from "@/pages/admin/Soon";
import { UserLevelsAdmin } from "@/pages/admin/UserLevelsAdmin";
import { UserTagsAdmin } from "@/pages/admin/UserTagsAdmin";
import { MemberAssetsAdmin } from "@/pages/admin/MemberAssetsAdmin";
import { BlacklistAdmin } from "@/pages/admin/BlacklistAdmin";
import { UserLogsAdmin } from "@/pages/admin/UserLogsAdmin";
import { PointsAdmin } from "@/pages/admin/PointsAdmin";
import { RechargeBonusAdmin } from "@/pages/admin/RechargeBonusAdmin";
import { GiftCardsAdmin, GiftCardRedemptionsAdmin, GiftCardApiAdmin } from "@/pages/admin/GiftCardsAdmin";
import { CartPromoAdmin } from "@/pages/admin/CartPromoAdmin";
import { tr } from "@/i18n";

// Full admin IA — collapsible two-level menu. Keys map to real pages in PAGES; everything else renders <Soon/>.
const MENU = [
  { key: "dashboard", g: tr("儀表盤"), icon: LayoutDashboard, defaultOpen: true, items: [["overview", tr("數據概覽")], ["sales-analysis", tr("銷售分析")], ["realtime", tr("實時監控")], ["download-reports", tr("下載報表")]] },
  { key: "users", g: tr("用戶管理"), icon: Users, defaultOpen: true, items: [["members", tr("用戶列表")], ["user-levels", tr("用戶等級")], ["user-tags", tr("用戶標籤")], ["member-assets", tr("會員資產")], ["blacklist", tr("黑名單管理")], ["user-logs", tr("用戶日誌")], ["verifications", tr("用戶認證")], ["user-batch", tr("用戶批量操作")], ["feedback", tr("用戶反饋")], ["user-reports", tr("用戶報表統計")]] },
  { key: "products", g: tr("商品管理"), icon: Package, items: [["products", tr("商品列表")], ["product-new", tr("新增商品")], ["categories", tr("商品分類")], ["specs", tr("規格管理")], ["inventory", tr("庫存管理")], ["reviews", tr("商品評論")]] },
  { key: "giftcards", g: tr("禮品卡管理"), icon: Gift, items: [["giftcards", tr("禮品卡列表")], ["giftcard-new", tr("創建禮品卡")], ["giftcard-redeem", tr("卡券核銷記錄")], ["giftcard-orders", tr("禮品卡訂單")], ["giftcard-api", tr("核銷API配置")]] },
  { key: "ops", g: tr("運營管理"), icon: Megaphone, items: [["home-decoration", tr("首頁裝修")], ["banners", tr("輪播圖管理")], ["recommendations", tr("推薦位管理")], ["promos", tr("優惠券管理")], ["points", tr("積分管理")], ["notifications", tr("消息中心")], ["announcements", tr("公告管理")]] },
  { key: "activities", g: tr("活動管理"), icon: Zap, items: [["activities", tr("活動列表")], ["flashsale", tr("秒殺活動")], ["recharge-activity", tr("充值活動")], ["discount-activity", tr("滿減/滿折活動")], ["lottery", tr("抽獎活動")], ["combo", tr("組合套餐")], ["activity-records", tr("活動記錄")]] },
  { key: "finance", g: tr("財務管理"), icon: DollarSign, items: [["orders", tr("訂單管理")], ["order-settlement", tr("訂單結算")], ["topups", tr("資金流水")], ["payments", tr("支付渠道配置")], ["reconciliation", tr("財務對賬")], ["currencies", tr("匯率配置")], ["finance-reports", tr("財務報表")]] },
  { key: "system", g: tr("系統配置"), icon: Settings, items: [["siteconfig", tr("基礎設置")], ["admins", tr("管理員管理")], ["roles", tr("角色權限管理")], ["operation-logs", tr("操作日誌")], ["sms-config", tr("短信配置")], ["email-config", tr("郵箱配置")], ["oauth-config", tr("授權配置")], ["translations", tr("翻譯管理")], ["paylogos", tr("頁尾支付Logo")]] },
];
const LEAVES = [["security", tr("安全配置"), ShieldCheck]];
const SECTION_LABEL = Object.fromEntries([...MENU.flatMap((m) => m.items), ...LEAVES.map(([k, l]) => [k, l])]);

const ALL_STATUSES = Object.keys(STATUS_LABELS);
const inputCls = "w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 outline-none focus:border-primary";

const NavGroup = ({ gkey, g, Icon, items, section, setSection, open, toggle }) => {
  const active = items.some(([k]) => k === section);
  return (
    <div>
      <button data-testid={`admin-group-${gkey}`} onClick={toggle}
        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? "text-orange-600" : "text-slate-600 hover:bg-slate-100"}`}>
        <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left truncate">{g}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 mb-1 ml-3.5 pl-3 border-l border-slate-200 space-y-0.5">
          {items.map(([k, label]) => (
            <button key={k} data-testid={`admin-nav-${k}`} onClick={() => setSection(k)}
              className={`w-full flex items-center rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${section === k ? "bg-orange-500 text-white font-semibold" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
              <span className="truncate">{label}</span>
            </button>
          ))}
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
  categories: (p) => <CategoriesAdmin {...p} />,
  reviews: (p) => <Reviews {...p} />,
  promos: (p) => <Promos {...p} />,
  notifications: (p) => <NotificationsAdmin {...p} />,
  activities: (p) => <ActivitiesAdmin {...p} />,
  orders: (p) => <OrdersAdmin {...p} />,
  topups: (p) => <TopupsAdmin {...p} />,
  payments: (p) => <PaymentMethodsAdmin {...p} />,
  currencies: (p) => <Currencies {...p} />,
  siteconfig: (p) => <SiteConfigAdmin {...p} />,
  translations: (p) => <TranslationsAdmin {...p} />,
  paylogos: (p) => <PaymentLogos {...p} />,
  "download-reports": (p) => <ReportsAdmin {...p} />,
  "user-levels": (p) => <UserLevelsAdmin {...p} />,
  "user-tags": (p) => <UserTagsAdmin {...p} />,
  "member-assets": (p) => <MemberAssetsAdmin {...p} />,
  blacklist: (p) => <BlacklistAdmin {...p} />,
  "user-logs": (p) => <UserLogsAdmin {...p} />,
  points: (p) => <PointsAdmin {...p} />,
  "recharge-activity": (p) => <RechargeBonusAdmin {...p} />,
  giftcards: (p) => <GiftCardsAdmin {...p} />,
  "giftcard-new": (p) => <GiftCardsAdmin {...p} />,
  "giftcard-redeem": (p) => <GiftCardRedemptionsAdmin {...p} />,
  "giftcard-orders": (p) => <GiftCardRedemptionsAdmin {...p} />,
  "giftcard-api": (p) => <GiftCardApiAdmin {...p} />,
  "discount-activity": (p) => <CartPromoAdmin {...p} />,
};

function AdminInner() {
  const callApi = useApi();
  const [section, setSection] = useState("overview");
  const [open, setOpen] = useState(MENU.filter((m) => m.defaultOpen).map((m) => m.key));
  const toggle = (k) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const go = (k) => { setSection(k); const grp = MENU.find((m) => m.items.some(([ik]) => ik === k)); if (grp) setOpen((o) => (o.includes(grp.key) ? o : [...o, grp.key])); };
  const render = PAGES[section] || ((p) => <Soon title={SECTION_LABEL[section]} {...p} />);

  return (
    <div className="admin-light min-h-screen bg-slate-950 text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-56 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-800 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-black">G</div>
          <span className="font-head font-bold text-white">{tr("管理後台")}</span>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {MENU.map((m) => <NavGroup key={m.key} gkey={m.key} g={m.g} Icon={m.icon} items={m.items} section={section} setSection={go} open={open.includes(m.key)} toggle={() => toggle(m.key)} />)}
          <div className="pt-2 mt-2 border-t border-slate-800">
            {LEAVES.map(([k, label, Icon]) => (
              <button key={k} data-testid={`admin-nav-${k}`} onClick={() => setSection(k)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${section === k ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </nav>
        <button data-testid="admin-logout" onClick={() => { sessionStorage.removeItem("admin_token"); window.location.href = "/admin/login"; }} className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 hover:text-red-500 border-t border-slate-800 shrink-0"><ShieldAlert className="h-4 w-4" /> <span>{tr("登出後台")}</span></button>
        <Link to="/" className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 hover:text-white border-t border-slate-800 shrink-0">
          <ArrowLeft className="h-4 w-4" /> <span>{tr("返回商城")}</span>
        </Link>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
        {render({ callApi, go })}
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

function Reviews({ callApi }) {
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/reviews" }).then((r) => setList(r.data)), [callApi]);
  useEffect(() => { load(); publicApi.get("/products").then((r) => setProducts(r.data)); }, [load]);

  const save = async (d) => {
    try {
      if (d.id) await callApi({ method: "PUT", url: `/admin/reviews/${d.id}`, data: d });
      else await callApi({ method: "POST", url: "/admin/reviews", data: d });
      toast.success(tr("已儲存")); setEditing(null); load();
    } catch { toast.error(tr("失敗")); }
  };
  const del = async (id) => { if (!window.confirm(tr("刪除評價？"))) return; await callApi({ method: "DELETE", url: `/admin/reviews/${id}` }); load(); };
  const pname = (pid) => products.find((p) => p.id === pid)?.name || pid;

  return (
    <div>
      <SectionHeader title={tr("評價管理")} action={<button data-testid="admin-add-review-btn" onClick={() => setEditing({ product_id: products[0]?.id || "", author: "", rating: 5, content: "", images: [], visible: true })} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> {tr("新增評價")}</button>} />
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white">{r.author} <span className="text-amber-400">{"★".repeat(r.rating)}</span></div>
              <div className="flex items-center gap-1">
                {!r.visible && <span className="text-xs text-red-400">{tr("已隱藏")}</span>}
                <button onClick={() => setEditing(r)} className="p-1.5 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(r.id)} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{pname(r.product_id)}</div>
            <p className="text-sm text-slate-300 mt-1">{r.content}</p>
          </div>
        ))}
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
            <DialogHeader><DialogTitle className="text-white">{editing.id ? tr("編輯評價") : tr("新增評價")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400">{tr("商品")}</label>
                <select className={inputCls} value={editing.product_id} onChange={(e) => setEditing({ ...editing, product_id: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400">{tr("作者")}</label><input className={inputCls} value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">{tr("評分 1-5")}</label><input type="number" min="1" max="5" className={inputCls} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: +e.target.value })} /></div>
              </div>
              <div><label className="text-xs text-slate-400">{tr("內容")}</label><textarea className={inputCls + " h-20 py-2"} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.visible} onCheckedChange={(v) => setEditing({ ...editing, visible: v })} /> {tr("前台顯示")}</label>
            </div>
            <DialogFooter>
              <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">{tr("取消")}</button>
              <button onClick={() => save(editing)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">{tr("儲存")}</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
            <DialogHeader><DialogTitle className="text-white">{editing.id ? tr("編輯優惠碼") : tr("新增優惠碼")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400">{tr("優惠碼")}</label><input data-testid="promo-code-input" className={inputCls} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400">{tr("類型")}</label>
                  <select className={inputCls} value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                    <option value="percent">{tr("百分比 %")}</option><option value="fixed_usd">{tr("固定金額 USD")}</option>
                  </select></div>
                <div><label className="text-xs text-slate-400">{tr("折扣值")}</label><input type="number" step="0.01" className={inputCls} value={editing.value} onChange={(e) => setEditing({ ...editing, value: +e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">{tr("最低訂單 USD")}</label><input type="number" step="0.01" className={inputCls} value={editing.min_order_usd} onChange={(e) => setEditing({ ...editing, min_order_usd: +e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">{tr("到期日")}</label><input type="date" className={inputCls} value={editing.expires_at} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> {tr("啟用")}</label>
            </div>
            <DialogFooter>
              <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">{tr("取消")}</button>
              <button data-testid="promo-save-btn" onClick={() => save(editing)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">{tr("儲存")}</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
    if (!isSignedIn || !sessionStorage.getItem("admin_token")) { navigate("/admin/login", { replace: true }); return; }
    callApi({ method: "GET", url: "/me" }).then((r) => setRole(r.data.role)).catch(() => setRole("member"));
    callApi({ method: "GET", url: "/admin/notifications" }).catch((e) => { if (e.response?.status === 401) { sessionStorage.removeItem("admin_token"); navigate("/admin/login", { replace: true }); } });
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
  const inp = "h-11 rounded-xl bg-slate-800 border border-slate-700 px-4 text-sm text-white outline-none focus:border-orange-400";

  return (
    <div>
      <SectionHeader title={tr("支付方式 Logo（頁尾顯示）")} />
      <div className="bg-slate-800/60 rounded-2xl p-5 mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">{tr("名稱")}<br /><input data-testid="paylogo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("例如 VISA")} className={`${inp} mt-1 w-48`} /></label>
        <label className="text-sm text-slate-300">{tr("圖片（PNG/SVG/JPG，≤2M，建議透明底）")}<br />
          <input data-testid="paylogo-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-white" />
        </label>
        <button data-testid="paylogo-add" onClick={add} disabled={busy} className="h-11 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60 flex items-center gap-2"><Plus className="h-4 w-4" />{tr("新增")}</button>
        <span className="text-xs text-slate-500">{tr("未新增任何 Logo 時，頁尾顯示系統內建的預設樣式。")}</span>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="text-slate-500 text-sm">{tr("尚無上傳的 Logo")}</div>}
        {list.map((l, i) => (
          <div key={l.id} data-testid={`paylogo-row-${l.id}`} className={`flex items-center gap-4 bg-slate-800/60 rounded-xl px-4 py-3 ${l.active ? "" : "opacity-50"}`}>
            <span className="bg-white rounded-md h-10 px-3 flex items-center justify-center"><img src={l.image} alt={l.name} className="h-6 max-w-[110px] object-contain" /></span>
            <input defaultValue={l.name} onBlur={(e) => e.target.value !== l.name && update(l.id, { name: e.target.value })} className={`${inp} w-44`} data-testid={`paylogo-name-${l.id}`} />
            <label className="h-9 px-3 rounded-full bg-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-600"><ImagePlus className="h-3.5 w-3.5" />{tr("更換圖片")}<input type="file" accept="image/*" className="hidden" onChange={(e) => replaceImg(l.id, e.target.files?.[0])} /></label>
            <button onClick={() => update(l.id, { active: !l.active })} data-testid={`paylogo-toggle-${l.id}`} className={`h-9 px-3 rounded-full text-xs ${l.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{l.active ? tr("顯示中") : tr("已隱藏")}</button>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"><ArrowDown className="h-4 w-4" /></button>
              <button onClick={() => remove(l.id)} data-testid={`paylogo-delete-${l.id}`} className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-300 hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
