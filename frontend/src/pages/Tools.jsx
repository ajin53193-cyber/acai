import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronRight, Download, ArrowLeft, Eye } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { Block } from "@/components/PromoBlocks";
import { SharePoster } from "@/components/SharePoster";

const Shell = ({ children, back }) => (
  <main className="min-h-screen bg-white text-slate-900" data-testid="tools-page">
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
      <header className="flex items-center justify-between border-b border-slate-100 pb-4">
        <Link to="/" data-testid="tools-logo-link"><img src="/images/logo-hy.png" alt="合赢项目社" className="h-12 w-auto" /></Link>
        {back && (
          <Link to="/tools" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900" data-testid="tools-back-link">
            <ArrowLeft size={14} /> 全部工具
          </Link>
        )}
      </header>
      {children}
      <footer className="mt-12 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        合赢项目社 HEYING PROJECT CLUB · 平台不收取任何费用 · 不承诺收益
      </footer>
    </div>
  </main>
);

const ToolIcon = ({ tool, size = "h-14 w-14" }) =>
  tool.icon ? (
    <img src={toFullUrl(tool.icon)} alt={tool.name} className={`${size} shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#FFE896] text-xl font-black text-[#1B1403]`}>{tool.name?.slice(0, 1)}</div>
  );

export function ToolsList() {
  const [tools, setTools] = useState(null);
  useEffect(() => {
    document.title = "热门工具 | 合赢项目社";
    axios.get(`${API}/tools`).then((res) => setTools(res.data.tools)).catch(() => setTools([]));
  }, []);
  return (
    <Shell>
      <h1 className="mt-7 text-2xl font-black text-slate-900 md:text-3xl" data-testid="tools-title">热门工具</h1>
      <p className="mt-2 text-sm text-slate-500">点击工具查看使用教程与下载方式</p>
      <div className="mt-6 space-y-3" data-testid="tools-list">
        {tools === null && <div className="py-10 text-center text-sm text-slate-400">加载中…</div>}
        {tools?.length === 0 && <div className="py-10 text-center text-sm text-slate-400">暂无工具</div>}
        {tools?.map((t, i) => (
          <Link key={t.slug} to={`/tools/${t.slug}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#D4AF37] hover:shadow-md active:scale-[0.99]" data-testid={`tool-card-${i}`}>
            <ToolIcon tool={t} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-slate-900">{t.name}</div>
              {t.tagline && <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{t.tagline}</div>}
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export default function ToolDetail() {
  const { slug } = useParams();
  const [tool, setTool] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/tools/${slug}`)
      .then((res) => {
        setTool(res.data);
        document.title = `${res.data.name} 使用教程 | 合赢项目社`;
        axios.post(`${API}/tools/${slug}/events`, { type: "view" }).catch(() => {});
      })
      .catch((err) => setError(err.response?.data?.detail || "页面加载失败"));
  }, [slug]);

  const onDownload = () => axios.post(`${API}/tools/${slug}/events`, { type: "download" }).catch(() => {});

  return (
    <Shell back>
      {error && <div className="py-24 text-center text-sm text-slate-500" data-testid="tool-error">{error}</div>}
      {tool && (
        <article>
          <div className="mt-7 flex items-center gap-4">
            <ToolIcon tool={tool} size="h-20 w-20" />
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900" data-testid="tool-name">{tool.name}</h1>
              {tool.tagline && <p className="mt-1 text-sm text-slate-500" data-testid="tool-tagline">{tool.tagline}</p>}
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Eye size={12} /> {tool.views || 0} 次查看</div>
            </div>
          </div>
          {tool.download_link && (
            <a
              href={tool.download_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDownload}
              data-testid="tool-download-btn"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FFE896] to-[#D4AF37] py-3.5 text-sm font-bold text-[#1B1403] shadow-[0_6px_20px_rgba(212,175,55,0.35)] transition-transform active:scale-[0.98]"
            >
              <Download size={16} /> {tool.download_text || "立即下载"}
            </a>
          )}
          {(tool.blocks || []).length > 0 && (
            <>
              <h2 className="mt-10 text-lg font-black text-slate-900">使用教程</h2>
              {tool.blocks.map((b, i) => <Block key={i} block={b} index={i} />)}
            </>
          )}
          <div className="mt-10">
            <SharePoster
              url={window.location.href}
              title={tool.name}
              subtitle={tool.tagline}
              badge="工具教程"
              shareText={`【合赢项目社】${tool.name}${tool.tagline ? "\n" + tool.tagline : ""}\n👉 ${window.location.href}\n—— 长按识别海报二维码，或点击链接查看`}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#D4AF37] py-3 text-sm font-bold text-[#B8860B] transition-transform active:scale-[0.98]"
              label="生成分享海报"
            />
          </div>
        </article>
      )}
    </Shell>
  );
}
