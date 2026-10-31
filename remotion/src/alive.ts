/* Small continuous motion for an asset that is "alive" (P28-R phase 5, DESIGN.md B25): the breathing of a body, the sway of a leaf, the bob of a floating
   thing, a blink, a heart beat, the spin of a fan, the tick of a clock hand. Pure functions of the time `t` (seconds), so a frame always looks the same; the periods
   and the sizes are the registry's (src/motionLanguage.ts ALIVE), so every asset moves with the same small amounts: a still asset on a video reads as dead, an
   asset that moves a little all the time reads as alive, and none of it is big enough to pull the eye from the story. No random numbers: a `phase` (0..1)
   offsets a motion so two things of one kind do not move together. */
import { ALIVE, AMBIENT } from "./motionLanguage.ts";

const TAU = Math.PI * 2;
const wrap = (x: number): number => ((x % 1) + 1) % 1;

/** A stretch around 1 (a body breathing): 1 +/- `amp` over `period` seconds. */
export const breatheScale = (t: number, phase = 0, amp: number = ALIVE.breatheAmp, period: number = AMBIENT.breathePeriod): number => 1 + amp * Math.sin(TAU * (t / period + phase));
/** A sway in degrees (a leaf, a lamp on its arm, a flag): +/- `deg` over `period` seconds. */
export const swayDeg = (t: number, phase = 0, deg: number = ALIVE.swayDeg, period: number = ALIVE.swayPeriod): number => deg * Math.sin(TAU * (t / period + phase));
/** A float in px (a cloud, a steam wisp's base, a floating icon): +/- `px` over `period` seconds. */
export const bobPx = (t: number, phase = 0, px: number = ALIVE.bobPx, period: number = AMBIENT.hoverPeriod): number => px * Math.sin(TAU * (t / period + phase));
/** A drift in px that goes one way and comes back (a cloud over the sea): a slow sine of `px` over `period` seconds. */
export const driftPx = (t: number, phase = 0, px: number = ALIVE.driftPx, period: number = ALIVE.driftPeriod): number => px * Math.sin(TAU * (t / period + phase));
/** A pulse from 0 to 1 and back (a glow): smooth, `period` seconds, `lo`..`hi`. */
export const pulse01 = (t: number, phase = 0, period: number = ALIVE.pulsePeriod, lo = 0, hi = 1): number => lo + (hi - lo) * (0.5 - 0.5 * Math.cos(TAU * (t / period + phase)));
/** A heart beat 0..1: a small beat then a bigger one close after it (lub-dub), `bpm` beats a minute. */
export function heartBeat(t: number, bpm: number = ALIVE.heartBpm, phase = 0): number {
  const c = wrap(t * (bpm / 60) + phase);
  const bump = (centre: number, width: number) => Math.exp(-Math.pow((c - centre) / width, 2));
  return Math.min(1, 0.8 * bump(0.1, 0.085) + bump(0.34, 0.09));
}
/** A rotation in degrees at `rps` turns a second (a fan's blades). */
export const spinDeg = (t: number, rps: number = ALIVE.fanRps, phase = 0): number => 360 * (rps * t + phase);
/** A clock's second hand in degrees: it holds, then jumps to the next second in 0.12 s with a small overshoot (a tick), 6 degrees a second. */
export function tickDeg(t: number): number {
  const s = Math.floor(t), f = Math.min(1, (t - s) / 0.12), e = f < 1 ? 1 - Math.pow(1 - f, 3) + 0.18 * Math.sin(Math.PI * f) * (1 - f) : 1;
  return (s + e) * 6;
}
/** A light that flickers a little (a lamp, a screen, a flame): 1 +/- `amp`, from two sines that do not repeat in a short loop (no random numbers). */
export const flicker = (t: number, phase = 0, amp: number = ALIVE.flickerAmp): number => 1 + amp * (0.6 * Math.sin(TAU * (t * 7.3 + phase)) + 0.4 * Math.sin(TAU * (t * 11.9 + phase * 2.3)));
/** A rise 0..1 along a wisp's life (steam, vapour, a rising spark): `k` is the wisp's own offset 0..1, `period` the life in seconds. */
export const riseAt = (t: number, k: number, period: number = ALIVE.risePeriod): number => wrap(t / period + k);
/** The eyes' lids closing in a blink (0 open .. 1 shut): the same blink as src/motion.ts, as a closed share. */
export function blinkClosed(t: number, period: number = AMBIENT.blinkPeriod, phase = 0): number {
  const c = (((t + phase) % period) + period) % period;
  return c < 0.14 ? Math.sin(Math.PI * (c / 0.14)) : 0;
}
