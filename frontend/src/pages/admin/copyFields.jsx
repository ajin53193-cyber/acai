import { Plus, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

export const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";

const Label = ({ children }) => <label className="mb-1.5 block text-xs tracking-widest text-slate-400">{children}</label>;

const AddBtn = ({ onClick, testid, children }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 px-3.5 py-1.5 text-xs font-medium text-[#FFE896] transition-colors hover:bg-[#D4AF37]/10">
    <Plus size={13} /> {children}
  </button>
);

const DelBtn = ({ onClick, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid} aria-label="删除" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
    <Trash2 size={14} />
  </button>
);

/** 字符串列表（合规标识 / 简介段落 / 要点） */
export const StringList = ({ items, onChange, testid, multiline = false, addLabel = "添加一条" }) => {
  const set = (i, v) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2" data-testid={testid}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <textarea data-testid={`${testid}-${i}`} value={item} onChange={(e) => set(i, e.target.value)} rows={3} className={`${inputCls} resize-y`} />
          ) : (
            <input data-testid={`${testid}-${i}`} value={item} onChange={(e) => set(i, e.target.value)} className={inputCls} />
          )}
          <DelBtn testid={`${testid}-del-${i}`} onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <AddBtn testid={`${testid}-add`} onClick={() => onChange([...items, ""])}>{addLabel}</AddBtn>
    </div>
  );
};

/** 单个字段：text / textarea / image / list */
export const CopyField = ({ field, value, onChange, token, testid }) => {
  if (field.type === "textarea") {
    return <textarea data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value)} rows={field.rows || 3} className={`${inputCls} resize-y`} />;
  }
  if (field.type === "image") {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <ImageUpload token={token} value={value || ""} onChange={onChange} testid={testid} />
        <input data-testid={`${testid}-url`} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="或直接填写图片地址" className={`${inputCls} min-w-[200px] flex-1`} />
      </div>
    );
  }
  if (field.type === "list") {
    return <StringList items={value || []} onChange={onChange} testid={testid} multiline={field.multiline} addLabel={field.addLabel} />;
  }
  return <input data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
};

/** 对象列表（服务卡片 / 合作步骤 / 合作方式 / 优势 / 价值观） */
export const ObjectList = ({ field, items, onChange, token, testid }) => {
  const setItem = (i, key, v) => onChange(items.map((x, idx) => (idx === i ? { ...x, [key]: v } : x)));
  const blank = Object.fromEntries(field.itemFields.map((f) => [f.key, f.type === "list" ? [] : ""]));
  return (
    <div className="space-y-4" data-testid={testid}>
      {items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-amber-500/10 bg-[#060B18]/50 p-4" data-testid={`${testid}-item-${i}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest text-[#D4AF37]">第 {i + 1} 项</span>
            <DelBtn testid={`${testid}-del-${i}`} onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field.itemFields.map((f) => (
              <div key={f.key} className={f.type === "textarea" || f.type === "image" || f.type === "list" ? "sm:col-span-2" : ""}>
                <Label>{f.label}</Label>
                <CopyField field={f} value={item[f.key]} onChange={(v) => setItem(i, f.key, v)} token={token} testid={`${testid}-${i}-${f.key}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {(!field.max || items.length < field.max) && (
        <AddBtn testid={`${testid}-add`} onClick={() => onChange([...items, blank])}>{field.addLabel || "添加一项"}</AddBtn>
      )}
    </div>
  );
};

export const FieldLabel = Label;
