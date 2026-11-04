/* Fakta seru tentang cegukan yang jarang diketahui — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tips and the loop-back outro. Everything is read from the beats and the words of the narration, so the picture follows the voice.
   Colours come from src/tokens.ts; easings and springs from src/motionLanguage.ts (must 3 of B16).
   B25 (motion density): each explain beat gets a circle insert (IsoBrain or IsoHeart on its own), so each beat has its own picture and something new comes every 3 to 4 seconds. */
import type { StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { textWidthEstimate } from "../../src/layout.ts";

export type Plan = ReturnType<typeof makePlan>;

export function makePlan(story: StoryT) {
  const seq = sequencePlan(story);
  const B: Record<string, { a: number; b: number }> = {};
  seq.forEach((p) => { B[p.beat.id] = { a: p.from / FPS, b: (p.from + p.beatFrames) / FPS }; });
  const total = seq.reduce((n, p) => n + p.beatFrames, 0) / FPS;
  const beat = (id: string) => B[id] ?? { a: 0, b: total };

  const sting = beat("sting").a;
  const stingEnd = beat("sting").b;
  const outro = beat("outro").a;

  const m = { sting, stingEnd, outro, end: total };

  // the loop: from the outro on, eases to t = 0 so the last frame is the first one's
  const LOOP_EASE = Math.min(1.6, total - outro);
  const sm = (k: number) => k * k * (3 - 2 * k);
  const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
  const loopWeight = (t: number) => sm(ramp(t, outro, LOOP_EASE));

  // the HERO point: where the brain / insert object stands (under the top text, above captions)
  const HERO: [number, number] = [540, 980];
  // the insert origin (where the circle opens from)
  const originX = 540, originY = 980;

  // tops: the kicker and banner for each non-sting, non-outro beat
  const KICKER: Record<string, string> = { hook: "FAKTA SERU", normal: "PENYEBABNYA", result: "REKOR", tips: "TIPS" };
  const tops = story.beats
    .filter((b) => b.kind !== "sting" && b.kind !== "outro")
    .map((b) => ({ a: beat(b.id).a, b: beat(b.id).b, kicker: b.kicker ?? KICKER[b.kind] ?? "", headline: b.headline ?? b.text }));

  // the sting pill (the "Intip yuk!" label on the yellow pill)
  const stingBeat = story.beats.find((b) => b.kind === "sting");
  const stingPill = stingBeat?.scene.items.flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? "Intip yuk!";
  const pillW = textWidthEstimate(stingPill, 56) + 60;
  const rowW = 220 + 24 + pillW, rowX = 540 - rowW / 2;
  const STING = { mx: rowX + 110, my: 1420, mw: 220, px: rowX + 220 + 24 + pillW / 2, py: 1420, fs: 56, pillW };

  return {
    m, total, beat, loopWeight, tops, stingPill, STING, HERO, originX, originY,
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h). klipian's report measures its share of the width (60 to 70 %). */
export const HERO_BOX_AT = (_t: number) => ({ x: 189, y: 629, w: 702, h: 702 });
