import type { SfxEvent } from "../src/sfx.ts";
export function sound(name: string): Float32Array;
export function softLimit(x: number, ceiling?: number): number;
export function mixEvents(
  events: readonly Pick<SfxEvent, "t" | "name" | "vol" | "why" | "dur" | "pan">[],
  totalSeconds: number,
  opts?: { ceiling?: number; duck?: { voice?: [number, number][]; db?: number; attack?: number; release?: number } },
): { channels: [Float32Array, Float32Array]; peak: number; rms: number; rate: number };
