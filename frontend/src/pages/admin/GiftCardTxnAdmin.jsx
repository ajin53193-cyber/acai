import { useCallback, useEffect, useState } from "react";
import { Search, Download, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Field, Table, Pill, fmt } from "./ui";

export function GiftCardTxnAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [redeemed, setRedeemed] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState({ rows: [], total: 0 });
  const [form, setForm] = useState({ trade_no: "", phone: "", amount: "" });
  const [result, setResult] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/giftcard/txns", params: { q, redeemed, date_from: range.from, date_to: range.to, size: 200 } }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, q, redeemed, range]);
  useEffect(() => { load(); }, [load]);
  const redeem = async () => {
    if (!form.trade_no.trim()) return toast.error(tr("請輸入交易號"));
    setResult(null);
    try {
      const r = await callApi({ method: "POST", url: "/admin/giftcard/redeem", data: { trade_no: form.trade_no.trim(), phone: form.phone.trim(), amount: form.amount === "" ? null : +form.amount } });
      setResult({ ok: true, msg: tr("核銷成功"), t: r.data }); toast.success(tr("核銷成功")); setForm({ trade_no: "", phone: "", amount: "" }); load();
    } catch (e) { const msg = e.response?.data?.detail || tr("核銷失敗"); setResult({ ok: false, msg }); toast.error(msg); }
  };
  const exportCsv = async () => {
    try {
      const r = await callApi({ method: "GET", url: "/admin/giftcard/txns/export", params: { date_from: range.from, date_to: range.to, redeemed: redeemed || "1" }, responseType: "blob" });
      const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = "giftcard_redemptions.csv"; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error(tr("匯出失敗")); }
  };
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success(tr("已複製")));
  const inp = "h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300";
  return (
    <div data-testid="giftcard-txn-admin">
      <Head title={tr("交易號查詢 / 核銷")} sub={tr("輸入交易號核銷（可加手機號、面額三要素校驗）；下方可查詢所有交易號與核銷歷史並匯出 CSV。")} />
      <Card className="p-4 mb-4" data-testid="gct-redeem-card">
        <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{tr("人工核銷")}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label={tr("交易號（32 位）")}><Input data-testid="gct-trade-no" className="w-full font-mono" value={form.trade_no} onChange={(e) => setForm({ ...form, trade_no: e.target.value })} placeholder="20261014…" /></Field>
          <Field label={tr("收禮人手機號（選填）")}><Input data-testid="gct-phone" className="w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={tr("面額（選填）")}><Input data-testid="gct-amount" type="number" className="w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <div className="flex items-end"><Btn data-testid="gct-redeem-btn" onClick={redeem} className="w-full">{tr("核銷")}</Btn></div>
        </div>
        {result && <div data-testid="gct-result" className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{result.msg}{result.ok && result.t && <span className="ml-2 font-normal text-xs">{result.t.product_name} {result.t.spec_label} · {result.t.currency} {result.t.amount} · {result.t.phone}</span>}</div>}
      </Card>
      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" /><Input data-testid="gct-search" className="w-64" placeholder={tr("交易號 / 訂單號 / 手機號")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select data-testid="gct-filter" className={inp} value={redeemed} onChange={(e) => setRedeemed(e.target.value)}><option value="">{tr("全部")}</option><option value="0">{tr("未核銷")}</option><option value="1">{tr("已核銷")}</option></select>
        <input type="date" className={inp} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><span className="text-slate-400">—</span><input type="date" className={inp} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <Btn data-testid="gct-export" kind="ghost" onClick={exportCsv}><Download className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("匯出 CSV")}</Btn>
        <Btn kind="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Btn>
        <span className="text-xs text-slate-400 ml-auto">{tr("共 {0} 筆", data.total)}</span>
      </Card>
      <Card className="overflow-hidden">
        <Table testId="gct-table" cols={[tr("交易號"), tr("訂單號"), tr("商品 / 規格"), tr("面額"), tr("手機號"), tr("收禮人"), tr("狀態"), tr("核銷時間 / 核銷人"), tr("生成時間")]} rows={data.rows} empty={tr("暫無交易號")} render={(t) => (
          <tr key={t.trade_no} data-testid={`gct-row-${t.trade_no}`} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono text-xs text-violet-700 whitespace-nowrap">{t.trade_no}<button onClick={() => copy(t.trade_no)} className="ml-1 text-slate-400 hover:text-violet-600"><Copy className="h-3 w-3 inline" /></button></td>
            <td className="px-4 py-2.5 font-mono text-xs">{t.order_no}</td>
            <td className="px-4 py-2.5 text-xs">{t.product_name}<br /><span className="text-slate-400">{t.spec_label}</span></td>
            <td className="px-4 py-2.5 font-semibold text-orange-600 whitespace-nowrap">{t.currency} {t.amount}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{t.phone || "-"}</td><td className="px-4 py-2.5 text-xs">{t.recipient_name || "-"}</td>
            <td className="px-4 py-2.5"><Pill tone={t.redeemed ? "violet" : "emerald"}>{t.redeemed ? tr("已核銷") : tr("未核銷")}</Pill></td>
            <td className="px-4 py-2.5 text-xs text-slate-500">{t.redeemed ? <>{fmt(t.redeemed_at)}<br />{t.redeemed_by}</> : "-"}</td>
            <td className="px-4 py-2.5 text-xs text-slate-400">{fmt(t.created_at)}</td>
          </tr>
        )} />
      </Card>
    </div>
  );
}

export function GiftCardApiAdmin({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => { callApi({ method: "GET", url: "/admin/giftcard/settings" }).then((r) => setCfg(r.data)).catch(() => {}); }, [callApi]);
  const regen = async () => { if (!window.confirm(tr("重置後舊的 API Key 將立即失效，確定？"))) return; const r = await callApi({ method: "POST", url: "/admin/giftcard/api-key/regenerate" }); setCfg(r.data); toast.success(tr("已重置")); };
  const base = process.env.REACT_APP_BACKEND_URL;
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success(tr("已複製")));
  return (
    <div data-testid="giftcard-api-admin">
      <Head title={tr("核銷接口 API")} sub={tr("供外部核銷平台（收禮方）校驗並核銷交易號。三要素：交易號 + 收禮人手機號 + 面額。")} />
      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold text-slate-700 mb-2">API Key</div>
        <div className="flex items-center gap-2">
          <code data-testid="gca-key" className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono break-all">{cfg ? (show ? cfg.api_key : cfg.api_key.slice(0, 8) + "••••••••••••••••") : "…"}</code>
          <Btn kind="ghost" data-testid="gca-toggle" onClick={() => setShow(!show)}>{show ? tr("隱藏") : tr("顯示")}</Btn>
          <Btn kind="ghost" onClick={() => cfg && copy(cfg.api_key)}><Copy className="h-4 w-4" /></Btn>
          <Btn data-testid="gca-regen" onClick={regen}><RefreshCw className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("重置")}</Btn>
        </div>
      </Card>
      <Card className="p-4 text-sm space-y-3">
        <div className="font-semibold text-slate-700">{tr("接口說明")}</div>
        <pre className="rounded-lg text-xs p-4 overflow-x-auto" style={{ background: "#0f172a", color: "#e2e8f0", whiteSpace: "pre" }}>{`POST ${base}/api/ext/txn/redeem
Headers: Content-Type: application/json
         X-API-Key: <API Key>
Body:    { "transactionNo": "20261014xxxxxxxxxxxxxxxxxxxxxxxx", "phone": "98777777", "amount": 1000 }

200 OK
{ "code": 0, "message": "核銷成功", "data": { "transactionNo": "...", "amount": 1000, "currency": "HKD", "phone": "98777777", "product": "...", "spec": "...", "redeemedAt": "..." } }
{ "code": 404, "message": "查無此交易號" }
{ "code": 422, "message": "信息不符或交易號錯誤" }
{ "code": 409, "message": "該交易號已核銷" }
401 { "detail": "無效的 API Key" }`}</pre>
        <div className="text-xs text-slate-500">{tr("手機號比對：去除國碼與符號後比對完整號碼或末 8 位；面額須與訂單規格面額一致。")}</div>
      </Card>
    </div>
  );
}
