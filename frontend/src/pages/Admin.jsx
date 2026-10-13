import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Show, useUser } from "@clerk/react";
import {
  LayoutDashboard, Package, ShoppingBag, Star, DollarSign, Tag, Users,
  Plus, Pencil, Trash2, X, Loader2, ArrowLeft, TrendingUp, Clock, ShieldAlert,
  Settings, CreditCard, ArrowUp, ArrowDown, ImagePlus, Wallet, BadgeCheck, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useApi, publicApi } from "@/lib/api";
import { STATUS_LABELS, STATUS_ORDER, StatusBadge } from "@/lib/status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import WalletAdmin from "@/pages/admin/WalletAdmin";
import { VerificationsAdmin, FeedbackAdmin } from "@/pages/admin/SupportAdmin";

const NAV = [
  ["overview", "總覽", LayoutDashboard],
  ["products", "商品管理", Package],
  ["orders", "訂單管理", ShoppingBag],
  ["wallets", "錢包管理", Wallet],
  ["verifications", "認證審核", BadgeCheck],
  ["feedback", "用戶反饋", MessageSquare],
  ["reviews", "評價管理", Star],
  ["currencies", "匯率管理", DollarSign],
  ["promos", "優惠碼", Tag],
  ["users", "用戶管理", Users],
  ["settings", "網站設定", Settings],
  ["paylogos", "支付Logo", CreditCard],
];

const ALL_STATUSES = Object.keys(STATUS_LABELS);
const inputCls = "w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 outline-none focus:border-primary";

function AdminInner() {
  const callApi = useApi();
  const [section, setSection] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-16 md:w-60 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-white font-black">G</div>
          <span className="hidden md:block font-head font-bold text-white">管理後台</span>
        </div>
        <nav className="flex-1 py-3 space-y-1 px-2">
          {NAV.map(([key, label, Icon]) => (
            <button
              key={key}
              data-testid={`admin-nav-${key}`}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                section === key ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">{label}</span>
            </button>
          ))}
        </nav>
        <Link to="/" className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 hover:text-white border-t border-slate-800">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden md:block">返回商城</span>
        </Link>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
        {section === "overview" && <Overview callApi={callApi} />}
        {section === "products" && <Products callApi={callApi} />}
        {section === "orders" && <Orders callApi={callApi} />}
        {section === "wallets" && <WalletAdmin callApi={callApi} />}
        {section === "verifications" && <VerificationsAdmin callApi={callApi} />}
        {section === "feedback" && <FeedbackAdmin callApi={callApi} />}
        {section === "reviews" && <Reviews callApi={callApi} />}
        {section === "currencies" && <Currencies callApi={callApi} />}
        {section === "promos" && <Promos callApi={callApi} />}
        {section === "settings" && <SiteSettings callApi={callApi} />}
        {section === "paylogos" && <PaymentLogos callApi={callApi} />}
        {section === "users" && <UsersSec callApi={callApi} />}
      </main>
    </div>
  );
}

function Overview({ callApi }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    callApi({ method: "GET", url: "/admin/stats" }).then((r) => setStats(r.data)).catch(() => {});
  }, [callApi]);
  if (!stats) return <Loader2 className="h-6 w-6 animate-spin" />;
  const cards = [
    ["總營收 (USD)", `$${stats.revenue_usd.toLocaleString()}`, TrendingUp, "text-emerald-400"],
    ["訂單總數", stats.order_count, ShoppingBag, "text-blue-400"],
    ["待處理發貨", stats.pending_dispatch, Clock, "text-amber-400"],
    ["商品數 / 用戶數", `${stats.product_count} / ${stats.user_count}`, Users, "text-violet-400"],
  ];
  return (
    <div>
      <h1 className="font-head text-2xl font-bold text-white mb-6">總覽儀表板</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(([label, val, Icon, color], i) => (
          <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <Icon className={`h-5 w-5 ${color}`} />
            <div className="font-head font-extrabold text-2xl text-white mt-3">{val}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <h2 className="font-semibold text-white mb-3">訂單狀態分佈</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_STATUSES.map((s) => (
          <div key={s} className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <div className="font-head font-bold text-xl text-white">{stats.by_status[s] || 0}</div>
            <div className="text-xs text-slate-500 mt-1">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>
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

const emptyProduct = {
  name: "", category: "douyin", brand: "", image: "", description: "", tutorial: "",
  account_field_label: "充值帳號", account_field_hint: "", specs: [], tags: [],
  sales_count: 0, rating: 5, sort_order: 0, active: true,
};

function Products({ callApi }) {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => {
    callApi({ method: "GET", url: "/admin/products" }).then((r) => setList(r.data)).catch(() => {});
  }, [callApi]);
  useEffect(() => { load(); publicApi.get("/categories").then((r) => setCats(r.data)); }, [load]);

  const save = async (data) => {
    const payload = { ...data, tags: typeof data.tags === "string" ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : data.tags };
    try {
      if (data.id) await callApi({ method: "PUT", url: `/admin/products/${data.id}`, data: payload });
      else await callApi({ method: "POST", url: "/admin/products", data: payload });
      toast.success("已儲存");
      setEditing(null);
      load();
    } catch { toast.error("儲存失敗"); }
  };
  const del = async (id) => {
    if (!window.confirm("確定刪除此商品？")) return;
    await callApi({ method: "DELETE", url: `/admin/products/${id}` });
    toast.success("已刪除");
    load();
  };

  return (
    <div>
      <SectionHeader title="商品管理" action={
        <button data-testid="admin-add-product-btn" onClick={() => setEditing({ ...emptyProduct, tags: "", specs: [{ id: `new-${Date.now()}`, label: "", price_usd: 0, in_stock: true }] })}
          className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> 新增商品</button>
      } />
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} data-testid={`admin-product-${p.id}`} className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex items-center gap-3">
            <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{p.name}</div>
              <div className="text-xs text-slate-500">{p.brand} · {p.specs.length} 規格 · 已售 {p.sales_count}</div>
            </div>
            {!p.active && <span className="text-xs text-red-400">已下架</span>}
            <button data-testid={`admin-edit-product-${p.id}`} onClick={() => setEditing({ ...p, tags: p.tags.join(", ") })} className="p-2 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => del(p.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {editing && <ProductForm product={editing} cats={cats} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ProductForm({ product, cats, onClose, onSave }) {
  const [f, setF] = useState(product);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setSpec = (i, k, v) => setF((p) => ({ ...p, specs: p.specs.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)) }));
  const addSpec = () => setF((p) => ({ ...p, specs: [...p.specs, { id: `new-${Date.now()}`, label: "", price_usd: 0, in_stock: true }] }));
  const rmSpec = (i) => setF((p) => ({ ...p, specs: p.specs.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{f.id ? "編輯商品" : "新增商品"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400">名稱</label><input data-testid="pf-name" className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">品牌</label><input className={inputCls} value={f.brand} onChange={(e) => set("brand", e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">分類</label>
              <select className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-400">排序</label><input type="number" className={inputCls} value={f.sort_order} onChange={(e) => set("sort_order", +e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-slate-400">圖片 URL</label><input className={inputCls} value={f.image} onChange={(e) => set("image", e.target.value)} /></div>
          <div><label className="text-xs text-slate-400">標籤（逗號分隔）</label><input className={inputCls} value={f.tags} onChange={(e) => set("tags", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400">帳號欄位名稱</label><input className={inputCls} value={f.account_field_label} onChange={(e) => set("account_field_label", e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">帳號提示</label><input className={inputCls} value={f.account_field_hint} onChange={(e) => set("account_field_hint", e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-slate-400">商品說明</label><textarea className={inputCls + " h-20 py-2"} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div><label className="text-xs text-slate-400">充值教學</label><textarea className={inputCls + " h-20 py-2"} value={f.tutorial} onChange={(e) => set("tutorial", e.target.value)} /></div>

          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-xs text-slate-400">規格 / 價格 (USD)</label>
              <button data-testid="pf-add-spec" onClick={addSpec} className="text-xs text-primary flex items-center gap-1"><Plus className="h-3 w-3" /> 新增規格</button></div>
            <div className="space-y-2">
              {f.specs.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="規格名 如 1000 幣" className={inputCls + " flex-1"} value={s.label} onChange={(e) => setSpec(i, "label", e.target.value)} />
                  <input type="number" step="0.01" placeholder="USD" className={inputCls + " w-24"} value={s.price_usd} onChange={(e) => setSpec(i, "price_usd", +e.target.value)} />
                  <label className="flex items-center gap-1 text-xs text-slate-400"><Switch checked={s.in_stock} onCheckedChange={(v) => setSpec(i, "in_stock", v)} /> 有貨</label>
                  <button onClick={() => rmSpec(i)} className="text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-slate-400">已售數</label><input type="number" className={inputCls} value={f.sales_count} onChange={(e) => set("sales_count", +e.target.value)} /></div>
            <div><label className="text-xs text-slate-400">評分</label><input type="number" step="0.1" className={inputCls} value={f.rating} onChange={(e) => set("rating", +e.target.value)} /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-300 h-10"><Switch checked={f.active} onCheckedChange={(v) => set("active", v)} /> 上架</label></div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">取消</button>
          <button data-testid="pf-save" onClick={() => onSave(f)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">儲存</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Orders({ callApi }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const load = useCallback(() => {
    callApi({ method: "GET", url: `/admin/orders${filter === "all" ? "" : `?status=${filter}`}` }).then((r) => setList(r.data)).catch(() => {});
  }, [callApi, filter]);
  useEffect(() => { load(); }, [load]);

  const confirmTopup = async (o) => {
    if (!window.confirm(`確認已完成人工充值？訂單 ${o.order_no} 將標記為「已完成」`)) return;
    try { await callApi({ method: "POST", url: `/admin/orders/${o.id}/confirm` }); toast.success("已確認充值，訂單完成"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "操作失敗"); }
  };
  const changeStatus = async (o, status) => {
    await callApi({ method: "PATCH", url: `/admin/orders/${o.id}`, data: { status } });
    toast.success(`已更新為「${STATUS_LABELS[status]}」`);
    load();
  };
  const addNote = async (o) => {
    const note = window.prompt("客服備註", o.admin_note || "");
    if (note === null) return;
    await callApi({ method: "PATCH", url: `/admin/orders/${o.id}`, data: { status: o.status, admin_note: note } });
    toast.success("備註已更新");
    load();
  };

  return (
    <div>
      <SectionHeader title="訂單管理" />
      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4">
        {[["all", "全部"], ...Object.entries(STATUS_LABELS)].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5 ${filter === k ? "bg-primary text-white" : "bg-slate-800 text-slate-400"}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {list.length === 0 && <div className="text-slate-500 text-sm py-10 text-center">暫無訂單</div>}
        {list.map((o) => (
          <div key={o.id} data-testid={`admin-order-${o.id}`} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-slate-500">{o.order_no}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="text-sm text-white">{o.items.map((i) => `${i.product_name} ${i.spec_label}×${i.quantity}`).join("、")}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
              <div>充值帳號：<span className="text-slate-200 font-semibold">{o.recharge_account}</span></div>
              <div>金額：{o.currency_symbol}{(o.total_usd * o.rate_to_usd).toFixed(2)} {o.currency}</div>
              {o.delivery_info && Object.values(o.delivery_info).flatMap((f) => Object.entries(f)).map(([k, v]) => <div key={k}>{k}：<span className="text-slate-200">{v}</span></div>)}
              {o.recharge_note && <div>備註：{o.recharge_note}</div>}
              {o.contact && <div>聯絡：{o.contact}</div>}
              {o.admin_note && <div className="col-span-2 text-emerald-400">客服備註：{o.admin_note}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {["paid", "processing", "shipped"].includes(o.status) && <button data-testid={`admin-order-confirm-${o.id}`} onClick={() => confirmTopup(o)} className="text-xs h-8 px-3 rounded-lg bg-emerald-500 text-white font-semibold">確認充值完成</button>}
              {o.status === "paid" && o.info_submitted === false && <span className="text-xs text-amber-400">用戶尚未填寫充值資料</span>}
              {o.status === "paid" && <button data-testid={`admin-order-start-${o.id}`} onClick={() => changeStatus(o, "processing")} className="text-xs h-8 px-3 rounded-lg bg-violet-600 text-white">開始充值</button>}
              {o.status === "processing" && <button data-testid={`admin-order-ship-${o.id}`} onClick={() => changeStatus(o, "shipped")} className="text-xs h-8 px-3 rounded-lg bg-cyan-600 text-white">確認人工發貨</button>}
              {o.status === "shipped" && <button onClick={() => changeStatus(o, "completed")} className="text-xs h-8 px-3 rounded-lg bg-emerald-600 text-white">標記已完成</button>}
              {!["completed", "exception"].includes(o.status) && <button onClick={() => changeStatus(o, "exception")} className="text-xs h-8 px-3 rounded-lg bg-red-600/80 text-white flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> 標記異常</button>}
              <select value={o.status} onChange={(e) => changeStatus(o, e.target.value)} className="text-xs h-8 rounded-lg bg-slate-800 border border-slate-700 px-2 text-slate-200">
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <button onClick={() => addNote(o)} className="text-xs h-8 px-3 rounded-lg border border-slate-700 text-slate-300">備註</button>
            </div>
          </div>
        ))}
      </div>
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
      toast.success("已儲存"); setEditing(null); load();
    } catch { toast.error("失敗"); }
  };
  const del = async (id) => { if (!window.confirm("刪除評價？")) return; await callApi({ method: "DELETE", url: `/admin/reviews/${id}` }); load(); };
  const pname = (pid) => products.find((p) => p.id === pid)?.name || pid;

  return (
    <div>
      <SectionHeader title="評價管理" action={<button data-testid="admin-add-review-btn" onClick={() => setEditing({ product_id: products[0]?.id || "", author: "", rating: 5, content: "", images: [], visible: true })} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> 新增評價</button>} />
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white">{r.author} <span className="text-amber-400">{"★".repeat(r.rating)}</span></div>
              <div className="flex items-center gap-1">
                {!r.visible && <span className="text-xs text-red-400">已隱藏</span>}
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
            <DialogHeader><DialogTitle className="text-white">{editing.id ? "編輯評價" : "新增評價"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400">商品</label>
                <select className={inputCls} value={editing.product_id} onChange={(e) => setEditing({ ...editing, product_id: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400">作者</label><input className={inputCls} value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">評分 1-5</label><input type="number" min="1" max="5" className={inputCls} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: +e.target.value })} /></div>
              </div>
              <div><label className="text-xs text-slate-400">內容</label><textarea className={inputCls + " h-20 py-2"} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.visible} onCheckedChange={(v) => setEditing({ ...editing, visible: v })} /> 前台顯示</label>
            </div>
            <DialogFooter>
              <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">取消</button>
              <button onClick={() => save(editing)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">儲存</button>
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
    toast.success(`${c.code} 已更新`); load();
  };
  return (
    <div>
      <SectionHeader title="多幣種與匯率管理" />
      <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
        {list.map((c) => (
          <div key={c.code} className="p-4 flex items-center gap-4" data-testid={`admin-currency-${c.code}`}>
            <span className="text-2xl">{c.flag}</span>
            <div className="w-24"><div className="font-semibold text-white">{c.code}</div><div className="text-xs text-slate-500">{c.name}</div></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">1 USD =</span>
              <input type="number" step="0.01" defaultValue={c.rate_to_usd} className={inputCls + " w-28"}
                onBlur={(e) => { const v = +e.target.value; if (v && v !== c.rate_to_usd) save(c, { rate_to_usd: v }); }} data-testid={`admin-rate-${c.code}`} />
              <span className="text-xs text-slate-400">{c.symbol}</span>
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300"><Switch checked={c.active} onCheckedChange={(v) => save(c, { active: v })} /> 啟用</label>
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
      toast.success("已儲存"); setEditing(null); load();
    } catch { toast.error("失敗"); }
  };
  const del = async (id) => { if (!window.confirm("刪除優惠碼？")) return; await callApi({ method: "DELETE", url: `/admin/promos/${id}` }); load(); };
  return (
    <div>
      <SectionHeader title="優惠活動管理" action={<button data-testid="admin-add-promo-btn" onClick={() => setEditing({ ...emptyPromo })} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><Plus className="h-4 w-4" /> 新增優惠碼</button>} />
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4">
            <div className="font-mono font-bold text-primary text-lg">{p.code}</div>
            <div className="text-sm text-slate-300">{p.discount_type === "percent" ? `${p.value}% 折扣` : `折抵 $${p.value}`} {p.min_order_usd > 0 && <span className="text-xs text-slate-500">· 滿 ${p.min_order_usd}</span>}</div>
            {!p.active && <span className="text-xs text-red-400">停用</span>}
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
            <DialogHeader><DialogTitle className="text-white">{editing.id ? "編輯優惠碼" : "新增優惠碼"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400">優惠碼</label><input data-testid="promo-code-input" className={inputCls} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400">類型</label>
                  <select className={inputCls} value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                    <option value="percent">百分比 %</option><option value="fixed_usd">固定金額 USD</option>
                  </select></div>
                <div><label className="text-xs text-slate-400">折扣值</label><input type="number" step="0.01" className={inputCls} value={editing.value} onChange={(e) => setEditing({ ...editing, value: +e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">最低訂單 USD</label><input type="number" step="0.01" className={inputCls} value={editing.min_order_usd} onChange={(e) => setEditing({ ...editing, min_order_usd: +e.target.value })} /></div>
                <div><label className="text-xs text-slate-400">到期日</label><input type="date" className={inputCls} value={editing.expires_at} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> 啟用</label>
            </div>
            <DialogFooter>
              <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm">取消</button>
              <button data-testid="promo-save-btn" onClick={() => save(editing)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold">儲存</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function UsersSec({ callApi }) {
  const [data, setData] = useState({ roles: [], users: [] });
  const load = useCallback(() => callApi({ method: "GET", url: "/users" }).then((r) => setData(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);
  const setRole = async (u, role) => {
    try { await callApi({ method: "PATCH", url: `/users/${u.user_id}/role`, data: { role } }); toast.success("角色已更新"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "失敗"); }
  };
  return (
    <div>
      <SectionHeader title="用戶管理" />
      <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
        {data.users.map((u) => (
          <div key={u.user_id} className="p-4 flex items-center gap-4" data-testid={`admin-user-${u.user_id}`}>
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-primary">{(u.name || u.email || "?")[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{u.name || "未命名"}</div>
              <div className="text-xs text-slate-500 truncate">{u.email}</div>
            </div>
            <div className="text-xs text-slate-400">{u.order_count} 筆訂單</div>
            <select value={u.role} onChange={(e) => setRole(u, e.target.value)} className="text-xs h-8 rounded-lg bg-slate-800 border border-slate-700 px-2 text-slate-200">
              {data.roles.map((r) => <option key={r} value={r}>{r === "admin" ? "管理員" : "會員"}</option>)}
            </select>
          </div>
        ))}
      </div>
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
    if (!isSignedIn) { navigate("/sign-in"); return; }
    callApi({ method: "GET", url: "/me" }).then((r) => setRole(r.data.role)).catch(() => setRole("member"));
  }, [isLoaded, isSignedIn, callApi, navigate]);

  if (!isLoaded || (isSignedIn && role === null)) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (role && role !== "admin") return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
      <ShieldAlert className="h-12 w-12 text-red-400" />
      <p>您沒有管理權限</p>
      <Link to="/" className="text-primary text-sm">返回商城</Link>
    </div>
  );
  return <Show when="signed-in"><AdminInner /></Show>;
}


function SiteSettings({ callApi }) {
  const [form, setForm] = useState({ whatsapp_number: "", whatsapp_link: "", cs_label: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/settings" }).then((r) => setForm(r.data)).catch(() => {}); }, [callApi]);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (body.whatsapp_number && !body.whatsapp_link?.includes("wa.me/" + body.whatsapp_number.replace(/\D/g, ""))) body.whatsapp_link = "https://wa.me/" + body.whatsapp_number.replace(/\D/g, "");
      const r = await callApi({ method: "PUT", url: "/admin/settings", data: body });
      setForm(r.data); toast.success("已儲存，頁尾二維碼已更新");
    } catch { toast.error("儲存失敗"); }
    setSaving(false);
  };
  const inp = "w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-4 text-sm text-white outline-none focus:border-orange-400";
  return (
    <div>
      <SectionHeader title="網站設定 · 客服 WhatsApp" />
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">WhatsApp 號碼（含國碼，選填）<input data-testid="settings-whatsapp-number" value={form.whatsapp_number || ""} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+85261234567" className={`${inp} mt-1`} /></label>
          <label className="block text-sm text-slate-300">WhatsApp 連結（二維碼內容）<input data-testid="settings-whatsapp-link" value={form.whatsapp_link || ""} onChange={(e) => setForm({ ...form, whatsapp_link: e.target.value })} placeholder="https://wa.me/85261234567 或群組邀請連結" className={`${inp} mt-1`} /></label>
          <label className="block text-sm text-slate-300">二維碼下方文字<input data-testid="settings-cs-label" value={form.cs_label || ""} onChange={(e) => setForm({ ...form, cs_label: e.target.value })} className={`${inp} mt-1`} /></label>
          <button data-testid="settings-save" onClick={save} disabled={saving} className="h-11 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60">儲存</button>
        </div>
        <div className="flex flex-col items-center justify-center bg-slate-800 rounded-2xl p-6">
          <div className="bg-white rounded-xl p-2"><QRCodeSVG value={form.whatsapp_link || "https://wa.me/"} size={160} fgColor="#E8792A" /></div>
          <div className="text-xs text-slate-400 mt-3">{form.cs_label}</div>
          <div className="text-[11px] text-slate-500 mt-1 break-all text-center">{form.whatsapp_link}</div>
        </div>
      </div>
    </div>
  );
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
    if (!file) return toast.error("請選擇 Logo 圖片");
    setBusy(true);
    try { await callApi({ method: "POST", url: "/admin/payment-logos", data: { name, ...(await readFile(file)) } }); toast.success("已新增"); setName(""); setFile(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "新增失敗"); }
    setBusy(false);
  };
  const update = async (id, data) => { try { await callApi({ method: "PUT", url: `/admin/payment-logos/${id}`, data }); load(); } catch { toast.error("更新失敗"); } };
  const remove = async (id) => { if (!window.confirm("確定刪除此 Logo？")) return; await callApi({ method: "DELETE", url: `/admin/payment-logos/${id}` }); toast.success("已刪除"); load(); };
  const move = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    await update(list[i].id, { sort_order: list[j].sort_order }); await update(list[j].id, { sort_order: list[i].sort_order });
  };
  const replaceImg = async (id, f) => { if (!f) return; await update(id, await readFile(f)); toast.success("圖片已更新"); };
  const inp = "h-11 rounded-xl bg-slate-800 border border-slate-700 px-4 text-sm text-white outline-none focus:border-orange-400";

  return (
    <div>
      <SectionHeader title="支付方式 Logo（頁尾顯示）" />
      <div className="bg-slate-800/60 rounded-2xl p-5 mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">名稱<br /><input data-testid="paylogo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 VISA" className={`${inp} mt-1 w-48`} /></label>
        <label className="text-sm text-slate-300">圖片（PNG/SVG/JPG，≤2M，建議透明底）<br />
          <input data-testid="paylogo-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-white" />
        </label>
        <button data-testid="paylogo-add" onClick={add} disabled={busy} className="h-11 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60 flex items-center gap-2"><Plus className="h-4 w-4" />新增</button>
        <span className="text-xs text-slate-500">未新增任何 Logo 時，頁尾顯示系統內建的預設樣式。</span>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="text-slate-500 text-sm">尚無上傳的 Logo</div>}
        {list.map((l, i) => (
          <div key={l.id} data-testid={`paylogo-row-${l.id}`} className={`flex items-center gap-4 bg-slate-800/60 rounded-xl px-4 py-3 ${l.active ? "" : "opacity-50"}`}>
            <span className="bg-white rounded-md h-10 px-3 flex items-center justify-center"><img src={l.image} alt={l.name} className="h-6 max-w-[110px] object-contain" /></span>
            <input defaultValue={l.name} onBlur={(e) => e.target.value !== l.name && update(l.id, { name: e.target.value })} className={`${inp} w-44`} data-testid={`paylogo-name-${l.id}`} />
            <label className="h-9 px-3 rounded-full bg-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-600"><ImagePlus className="h-3.5 w-3.5" />更換圖片<input type="file" accept="image/*" className="hidden" onChange={(e) => replaceImg(l.id, e.target.files?.[0])} /></label>
            <button onClick={() => update(l.id, { active: !l.active })} data-testid={`paylogo-toggle-${l.id}`} className={`h-9 px-3 rounded-full text-xs ${l.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{l.active ? "顯示中" : "已隱藏"}</button>
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
