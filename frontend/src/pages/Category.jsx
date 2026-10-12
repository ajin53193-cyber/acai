import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { publicApi } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Category() {
  const { id } = useParams();
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
    publicApi
      .get("/products", { params })
      .then((r) => setProducts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, q]);

  const catName = q ? `搜尋「${q}」` : categories.find((c) => c.id === id)?.name || "全部商品";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[60vh]">
      <h1 className="font-head text-2xl font-bold text-slate-900 mb-1" data-testid="category-title">
        {catName}
      </h1>
      <p className="text-sm text-slate-400 mb-5">共 {products.length} 件商品</p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-slate-400">沒有找到相關商品</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
