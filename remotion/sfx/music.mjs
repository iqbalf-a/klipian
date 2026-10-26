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
};

mkdirSync(OUT, { recursive: true });
for (const name of Object.keys(MUSIC)) {
  if (!makers[name]) throw new Error(`no maker for the bed "${name}"`);
  const buf = normalise(makers[name]());
  writeWav(path.join(OUT, `${name}.wav`), [buf], SR);
  console.log(`${name.padEnd(10)} ${(buf.length / SR).toFixed(1)}s`);
}
