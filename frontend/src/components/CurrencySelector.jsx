import { useCurrency } from "@/context/CurrencyContext";
import { ChevronDown, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CurrencySelector({ dark = false, variant = "pill" }) {
  const { currencies, code, setCode, active } = useCurrency();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "circle" ? (
          <button
            data-testid="currency-selector-trigger"
            className="relative h-10 w-10 rounded-full bg-orange-100/70 text-orange-500 flex items-center justify-center hover:bg-orange-100 transition-colors"
          >
            <span className="text-[11px] font-bold leading-none">{active.symbol}</span>
            <ArrowRightLeft className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5" />
          </button>
        ) : (
          <button
            data-testid="currency-selector-trigger"
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              dark ? "text-white/90 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>{active.flag}</span>
            <span>{code}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {currencies.map((c) => (
          <DropdownMenuItem
            key={c.code}
            data-testid={`currency-option-${c.code}`}
            onClick={() => setCode(c.code)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span className="font-medium">{c.code}</span>
              <span className="text-xs text-slate-400">{c.name}</span>
            </span>
            {c.code === code && <span className="text-orange-500">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
