/**
 * WebAudio-synthesized audio — no asset files. Provides:
 *   - sfx: short UI + moment sound effects (gated by the Sound setting)
 *   - setMusicTrack: a tiny music manager with two looping "tracks"
 *       'ambient' (XMB home pad) and 'agency' (upbeat tycoon loop),
 *       gated by the Music setting. One track plays at a time.
 *
 * The AudioContext is created lazily on first user gesture (browser policy).
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function arpUp(freqs: number[], stepMs: number, type: OscillatorType = "triangle", gainPeak = 0.07): void {
  freqs.forEach((f, i) => setTimeout(() => blip(f, stepMs + 60, type, gainPeak), i * stepMs));
}

export const sfx = {
  // navigation
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
  boot: () => arpUp([261.63, 329.63, 392, 523.25], 130, "sine", 0.06),
  error: () => blip(160, 200, "sawtooth", 0.05),

  // agency "moments"
  work: () => blip(880, 45, "square", 0.025), // soft keystroke tick
  cash: () => {
    // a little cash-register flourish on publish
    arpUp([659.25, 987.77, 1318.51], 70, "triangle", 0.08);
    setTimeout(() => blip(1567.98, 220, "sine", 0.06), 230);
  },
  levelup: () => arpUp([523.25, 659.25, 783.99, 1046.5], 95, "square", 0.07),
  fail: () => {
    blip(311.13, 160, "sawtooth", 0.06);
    setTimeout(() => blip(233.08, 240, "sawtooth", 0.06), 150);
  },
  alert: () => {
    blip(880, 120, "square", 0.06);
    setTimeout(() => blip(880, 120, "square", 0.06), 220);
  },
  stamp: () => blip(523.25, 80, "square", 0.06),
};

// --------------------------------------------------------------------------
// music manager
// --------------------------------------------------------------------------
export type MusicTrack = "ambient" | "agency";

let currentTrack: MusicTrack | null = null;
let stopCurrent: (() => void) | null = null;

function startAmbient(): () => void {
  const a = ac();
  if (!a) return () => {};
  const gain = a.createGain();
  gain.gain.value = 0.0001;
  gain.gain.linearRampToValueAtTime(0.02, a.currentTime + 2);
  const oscs = [110, 164.81].map((f) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  gain.connect(a.destination);
  return () => {
    gain.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.8);
    setTimeout(() => oscs.forEach((o) => o.stop()), 900);
  };
}

function startAgency(): () => void {
  const a = ac();
  if (!a) return () => {};
  const master = a.createGain();
  master.gain.value = 0.0001;
  master.gain.linearRampToValueAtTime(0.05, a.currentTime + 1.5);
  master.connect(a.destination);

  // A bright, loopable 8-step arpeggio over a I–V–vi–IV-ish feel.
  const seq = [392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 493.88];
  const bass = [98.0, 98.0, 110.0, 87.31];
  let step = 0;
  const stepMs = 260;

  const note = (freq: number, dur: number, type: OscillatorType, peak: number) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    const now = a.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + dur + 0.02);
  };

  const tick = () => {
    note(seq[step % seq.length], 0.22, "square", 0.5);
    if (step % 2 === 0) note(bass[(step / 2) % bass.length], 0.45, "triangle", 0.6);
    step++;
  };
  tick();
  const iv = setInterval(tick, stepMs);
  return () => {
    clearInterval(iv);
    master.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.6);
    setTimeout(() => master.disconnect(), 700);
  };
}

/** Switch tracks. `enabled=false` stops all music. Safe to call repeatedly. */
export function setMusicTrack(track: MusicTrack, enabled: boolean): void {
  const desired = enabled ? track : null;
  if (desired === currentTrack) return;
  if (stopCurrent) {
    stopCurrent();
    stopCurrent = null;
  }
  currentTrack = desired;
  if (desired === "ambient") stopCurrent = startAmbient();
  else if (desired === "agency") stopCurrent = startAgency();
}
