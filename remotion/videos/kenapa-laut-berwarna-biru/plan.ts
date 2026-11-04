/* Kenapa laut berwarna biru? — the timing and the camera of this video (pure: no React here). One continuous take on a lab bench: a glass tank of
   clear water under a lamp. The picture (index.tsx) and the sound (sfx.ts) read the same numbers from here. Beat times come from the story's beats.
   B25: something moves about every second, something new every 3 to 4 seconds, and each explain beat is a camera move inside the set. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

// the world: u px per unit, the screen point of the world origin at rest (camera focus 540, 960, zoom 1)
export const U = 150;
export const O: P2 = [540, 1214];
// the tank (world units; one unit = about 5 cm of tank, the water level is the top of the scale): glass box x -1.5..1.5, y -1.1..1.1, z 0..4.2
export const TANK = { x0: -1.5, x1: 1.5, y0: -1.1, y1: 1.1, base: 0.15, water: 3.8 } as const;
export const DEPTH = TANK.water - TANK.base;                    // the water column: 3.65 units stand for 200 m on the scale
export const UNIT_M = 200 / DEPTH;                              // metres per unit of the scale
/** Where each colour's strip ends (units under the surface): red 50 m (Wikipedia: "less than 50 m"), blue the whole 200 m column. */
export const ENDS = [50 / UNIT_M, 1.5, 2.1, 2.8, DEPTH] as const;
export const COLOURS = ["red", "orange", "yellow", "green", "blue"] as const;
export const LAMP = { x: -3.4, y: 0.1, scale: 1.6 } as const;    // base of the lamp on the bench (its own units × scale)
export const BEAKER = { x: 3.4, y: 0.6, r: 0.62, h: 1.5 } as const;
export const CARD = { x0: -1.6, x1: 0.1, y0: 3.0, y1: 4.1 } as const;
export const RULER = { x: 1.62, y0: -0.9, y1: 0.9 } as const;
const w = (p: P3): P2 => isoAt(p, U, O);
export const surfacePt = (): P2 => w([0, 0, TANK.water]);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    cahaya: at("cahaya"), serap: at("serap"), sebar: at("sebar"), hasil: at("hasil"), langit: at("langit"), dalam: at("dalam"), pantai: at("pantai"),
  };
  // the camera: the hook opens wide (tank in the centre third), pushes in, then every beat moves inside the set; the outro returns to the wide shot
  const keys: Key2[] = [
    { t: 0, x: 540, y: 900, zoom: 0.46 }, { t: 1.5, x: 540, y: 900, zoom: 0.46 }, { t: 2.8, x: 540, y: 930, zoom: 1.0 },
    { t: m.cahaya, x: 540, y: 930, zoom: 1.0 }, { t: m.serap - 0.4, x: 330, y: 760, zoom: 1.05 },
    { t: m.serap, x: 380, y: 800, zoom: 1.06 }, { t: m.serap + 2.2, x: 560, y: 960, zoom: 1.1 }, { t: m.sebar - 0.2, x: 560, y: 980, zoom: 1.12 },
    { t: m.sebar + 1.5, x: 540, y: 1010, zoom: 1.12 }, { t: m.hasil - 0.2, x: 540, y: 1000, zoom: 1.17 },
    { t: m.hasil + 1.5, x: 600, y: 800, zoom: 0.95 }, { t: m.langit - 0.2, x: 610, y: 780, zoom: 0.97 },
    { t: m.langit + 1.5, x: 540, y: 700, zoom: 1.2 }, { t: m.dalam - 0.2, x: 540, y: 650, zoom: 1.2 },
    { t: m.dalam + 1.8, x: 700, y: 1010, zoom: 1.1 }, { t: m.pantai - 0.2, x: 700, y: 1020, zoom: 1.13 },
    { t: m.pantai + 2.0, x: 720, y: 1050, zoom: 0.95 }, { t: outro - 0.1, x: 720, y: 1045, zoom: 0.96 },
    { t: outro + 2.6, x: 540, y: 900, zoom: 0.46 }, { t: total, x: 540, y: 900, zoom: 0.46 },
  ];
  /** How long each colour's strip is at time t (units under the surface). 0 before the white light splits, equal for all while the light goes in,
      then each colour is absorbed down to its own depth (red first, blue not at all), and everything resets in the loop-back. */
  const strip = (i: number, t: number): number => {
    const split = ease((t - (m.cahaya + 1.2 + i * 0.12)) / 1.6) * 3.4;
    const k = ease((t - (m.serap + 1.0 + (4 - i) * 0.35)) / 2.2);       // red (i = 0) goes first
    const len = Math.min(split, 3.4) + (ENDS[i] - 3.4) * k * (i === 4 ? 0 : 1) + (i === 4 ? (DEPTH - 3.4) * ease((t - (m.dalam + 1.5)) / 2.5) : 0);
    return len * (1 - ease((t - outro) / 0.8));
  };
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: lw,
    cam: (t: number): Cam2 => cam2At(keys, t),
    strip,
    /** how dark the deep water is (it deepens as the red goes), 0..1 */
    shade: (t: number): number => ease((t - (m.serap + 2)) / 4) * (1 - ease((t - outro) / 0.8)),
    /** blue scattering: 0..1, from the sebar beat */
    scatter: (t: number): number => ease((t - (m.sebar + 0.8)) / 1.2) * (1 - ease((t - outro) / 0.6)),
    /** the blue that comes back to the eye: 0..1 */
    toEye: (t: number): number => ease((t - (m.hasil + 0.6)) / 1.2) * (1 - ease((t - (m.langit - 0.3)) / 0.5)),
    /** the cloud's reflection arrow (the myth that the sea only mirrors the sky), 0..1 */
    mirror: (t: number): number => ease((t - (m.langit + 0.8)) / 1.0) * (1 - ease((t - (m.dalam - 0.5)) / 0.5)),
    /** the depth scale (ruler) shown in the dalam beat */
    ruler: (t: number): number => ease((t - (m.dalam - 0.4)) / 0.8) * (1 - ease((t - (m.pantai + 0.8)) / 0.6)),
    /** the murky water of the beaker, 0..1 */
    murk: (t: number): number => ease((t - (m.pantai + 0.8)) / 1.6) * (1 - ease((t - outro) / 0.6)),
    /** the screen point of a world point under the camera at time t */
    screen: (t: number, p: P3): P2 => toScreen(cam2At(keys, t), w(p)),
    labels: [
      { id: "campur", from: m.cahaya + 2.6, to: m.serap - 0.2, text: "semua warna", at: [0.9, 0, 2.2] as P3 },
      { id: "merah", from: m.serap + 1.6, to: m.sebar - 0.3, text: "merah habis", at: [1.2, 0.2, TANK.water - 0.9] as P3 },
      { id: "biru", from: m.sebar + 1.2, to: m.hasil - 0.3, text: "biru menyebar", at: [-0.6, 0.2, 0.7] as P3 },
      { id: "mata", from: m.hasil + 2.0, to: m.langit - 0.2, text: "sampai ke mata", at: [0, 0, 0] as P3 },
      { id: "langit", from: m.langit + 2.2, to: m.dalam - 0.3, text: "bukan cuma langit", at: [0, 0, TANK.water + 0.3] as P3 },
      { id: "lima", from: m.dalam + 2.0, to: m.dalam + 3.9, text: "merah: 50 m", at: [RULER.x + 0.9, 0, TANK.water - 0.91] as P3 },
      { id: "dua", from: m.dalam + 4.2, to: m.pantai - 0.3, text: "biru: 200 m", at: [RULER.x + 0.9, 0, TANK.base + 0.2] as P3 },
      { id: "keruh", from: m.pantai + 1.8, to: m.outro - 0.2, text: "keruh jadi hijau", at: [BEAKER.x, BEAKER.y, BEAKER.h + 0.9] as P3 },
    ],
  };
}

/** The hero's box at the main shot (camera focus 540, 930, zoom 1), in the 1080 px frame (x, y, w, h): the tank. */
export const HERO_BOX_AT = (_t: number) => {
  const c: Cam2 = { x: 540, y: 930, zoom: 1 };
  const pts = ([[TANK.x0, TANK.y1, 0], [TANK.x1, TANK.y0, 4.2], [TANK.x0, TANK.y0, 0], [TANK.x1, TANK.y1, 0]] as P3[]).map((p) => toScreen(c, w(p)));
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
