// node sfx/synth.mjs  ->  sfx/wav/<name>.wav
//
// Every sound effect of the videos, made from nothing: sines, noise and filters in this file, no samples, no services, no licences to
// carry (see LICENSES.md). Deterministic: the noise comes from a fixed-seed generator, so running it again gives identical files.
// Each file is mono, 48 kHz, 16-bit, normalised to a 0.9 peak; how loud it is in a video is the table SFX in src/catalog.ts.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SFX, SFX_SAMPLE_RATE as SR } from "../src/catalog.ts";
import { writeWav } from "./wav.mjs";

const TAU = Math.PI * 2;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "wav");

function rng(seed) {                         // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const noiseOf = (seed) => { const r = rng(seed); return () => r() * 2 - 1; };

const make = (dur, fn) => { const n = Math.round(dur * SR), b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = fn(i / SR, i); return b; };
const sine = (f, t) => Math.sin(TAU * f * t);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** A state-variable band-pass over noise whose centre moves: fc(t) in Hz, q the quality factor. */
function bandpass(noise, fc, q) {
  let low = 0, band = 0;
  return (t) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc(t), SR * 0.2)) / SR), x = noise();
    low += f * band; const high = x - low - band / q; band += f * high;
    return band;
  };
}
const lowpass1 = (fc) => { let y = 0; const a = 1 - Math.exp((-TAU * fc) / SR); return (x) => (y += a * (x - y)); };
/** Two one-pole low-passes in a row (12 dB per octave): noise sounds are rounded off so none of them hisses or is harsh up high. */
const lowpass2 = (fc) => { const a = lowpass1(fc), b = lowpass1(fc); return (x) => b(a(x)); };
const highpass1 = (fc) => { const lp = lowpass1(fc); return (x) => x - lp(x); };

/** A sine whose phase is accumulated from a frequency curve, so a glide has no clicks. Call it once per sample, in order. */
function osc(freq) { let ph = 0; return (t) => { ph += (TAU * freq(t)) / SR; return Math.sin(ph); }; }

const fadeEdges = (b, inMs, outMs) => {
  const a = Math.round((inMs / 1000) * SR), z = Math.round((outMs / 1000) * SR);
  for (let i = 0; i < a && i < b.length; i++) b[i] *= i / a;
  for (let i = 0; i < z && i < b.length; i++) b[b.length - 1 - i] *= i / z;
  return b;
};
const normalise = (b, peak = 0.9) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; };

/** A struck bell (a few inharmonic partials, the high ones dying sooner). */
const bell = (t, start, f, decay) => {
  const x = t - start; if (x < 0) return 0;
  let s = 0; for (const [m, a] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) s += a * sine(f * m, x) * Math.exp(-x * decay * (1 + (m - 1) * 0.35));
  return s * Math.min(1, x / 0.002);
};
/** A plucked, slightly bright note (the jingle). */
const pluck = (t, start, f, decay) => {
  const x = t - start; if (x < 0) return 0;
  return (sine(f, x) + 0.4 * sine(2 * f, x) * Math.exp(-x * 3) + 0.18 * sine(3 * f, x) * Math.exp(-x * 6)) * Math.exp(-x * decay) * Math.min(1, x / 0.002);
};

const recipes = {
  "pop": () => { const n = noiseOf(1), o = osc((t) => 300 + 700 * Math.exp(-t * 35)); return make(0.2, (t) => o(t) * Math.exp(-t * 28) + 0.15 * n() * Math.exp(-t * 400)); },
  "pop-soft": () => { const o = osc((t) => 220 + 380 * Math.exp(-t * 40)); return make(0.18, (t) => o(t) * Math.exp(-t * 30)); },
  "boing": () => {
    const fq = (t) => (180 + 260 * Math.exp(-t * 3.5)) * (1 + 0.18 * Math.sin(TAU * 9 * t) * Math.exp(-t * 3));
    const o = osc(fq), o2 = osc((t) => 2 * fq(t));
    return make(0.6, (t) => (o(t) + 0.4 * o2(t)) * Math.exp(-t * 5.5) * Math.min(1, t / 0.003));
  },
  "whoosh": () => { const d = 0.65, lp = lowpass2(4500), bp = bandpass(noiseOf(2), (t) => 500 + 2800 * Math.pow(Math.sin((Math.PI * t) / d), 1.5), 0.9); return make(d, (t) => lp(bp(t)) * Math.pow(Math.sin((Math.PI * t) / d), 2)); },
  "swish": () => { const d = 0.35, lp = lowpass2(4500), bp = bandpass(noiseOf(3), (t) => 1200 + 2600 * (t / d), 1.2); return make(d, (t) => lp(bp(t)) * Math.pow(Math.sin((Math.PI * t) / d), 1.5)); },
  "swish-soft": () => { const d = 0.3, lp = lowpass2(3500), bp = bandpass(noiseOf(4), (t) => 700 + 1100 * (t / d), 1.0); return make(d, (t) => lp(bp(t)) * Math.pow(Math.sin((Math.PI * t) / d), 1.6)); },
  "zoom-whoosh": () => {
    const d = 0.8, lp = lowpass2(5500), bp = bandpass(noiseOf(5), (t) => 300 * Math.exp(Math.log(5000 / 300) * Math.pow(t / d, 1.4)), 1.1), o = osc((t) => 200 + 1300 * Math.pow(t / d, 2));
    return make(d, (t) => { const x = t / d, env = Math.pow(x, 1.2) * Math.pow(1 - x, 0.4) * 2; return (lp(bp(t)) + 0.25 * o(t)) * env; });
  },
  "glass-ting": () => make(1.0, (t) => (sine(1760, t) * Math.exp(-t * 5) + 0.5 * sine(2637, t) * Math.exp(-t * 8) + 0.22 * sine(4435, t) * Math.exp(-t * 14)) * Math.min(1, t / 0.0015)),
  "tick": () => { const n = noiseOf(6); return make(0.08, (t) => sine(2400, t) * Math.exp(-t * 120) + 0.3 * n() * Math.exp(-t * 900)); },
  "tick-soft": () => make(0.07, (t) => sine(1800, t) * Math.exp(-t * 140)),
  "zip": () => {
    const d = 0.25, o = osc((t) => 700 * Math.exp(Math.log(3200 / 700) * (t / d))), lp = lowpass1(5000);
    return make(d, (t) => lp(o(t) * (0.55 + 0.45 * Math.sign(Math.sin(TAU * 70 * t)))) * Math.pow(Math.sin((Math.PI * t) / d), 0.6));
  },
  "thump": () => { const n = noiseOf(7), lp = lowpass1(500), o = osc((t) => 45 + 110 * Math.exp(-t * 28)); return make(0.35, (t) => o(t) * Math.exp(-t * 11) + 0.35 * lp(n()) * Math.exp(-t * 120)); },
  "rattle": () => {
    const hits = Array.from({ length: 8 }, (_, k) => [k * 0.075 + (k % 2) * 0.006, Math.pow(0.88, k)]), bp = bandpass(noiseOf(8), (t) => 1200 + 1200 * ((t * 37) % 1), 2.5);
    return make(0.65, (t) => { const noise = bp(t); let s = 0; for (const [at, a] of hits) { const x = t - at; if (x >= 0) s += a * (0.6 * sine(300, x) + 0.7 * noise) * Math.exp(-x * 55); } return s; });
  },
  "sizzle": () => {
    const d = 2.5, r = rng(9), n = noiseOf(10), hp = highpass1(2000), lp = lowpass2(4500), grains = [];
    for (let t = 0; t < d; t += 1 / 2000) if (r() < (40 + 360 * Math.pow(t / d, 2)) / 2000) grains.push([t, 0.3 + r() * 0.7, 0.001 + r() * 0.003]);
    let next = 0;                                                  // the grains are sorted by time: only look at the ones that are sounding
    return make(d, (t) => {
      let s = 0.22 * Math.pow(t / d, 2) * n();
      while (next < grains.length && grains[next][0] + grains[next][2] < t) next++;
      for (let k = next; k < grains.length && grains[k][0] <= t; k++) { const [at, a, len] = grains[k]; if (t - at < len) s += a * n() * (1 - (t - at) / len); }
      return lp(hp(s)) * (0.15 + 0.85 * Math.pow(t / d, 1.3));
    });
  },
  "hum": () => make(1.0, (t) => { let s = 0; for (let k = 1; k <= 6; k++) s += sine(100 * k, t) / Math.pow(k, 1.3); return Math.tanh(1.5 * s) * (0.9 + 0.1 * sine(300, t)); }),
  "puff": () => { const lp = lowpass2(2200), bp = bandpass(noiseOf(11), (t) => 700 - 450 * (t / 0.45), 0.7); return make(0.45, (t) => lp(bp(t)) * Math.min(1, t / 0.025) * Math.exp(-t * 7)); },
  "blip-alert": () => make(0.3, (t) => {
    const beep = (at, f) => { const x = t - at; return x < 0 || x > 0.11 ? 0 : (sine(f, x) + 0.3 * sine(3 * f, x)) * Math.exp(-x * 14) * Math.min(1, x / 0.003); };
    return beep(0, 880) + beep(0.13, 1175);
  }),
  "huh": () => {
    const fq = (t) => (380 + 260 * clamp01(t / 0.18)) * (1 + 0.012 * sine(7, t)), o = osc(fq), o2 = osc((t) => 2 * fq(t));
    return make(0.45, (t) => (o(t) + 0.3 * o2(t)) * Math.exp(-t * 7) * Math.min(1, t / 0.004) + 0.5 * pluck(t, 0.24, 800, 12));
  },
  "slide-whistle-down": () => { const o = osc((t) => (1800 * Math.exp(-t * 2.4) + 250) * (1 + 0.03 * sine(6, t))); return make(0.8, (t) => o(t) * Math.min(1, t / 0.02) * Math.exp(-t * 2.2)); },
  "chime": () => make(1.0, (t) => bell(t, 0, 784, 5) + bell(t, 0.14, 1175, 5)),
  "chime-bright": () => make(1.1, (t) => bell(t, 0, 1047, 4.5) + bell(t, 0.1, 1319, 4.5) + bell(t, 0.2, 1568, 4.2) + 0.3 * bell(t, 0.2, 2093, 6)),
  "squeak": () => { const o = osc((t) => 2300 + 600 * (t / 0.14)); return make(0.14, (t) => o(t) * Math.sin((Math.PI * t) / 0.14)); },
  "click-crack": () => {
    const lp = lowpass2(5500), bp = bandpass(noiseOf(12), () => 3000, 2);
    return make(0.22, (t) => lp(bp(t)) * (Math.exp(-t * 90) + (t > 0.03 ? 0.45 * Math.exp(-(t - 0.03) * 110) : 0)) + 0.6 * sine(350, t) * Math.exp(-t * 60));
  },
  "jingle-sting": () => make(1.3, (t) => pluck(t, 0, 523, 4.5) + pluck(t, 0.12, 659, 4.5) + pluck(t, 0.24, 784, 4.5) + 1.2 * pluck(t, 0.36, 1047, 3)),
  "jingle-outro": () => make(2.2, (t) => {
    let s = 0;
    [[0, 784], [0.18, 659], [0.36, 523], [0.54, 587], [0.72, 659]].forEach(([at, f]) => { s += pluck(t, at, f, 5); });
    [523, 659, 784, 1047].forEach((f) => { s += 0.7 * pluck(t, 1.0, f, 2.2); });
    return s;
  }),
  // pilot 2 (nature): soft rain on a surface, a water drip, a bubble rising (synthesised here, CC0)
  "rain-patter": () => { const lp = lowpass2(4500), bp = bandpass(noiseOf(3), () => 2400, 1.4); return make(0.9, (t) => lp(bp(t)) * (0.35 + 0.65 * Math.abs(Math.sin(TAU * 7 * t + 1.3))) * Math.min(1, t / 0.02)); },
  "drip": () => { const o = osc((t) => 1100 - 700 * Math.min(1, t / 0.12)); return make(0.35, (t) => o(t) * Math.exp(-t * 16) * Math.min(1, t / 0.002)); },
  "bubble-rise": () => { const o = osc((t) => 260 + 520 * Math.min(1, t / 0.6)); return make(0.9, (t) => o(t) * Math.sin(Math.PI * Math.min(1, t / 0.9)) * 0.9); },
};

mkdirSync(OUT, { recursive: true });
for (const name of Object.keys(SFX)) {
  const recipe = recipes[name];
  if (!recipe) throw new Error(`no recipe for the sound "${name}"`);
  const loop = name === "hum";                                     // a loop is exactly periodic: no fades at its edges
  const buf = normalise(fadeEdges(recipe(), loop ? 0 : 1, loop ? 0 : 8));
  writeWav(path.join(OUT, `${name}.wav`), [buf], SR);
  console.log(`${name.padEnd(20)} ${(buf.length / SR).toFixed(2)}s`);
}
