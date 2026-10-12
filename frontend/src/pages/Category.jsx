import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { publicApi } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Category() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [products, setProducts] = useState([]);
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
    publicApi.get("/products", { params }).then((r) => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id, q]);

  const catName = q ? `搜尋「${q}」` : categories.find((c) => c.id === id)?.name || "全部商品";

  return (
    <div className="bg-slate-50 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex gap-5">
        {/* Sidebar */}
        <aside className="hidden md:block w-44 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-28">
            <div className="px-4 py-3 text-sm font-bold text-slate-900 border-b border-slate-100">全部分類</div>
            <nav className="py-1">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/category/${c.id}`}
                  data-testid={`sidebar-category-${c.id}`}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    c.id === id ? "bg-primary/5 text-primary font-semibold border-l-2 border-primary" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.image && <img src={c.image} alt="" className="h-5 w-5 rounded object-cover" />}
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-head text-xl font-bold text-slate-900" data-testid="category-title">{catName}</h1>
            <span className="text-sm text-slate-400">共 {products.length} 件</span>
          </div>

          {/* mobile category pills */}
          <div className="md:hidden flex overflow-x-auto no-scrollbar gap-2 mb-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/category/${c.id}`)}
                className={`whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5 ${c.id === id ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-white rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-slate-400">沒有找到相關商品</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
