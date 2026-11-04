/* Gurita punya tiga jantung! Kok bisa? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tip and the loop-back outro. Read the beats from the story; do not hard-code the durations.
   One set (B27): a seabed under the sea, the octopus resting on it. The camera is a function of the video's clock (below): a wide shot of the set, the establishing push to the
   main shot, then a push or a pan inside the same set per beat, and the way back to the wide shot in the outro, so the last frame is the first.
   motion-exception: the hook's establishing push (zoom 0.5 to 1.2 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";

/** The octopus in world units (the frame at zoom 1 is 1080 x 1920 and the octopus is about 600 wide). Everything is drawn in these. */
export const WORLD = { cx: 540, cy: 1000, surfaceY: -40, floorY: 1235 } as const;
/** The box of the octopus at rest (x0, y0, x1, y1), world units. */
export const OCTO_BOX = { x0: 240, y0: 650, x1: 840, y1: 1250 } as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** cubic in-out easing, the same curve as src/motion.ts easeInOut (kept here so the plan stays plain Node). */
export const ease = (x: number) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };

type Key = { t: number; z: number; cx: number; cy: number; e: "io" | "lin" };
/** The camera: a world point (cx, cy) at the middle of the screen (540, 960) and a zoom. Hold = two keys with the same values. */
const KEYS: Key[] = [
  { t: 0, z: 0.5, cx: 540, cy: 1120, e: "lin" },
  { t: 1.5, z: 0.5, cx: 540, cy: 1120, e: "lin" },        // the wide shot of the set, 1.5 s
  { t: 2.9, z: 1.2, cx: 540, cy: 960, e: "io" },           // the establishing push: the octopus is 60 to 70 % of the width
  { t: 4, z: 1.22, cx: 540, cy: 950, e: "lin" },           // sting: the world keeps moving
  { t: 11, z: 1.5, cx: 540, cy: 880, e: "lin" },           // utama: a slow push to the main heart (0.04 zoom a second)
  { t: 13, z: 1.5, cx: 470, cy: 915, e: "io" },            // insang: pan to the left gill
  { t: 14.5, z: 1.58, cx: 470, cy: 915, e: "lin" },
  { t: 17, z: 1.58, cx: 610, cy: 915, e: "io" },           // ... and to the right gill
  { t: 19, z: 1.66, cx: 610, cy: 915, e: "lin" },
  { t: 21.5, z: 1.25, cx: 540, cy: 880, e: "io" },         // tekanan: out to see the whole loop of blood
  { t: 29, z: 1.45, cx: 540, cy: 870, e: "lin" },
  { t: 31, z: 1.35, cx: 540, cy: 1000, e: "io" },          // biru: pan down to the vessels and arms
  { t: 36, z: 1.5, cx: 540, cy: 990, e: "lin" },
  { t: 38, z: 0.95, cx: 610, cy: 820, e: "io" },           // renang: the camera follows the swimming octopus
  { t: 40.5, z: 0.95, cx: 800, cy: 950, e: "io" },
  { t: 42.5, z: 1.0, cx: 840, cy: 980, e: "lin" },
  { t: 46, z: 1.05, cx: 540, cy: 1000, e: "io" },          // hasil: back to the whole octopus
  { t: 52, z: 1.2, cx: 540, cy: 990, e: "lin" },
  { t: 56, z: 1.3, cx: 540, cy: 930, e: "lin" },           // ringkas: a last slow push
  { t: 60, z: 0.5, cx: 540, cy: 1120, e: "io" },           // outro: back to the hook's wide shot
];

export type Cam = { z: number; cx: number; cy: number };
export function camAt(t: number): Cam {
  if (t <= KEYS[0].t) return { z: KEYS[0].z, cx: KEYS[0].cx, cy: KEYS[0].cy };
  for (let i = 1; i < KEYS.length; i++) {
    if (t <= KEYS[i].t) {
      const a = KEYS[i - 1], b = KEYS[i], k = (t - a.t) / (b.t - a.t), e = b.e === "io" ? ease(k) : k;
      return { z: a.z + (b.z - a.z) * e, cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e };
    }
  }
  const l = KEYS[KEYS.length - 1];
  return { z: l.z, cx: l.cx, cy: l.cy };
}

/** The camera of a layer: parallax p (1 = the set, 0.3 = the far back, above 1 = loose things near the lens) moves less (or more) than the set. */
export function layerCam(c: Cam, p: number): Cam {
  return { z: Math.pow(c.z, p), cx: WORLD.cx + (c.cx - WORLD.cx) * p, cy: WORLD.cy + (c.cy - WORLD.cy) * p };
}
/** World point to screen point for a camera. */
export const toScreen = (c: Cam, x: number, y: number): [number, number] => [540 + (x - c.cx) * c.z, 960 + (y - c.cy) * c.z];

/** The swim (37.5 to 44 s): `off` is how far right the octopus is (world px), `lift` how high it is off the floor (0..1, 260 px), `jet` 0..1 while the water squirts. */
export function swimAt(t: number) {
  const out = ease((t - 37.5) / 3), back = ease((t - 41.5) / 2.5);
  const off = 300 * (out - back);
  const lift = ease((t - 37.5) / 1.0) * (1 - ease((t - 40.5) / 1.0));
  const jet = lift > 0.05 && t < 41 ? clamp01(lift * 1.2) : 0;
  return { off, lift, jet };
}
/** The time the hearts beat on: they stop for 2.5 s (38 to 40.5 s) while the octopus swims. 2.5 s at 72 beats a minute is 3 whole beats, so the loop-back still matches. */
export const heartClock = (t: number) => t - Math.max(0, Math.min(2.5, t - 38));

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],                // the top text layer is the TopText of each beat is drawn in index.tsx
    labels: [] as { to: number; text: string }[],                  // the labels are drawn from the beats' own label items in index.tsx
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the octopus at rest (moved by the swim) seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), s = swimAt(t);
  const [x0, y0] = toScreen(c, OCTO_BOX.x0 + s.off, OCTO_BOX.y0 - s.lift * 260);
  const [x1, y1] = toScreen(c, OCTO_BOX.x1 + s.off, OCTO_BOX.y1 - s.lift * 260);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
