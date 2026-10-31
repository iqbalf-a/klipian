/* The alive set (P28-R phase 5, DESIGN.md B25): `npm test`. The small motions of src/alive.ts (pure, bounded by the registry's ALIVE sizes, continuous), and every
   asset of src/components/IsoLife.tsx: it draws without a NaN, it is a pure function of its time (the same time, the same markup), it moves (the markup at two times
   differs), it takes its colours from the tokens, and it has its row in the dictionary and its tile on the mark sheet. The components are bundled with esbuild (the
   same way scripts/detailBudget.mjs does) because node does not run JSX. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { ALIVE, DENSITY } from "../src/motionLanguage.ts";
import { blinkClosed, bobPx, breatheScale, driftPx, flicker, heartBeat, pulse01, riseAt, spinDeg, swayDeg, tickDeg } from "../src/alive.ts";
import { DICTIONARY } from "../src/dictionary.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const grid = Array.from({ length: 600 }, (_, i) => i / 20);                      // 0 to 30 s every 0.05 s

// --- the registry: small amounts (an asset that dances is a distraction), and the density rule's numbers
yes(ALIVE.breatheAmp > 0 && ALIVE.breatheAmp <= 0.03, "breathing is at most 3 % of the size");
yes(ALIVE.swayDeg > 0 && ALIVE.swayDeg <= 3, "a sway is at most 3 degrees");
yes(ALIVE.bobPx > 0 && ALIVE.bobPx <= 8 && ALIVE.driftPx <= 20, "a bob is at most 8 px and a drift at most 20 px");
yes(ALIVE.flickerAmp <= 0.06, "a light flickers at most 6 %");
yes(DENSITY.aliveMax >= 1 && DENSITY.aliveMax <= 1.5 && DENSITY.newMax >= 3 && DENSITY.newMax <= 4, "the density rule: something moves every 1 to 1.5 s, something new every 3 to 4 s");

// --- the motions: bounded by their sizes, continuous (no jump between two frames), periodic where they should be
const bounded = (f: (t: number) => number, lo: number, hi: number, what: string) => yes(grid.every((t) => f(t) >= lo - 1e-9 && f(t) <= hi + 1e-9), what);
bounded((t) => breatheScale(t), 1 - ALIVE.breatheAmp, 1 + ALIVE.breatheAmp, "breatheScale stays within its amplitude");
bounded((t) => swayDeg(t), -ALIVE.swayDeg, ALIVE.swayDeg, "swayDeg stays within its degrees");
bounded((t) => bobPx(t), -ALIVE.bobPx, ALIVE.bobPx, "bobPx stays within its pixels");
bounded((t) => driftPx(t), -ALIVE.driftPx, ALIVE.driftPx, "driftPx stays within its pixels");
bounded((t) => pulse01(t), 0, 1, "pulse01 is between 0 and 1");
bounded((t) => heartBeat(t), 0, 1, "heartBeat is between 0 and 1");
bounded((t) => flicker(t), 1 - ALIVE.flickerAmp, 1 + ALIVE.flickerAmp, "flicker stays within its amplitude");
bounded((t) => riseAt(t, 0.3), 0, 1, "riseAt is between 0 and 1");
bounded((t) => blinkClosed(t), 0, 1, "blinkClosed is between 0 and 1");
const smooth = (f: (t: number) => number, step: number, what: string) => yes(grid.slice(1).every((t) => Math.abs(f(t) - f(t - 0.05)) <= step), what);
smooth(breatheScale, 0.01, "breatheScale has no jump");
smooth((t) => swayDeg(t), 0.5, "swayDeg has no jump");
smooth((t) => pulse01(t), 0.1, "pulse01 has no jump");
smooth((t) => heartBeat(t), 0.55, "heartBeat has no jump (a beat rises over about 4 frames)");
yes(Math.abs(breatheScale(0) - breatheScale(2.5)) < 1e-9, "breathing repeats every 2.5 s");
yes(Math.abs(heartBeat(0.1) - heartBeat(0.1 + 60 / ALIVE.heartBpm)) < 1e-9, "the heart repeats every beat");
// a heart beat has two peaks (lub-dub)
{
  const beat = Array.from({ length: 100 }, (_, i) => heartBeat((i / 100) * (60 / ALIVE.heartBpm)));
  const peaks = beat.filter((v, i) => i > 0 && i < 99 && v > beat[i - 1] && v >= beat[i + 1] && v > 0.5).length;
  yes(peaks === 2, `a heart beat has two peaks (${peaks})`);
}
// the clock: the second hand holds then ticks, 6 degrees a second, never goes backwards by more than the overshoot, and is on its second mark between ticks
yes(Math.abs(tickDeg(5.5) - 36) < 1e-9 && Math.abs(tickDeg(7.9) - 48) < 1e-9, "the second hand rests on its mark between ticks (6 degrees a second)");
yes(grid.slice(1).every((t) => tickDeg(t) >= tickDeg(t - 0.05) - 3), "the second hand overshoots by less than 3 degrees");
yes(spinDeg(1, 2) === 720 && spinDeg(0.25, 2) === 180, "spinDeg turns 360 degrees per turn");

// --- the assets: bundle IsoLife and render each one to markup
const out = path.join(ROOT, "out", "alive-test");
mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(ROOT, "src", "components", "IsoLife.tsx")], bundle: true, format: "esm", platform: "node", jsx: "automatic", outfile: path.join(out, "life.mjs"),
  external: ["remotion"], logLevel: "warning", banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const L = await import(pathToFileURL(path.join(out, "life.mjs")).href);
const { renderToStaticMarkup } = (await import("react-dom/server" as string)) as { renderToStaticMarkup: (e: never) => string };
const React = (await import("react" as string)) as { createElement: (c: unknown, p: unknown) => unknown };
const O: [number, number] = [300, 300];
const cases: [string, (t: number) => unknown][] = [
  ["IsoLamp", (t) => React.createElement(L.IsoLamp, { u: 100, o: O, t })], ["IsoKettle", (t) => React.createElement(L.IsoKettle, { u: 100, o: O, t, boil: 0.8 })],
  ["IsoFan", (t) => React.createElement(L.IsoFan, { u: 100, o: O, t })], ["IsoAir", (t) => React.createElement(L.IsoAir, { x: 100, y: 100, len: 200, t })],
  ["IsoClock", (t) => React.createElement(L.IsoClock, { u: 100, o: O, t, ring: 1 })], ["IsoCup", (t) => React.createElement(L.IsoCup, { u: 100, o: O, t })],
  ["IsoBattery", (t) => React.createElement(L.IsoBattery, { u: 100, o: O, t, level: 0.5 })], ["IsoHeart", (t) => React.createElement(L.IsoHeart, { u: 100, o: O, t })],
  ["IsoBrain", (t) => React.createElement(L.IsoBrain, { u: 100, o: O, t, busy: 1 })],
];
const lifeSource = read("src", "components", "IsoLife.tsx");
for (const [name, make] of cases) {
  const at = (t: number) => renderToStaticMarkup(make(t) as never);
  const a = at(1.25), b = at(1.25), c = at(1.75);
  yes(a.length > 400 && !/NaN|undefined|Infinity/.test(a), `${name} draws, with no NaN in it`);
  yes(a === b, `${name} is a pure function of its time`);
  yes(a !== c, `${name} moves (its markup differs half a second later)`);
  yes((a.match(/<(polygon|path|circle|ellipse|rect|line)\b/g) ?? []).length >= (name === "IsoAir" ? 4 : 12), `${name} has enough shapes (a mark: 4, an object: 12, more than a plain block)`);
  yes(!/#[0-9a-fA-F]{3,6}\b|linearGradient|radialGradient/.test(lifeSource), "IsoLife draws with the tokens only (no literal colour, no gradient)");
  const row = DICTIONARY.find((r) => r.components.some((k) => k.name === name));
  yes(!!row && row.status === "drawn", `${name} has its row in the dictionary (${row?.id})`);
}
yes(read("src", "MarkSheet.tsx").includes('case "brain":') && read("src", "AssetSheet.tsx").includes("life brain busy"), "the mark sheet and the asset sheet show the alive set");

console.log(`alive: ${n} checks ok`);
