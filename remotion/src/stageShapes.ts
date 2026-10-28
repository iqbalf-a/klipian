/* The stage shapes (PLAN-VARIETY stage 3): the isometric block a hero stands on, in five shapes, with three placements. Pure geometry on the kit's own
   helpers (src/iso.ts): each shape returns its faces in their tones, a soft shadow where it floats, and its footprint box on the screen (the layout
   manager and the hero's share of the width read that box). The story's `stage` says which one a video uses; `slab` (the default) is the block the
   channel has drawn so far, so an old video is unchanged. A video may use a second shape in some beats only through its plan.ts. */
import { block, circlePts, extrudeXZ, iso, type P2, type Poly } from "./iso.ts";

export const STAGE_SHAPES = ["slab", "round", "strip", "steps", "island"] as const;
export type StageShape = (typeof STAGE_SHAPES)[number];
export const STAGE_PLACEMENTS = { center: [0, 0], left: [-230, 0], right: [230, 0] } as const;
export type StagePlacement = keyof typeof STAGE_PLACEMENTS;

/** The shape's faces (back to front), its shadow (a flat outline on the floor, for an island), and its footprint box on the screen (x0, y0, x1, y1). */
export type StageGeometry = { polys: Poly[]; shadow: P2[] | null; box: [number, number, number, number] };

const SHAPE_NOTE: Record<StageShape, string> = {
  slab: "the block the channel has drawn so far: the default",
  round: "a round plate, for a round object (a bulb, a cup, a ball)",
  strip: "a long strip, for a flow or a process along it (current, water, traffic)",
  steps: "three steps, for a sequence of stages (cause, then effect, then result)",
  island: "a floating slab with a soft shadow under it, for an idea or a gadget that stands alone",
};
export const stageNote = (shape: StageShape): string => SHAPE_NOTE[shape];

/** The geometry of a shape at a scale `u` (the kit's 100 px a unit by default), centred at the origin, moved by a placement. */
export function stageGeometry(shape: StageShape, u = 100, placement: StagePlacement = "center"): StageGeometry {
  const [ox, oy] = STAGE_PLACEMENTS[placement];
  const o: P2 = [540 + ox, 1180 + oy];
  let polys: Poly[] = [];
  let shadow: P2[] | null = null;
  if (shape === "slab") {
    polys = block([-1.6, 0, 0], [1.6, 0.9, 0.25], u, o);
  } else if (shape === "round") {
    polys = extrudeXZ(circlePts(0, 0, 1.3, 48), 0, 0.25, u, o);
  } else if (shape === "strip") {
    polys = block([-2.6, 0, 0], [2.6, 0.7, 0.22], u, o);
  } else if (shape === "steps") {
    polys = [
      ...block([-1.7, 0, 0], [1.7, 1.0, 0.2], u, o),
      ...block([-1.7, 0, 0.2], [1.7, 0.7, 0.42], u, o),
      ...block([-1.7, 0, 0.42], [1.7, 0.4, 0.64], u, o),
    ];
  } else {
    polys = block([-1.5, 0, 0.5], [1.5, 0.9, 0.75], u, o);
    // the shadow: an ellipse on the floor under the island, projected with the kit's own iso()
    shadow = circlePts(0, 0.45, 1.7, 40).map(([x, y]) => {
      const q = iso([x, y, 0], u);
      return [q[0] + o[0], q[1] + o[1]] as P2;
    });
  }
  const pts = polys.flatMap((p) => p.pts).concat(shadow ?? []);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { polys, shadow, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}
