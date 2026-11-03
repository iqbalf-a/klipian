/* The room set of the socket video (DESIGN.md B27 "Set, not specimen", B27.7 "One scale per set"): a wide wall with a window beside the socket (the far layer shows
   through it), and a desk under it whose top is the floor the cable lies on, all bleeding past the frame. Every size comes from src/roomScale.ts (real cm at the scale
   of the socket plate), so a big piece is shown partly, cut by the frame. Flat, three tones, nothing in a meaning colour. The wall is the plane y = 0. */
import React from "react";
import { ISO, rgb } from "../tokens.ts";
import { block, isoAt, ptsAttr, type P2, type P3, type Tones } from "../iso.ts";
import { ROOM } from "../roomScale.ts";
import { Polys } from "./Iso.tsx";

export const ROOM_FLOOR_Z = ROOM.deskZ;
export const ROOM_WINDOW = ROOM.window;
/** The desk is a neutral taupe (not wood-yellow: yellow is current), the books are the kit's plastic and dark tones. */
const DESK: Tones = [rgb([176, 168, 160]), rgb([150, 142, 134]), rgb([122, 114, 108])];
const X = 40;

/** The wall with the window's hole, the window's casing, the skirting and the floor, and the small desk with its legs and two books. Draw it first in the p = 1 layer;
    the far layer shows through the window's hole. */
export const IsoRoomWall: React.FC<{ u: number; o: P2 }> = ({ u, o }) => {
  const P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o);
  const rect = (x0: number, x1: number, z0: number, z1: number) => [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)];
  const w = ROOM.window, fz = ROOM.floorZ;
  const d = "M " + rect(-X, X, fz, 60).map((p) => p.join(" ")).join(" L ") + " Z M " + rect(w.x0, w.x1, w.z0, w.z1).map((p) => p.join(" ")).join(" L ") + " Z";
  return (
    <g>
      <Polys polys={block([-X, 0, fz - 0.4], [X, 40, fz], u, o)} tones={ISO.floor} />
      <path d={d} fill={ISO.wall[1]} fillRule="evenodd" />
      {/* the window: the sill looks up, the casing is a frame of four bars round the glass (the far layer shows through it), a cross of two bars, and a shine on the glass */}
      <polygon points={ptsAttr([P(w.x0, -0.5, w.z0), P(w.x1, -0.5, w.z0), P(w.x1, 0, w.z0), P(w.x0, 0, w.z0)])} fill={ISO.wall[0]} />
      <polygon points={ptsAttr([P(w.x0, -0.5, w.z0), P(w.x0, 0, w.z0), P(w.x0, 0, w.z1), P(w.x0, -0.5, w.z1)])} fill={ISO.wall[2]} />
      <polygon points={ptsAttr(rect(w.x0, w.x1, w.z0, w.z1))} fill={ISO.plastic[0]} opacity={0.14} />
      {[[w.x0 + 4, w.x0 + 6.2], [w.x0 + 7.2, w.x0 + 8.2]].map(([a, b], i) => <polygon key={i} points={ptsAttr([P(a, 0, w.z0 + 1), P(b, 0, w.z0 + 1), P(b, 0, w.z1 - 1), P(a, 0, w.z1 - 1)])} fill={ISO.plastic[0]} opacity={0.22} />)}
      <Polys polys={block([(w.x0 + w.x1) / 2 - 0.35, -0.4, w.z0], [(w.x0 + w.x1) / 2 + 0.35, 0.1, w.z1], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0, -0.4, (w.z0 + w.z1) / 2 - 0.35], [w.x1, 0.1, (w.z0 + w.z1) / 2 + 0.35], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x1, 0, w.z0 - ROOM.casing], [w.x1 + ROOM.casing, 0.3, w.z1 + ROOM.casing], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0 - ROOM.casing, 0, w.z1], [w.x1, 0.3, w.z1 + ROOM.casing], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0 - ROOM.casing, 0, w.z0 - ROOM.casing], [w.x1, 0.3, w.z0], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0 - ROOM.casing, 0, w.z0], [w.x0, 0.3, w.z1], u, o)} tones={ISO.plastic} />
      <Polys polys={block([-X, 0, fz], [X, 0.3, fz + 2.8], u, o)} tones={ISO.plastic} />
      {ROOM.boxes.filter((b) => b.name.startsWith("leg")).map((b) => <Polys key={b.name} polys={block(b.a as P3, b.b as P3, u, o)} tones={DESK} />)}
      {ROOM.boxes.filter((b) => b.name === "table").map((b) => <Polys key={b.name} polys={block(b.a as P3, b.b as P3, u, o)} tones={DESK} />)}
    </g>
  );
};
