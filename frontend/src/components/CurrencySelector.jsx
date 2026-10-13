import { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { ChevronDown, ArrowRightLeft, Languages, CircleDollarSign } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const LANGS = [["zh-TW", "繁體中文"], ["zh-CN", "简体中文"], ["en", "English"]];

function Field({ icon: Icon, value, onChange, options, testId }) {
  return (
    <div className="relative flex items-center h-14 rounded-2xl bg-slate-100 px-4">
      <span className="h-6 w-6 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5" /></span>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 appearance-none bg-transparent pl-3 pr-8 text-base text-slate-800 outline-none cursor-pointer"
      >
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-slate-700" />
    </div>
  );
}

export default function CurrencySelector({ dark = false, variant = "pill" }) {
  const { currencies, code, setCode, active } = useCurrency();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("gt_lang") || "zh-TW");
  const [draft, setDraft] = useState(code);

  const save = () => {
    setCode(draft);
    localStorage.setItem("gt_lang", lang);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setDraft(code); }}>
      <PopoverTrigger asChild>
        {variant === "circle" ? (
          <button
            data-testid="currency-selector-trigger"
            className="relative h-12 w-12 md:h-10 md:w-10 rounded-full bg-orange-100/60 md:bg-orange-100/70 text-orange-500 flex items-center justify-center hover:bg-orange-100 transition-colors"
          >
            <span className="h-7 w-7 md:h-6 md:w-6 rounded-full border-[1.5px] border-orange-500 flex items-center justify-center text-[11px] md:text-[10px] font-bold leading-none">{active.symbol}</span>
            <ArrowRightLeft className="absolute bottom-2 right-1.5 h-3 w-3 md:h-2.5 md:w-2.5 bg-orange-50 rounded-full" />
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
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={14} className="w-[340px] rounded-3xl border-0 p-6 shadow-xl" data-testid="currency-panel">
        <div className="text-lg font-semibold text-slate-800 mb-4">選擇您的語言和貨幣</div>
        <div className="space-y-3">
          <Field icon={Languages} value={lang} onChange={setLang} options={LANGS} testId="lang-select" />
          <Field
            icon={CircleDollarSign}
            value={draft}
            onChange={setDraft}
            options={currencies.map((c) => [c.code, `${c.code}${c.symbol} - ${c.name}`])}
            testId="currency-select"
          />
        </div>
        <button
          data-testid="currency-save"
          onClick={save}
          className="mt-5 w-full h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base font-bold transition-colors"
        >
          儲存設定
        </button>
      </PopoverContent>
    </Popover>
  );
}
