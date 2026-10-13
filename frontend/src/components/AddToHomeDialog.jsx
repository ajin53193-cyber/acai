import { useState } from "react";
import { X, Smartphone } from "lucide-react";

const TABS = [
  ["ios", "iPhone / Safari", "/videos/desktop-ios.mp4", ["點擊 Safari 底部「分享」按鈕", "選擇「加入主畫面」", "點擊「新增」即可在桌面看到 gogo589 圖示"]],
  ["android", "Android / Chrome", "/videos/desktop-android.mp4", ["點擊 Chrome 右上角「⋮」選單", "選擇「加到主畫面」", "點擊「新增」即可在桌面看到 gogo589 圖示"]],
];

export function AddToHomeDialog({ onClose }) {
  const [tab, setTab] = useState(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "android");
  const [, label, src, steps] = TABS.find((t) => t[0] === tab);
  return (
    <div data-testid="a2hs-dialog" className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-sm md:max-w-md rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Smartphone className="h-5 w-5 text-orange-500" />新增到桌面</h3>
          <button data-testid="a2hs-close" onClick={onClose} className="h-8 w-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2 mb-3">
          {TABS.map(([k, l]) => (
            <button key={k} data-testid={`a2hs-tab-${k}`} onClick={() => setTab(k)} className={`flex-1 h-9 rounded-full text-sm font-semibold ${tab === k ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-500"}`}>{l}</button>
          ))}
        </div>
        <video key={src} data-testid="a2hs-video" src={src} controls autoPlay muted playsInline className="block mx-auto rounded-2xl bg-black aspect-[1080/2338] w-auto max-w-full h-[56vh] md:h-[62vh] object-contain" />
        <ol className="mt-3 space-y-1.5 text-sm text-slate-600">
          {steps.map((t, i) => <li key={t} className="flex gap-2"><span className="h-5 w-5 shrink-0 rounded-full bg-orange-100 text-orange-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>{t}</li>)}
        </ol>
        <div className="mt-2 text-[11px] text-slate-400">{label} 教學</div>
      </div>
    </div>
  );
}
