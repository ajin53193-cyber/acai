import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Calculator } from "lucide-react";
import { API } from "@/lib/api";
import { toFullUrl } from "@/components/ImageUpload";
import { bannerCtaForImage, PromoActionBanner } from "@/components/PromoCustomerService";

export const isExternal = (link) => /^https?:\/\//i.test(link || "");

// 85折后每 1 HKD 面值的买入 USDT 成本（gogo589）；9折×实时汇率后每 1 HKD 的核销人民币（闲礼会馆）
const BUY_USDT_PER_HKD = 0.1087;   // 1000 HKD → $108.70
const SELL_RMB_PER_HKD = 0.76509;  // 1000 HKD → ¥765.09（1 HKD≈¥0.8501 × 9折）
const DEFAULT_USDT_CNY = 6.65;     // USDT→人民币参考汇率（可在计算器内调整）
const PRESETS = [200, 500, 1000, 5000, 8000];

export const GiftCardCalculator = () => {
  const [face, setFace] = useState(1000);
  const [rate, setRate] = useState(DEFAULT_USDT_CNY);
  const [liveRate, setLiveRate] = useState(false);

  useEffect(() => {
    axios.get(`${API}/rates/usdt-cny`)
      .then((res) => {
        if (res.data?.rate) {
          setRate(res.data.rate);
          setLiveRate(res.data.source !== "fallback");
        }
      })
      .catch(() => {});
  }, []);

  const val = Number(face) || 0;
  const r = Number(rate) || 0;
  const buyUsdt = val * BUY_USDT_PER_HKD;
  const buyRmb = buyUsdt * r;
  const sellRmb = val * SELL_RMB_PER_HKD;
  const netRmb = sellRmb - buyRmb;
  const roi = buyRmb > 0 ? (netRmb / buyRmb) * 100 : 0;
  const fmt = (n) => Number(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const profit = netRmb >= 0;

  return (
    <section className="mt-8 rounded-2xl border-2 border-[#D4AF37]/60 bg-gradient-to-b from-[#FFFBEF] to-white p-5 shadow-[0_6px_24px_rgba(212,175,55,0.18)]" data-testid="giftcard-calculator">
      <div className="flex items-center gap-2 text-base font-bold text-slate-900">
        <Calculator size={18} className="text-[#C8961E]" /> 收益计算器
      </div>
      <p className="mt-1 text-xs text-slate-400">输入礼品卡面值与 USDT 汇率，自动算出净赚多少人民币</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFace(p)}
            data-testid={`calc-preset-${p}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              Number(face) === p ? "bg-[#D4AF37] text-[#1B1403]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            HK${p}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">礼品卡面值（HKD）</label>
          <input
            type="number" min="0" inputMode="numeric" value={face}
            onChange={(e) => setFace(e.target.value)} data-testid="calc-face-input"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-[#D4AF37]"
            placeholder="如 1000"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            USDT 汇率（1 USDT = ? ¥）
            {liveRate && <span className="rounded-full bg-[#E9F9EE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E7A3D]" data-testid="calc-rate-live">实时</span>}
          </label>
          <input
            type="number" min="0" step="0.01" inputMode="decimal" value={rate}
            onChange={(e) => setRate(e.target.value)} data-testid="calc-rate-input"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-[#D4AF37]"
            placeholder="如 6.65"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3.5" data-testid="calc-buy-cost">
          <div className="text-xs text-slate-400">买入成本（gogo589 · 85折）</div>
          <div className="mt-1 text-lg font-black text-slate-900">${fmt(buyUsdt)} <span className="text-xs font-semibold text-slate-400">USDT</span></div>
          <div className="mt-0.5 text-xs text-slate-400">≈ ¥{fmt(buyRmb)}</div>
        </div>
        <div className="rounded-xl bg-[#FFF6D8] p-3.5" data-testid="calc-sell-get">
          <div className="text-xs text-[#8A6A12]">核销实得（闲礼会馆 · 9折）</div>
          <div className="mt-1 text-lg font-black text-[#B8860B]">¥{fmt(sellRmb)}</div>
        </div>
      </div>

      <div className={`mt-3 rounded-xl p-4 text-center ${profit ? "bg-[#E9F9EE]" : "bg-[#FDECEC]"}`} data-testid="calc-net-profit">
        <div className={`text-xs ${profit ? "text-[#1E7A3D]" : "text-[#C0392B]"}`}>预计净赚人民币（核销实得 − 买入成本折¥）</div>
        <div className={`mt-1 text-3xl font-black ${profit ? "text-[#1E7A3D]" : "text-[#C0392B]"}`} data-testid="calc-net-value">
          {profit ? "+" : ""}¥{fmt(netRmb)}
        </div>
        <div className={`mt-0.5 text-xs font-semibold ${profit ? "text-[#1E7A3D]" : "text-[#C0392B]"}`}>
          收益率约 {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        核销实得为人民币（1 HKD≈¥0.8501×9折）；买入用 USDT 付款，USDT 汇率每日自动更新（也可手动调整）。折扣与汇率随市场浮动，实际收益以平台操作当时的实时价格为准。
      </p>
    </section>
  );
};

// 代理分佣：一级 0.7% / 二级 0.3%
const L1_RATE = 0.007;
const L2_RATE = 0.003;
const L1_PRESETS = [10000, 50000, 100000, 500000];

export const AgentCommissionCalculator = () => {
  const [l1, setL1] = useState(100000); // 一级（直接邀请）月核销额
  const [l2, setL2] = useState(0);      // 二级（团队再邀请）月核销额
  const v1 = Number(l1) || 0;
  const v2 = Number(l2) || 0;
  const c1 = (v1 * L1_RATE).toFixed(2);
  const c2 = (v2 * L2_RATE).toFixed(2);
  const total = (v1 * L1_RATE + v2 * L2_RATE).toFixed(2);
  const fmt = (n) => Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 });

  return (
    <section className="mt-8 rounded-2xl border-2 border-[#D4AF37]/60 bg-gradient-to-b from-[#FFFBEF] to-white p-5 shadow-[0_6px_24px_rgba(212,175,55,0.18)]" data-testid="agent-calculator">
      <div className="flex items-center gap-2 text-base font-bold text-slate-900">
        <Calculator size={18} className="text-[#C8961E]" /> 代理收益计算器
      </div>
      <p className="mt-1 text-xs text-slate-400">输入团队每月核销金额，估算你的两级佣金（一级 0.7% / 二级 0.3%）</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {L1_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setL1(p)}
            data-testid={`agent-preset-${p}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              Number(l1) === p ? "bg-[#D4AF37] text-[#1B1403]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {fmt(p)}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-500">一级好友（直接邀请）月核销额</label>
      <input
        type="number" min="0" inputMode="numeric" value={l1}
        onChange={(e) => setL1(e.target.value)} data-testid="agent-l1-input"
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-[#D4AF37]"
        placeholder="如 100000"
      />

      <label className="mt-3 block text-xs font-medium text-slate-500">二级团队（好友再邀请）月核销额</label>
      <input
        type="number" min="0" inputMode="numeric" value={l2}
        onChange={(e) => setL2(e.target.value)} data-testid="agent-l2-input"
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-[#D4AF37]"
        placeholder="如 300000"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3.5" data-testid="agent-c1">
          <div className="text-xs text-slate-400">一级佣金（0.7%）</div>
          <div className="mt-1 text-lg font-black text-slate-900">{fmt(c1)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3.5" data-testid="agent-c2">
          <div className="text-xs text-slate-400">二级佣金（0.3%）</div>
          <div className="mt-1 text-lg font-black text-slate-900">{fmt(c2)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#FFF6D8] p-3.5 text-center" data-testid="agent-total">
        <div className="text-xs text-[#8A6A12]">预计月佣金合计</div>
        <div className="mt-1 text-2xl font-black text-[#B8860B]">{fmt(total)}</div>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        金额按平台核销结算口径计算，佣金比例与结算规则以平台实时政策为准。
      </p>
    </section>
  );
};


export const Block = ({ block, index }) => {
  if (block.type === "calculator") {
    return block.text === "agent"
      ? <AgentCommissionCalculator key={index} />
      : <GiftCardCalculator key={index} />;
  }
  if (block.type === "heading") {
    return (
      <h2 className="mt-8 border-l-4 border-[#D4AF37] pl-3 text-lg font-bold text-slate-900 md:text-xl" data-testid={`promo-block-${index}`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "image") {
    const cta = bannerCtaForImage(block.image);
    if (cta) {
      return (
        <PromoActionBanner
          key={index}
          img={toFullUrl(block.image)}
          alt={block.text || cta.text}
          cta={cta}
          caption={block.text}
        />
      );
    }
    return (
      <figure className="mt-5" data-testid={`promo-block-${index}`}>
        <img src={toFullUrl(block.image)} alt={block.text || `图 ${index + 1}`} loading="lazy" decoding="async" className="w-full rounded-xl border border-slate-200 shadow-sm" />
        {block.text && <figcaption className="mt-3 text-center text-base font-semibold text-slate-700 md:text-lg">{block.text}</figcaption>}
      </figure>
    );
  }
  if (block.type === "button") {
    const cls = "mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FFE896] to-[#D4AF37] py-3.5 text-sm font-bold text-[#1B1403] shadow-[0_6px_20px_rgba(212,175,55,0.35)] transition-transform active:scale-[0.98]";
    return isExternal(block.link) ? (
      <a href={block.link} target="_blank" rel="noopener noreferrer" className={cls} data-testid={`promo-block-${index}`}>
        {block.text} <ArrowRight size={16} />
      </a>
    ) : (
      <Link to={block.link || "/"} className={cls} data-testid={`promo-block-${index}`}>
        {block.text} <ArrowRight size={16} />
      </Link>
    );
  }
  return (
    <div className="mt-4 space-y-3" data-testid={`promo-block-${index}`}>
      {(block.text || "").split("\n").filter((p) => p.trim()).map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-slate-700">{p}</p>
      ))}
    </div>
  );
};

