/* Pelangi sebenarnya berbentuk lingkaran — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tips and the loop-back outro. One set (B27): a wide landscape (the nature kit's sea, land, hills, fields, trees) with a rain cloud and the sun,
   and the hero: the rainbow RING, drawn in the iso kit's XZ plane. The ground hides its lower half; in the "pesawat" beat the ground drops away (the aircraft climbs) and the whole
   ring shows. Every state is a function of the video's clock; the loop-back eases every state to its first value, so the last frame is the first.
   motion-exception: the hook's establishing push (zoom 0.46 to 1.0 in 1.4 s) is the registry's establishing push (B27.8); the pushes and pans stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { CLOUD_GREY, LAND_TOP } from "../../src/natureGeometry.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The set's one scale: U px per world unit, O the screen px of the world origin. */
export const OUT = { u: 160, o: [485, 1144] as P2 };
export const world = (p: P3): P2 => isoAt(p, OUT.u, OUT.o);

/** The ring: centre (world units, on the ground plane z = 0, in the plane y = RING.y), radius R (outer), seven bands of width BAND. */
export const RING = { x: 1.6, y: 0.2, z: LAND_TOP, r: 2.3, band: 0.1 };
export const RING_SCREEN: P2 = world([RING.x, RING.y, RING.z]);
export const ringPoint = (r: number, ang: number): P2 => world([RING.x + r * Math.cos(ang), RING.y, RING.z + r * Math.sin(ang)]);
/** The sun and the rain cloud (world units). */
export const SUN_AT: P2 = world([4.6, -1.6, 4.4]);
export const CLOUD_AT: P3 = [CLOUD_GREY.cx, CLOUD_GREY.cy, CLOUD_GREY.cz];
export const CLOUD_PT: P2 = world(CLOUD_AT);
/** The ground's horizon line through the ring's centre (the XZ plane meets the ground z = 0 along x): direction of +x on the screen. */
export const HORIZON_DIR: P2 = [0.8660254, 0.5];
/** How far the ground drops (px) when the aircraft climbs: enough to show the whole ring. */
export const DROP = 640;
export const TIP = { x: 80, y: 420, w: 840 };

export const SPOT = { x: 540, y: 700, r: 190 };
export const FAR = { hills: { x0: -900, x1: 1900, crest: 700, base: 1500 }, clouds03: [{ o: [160, 440] as P2, u: 55, grow: 0.6 }, { o: [920, 500] as P2, u: 50, grow: 0.55 }] };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
export function keyed(t: number, keys: readonly (readonly [number, number])[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i], [t0, v0] = keys[i - 1];
    if (t < t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

// the camera. The beats start at 0, 3, 4, 13, 22, 31, 40, 47, 56.
const K = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
const [cx, cy] = RING_SCREEN;
export const WIDE = K(0, cx - 40, cy - 120, 0.46);
export const CAM_KEYS: Key2[] = [
  WIDE, { ...WIDE, t: 1.5 },
  K(2.9, cx - 20, cy - 180, 0.92),                    // the establishing push: the ring over the land
  K(4, cx - 20, cy - 180, 0.94),                      // sting: the world keeps moving
  K(12.4, cx + 90, cy - 230, 1.0),                    // cahaya: a slow push toward the cloud, the rain and the sun
  K(14.2, cx, cy - 170, 1.0),                          // pusat: a pan down to the ring's centre
  K(21.4, cx, cy - 180, 1.05),
  K(23, cx - 40, cy - 190, 1.05),                      // tanah: the horizon
  K(30.4, cx - 40, cy - 185, 1.08),
  K(36.5, cx, cy + 90, 0.78),                         // pesawat: out to the whole ring as the ground drops
  K(39.4, cx, cy + 90, 0.8),
  K(41, cx, cy + 60, 0.74),                           // hasil
  K(46.4, cx, cy + 60, 0.76),
  K(48, cx, cy - 330, 0.7),                           // tips: the set drops to leave room for the cards
  K(55.4, cx, cy - 330, 0.72),
  { ...WIDE, t: 59.4 },                               // outro: back to the hook's wide shot (the last frame is the first)
  { ...WIDE, t: 60 },
];
export const camAt = (t: number): Cam2 => cam2At(CAM_KEYS, t);

export const startsOf = (story: StoryT): Record<string, number> => {
  const out: Record<string, number> = {};
  let a = 0;
  for (const b of story.beats) { out[b.id] = a; a += b.dur; }
  return out;
};

/** The states of the set at a time (all functions of the video's clock). */
export function stateAt(t: number) {
  return {
    drop: keyed(t, [[0, 0], [31.2, 0], [36.4, DROP], [47, DROP], [57.5, 0], [60, 0]]),                       // the ground sinks as the aircraft climbs
    ghost: keyed(t, [[0, 0], [23.5, 0], [24.5, 1], [30.5, 1], [31.5, 0], [60, 0]]),                           // the hidden lower half, drawn faint
    rays: keyed(t, [[0, 0], [4.6, 0], [5.4, 1], [12.4, 1], [13.2, 0], [60, 0]]),                              // light from the sun into the drops
    centre: keyed(t, [[0, 0], [14, 0], [14.8, 1], [21.6, 1], [22.4, 0], [60, 0]]),                           // the marker opposite the sun
    plane: keyed(t, [[0, 0], [31.2, 0], [32.4, 1], [46.6, 1], [47.6, 0], [60, 0]]),                           // the aircraft
    stamp: keyed(t, [[0, 0], [41.4, 0], [42.2, 1], [46.6, 1], [47.2, 0], [60, 0]]),
    rain: 1,
  };
}

const KICKER_BY_ID: Record<string, string> = { cahaya: "CAHAYA", pusat: "PUSAT", tanah: "DARI TANAH", pesawat: "DARI PESAWAT" };
const KICKER: Record<string, string> = { hook: "PELANGI", normal: "PELANGI", result: "HASILNYA", tips: "TIPS" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    hookQ: 0.6, rays: 5.4, lDrop: at("cahaya") + 1.4, lSun: at("cahaya") + 3.6,
    centre: 14.8, l42: 17.6, lOpp: 15.4, ghost: 24.5, lGround: 25.5, lHidden: 27.6,
    plane: 32.4, lPlane: 34.4, lCircle: 37, lShadow: 35.6,
    verdict: at("hasil") + 1.2, tip1: at("tips") + 0.5, tip2: at("tips") + 4.3,
  };
  const tops = story.beats.map((b, i) => ({ a: starts[i], b: starts[i] + b.dur, id: b.id, kind: b.kind, kicker: KICKER_BY_ID[b.id] ?? KICKER[b.kind] ?? "INTIP", headline: b.text }))
    .filter((x) => x.kind !== "sting" && x.kind !== "outro");
  return {
    m, total, starts,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops,
    labels: [] as { to: number; text: string }[],
    cam: camAt,
    state: stateAt,
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the ring (outer radius, the visible part: the upper half unless the ground has dropped). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), s = stateAt(t);
  const pts: P2[] = [];
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const p = ringPoint(RING.r, a);
    if (Math.sin(a) >= -0.001 || s.drop > 300) pts.push(p);
  }
  const sc = pts.map((p) => toScreen(c, p));
  const l = Math.min(...sc.map((p) => p[0])), r = Math.max(...sc.map((p) => p[0])), tp = Math.min(...sc.map((p) => p[1])), bt = Math.max(...sc.map((p) => p[1]));
  return { x: (l + r) / 2, y: (tp + bt) / 2, w: r - l, h: bt - tp };
};
