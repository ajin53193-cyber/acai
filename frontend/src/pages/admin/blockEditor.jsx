import { Trash2, Type, Image as ImageIcon, Heading, MousePointerClick, ArrowUp, ArrowDown } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { inputCls } from "./copyFields";

export const BLOCK_TYPES = [
  { type: "heading", label: "小标题", icon: Heading },
  { type: "text", label: "文字段落", icon: Type },
  { type: "image", label: "图片", icon: ImageIcon },
  { type: "button", label: "跳转按钮", icon: MousePointerClick },
];
const BLOCK_LABEL = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label]));


export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
};

export const BlockEditor = ({ block, index, total, token, onChange, onRemove, onMove }) => {
  const set = (k, v) => onChange({ ...block, [k]: v });
  return (
    <div className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`promo-block-editor-${index}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest text-[#D4AF37]">{index + 1}. {BLOCK_LABEL[block.type]}</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded-lg p-1.5 text-slate-500 hover:text-[#FFE896] disabled:opacity-30" aria-label="上移" data-testid={`promo-block-up-${index}`}><ArrowUp size={14} /></button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded-lg p-1.5 text-slate-500 hover:text-[#FFE896] disabled:opacity-30" aria-label="下移" data-testid={`promo-block-down-${index}`}><ArrowDown size={14} /></button>
          <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="删除" data-testid={`promo-block-del-${index}`}><Trash2 size={14} /></button>
        </div>
      </div>
      {block.type === "heading" && <input value={block.text} onChange={(e) => set("text", e.target.value)} placeholder="小标题文字" className={inputCls} data-testid={`promo-block-text-${index}`} />}
      {block.type === "text" && <textarea value={block.text} onChange={(e) => set("text", e.target.value)} rows={5} placeholder="段落文字，空行分段" className={`${inputCls} resize-y`} data-testid={`promo-block-text-${index}`} />}
      {block.type === "image" && (
        <div className="space-y-3">
          <ImageUpload token={token} value={block.image} onChange={(v) => set("image", v)} testid={`promo-block-image-${index}`} />
          <input value={block.image} onChange={(e) => set("image", e.target.value)} placeholder="或粘贴图片地址（可用首页图 /images/ui/service-publish.webp、教程图等）" className={inputCls} data-testid={`promo-block-image-url-${index}`} />
          <input value={block.text} onChange={(e) => set("text", e.target.value)} placeholder="图片说明（可选）" className={inputCls} data-testid={`promo-block-text-${index}`} />
        </div>
      )}
      {block.type === "button" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={block.text} onChange={(e) => set("text", e.target.value)} placeholder="按钮文字，如：加入官方交流群" className={inputCls} data-testid={`promo-block-text-${index}`} />
          <input value={block.link} onChange={(e) => set("link", e.target.value)} placeholder="跳转地址：/tutorials/join-group 或 https://…" className={inputCls} data-testid={`promo-block-link-${index}`} />
        </div>
      )}
    </div>
  );
};

