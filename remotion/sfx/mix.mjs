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

// ---------------------------------------------------------------------------------------------------------------------------------------
// the whole soundtrack: sound effects + music bed + the narration, with the bed and the effects ducked under the voice (P28-P)
// ---------------------------------------------------------------------------------------------------------------------------------------
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MUSIC } from "../src/catalog.ts";

const MUSIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "music");
export const VOICE_PEAK = 0.7;                         // the narration is levelled to this peak (-3 dBFS), the effects' ceiling is 0.5 (-6 dBFS)
export const FINAL_CEILING = 0.92;                     // nothing the listener hears goes past this

/** A music bed (mono, 24 s loop): made by sfx/music.mjs when it is not there yet (the wavs are not in git). */
export function musicBed(name) {
  const f = path.join(MUSIC_DIR, `${name}.wav`);
  if (!existsSync(f)) {
    const r = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "music.mjs")], { stdio: "ignore" });
    if (r.status !== 0 || !existsSync(f)) throw new Error(`the music bed "${name}" could not be made`);
  }
  return readWav(f).channels[0];
}

/** Where a voice is speaking: [from, to] seconds, from the loudness of the narration (windows of 50 ms), gaps shorter than `joinGap` closed. */
export function voiceSegments(samples, rate = SR, { threshold = 0.02, window = 0.05, joinGap = 0.35, minLen = 0.1 } = {}) {
  const w = Math.max(1, Math.round(window * rate)), out = [];
  let from = null, last = 0;
  for (let i = 0; i + w <= samples.length; i += w) {
    let e = 0;
    for (let k = i; k < i + w; k++) e += samples[k] * samples[k];
    const t = i / rate;
    if (Math.sqrt(e / w) > threshold) { if (from === null) from = t; last = t + window; }
    else if (from !== null && t - last > joinGap) { if (last - from >= minLen) out.push([from, last]); from = null; }
  }
  if (from !== null && last - from >= minLen) out.push([from, last]);
  return out;
}

/** The narration as one mono track at the video's sample rate: a stereo file is folded down, the peak is set to VOICE_PEAK, and it is cut at `total`. */
export function loadVoice(file, total) {
  const { channels, rate } = readWav(file);
  if (rate !== SR) throw new Error(`${file} is ${rate} Hz, not ${SR}: klipian converts a narration to 48 kHz when it is imported`);
  const n = Math.min(channels[0].length, Math.round(total * SR)), mono = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { let v = 0; for (const c of channels) v += c[i]; mono[i] = v / channels.length; peak = Math.max(peak, Math.abs(mono[i])); }
  if (peak > 0) for (let i = 0; i < n; i++) mono[i] *= VOICE_PEAK / peak;
  return mono;
}

/** events: planned sound effects; opts: { voice: Float32Array|null, music: { name, level } | null, duckDb }. Returns { channels, peak, rms, rate, segments }.
    With a voice the effects go down under it (-9 dB), the bed sits at MUSIC[name].level (about 12 dB under it) and goes down a little more while it speaks;
    without a voice the bed is louder (MUSIC[name].solo). */
export function mixTrack(events, totalSeconds, opts = {}) {
  const n = Math.round(totalSeconds * SR), voice = opts.voice ?? null;
  const segments = voice ? voiceSegments(voice) : [];
  const fx = mixEvents(events, totalSeconds, { duck: { voice: segments, db: opts.duckDb ?? -9 } });
  const left = fx.channels[0], right = fx.channels[1];
  if (opts.music && opts.music.name !== "none") {
    const bed = musicBed(opts.music.name), spec = MUSIC[opts.music.name];
    const gain = (voice ? spec.level : spec.solo) * (opts.music.level ?? 1), fade = Math.round(1.2 * SR);
    const env = duckEnvelope(n, segments, { db: -4, attack: 0.1, release: 0.5 });
    for (let i = 0; i < n; i++) {
      const v = bed[i % bed.length] * gain * env[i] * Math.min(1, i / fade, (n - i) / fade);
      left[i] += v; right[i] += v;
    }
  }
  if (voice) for (let i = 0; i < voice.length; i++) { left[i] += voice[i]; right[i] += voice[i]; }
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    left[i] = softLimit(left[i], FINAL_CEILING); right[i] = softLimit(right[i], FINAL_CEILING);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); sum += left[i] * left[i] + right[i] * right[i];
  }
  return { channels: [left, right], peak, rms: Math.sqrt(sum / (2 * n)), rate: SR, segments };
}
