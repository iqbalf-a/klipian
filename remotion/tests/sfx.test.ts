/* The sound effects (src/sfx.ts, sfx/synth.mjs, sfx/mix.mjs): `npm test`. The event list follows the motion vocabulary, obeys the rules of
   the mix (cooldowns, at most 3 at once), every sound file exists and fits its table, and the mixed track neither clips nor has harsh
   energy up high, a sound lands on the very sample of its frame, and the duck is a no-op until a voice is given. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_SIMULTANEOUS_SFX, SFX, SFX_MASTER_CEILING, SFX_NAMES, SFX_SAMPLE_RATE as SR, type SfxName } from "../src/catalog.ts";
import { validateStory } from "../src/schema.ts";
import { dissectEvents, dissectSfx, planSfx, storyEvents, storySfx, type SfxEvent } from "../src/sfx.ts";
import { FPS, totalFrames } from "../src/timeline.ts";
import { DISSECT_SECONDS } from "../src/dissectTimeline.ts";
import { FINAL_CEILING, VOICE_PEAK, loadVoice, mixEvents, mixTrack, musicBed, sound, voiceSegments } from "../sfx/mix.mjs";
import { readWav, writeWav } from "../sfx/wav.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const loaded = validateStory(JSON.parse(readFileSync(path.join(ROOT, "stories", "colokan-panas.json"), "utf8")));
assert.ok(loaded.ok, "the story is valid");
const story = loaded.story;
const seconds = totalFrames(story) / FPS;

// --- the files -----------------------------------------------------------------------------------------------------------------------------
for (const name of SFX_NAMES) {
  const { channels, rate } = readWav(path.join(ROOT, "sfx", "wav", `${name}.wav`));
  const peak = Math.max(...channels[0].map(Math.abs));
  yes(rate === SR && channels.length === 1, `${name}: mono, ${SR} Hz`);
  yes(Math.abs(channels[0].length / SR - SFX[name].dur) < 0.011, `${name}: its length (${(channels[0].length / SR).toFixed(3)}s) is the table's ${SFX[name].dur}s`);
  yes(peak > 0.85 && peak < 0.95, `${name}: normalised (peak ${peak.toFixed(2)})`);
  yes(SFX[name].vol > 0 && SFX[name].vol <= 0.7, `${name}: a conservative volume`);
}
// the hum loops without a seam: its end continues into its start
const hum = sound("hum");
yes(Math.abs(hum[hum.length - 1] - hum[0]) < 0.12 && Math.abs(hum[0]) < 0.05, "the hum is periodic: no click where it repeats");

// --- the events of the story -----------------------------------------------------------------------------------------------------------------
const raw = storyEvents(story), plan = storySfx(story);
yes(raw.length > 30, `the story has plenty of events (${raw.length})`);
yes(plan.events.every((e) => Math.abs(e.t * FPS - Math.round(e.t * FPS)) < 1e-9), "every event is on a frame boundary");
yes(plan.events.every((e) => e.t >= 0 && e.t < seconds), "every event is inside the video");
yes(plan.events.every((e) => (SFX_NAMES as readonly string[]).includes(e.name)), "every sound is in the closed list");
const names = new Set(plan.events.map((e) => e.name));
for (const need of ["whoosh", "swish", "zoom-whoosh", "glass-ting", "pop", "boing", "thump", "tick", "zip", "rattle", "sizzle", "hum", "puff", "blip-alert", "huh", "slide-whistle-down", "chime", "jingle-sting", "jingle-outro"] as SfxName[])
  yes(names.has(need), `the story uses "${need}"`);
// every transition that is not a cut makes a sound at its start (the first transition is the wipe into "intip")
const wipe = plan.events.find((e) => e.name === "whoosh");
yes(!!wipe && Math.abs(wipe.t - 3) < 0.02, "the wipe into beat 2 sounds when it starts");
yes(plan.events.some((e) => e.name === "swish" && Math.abs(e.t - 30) < 0.04), "the slide into the tips sounds when it starts");

// cooldowns and the cap on simultaneous sounds hold for the planned list
for (const name of SFX_NAMES) {
  const ts = plan.events.filter((e) => e.name === name).map((e) => e.t);
  for (let i = 1; i < ts.length; i++) yes(ts[i] - ts[i - 1] >= SFX[name].cooldown - 1e-9, `${name}: cooldown kept between ${ts[i - 1]}s and ${ts[i]}s`);
}
const oneShots = plan.events.filter((e) => !(SFX[e.name] as { loop?: boolean }).loop && !(SFX[e.name] as { bed?: boolean }).bed);
for (const e of oneShots) {
  const playing = oneShots.filter((o) => o.t <= e.t + 1e-9 && o.t + SFX[o.name].dur > e.t + 1e-9).length;
  yes(playing <= MAX_SIMULTANEOUS_SFX, `at most ${MAX_SIMULTANEOUS_SFX} sounds at ${e.t}s (${playing})`);
}
// planSfx itself: a burst of the same sound keeps the first, four different sounds at once keep three
const burst = (name: SfxName, t: number): SfxEvent => ({ t, name, vol: 1, why: "x" });
yes(planSfx([burst("pop", 1), burst("pop", 1.03), burst("pop", 1.2)], 5).events.length === 2, "pop, pop within the cooldown, pop later: two sound");
yes(planSfx([burst("boing", 1), burst("thump", 1), burst("whoosh", 1), burst("chime", 1)], 5).events.length === 3, "four at once: three sound");
yes(planSfx([burst("pop", 4.99), burst("pop", 5.5)], 5).events.length === 1, "nothing after the end");

// an item's `sfx` changes or removes the sound of its entrance
const withSfx = (value: string | undefined) => {
  const s = structuredClone(story) as unknown as { beats: { scene: { items: Record<string, unknown>[] } }[] };
  const item = s.beats[0].scene.items.find((i) => i.type === "badge")!;
  if (value) item.sfx = value;
  const v = validateStory(s);
  return v.ok ? v.story : null;
};
const blip = (st: ReturnType<typeof withSfx>) => storyEvents(st!).filter((e) => e.t < 2 && /badge/.test(e.why));
yes(blip(withSfx(undefined))[0].name === "blip-alert", "a '!' badge is an alert blip");
yes(blip(withSfx("pop"))[0].name === "pop", "sfx: pop changes it");
yes(blip(withSfx("none")).length === 0, "sfx: none silences it");
yes(withSfx("kazoo") === null, "a sound that is not in the list is refused by the schema");

// --- Dissect3D -------------------------------------------------------------------------------------------------------------------------------
const dis = dissectSfx();
yes(dis.events.find((e) => e.name === "whoosh")?.t === 0, "Dissect3D: the spin-in whooshes at 0");
yes(dis.events.filter((e) => e.name === "click-crack").length === 2, "the shell splits with two cracks");
yes(dis.events.filter((e) => e.name === "pop-soft").length === 5, "five parts separate");
yes(dis.events.filter((e) => e.name === "tick").length === 6, "six labels tick, the seventh (hot spot) is the alert");
const sizzle = dis.events.find((e) => e.name === "sizzle")!;
yes(Math.abs(sizzle.t + (sizzle.dur ?? 0) - DISSECT_SECONDS) < 1e-9, "the chip's sizzle starts with the heat and ends with the video");
yes(dissectEvents().length === dis.events.length, "no Dissect3D event is dropped");

// --- the mix ---------------------------------------------------------------------------------------------------------------------------------
function fft(re: Float64Array, im: Float64Array): void {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** The share of a signal's energy above `hz`, over 4096-sample Hann windows. */
function shareAbove(x: Float32Array, hz: number): number {
  const N = 4096, cut = Math.round((hz / SR) * N);
  let hi = 0, all = 0;
  for (let s = 0; s + N <= x.length; s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; all += p; if (k >= cut) hi += p; }
  }
  return all ? hi / all : 0;
}

for (const [label, p, secs] of [["colokan-panas", plan, seconds], ["Dissect3D", dis, DISSECT_SECONDS]] as const) {
  const mix = mixEvents(p.events, secs);
  yes(mix.channels[0].length === Math.round(secs * SR), `${label}: the track is exactly as long as the video`);
  yes(mix.peak <= SFX_MASTER_CEILING + 1e-6, `${label}: the peak ${mix.peak.toFixed(3)} stays under the ${SFX_MASTER_CEILING} ceiling (-6 dBFS): no clipping, headroom for a voice`);
  yes(mix.peak > 0.2, `${label}: and it is not silent (peak ${mix.peak.toFixed(3)})`);
  yes(mix.rms > 0.005 && mix.rms < 0.12, `${label}: a modest average level (rms ${mix.rms.toFixed(4)})`);
  yes(mix.channels.every((c) => c.every(Number.isFinite)), `${label}: no NaN`);
  const hi = Math.max(shareAbove(mix.channels[0], 8000), shareAbove(mix.channels[1], 8000));
  yes(hi < 0.04, `${label}: harsh top end is rare: ${(hi * 100).toFixed(2)} % of the energy above 8 kHz`);
}
// each sound on its own is not harsh either
for (const name of SFX_NAMES) {
  if (name === "sizzle") continue;                                        // a sizzle is hiss by nature: it is held low by the table and checked in the mix
  const x = sound(name), padded = new Float32Array(8192); padded.set(x.subarray(0, 8192));
  yes(shareAbove(padded, 9000) < 0.12, `${name}: ${(shareAbove(padded, 9000) * 100).toFixed(1)} % above 9 kHz`);
}

// a sound lands on the very sample of its frame
for (const frame of [0, 1, 37, 90, 241]) {
  const mix = mixEvents([{ t: frame / FPS, name: "pop", vol: 1, why: "x" }], 10), at = Math.round((frame / FPS) * SR);
  const first = mix.channels[0].findIndex((v) => Math.abs(v) > 1e-4);
  yes(at === frame * (SR / FPS), `frame ${frame} is sample ${at}`);
  yes(first >= at && first - at <= 48, `frame ${frame}: the pop starts at sample ${first}, ${first - at} after its frame`);
  yes(mix.channels[0].slice(0, at).every((v) => v === 0), `frame ${frame}: silence before it`);
}
// pan: hard left puts the sound only in the left channel
const panned = mixEvents([{ t: 0, name: "pop", vol: 1, pan: -1, why: "x" }], 1);
yes(Math.max(...panned.channels[0].map(Math.abs)) > 0.1 && Math.max(...panned.channels[1].map(Math.abs)) < 1e-6, "pan -1 is left only");
// a loop lasts as long as its event, with fades at both ends
const hum2 = mixEvents([{ t: 1, name: "hum", vol: 1, dur: 2.5, why: "x" }], 6).channels[0];
yes(Math.abs(hum2[Math.round(0.9 * SR)]) === 0 && Math.abs(hum2[Math.round(3.6 * SR)]) === 0, "the hum is silent before and after its event");
yes(hum2.slice(Math.round(1.5 * SR), Math.round(3 * SR)).some((v) => Math.abs(v) > 0.02), "and audible during it");
// the duck: a no-op without a voice, quieter under one
const loud: SfxEvent[] = [{ t: 0, name: "thump", vol: 1, why: "x" }, { t: 2, name: "thump", vol: 1, why: "y" }];
const plain = mixEvents(loud, 4), none = mixEvents(loud, 4, { duck: { voice: [] } }), ducked = mixEvents(loud, 4, { duck: { voice: [[1.5, 3]] } });
yes(plain.channels[0].every((v, i) => v === none.channels[0][i]), "duck with no voice changes nothing");
const peakIn = (m: ReturnType<typeof mixEvents>, a: number, b: number) => Math.max(...m.channels[0].slice(Math.round(a * SR), Math.round(b * SR)).map(Math.abs));
yes(peakIn(ducked, 2, 2.4) < 0.4 * peakIn(plain, 2, 2.4), "under a voice the effects go down (about -9 dB)");
yes(peakIn(ducked, 0, 0.4) === peakIn(plain, 0, 0.4), "and elsewhere stay as they were");

// --- the whole soundtrack: a voice, a music bed and the effects (P28-P) ---------------------------------------------------------------------------
const maxAbs = (x: ArrayLike<number>): number => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; };
const dir = mkdtempSync(path.join(tmpdir(), "klipian-voice-"));
const speech = new Float32Array(SR * 8);                                // a stand-in for a narration: two bursts of a tone (1-3 s and 4.5-6 s), pauses between
for (let i = 0; i < speech.length; i++) { const t = i / SR; if ((t > 1 && t < 3) || (t > 4.5 && t < 6)) speech[i] = 0.4 * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t)); }
writeWav(path.join(dir, "voice.wav"), [speech], SR);
const voice = loadVoice(path.join(dir, "voice.wav"), 8);
yes(Math.abs(maxAbs(voice) - VOICE_PEAK) < 1e-6, "the narration is levelled to its peak (-3 dBFS)");
yes(loadVoice(path.join(dir, "voice.wav"), 5).length === 5 * SR, "and cut where the video ends");
const segs = voiceSegments(voice);
yes(segs.length === 2 && Math.abs(segs[0][0] - 1) < 0.1 && Math.abs(segs[0][1] - 3) < 0.15 && Math.abs(segs[1][0] - 4.5) < 0.1, `the speaking parts are found: ${JSON.stringify(segs.map((x) => x.map((v) => +v.toFixed(2))))}`);
const hit = (t: number): SfxEvent => ({ t, name: "thump", vol: 1, why: "x" });
const peakAt = (m: ReturnType<typeof mixTrack>, a: number, b: number) => maxAbs(m.channels[0].slice(Math.round(a * SR), Math.round(b * SR)));
// a thump at 3.6 s sits in a pause of the voice (3-4.5 s), a thump at 5 s lands inside the second burst: the second is ducked, the first is not
const alone = mixTrack([hit(3.6), hit(5)], 8, { voice: null }), spoken = mixTrack([hit(3.6), hit(5)], 8, { voice });
const pauseHit = peakAt(spoken, 3.6, 4.0) / peakAt(alone, 3.6, 4.0);
yes(pauseHit > 0.9 && pauseHit < 1.1, `an effect in a pause of the voice is not touched (${pauseHit.toFixed(2)})`);
const duckedAlone = mixTrack([hit(5)], 8, { voice: null }), duckedSpoken = mixTrack([hit(5)], 8, { voice });
const bare = mixTrack([], 8, { voice });
const diff = maxAbs(duckedSpoken.channels[0].slice(Math.round(5.05 * SR), Math.round(5.45 * SR)).map((v, i) => v - bare.channels[0][Math.round(5.05 * SR) + i]));
yes(diff < 0.55 * peakAt(duckedAlone, 5, 5.4), `an effect under the voice is about 9 dB lower (${diff.toFixed(3)} against ${peakAt(duckedAlone, 5, 5.4).toFixed(3)})`);
yes(peakAt(mixTrack([hit(3.6), hit(5)], 8, { voice }), 0, 8) <= FINAL_CEILING + 1e-6, "voice and effects together stay under the final ceiling");
// the bed: 12 dB under the voice, louder alone, and ducked a little more while the voice speaks
for (const track of ["bed-calm", "bed-tech"] as const) {
  const bed = musicBed(track);
  yes(bed.length === 24 * SR, `${track}: a loop of 24 s`);
  yes(Math.abs(bed[bed.length - 1] - bed[0]) < 0.05, `${track}: no click where it repeats`);
  const rmsOf = (m: ReturnType<typeof mixTrack>, a: number, b: number) => { const x = m.channels[0].slice(Math.round(a * SR), Math.round(b * SR)); return Math.sqrt(x.reduce((q, v) => q + v * v, 0) / x.length); };
  const bedAlone = mixTrack([], 8, { voice: null, music: { name: track } }), bedVoiced = mixTrack([], 8, { voice, music: { name: track } });
  const voiceOnly = mixTrack([], 8, { voice });
  const bedPart = rmsOf(bedAlone, 3.2, 4.2), underPart = rmsOf(bedVoiced, 6.5, 7.5);                   // 6.5-7.5: the voice is silent: only the bed
  yes(bedPart > 2.2 * underPart, `${track}: louder alone than under a voice (${bedPart.toFixed(3)} vs ${underPart.toFixed(3)})`);
  const db = 20 * Math.log10(rmsOf(voiceOnly, 1.2, 2.8) / rmsOf(mixTrack([], 8, { voice, music: { name: track } }), 6.5, 7.5));
  yes(db > 10 && db < 40, `${track}: the bed sits ${db.toFixed(0)} dB under the narration (at least 10)`);
  const full = mixTrack([hit(2), hit(7)], 8, { voice, music: { name: track, level: 1 } });
  yes(full.peak <= FINAL_CEILING + 1e-6 && full.peak > 0.5, `${track}: the whole mix stays under ${FINAL_CEILING} (${full.peak.toFixed(2)})`);
  yes(full.channels.every((c) => c.every(Number.isFinite)), `${track}: no NaN`);
}
yes(mixTrack([], 8, { voice, music: { name: "none" } }).peak <= VOICE_PEAK + 1e-3, "no bed: the voice alone, untouched");

console.log(`sfx: ${n} checks ok`);
