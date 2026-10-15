import confetti from "canvas-confetti";

let audioCtx;

function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const notes = [[523.25, 0], [659.25, 0.12], [783.99, 0.24]]; // C5 E5 G5
    notes.forEach(([f, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const start = ctx.currentTime + t;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      o.start(start);
      o.stop(start + 0.55);
    });
  } catch (e) { /* audio blocked, ignore */ }
}

export function celebrate(origin) {
  const o = origin && typeof origin.x === "number" ? origin : { x: 0.5, y: 0.58 };
  const colors = ["#f97316", "#fb923c", "#fdba74", "#fbbf24", "#fff7ed"];
  confetti({ particleCount: 110, spread: 90, startVelocity: 45, origin: o, colors, scalar: 1, zIndex: 9999 });
  setTimeout(() => confetti({ particleCount: 55, angle: 55, spread: 70, startVelocity: 40, origin: o, colors, zIndex: 9999 }), 150);
  setTimeout(() => confetti({ particleCount: 55, angle: 125, spread: 70, startVelocity: 40, origin: o, colors, zIndex: 9999 }), 150);
  chime();
}
