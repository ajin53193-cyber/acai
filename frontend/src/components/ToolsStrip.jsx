import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ChevronRight } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

const ToolIcon = ({ tool }) =>
  tool.icon ? (
    <img
      src={toFullUrl(tool.icon)}
      alt={tool.name}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm"
    />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#FFE896] text-lg font-black text-[#1B1403]">
      {tool.name?.slice(0, 1)}
    </div>
  );

export const ToolsStrip = ({ slugs }) => {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    axios.get(`${API}/tools`).then((res) => setTools(res.data.tools || [])).catch(() => setTools([]));
  }, []);

  // When a promo specifies slugs, show only those tools in the given order; otherwise show all.
  const visible =
    slugs && slugs.length > 0
      ? slugs.map((s) => tools.find((t) => t.slug === s)).filter(Boolean)
      : tools;

  if (visible.length === 0) return null;

  return (
    <section className="mt-12 border-t border-slate-100 pt-8" data-testid="promo-tools-strip">
      <h2 className="text-lg font-black text-slate-900 md:text-xl">热门工具</h2>
      <p className="mt-1 text-sm text-slate-500">点击 App 图标查看使用与下载教程</p>
      <div className="mt-5 space-y-3">
        {visible.map((t, i) => (
          <Link
            key={t.slug}
            to={`/tools/${t.slug}`}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-[#D4AF37] hover:shadow-md active:scale-[0.99]"
            data-testid={`promo-tool-card-${i}`}
          >
            <ToolIcon tool={t} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-900">{t.name}</div>
              {t.tagline && <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{t.tagline}</div>}
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </section>
  );
};
