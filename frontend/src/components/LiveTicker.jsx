import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { tr } from "@/i18n";

const NAMES = ["***892", "***138", "Chen***", tr("***小花"), "Wong**", "***666", "Lin***", "***520"];
const ITEMS = [tr("1000 DOU+幣"), tr("500 抖幣"), tr("原神 980 結晶"), "Netflix US$30", tr("Bigo 1000 鑽"), tr("Spotify 3個月")];
const TIMES = [tr("剛剛"), tr("1分鐘前"), tr("2分鐘前"), tr("3分鐘前"), tr("5分鐘前")];

function rand(a) {
  return a[Math.floor(Math.random() * a.length)];
}

export default function LiveTicker() {
  const [msg, setMsg] = useState(tr("用戶 {0} 成功充值 {1} · {2}", rand(NAMES), rand(ITEMS), rand(TIMES)));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsg(tr("用戶 {0} 成功充值 {1} · {2}", rand(NAMES), rand(ITEMS), rand(TIMES)));
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-2 text-xs sm:text-sm overflow-hidden">
      <Radio className="h-4 w-4 text-emerald-500 shrink-0 animate-pulse" />
      <span
        className={`text-emerald-700 font-medium transition-all duration-300 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        {msg}
      </span>
    </div>
  );
}
