import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Eye, EyeOff, Save, LayoutGrid, Images, Upload, Trash2, Plus } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Card } from "./ui";

export function HomeLayoutAdmin({ callApi }) {
  const [layout, setLayout] = useState(null);
  const [slides, setSlides] = useState([]);
  const [drag, setDrag] = useState(null);
  const fileRef = useRef(null);
  const addIdx = useRef(null);

  useEffect(() => {
    callApi({ method: "GET", url: "/site-config" }).then((r) => { setLayout(r.data.home_layout || []); setSlides(r.data.hero_slides || []); }).catch(() => toast.error(tr("載入失敗")));
  }, [callApi]);
  if (!layout) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;

  const move = (from, to) => {
    if (to < 0 || to >= layout.length || from === to) return;
    const a = [...layout]; const [m] = a.splice(from, 1); a.splice(to, 0, m); setLayout(a);
  };
  const onDrop = (to) => { if (drag !== null) move(drag, to); setDrag(null); };
  const toggle = (i) => setLayout(layout.map((b, idx) => idx === i ? { ...b, visible: !b.visible } : b));

  const moveSlide = (i, d) => { const j = i + d; if (j < 0 || j >= slides.length) return; const a = [...slides]; [a[i], a[j]] = [a[j], a[i]]; setSlides(a); };
  const setSlide = (i, k, v) => setSlides(slides.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast.error(tr("圖片不可超過 4MB"));
    const rd = new FileReader();
    rd.onload = () => {
      const data = rd.result;
      if (addIdx.current === "new") setSlides((s) => [...s, { image: data, link: "", alt: "" }]);
      else setSlides((s) => s.map((x, idx) => idx === addIdx.current ? { ...x, image: data } : x));
      addIdx.current = null;
    };
    rd.readAsDataURL(f); e.target.value = "";
  };

  const save = async () => {
    try { await callApi({ method: "PUT", url: "/admin/site-config", data: { home_layout: layout, hero_slides: slides } }); toast.success(tr("首頁佈局已儲存")); const r = await callApi({ method: "GET", url: "/site-config" }); setSlides(r.data.hero_slides || []); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };

  return (
    <div data-testid="homelayout-admin">
      <Head title={tr("首頁裝修")} sub={tr("上傳並排序首頁輪播圖，拖曳調整各板塊順序或隱藏；儲存後立即生效")} right={<Btn data-testid="homelayout-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存佈局")}</Btn>} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Hero slides */}
      <Card className="p-3 max-w-xl mb-5" >
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3"><Images className="h-4 w-4 text-orange-500" />{tr("首頁輪播圖")}</div>
        <div className="space-y-2" data-testid="hero-slides-list">
          {slides.map((s, i) => (
            <div key={i} data-testid={`hero-slide-${i}`} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
              <div className="h-12 w-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover" /> : <Images className="h-5 w-5 text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <Input data-testid={`hero-slide-link-${i}`} className="w-full h-7 text-xs" value={s.link || ""} onChange={(e) => setSlide(i, "link", e.target.value)} placeholder={tr("點擊連結 如 /category/games 或 https://")} />
                <Input className="w-full h-7 text-xs" value={s.alt || ""} onChange={(e) => setSlide(i, "alt", e.target.value)} placeholder={tr("替代文字（選填）")} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { addIdx.current = i; fileRef.current.click(); }} className="h-7 w-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center" title={tr("更換圖片")}><Upload className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30">↑</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30">↓</button>
                <button data-testid={`hero-slide-del-${i}`} onClick={() => setSlides(slides.filter((_, idx) => idx !== i))} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          {slides.length === 0 && <div className="text-xs text-slate-400 py-3 text-center">{tr("尚無輪播圖，上傳後將取代首頁預設 Banner")}</div>}
        </div>
        <Btn kind="ghost" className="mt-3" data-testid="hero-slide-add" onClick={() => { addIdx.current = "new"; fileRef.current.click(); }}><Plus className="h-4 w-4" />{tr("上傳輪播圖")}</Btn>
      </Card>

      {/* Block order */}
      <Card className="p-3 max-w-xl">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 px-1"><LayoutGrid className="h-3.5 w-3.5" />{tr("拖動排序首頁板塊")}</div>
        <div className="space-y-2" data-testid="homelayout-list">
          {layout.map((b, i) => (
            <div key={b.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
              data-testid={`hl-row-${b.key}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-white cursor-move transition-shadow ${drag === i ? "shadow-lg border-orange-300" : "border-slate-200"} ${b.visible ? "" : "opacity-50"}`}>
              <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="h-6 w-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm font-medium text-slate-800">{tr(b.label)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200">↑</button>
                <button onClick={() => move(i, i + 1)} disabled={i === layout.length - 1} className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200">↓</button>
                <button data-testid={`hl-toggle-${b.key}`} onClick={() => toggle(i)} className={`h-7 w-7 rounded-lg flex items-center justify-center ${b.visible ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{b.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
