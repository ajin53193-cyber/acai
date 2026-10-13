import { Link } from "react-router-dom";
import { Star, Users } from "lucide-react";

function salesText(n) {
  if (!n) return "0";
  if (n >= 1000) return `${Math.round(n / 1000)}k+`;
  return `${n}+`;
}

export default function ProductCard({ product, simple = false }) {
  return (
    <Link
      to={`/product/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className={`group bg-white overflow-hidden ${simple ? "rounded-2xl border-0 p-2.5 text-center" : "rounded-xl border border-slate-200"} hover:shadow-md hover:border-primary/40 transition-all duration-200`}
    >
      <div className={`relative aspect-square overflow-hidden ${simple ? "rounded-2xl bg-white" : "bg-slate-50"}`}>
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {!simple && product.tags?.includes("熱銷") && (
          <span className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500 text-white shadow-sm">
            熱銷
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className={`font-medium text-[13px] text-slate-800 leading-tight ${simple ? "truncate mt-1" : "line-clamp-2 min-h-[2.4rem]"} group-hover:text-primary transition-colors`}>
          {product.name}
        </h3>
        <div className={`flex items-center justify-between mt-1 ${simple ? "hidden" : ""}`}>
          <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
            <Users className="h-3 w-3" /> {salesText(product.sales_count)}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
            {product.rating}
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
        </div>
      </div>
    </Link>
  );
}
