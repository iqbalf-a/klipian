/* One scale per set (DESIGN.md B27.7, src/roomScale.ts): `npm test`. Each piece of the colokan room, as the scene draws it, has the size of its real thing relative
   to the hero (the socket plate): within 15 % of the ratio in the table of real sizes. The lamp is drawn by IsoLife's IsoLamp at the scale the scene gives it. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAMP_OWN_H, PLATE_UNITS, REAL_SIZE_CM, ROOM, unitsOf } from "../src/roomScale.ts";

let n = 0;
const near = (drawn: number, cm: number, what: string) => { n++; const got = drawn / PLATE_UNITS, want = cm / REAL_SIZE_CM.socketPlate; assert.ok(Math.abs(got / want - 1) <= 0.15, `${what}: ${got.toFixed(2)} plates, the table says ${want.toFixed(2)}`); };
// B27.8: the wide establishing shot of the hook (and the loop-back) holds the whole set: the plan's WIDE camera is shared by the first and the last key
const plan = readFileSync(new URL("../videos/kenapa-colokan-panas/plan.ts", import.meta.url), "utf8");
n++; assert.ok(/\{ t: 0, \.\.\.WIDE \}/.test(plan) && /\{ t: total - 0\.2, \.\.\.WIDE \}/.test(plan), "the camera starts and ends on the same wide shot");
n++; assert.ok(/motion-exception:/.test(plan), "the wide push says why it leaves the push range");
const w = ROOM.window;
near(w.z1 - w.z0, REAL_SIZE_CM.window.h, "the window's height");
near(w.x1 - w.x0, REAL_SIZE_CM.window.w, "the window's width");
near(ROOM.casing, REAL_SIZE_CM.windowCasing, "the window casing");
near(ROOM.deskThick, REAL_SIZE_CM.deskThickness, "the desk top's thickness");
near(ROOM.desk.x1 - ROOM.desk.x0, REAL_SIZE_CM.sideTable.w, "the table's width");
near(ROOM.desk.y1 - ROOM.desk.y0, REAL_SIZE_CM.sideTable.d, "the table's depth");
near(ROOM.deskZ - ROOM.floorZ, REAL_SIZE_CM.sideTable.h, "the table's height");
near(ROOM.desk.leg, REAL_SIZE_CM.deskLeg, "the table's leg");
// the lamp: IsoLamp is LAMP_OWN_H units tall at scale 1; the scene draws it at lamp.h / LAMP_OWN_H times the world scale
const scene = readFileSync(new URL("../videos/kenapa-colokan-panas/index.tsx", import.meta.url), "utf8");
n++; assert.ok(scene.includes("OUT.u * ROOM.lamp.h / LAMP_OWN_H"), "the scene scales the lamp from ROOM.lamp.h");
near(LAMP_OWN_H * (ROOM.lamp.h / LAMP_OWN_H), REAL_SIZE_CM.tableLamp, "the table lamp's height");
n++; assert.ok(Math.abs(unitsOf(REAL_SIZE_CM.socketPlate) - PLATE_UNITS) < 1e-9, "the hero is the plate");
const iso = readFileSync(new URL("../src/components/Iso.tsx", import.meta.url), "utf8");
n++; assert.ok(iso.includes("roundRectPts(0, SOCKET_Z, 2.4, 2.4"), "the plate is PLATE_UNITS wide in the kit");
console.log(`scale.test: ${n} checks ok`);
