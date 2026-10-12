import { Link } from "react-router-dom";
import { Shield, Clock, Headphones, Lock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-white font-black">
                G
              </div>
              <div>
                <div className="font-head font-extrabold text-white">GlobalTopUp</div>
                <div className="text-[10px] text-slate-500">環球充值</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              海外華人首選數字商品與直播幣跨境充值平台。全程人工極速發貨，安全可靠。
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">熱門分類</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/category/douyin" className="hover:text-white">抖音 / DOU+</Link></li>
              <li><Link to="/category/live" className="hover:text-white">直播平台幣</Link></li>
              <li><Link to="/category/game" className="hover:text-white">遊戲點卡</Link></li>
              <li><Link to="/category/vip" className="hover:text-white">影音 VIP</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">幫助中心</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>充值教學</li>
              <li>常見問題</li>
              <li>聯絡客服</li>
              <li className="text-amber-400">無退款政策聲明</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3">支付方式（測試）</h4>
            <div className="flex flex-wrap gap-2">
              {["Credit Card", "Apple Pay", "PayPal", "Crypto"].map((p) => (
                <span key={p} className="text-[10px] bg-white/10 rounded px-2 py-1 text-slate-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10 text-center">
          {[
            [Shield, "官方授權正品"],
            [Clock, "24H 極速發貨"],
            [Headphones, "人工客服支援"],
            [Lock, "安全交易保障"],
          ].map(([Icon, text], i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs text-slate-400">{text}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-8 leading-relaxed">
          溫馨提示：本站所售為虛擬數字商品，由人工作業充值，完成後恕不退款。<br />
          © 2026 GlobalTopUp 環球充值 · 本站為示範項目，支付為測試模式。
        </p>
      </div>
    </footer>
  );
}
