import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";
import { tr } from "@/i18n";

function Coupon({ c, format }) {
  const isFixed = c.discount_type !== "percent";
  const dead = c.used || (c.expires_at && c.expires_at < new Date().toISOString());
  const purple = isFixed;
  return (
    <div data-testid={`coupon-card-${c.code}`} className={`relative mt-4 md:mt-5 rounded-xl md:rounded-2xl border-[3px] md:border-[4px] p-1 md:p-[6px] ${dead ? "opacity-50 grayscale-[0.4]" : ""} ${purple ? "border-[#B9A6F2] bg-[#D9CDFF]" : "border-[#F3B74A] bg-[#FFD98A]"}`}>
      <span className={`absolute -top-[22px] md:-top-[26px] left-3 rounded-t-lg px-2.5 md:px-3 py-0.5 md:py-1 text-[11px] md:text-xs font-semibold text-white ${purple ? "bg-violet-500" : "bg-orange-500"}`}>{c.title}</span>
      <div className={`rounded-lg md:rounded-xl px-3.5 py-3 md:px-5 md:py-5 ${purple ? "bg-gradient-to-br from-[#F1ECFF] to-[#E6DDFF]" : "bg-gradient-to-br from-[#FFF6E6] to-[#FFE9C2]"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`font-bold text-[15px] md:text-xl ${purple ? "text-violet-700" : "text-slate-800"}`}>{c.title}</span>
          <span className={`font-head font-extrabold ${purple ? "text-violet-600" : "text-[#E8552B]"}`}>
            <span className="text-2xl md:text-4xl">{c.value}</span> <span className="text-xs md:text-sm text-slate-500 font-semibold">{isFixed ? "USD$" : "%"}</span>
          </span>
        </div>
        <div className="mt-1.5 md:mt-3 text-xs md:text-sm text-slate-600">{c.min_order_usd ? tr("USD${0}可用", c.min_order_usd) : tr("無門檻")}</div>
        <div className="mt-2 md:mt-3 flex items-center gap-2 text-[11px] md:text-xs">
          <span className={`rounded px-2 md:px-2.5 py-0.5 md:py-1 font-semibold ${purple ? "bg-violet-200 text-violet-700" : "bg-[#F6C96B] text-[#7A4A12]"}`}>{isFixed ? tr("滿減券") : tr("折價券")}</span>
          <span className={`flex-1 border border-dashed rounded px-3 py-0.5 md:py-1 text-center text-slate-600 ${purple ? "border-violet-300" : "border-[#E8B45A]"}`}>{c.used ? tr("已使用") : tr("有效期至：{0}", (c.expires_at || "").slice(0, 10) || tr("長期有效"))}</span>
        </div>
      </div>
    </div>
  );
}

export default function MyCoupons() {
  const callApi = useApi();
  const { format } = useCurrency();
  const [list, setList] = useState([]);
  const [code, setCode] = useState("");
  const load = () => callApi({ method: "GET", url: "/me/coupons" }).then((r) => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, [callApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const redeem = async () => {
    if (!code.trim()) return;
    try { await callApi({ method: "POST", url: "/me/coupons/redeem", data: { code } }); toast.success(tr("兌換成功")); setCode(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("兌換失敗")); }
  };

  return (
    <Panel title={tr("我的優惠券")} testId="coupons-page"
      right={<div className="flex items-center gap-2 md:gap-3 min-w-0"><input data-testid="coupon-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={tr("請輸入優惠券碼")} className="h-9 md:h-11 w-36 md:w-64 min-w-0 rounded-full bg-white md:bg-slate-100 px-4 md:px-5 text-xs md:text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400" /><button data-testid="coupon-redeem-btn" onClick={redeem} className="h-9 md:h-11 px-3.5 md:px-5 rounded-full bg-orange-500 md:bg-orange-50 text-white md:text-orange-500 text-xs md:text-sm font-semibold hover:bg-orange-600 md:hover:bg-orange-100 whitespace-nowrap shrink-0">{tr("立即兌換")}</button></div>}>
      <div className="-mt-2 mb-3 px-1 text-xs md:text-sm text-slate-500">{tr("優惠券使用完整攻略:")} <Link to="/article/coupon-faq" data-testid="coupon-guide-link" className="text-orange-500 underline">{tr("點這裡查看")}</Link></div>
      {list.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm" data-testid="coupons-empty">{tr("尚無優惠券，輸入優惠券碼即可領取（試試")} <button className="text-orange-500 font-semibold" onClick={() => setCode("GLOBAL2026")}>GLOBAL2026</button> / <button className="text-orange-500 font-semibold" onClick={() => setCode("WELCOME5")}>WELCOME5</button>）</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5 md:gap-6 pt-1 md:pt-3 max-md:px-0.5">{list.map((c) => <Coupon key={c.code} c={c} format={format} />)}</div>
      )}
      <div className="mt-12 text-center">
        <Link to="/" data-testid="coupons-use-btn" className="inline-flex h-10 items-center rounded-full bg-orange-100 px-6 text-sm font-semibold text-orange-600 hover:bg-orange-200">{tr("立即使用")} &gt;&gt;</Link>
        <div className="mt-3 text-sm text-orange-500">{tr("優惠券使用Tips：選擇非特價規格，下單到購物車後，在底部優惠券欄勾選使用")}</div>
      </div>
    </Panel>
  );
}
