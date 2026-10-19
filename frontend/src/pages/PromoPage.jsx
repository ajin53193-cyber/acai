import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Eye } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { Block } from "@/components/PromoBlocks";
import { ToolsStrip } from "@/components/ToolsStrip";

export default function PromoPage() {
  const { slug } = useParams();
  const [promo, setPromo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/promos/${slug}`)
      .then((res) => {
        setPromo(res.data);
        document.title = `${res.data.title} | 合赢项目社`;
        axios.post(`${API}/promos/${slug}/view`).catch(() => {});
      })
      .catch((err) => setError(err.response?.data?.detail || "页面加载失败"));
  }, [slug]);

  return (
    <main className="min-h-screen bg-white text-slate-900" data-testid="promo-page">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <header className="flex items-center justify-between border-b border-slate-100 pb-4">
          <Link to="/" data-testid="promo-logo-link"><img src="/images/logo-hy.png" alt="合赢项目社" className="h-12 w-auto" /></Link>
          {promo && (
            <span className="flex items-center gap-1 text-xs text-slate-400"><Eye size={13} /> {promo.views || 0}</span>
          )}
        </header>

        {error && <div className="py-24 text-center text-sm text-slate-500" data-testid="promo-error">{error}</div>}

        {promo && (
          <article>
            <h1 className="mt-7 text-2xl font-black leading-snug text-slate-900 md:text-3xl" data-testid="promo-title">{promo.title}</h1>
            {promo.subtitle && <p className="mt-3 text-sm leading-relaxed text-slate-500" data-testid="promo-subtitle">{promo.subtitle}</p>}
            {promo.cover && (
              <img src={toFullUrl(promo.cover)} alt={promo.title} decoding="async" className="mt-6 w-full rounded-2xl border border-slate-200 shadow-md" data-testid="promo-cover" />
            )}
            {(promo.blocks || []).map((b, i) => <Block key={i} block={b} index={i} />)}

            <ToolsStrip slugs={promo.tool_slugs} />

            <footer className="mt-12 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
              合赢项目社 HEYING PROJECT CLUB · 平台不收取任何费用 · 不承诺收益
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}
