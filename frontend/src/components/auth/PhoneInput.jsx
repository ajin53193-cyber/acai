import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export const COUNTRIES = [
  { flag: "🇹🇼", name: "中國台灣", code: "+886" },
  { flag: "🇭🇰", name: "香港", code: "+852" },
  { flag: "🇨🇳", name: "中國大陸", code: "+86" },
  { flag: "🇺🇸", name: "美國", code: "+1" },
  { flag: "🇨🇦", name: "加拿大", code: "+1" },
  { flag: "🇬🇧", name: "英國", code: "+44" },
  { flag: "🇲🇾", name: "馬來西亞", code: "+60" },
  { flag: "🇸🇬", name: "新加坡", code: "+65" },
  { flag: "🇯🇵", name: "日本", code: "+81" },
  { flag: "🇰🇷", name: "韓國", code: "+82" },
  { flag: "🇦🇺", name: "澳洲", code: "+61" },
  { flag: "🇫🇷", name: "法國", code: "+33" },
  { flag: "🇩🇪", name: "德國", code: "+49" },
  { flag: "🇺🇦", name: "烏克蘭", code: "+380" },
  { flag: "🇬🇭", name: "加納", code: "+233" },
  { flag: "🇹🇭", name: "泰國", code: "+66" },
  { flag: "🇻🇳", name: "越南", code: "+84" },
  { flag: "🇮🇩", name: "印尼", code: "+62" },
  { flag: "🇵🇭", name: "菲律賓", code: "+63" },
  { flag: "🇮🇳", name: "印度", code: "+91" },
];

export const toE164 = (dialCode, raw) => dialCode + raw.replace(/[^0-9]/g, "").replace(/^0+/, "");
export const isValidPhone = (full) => /^\+[1-9]\d{6,14}$/.test(full);

export function PhoneInput({ dialCode, setDialCode, value, onChange, placeholder = "手機號碼", testId = "auth-identifier" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const country = COUNTRIES.find((c) => c.code === dialCode) || COUNTRIES[0];

  return (
    <div className="relative">
      <div className="flex items-center w-full h-14 rounded-2xl bg-slate-100 px-3 focus-within:ring-2 focus-within:ring-orange-300">
        <button
          type="button"
          data-testid="auth-country-btn"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 pr-3 mr-2 border-r border-slate-300 shrink-0"
        >
          <span className="text-xl leading-none">{country.flag}</span>
          <span className="font-semibold text-slate-700">{dialCode}</span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <input
          data-testid={testId}
          size={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="tel"
          className="flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-slate-400"
        />
      </div>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-3" data-testid="auth-country-list">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 h-11 mb-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              size={1}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋國家/地區或區號"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto no-scrollbar">
            {COUNTRIES.filter((c) => c.name.includes(search) || c.code.includes(search)).map((c) => (
              <button
                key={c.name}
                data-testid={`auth-country-${c.code}`}
                onClick={() => { setDialCode(c.code); setOpen(false); setSearch(""); }}
                className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl leading-none">{c.flag}</span>
                  <span className="text-slate-700">{c.name}</span>
                </span>
                <span className="text-slate-400 font-medium">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
