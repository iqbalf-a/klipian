/* The stop-motion look: animation time moves in 12 fps steps (on a 30 fps video, a new "photo" every 2.5 frames), and
   every object shakes a little between photos, by an amount that depends only on the beat's id, the object's place in
   the scene and the step: the same story always renders the same frames. */

export const STEP_FPS = 12;

/** Seconds of animation time for a video frame: held for a whole step, then jumps. */
export function stepTime(frame: number, fps: number): number {
  return Math.floor((frame * STEP_FPS) / fps) / STEP_FPS;
}

/** The index of the 12 fps step (for the jitter). */
export function stepIndex(frame: number, fps: number): number {
  return Math.floor((frame * STEP_FPS) / fps);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small deterministic generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Jitter = { dx: number; dy: number; rot: number };

/** Shake of one object at one step: up to +-2.2 px and +-0.45 degrees (video units). */
export function jitter(beatId: string, itemIndex: number, step: number): Jitter {
  const r = rng(hash(`${beatId}#${itemIndex}`) ^ Math.imul(step + 1, 0x9e3779b1));
  return { dx: (r() * 2 - 1) * 2.2, dy: (r() * 2 - 1) * 2.2, rot: (r() * 2 - 1) * 0.45 };
}

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const easeOutBack = (x: number): number => {
  const t = clamp01(x), c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
