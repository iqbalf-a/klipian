// The mixer: a planned list of sound events (src/sfx.ts) -> one stereo 48 kHz track of the video's length.
//
//  - every event is placed on its exact sample (t is a frame boundary, so a sound lands on its frame);
//  - each sound has its own volume (SFX in src/catalog.ts) times the event's factor, and an optional pan (equal power);
//  - a loop (the hum) is repeated for the event's length with short fades; the file is exactly periodic, so it has no seam;
//  - `duck`: where a voice-over is speaking the effects go down (a no-op while the list of voice segments is empty: P28-C fills it);
//  - a soft-knee limiter keeps the sum below SFX_MASTER_CEILING (-6 dBFS), so a voice-over bus has headroom and nothing clips.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SFX, SFX_MASTER_CEILING, SFX_SAMPLE_RATE as SR } from "../src/catalog.ts";
import { readWav } from "./wav.mjs";

const WAV_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "wav");
const cache = new Map();
export function sound(name) {
  if (!cache.has(name)) {
    const { channels, rate } = readWav(path.join(WAV_DIR, `${name}.wav`));
    if (rate !== SR) throw new Error(`${name}.wav is ${rate} Hz, not ${SR}`);
    cache.set(name, channels[0]);
  }
  return cache.get(name);
}

/** The limiter: linear up to a knee, then a tanh that approaches the ceiling and never passes it. */
export function softLimit(x, ceiling = SFX_MASTER_CEILING) {
  const knee = ceiling * 0.7, a = Math.abs(x);
  if (a <= knee) return x;
  return Math.sign(x) * (knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee)));
}

/** Gain per sample while a voice speaks: `voice` is a list of [from, to] seconds. */
function duckEnvelope(n, voice, { db = -9, attack = 0.08, release = 0.25 } = {}) {
  const env = new Float32Array(n).fill(1);
  if (!voice?.length) return env;
  const low = Math.pow(10, db / 20);
  for (const [from, to] of voice) {
    const a = Math.round((from - attack) * SR), s = Math.round(from * SR), e = Math.round(to * SR), r = Math.round((to + release) * SR);
    for (let i = Math.max(0, a); i < Math.min(n, r); i++) {
      const g = i < s ? 1 + (low - 1) * ((i - a) / (s - a || 1)) : i <= e ? low : low + (1 - low) * ((i - e) / (r - e || 1));
      env[i] = Math.min(env[i], g);
    }
  }
  return env;
}

/** events: [{ t, name, vol, dur?, pan? }] already planned (cooldowns, the cap on simultaneous sounds); totalSeconds: the video's length. */
export function mixEvents(events, totalSeconds, opts = {}) {
  const n = Math.round(totalSeconds * SR), left = new Float32Array(n), right = new Float32Array(n);
  for (const e of events) {
    const src = sound(e.name), spec = SFX[e.name], gain = spec.vol * (e.vol ?? 1);
    const start = Math.round(e.t * SR), len = spec.loop ? Math.round((e.dur ?? spec.dur) * SR) : src.length;
    const pan = Math.max(-1, Math.min(1, e.pan ?? 0)), gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    const fade = spec.loop ? Math.min(Math.round(0.15 * SR), len >> 1) : 0;
    for (let i = 0; i < len && start + i < n; i++) {
      let v = src[i % src.length];
      if (fade) v *= Math.min(1, i / fade, (len - i) / fade);
      left[start + i] += v * gl; right[start + i] += v * gr;
    }
  }
  const env = duckEnvelope(n, opts.duck?.voice, opts.duck);
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    left[i] = softLimit(left[i] * env[i], opts.ceiling); right[i] = softLimit(right[i] * env[i], opts.ceiling);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); sum += left[i] * left[i] + right[i] * right[i];
  }
  return { channels: [left, right], peak, rms: Math.sqrt(sum / (2 * n)), rate: SR };
}
