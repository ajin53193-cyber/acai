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

export function celebrate() {
  const colors = ["#f97316", "#fb923c", "#fdba74", "#fbbf24", "#fff7ed"];
  confetti({ particleCount: 90, spread: 72, startVelocity: 42, origin: { y: 0.55 }, colors, scalar: 0.9, zIndex: 9999 });
  setTimeout(() => confetti({ particleCount: 45, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors, zIndex: 9999 }), 160);
  setTimeout(() => confetti({ particleCount: 45, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors, zIndex: 9999 }), 160);
  chime();
}
