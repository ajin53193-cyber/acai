import { Link } from "react-router-dom";
import { Star, Flame } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";

export default function ProductCard({ product }) {
  const { format } = useCurrency();
  const minPrice = product.specs?.length
    ? Math.min(...product.specs.map((s) => s.price_usd))
    : 0;

  return (
    <Link
      to={`/product/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {product.tags?.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-secondary text-white shadow-sm flex items-center gap-0.5"
              >
                {t === "熱銷" && <Flame className="h-2.5 w-2.5" />}
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[11px] text-slate-400 font-medium mb-0.5">{product.brand}</div>
        <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 min-h-[2.5rem] leading-tight">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-amber-500 font-semibold">{product.rating}</span>
          <span>· 已售 {product.sales_count}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <span className="text-[11px] text-slate-400">起</span>
            <div className="font-head font-extrabold text-primary text-lg leading-none">
              {format(minPrice)}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-1 group-hover:bg-primary group-hover:text-white transition-colors">
            立即充值
          </span>
        </div>
      </div>
    </Link>
  );
}
