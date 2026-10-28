/* The stage shapes (PLAN-VARIETY stage 3): the isometric base a hero stands on, in five shapes, with three placements. Pure geometry on the kit's own
   helpers (src/iso.ts). Each shape returns its faces in their tones, a soft shadow where it floats, its footprint box on the screen (the layout manager
   and the hero's share of the width read that box), the height of its top (where the hero stands), and the screen point of its footprint's centre on
   the floor (the shadow is centred on it). A flat shape lies in the plane x-y (its outline is a circle or a rectangle on the floor, thin in z), so it
   reads as a plate on the floor, not as a standing wall. `slab` (the default) is the block the channel has drawn so far. */
import { block, circlePts, iso, isoAt, toneOf, visible, type P2, type P3, type Poly } from "./iso.ts";

export const STAGE_SHAPES = ["slab", "round", "strip", "steps", "island"] as const;
export type StageShape = (typeof STAGE_SHAPES)[number];
export const STAGE_PLACEMENTS = { center: [0, 0], left: [-230, 0], right: [230, 0] } as const;
export type StagePlacement = keyof typeof STAGE_PLACEMENTS;

/** The shape's faces (back to front), its shadow (a flat outline on the floor, for an island), its footprint box on the screen (x0, y0, x1, y1), the
    height of its top (world z), and the screen point of its footprint's centre on the floor. */
export type StageGeometry = { polys: Poly[]; shadow: P2[] | null; box: [number, number, number, number]; top: number; center: P2 };

const SHAPE_NOTE: Record<StageShape, string> = {
  slab: "the block the channel has drawn so far: the default",
  round: "a round plate on the floor, for a round object (a bulb, a cup, a ball)",
  strip: "a long strip on the floor, for a flow or a process along it (current, water, traffic)",
  steps: "three steps, for a sequence of stages (cause, then effect, then result)",
  island: "a floating slab with a soft shadow on the floor under it, for an idea or a gadget that stands alone",
};
export const stageNote = (shape: StageShape): string => SHAPE_NOTE[shape];

/** A flat round plate: the circle lies in the plane x-y, between heights z0 and z1. Its visible rim faces and its top face, back to front. */
function plateXY(cx: number, cy: number, r: number, z0: number, z1: number, u: number, o: P2, n = 48): Poly[] {
  const ring = circlePts(cx, cy, r, n);
  const P = (x: number, y: number, z: number): P2 => isoAt([x, y, z], u, o);
  const polys: Poly[] = [];
  for (let k = 0; k < n; k++) {
    const a = ring[k], b = ring[(k + 1) % n];
    const normal: P3 = [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0];
    if (!visible(normal)) continue;
    polys.push({ tone: toneOf(normal), pts: [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)] });
  }
  polys.push({ tone: 0, pts: ring.map(([x, y]) => P(x, y, z1)) });
  return polys;
}

/** The geometry of a shape at a scale `u` (the kit's 100 px a unit by default), moved by a placement. */
export function stageGeometry(shape: StageShape, u = 100, placement: StagePlacement = "center"): StageGeometry {
  const [ox, oy] = STAGE_PLACEMENTS[placement];
  const o: P2 = [540 + ox, 1180 + oy];
  let polys: Poly[] = [];
  let shadow: P2[] | null = null;
  let top = 0.25;
  let floor: [number, number] = [0, 0.45];                       // the footprint's centre on the floor (world x, y)
  if (shape === "slab") {
    polys = block([-1.6, 0, 0], [1.6, 0.9, 0.25], u, o);
  } else if (shape === "round") {
    polys = plateXY(0, 0, 1.3, 0, 0.12, u, o);
    top = 0.12;
    floor = [0, 0];
  } else if (shape === "strip") {
    polys = block([-2.6, 0, 0], [2.6, 0.7, 0.16], u, o);
    top = 0.16;
    floor = [0, 0.35];
  } else if (shape === "steps") {
    polys = [
      ...block([-1.7, 0, 0], [1.7, 1.0, 0.2], u, o),
      ...block([-1.7, 0, 0.2], [1.7, 0.7, 0.42], u, o),
      ...block([-1.7, 0, 0.42], [1.7, 0.4, 0.64], u, o),
    ];
    top = 0.64;
    floor = [0, 0.5];
  } else {
    polys = block([-1.5, 0, 0.5], [1.5, 0.9, 0.75], u, o);
    top = 0.75;
    floor = [0, 0.45];
    // the shadow: an ellipse on the floor centred under the island's own footprint (the same centre as `center` below)
    shadow = circlePts(floor[0], floor[1], 1.6, 40).map(([x, y]) => {
      const q = iso([x, y, 0], u);
      return [q[0] + o[0], q[1] + o[1]] as P2;
    });
  }
  const center = isoAt([floor[0], floor[1], 0], u, o);
  const pts = polys.flatMap((p) => p.pts).concat(shadow ?? []);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { polys, shadow, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], top, center };
}
