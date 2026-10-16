import { useState } from "react";
import { createPortal } from "react-dom";
import { Star, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";

const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const LABELS = ["", tr("非常差"), tr("差"), tr("一般"), tr("滿意"), tr("非常滿意")];

export function OrderReviewDialog({ order, callApi, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const it = order.items?.[0];

  const pick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - images.length);
    e.target.value = "";
    for (const f of files) if (f.size > 5 * 1024 * 1024) return toast.error(tr("圖片大小需在 5M 以內"));
    setImages([...images, ...(await Promise.all(files.map(readFile)))]);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await callApi({ method: "POST", url: `/orders/${order.id}/review`, data: { rating, content, images } });
      toast.success(tr("感謝您的評價！"));
      onDone(r.data.review);
    } catch (e) { toast.error(e.response?.data?.detail || tr("提交失敗")); }
    setBusy(false);
  };
  const shown = hover || rating;

  return createPortal(
    <div data-testid="order-review-dialog" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <img src={it?.image} alt="" className="h-12 w-12 rounded-xl object-contain bg-slate-50 p-1" />
          <div className="min-w-0"><div className="font-bold text-slate-900 text-base truncate">{tr("評價商品")}</div><div className="text-xs text-slate-500 truncate">{it?.product_name} {it?.spec_label}</div></div>
        </div>
        <div className="flex flex-col items-center gap-1.5 py-1">
          <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} data-testid={`order-review-star-${n}`} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="transition-transform hover:scale-110 active:scale-95">
                <Star className={`h-8 w-8 ${n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold text-orange-500" data-testid="order-review-rating-label">{LABELS[shown]}</div>
        </div>
        <textarea data-testid="order-review-content" value={content} onChange={(e) => setContent(e.target.value.slice(0, 500))} rows={3} placeholder={tr("分享您的使用體驗（選填）")} className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
        <div className="flex gap-2 flex-wrap">
          {images.map((im, i) => (
            <div key={i} className="relative h-16 w-16 rounded-xl overflow-hidden bg-slate-100">
              <img src={im.image_b64} alt="" className="h-full w-full object-cover" />
              <button data-testid={`order-review-img-remove-${i}`} onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {images.length < 3 && (
            <label data-testid="order-review-img-add" className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-orange-300 hover:text-orange-500">
              <ImagePlus className="h-5 w-5" /><span className="text-[10px] mt-0.5">{images.length}/3</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={pick} />
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <button data-testid="order-review-cancel" onClick={onClose} disabled={busy} className="flex-1 h-11 rounded-full border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">{tr("取消")}</button>
          <button data-testid="order-review-submit" onClick={submit} disabled={busy} className="flex-1 h-11 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-1">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? tr("提交中…") : tr("提交評價")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function OrderReviewBadge({ review, testId }) {
  if (!review) return null;
  return (
    <div data-testid={testId} className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-slate-600">
      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
      <span className="truncate flex-1">{review.content || (review.auto ? tr("系統默認好評") : tr("已評價"))}</span>
      {review.images?.length > 0 && <div className="flex gap-1">{review.images.slice(0, 3).map((u, i) => <img key={i} src={u} alt="" className="h-7 w-7 rounded-md object-cover" />)}</div>}
    </div>
  );
}
