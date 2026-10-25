/* The motion vocabulary (P28-A2): continuous time at 30 fps, springs and easing, no stepping and no random shake.
   The story JSON only PICKS from this list (enter / exit / actions / camera / transition); the AI never writes any of it.
   Pure functions of the time `t` (seconds into the beat) and the plan, so a frame always looks the same. */
import { Easing, interpolate, spring } from "remotion";
import type { ItemT } from "./schema.ts";
import { FPS, type CameraPlan, type EnterPlan } from "./timeline.ts";

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeOutBack = (x: number): number => Easing.out(Easing.back(1.4))(clamp01(x));
const SLIDE = 170;                                     // how far a slide travels, in video px
const RISE = 46;                                       // how far a fade-up rises

/** A spring from 0 to 1 that starts `delay` seconds in. `soft` is for arms and faces (less overshoot). */
export function springAt(t: number, delay = 0, soft = false): number {
  const frame = Math.max(0, (t - delay) * FPS);
  return spring({ frame, fps: FPS, config: soft ? { damping: 20, stiffness: 120, mass: 0.9 } : { damping: 12, stiffness: 150, mass: 0.8 } });
}

/** What an entrance or an exit does to a thing, around the thing's own anchor point. */
export type Fx = { opacity: number; tx: number; ty: number; scale: number; rot: number; draw: number };
export const NO_FX: Fx = { opacity: 1, tx: 0, ty: 0, scale: 1, rot: 0, draw: 1 };

const along = (dir: string, amount: number): [number, number] =>
  dir === "left" ? [-amount, 0] : dir === "right" ? [amount, 0] : dir === "up" ? [0, -amount] : [0, amount];

/** `dir` is the way the thing TRAVELS: "up" rises into place from below, "down" drops in from above. */
export function enterFx(plan: EnterPlan, t: number): Fx {
  if (plan.kind === "none") return NO_FX;
  const k = clamp01((t - plan.delay) / plan.dur);
  if (t < plan.delay) return { ...NO_FX, opacity: 0, scale: plan.kind === "pop" ? 0 : 1, draw: 0, ty: plan.kind === "fade-up" ? RISE : 0 };
  switch (plan.kind) {
    case "pop": { const p = springAt(t, plan.delay); return { ...NO_FX, opacity: clamp01(p * 4), scale: Math.max(0, p) }; }
    case "slide": {
      const [dx, dy] = along(plan.dir, SLIDE);
      const e = easeOut(k);
      return { ...NO_FX, opacity: clamp01(k * 2.5), tx: -dx * (1 - e), ty: -dy * (1 - e) };
    }
    case "fade-up": { const e = easeOut(k); return { ...NO_FX, opacity: e, ty: RISE * (1 - e) }; }
    case "draw": return { ...NO_FX, opacity: clamp01((t - plan.delay) / 0.12), draw: easeInOut(k) };
  }
}

export function exitFx(exit: NonNullable<ItemT["exit"]> | undefined, t: number): Fx {
  if (!exit || t < exit.at) return NO_FX;
  const dur = exit.dur ?? 0.4, q = clamp01((t - exit.at) / dur);
  if (exit.kind === "pop") return { ...NO_FX, opacity: 1 - q, scale: 1 - Easing.in(Easing.cubic)(q) };
  if (exit.kind === "slide") { const [dx, dy] = along(exit.dir ?? "right", SLIDE); const e = Easing.in(Easing.cubic)(q); return { ...NO_FX, opacity: 1 - q, tx: dx * e, ty: dy * e }; }
  return { ...NO_FX, opacity: 1 - easeOut(q), ty: -RISE * easeOut(q) };
}

type Action = NonNullable<ItemT["actions"]>[number];

/** Emphasis: a highlight pulses the thing (scale), a shake (danger only) rattles it and dies away. */
export function emphasisFx(actions: readonly Action[] | undefined, t: number): { scale: number; tx: number } {
  let scale = 1, tx = 0;
  for (const a of actions ?? []) {
    const x = t - a.at;
    if (x < 0) continue;
    if (a.kind === "highlight" && x < 0.7) scale += 0.14 * Math.sin(Math.PI * (x / 0.7));
    if (a.kind === "shake" && x < 1.1) tx += 16 * Math.exp(-x * 4.2) * Math.sin(x * 42);
  }
  return { scale, tx };
}

/** The mascot looks at a point from `at` on. Between two looks the gaze glides from the first target to the second; the first
    look turns from the idle drift (or is there at once with `snap`). Returns the target and how far it has turned (0..1). */
export function lookAt(actions: readonly Action[] | undefined, t: number): { x: number; y: number; mix: number } | null {
  const looks = (actions ?? []).filter((a): a is Extract<Action, { kind: "look" }> => a.kind === "look" && t >= a.at).sort((p, q) => p.at - q.at);
  const cur = looks[looks.length - 1];
  if (!cur) return null;
  const m = cur.snap ? 1 : springAt(t, cur.at, true);
  const prev = looks[looks.length - 2];
  if (!prev) return { x: cur.x, y: cur.y, mix: m };
  return { x: prev.x + (cur.x - prev.x) * m, y: prev.y + (cur.y - prev.y) * m, mix: 1 };
}

/** The chibi's arms: the pose it was in, the pose it springs to, and how far along it is. */
export function poseAt(initial: string, actions: readonly Action[] | undefined, t: number): { from: string; to: string; mix: number } {
  let from = initial, to = initial, mix = 1, last = -1;
  for (const a of [...(actions ?? [])].sort((p, q) => p.at - q.at)) {
    if (a.kind !== "pose" || t < a.at) continue;
    from = to; to = a.pose; last = a.at;
  }
  if (last >= 0) mix = springAt(t, last, true);
  return { from, to, mix };
}

/** The face (mascot or chibi) after the actions so far, and a small bump (0..1) right after it changed. */
export function exprAt(initial: string, actions: readonly Action[] | undefined, t: number): { expr: string; bump: number } {
  let expr = initial, at = -1;
  for (const a of actions ?? []) if (a.kind === "expr" && t >= a.at && a.at >= at) { expr = a.expr; at = a.at; }
  return { expr, bump: at >= 0 && t - at < 0.35 ? Math.sin(Math.PI * ((t - at) / 0.35)) : 0 };
}

/** How open an eye is (0.1 at the bottom of a blink, 1 open): a blink of 0.14 s every `period` seconds, offset by `phase`. */
export function blink(t: number, period = 3.4, phase = 0): number {
  const c = (t + phase) % period;
  return c < 0.14 ? 1 - 0.9 * Math.sin(Math.PI * (c / 0.14)) : 1;
}

/** A gentle float, in px: the mascot hovers. */
export const hover = (t: number, amp = 9): number => amp * Math.sin(2 * Math.PI * 0.55 * t);
/** Breathing: a tiny stretch of a standing body. */
export const breathe = (t: number): number => 1 + 0.014 * Math.sin(2 * Math.PI * 0.4 * t);

/** The camera of a beat at time t: a scale and a shift of the whole scene around its centre. */
export function cameraAt(plan: CameraPlan, t: number, beatDur: number): { scale: number; tx: number; ty: number } {
  if (plan.kind === "push") return { scale: interpolate(t, [0, beatDur], [1, 1.08], { easing: Easing.inOut(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" }), tx: 0, ty: 0 };
  if (plan.kind === "pan") {
    const e = 1 - easeOut(clamp01(t / plan.dur));
    return { scale: 1 + (plan.zoom - 1) * e, tx: plan.dx * e + 0, ty: plan.dy * e + 0 };
  }
  return { scale: 1, tx: 0, ty: 0 };
}

/** Words of a text appear one by one: the progress (0..1, a spring) of word `i`, starting at `start` seconds. */
export const wordIn = (t: number, start: number, i: number): number => springAt(t, start + i * 0.085, true);

const clean = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Does this word turn yellow? Keywords of the story's `highlight`, compared without case or punctuation. */
export const isKeyword = (word: string, keywords: readonly string[] | undefined): boolean =>
  !!keywords?.some((k) => clean(k) !== "" && clean(k) === clean(word));
