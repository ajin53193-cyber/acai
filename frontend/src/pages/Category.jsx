import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { Star, Users } from "lucide-react";
import { publicApi } from "@/lib/api";

function salesText(n) {
  if (!n) return "0";
  return n >= 1000 ? `${Math.round(n / 1000)}k+` : `${n}+`;
}

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
    <div className="bg-gradient-to-b from-orange-50/60 to-slate-50 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-4">
          <Link to="/" className="hover:text-orange-500">首頁</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium" data-testid="category-title">{catName}</span>
        </div>

        {/* Category tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 px-2 sm:px-4 mb-5">
          <div className="flex overflow-x-auto no-scrollbar">
            {categories.map((c) => {
              const active = c.id === id;
              return (
                <button
                  key={c.id}
                  data-testid={`tab-category-${c.id}`}
                  onClick={() => navigate(`/category/${c.id}`)}
                  className={`relative whitespace-nowrap px-4 py-4 text-sm font-semibold transition-colors ${
                    active ? "text-orange-600" : "text-slate-600 hover:text-orange-500"
                  }`}
                >
                  {c.name}
                  {active && <span className="absolute left-1/2 -translate-x-1/2 bottom-2 h-1 w-6 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 sm:gap-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-slate-400">沒有找到相關商品</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 sm:gap-4">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                data-testid={`product-card-${p.id}`}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center text-center hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-3 line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-orange-600">{p.name}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
