import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { LANGS, I18N } from "@/lib/checkoutI18n";
import { toast } from "sonner";
import { Copy, Clock, CheckCircle2, XCircle, Loader2, Zap, ChevronDown, ChevronUp, Leaf } from "lucide-react";

const NET_STYLE = {
  TRC20: { bg: "bg-red-50", text: "text-red-600", tag: "TRC20" },
  ERC20: { bg: "bg-indigo-50", text: "text-indigo-600", tag: "ERC20" },
  BEP20: { bg: "bg-yellow-50", text: "text-yellow-700", tag: "BEP20" },
};

const Tether = ({ size = 20 }) => (
  <span style={{ width: size, height: size }} className="inline-flex items-center justify-center rounded-full bg-[#26A17B] text-white font-bold shrink-0" aria-label="USDT">
    <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>₮</span>
  </span>
);

const NetBadge = ({ n }) => {
  const s = NET_STYLE[n] || NET_STYLE.TRC20;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold italic ${s.bg} ${s.text}`}>{s.tag}</span>;
};

function BoldDigits({ text }) {
  return <>{String(text).split("").map((ch, i) => /\d/.test(ch) ? <b key={i} className="text-[1.15em] text-slate-900">{ch}</b> : <span key={i}>{ch}</span>)}</>;
}

function Countdown({ expiresAt, t }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000)));
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [expiresAt]);
  const m = String(Math.floor(left / 60)).padStart(2, "0"), s = String(left % 60).padStart(2, "0");
  return <p className="text-center text-slate-500 text-sm" data-testid="checkout-countdown">{t.payWithin} <span className="text-amber-500 font-semibold font-mono text-base">{m}:{s}s</span> {t.payWithinSuffix}</p>;
}

function Row({ k, v, copyVal, onCopy, testid }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 text-[15px]">{k}</span>
      <span className="flex items-center gap-2 text-slate-900 font-semibold text-[15px]" data-testid={testid}>{v}
        {copyVal !== undefined && <button onClick={() => onCopy(copyVal)} className="text-blue-500 p-0.5"><Copy className="w-4 h-4" /></button>}
      </span>
    </div>
  );
}

export default function CheckoutPage() {
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("sf_pay_lang") || "zh-CN");
  const [energyOpen, setEnergyOpen] = useState(true);
  const t = I18N[lang];

  const load = useCallback(() => {
    api.get(`/orders/${orderNo}/public`).then((r) => setOrder(r.data)).catch(() => setNotFound(true));
  }, [orderNo]);
  useEffect(() => { load(); api.get("/checkout/settings").then((r) => setSettings(r.data)).catch(() => setSettings({})); const i = setInterval(load, 4000); return () => clearInterval(i); }, [load]);

  const changeLang = (v) => { setLang(v); localStorage.setItem("sf_pay_lang", v); };
  const copy = (v) => { navigator.clipboard.writeText(String(v)); toast.success(t.copied); };
  const simulate = async () => {
    setPaying(true);
    try { await api.post(`/orders/${orderNo}/simulate-pay`); load(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setPaying(false); }
  };

  const qrUrl = useMemo(() => order ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(order.wallet_address)}` : "", [order]);
  const saveQr = async () => {
    try {
      const blob = await (await fetch(qrUrl)).blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `usdt-${order.network}-${order.order_no}.png`; a.click();
    } catch { window.open(qrUrl, "_blank"); }
  };

  const shell = (inner) => (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-900 font-sans" data-testid="checkout-page" style={{ colorScheme: "light" }}>
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-end">
          <div className="relative">
            <select value={lang} onChange={(e) => changeLang(e.target.value)} data-testid="checkout-lang-select" className="appearance-none bg-transparent pr-6 text-slate-800 text-base font-medium focus:outline-none">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700" />
          </div>
        </div>
      </header>
      <main className="max-w-md mx-auto px-3 py-4 space-y-3 pb-10">{inner}</main>
    </div>
  );

  if (notFound) return shell(<div className="bg-white rounded-2xl p-10 text-center"><XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" /><p className="text-slate-600">{t.notFound}</p></div>);
  if (!order) return shell(<div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>);

  const amount = order.pay_amount;
  const st = order.status;
  const notes = t.notes(order.network, amount, order.explorer_url);
  const tutorials = settings?.tutorial_links?.length ? settings.tutorial_links : t.defaultTutorials.map((title) => ({ title, url: "" }));
  const showEnergy = settings?.energy_enabled && settings?.energy_trx_address && order.network === "TRC20" && st === "pending";

  return shell(<>
    <section className="bg-white rounded-2xl shadow-sm px-4 pt-6 pb-4">
      <div className="flex flex-col items-center">
        {st === "pending" && <><div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center shadow"><Clock className="w-9 h-9 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-amber-500 font-bold text-xl" data-testid="checkout-status">{t.pending}</div></>}
        {st === "paid" && <><div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow"><CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-emerald-600 font-bold text-xl" data-testid="checkout-status">{t.paid}</div></>}
        {st === "expired" && <><div className="w-16 h-16 rounded-full bg-slate-400 flex items-center justify-center shadow"><XCircle className="w-9 h-9 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-slate-500 font-bold text-xl" data-testid="checkout-status">{t.expired}</div></>}
        <div className="mt-3 flex items-center gap-2">
          <Tether size={28} />
          <span className="text-5xl font-bold tracking-tight" data-testid="checkout-pay-amount">{amount}</span>
          <button onClick={() => copy(amount)} data-testid="copy-amount-btn" className="text-blue-500 p-1"><Copy className="w-5 h-5" /></button>
        </div>
        {st === "pending" && <p className="mt-3 text-center text-[15px] text-slate-700 leading-relaxed px-2">{order.live ? t.ensure(amount) : t.ensureSim(amount)}</p>}
        {st === "pending" && <div className="mt-2 w-full"><Countdown expiresAt={order.expires_at} t={t} /></div>}
      </div>

      {st === "pending" && (
        <>
          <div className="mt-5 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 text-[15px]"><NetBadge n={order.network} /> {t.depositAddr(order.network)}</div>
            <div className="mt-2 flex items-start gap-2">
              <span className="font-mono text-[17px] leading-snug break-all flex-1 text-slate-700" data-testid="checkout-address"><BoldDigits text={order.wallet_address} /></span>
              <button onClick={() => copy(order.wallet_address)} data-testid="copy-address-btn" className="text-blue-500 p-1 shrink-0"><Copy className="w-5 h-5" /></button>
            </div>
          </div>
          <p className="mt-2 text-orange-500 text-[15px] font-medium">{t.checkChain(order.network)}</p>
          {!order.live && <p className="mt-1 text-xs text-slate-400">{t.demo}</p>}

          <div className="mt-5 flex flex-col items-center">
            <div className="relative">
              <img src={qrUrl} alt="QR" width={240} height={240} className="rounded" data-testid="checkout-qr" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-white rounded-full p-1"><Tether size={40} /></div></div>
            </div>
            <button onClick={saveQr} data-testid="save-qr-btn" className="mt-3 text-blue-500 text-lg font-medium">{t.saveQr}</button>
          </div>
        </>
      )}

      {st === "paid" && order.tx_url && <a href={order.tx_url} target="_blank" rel="noreferrer" className="block text-center text-blue-500 text-sm mt-3" data-testid="view-tx-link">{t.viewTx} ↗</a>}

      <div className="mt-5 border-t border-slate-200 pt-1">
        <Row k={t.coin} v={<><Tether size={22} /> USDT</>} onCopy={copy} />
        <Row k={t.protocol} v={<><NetBadge n={order.network} /> {order.network}</>} onCopy={copy} />
        <Row k={t.amount} v={`${amount} USDT`} copyVal={amount} onCopy={copy} testid="checkout-row-amount" />
        <Row k={t.orderNo} v={<span className="font-mono font-normal text-slate-500">{order.order_no}</span>} copyVal={order.order_no} onCopy={copy} testid="checkout-row-order-no" />
        <Row k={t.merchant} v={order.merchant_name} onCopy={copy} />
      </div>

      {st === "pending" && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" /> {t.listening}
        </div>
      )}
      {st === "pending" && !order.live && (
        <button onClick={simulate} disabled={paying} data-testid="simulate-payment-btn" className="mt-4 w-full h-11 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2">
          {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> {t.simulate}</>}
        </button>
      )}
    </section>

    {showEnergy && (
      <section className="bg-[#EEF9EA] rounded-2xl px-4 py-3" data-testid="energy-section">
        <button onClick={() => setEnergyOpen(!energyOpen)} className="w-full flex items-center justify-between text-[17px] font-medium text-slate-800">
          <span className="flex items-center gap-2"><Leaf className="w-5 h-5 text-emerald-600" /> {t.energyTitle}</span>
          {energyOpen ? <ChevronUp className="w-5 h-5 text-blue-500" /> : <ChevronDown className="w-5 h-5 text-blue-500" />}
        </button>
        {energyOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-[15px]"><b>{t.rentFee}</b><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold mx-1">▼</span>{settings.energy_price_text}</p>
            <div className="bg-[#DDF3D6] rounded-xl p-3">
              <p className="text-[15px] font-semibold text-slate-800">{t.trxAddr} <span className="text-emerald-700 font-normal">{t.trxHint}</span></p>
              <div className="mt-1 flex items-start gap-2">
                <span className="font-mono text-[17px] break-all flex-1 text-slate-700" data-testid="energy-trx-address"><BoldDigits text={settings.energy_trx_address} /></span>
                <button onClick={() => copy(settings.energy_trx_address)} className="text-blue-500 p-1 shrink-0"><Copy className="w-5 h-5" /></button>
              </div>
              <p className="mt-2 text-orange-500 font-semibold text-[15px]">{t.trxOnly}</p>
            </div>
            <ol className="space-y-2 text-[15px] text-slate-700 leading-relaxed" data-testid="energy-rules">
              {(settings.energy_rules?.length ? settings.energy_rules.map((r) => [r.title, r.text]) : t.energyRules).map(([k, v], i) => (
                <li key={i}><b className="text-slate-900">{i + 1}、{k}：</b>{v}</li>
              ))}
            </ol>
          </div>
        )}
      </section>
    )}

    <section className="px-2 py-2" data-testid="checkout-notes">
      <ol className="space-y-2 text-[15px] leading-relaxed text-slate-700">
        {notes.map(([k, v, link], i) => (
          <li key={k} className="flex gap-1.5"><span>{i + 1}、</span><span><b className="text-slate-900">{k}：</b>{v}{link && <> <a href={link} target="_blank" rel="noreferrer" className="text-blue-500 break-all" data-testid="explorer-link">{link}</a></>}</span></li>
        ))}
      </ol>
    </section>

    <section className="bg-white rounded-2xl shadow-sm px-4 py-4" data-testid="checkout-tutorials">
      <p className="text-slate-700 text-[15px] mb-2">{t.tutorials}</p>
      <ol className="space-y-2 text-[15px]">
        {tutorials.map((tu, i) => (
          <li key={i}>{tu.url ? <a href={tu.url} target="_blank" rel="noreferrer" className="text-blue-500">{i + 1}、{tu.title}</a> : <span className="text-blue-500">{i + 1}、{tu.title}</span>}</li>
        ))}
      </ol>
      {settings?.support_url && <a href={settings.support_url} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm text-blue-500" data-testid="support-link">{t.contact} ↗</a>}
    </section>
  </>);
}
