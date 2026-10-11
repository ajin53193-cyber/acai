import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { LANGS, I18N, TUTORIAL_CONTENT } from "@/lib/checkoutI18n";
import { toast } from "sonner";
import { Copy, Clock, CheckCircle2, XCircle, Loader2, Zap, ChevronDown, ChevronUp, Leaf, X, ExternalLink } from "lucide-react";

function Linkify({ text }) {
  const parts = text.split(/(https?:\/\/[^\s，。）)]+)/g);
  return <>{parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="text-[var(--accent)] break-all">{p}</a> : <span key={i}>{p}</span>)}</>;
}

function TutorialSheet({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose} data-testid="tutorial-sheet">
      <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-[16px]" data-testid="tutorial-title">{item.title}</h3>
          <button onClick={onClose} className="p-1 text-slate-500" data-testid="tutorial-close-btn"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-4 overflow-y-auto text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap" data-testid="tutorial-content"><Linkify text={item.content} /></div>
      </div>
    </div>
  );
}

const NET_STYLE = {
  TRC20: { bg: "bg-red-50", text: "text-red-600", tag: "TRC20" },
  ERC20: { bg: "bg-indigo-50", text: "text-indigo-600", tag: "ERC20" },
  BEP20: { bg: "bg-yellow-50", text: "text-yellow-700", tag: "BEP20" },
};

const Tether = ({ size = 20 }) => (
  <span style={{ width: size, height: size }} className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-white font-bold shrink-0" aria-label="USDT">
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
  return <p className="text-center text-slate-500 text-[16px]" data-testid="checkout-countdown">{t.payWithin} <span className="text-amber-500 font-semibold tabular-nums text-[17px]">{m}:{s}</span> {t.payWithinSuffix}</p>;
}

function Row({ k, v, copyVal, onCopy, testid }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-slate-700 text-[16px]">{k}</span>
      <span className="flex items-center gap-1.5 text-slate-900 font-semibold text-[16px]" data-testid={testid}>{v}
        {copyVal !== undefined && <button onClick={() => onCopy(copyVal)} className="text-[var(--accent)] p-0.5"><Copy className="w-4 h-4" /></button>}
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
  const [tutorial, setTutorial] = useState(null);
  const t = I18N[lang];

  const load = useCallback(() => {
    api.get(`/orders/${orderNo}/public`).then((r) => setOrder(r.data)).catch(() => setNotFound(true));
  }, [orderNo]);
  useEffect(() => { load(); api.get("/checkout/settings").then((r) => setSettings(r.data)).catch(() => setSettings({})); }, [load]);
  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [order, load]);

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

  const subtitle = settings ? (lang === "en" ? settings.brand_subtitle_en : lang === "zh-TW" ? settings.brand_subtitle_tw : settings.brand_subtitle) : "";
  const shell = (inner) => (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-900" data-testid="checkout-page" style={{ colorScheme: "light", "--accent": settings?.theme_color || "#26A17B", fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif" }}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0" data-testid="checkout-brand">
            {settings?.logo_url ? <img src={settings.logo_url} alt="logo" className="w-9 h-9 rounded-lg object-contain" />
              : <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center font-bold text-base shrink-0">{order?.merchant_name?.[0] || "U"}</div>}
            <div className="min-w-0 leading-tight">
              <div className="font-semibold text-[15px] truncate" data-testid="checkout-brand-name">{order?.merchant_name || "USDT"}</div>
              {subtitle && <div className="text-[11px] text-slate-500 truncate" data-testid="checkout-brand-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="relative shrink-0">
            <select value={lang} onChange={(e) => changeLang(e.target.value)} data-testid="checkout-lang-select" className="appearance-none bg-transparent pr-5 text-slate-700 text-[14px] font-medium focus:outline-none">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600" />
          </div>
        </div>
      </header>
      <main className="max-w-md mx-auto px-3 py-3 space-y-3 pb-10">{inner}</main>
    </div>
  );

  if (notFound) return shell(<div className="bg-white rounded-2xl p-10 text-center"><XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" /><p className="text-slate-600">{t.notFound}</p></div>);
  if (!order) return shell(<div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>);

  const amount = order.pay_amount;
  const st = order.status;

  if (st === "paid") return shell(
    <div className="pt-4">
      <style>{`@keyframes sfPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}@keyframes sfRing{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.7);opacity:0}}`}</style>
      <section className="bg-white rounded-2xl shadow-sm px-5 pt-8 pb-6 flex flex-col items-center" data-testid="checkout-success">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-emerald-400" style={{ animation: "sfRing 1.3s ease-out infinite" }} />
          <div className="relative w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg" style={{ animation: "sfPop .55s ease-out" }}>
            <CheckCircle2 className="w-11 h-11 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-4 text-emerald-600 font-bold text-[24px]" data-testid="checkout-status">{t.paid}</div>
        <p className="mt-1 text-slate-500 text-[15px] text-center px-2">{t.successSubtitle}</p>
        <div className="mt-4 flex items-end gap-2">
          <Tether size={26} />
          <span className="text-[40px] font-bold tabular-nums leading-none" data-testid="checkout-pay-amount">{amount}</span>
          <span className="text-slate-400 text-[16px] mb-1">USDT</span>
        </div>
        <div className="mt-5 w-full border-t border-slate-100 pt-0.5">
          <Row k={t.coin} v={<><Tether size={20} /> USDT</>} onCopy={copy} />
          <Row k={t.protocol} v={<><NetBadge n={order.network} /> {order.network}</>} onCopy={copy} />
          <Row k={t.orderNo} v={<span className="font-normal text-slate-500 text-[15px]">{order.order_no}</span>} copyVal={order.order_no} onCopy={copy} testid="success-order-no" />
          {order.tx_id && <Row k={t.txHash} v={<span className="font-mono text-[13px] text-slate-600 max-w-[170px] truncate inline-block align-bottom">{order.tx_id}</span>} copyVal={order.tx_id} onCopy={copy} testid="success-tx-hash" />}
          {order.paid_at && <Row k={t.paidTime} v={<span className="text-[15px] text-slate-600 tabular-nums">{new Date(order.paid_at).toLocaleString(lang === "en" ? "en-US" : "zh-CN")}</span>} onCopy={copy} testid="success-paid-time" />}
        </div>
        {order.tx_url && <a href={order.tx_url} target="_blank" rel="noreferrer" data-testid="success-view-tx" className="mt-4 inline-flex items-center gap-1 text-[var(--accent)] text-[15px] font-medium">{t.viewOnChain} <ExternalLink className="w-4 h-4" /></a>}
        {order.return_url ? (
          <a href={order.return_url} data-testid="success-return-merchant" className="mt-5 w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center text-[16px] shadow-sm active:opacity-90" style={{ background: "var(--accent)" }}>{t.returnMerchant}</a>
        ) : (
          <p className="mt-5 text-center text-slate-400 text-[14px]" data-testid="success-close-hint">{t.closeHint}</p>
        )}
      </section>
    </div>
  );
  const notes = t.notes(order.network, amount, order.explorer_url);
  const tutorials = settings?.tutorial_links?.length
    ? settings.tutorial_links.map((tu, i) => ({ ...tu, content: tu.content || TUTORIAL_CONTENT[i] || "" }))
    : t.defaultTutorials.map((title, i) => ({ title, url: "", content: TUTORIAL_CONTENT[i] }));
  const showEnergy = settings?.energy_enabled && settings?.energy_trx_address && order.network === "TRC20" && st === "pending";

  return shell(<>
    <section className="bg-white rounded-2xl shadow-sm px-4 pt-5 pb-4">
      <div className="flex flex-col items-center">
        {st === "pending" && <><div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center shadow-sm"><Clock className="w-8 h-8 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-amber-500 font-bold text-[20px]" data-testid="checkout-status">{t.pending}</div></>}
        {st === "paid" && <><div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-emerald-600 font-bold text-[20px]" data-testid="checkout-status">{t.paid}</div></>}
        {st === "expired" && <><div className="w-14 h-14 rounded-full bg-slate-400 flex items-center justify-center shadow-sm"><XCircle className="w-8 h-8 text-white" strokeWidth={2.5} /></div><div className="mt-2 text-slate-500 font-bold text-[20px]" data-testid="checkout-status">{t.expired}</div></>}
        <div className="mt-2 flex items-center gap-2">
          <Tether size={26} />
          <span className="text-[40px] font-bold tracking-tight tabular-nums leading-none" data-testid="checkout-pay-amount">{amount}</span>
          <button onClick={() => copy(amount)} data-testid="copy-amount-btn" className="text-[var(--accent)] p-1"><Copy className="w-5 h-5" /></button>
        </div>
        {st === "pending" && <p className="mt-3 text-center text-[17px] text-slate-800 leading-relaxed px-1">{order.live ? t.ensure(amount) : t.ensureSim(amount)}</p>}
        {st === "pending" && <div className="mt-2 w-full"><Countdown expiresAt={order.expires_at} t={t} /></div>}
      </div>

      {st === "pending" && (
        <>
          <div className="mt-4 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[16px]"><NetBadge n={order.network} /> {t.depositAddr(order.network)}</div>
            <div className="mt-2 flex items-start gap-2">
              <span className="text-[18px] leading-snug break-all flex-1 text-slate-800 tracking-tight" data-testid="checkout-address"><BoldDigits text={order.wallet_address} /></span>
              <button onClick={() => copy(order.wallet_address)} data-testid="copy-address-btn" className="text-[var(--accent)] p-1 shrink-0"><Copy className="w-5 h-5" /></button>
            </div>
          </div>
          <p className="mt-2 text-orange-500 text-[15px] font-medium">{t.checkChain(order.network)}</p>
          {!order.live && <p className="mt-1 text-xs text-slate-400">{t.demo}</p>}

          <div className="mt-4 flex flex-col items-center">
            <div className="relative p-2 bg-white rounded-xl border border-slate-100">
              <img src={qrUrl} alt="QR" width={220} height={220} className="rounded" data-testid="checkout-qr" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-white rounded-full p-1"><Tether size={38} /></div></div>
            </div>
            <button onClick={saveQr} data-testid="save-qr-btn" className="mt-2.5 text-[var(--accent)] text-[16px] font-medium">{t.saveQr}</button>
          </div>
        </>
      )}

      {st === "paid" && order.tx_url && <a href={order.tx_url} target="_blank" rel="noreferrer" className="block text-center text-[var(--accent)] text-sm mt-3" data-testid="view-tx-link">{t.viewTx} ↗</a>}

      <div className="mt-4 border-t border-slate-200 pt-0.5">
        <Row k={t.coin} v={<><Tether size={20} /> USDT</>} onCopy={copy} />
        <Row k={t.protocol} v={<><NetBadge n={order.network} /> {order.network}</>} onCopy={copy} />
        <Row k={t.amount} v={<span className="tabular-nums">{amount} USDT</span>} copyVal={amount} onCopy={copy} testid="checkout-row-amount" />
        <Row k={t.orderNo} v={<span className="font-normal text-slate-500 text-[15px]">{order.order_no}</span>} copyVal={order.order_no} onCopy={copy} testid="checkout-row-order-no" />
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
      <section className="bg-[#EEF9EA] rounded-2xl px-4 py-3 ring-2 ring-emerald-400/60 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" data-testid="energy-section">
        <button onClick={() => setEnergyOpen(!energyOpen)} data-testid="energy-toggle-btn" aria-expanded={energyOpen} className="w-full flex items-center justify-between text-[16px] font-medium text-slate-800">
          <span className="flex items-center gap-2"><Leaf className="w-5 h-5 text-emerald-600" /> {t.energyTitle}<span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse" data-testid="energy-save-badge">省70%</span></span>
          {energyOpen ? <ChevronUp className="w-6 h-6 text-[var(--accent)] border-2 border-[var(--accent)] rounded-full p-0.5" /> : <ChevronDown className="w-6 h-6 text-[var(--accent)] border-2 border-[var(--accent)] rounded-full p-0.5" />}
        </button>
        {energyOpen && (
          <div className="mt-3 space-y-3" data-testid="energy-body">
            <p className="text-[14px]"><b>{t.rentFee}</b><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold mx-1">▼</span>{settings.energy_price_text}</p>
            <div className="bg-[#DDF3D6] rounded-xl p-3">
              <p className="text-[14px] font-semibold text-slate-800">{t.trxAddr} <span className="text-emerald-700 font-normal">{t.trxHint}</span></p>
              <div className="mt-1 flex items-start gap-2">
                <span className="font-mono text-[16px] break-all flex-1 text-slate-700 tracking-tight" data-testid="energy-trx-address"><BoldDigits text={settings.energy_trx_address} /></span>
                <button onClick={() => copy(settings.energy_trx_address)} className="text-[var(--accent)] p-1 shrink-0"><Copy className="w-5 h-5" /></button>
              </div>
              <p className="mt-2 text-orange-500 font-semibold text-[14px]">{t.trxOnly}</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="energy-buy-amounts">
                <span className="text-[14px] font-semibold text-slate-800">{t.energyBuyAmount}</span>
                {String(settings?.energy_amounts || "2,4").split(",").map((x) => x.trim()).filter(Boolean).map((a) => (
                  <button key={a} onClick={() => copy(a)} data-testid={`energy-copy-${a}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 text-[13px] font-semibold"><Copy className="w-3.5 h-3.5" />{a} TRX</button>
                ))}
              </div>
            </div>
            <ol className="space-y-2 text-[14px] text-slate-700 leading-relaxed" data-testid="energy-rules">
              {(settings.energy_rules?.length ? settings.energy_rules.map((r) => [r.title, r.text]) : t.energyRules).map(([k, v], i) => (
                <li key={i}><b className="text-slate-900">{i + 1}、{k}：</b>{v}</li>
              ))}
            </ol>
          </div>
        )}
      </section>
    )}

    <section className="px-1 py-1" data-testid="checkout-notes">
      <h3 className="text-[16px] font-semibold text-slate-800 mb-2">{t.notesTitle}</h3>
      <ol className="space-y-1.5 text-[16px] leading-[1.7] text-slate-700">
        {notes.map(([k, v, link], i) => (
          <li key={k} className="flex gap-1"><span className="shrink-0">{i + 1}、</span><span><b className="text-slate-900">{k}：</b>{v}{link && <> <a href={link} target="_blank" rel="noreferrer" className="text-[var(--accent)] break-all" data-testid="explorer-link">{link}</a></>}</span></li>
        ))}
      </ol>
    </section>

    <section className="bg-white rounded-2xl shadow-sm px-4 py-4" data-testid="checkout-tutorials">
      <p className="text-slate-700 text-[16px] mb-2">{t.tutorials}</p>
      <ol className="space-y-2 text-[16px]">
        {tutorials.map((tu, i) => (
          <li key={i}>{tu.url ? <a href={tu.url} target="_blank" rel="noreferrer" className="text-[var(--accent)]">{i + 1}、{tu.title}</a>
            : <button onClick={() => setTutorial(tu)} className="text-[var(--accent)] text-left" data-testid={`tutorial-link-${i}`}>{i + 1}、{tu.title}</button>}</li>
        ))}
      </ol>
      {settings?.support_url && <a href={settings.support_url} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm text-[var(--accent)]" data-testid="support-link">{t.contact} ↗</a>}
    </section>
    <TutorialSheet item={tutorial} onClose={() => setTutorial(null)} />
  </>);
}
