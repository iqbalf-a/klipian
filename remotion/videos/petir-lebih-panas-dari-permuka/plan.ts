/* Petir lebih panas dari permukaan matahari: the timing of the video (pure, no React). One street-city set (a plaza slab with buildings, a lightning mast and
   a storm cloud over it), one hero (the lightning bolt) and one continuous camera (CAM). Every moment that something appears is named in `T`; index.tsx (the
   picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video. The first frame is the last (the loop). */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";
import { cam2At, toScreen } from "../../src/iso.ts";

/** The named moments (beats: hook 0, sting 3, arus 4, panas 13, matahari 22, banding 30, dentum 39, singkat 47, outro 56). */
export const T = {
  push: 1.6,
  strikes: [1.0, 6.0, 9.6, 14.2, 40.0, 48.0],       // the six times the bolt strikes: the hook's quick one, two in "arus", one in "panas", the thunder one, the short one
  glowA: 6.2, glowAEnd: 12.4,                       // the air in the channel glows blue-white after the first strike
  gaugeA: 14.6, gaugeAFull: 18.0, lblA: 17.6,       // the red gauge of the bolt's air grows to its mark
  gaugeB: 23.0, gaugeBFull: 24.4, sun: 24.6, lblB: 25.6,   // the sun's gauge, the same scale
  seg: [31.4, 32.2, 33.0, 33.8], lblX5: 35.2, line: 34.6,  // four more sun-gauge pieces stack up: about five
  rings: [40.3, 41.1, 41.9], shake: 40.3,           // the air around the channel jumps outward: thunder
  cool: 49.0, coolEnd: 54.2, lblUs: 48.6, lblCool: 51.0,   // the channel cools, the gauge drops
  gone: 55.4,                                       // every state is back to its first value
} as const;

/** The camera keys: x, y, zoom. First and last key are the same wide shot, so the video loops. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 1000, zoom: 0.5 }, { t: 1.6, x: 540, y: 1000, zoom: 0.5 }, { t: 3.0, x: 540, y: 880, zoom: 1.05 },
  { t: 4.0, x: 540, y: 880, zoom: 1.05 }, { t: 12.8, x: 540, y: 740, zoom: 1.28 },
  { t: 14.0, x: 700, y: 1050, zoom: 1.15 }, { t: 21.6, x: 720, y: 1040, zoom: 1.18 },
  { t: 23.0, x: 900, y: 1170, zoom: 1.5 }, { t: 29.4, x: 880, y: 1150, zoom: 1.56 },
  { t: 31.0, x: 800, y: 1090, zoom: 1.0 }, { t: 38.4, x: 800, y: 1090, zoom: 1.05 },
  { t: 40.0, x: 540, y: 870, zoom: 0.9 }, { t: 46.4, x: 540, y: 860, zoom: 0.97 },
  { t: 48.0, x: 540, y: 740, zoom: 1.2 }, { t: 50.8, x: 700, y: 1050, zoom: 1.1 }, { t: 55.0, x: 700, y: 1050, zoom: 1.1 },
  { t: 56.5, x: 540, y: 1000, zoom: 0.5 }, { t: 60, x: 540, y: 1000, zoom: 0.5 },
];

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame: the storm cloud over the mast, with the bolt between (in the wide shot it sits in the middle third). */
export const HERO_BOX_AT = (t: number) => {
  const cam = cam2At(CAM, t), c = toScreen(cam, [540, 640]);
  return { x: c[0], y: c[1], w: Math.min(730, 700 * cam.zoom), h: 520 * cam.zoom };
};
