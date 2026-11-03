/* The room set of the socket video (DESIGN.md B27 "Set, not specimen", B27.7 "One scale per set"): a wide wall with a window beside the socket (the far layer shows
   through it), and a desk under it whose top is the floor the cable lies on, all bleeding past the frame. Every size comes from src/roomScale.ts (real cm at the scale
   of the socket plate), so a big piece is shown partly, cut by the frame. Flat, three tones, nothing in a meaning colour. The wall is the plane y = 0. */
import React from "react";
import { ISO, rgb } from "../tokens.ts";
import { block, isoAt, ptsAttr, type P2, type Tones } from "../iso.ts";
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
  const w = ROOM.window, dk = ROOM.desk, fz = ROOM.floorZ;
  const d = "M " + rect(-X, X, fz, 60).map((p) => p.join(" ")).join(" L ") + " Z M " + rect(w.x0, w.x1, w.z0, w.z1).map((p) => p.join(" ")).join(" L ") + " Z";
  const legs: [number, number][] = [[dk.x1 - dk.leg - 0.1, dk.y0 + 0.1], [dk.x0 + 0.1, dk.y1 - dk.leg - 0.1], [dk.x1 - dk.leg - 0.1, dk.y1 - dk.leg - 0.1]];
  const bk = ROOM.book;
  return (
    <g>
      <Polys polys={block([-X, 0, fz - 0.4], [X, 40, fz], u, o)} tones={ISO.floor} />
      <path d={d} fill={ISO.wall[1]} fillRule="evenodd" />
      <polygon points={ptsAttr([P(w.x0, -0.5, w.z0), P(w.x1, -0.5, w.z0), P(w.x1, 0, w.z0), P(w.x0, 0, w.z0)])} fill={ISO.wall[0]} />
      <Polys polys={block([w.x1, 0, w.z0 - ROOM.casing], [w.x1 + ROOM.casing, 0.3, w.z1 + ROOM.casing], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0 - ROOM.casing, 0, w.z0 - ROOM.casing], [w.x1, 0.3, w.z0], u, o)} tones={ISO.plastic} />
      <Polys polys={block([-X, 0, fz], [X, 0.3, fz + 2.8], u, o)} tones={ISO.plastic} />
      {legs.map(([x, y], i) => <Polys key={i} polys={block([x, y, fz], [x + dk.leg, y + dk.leg, ROOM.deskZ - ROOM.deskThick], u, o)} tones={DESK} />)}
      <Polys polys={block([dk.x0, dk.y0, ROOM.deskZ - ROOM.deskThick], [dk.x1, dk.y1, ROOM.deskZ], u, o)} tones={DESK} />
      <Polys polys={block([bk.at[0], bk.at[1], ROOM.deskZ], [bk.at[0] + bk.d, bk.at[1] + bk.w, ROOM.deskZ + bk.h], u, o)} tones={ISO.plastic} />
      <Polys polys={block([bk.at[0] + 0.2, bk.at[1] + 0.2, ROOM.deskZ + bk.h], [bk.at[0] + bk.d - 0.2, bk.at[1] + bk.w - 0.1, ROOM.deskZ + 2 * bk.h], u, o)} tones={ISO.dark} />
    </g>
  );
};
