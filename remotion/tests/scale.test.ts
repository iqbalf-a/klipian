/* One scale per set (DESIGN.md B27.7, src/roomScale.ts): `npm test`. Each piece of the colokan room, as the scene draws it, has the size of its real thing relative
   to the hero (the socket plate): within 15 % of the ratio in the table of real sizes. The lamp is drawn by IsoLife's IsoLamp at the scale the scene gives it. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAMP_OWN_H, PLATE_UNITS, REAL_SIZE_CM, ROOM, unitsOf } from "../src/roomScale.ts";

let n = 0;
const near = (drawn: number, cm: number, what: string) => { n++; const got = drawn / PLATE_UNITS, want = cm / REAL_SIZE_CM.socketPlate; assert.ok(Math.abs(got / want - 1) <= 0.15, `${what}: ${got.toFixed(2)} plates, the table says ${want.toFixed(2)}`); };
const w = ROOM.window;
near(w.z1 - w.z0, REAL_SIZE_CM.window.h, "the window's height");
near(w.x1 - w.x0, REAL_SIZE_CM.window.w, "the window's width");
near(ROOM.casing, REAL_SIZE_CM.windowCasing, "the window casing");
near(ROOM.deskThick, REAL_SIZE_CM.deskThickness, "the desk top's thickness");
near(0.5 - ROOM.deskZ, REAL_SIZE_CM.socketAboveDesk, "the socket's height above the desk");
near(w.z0 - ROOM.deskZ, REAL_SIZE_CM.windowSillAboveDesk, "the window sill above the desk");
// the lamp: IsoLamp is LAMP_OWN_H units tall at scale 1; the scene draws it at lamp.h / LAMP_OWN_H times the world scale
const scene = readFileSync(new URL("../videos/kenapa-colokan-panas/index.tsx", import.meta.url), "utf8");
n++; assert.ok(scene.includes("OUT.u * ROOM.lamp.h / LAMP_OWN_H"), "the scene scales the lamp from ROOM.lamp.h");
near(LAMP_OWN_H * (ROOM.lamp.h / LAMP_OWN_H), REAL_SIZE_CM.tableLamp, "the table lamp's height");
n++; assert.ok(Math.abs(unitsOf(REAL_SIZE_CM.socketPlate) - PLATE_UNITS) < 1e-9, "the hero is the plate");
const iso = readFileSync(new URL("../src/components/Iso.tsx", import.meta.url), "utf8");
n++; assert.ok(iso.includes("roundRectPts(0, SOCKET_Z, 2.4, 2.4"), "the plate is PLATE_UNITS wide in the kit");
console.log(`scale.test: ${n} checks ok`);
