/* Kenapa gelembung sabun berwarna-warni? — the timing and the camera of this video (pure: no React here). One continuous take in a bathroom corner
   (a new set kind, "bathroom-tub", set.json): a tiled back wall, a bathtub with foam, a soap dish, a pot of bubble solution with its wand and a towel on
   a rail. The hero is one soap bubble floating over the tub. The picture (index.tsx) and the sound (sfx.ts) read the same numbers from here.
   B25: something moves about every second, something new every 3 to 4 seconds, and each explain beat is a camera move inside the set.
   Scale (B27.7, one unit = 10 cm): the tub 55 cm high and 140 cm long (cut by the frame), the bubble 30 cm across (a big wand bubble), the pot 11 cm,
   the soap bar 9 cm, the wall tiles 20 cm. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

// the world: u px per unit, the screen point of the world origin at rest (camera focus 540, 960, zoom 1)
export const U = 230;
export const O: P2 = [142, 3315];
export const WALL_Y = -5.2;                                                   // the tiled back wall (the plane y = WALL_Y)
export const TUB = { x0: -9.5, x1: 5, y0: WALL_Y, y1: 0.3, h: 5.5, ix0: -9.0, ix1: 2.9, iy0: -4.7, iy1: -0.25, water: 4.6 } as const;
export const B: P3 = [0, -2, 9.5];                                            // the bubble's centre, 40 cm over the rim
export const R = 1.5;                                                         // the bubble's radius (15 cm)
export const POT = { x: 4.0, y: -1.6, r: 0.45, h: 1.1 } as const;             // the pot of bubble solution on the tub's deck
export const DISH = { x0: 3.4, x1: 4.6, y0: -4.6, y1: -3.6 } as const;        // the soap dish on the deck, against the wall
export const TOWEL = { x0: -7.6, x1: -5.0, z0: 7.0, z1: 12.4 } as const;       // the towel on its rail, on the wall over the tub's left end
export const LENS_C: P2 = [540, 940];
export const LENS_R = 400;
const w = (p: P3): P2 => isoAt(p, U, O);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    lapis: at("lapis"), pantul: at("pantul"), tabrak: at("tabrak"), tebal: at("tebal"), turun: at("turun"), pewarna: at("pewarna"), tips: at("tips"),
  };
  const pop = m.turun + 6.4;                                      // the bubble bursts
  const blow = m.pewarna + 2.8;                                   // a new bubble starts on the wand
  // the camera: the hook opens wide (the bubble in the centre third over the tub), pushes in, then every beat moves inside the set; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.45 to 1.0 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 1300, zoom: 0.45 };
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, x: 540, y: 900, zoom: 0.96 },
    { t: m.lapis, x: 540, y: 900, zoom: 0.96 }, { t: m.lapis + 5.8, x: 540, y: 880, zoom: 1.0 },
    { t: m.pantul, x: 520, y: 870, zoom: 1.0 }, { t: m.tabrak - 0.2, x: 520, y: 880, zoom: 1.0 },
    { t: m.tabrak + 1.2, x: 760, y: 960, zoom: 0.94 }, { t: m.tebal - 0.2, x: 750, y: 950, zoom: 0.97 },
    { t: m.tebal + 1.2, x: 600, y: 900, zoom: 0.95 }, { t: m.turun - 0.2, x: 600, y: 890, zoom: 0.99 },
    { t: m.turun + 1.0, x: 540, y: 860, zoom: 0.95 }, { t: m.pewarna - 0.1, x: 540, y: 870, zoom: 0.97 },
    { t: m.pewarna + 1.4, x: 1300, y: 1880, zoom: 0.9 }, { t: m.tips - 0.1, x: 1290, y: 1860, zoom: 0.93 },
    { t: m.tips + 1.8, x: 560, y: 1120, zoom: 0.8 }, { t: outro - 0.1, x: 560, y: 1110, zoom: 0.83 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  const wandRaise = (t: number): number => ease((t - (m.pewarna + 2.0)) / 0.7) * (1 - ease((t - (m.tips + 1.6)) / 0.8));
  const ring = (t: number): P3 => [POT.x, POT.y, 5.5 + POT.h + 0.25 + 1.4 * wandRaise(t)];
  /** The bubble at time t: its centre and radius in world units, whether it is drawn, how far the film has drained (0..1) and how big the black cap is (0..1). */
  const bubble = (t: number): { c: P3; r: number; on: boolean; drain: number; black: number } => {
    if (t < pop) return { c: B, r: R, on: true, drain: ease((t - (m.turun + 0.4)) / 5.6), black: ease((t - (m.turun + 3.6)) / 2.6) };
    if (t < blow) return { c: B, r: R, on: false, drain: 0, black: 0 };
    const ring0 = ring(t);
    const r0 = lerp(0.12, 0.62, ease((t - blow) / 1.6));
    const k = ease((t - m.tips) / 1.8);
    const r = lerp(r0, R, k);
    const c0: P3 = [ring0[0], ring0[1], ring0[2] + r0 * 0.92];
    return { c: [lerp(c0[0], B[0], k), lerp(c0[1], B[1], k), lerp(c0[2], B[2], k)], r, on: true, drain: 0, black: 0 };
  };
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, pop, blow,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: lw,
    cam: (t: number): Cam2 => cam2At(keys, t),
    bubble, ring, wandRaise,
    /** the lens over the film (the pantul beat): 0 closed .. 1 open */
    lens: (t: number): number => ease((t - m.pantul) / 0.8) * (1 - ease((t - (m.tabrak - 0.6)) / 0.6)),
    /** how far each light path is drawn inside the lens, 0..1: the light coming in, reflection 1 (outer surface), the path inside, reflection 2 (inner surface) */
    rays: (t: number): [number, number, number, number] => [
      ease((t - (m.pantul + 1.0)) / 0.8), ease((t - (m.pantul + 2.0)) / 0.8), ease((t - (m.pantul + 3.6)) / 1.0), ease((t - (m.pantul + 4.6)) / 0.8),
    ],
    /** the two wave cards of the tabrak beat: in step (stronger) and out of step (gone) */
    waves: (t: number): [number, number] => [
      ease((t - (m.tabrak + 1.3)) / 0.4) * (1 - ease((t - (m.tebal - 0.4)) / 0.4)), ease((t - (m.tabrak + 4.2)) / 0.4) * (1 - ease((t - (m.tebal - 0.4)) / 0.4)),
    ],
    /** the thickness wedge beside the bubble (the tebal beat) and which band is lit (a contour, one after the other) */
    wedge: (t: number): number => ease((t - (m.tebal + 1.2)) / 0.5) * (1 - ease((t - (m.turun - 0.3)) / 0.4)),
    contour: (t: number): number => (t >= m.tebal + 2.4 && t < m.turun - 0.3 ? Math.floor((t - (m.tebal + 2.4)) / 0.8) % 6 : -1),
    /** the drain arrows and the vapour of the turun beat */
    gravity: (t: number): number => ease((t - (m.turun + 0.6)) / 0.5) * (1 - ease((t - (pop - 0.2)) / 0.3)),
    vapour: (t: number): number => ease((t - (m.turun + 2.2)) / 0.6) * (1 - ease((t - (pop - 0.2)) / 0.3)),
    burst: (t: number): number => (t >= pop && t < pop + 0.9 ? (t - pop) / 0.9 : -1),
    /** the pipette of dye (slides in, one drop, slides out), the drop's fall 0..1, and the pink tint of the pot's liquid */
    pipette: (t: number): number => ease((t - (m.pewarna + 0.5)) / 0.5) * (1 - ease((t - (m.pewarna + 2.0)) / 0.5)),
    drop: (t: number): number => (t >= m.pewarna + 1.1 && t < m.pewarna + 1.6 ? (t - (m.pewarna + 1.1)) / 0.5 : -1),
    tint: (t: number): number => ease((t - (m.pewarna + 1.5)) / 0.6) * (1 - ease((t - outro) / 1.0)),
    /** the screen point of a world point under the camera at time t */
    screen: (t: number, p: P3): P2 => toScreen(cam2At(keys, t), w(p)),
    labels: [
      { id: "tipis", from: m.lapis + 1.6, to: m.pantul - 0.3, text: "lapisan air sabun", at: [B[0] + 1.6, B[1], B[2] + 1.9] as P3 },
      { id: "nm", from: m.lapis + 3.4, to: m.pantul - 0.3, text: "setipis gelombang cahaya", at: [B[0] - 0.3, B[1], B[2] - 2.3] as P3 },
      { id: "kuat", from: m.tabrak + 2.2, to: m.tebal - 0.4, text: "menguat", at: [0, 0, 0] as P3 },
      { id: "hapus", from: m.tabrak + 5.1, to: m.tebal - 0.4, text: "terhapus", at: [0, 0, 0] as P3 },
      { id: "atas", from: m.tebal + 1.8, to: m.turun - 0.3, text: "tipis", at: [0, 0, 0] as P3 },
      { id: "bawah", from: m.tebal + 2.4, to: m.turun - 0.3, text: "tebal", at: [0, 0, 0] as P3 },
      { id: "turun", from: m.turun + 1.0, to: m.turun + 3.6, text: "air turun", at: [B[0] - 1.2, B[1] + 1.2, B[2] - 2.3] as P3 },
      { id: "uap", from: m.turun + 2.6, to: m.turun + 4.6, text: "menguap", at: [B[0] + 0.9, B[1], B[2] + 2.5] as P3 },
      { id: "hitam", from: m.turun + 4.4, to: pop - 0.1, text: "bintik hitam", at: [B[0] + 1.9, B[1], B[2] + 1.6] as P3 },
      { id: "pecah", from: pop + 0.1, to: m.pewarna - 0.2, text: "pecah!", at: [B[0], B[1], B[2]] as P3 },
      { id: "pewarna", from: m.pewarna + 1.6, to: m.pewarna + 3.8, text: "pewarna", at: [POT.x + 1.3, POT.y, 5.5 + POT.h + 0.3] as P3 },
      { id: "bening", from: m.pewarna + 4.0, to: m.tips - 0.2, text: "tetap bening", at: [POT.x - 0.4, POT.y, 5.5 + POT.h + 2.9] as P3 },
    ],
    tipCards: [
      { n: 1, title: "Campur sedikit gliserin", sub: "airnya lambat turun", from: m.tips + 1.2, subAt: m.tips + 2.4 },
      { n: 2, title: "Tiup di udara lembap", sub: "lambat menguap", from: m.tips + 4.6, subAt: m.tips + 5.8 },
    ],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the bubble under the camera (0 wide while it is popped). */
export const HERO_BOX_AT = (t: number) => {
  const P = makePlan(STORY_FOR_BOX);
  const b = P.bubble(t), c = P.cam(t), s = P.screen(t, b.c), r = b.on ? b.r * U * c.zoom : 0;
  return { x: s[0], y: s[1], w: 2 * r, h: 2 * r };
};
// the beat lengths of this video's story, for HERO_BOX_AT (a plain module cannot import the JSON in every runner)
const STORY_FOR_BOX = { beats: [3, 1, 6, 8, 8, 7, 8, 6, 9, 4].map((dur, i) => ({ id: ["hook", "intip", "lapis", "pantul", "tabrak", "tebal", "turun", "pewarna", "tips", "outro"][i], dur })) } as unknown as StoryT;
