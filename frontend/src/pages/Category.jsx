import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Gamepad2, Smile, MessageCircle, Gift } from "lucide-react";
import { publicApi } from "@/lib/api";

const PER_PAGE = 21;

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, "…", total];
  if (current >= total - 3) return [1, "…", total - 5, total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export function Pager({ page, total, onChange, testId = "category-pagination" }) {
  if (total <= 1) return null;
  const btn = "h-10 min-w-10 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center";
  return (
    <div className="mt-10 flex items-center justify-center gap-2 flex-wrap" data-testid={testId}>
      <button data-testid="pager-prev" disabled={page === 1} onClick={() => onChange(page - 1)} className={`${btn} bg-white text-slate-500 shadow-sm disabled:opacity-40 hover:text-orange-600`}><ChevronLeft className="h-4 w-4" /></button>
      {pageList(page, total).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className={`${btn} bg-white text-slate-400 shadow-sm`}>•••</span>
        ) : (
          <button key={n} data-testid={`category-page-${n}`} onClick={() => onChange(n)} className={`${btn} ${n === page ? "bg-orange-500 text-white shadow" : "bg-white text-slate-700 shadow-sm hover:text-orange-600"}`}>{n}</button>
        )
      )}
      <button data-testid="pager-next" disabled={page === total} onClick={() => onChange(page + 1)} className={`${btn} bg-white text-slate-500 shadow-sm disabled:opacity-40 hover:text-orange-600`}><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export default function Category() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (id && id !== "all") params.category = id;
    if (q) params.q = q;
    publicApi.get("/products", { params }).then((r) => { setProducts(r.data); setPage(1); }).catch(() => {}).finally(() => setLoading(false));
  }, [id, q]);

  const catName = q ? `搜尋「${q}」` : categories.find((c) => c.id === id)?.name || "全部商品";
  const totalPages = Math.ceil(products.length / PER_PAGE);
  const goPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="relative bg-gradient-to-b from-[#FFE3C4] via-[#FFF3E6] to-[#FFF8F1] min-h-[70vh] overflow-hidden">
      <Gamepad2 className="pointer-events-none absolute left-[22%] top-6 h-20 w-20 text-orange-300/40 rotate-12" strokeWidth={1.2} />
      <Smile className="pointer-events-none absolute left-[55%] top-3 h-16 w-16 text-orange-300/40 -rotate-12" strokeWidth={1.2} />
      <MessageCircle className="pointer-events-none absolute right-[4%] top-14 h-16 w-16 text-orange-300/40" strokeWidth={1.2} />
      <Gift className="pointer-events-none absolute right-[28%] top-2 h-14 w-14 text-orange-300/40 rotate-6" strokeWidth={1.2} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-10">
          <Link to="/" className="hover:text-orange-500">首頁</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium" data-testid="category-title">{catName}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm px-2 sm:px-4 mb-8">
          <div className="flex overflow-x-auto no-scrollbar justify-start md:justify-between">
            {categories.map((c) => {
              const active = c.id === id;
              return (
                <button
                  key={c.id}
                  data-testid={`tab-category-${c.id}`}
                  onClick={() => navigate(`/category/${c.id}`)}
                  className={`relative whitespace-nowrap px-4 lg:px-5 py-5 text-base font-medium transition-colors ${active ? "text-orange-500" : "text-slate-700 hover:text-orange-500"}`}
                >
                  {c.name}
                  {active && <span className="absolute left-1/2 -translate-x-1/2 top-0 h-1 w-7 rounded-b-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-4 sm:gap-5">
            {Array.from({ length: 14 }).map((_, i) => <div key={i} className="aspect-[4/5] bg-white rounded-3xl animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-slate-400">沒有找到相關商品</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-4 sm:gap-5" data-testid="category-grid">
            {products.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                data-testid={`product-card-${p.id}`}
                className="group bg-white rounded-3xl shadow-[0_8px_24px_-14px_rgba(232,121,42,0.35)] px-3 pt-5 pb-5 flex flex-col items-center text-center hover:shadow-[0_14px_30px_-12px_rgba(232,121,42,0.45)] hover:-translate-y-0.5 transition-all"
              >
                <div className="w-[70%] aspect-square rounded-[22%] overflow-hidden bg-white shadow-sm">
                  <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="text-[15px] text-slate-800 mt-5 truncate w-full px-1 group-hover:text-orange-600">{p.name}</div>
              </Link>
            ))}
          </div>
        )}

        <Pager page={page} total={totalPages} onChange={goPage} />
      </div>
    </div>
  );
}
