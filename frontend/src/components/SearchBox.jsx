import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { publicApi } from "@/lib/api";

export function SearchBox({ compact = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setItems([]); return; }
    const t = setTimeout(() => {
      publicApi.get("/products/suggest", { params: { q } }).then((r) => { setItems(r.data); setOpen(true); setActive(-1); }).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (p) => { setOpen(false); setQuery(""); navigate(`/product/${p.id}`); };
  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(items[active]);
    if (query.trim()) { setOpen(false); navigate(`/category/all?q=${encodeURIComponent(query.trim())}`); }
  };
  const onKey = (e) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    if (e.key === "Escape") setOpen(false);
  };

  const hl = (text) => {
    const q = query.trim();
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return text;
    return <>{text.slice(0, i)}<span className="text-orange-500">{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>;
  };

  return (
    <div ref={boxRef} className="relative flex-1">
      <form onSubmit={submit} className="relative">
        <input
          data-testid={compact ? "mobile-search-input" : "search-input"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder={compact ? "請輸入商品名稱搜尋" : "請輸入需搜尋的商品名"}
          autoComplete="off"
          className={compact
            ? "w-full h-14 rounded-2xl bg-white shadow-sm pl-4 pr-14 text-base outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-orange-200"
            : "w-full h-11 rounded-full border-2 border-orange-200 bg-orange-50/40 pl-5 pr-14 text-sm outline-none focus:border-orange-400 focus:bg-white transition-colors"}
        />
        <button data-testid={compact ? "mobile-search-submit" : "search-submit"} className={compact
          ? "absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-orange-500"
          : "absolute right-1 top-1 h-9 w-11 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white"}>
          <Search className={compact ? "h-6 w-6" : "h-4 w-4"} strokeWidth={2.2} />
        </button>
      </form>
      {open && items.length > 0 && (
        <div data-testid="search-suggestions" className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-orange-100 overflow-hidden">
          {items.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-testid={`search-suggestion-${p.id}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(p)}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === active ? "bg-orange-50" : "hover:bg-orange-50/60"}`}
            >
              <img src={p.image} alt="" className="h-9 w-9 rounded-xl object-cover bg-slate-100 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{hl(p.name)}</div>
                {p.subtitle && <div className="text-xs text-slate-400 truncate">{p.subtitle}</div>}
              </div>
            </button>
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit} data-testid="search-see-all" className="w-full px-4 py-2.5 text-xs font-semibold text-orange-500 bg-orange-50/40 hover:bg-orange-50 text-left">
            查看「{query.trim()}」的全部結果 →
          </button>
        </div>
      )}
    </div>
  );
}
