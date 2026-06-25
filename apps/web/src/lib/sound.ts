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

// --- generative acid-house / EDM engine --------------------------------
// One original, royalty-free engine drives the music. It self-arranges with a
// slow intensity wave so it breathes between PEACEFUL (pads, sparse bass) and
// ENERGETIC (four-on-the-floor kick, full 303-style acid line, hats, builds),
// looping forever without sounding like a fixed loop. `floor` raises the
// minimum energy (the Agents view runs hotter than the home screen).

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(a: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(a.sampleRate * 0.4);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function startEngine(floor: number): () => void {
  const a = ac();
  if (!a) return () => {};

  // master chain: bus → gentle lowpass → soft compressor → out
  const master = a.createGain();
  master.gain.value = 0.0001;
  master.gain.linearRampToValueAtTime(0.22, a.currentTime + 2.5);
  const tone = a.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 9000;
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(tone).connect(comp).connect(a.destination);

  const tempo = 124;
  const stepDur = 60 / tempo / 4; // 16th note
  const ROOTS = [55.0, 43.65, 65.41, 49.0]; // Am – F – C – G (per bar)
  const ACID = [0, 0, 12, 0, 0, 3, 0, 7, 0, 0, 10, 0, 12, 0, 7, 3]; // semitones
  const ACCENT = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];

  const kick = (t: number, vel: number) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.22);
  };
  const hat = (t: number, vel: number) => {
    const s = a.createBufferSource();
    s.buffer = noiseBuffer(a);
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = a.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    s.connect(hp).connect(g).connect(master);
    s.start(t);
    s.stop(t + 0.06);
  };
  const sub = (t: number, f: number, dur: number, vel: number) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.02);
    g.gain.setValueAtTime(vel, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  // TB-303-style squelch: saw → resonant lowpass with a fast filter envelope.
  const acid = (t: number, f: number, dur: number, accent: boolean, inten: number) => {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    const flt = a.createBiquadFilter();
    flt.type = "lowpass";
    flt.Q.value = 10 + 6 * inten;
    const peak = 600 + (accent ? 2400 : 1400) * inten;
    flt.frequency.setValueAtTime(220, t);
    flt.frequency.exponentialRampToValueAtTime(peak, t + 0.02);
    flt.frequency.exponentialRampToValueAtTime(260, t + dur * 0.9);
    const g = a.createGain();
    const vel = (accent ? 0.5 : 0.32) * (0.5 + 0.5 * inten);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(flt).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur);
  };
  const pad = (t: number, freqs: number[], dur: number, vel: number) => {
    freqs.forEach((f, i) => {
      const o = a.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      const flt = a.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = 1200;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(flt).connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  };

  // Slow triangle over 16 bars → gradual build-ups and breakdowns.
  const intensityAt = (bar: number) => {
    const p = ((bar % 16) / 8) % 2;
    const tri = p <= 1 ? p : 2 - p;
    return Math.min(1, floor + (1 - floor) * tri);
  };

  let step = 0;
  let next = a.currentTime + 0.15;

  const scheduleStep = (t: number, gstep: number) => {
    const bar = Math.floor(gstep / 16);
    const s = gstep % 16;
    const inten = intensityAt(bar);
    const root = ROOTS[bar % 4];

    if (inten >= 0.5) {
      if (s % 4 === 0) kick(t, 0.9);
    } else if (s === 0) {
      kick(t, 0.4 + 0.4 * inten);
    }
    if (inten >= 0.55 && s % 2 === 1) hat(t, 0.18 + 0.14 * inten);
    else if (s === 8) hat(t, 0.08);
    if (s % 8 === 0) sub(t, root, stepDur * 7, 0.5 * (0.4 + 0.6 * inten));

    const playAcid = inten >= 0.6 || s % 2 === 0;
    if (playAcid) acid(t, root * 2 * Math.pow(2, ACID[s] / 12), stepDur * 0.9, ACCENT[s] === 1, inten);

    if (s === 0 && inten < 0.7) {
      const third = root * Math.pow(2, 3 / 12);
      const fifth = root * Math.pow(2, 7 / 12);
      pad(t, [root * 2, third * 2, fifth * 2], stepDur * 16, 0.05 * (1 - inten) + 0.02);
    }
    if (inten > 0.8 && (s === 6 || s === 14)) {
      acid(t, root * 4 * Math.pow(2, ACID[s] / 12), stepDur * 1.5, true, inten);
    }
  };

  const timer = setInterval(() => {
    const a2 = ac();
    if (!a2) return;
    while (next < a2.currentTime + 0.12) {
      scheduleStep(next, step);
      next += stepDur;
      step++;
    }
  }, 25);

  return () => {
    clearInterval(timer);
    const now = a.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0.0001, now + 1.2);
    setTimeout(() => {
      try {
        master.disconnect();
        tone.disconnect();
        comp.disconnect();
      } catch {
        /* ignore */
      }
    }, 1300);
  };
}

/** Switch tracks. `enabled=false` stops all music. Safe to call repeatedly.
 *  Both tracks use the generative engine; the Agents view runs hotter. */
export function setMusicTrack(track: MusicTrack, enabled: boolean): void {
  const desired = enabled ? track : null;
  if (desired === currentTrack) return;
  if (stopCurrent) {
    stopCurrent();
    stopCurrent = null;
  }
  currentTrack = desired;
  if (desired === "ambient") stopCurrent = startEngine(0.12);
  else if (desired === "agency") stopCurrent = startEngine(0.5);
}
