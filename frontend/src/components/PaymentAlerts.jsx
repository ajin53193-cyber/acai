import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { fmtUSDT } from "@/lib/format";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1174.66, 0.12], [1567.98, 0.24]].forEach(([f, t]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
  } catch { /* audio unsupported */ }
}

export function PaymentAlerts() {
  const [sound, setSound] = useState(() => localStorage.getItem("sf_sound") !== "off");
  const sinceRef = useRef(new Date().toISOString());
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const { data } = await api.get("/notifications/paid", { params: { since: sinceRef.current } });
        if (!alive) return;
        sinceRef.current = data.now;
        if (data.orders.length) {
          if (soundRef.current) playChime();
          data.orders.slice(0, 3).forEach((o) =>
            toast.success(`${o.live ? "链上到账" : "收款成功"} ${fmtUSDT(o.amount_usdt)} USDT`, {
              description: `${o.merchant_name} · ${o.network} · ${o.order_no}`, duration: 8000,
            }));
          if (data.orders.length > 3) toast.info(`另有 ${data.orders.length - 3} 笔订单到账`);
          window.dispatchEvent(new CustomEvent("sf:paid", { detail: data.orders }));
        }
      } catch { /* ignore */ }
    };
    const t = setInterval(poll, 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const toggle = () => {
    const next = !sound; setSound(next);
    localStorage.setItem("sf_sound", next ? "on" : "off");
    if (next) playChime();
  };

  return (
    <button onClick={toggle} data-testid="sound-toggle-btn" title={sound ? "到账提示音：开" : "到账提示音：关"}
      className={`p-2 rounded-md transition-colors ${sound ? "text-emerald-400 hover:bg-emerald-400/10" : "text-slate-500 hover:bg-slate-800"}`}>
      {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}
