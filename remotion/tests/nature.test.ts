/* The nature kit (pilot 2, phase 1): `npm test`. The tones of the kit, the depth order (read from the demo's source, as the colokan tests do), the
   clipped parts staying inside their faces, the cloud's dark range, the loops (every moving part is periodic in its phase), the rain starting behind
   the cloud's lower edge, the vapour starting inside the water, and the three new sounds. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ISO } from "../src/tokens.ts";
import {
  CLOUD_BOTTOM, DEPTH_ORDER, LAND, SEA_TOP, cloudPuffs, mixRgb, onSeaTop, rainStreaks, ripples, splashRings, vapourWisps,
} from "../src/natureGeometry.ts";
import { SFX } from "../src/catalog.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");

// --- the tones: the nature sets have three colours each, and the kit's colours are used only by the nature assets
const NATURE = ["water", "soil", "grass", "leaf", "cloudWhite", "cloudGrey", "sun"] as const;
for (const k of NATURE) yes(ISO[k].length === 3 && new Set(ISO[k]).size === 3, `the ${k} tones are three distinct colours`);
{
  const natureFiles = new Set(["src/components/IsoNature.tsx", "src/NatureDemo.tsx", "src/NatureSheet.tsx", "src/tokens.ts", "src/natureGeometry.ts"]);
  const files = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const offenders: string[] = [];
  for (const f of files("src").filter((f) => /\.(ts|tsx)$/.test(f))) {
    const rel = f.split(path.sep).join("/");
    if (natureFiles.has(rel)) continue;
    const text = readFileSync(path.join(ROOT, f), "utf8");
    for (const k of NATURE) if (new RegExp(`ISO\\.${k}\\b`).test(text)) offenders.push(`${rel}: ISO.${k}`);
  }
  yes(offenders.length === 0, `the nature tones are used only by the nature assets (${offenders.join("; ") || "none"})`);
}

// --- the depth order: the demo draws the parts in the order of DEPTH_ORDER (read from the source, as the colokan tests read theirs)
{
  const demo = read("src", "NatureDemo.tsx");
  const map: Record<string, string> = { sea: "IsoSea", vapour: "IsoVapour", land: "IsoLand", runoff: "IsoRunoff", sun: "IsoSun", rain: "IsoRain", droplets: "IsoDroplets", cloud: "IsoCloud" };
  const drawn = DEPTH_ORDER.filter((k) => k in map).map((k) => ({ k, at: demo.indexOf(`<${map[k]} `) }));
  yes(drawn.every((d) => d.at > -1), "every part of the depth order is drawn by the demo");
  yes(drawn.every((d, i) => i === 0 || d.at > drawn[i - 1].at), `the demo draws the parts in the depth order (${drawn.map((d) => d.k).join(" < ")})`);
  yes(new Set(DEPTH_ORDER).size === DEPTH_ORDER.length, "every part is in the depth order once");
  const header = read("src", "components", "IsoNature.tsx").slice(0, 2000);
  yes(["sea", "vapour", "land", "rain", "cloud"].every((w) => header.toLowerCase().includes(w)), "the depth-order table in the file header names the parts");
}

// --- clipped parts stay inside their faces: the ripples and the splash on the sea's top, the trees and the runoff on the land's top
{
  let worst = "";
  for (let k = 0; k <= 20; k++) for (const r of ripples(k / 20)) for (const [x, y] of r.pts) if (!onSeaTop(x, y) && worst === "") worst = `ripple at phase ${k / 20}`;
  for (let k = 0.05; k < 1; k += 0.05) for (const s of splashRings(k)) for (let a = 0; a < 24; a++) {
    const x = s.x + s.r * Math.cos((a / 24) * Math.PI * 2), y = s.y + s.r * Math.sin((a / 24) * Math.PI * 2);
    if (!onSeaTop(x, y) && worst === "") worst = `splash ring at k ${k.toFixed(2)}`;
  }
  yes(worst === "", `the ripples and the splash rings stay inside the sea's top face (first outside: ${worst || "none"})`);
  const onLand = (x: number, y: number) => x >= LAND.a[0] && x <= LAND.b[0] && y >= LAND.a[1] && y <= LAND.b[1];
  const trees = [[1.1, 0.0], [1.5, -0.2], [1.9, 0.2]];
  yes(trees.every(([x, y]) => onLand(x, y)), "the trees stand on the land's top face");
  const runoff = [[1.0, -0.6], [1.2, -0.1], [1.0, 0.3]];
  yes(runoff.every(([x, y]) => onLand(x, y)), "the runoff is on the land's top face (clipped to it)");
}

// --- the cloud darkens from white (0) to grey (1), and the mix is monotone
{
  const white = ISO.cloudWhite[1], grey = ISO.cloudGrey[1];
  yes(mixRgb(white, grey, 0) === white && mixRgb(white, grey, 1) === grey, "the cloud's dark 0 is its white and 1 is its grey");
  const lum = (c: string) => c.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0);
  let mono = true;
  for (let k = 0; k < 1; k += 0.05) if (lum(mixRgb(white, grey, k + 0.05)) > lum(mixRgb(white, grey, k))) mono = false;
  yes(mono, "the cloud gets darker monotonically as dark goes from 0 to 1");
}

// --- loops: every moving part is periodic in the phase, so the loop's last frame equals its first
{
  // equal up to floating-point noise (a sine of a phase and of the phase plus one differ in the last bits)
  const eq = (a: unknown, b: unknown): boolean => typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => eq(v, b[i])) : a !== null && typeof a === "object" && b !== null && typeof b === "object" ? Object.keys(a).every((k) => eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) : a === b;
  yes(eq(ripples(0), ripples(1)), "the ripples are periodic in the phase");
  yes(eq(rainStreaks(0), rainStreaks(1)), "the rain is periodic in the phase");
  yes(eq(vapourWisps(0.5, 0), vapourWisps(0.5, 1)), "the vapour is periodic in the phase");
  yes(eq(cloudPuffs(1, 0), cloudPuffs(1, 1)), "the cloud's breathing is periodic in the phase");
}

// --- the rain starts behind the cloud's lower edge; the vapour starts inside the water
{
  const streaks = rainStreaks(0.37);
  yes(streaks.every((s) => s.a[2] <= CLOUD_BOTTOM), "every rain streak starts at or below the cloud's lower edge (drawn before the cloud, so the cloud hides its start)");
  const wisps = vapourWisps(1, 0.2);
  yes(wisps.length > 0 && wisps.every((w) => w[0][2] < SEA_TOP && onSeaTop(w[0][0], w[0][1])), "every vapour wisp starts inside the water (below the sea's top, over its face)");
  yes(wisps.every((w) => w[w.length - 1][2] > w[0][2]), "the vapour rises from the water toward the cloud");
  yes(vapourWisps(0, 0).length === 0, "no vapour when there is none");
  yes(splashRings(0).length === 0 && splashRings(1).length === 0, "no splash before or after the drop");
}

// --- the new sounds: in the table, in the licence list, and their files exist
{
  for (const name of ["rain-patter", "drip", "bubble-rise"] as const) {
    yes(name in SFX, `the sound "${name}" is in the SFX table`);
    yes(existsSync(path.join(ROOT, "sfx", "wav", `${name}.wav`)), `the sound "${name}" has its wav file`);
    yes(read("sfx", "LICENSES.md").includes(`\`${name}.wav\``), `the sound "${name}" is in LICENSES.md`);
    yes(read("sfx", "synth.mjs").includes(`"${name}"`), `the sound "${name}" is synthesised in sfx/synth.mjs`);
  }
  yes(Math.max(SFX["rain-patter"].dur, SFX["drip"].dur, SFX["bubble-rise"].dur) <= 1, "the new sounds are short (at most a second)");
}

console.log(`nature: ${n} checks ok`);
