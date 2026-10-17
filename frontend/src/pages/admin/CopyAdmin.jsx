import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Save, RotateCcw, ChevronDown } from "lucide-react";
import { API, formatDetail, invalidateSettings } from "@/lib/api";
import { DEFAULT_COPY, mergeCopy } from "@/lib/defaultCopy";
import { COPY_SECTIONS } from "./copySchema";
import { CopyField, ObjectList, FieldLabel } from "./copyFields";

export default function CopyAdmin({ token, onUnauthorized }) {
  const [copy, setCopy] = useState(DEFAULT_COPY);
  const [open, setOpen] = useState("home");
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/settings`).then((res) => setCopy(mergeCopy(res.data.copy))).catch(() => {});
  }, []);

  const getVal = (section, field) => (field.root ? copy[field.key] : copy[section.key]?.[field.key]);
  const setVal = (section, field, v) =>
    setCopy((prev) => (field.root ? { ...prev, [field.key]: v } : { ...prev, [section.key]: { ...prev[section.key], [field.key]: v } }));

  const resetSection = (section) => {
    setCopy((prev) => {
      const next = { ...prev };
      for (const f of section.fields) {
        if (f.root) next[f.key] = DEFAULT_COPY[f.key];
        else next[section.key] = { ...next[section.key], [f.key]: DEFAULT_COPY[section.key][f.key] };
      }
      return next;
    });
    toast.info(`「${section.title}」已恢复默认文案，记得点击保存`);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/admin/settings/copy`, copy, { headers });
      setCopy(mergeCopy(res.data.copy));
      invalidateSettings();
      toast.success("页面文案已保存，前台已同步更新");
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="copy-admin">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-3xl px-7 py-5">
        <div>
          <h3 className="font-display text-lg font-bold text-gold-gradient">页面文案</h3>
          <p className="mt-1 text-xs text-slate-500">修改前台各页面标题、说明、按钮与卡片内容，保存后立即生效</p>
        </div>
        <button type="button" onClick={save} disabled={saving} data-testid="copy-save-btn" className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-7 py-2.5 text-sm font-bold text-[#060B18] shadow-[0_0_18px_rgba(212,175,55,0.35)] transition-all hover:scale-105 disabled:opacity-60">
          <Save size={15} /> {saving ? "保存中…" : "保存全部文案"}
        </button>
      </div>

      {COPY_SECTIONS.map((section) => {
        const isOpen = open === section.key;
        return (
          <div key={section.key} className="glass-card rounded-3xl" data-testid={`copy-section-${section.key}`}>
            <button type="button" onClick={() => setOpen(isOpen ? "" : section.key)} data-testid={`copy-section-toggle-${section.key}`} className="flex w-full items-center justify-between px-7 py-5 text-left">
              <div>
                <div className="font-display text-base font-bold text-slate-100">{section.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{section.desc}</div>
              </div>
              <ChevronDown size={18} className={`shrink-0 text-[#D4AF37] transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t border-amber-500/10 px-7 pb-7 pt-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const wide = ["textarea", "image", "list", "objects"].includes(field.type);
                    const testid = `copy-${section.key}-${field.key}`;
                    return (
                      <div key={field.key} className={wide ? "sm:col-span-2" : ""}>
                        <FieldLabel>{field.label}</FieldLabel>
                        {field.type === "objects" ? (
                          <ObjectList field={field} items={getVal(section, field) || []} onChange={(v) => setVal(section, field, v)} token={token} testid={testid} />
                        ) : (
                          <CopyField field={field} value={getVal(section, field)} onChange={(v) => setVal(section, field, v)} token={token} testid={testid} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => resetSection(section)} data-testid={`copy-reset-${section.key}`} className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-[#FFE896]">
                  <RotateCcw size={12} /> 恢复本区默认文案
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} data-testid="copy-save-btn-bottom" className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-7 py-2.5 text-sm font-bold text-[#060B18] transition-all hover:scale-105 disabled:opacity-60">
          <Save size={15} /> {saving ? "保存中…" : "保存全部文案"}
        </button>
      </div>
    </div>
  );
}
