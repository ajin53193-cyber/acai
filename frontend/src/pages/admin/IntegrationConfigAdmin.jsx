import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Save, Send, KeyRound, ShieldCheck } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Field, Card, Pill } from "./ui";

export function IntegrationConfigAdmin({ callApi, group, title, sub, canTest }) {
  const [fields, setFields] = useState(null);
  const [vals, setVals] = useState({});
  const [target, setTarget] = useState("");
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/integration-settings?group=${group}` }).then((r) => {
    setFields(r.data.fields);
    const init = {};
    r.data.fields.forEach((f) => { if (!f.secret) init[f.key] = f.value || ""; });
    setVals(init);
  }).catch((e) => toast.error(e.response?.data?.detail || tr("載入失敗"))), [callApi, group]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await callApi({ method: "PUT", url: "/admin/integration-settings", data: { group, values: vals } });
      toast.success(tr("已儲存，立即生效")); setVals((v) => { const n = { ...v }; (fields || []).forEach((f) => { if (f.secret) n[f.key] = ""; }); return n; }); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };
  const test = async () => {
    if (!target.trim()) return toast.error(group === "sms" ? tr("請輸入測試手機號") : tr("請輸入測試信箱"));
    try { const r = await callApi({ method: "POST", url: "/admin/integration-settings/test", data: { group, target: target.trim() } }); toast.success(r.data.message || tr("已發送")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("發送失敗")); }
  };

  if (!fields) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  return (
    <div data-testid={`integration-${group}`}>
      <Head title={title} sub={sub} right={<Btn data-testid="int-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存配置")}</Btn>} />
      <Card className="p-5 max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2"><ShieldCheck className="h-4 w-4 shrink-0" />{tr("配置保存於資料庫並即時生效（覆蓋 .env）。密鑰欄留空表示不修改。")}</div>
        {fields.map((f) => (
          <Field key={f.key} label={<span className="flex items-center gap-2">{f.label}{f.secret && <KeyRound className="h-3 w-3 text-slate-400" />}{f.set ? <Pill tone={f.source === "db" ? "emerald" : "sky"}>{f.source === "db" ? tr("資料庫") : tr("環境")}</Pill> : <Pill tone="slate">{tr("未設定")}</Pill>}</span>}>
            <Input data-testid={`int-field-${f.key}`} className="w-full font-mono" type={f.secret ? "password" : "text"}
              value={f.secret ? (vals[f.key] || "") : (vals[f.key] ?? "")}
              placeholder={f.secret ? (f.value || tr("未設定")) : ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
          </Field>
        ))}
      </Card>
      {canTest && (
        <Card className="p-5 max-w-xl space-y-3 mt-4">
          <div className="font-head font-bold text-slate-800 flex items-center gap-2"><Send className="h-4 w-4 text-orange-500" />{tr("發送測試")}</div>
          <div className="flex gap-2">
            <Input data-testid="int-test-target" className="flex-1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={group === "sms" ? "+886912345678" : "you@example.com"} />
            <Btn kind="ok" data-testid="int-test-send" onClick={test}><Send className="h-4 w-4" />{tr("發送測試")}</Btn>
          </div>
          <div className="text-[11px] text-slate-400">{tr("請先儲存配置，再發送測試。")}</div>
        </Card>
      )}
    </div>
  );
}
