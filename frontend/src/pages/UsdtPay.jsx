import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Clock, Copy, Check, X, Loader2, ChevronDown, ChevronLeft, Leaf } from "lucide-react";
import { isIOS } from "@/lib/track";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { openService } from "@/components/ServiceWidget";
import ServiceWidget from "@/components/ServiceWidget";
import { celebrate } from "@/lib/celebrate";
import { tr, LANG, LANGS, setLang } from "@/i18n";

const COIN = "/payments/tether-coin.svg";
const fmtAmt = (v) => String(Number(v || 0)).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
const copyText = (v) => { navigator.clipboard?.writeText(String(v)); toast.success(tr("已複製")); };
const CopyBtn = ({ v, cls = "", testId }) => <button type="button" data-testid={testId} onClick={() => copyText(v)} className={`inline-flex text-orange-500 hover:text-orange-600 ${cls}`}><Copy className="h-4 w-4" /></button>;
const Addr = ({ s }) => <>{s.split(/(\d+)/).map((p, i) => (/^\d+$/.test(p) ? <b key={i} className="text-slate-900">{p}</b> : <span key={i}>{p}</span>))}</>;
const Net = ({ n }) => <span className="inline-block rounded-sm bg-red-50 text-red-500 border border-red-200 px-1 text-[10px] font-bold italic leading-4">{n}</span>;

function useCountdown(iso, active) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!iso || !active) return;
    const tick = () => { const ms = Math.max(0, new Date(iso) - Date.now()); const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000); setLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [iso, active]);
  return left;
}

function saveQr(svgEl, name) {
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 600;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 600, 600); ctx.drawImage(img, 20, 20, 560, 560);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${name}.png`; a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

const NOTES = (amt, net, addr) => [
  tr("幣種限制：以上地址只支持{0}公鏈協議的USDT幣種（泰達幣），請勿充入其他幣種，以免造成損失。", net),
  tr("金額限制：請務必按以上金額{0}USDT進行充幣，超出或低於此金額將無法自動到賬，需自行聯繫客服進行補單。", amt),
  tr("到賬時間：提幣到以上地址後，至少需要1個區塊鏈確認才能到賬，一般1分鐘內完成，請耐心等待區塊網絡確認。"),
  tr("異常處理：若存在確認超時、錯誤、大額誤充等情形，請聯繫在線客服進行人工處理。"),
  tr("使用正版：請務必使用正版瀏覽器、APP等程序，切勿使用破解版、非官方版本，以免被篡改或被盜。"),
  tr("轉賬地址：請勿從高風險地址轉入，相關地址有高風險攔截及凍結風險，避免影響正常充幣流程。"),
  <>{tr("區塊鏈記錄：一切交易以官方區塊鏈瀏覽器記錄為準，以上地址的區塊鏈記錄鏈接是 ")}<a href={`https://tronscan.org/#/address/${addr}`} target="_blank" rel="noreferrer" className="text-orange-500 break-all">https://tronscan.org/#/address/{addr}</a></>,
];
const FAQ = [tr("什麼是USDT"), tr("如何購買"), tr("充幣多久能到賬/如何查詢"), tr("充/提幣需要手續費嗎"), tr("充幣沒到賬要怎麼處理")];

const ENERGY_NOTES = () => [
  tr("租賃說明：因任何一筆TRC20轉賬支出都要支付礦工費（例如：冷錢包轉賬需消耗TRX，而交易所一般收取1U手續費），但礦工費可以用能量替代（即地址有能量時優先使用能量）。"),
  tr("約節省70%礦工費攻略（交易所的提幣除外）：所以您在充幣前可以先花2或4TRX購買6.5萬或13.1萬的能量，然後系統將自動用該筆能量來抵扣USDT轉賬的礦工費，每6.5萬能量可以抵扣1筆轉賬（即2TRX的能量可以抵扣原本6.4285TRX礦工費，約節省70%）；因TRC20特殊機制，若轉賬時的對方收幣地址的USDT餘額為0，則系統需要消耗雙倍礦工費（即13.0285TRX礦工費），則該筆轉賬也需要消耗雙倍能量為13.1萬（即4TRX的能量可以抵扣原本13.0285TRX礦工費，約節省70%），詳見詳細租賃規則。"),
  tr("不適用場景：交易所的提幣不消耗TRX礦工費，而是直接扣除USDT手續費，所以租賃能量對交易所的提幣無效。"),
  tr("能量有效期：2小時，購買後需盡快使用。"),
];

function EnergyCard({ addr }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 overflow-hidden shadow-sm" data-testid="usdt-pay-energy">
      <button type="button" data-testid="usdt-energy-toggle" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <Leaf className="h-5 w-5 shrink-0 text-emerald-600" />
        <span className="font-bold text-emerald-900 text-[15px]">{tr("能量租賃，節省70%礦工費")}</span>
        <span className="rounded bg-emerald-200/70 text-emerald-700 text-[11px] font-bold px-1.5 py-0.5">{tr("省70%")}</span>
        <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 text-emerald-600"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="text-[13px] text-slate-700 flex items-center gap-1.5 flex-wrap"><b className="text-slate-800">{tr("租賃費用：")}</b><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] leading-none">▼</span>{tr("1TRX/筆（即每65500能量只需1TRX）")}</div>
          <div className="mt-3 rounded-xl bg-white/80 border border-emerald-200 px-3 py-3">
            <div className="text-[13px] font-bold text-emerald-900">{tr("TRX地址")} <span className="font-normal text-slate-500 text-[11px]">{tr("(先向下方地址轉TRX購買能量，後再轉U不扣礦工費)")}</span></div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[14px] text-slate-800 break-all leading-5" data-testid="usdt-energy-address"><Addr s={addr} /></span>
              <button type="button" data-testid="usdt-energy-copy" onClick={() => copyText(addr)} className="inline-flex shrink-0 text-emerald-600 hover:text-emerald-700"><Copy className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-[13px] font-bold text-orange-500 leading-5">{tr("此地址只收 TRX，請勿轉 USDT！請勿轉 USDT！請勿轉 USDT！")}</p>
            <div className="mt-2.5 flex items-center gap-2 text-[13px]"><span className="text-slate-600">{tr("快捷購買金額：")}</span>
              <button type="button" data-testid="usdt-energy-amount" onClick={() => copyText("1")} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 text-[13px] font-semibold transition-colors"><Copy className="h-3.5 w-3.5" />1 TRX</button>
            </div>
          </div>
          <ol className="mt-3 space-y-2 text-[12px] text-slate-600 leading-5">{ENERGY_NOTES().map((n, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0 font-bold text-slate-700">{i + 1}、</span><span>{n}</span></li>)}</ol>
        </div>
      )}
    </div>
  );
}

export default function UsdtPay() {
  const { tid } = useParams();
  const callApi = useApi();
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");
  const [showWin, setShowWin] = useState(false);
  const wonRef = useRef(false);
  const qrRef = useRef(null);
  const load = useCallback(async () => {
    try { const r = await callApi({ method: "GET", url: `/me/wallet/topup/${tid}` }); setT(r.data); return r.data; }
    catch (e) { setErr(e.response?.data?.detail || tr("充值單不存在")); }
  }, [callApi, tid]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!t || t.status !== "pending") return;
    const id = setInterval(async () => { const d = await load(); if (d?.status === "paid" && !wonRef.current) { wonRef.current = true; celebrate(); setShowWin(true); } }, 5000);
    return () => clearInterval(id);
  }, [t?.status, load]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = useCountdown(t?.expires_at, t?.status === "pending");

  const amt = fmtAmt(t?.pay_amount || t?.amount_usd);
  const net = t?.network || "TRC20";
  const paid = t?.status === "paid";
  const dead = t && !["pending", "paid"].includes(t.status);

  // iOS App Shell（同 StoreLayout）：窗口不滚动，内容在 #site-scroll 内滚，header 固定不漂移
  useLayoutEffect(() => { document.documentElement.classList.add("shell"); return () => document.documentElement.classList.remove("shell"); }, []);
  const ios = isIOS();

  return (
    <div className="shell-root relative min-h-screen overflow-hidden flex flex-col bg-gradient-to-b from-[#fff3e6] via-[#fff8f0] to-[#fffdfb] text-slate-800" data-testid="usdt-pay-page">
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute -top-12 -right-16 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
        <img src="/gogo589-wordmark.png" alt="" className="absolute bottom-10 -right-10 w-72 opacity-[0.04] rotate-[-8deg]" />
      </div>
      <header className={`${ios ? "relative" : "sticky top-0"} z-20 bg-white/90 backdrop-blur border-b border-orange-100 shadow-sm`}>
        <div className="mx-auto max-w-[360px] sm:max-w-[420px] h-14 flex items-center justify-between px-3">
          <div className="flex items-center gap-1 min-w-0">
            <Link to="/account/wallet/topups" aria-label="back" data-testid="usdt-pay-back" className="-ml-1 p-1 rounded-lg text-orange-500"><ChevronLeft className="h-6 w-6" strokeWidth={2.5} /></Link>
            <Link to="/" className="flex items-center min-w-0" data-testid="usdt-pay-logo">
              <img src="/gogo589-wordmark.png" alt="gogo589" className="h-7 w-auto object-contain" />
            </Link>
          </div>
          <label className="relative text-[13px] text-slate-700 flex items-center gap-1 cursor-pointer">
            <select data-testid="usdt-pay-lang" value={LANG} onChange={(e) => setLang(e.target.value)} className="appearance-none bg-transparent pr-4 outline-none cursor-pointer">{LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <ChevronDown className="h-3.5 w-3.5 absolute right-0 pointer-events-none" />
          </label>
        </div>
      </header>

      <div id="site-scroll" className="relative z-10 flex-1 flex flex-col pb-10">
      <main className="relative mx-auto w-full max-w-[360px] sm:max-w-[420px] mt-3 px-3 sm:px-0">
        {t?.energy_trx_address && !paid && !dead && <EnergyCard addr={t.energy_trx_address} />}
        {err && <div className="rounded-2xl bg-white shadow-sm p-8 text-center text-sm text-slate-500" data-testid="usdt-pay-error">{err}<div className="mt-4"><Link to="/account/wallet/topup" className="text-orange-500 font-semibold">{tr("返回充值")}</Link></div></div>}
        {t && (
          <div className="rounded-2xl bg-white shadow-sm px-4 pt-5 pb-4">
            <div className="flex flex-col items-center">
              <span className={`h-10 w-10 rounded-full flex items-center justify-center text-white ${paid ? "bg-emerald-500" : dead ? "bg-slate-300" : "bg-amber-400"}`}>{paid ? <Check className="h-5 w-5" strokeWidth={3} /> : dead ? <X className="h-5 w-5" strokeWidth={3} /> : <Clock className="h-5 w-5" strokeWidth={2.5} />}</span>
              <div className={`mt-2 text-[15px] font-semibold ${paid ? "text-emerald-600" : dead ? "text-slate-500" : "text-amber-500"}`} data-testid="usdt-pay-status">{paid ? tr("已到賬") : dead ? tr("已過期") : tr("待付款")}</div>
              <div className="mt-1 flex items-center gap-2"><img src={COIN} alt="" className="h-5 w-5" /><span className="text-[30px] font-extrabold font-head tracking-tight text-orange-500" data-testid="usdt-pay-amount">{amt}</span><CopyBtn v={amt} testId="usdt-pay-copy-amount" /></div>
              {!paid && !dead && <>
                <p className="mt-1 text-center text-[12px] text-slate-600 leading-5">{tr("請確保實際到賬={0}USDT（含小數尾數），金額不符將無法自動到賬", amt)}</p>
                <p className="mt-1.5 text-[12px] text-slate-500">{tr("請在 {0} 內完成付款", "|").split("|")[0]}<b className="text-amber-500 font-bold" data-testid="usdt-pay-countdown">{left || "--:--"}</b>{tr("請在 {0} 內完成付款", "|").split("|")[1]}</p>
              </>}
              {paid && <p className="mt-1 text-[12px] text-slate-500">{tr("已確認到賬，餘額已更新")}{t.tx_id && <> · <a className="text-orange-500" href={`https://tronscan.org/#/transaction/${t.tx_id}`} target="_blank" rel="noreferrer">TXID</a></>}</p>}
              {dead && <p className="mt-1 text-center text-[12px] text-slate-500">{tr("此充值單已超時關閉；若您已完成轉賬，請聯繫在線客服補單。")}</p>}
            </div>

            {!paid && !dead && <>
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><Net n={net} />{tr("{0}充幣地址", net)}</div>
                <div className="mt-1 flex items-center justify-between gap-2"><span className="font-mono text-[14px] text-slate-700 break-all leading-5" data-testid="usdt-pay-address"><Addr s={t.wallet_address} /></span><CopyBtn v={t.wallet_address} cls="shrink-0" testId="usdt-pay-copy-address" /></div>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-red-500">{tr("請認準{0}公鏈+仔細核對，以免造成損失！", net)}</p>
              <div className="mt-1.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] text-slate-700">{tr("請勿關閉付款頁面，付款完成後等待1～3分鐘自動到賬。")}</div>
              {t.wallet_note && <div className="mt-1.5 text-[11px] text-slate-500 whitespace-pre-line">{t.wallet_note}</div>}

              <div className="mt-4 flex flex-col items-center">
                <div ref={qrRef} className="rounded-md bg-white p-1" data-testid="usdt-pay-qr"><QRCodeSVG value={t.wallet_address} size={148} level="H" imageSettings={{ src: COIN, height: 30, width: 30, excavate: true }} /></div>
                <button type="button" data-testid="usdt-pay-save-qr" onClick={() => saveQr(qrRef.current?.querySelector("svg"), `USDT-${net}-${t.wallet_address.slice(0, 6)}`)} className="mt-2 text-[12px] text-orange-500 font-semibold hover:underline">{tr("保存二維碼")}</button>
              </div>
            </>}

            <dl className="mt-4 divide-y divide-slate-100 text-[12px]">
              <div className="flex items-center justify-between py-2"><dt className="text-slate-500">{tr("幣種")}</dt><dd className="flex items-center gap-1 font-semibold text-slate-800"><img src={COIN} alt="" className="h-3.5 w-3.5" />USDT</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-slate-500">{tr("公鏈協議")}</dt><dd className="flex items-center gap-1.5 font-semibold text-slate-800"><Net n={net} />{net}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-slate-500">{tr("充幣數量")}</dt><dd className="flex items-center gap-1.5 font-semibold text-slate-800">{amt} USDT<CopyBtn v={amt} /></dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-slate-500">{tr("訂單號")}</dt><dd className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]" data-testid="usdt-pay-order-no">{t.out_trade_no}<CopyBtn v={t.out_trade_no} /></dd></div>
            </dl>

            {!paid && !dead && <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-slate-500" data-testid="usdt-pay-listening"><Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />{tr("正在監聽鏈上到賬…")}</div>}
            {paid && <Link to="/account/wallet" data-testid="usdt-pay-back-wallet" className="mt-3 h-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center justify-center transition-colors">{tr("返回錢包")}</Link>}
            {dead && <Link to="/account/wallet/topup" data-testid="usdt-pay-retry" className="mt-3 h-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center justify-center transition-colors">{tr("重新發起充值")}</Link>}
            <button type="button" data-testid="usdt-pay-contact" onClick={() => openService()} className="mt-2 w-full text-center text-[12px] text-orange-500 hover:underline">{tr("轉錯金額或未自動到賬？點此聯繫在線客服")}</button>
          </div>
        )}

        {t && (
          <div className="mt-3 rounded-2xl bg-white shadow-sm px-4 py-4 text-[12px] text-slate-600 leading-5">
            <div className="font-semibold text-slate-800 text-[13px]">{tr("充幣說明")}</div>
            <ol className="mt-2 space-y-1.5">{NOTES(amt, net, t.wallet_address).map((n, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0 text-slate-400">{i + 1}、</span><span>{n}</span></li>)}</ol>
            <div className="mt-4 font-semibold text-slate-800 text-[13px]">{tr("常見教程：")}</div>
            <ul className="mt-2 space-y-1">{FAQ.map((q, i) => <li key={i}><Link to="/account/help" className="text-orange-500 hover:underline">{i + 1}、{q}</Link></li>)}</ul>
          </div>
        )}
      </main>
      </div>

      {showWin && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm px-8 animate-in fade-in duration-200" data-testid="usdt-pay-success-modal" onClick={() => setShowWin(false)}>
          <div className="w-full max-w-[320px] rounded-[26px] bg-white p-7 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-300/50">
              <Check className="h-10 w-10" strokeWidth={3} />
            </div>
            <div className="mt-5 font-head text-[22px] font-extrabold text-slate-900">{tr("充值成功到賬！")}</div>
            <p className="mt-2 text-[13px] text-slate-500 leading-5">{tr("您的 {0} USDT 已成功到賬，錢包餘額已更新。", amt)}</p>
            <Link to="/account/wallet" data-testid="usdt-pay-success-wallet" className="mt-6 h-12 w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold flex items-center justify-center hover:brightness-105 transition">{tr("查看我的錢包")}</Link>
            <button type="button" data-testid="usdt-pay-success-close" onClick={() => setShowWin(false)} className="mt-3 text-[13px] text-slate-400 hover:text-slate-600">{tr("留在此頁")}</button>
          </div>
        </div>
      )}

      <ServiceWidget />
    </div>
  );
}
