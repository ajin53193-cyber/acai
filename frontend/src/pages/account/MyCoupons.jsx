import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel } from "./AccountLayout";

function Coupon({ c, format }) {
  const isFixed = c.discount_type !== "percent";
  const dead = c.used || (c.expires_at && c.expires_at < new Date().toISOString());
  const purple = isFixed;
  return (
    <div data-testid={`coupon-card-${c.code}`} className={`relative rounded-2xl border-[3px] p-5 pt-6 ${dead ? "opacity-50" : ""} ${purple ? "border-violet-300 bg-gradient-to-br from-violet-50 to-violet-100" : "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100"}`}>
      <span className={`absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs text-white ${purple ? "bg-violet-500" : "bg-orange-500"}`}>{c.title}</span>
      <div className="flex items-center justify-between">
        <span className={`font-bold text-lg ${purple ? "text-violet-700" : "text-slate-800"}`}>{c.title}</span>
        <span className={`font-head text-3xl font-extrabold ${purple ? "text-violet-600" : "text-red-500"}`}>{isFixed ? <>{c.value} <span className="text-sm">USD$</span></> : <>{c.value} <span className="text-sm">%</span></>}</span>
      </div>
      <div className="mt-3 text-sm text-slate-600">{c.min_order_usd ? `USD$${c.min_order_usd}可用` : "無門檻"}</div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold ${purple ? "bg-violet-200 text-violet-700" : "bg-amber-200 text-amber-800"}`}>{isFixed ? "滿減券" : "折價券"}</span>
        <span className="flex-1 border border-dashed border-amber-300 rounded px-3 py-0.5 text-center text-slate-600">{c.used ? "已使用" : `有效期至：${(c.expires_at || "").slice(0, 10) || "長期有效"}`}</span>
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
    try { await callApi({ method: "POST", url: "/me/coupons/redeem", data: { code } }); toast.success("兌換成功"); setCode(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "兌換失敗"); }
  };

  return (
    <Panel title={<span className="flex items-center gap-4">我的優惠券 <span className="text-sm font-normal text-slate-500">優惠券使用完整攻略: <Link to="/info/coupons" className="text-orange-500 underline">點這裡查看</Link></span></span>} testId="coupons-page"
      right={<div className="flex items-center gap-3"><input data-testid="coupon-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="請輸入優惠券碼" className="h-11 w-64 rounded-full bg-slate-100 px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300" /><button data-testid="coupon-redeem-btn" onClick={redeem} className="h-11 px-5 rounded-full bg-orange-50 text-orange-500 text-sm font-semibold hover:bg-orange-100">立即兌換</button></div>}>
      {list.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm" data-testid="coupons-empty">尚無優惠券，輸入優惠券碼即可領取（試試 <button className="text-orange-500 font-semibold" onClick={() => setCode("GLOBAL2026")}>GLOBAL2026</button> / <button className="text-orange-500 font-semibold" onClick={() => setCode("WELCOME5")}>WELCOME5</button>）</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 pt-3">{list.map((c) => <Coupon key={c.code} c={c} format={format} />)}</div>
      )}
      <div className="mt-12 text-center">
        <Link to="/" data-testid="coupons-use-btn" className="inline-flex h-10 items-center rounded-full bg-orange-100 px-6 text-sm font-semibold text-orange-600 hover:bg-orange-200">立即使用 &gt;&gt;</Link>
        <div className="mt-3 text-sm text-orange-500">優惠券使用Tips：選擇非特價規格，下單到購物車後，在底部優惠券欄勾選使用</div>
      </div>
    </Panel>
  );
}
