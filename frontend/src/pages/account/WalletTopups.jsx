import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, Copy, ExternalLink, RefreshCw, Upload, Landmark } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, SubTabs } from "./AccountLayout";
import { useWallet, BalanceBanner } from "./MyWallet";
import { tr } from "@/i18n";

const TABS = [["all", tr("全部")], ["pending", tr("待付款")], ["reviewing", tr("審核中")], ["paid", tr("已到帳")], ["closed", tr("已失效")]];
const ICONS = { stripe: "/payments/visa-mastercard.svg", paypal: "/payments/paypal.svg", crypto: "/payments/usdt.svg" };
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });
const STATUS = {
  pending: [tr("待付款"), "bg-orange-100 text-orange-500"],
  paid: [tr("已到帳"), "bg-emerald-100 text-emerald-600"],
  expired: [tr("已過期"), "bg-slate-100 text-slate-500"],
  cancelled: [tr("已取消"), "bg-slate-100 text-slate-500"],
  closed: [tr("已關閉"), "bg-slate-100 text-slate-500"],
  failed: [tr("失敗"), "bg-red-100 text-red-500"],
  reviewing: [tr("審核中"), "bg-sky-100 text-sky-600"],
  rejected: [tr("已駁回"), "bg-red-100 text-red-500"],
};
const fmtTime = (s) => (s ? s.slice(0, 16).replace("T", " ") : "-");

function BankPanel({ t, onProof }) {
  const [file, setFile] = useState(null);
  const [payer, setPayer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = (v) => { navigator.clipboard?.writeText(v); toast.success(tr("已複製")); };
  const b = t.bank || {};
  const rows = [[tr("銀行"), b.bank_name], [tr("戶名"), b.account_name], [tr("帳號"), b.account_no], ["SWIFT", b.swift]].filter(([, v]) => v);
  const submit = async () => {
    if (!file) return toast.error(tr("請上傳轉帳憑證截圖"));
    setBusy(true);
    try { await onProof(t, { ...(await readFile(file)), payer_name: payer, note }); toast.success(tr("憑證已提交，客服將盡快核對入帳")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("提交失敗")); }
    setBusy(false);
  };
  return (
    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/50 p-3 text-xs" data-testid={`bank-panel-${t.id}`}>
      <div className="font-semibold text-slate-700 flex items-center gap-1 mb-2"><Landmark className="h-3.5 w-3.5 text-orange-500" />{tr("請轉帳 USD$ {0} 至以下帳戶，並在備註填寫轉帳碼", Number(t.pay_amount || t.amount_usd).toFixed(2))}</div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([k, v]) => <div key={k} className="flex items-center gap-1 min-w-0"><span className="text-slate-400 shrink-0">{k}：</span><span className="text-slate-800 font-medium truncate">{v}</span><button onClick={() => copy(v)} className="text-slate-300 hover:text-orange-500"><Copy className="h-3 w-3" /></button></div>)}
        <div className="flex items-center gap-1"><span className="text-slate-400">{tr("轉帳碼")}：</span><b className="text-orange-600 font-mono" data-testid={`topup-ref-${t.id}`}>{t.reference_code}</b><button onClick={() => copy(t.reference_code)} className="text-slate-300 hover:text-orange-500"><Copy className="h-3 w-3" /></button></div>
      </div>
      {(b.bank_note || b.account_info) && <div className="mt-1.5 text-slate-500 whitespace-pre-line">{b.bank_note || b.account_info}</div>}
      {t.status === "rejected" && <div className="mt-2 text-red-500">{tr("駁回原因：")}{t.reject_reason || tr("憑證無法核對")}，{tr("請重新上傳")}</div>}
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <input data-testid={`proof-payer-${t.id}`} value={payer} onChange={(e) => setPayer(e.target.value)} placeholder={tr("付款人姓名（選填）")} className="h-9 rounded-lg bg-white px-3 outline-none focus:ring-2 focus:ring-orange-300" />
        <input data-testid={`proof-note-${t.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("備註（選填）")} className="h-9 rounded-lg bg-white px-3 outline-none focus:ring-2 focus:ring-orange-300" />
        <label className="h-9 rounded-lg bg-white px-3 flex items-center gap-2 cursor-pointer text-slate-600 truncate"><Upload className="h-3.5 w-3.5 text-orange-500 shrink-0" />{file ? file.name : tr("上傳轉帳憑證截圖（≤5M）")}<input data-testid={`proof-file-${t.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        <button data-testid={`proof-submit-${t.id}`} onClick={submit} disabled={busy} className="h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60">{busy ? tr("提交中…") : tr("提交憑證")}</button>
      </div>
    </div>
  );
}

function TopupRow({ t, onCheck, onProof }) {
  const [label, cls] = STATUS[t.status] || [t.status, "bg-slate-100 text-slate-500"];
  const copy = (v) => { navigator.clipboard?.writeText(v); toast.success(tr("已複製")); };
  const manual = !["stripe", "paypal", "crypto"].includes(t.provider || "crypto");
  return (
    <div className="py-4 first:pt-2" data-testid={`topup-row-${t.id}`}>
      <div className="flex items-start gap-3">
        {manual ? <span className="h-7 w-7 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center shrink-0"><Landmark className="h-4 w-4" /></span> : <img src={ICONS[t.provider || "crypto"]} alt="" className="h-7 w-auto mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-head font-extrabold text-slate-800">USD$ {Number(t.amount_usd).toFixed(2)}</span>
            {t.provider === "crypto" || !t.provider ? <span className="text-xs text-slate-500">{tr("應付")} <b className="text-orange-500" data-testid={`topup-pay-amount-${t.id}`}>{t.pay_amount} USDT</b> · {t.network}</span>
              : <span className="text-xs text-slate-500">{t.method_name}{t.fee_usd > 0 && <> · {tr("含手續費")} ${t.fee_usd}</>}</span>}
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`} data-testid={`topup-status-${t.id}`}>{label}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{tr("建立")} {fmtTime(t.created_at)}</span>
            {t.status === "pending" && t.expires_at && <span>{tr("截止")} {fmtTime(t.expires_at)}</span>}
            {t.paid_at && <span>{tr("到帳")} {fmtTime(t.paid_at)}</span>}
            <span className="truncate max-w-full">{tr("單號")} {t.out_trade_no}</span>
          </div>
          {t.tx_id && <button onClick={() => copy(t.tx_id)} className="mt-1 text-[11px] text-slate-500 font-mono truncate max-w-full flex items-center gap-1 hover:text-orange-500" data-testid={`topup-txid-${t.id}`}><Copy className="h-3 w-3 shrink-0" />TX {t.tx_id.slice(0, 10)}…{t.tx_id.slice(-8)}</button>}
          {manual && ["pending", "rejected"].includes(t.status) && <BankPanel t={t} onProof={onProof} />}
          {manual && t.status === "reviewing" && <div className="mt-2 text-xs text-sky-600">{tr("憑證已提交，等待客服核對（約 10–30 分鐘）")}</div>}
          {!manual && t.status === "pending" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href={t.pay_url} target="_blank" rel="noreferrer" data-testid={`topup-reopen-${t.id}`} className="h-8 px-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"><ExternalLink className="h-3.5 w-3.5" />{tr("重新開啟收銀台")}</a>
              <button onClick={() => onCheck(t)} data-testid={`topup-check-${t.id}`} className="h-8 px-4 rounded-full bg-orange-50 text-orange-500 text-xs font-semibold flex items-center gap-1 hover:bg-orange-100 transition-colors"><RefreshCw className="h-3.5 w-3.5" />{tr("查詢到帳")}</button>
              {t.wallet_address && <button onClick={() => copy(t.wallet_address)} className="h-8 px-4 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 hover:bg-slate-200 transition-colors"><Copy className="h-3.5 w-3.5" />{tr("複製地址")}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WalletTopups() {
  const callApi = useApi();
  const { data, load } = useWallet();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [params, setParams] = useSearchParams();
  const fetchAll = useCallback(() => callApi({ method: "GET", url: "/me/wallet/topups" }).then((r) => setItems(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  const focus = params.get("topup");
  useEffect(() => {
    if (!focus) return;
    let n = 0;
    const tick = async () => {
      try {
        const r = await callApi({ method: "GET", url: `/me/wallet/topup/${focus}` });
        setItems((xs) => xs.some((x) => x.id === focus) ? xs.map((x) => (x.id === focus ? { ...x, ...r.data } : x)) : [r.data, ...xs]);
        if (r.data.status === "paid") { toast.success(tr("充值成功，餘額已更新")); load(); setParams({}, { replace: true }); return; }
        if (r.data.status !== "pending" || ["stripe", "paypal"].indexOf(r.data.provider) < 0) { setParams({}, { replace: true }); return; }
      } catch {}
      if (++n < 24) timer = setTimeout(tick, 3000);
    };
    let timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [focus, callApi, load, setParams]);
  const proof = async (t, body) => { const r = await callApi({ method: "POST", url: `/me/wallet/topup/${t.id}/proof`, data: body }); setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, ...r.data } : x))); };

  const check = async (t) => {
    try {
      const r = await callApi({ method: "GET", url: `/me/wallet/topup/${t.id}` });
      setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, ...r.data } : x)));
      if (r.data.status === "paid") { toast.success(tr("已到帳，餘額已更新")); load(); }
      else if (["pending", "reviewing"].includes(r.data.status)) toast(tr("尚未收到付款，請完成轉帳後稍候再查"));
      else toast.error(tr("此充值單已失效"));
    } catch { toast.error(tr("查詢失敗，請稍後再試")); }
  };

  const shown = items.filter((t) => tab === "all" || (tab === "closed" ? !["pending", "paid", "reviewing"].includes(t.status) : t.status === tab));
  return (
    <Panel title={tr("充值記錄")} testId="wallet-topups-page" right={<Link to="/account/wallet" data-testid="wallet-back" className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500"><ChevronLeft className="h-4 w-4" />{tr("返回錢包")}</Link>}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-6" data-testid="wallet-topups">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} testPrefix="topup-tab" />
        {shown.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm" data-testid="topups-empty">{tr("尚無充值記錄")}<div className="mt-3"><Link to="/account/wallet/topup" className="text-orange-500 font-semibold" data-testid="topups-go-topup">{tr("前往充值 ›")}</Link></div></div>
        ) : (
          <div className="divide-y divide-slate-200/70">{shown.map((t) => <TopupRow key={t.id} t={t} onCheck={check} onProof={proof} />)}</div>
        )}
      </div>
    </Panel>
  );
}
