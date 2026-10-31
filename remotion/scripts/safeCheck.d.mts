export const RIGHT_BAND_FROM: number;
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type BandHit = { band: "top" | "bottom" | "left" | "right"; by: number };
export type KeyBox = { t: number; id: string; role: string; box: Box };
export type Finding = { id: string; band: BandHit["band"]; by: number; from: number; to: number };
export function bandsHit(box: Box, profile: { top: number; bottom: number; left: number; right: number }): BandHit[];
export function keyBoxes(slug: string, story: unknown): Promise<KeyBox[]>;
export function safeReport(boxes: readonly KeyBox[], platforms?: readonly string[]): Record<string, Finding[]>;
export function reportLines(report: Record<string, Finding[]>): string[];
