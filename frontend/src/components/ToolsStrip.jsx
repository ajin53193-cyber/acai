import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";

const ToolIcon = ({ tool }) =>
  tool.icon ? (
    <img
      src={toFullUrl(tool.icon)}
      alt={tool.name}
      loading="lazy"
      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-sm transition-transform group-active:scale-95"
    />
  ) : (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#FFE896] text-2xl font-black text-[#1B1403] shadow-sm transition-transform group-active:scale-95">
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
      <div className="mt-6 grid grid-cols-5 gap-x-2 gap-y-6">
        {visible.map((t, i) => (
          <Link
            key={t.slug}
            to={`/tools/${t.slug}`}
            className="group flex flex-col items-center gap-2"
            data-testid={`promo-tool-card-${i}`}
          >
            <ToolIcon tool={t} />
            <span className="w-full truncate text-center text-xs text-slate-600">{t.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
