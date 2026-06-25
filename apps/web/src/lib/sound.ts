/**
 * WebAudio-synthesized XMB SFX — no audio assets to ship. Blips for nav,
 * confirm/back chimes, a boot swell, and a toggleable ambient music pad.
 *
 * The AudioContext is created lazily on first user gesture (browser policy).
 */

let ctx: AudioContext | null = null;
let musicNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, durMs: number, type: OscillatorType = "sine", gainPeak = 0.08): void {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = a.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.connect(gain).connect(a.destination);
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.02);
}

export const sfx = {
  move: () => blip(440, 70, "square", 0.05),
  select: () => blip(660, 90, "triangle", 0.06),
  enter: () => {
    blip(523.25, 90, "triangle", 0.07);
    setTimeout(() => blip(783.99, 130, "triangle", 0.07), 70);
  },
  back: () => {
    blip(392, 90, "triangle", 0.06);
    setTimeout(() => blip(261.63, 120, "triangle", 0.06), 60);
  },
  boot: () => {
    [261.63, 329.63, 392, 523.25].forEach((f, i) => setTimeout(() => blip(f, 240, "sine", 0.06), i * 130));
  },
  error: () => blip(160, 200, "sawtooth", 0.05),
};

/** Start/stop a soft two-oscillator ambient pad. */
export function setMusic(on: boolean): void {
  const a = ac();
  if (!a) return;
  if (on && !musicNodes) {
    const gain = a.createGain();
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.02, a.currentTime + 2);
    const freqs = [110, 164.81]; // A2 + E3 drone
    const osc = freqs.map((f) => {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    gain.connect(a.destination);
    musicNodes = { osc, gain };
  } else if (!on && musicNodes) {
    const { osc, gain } = musicNodes;
    gain.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1);
    setTimeout(() => osc.forEach((o) => o.stop()), 1100);
    musicNodes = null;
  }
}
