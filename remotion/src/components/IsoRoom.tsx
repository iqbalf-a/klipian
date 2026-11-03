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
const WOOD: Tones = [rgb([196, 172, 144]), rgb([168, 144, 116]), rgb([138, 114, 90])];
const X = 40, DEPTH = 14;

/** The wall with the window's hole, the window's casing and sill, and the desk top; draw it first in the p = 1 layer, the far layer shows through the hole. */
export const IsoRoomWall: React.FC<{ u: number; o: P2 }> = ({ u, o }) => {
  const P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o);
  const rect = (x0: number, x1: number, z0: number, z1: number) => [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)];
  const w = ROOM.window, d = "M " + rect(-X, X, ROOM_FLOOR_Z, 60).map((p) => p.join(" ")).join(" L ") + " Z M " + rect(w.x0, w.x1, w.z0, w.z1).map((p) => p.join(" ")).join(" L ") + " Z";
  const planks = Array.from({ length: 21 }, (_, k) => -20 + k * 2);
  return (
    <g>
      <Polys polys={block([-X, 0, ROOM_FLOOR_Z - ROOM.deskThick], [X, DEPTH, ROOM_FLOOR_Z], u, o)} tones={WOOD} />
      <path d={planks.map((x) => `M ${P(x, 0, ROOM_FLOOR_Z).join(" ")} L ${P(x, DEPTH, ROOM_FLOOR_Z).join(" ")}`).join(" ")} stroke={WOOD[1]} strokeWidth={3} opacity={0.7} fill="none" />
      <path d={d} fill={ISO.wall[1]} fillRule="evenodd" />
      {/* the inner faces of the opening (the sill looks up, the left jamb looks right), the casing on the wall beside it, the sill ledge */}
      <polygon points={ptsAttr([P(w.x0, -0.5, w.z0), P(w.x1, -0.5, w.z0), P(w.x1, 0, w.z0), P(w.x0, 0, w.z0)])} fill={ISO.wall[0]} />
      <Polys polys={block([w.x1, 0, w.z0 - ROOM.casing], [w.x1 + ROOM.casing, 0.3, w.z1 + ROOM.casing], u, o)} tones={ISO.plastic} />
      <Polys polys={block([w.x0 - ROOM.casing, 0, w.z0 - ROOM.casing], [w.x1, 0.3, w.z0], u, o)} tones={ISO.plastic} />
    </g>
  );
};

