// Web-Audio synthesized alert tones (no asset files). Three distinct sounds: order / topup / chat.
const KEY = "admin_sound";
export const loadSoundPrefs = () => { try { return { enabled: true, volume: 0.8, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { enabled: true, volume: 0.8 }; } };
export const saveSoundPrefs = (p) => localStorage.setItem(KEY, JSON.stringify(p));

let ctx = null;
const getCtx = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
export const unlockAudio = () => { try { const c = getCtx(); if (c.state === "suspended") c.resume(); } catch {} };

const tone = (c, master, { f, t0, dur, type = "sine", gain = 1, slide }) => {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + t0 + dur);
  g.gain.setValueAtTime(0, c.currentTime + t0);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur);
  o.connect(g); g.connect(master); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
};

const PATTERNS = {
  order: (c, m) => { tone(c, m, { f: 988, t0: 0, dur: 0.35, gain: 0.9 }); tone(c, m, { f: 784, t0: 0.28, dur: 0.6, gain: 0.9 }); }, // ding-dong
  topup: (c, m) => { [1319, 1760, 2093, 2637].forEach((f, i) => tone(c, m, { f, t0: i * 0.07, dur: 0.22, type: "triangle", gain: 0.7 })); tone(c, m, { f: 3136, t0: 0.3, dur: 0.5, type: "triangle", gain: 0.5 }); }, // coins
  chat: (c, m) => { tone(c, m, { f: 660, t0: 0, dur: 0.12, type: "sine", gain: 0.8, slide: 1320 }); tone(c, m, { f: 1320, t0: 0.13, dur: 0.25, type: "sine", gain: 0.6 }); }, // pop
};

export const playAlert = (kind, prefs = loadSoundPrefs()) => {
  if (!prefs.enabled || !PATTERNS[kind]) return;
  try {
    const c = getCtx();
    if (c.state === "suspended") c.resume();
    const master = c.createGain(); master.gain.value = Math.max(0, Math.min(1, prefs.volume));
    master.connect(c.destination);
    PATTERNS[kind](c, master);
  } catch {}
};
