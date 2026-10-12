import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

const NAMES = ["***892", "***138", "Chen***", "***小花", "Wong**", "***666", "Lin***", "***520"];
const ITEMS = ["1000 DOU+幣", "500 抖幣", "原神 980 結晶", "Netflix US$30", "Bigo 1000 鑽", "Spotify 3個月"];
const TIMES = ["剛剛", "1分鐘前", "2分鐘前", "3分鐘前", "5分鐘前"];

function rand(a) {
  return a[Math.floor(Math.random() * a.length)];
}

export default function LiveTicker() {
  const [msg, setMsg] = useState(`用戶 ${rand(NAMES)} 成功充值 ${rand(ITEMS)} · ${rand(TIMES)}`);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsg(`用戶 ${rand(NAMES)} 成功充值 ${rand(ITEMS)} · ${rand(TIMES)}`);
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
