import { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CurrencySelector({ dark = false }) {
  const { currencies, code, setCode, active } = useCurrency();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
            {c.code === code && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
