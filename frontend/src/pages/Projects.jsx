import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Crown, Flame } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/Reveal";
import { API } from "@/lib/api";
import { useSettings } from "@/lib/useSettings";
import { ProjectGateModal } from "@/components/ProjectGateModal";

const ALL_TAB = "全部";

export default function Projects() {
  const { categories, copy } = useSettings();
  const pc = copy.projects;
  const tabs = [ALL_TAB, ...categories];
  const [projects, setProjects] = useState([]);
  const [category, setCategory] = useState(ALL_TAB);
  const [keyword, setKeyword] = useState("");
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/projects`)
      .then((res) => setProjects(res.data.projects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (category === ALL_TAB || p.category === category) &&
          (!keyword || p.title.includes(keyword) || p.description.includes(keyword))
      ),
    [projects, category, keyword]
  );

  return (
    <main className="pt-28" data-testid="projects-page">
      <section className="grid-texture relative overflow-hidden pb-14 pt-10 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[#1E3A8A]/25 blur-[120px]" />
        <Reveal>
          <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
            {pc.title}
          </h1>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">{pc.subtitle}</p>
        </Reveal>

        <Reveal delay={0.15} className="mx-auto mt-10 max-w-4xl px-4">
          <div className="glass-card flex flex-col items-stretch gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                data-testid="projects-search-input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索项目名称或关键词"
                className="w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 py-2.5 pl-10 pr-4 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60"
              />
            </div>
            <div className="flex flex-wrap gap-2" data-testid="projects-category-tabs">
              {tabs.map((c) => (
                <button
                  key={c}
                  data-testid={`category-tab-${c}`}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 ${
                    category === c
                      ? "bg-gold-gradient text-[#060B18] shadow-[0_0_16px_rgba(212,175,55,0.4)]"
                      : "border border-amber-500/20 text-slate-300 hover:border-[#D4AF37]/60 hover:text-[#FFE896]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500" data-testid="projects-loading">项目加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500" data-testid="projects-empty">暂无匹配的项目，换个关键词试试</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-3" data-testid="projects-grid">
              {filtered.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 0.08}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive(p)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(p); } }}
                    data-testid={`project-card-${p.id}`}
                    className="glass-card group block w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-transform duration-200 active:scale-[0.98]"
                  >
                    <div className="relative h-28 overflow-hidden sm:h-40 md:h-48">
                      <img
                        src={p.image}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1228] via-transparent to-transparent" />
                      {p.featured && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FFE896] to-[#D4AF37] px-2 py-0.5 text-[10px] font-black text-[#060B18] shadow-[0_0_14px_rgba(255,232,150,0.5)] md:left-4 md:top-4 md:px-3 md:py-1 md:text-xs">
                          <Crown size={11} /> 主打
                        </span>
                      )}
                      <span className={`absolute top-2 rounded-full border border-amber-500/40 bg-[#060B18]/75 px-2 py-0.5 text-[10px] text-[#E5C158] backdrop-blur-sm md:top-4 md:px-3 md:py-1 md:text-xs ${p.featured ? "left-16 md:left-24" : "left-2 md:left-4"}`}>
                        {p.status}
                      </span>
                      <span className="absolute right-2 top-2 hidden rounded-full border border-amber-500/30 bg-[#060B18]/70 px-2 py-0.5 text-[10px] text-[#E5C158] backdrop-blur-sm sm:block md:right-4 md:top-4 md:px-3 md:py-1 md:text-xs">
                        {p.category}
                      </span>
                      {p.hot && (
                        <span data-testid={`project-hot-badge-${i}`} className="hot-badge absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF6B3D] to-[#FF3D5A] px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_14px_rgba(255,90,70,0.55)] md:bottom-3 md:right-4 md:px-3 md:py-1 md:text-xs">
                          <Flame size={11} /> 热门
                        </span>
                      )}
                    </div>
                    <div className="p-3 md:p-6">
                      <h3 className="font-display text-sm font-bold leading-snug text-slate-50 transition-colors group-hover:text-[#FFE896] md:text-lg">
                        {p.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-400 md:mt-2 md:text-sm">{p.description}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-amber-500/10 pt-2.5 text-[10px] md:mt-4 md:pt-4 md:text-sm">
                        <span className="flex items-center gap-1 text-slate-400">
                          <MapPin size={12} className="text-[#D4AF37]" /> {p.region}
                        </span>
                        <span className="text-slate-300">{p.status}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <ProjectGateModal project={active} onClose={() => setActive(null)} />
    </main>
  );
}
