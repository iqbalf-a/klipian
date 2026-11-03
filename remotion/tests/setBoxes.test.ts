/* B27.9 "No overlap, no pass-through" for the colokan room (src/roomScale.ts ROOM.boxes): `npm test`. (a) no two boxes intersect, they may touch; (b) what stands has its base
   on its surface; (c) the cable never enters the lamp, stays on the table top, and ends at the lamp's cord point; (d) the pieces that touch are drawn in one parallax layer;
   (e) drawing order: a piece drawn later is never behind an earlier one on every axis (the painter's order of the iso camera). The strips of frames across the camera moves
   are checked by eye (out/style-audit). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOM } from "../src/roomScale.ts";
import { makePlan } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "../src/schema.ts";
import { FPS } from "../src/timeline.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const EPS = 1e-6, B = ROOM.boxes;
const overlap = (p: (typeof B)[number], q: (typeof B)[number]) => [0, 1, 2].every((k) => Math.min(p.b[k], q.b[k]) - Math.max(p.a[k], q.a[k]) > EPS);
for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) yes(!overlap(B[i], B[j]), `${B[i].name} and ${B[j].name} do not intersect`);
for (const b of B) if (b.stands !== undefined) yes(Math.abs(b.a[2] - b.stands) < EPS, `${b.name} stands on its surface (base z ${b.a[2].toFixed(3)} = ${b.stands.toFixed(3)})`);
// the table top is the surface of the lamp: the top face of the "table" box
const table = B.find((b) => b.name === "table")!, lamp = B.find((b) => b.name === "lampBase")!, shade = B.find((b) => b.name === "lampShade")!;
yes(Math.abs(table.b[2] - lamp.a[2]) < EPS && Math.abs(lamp.b[2] - shade.a[2]) < EPS, "the lamp's base is the table top");
yes(shade.a[0] >= table.a[0] && shade.b[0] <= table.b[0] && shade.a[1] >= table.a[1] && shade.b[1] <= table.b[1], "the lamp's widest part is on the table top");
// the plate keeps a real gap from the window's casing, and the lamp keeps off the wall
yes(ROOM.window.x1 + ROOM.casing < -1.2 - 2, "the casing is at least 2 units (7 cm) from the plate");
yes(shade.a[1] > 0.3, "the lamp keeps clear of the wall and the skirting");

// drawing order (the painter's order of the iso camera): of two boxes, the one drawn later may not lie behind the earlier one on all of x, y and z
const behind = (p: (typeof B)[number], q: (typeof B)[number]) => [0, 1, 2].every((k) => p.b[k] <= q.a[k] + EPS);   // p lies behind q: q must be drawn after p
for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) yes(!behind(B[j], B[i]) || [0, 1, 2].some((k) => B[i].b[k] <= B[j].a[k] + EPS), `${B[j].name} is not drawn over ${B[i].name} from behind`);

// the cable, in every frame
const v = validateStory(JSON.parse(readFileSync(new URL("../videos/kenapa-colokan-panas/story.json", import.meta.url), "utf8")));
if (!v.ok) throw new Error(v.errors.join("\n"));
const P = makePlan(v.story);
let inLamp = 0, offTable = 0, endErr = 0;
for (let f = 0; f < P.total * FPS; f++) {
  const c = P.cableAt(f / FPS);
  for (const p of c) {
    for (const bx of [lamp, shade]) if (p[0] > bx.a[0] + 0.02 && p[0] < bx.b[0] - 0.02 && p[1] > bx.a[1] + 0.02 && p[1] < bx.b[1] - 0.02 && p[2] > bx.a[2] && p[2] < bx.b[2] - 0.02) inLamp++;
    if (p[2] < ROOM.deskZ + 0.2 && (p[0] < table.a[0] || p[0] > table.b[0] || p[1] > table.b[1])) offTable++;
  }
  const e = c[c.length - 1], w = P.loopWeight(f / FPS);
  if (w === 0) endErr = Math.max(endErr, Math.hypot(e[0] - ROOM.lampCord[0], e[1] - ROOM.lampCord[1], e[2] - ROOM.lampCord[2]));
}
yes(inLamp === 0, `no node of the cable is inside the lamp's box (${inLamp} found)`);
yes(offTable === 0, `the cable lies on the table top, never past its edge (${offTable} nodes found)`);
yes(endErr < 0.1, `the cable's end stays at the lamp's cord point (worst ${endErr.toFixed(3)} units)`);

// the layers: every piece that touches another is in the p = 1 layer; the p = 1.35 layer holds loose motes only
const scene = readFileSync(new URL("../videos/kenapa-colokan-panas/index.tsx", import.meta.url), "utf8");
const near = scene.indexOf("layerTransform(oc, 1.35)"), nearEnd = scene.indexOf("{labelEls(\"out\")}");
const nearSrc = scene.slice(near, nearEnd);
yes(near > 0 && /<Motes/.test(nearSrc) && !/<Iso/.test(nearSrc), "the near layer holds only loose motes");
for (const el of ["<IsoRoomWall", "<IsoLamp", "<IsoWallSocket", "<IsoPlug"]) { const at = scene.indexOf(el); yes(at > 0 && (at < near || at > nearEnd), `${el} is in the p = 1 layer`); }
console.log(`setBoxes.test: ${n} checks ok`);
