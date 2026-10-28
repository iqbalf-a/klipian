// node sfx/music.mjs  ->  sfx/music/<name>.wav
//
// The music beds that sit under the narration (src/catalog.ts MUSIC): two loops of 24 s (8 bars at 80 BPM), made from sines and filters in this file,
// so there is no licence to carry (see LICENSES.md). They are written to wrap around: a note that ends after the last sample continues at the first, so the loop
// has no seam. Soft on purpose (low-passed, slow attacks): a bed, not a song. How loud each is in a video is the table MUSIC in the catalog.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MUSIC, SFX_SAMPLE_RATE as SR } from "../src/catalog.ts";
import { writeWav } from "./wav.mjs";

const TAU = Math.PI * 2, BPM = 80, BEAT = 60 / BPM, BAR = 4 * BEAT, LEN = 24;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "music");
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Adds a soft note (sine + a quiet octave, attack and release in seconds) at `start` seconds, wrapping past the end of the loop. */
function note(buf, start, midi, dur, amp, { attack = 0.25, release = 0.6, octave = 0.25, pluck = false } = {}) {
  const n = buf.length, f = hz(midi), total = dur + release, first = Math.round(start * SR);
  for (let i = 0; i < total * SR; i++) {
    const t = i / SR;
    let env = pluck ? Math.exp(-t * 5.5) : Math.min(1, t / attack) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / release));
    if (pluck) env *= Math.min(1, t / 0.004);
    const v = (Math.sin(TAU * f * t) + octave * Math.sin(TAU * 2 * f * t)) * env * amp;
    buf[(first + i) % n] += v;
  }
}

const lowpass = (buf, fc) => {                       // a gentle one-pole low-pass, run twice around the loop so the seam is smooth
  const a = 1 - Math.exp((-TAU * fc) / SR);
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); if (pass === 1) buf[i] = y; }
  return buf;
};
const normalise = (b, peak = 0.9) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; };

// --- the cheerful beds (PLAN-VARIETY stage 1): a struck tone (marimba, bell), a noise burst (clap, shaker) and a seeded random source, so the files
// are deterministic like the others. Each bed is a whole number of bars and wraps at its end (a loop with no seam).
/** A struck tone: an instant attack and an exponential decay (`decay` per second), at `start`, wrapping past the end of the loop. */
function strike(buf, start, midi, amp, decay = 5, octave = 0.15) {
  const n = buf.length, f = hz(midi), first = Math.round(start * SR), len = Math.round(Math.min(2.5, 6 / decay) * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v = (Math.sin(TAU * f * t) + octave * Math.sin(TAU * 2 * f * t) + 0.05 * Math.sin(TAU * 4 * f * t)) * Math.exp(-t * decay) * Math.min(1, t / 0.003) * amp;
    buf[(first + i) % n] += v;
  }
}
/** A seeded random source (0 to 1): the same file every time. */
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
/** A short band-limited noise burst (a clap, a shaker tick) at `start`, with a high-pass so it is not a hiss. */
function burst(buf, start, dur, amp, rand, decay = 40) {
  const n = buf.length, first = Math.round(start * SR), len = Math.round(dur * SR);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const x = rand() * 2 - 1, hp = x - prev * 0.92;
    prev = x;
    buf[(first + i) % n] += hp * Math.exp(-(i / SR) * decay) * amp;
  }
}

const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];        // Am F C G, a bar each, twice around in 8 bars

const makers = {
  "bed-calm": () => {                                 // slow pads and a soft bass: calm, for objects and everyday facts
    const buf = new Float32Array(LEN * SR);
    for (let bar = 0; bar < 8; bar++) {
      const chord = CHORDS[bar % 4], at = bar * BAR;
      chord.forEach((m, k) => note(buf, at + k * 0.02, m + 12, BAR - 0.2, 0.22, { attack: 0.9, release: 1.1 }));
      note(buf, at, chord[0] - 12, BAR - 0.3, 0.3, { attack: 0.4, release: 0.8, octave: 0.1 });
    }
    return lowpass(buf, 1400);
  },
  "bed-tech": () => {                                 // a quiet plucked pattern over a pulse: a little brighter, for machines and electricity
    const buf = new Float32Array(LEN * SR);
    for (let bar = 0; bar < 8; bar++) {
      const chord = CHORDS[bar % 4], at = bar * BAR;
      note(buf, at, chord[0] - 12, BAR - 0.3, 0.3, { attack: 0.3, release: 0.7, octave: 0.1 });
      for (let k = 0; k < 8; k++) note(buf, at + k * (BEAT / 2), chord[[0, 1, 2, 1, 0, 2, 1, 2][k]] + 12, 0.2, 0.2, { pluck: true, octave: 0.15 });
    }
    return lowpass(buf, 2400);
  },
  // cheerful beds: a major or bright mode, faster than 95 BPM, their own progressions (not Am F C G). The loop is a whole number of bars.
  "bed-sunny": () => {                                // C G Am F at 120 BPM: a marimba-like melody, a soft shaker and a bouncy bass, for a cause or an object
    const bpm = 120, beat = 60 / bpm, bar = 4 * beat, eighth = beat / 2, bars = 8, len = bars * bar, buf = new Float32Array(Math.round(len * SR));
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], rand = rng(11);
    for (let b = 0; b < bars; b++) {
      const chord = chords[b % 4], at = b * bar;
      [0, 2, 1, 2, 0, 2, 1, 2].forEach((idx, k) => strike(buf, at + k * eighth, chord[idx] + 12, 0.17, 7));
      [0, 1, 2, 3].forEach((k) => strike(buf, at + k * beat, chord[0] - 12, 0.10, 6, 0.3));
      for (let k = 0; k < 16; k++) burst(buf, at + k * (beat / 4), 0.03, 0.04, rand, 80);
    }
    return lowpass(buf, 4200);
  },
  "bed-bounce": () => {                               // G D Em C at 120 BPM: staccato bass, light claps on the off-beats, a playful melody, for a process or a gadget
    const bpm = 120, beat = 60 / bpm, bar = 4 * beat, bars = 12, len = bars * bar, buf = new Float32Array(Math.round(len * SR));
    const chords = [[55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55]], rand = rng(23);
    for (let b = 0; b < bars; b++) {
      const chord = chords[b % 4], at = b * bar;
      for (let k = 0; k < 4; k++) strike(buf, at + k * beat, chord[0] - 12, 0.10, 9, 0.2);
      [1, 3].forEach((k) => burst(buf, at + k * beat, 0.06, 0.10, rand, 35));
      [0, 2, 1, 2, 0, 2, 1, 2].forEach((idx, k) => strike(buf, at + k * (beat / 2), chord[idx] + 12, 0.18, 6));
    }
    return lowpass(buf, 5000);
  },
  "bed-glow": () => {                                 // D A Bm G at 100 BPM: warm pads and a bell arpeggio, friendly, for everyday objects
    const bpm = 100, beat = 60 / bpm, bar = 4 * beat, eighth = beat / 2, bars = 10, len = bars * bar, buf = new Float32Array(Math.round(len * SR));
    const chords = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];
    for (let b = 0; b < bars; b++) {
      const chord = chords[b % 4], at = b * bar;
      chord.forEach((m, k) => note(buf, at + k * 0.02, m - 12, bar - 0.2, 0.06, { attack: 0.7, release: 1.0 }));
      [0, 1, 2, 1, 2, 1, 0, 1].forEach((idx, k) => strike(buf, at + k * eighth, chord[idx] + 12, 0.11, 2.2, 0.25));
    }
    return lowpass(buf, 3200);
  },
  "bed-curious": () => {                              // Dm C Bb Am at 100 BPM with a Dorian sixth (B natural over Dm): playful, a little mysterious
    const bpm = 100, beat = 60 / bpm, bar = 4 * beat, eighth = beat / 2, bars = 10, len = bars * bar, buf = new Float32Array(Math.round(len * SR));
    const chords = [[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 60, 64]];
    for (let b = 0; b < bars; b++) {
      const chord = chords[b % 4], at = b * bar, arp = [chord[0], chord[1], chord[2], chord[0] + 9];   // the sixth: Dorian
      note(buf, at, chord[0] - 12, bar - 0.2, 0.05, { attack: 0.8, release: 1.0 });
      [0, 3, 1, 2, 3, 1, 2, 0, 3, 1, 2, 3, 1, 2, 0, 3].forEach((idx, k) => strike(buf, at + k * (beat / 4), arp[idx] + 12, 0.09, 6, 0.2));
      for (let k = 0; k < 4; k++) strike(buf, at + k * beat, chord[0] - 12, 0.08, 5, 0.2);
    }
    return lowpass(buf, 2600);
  },
};

mkdirSync(OUT, { recursive: true });
// --preview: the same beds into out/music/ for ian to listen to: the loop as it is, and a 30 s version that plays the loop again and again across the seam
const PREVIEW = process.argv.includes("--preview") ? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out", "music") : null;
if (PREVIEW) mkdirSync(PREVIEW, { recursive: true });
for (const name of Object.keys(MUSIC)) {
  if (!makers[name]) throw new Error(`no maker for the bed "${name}"`);
  const buf = normalise(makers[name]());
  writeWav(path.join(OUT, `${name}.wav`), [buf], SR);
  console.log(`${name.padEnd(10)} ${(buf.length / SR).toFixed(1)}s`);
  if (PREVIEW) {
    writeWav(path.join(PREVIEW, `${name}.wav`), [buf], SR);
    const long = new Float32Array(30 * SR);
    for (let i = 0; i < long.length; i++) long[i] = buf[i % buf.length];
    writeWav(path.join(PREVIEW, `${name}-30s.wav`), [long], SR);
  }
}
