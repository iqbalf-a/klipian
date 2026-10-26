import type { SfxEvent } from "../src/sfx.ts";
export function sound(name: string): Float32Array;
export function softLimit(x: number, ceiling?: number): number;
export function mixEvents(
  events: readonly Pick<SfxEvent, "t" | "name" | "vol" | "why" | "dur" | "pan">[],
  totalSeconds: number,
  opts?: { ceiling?: number; duck?: { voice?: [number, number][]; db?: number; attack?: number; release?: number } },
): { channels: [Float32Array, Float32Array]; peak: number; rms: number; rate: number };
export const VOICE_PEAK: number;
export const FINAL_CEILING: number;
export function musicBed(name: string): Float32Array;
export function voiceSegments(samples: Float32Array, rate?: number, opts?: { threshold?: number; window?: number; joinGap?: number; minLen?: number }): [number, number][];
export function loadVoice(file: string, total: number): Float32Array;
export function mixTrack(
  events: readonly { t: number; name: string; vol: number; why: string; dur?: number; pan?: number }[],
  totalSeconds: number,
  opts?: { voice?: Float32Array | null; music?: { name: string; level?: number } | null; duckDb?: number },
): { channels: [Float32Array, Float32Array]; peak: number; rms: number; rate: number; segments: [number, number][] };
