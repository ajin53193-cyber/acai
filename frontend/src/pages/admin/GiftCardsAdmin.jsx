import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Ban, Power, Copy, CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Table, Modal, Field, Pill, useLoad } from "./ui";

const STATUS = { active: ["emerald", tr("未使用")], redeemed: ["slate", tr("已核銷")], disabled: ["red", tr("已停用")] };

function Stat({ label, value, tone }) {
  return <Card className="p-4" data-testid={`gc-stat-${label}`}><div className="text-xs text-slate-500">{label}</div><div className={`font-head text-2xl font-bold mt-1 ${tone || "text-slate-900"}`}>{value}</div></Card>;
}

export function GiftCardsAdmin({ callApi }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [data, load] = useLoad(callApi, `/admin/gift-cards?status=${status}&q=${encodeURIComponent(qq)}`); // eslint-disable-line
  const [create, setCreate] = useState(null);
  const [result, setResult] = useState(null);
  const d = data || { rows: [], summary: {} };

  const submit = async () => {
    if (!create.face_value_usd || create.face_value_usd <= 0) return toast.error(tr("請輸入面額"));
    try { const r = await callApi({ method: "POST", url: "/admin/gift-cards", data: create }); setResult(r.data); setCreate(null); load(); toast.success(tr("已生成 {0} 張禮品卡", r.data.count)); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const toggle = async (c) => { try { await callApi({ method: "POST", url: `/admin/gift-cards/${c.id}/disable` }); load(); } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); } };
  const del = async (c) => { if (!window.confirm(tr("刪除此禮品卡？"))) return; await callApi({ method: "DELETE", url: `/admin/gift-cards/${c.id}` }); load(); };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success(tr("已複製")); };

  return (
    <div data-testid="giftcards-admin">
      <Head title={tr("禮品卡管理")} sub={tr("批量生成禮品卡，用戶可用卡號為錢包充值；支援外部核銷 API")} right={<Btn data-testid="gc-create-btn" onClick={() => setCreate({ count: 10, face_value_usd: 10, note: "" })}><Plus className="h-4 w-4" />{tr("批量創建")}</Btn>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label={tr("未使用")} value={d.summary.active || 0} tone="text-emerald-600" />
        <Stat label={tr("已核銷")} value={d.summary.redeemed || 0} tone="text-slate-700" />
        <Stat label={tr("發行總額 USD")} value={`$${(d.summary.total_value || 0).toFixed(2)}`} tone="text-orange-600" />
        <Stat label={tr("已核銷金額 USD")} value={`$${(d.summary.redeemed_value || 0).toFixed(2)}`} tone="text-slate-700" />
      </div>
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        <input data-testid="gc-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("卡號 / 批次 / 備註")} className="h-9 flex-1 min-w-[200px] max-w-sm rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
        <Btn data-testid="gc-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
        <div className="flex items-center gap-1 ml-auto">
          {[["", tr("全部")], ["active", tr("未使用")], ["redeemed", tr("已核銷")], ["disabled", tr("已停用")]].map(([k, l]) => <button key={k || "all"} data-testid={`gc-status-${k || "all"}`} onClick={() => setStatus(k)} className={`h-8 px-3 rounded-lg text-xs font-semibold ${status === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>)}
        </div>
      </Card>
      <Table testId="gc-table" cols={[tr("卡號"), tr("面額"), tr("狀態"), tr("批次"), tr("創建時間"), tr("操作")]} empty={data === null ? tr("載入中…") : tr("暫無禮品卡")} rows={d.rows} render={(c) => (
        <tr key={c.id} data-testid={`gc-row-${c.id}`} className={`hover:bg-orange-50/30 ${c.status !== "active" ? "opacity-70" : ""}`}>
          <td className="px-4 py-3"><button onClick={() => copy(c.code)} className="font-mono text-sm text-slate-800 hover:text-orange-600 flex items-center gap-1.5">{c.code}<Copy className="h-3 w-3 opacity-40" /></button></td>
          <td className="px-4 py-3 font-head font-bold text-slate-900">USD$ {Number(c.face_value_usd).toFixed(2)}</td>
          <td className="px-4 py-3"><Pill tone={STATUS[c.status]?.[0]}>{STATUS[c.status]?.[1] || c.status}</Pill></td>
          <td className="px-4 py-3 text-xs text-slate-400 font-mono">{c.batch_no}</td>
          <td className="px-4 py-3 text-slate-500 text-xs">{c.created_at?.slice(0, 16).replace("T", " ")}</td>
          <td className="px-4 py-3"><div className="flex gap-1.5">
            {c.status !== "redeemed" && <Btn kind="ghost" data-testid={`gc-toggle-${c.id}`} onClick={() => toggle(c)}>{c.status === "disabled" ? <Power className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}</Btn>}
            <Btn kind="danger" data-testid={`gc-del-${c.id}`} onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5" /></Btn>
          </div></td>
        </tr>
      )} />

      {create && (
        <Modal testId="gc-create-modal" title={<span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-orange-500" />{tr("批量創建禮品卡")}</span>} onClose={() => setCreate(null)}
          footer={<><Btn kind="ghost" onClick={() => setCreate(null)}>{tr("取消")}</Btn><Btn data-testid="gc-create-submit" onClick={submit}>{tr("生成")}</Btn></>}>
          <Field label={tr("生成數量（1~500）")}><Input data-testid="gc-count" type="number" min="1" max="500" className="w-full" value={create.count} onChange={(e) => setCreate({ ...create, count: +e.target.value })} /></Field>
          <Field label={tr("每張面額 USD$")}><Input data-testid="gc-value" type="number" min="0.01" className="w-full" value={create.face_value_usd} onChange={(e) => setCreate({ ...create, face_value_usd: +e.target.value })} /></Field>
          <Field label={tr("備註（選填）")}><Input data-testid="gc-note" className="w-full" value={create.note} onChange={(e) => setCreate({ ...create, note: e.target.value })} placeholder={tr("如：雙11活動")} /></Field>
        </Modal>
      )}
      {result && (
        <Modal testId="gc-result-modal" title={<span className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" />{tr("已生成 {0} 張", result.count)}</span>} onClose={() => setResult(null)}
          footer={<><Btn kind="ghost" onClick={() => { navigator.clipboard?.writeText(result.codes.join("\n")); toast.success(tr("已複製全部卡號")); }}><Copy className="h-4 w-4" />{tr("複製全部")}</Btn><Btn onClick={() => setResult(null)}>{tr("完成")}</Btn></>}>
          <div className="text-xs text-slate-500 mb-2">{tr("批次")} {result.batch_no}</div>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-1 font-mono text-sm">{result.codes.map((c) => <div key={c} className="text-slate-700">{c}</div>)}</div>
        </Modal>
      )}
    </div>
  );
}

export function GiftCardRedemptionsAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [rows] = useLoad(callApi, `/admin/gift-card-redemptions?q=${encodeURIComponent(qq)}`); // eslint-disable-line
  return (
    <div data-testid="gc-redemptions-admin">
      <Head title={tr("卡券核銷記錄")} sub={tr("已被用戶或外部 API 核銷的禮品卡")} />
      <Card className="p-3 mb-4 flex items-center gap-2">
        <input data-testid="gcr-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQq(q)} placeholder={tr("卡號")} className="h-9 flex-1 max-w-sm rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
        <Btn data-testid="gcr-search-btn" onClick={() => setQq(q)}>{tr("查詢")}</Btn>
      </Card>
      <Table testId="gcr-table" cols={[tr("卡號"), tr("面額"), tr("核銷用戶"), tr("核銷方式"), tr("核銷時間")]} empty={rows === null ? tr("載入中…") : tr("暫無核銷記錄")} rows={rows || []} render={(r) => (
        <tr key={r.id} data-testid={`gcr-row-${r.id}`} className="hover:bg-slate-50">
          <td className="px-4 py-3 font-mono text-sm text-slate-800">{r.code}</td>
          <td className="px-4 py-3 font-head font-bold text-emerald-600">+USD$ {Number(r.face_value_usd).toFixed(2)}</td>
          <td className="px-4 py-3"><div className="text-slate-800 truncate max-w-[180px]">{r.user_label}</div>{r.account_no !== "-" && <div className="text-[10px] text-slate-400 font-mono">{r.account_no}</div>}</td>
          <td className="px-4 py-3"><Pill tone={r.redeemed_via === "api" ? "violet" : "sky"}>{r.redeemed_via === "api" ? tr("外部API") : tr("用戶充值")}</Pill></td>
          <td className="px-4 py-3 text-slate-500 text-xs">{r.redeemed_at?.slice(0, 16).replace("T", " ")}</td>
        </tr>
      )} />
    </div>
  );
}

export function GiftCardApiAdmin({ callApi }) {
  const [info, load] = useLoad(callApi, "/admin/gift-card-api");
  const regen = async () => { if (!window.confirm(tr("重新生成後舊密鑰立即失效，確定？"))) return; await callApi({ method: "POST", url: "/admin/gift-card-api/regenerate" }); load(); toast.success(tr("已重新生成")); };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success(tr("已複製")); };
  const curl = info ? `curl -X POST "${info.endpoint}" \\\n  -H "X-Api-Key: ${info.api_key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"code":"GC-XXXX-XXXX-XXXX-XXXX"}'` : "";
  return (
    <div data-testid="gc-api-admin">
      <Head title={tr("核銷 API 配置")} sub={tr("供外部系統（POS / 合作商）核銷禮品卡的接口")} right={<Btn kind="danger" data-testid="gc-api-regen" onClick={regen}>{tr("重新生成密鑰")}</Btn>} />
      <Card className="p-5 max-w-2xl space-y-4">
        <Field label={tr("API 密鑰（X-Api-Key）")}>
          <div className="flex gap-2"><Input readOnly value={info?.api_key || ""} className="w-full font-mono text-xs" data-testid="gc-api-key" /><Btn kind="ghost" onClick={() => copy(info?.api_key)}><Copy className="h-4 w-4" /></Btn></div>
        </Field>
        <Field label={tr("核銷接口 Endpoint")}>
          <div className="flex gap-2"><Input readOnly value={info?.endpoint || ""} className="w-full font-mono text-xs" /><Btn kind="ghost" onClick={() => copy(info?.endpoint)}><Copy className="h-4 w-4" /></Btn></div>
        </Field>
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">{tr("調用示例")}</div>
          <pre className="rounded-lg bg-slate-900 text-slate-100 text-[11px] p-3 overflow-x-auto whitespace-pre-wrap">{curl}</pre>
        </div>
        <div className="text-xs text-slate-500 leading-5 flex gap-2"><XCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />{tr("核銷成功返回 {valid:true, face_value_usd}；卡不存在或已使用返回 400。每張卡僅可核銷一次。")}</div>
      </Card>
    </div>
  );
}
