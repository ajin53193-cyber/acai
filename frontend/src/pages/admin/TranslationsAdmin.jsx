import { useState } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Btn, Card, Input, Table, Head, useLoad } from "./ui";

export function TranslationsAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [edit, setEdit] = useState({});
  const [data, load] = useLoad(callApi, `/admin/translations?q=${encodeURIComponent(qq)}`);
  const save = async (src) => {
    try { await callApi({ method: "PUT", url: "/admin/translations", data: { src, en: edit[src] } }); toast.success(tr("已更新英文翻譯")); setEdit((e) => { const n = { ...e }; delete n[src]; return n; }); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("儲存失敗")); }
  };
  const retr = async (src) => {
    try { const r = await callApi({ method: "POST", url: "/admin/translations/retranslate", data: { src } }); toast.success(tr("已重新翻譯")); setEdit((e) => ({ ...e, [src]: r.data.en })); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("翻譯失敗")); }
  };
  return (
    <div>
      <Head title={tr("翻譯管理")} sub={tr("搜尋並修正商品 / 分類 / 文案的英文翻譯；修改後英文站即時生效")} right={<><Input data-testid="tr-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("搜尋中文或英文")} className="w-64" /><Btn kind="ghost" onClick={() => setQq(q)}>{tr("搜尋")}</Btn></>} />
      <Table testId="tr-table" cols={[tr("原文（繁體）"), tr("英文"), tr("操作")]} rows={data || []} render={(t) => (
        <tr key={t.src} data-testid="tr-row" className="hover:bg-slate-50/60 align-top">
          <td className="px-4 py-3 text-slate-800 max-w-xs break-words">{t.src}</td>
          <td className="px-4 py-3 w-[45%]"><textarea data-testid="tr-en" value={edit[t.src] ?? t.en} onChange={(e) => setEdit({ ...edit, [t.src]: e.target.value })} rows={Math.min(6, Math.ceil((t.en || "").length / 60) || 1)} className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></td>
          <td className="px-4 py-3"><div className="flex gap-1.5"><Btn data-testid="tr-save" disabled={edit[t.src] === undefined || edit[t.src] === t.en} onClick={() => save(t.src)}>{tr("儲存")}</Btn><Btn kind="ghost" data-testid="tr-retranslate" onClick={() => retr(t.src)}>{tr("AI 重翻")}</Btn></div></td>
        </tr>
      )} />
      {!qq && <Card className="mt-3 p-3 text-xs text-slate-500">{tr("預設顯示最近更新的 100 筆，請用搜尋找到特定商品或文案。")}</Card>}
    </div>
  );
}
