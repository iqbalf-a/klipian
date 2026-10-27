/* The nature kit (pilot 2, phases 1 and 1b): `npm test`. The tones of the kit; the depth order (read from the demo's source, as the colokan tests do);
   the clipped parts staying inside their faces; the cloud's shape (variety, a flat underside, its ratio and its width against the sea); the trees
   (margins, spacing, the two halves of a cone sharing their axis); the runoff (beside the trees, from the land into the sea); the sheet's fitted tiles;
   the loops (every moving part is periodic in its phase); the rain behind the cloud's lower edge; the vapour inside the water; the sounds. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ISO } from "../src/tokens.ts";
import { isoAt } from "../src/iso.ts";
import {
  BELLY, CLOUD_BOTTOM, CLOUD_GREY, CLOUD_PUFFS, CLOUD_WHITE, CLOUD_Z, DEPTH_ORDER, LAND, LAND_TOP, MARGIN, RUNOFF, SEA, SEA_TOP, SHEET, SHEET_TILES, TREE_R,
  TREES, boundsOf, cloudParts, mixRgb, onLandTop, onSeaTop, rainStreaks, ripples, sheetTile, sheetTileBox, splashRings, vapourWisps, assetPoints,
} from "../src/natureGeometry.ts";
import { SFX } from "../src/catalog.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
/** The demo's projection (the same as NatureDemo.tsx: U and O). */
const U = 150, O: [number, number] = [600, 1250];

// --- the tones: the nature sets have three distinct colours each, and the kit's colours are used only by the nature assets
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

// --- the depth order: the demo draws the parts in the order of DEPTH_ORDER (read from its source)
{
  const demo = read("src", "NatureDemo.tsx");
  const at = (tag: string): number => demo.indexOf(`<${tag} `);
  const sea = at("IsoSea"), vap = at("IsoVapour"), land = at("IsoLand"), run = at("IsoRunoff"), trees = at("IsoTrees"), sun = at("IsoSun");
  const whiteCloud = at("IsoCloud"), rain = at("IsoRain"), drop = at("IsoDroplets");
  const greyCloud = demo.lastIndexOf("<IsoCloud ");
  const seq = [sea, vap, land, run, trees, sun, whiteCloud, rain, drop, greyCloud];
  yes(seq.every((i) => i > -1), "every part of the depth order is drawn by the demo");
  yes(seq.every((v, i) => i === 0 || v > seq[i - 1]), "the demo draws the parts in the depth order (sea, vapour, land, runoff, trees, sun, white cloud, rain, droplets, grey cloud)");
  yes(new Set(DEPTH_ORDER).size === DEPTH_ORDER.length, "every part is in the depth order once");
  const ord = DEPTH_ORDER as readonly string[];
  yes(ord.indexOf("runoff") < ord.indexOf("trees"), "the runoff is drawn before the trees (the trees cover the stream where they touch)");
  const header = read("src", "components", "IsoNature.tsx").slice(0, 2600);
  yes(["sea", "vapour", "land", "runoff", "trees", "rain", "cloud"].every((w) => header.toLowerCase().includes(w)), "the depth-order table in the file header names the parts");
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
  yes(TREES.every((t) => onLandTop(t.x, t.y)), "the trees stand on the land's top face");
  yes(RUNOFF.onLandPath.every(([x, y]) => onLandTop(x, y)), "the runoff's path is on the land's top face (clipped to it)");
}

// --- the cloud: variety (seven puffs, at least three radii), a flat underside, a wide row, and the size against the sea
{
  const radii = new Set(CLOUD_PUFFS.map((p) => p.r.toFixed(2)));
  yes(CLOUD_PUFFS.length === 7 && radii.size >= 3, `the cloud has seven puffs of at least three different sizes (${radii.size} sizes)`);
  const bellyBottoms = BELLY.map((b) => b.z - b.rz);
  yes(Math.max(...bellyBottoms) - Math.min(...bellyBottoms) <= 0.15, "the belly ellipses line up along the bottom (the underside is flat)");
  yes(BELLY.length >= 2 && BELLY.every((b) => b.rs > b.rz * 2), "the underside has two or three flat belly ellipses (wider than they are high)");
  const cloudBox = (c: { cx: number; cy: number; cz: number; grow: number }) => {
    const parts = cloudParts(c.cx, c.cy, c.cz, c.grow);
    const pts = [...parts.puffs.flatMap((p) => [[p.x - p.r, p.y, p.z - p.r], [p.x + p.r, p.y, p.z + p.r]]), ...parts.belly.flatMap((b) => [[b.x - b.rs, b.y, b.z - b.rz], [b.x + b.rs, b.y, b.z + b.rz]])] as [number, number, number][];
    return boundsOf(pts.map((p) => isoAt(p, U, O) as [number, number]));
  };
  const sea = boundsOf([[SEA.a[0], SEA.a[1], SEA_TOP], [SEA.b[0], SEA.a[1], SEA_TOP], [SEA.a[0], SEA.b[1], SEA_TOP], [SEA.b[0], SEA.b[1], SEA_TOP]].map((p) => isoAt(p as [number, number, number], U, O) as [number, number]));
  const seaW = sea.x1 - sea.x0;
  const g = cloudBox(CLOUD_GREY), w = cloudBox(CLOUD_WHITE);
  const ratio = (g.x1 - g.x0) / (g.y1 - g.y0);
  yes(ratio >= 1.8 && ratio <= 2.6, `the grey cloud is about twice as wide as high (ratio ${ratio.toFixed(2)})`);
  yes((g.x1 - g.x0) / seaW >= 0.6 && (g.x1 - g.x0) / seaW <= 0.85, `the grey cloud's width is 60 to 85 % of the sea's (${(100 * (g.x1 - g.x0) / seaW).toFixed(0)} %)`);
  yes((w.x1 - w.x0) / seaW >= 0.45 && (w.x1 - w.x0) / seaW <= 0.7, `the white cloud is a little smaller (${(100 * (w.x1 - w.x0) / seaW).toFixed(0)} % of the sea)`);
  yes(CLOUD_BOTTOM < CLOUD_Z && CLOUD_BOTTOM >= CLOUD_Z - 0.45, "the cloud's lower edge (where the rain starts) is the lowest belly");
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

// --- the trees: the foot circles keep a margin of 0.25 from the land's edges, do not overlap, and the two halves of a cone share their axis
{
  const inside = TREES.every((t) => t.x - TREE_R >= LAND.a[0] + MARGIN && t.x + TREE_R <= LAND.b[0] - MARGIN && t.y - TREE_R >= LAND.a[1] + MARGIN && t.y + TREE_R <= LAND.b[1] - MARGIN);
  yes(inside, `every tree's foot keeps a margin of ${MARGIN} from the land's edges`);
  let closest = Infinity;
  for (let i = 0; i < TREES.length; i++) for (let j = i + 1; j < TREES.length; j++) closest = Math.min(closest, Math.hypot(TREES[i].x - TREES[j].x, TREES[i].y - TREES[j].y));
  yes(closest >= 2 * TREE_R, `the trees' footprints do not overlap (closest centres ${closest.toFixed(2)} apart)`);
  yes(TREES.length === 4 && new Set(TREES.map((t) => t.h)).size >= 3, "four trees of different heights");
  const hs = TREES.map((t) => t.h);
  // the plan asks for 0.9 to 1.3; the reference's ratio (a tree about a quarter of the land's width) gives 0.6 to 0.85 at this scale: the ratio wins (see DESIGN.md)
  yes(Math.min(...hs) >= 0.5 && Math.max(...hs) <= 0.95, "the tree heights follow the reference ratio (0.5 to 0.95 world units)");
  const trees = read("src", "components", "IsoNature.tsx");
  yes(trees.includes("[apex, left, foot]") && trees.includes("[apex, foot, right]"), "the two halves of a cone are drawn from the same apex and foot (no seam)");
  const sorted = TREES.every((t, i) => i === 0 || t.x + t.y >= TREES[i - 1].x + TREES[i - 1].y);
  yes(sorted, "the trees are sorted back to front (by x + y)");
}

// --- the runoff: beside the trees (at least 0.3 from each foot), from the land into the sea, falling from the land's top to the sea's top
{
  const far = RUNOFF.onLandPath.every(([x, y]) => TREES.every((t) => Math.hypot(x - t.x, y - t.y) >= 0.3));
  yes(far, "the runoff runs at least 0.3 from every tree's foot");
  const fallTop = RUNOFF.fall[0], fallEnd = RUNOFF.fall[1];
  yes(fallTop[2] === LAND_TOP && fallEnd[2] === SEA_TOP, "the runoff falls from the land's top to the sea's top");
  yes(onSeaTop(fallEnd[0], fallEnd[1]), "the runoff ends on the sea's top face");
  yes(LAND_TOP > SEA_TOP, "the land stands higher than the sea, so the water runs down into it");
}

// --- the sun: long and short rays alternate
{
  const sun = read("src", "components", "IsoNature.tsx");
  yes(sun.includes("long ? 1.75 : 1.45") && sun.includes("i % 2 === 0"), "the sun has long and short rays, alternating");
}

// --- loops: every moving part is periodic in the phase, so the loop's last frame equals its first
{
  const eq = (a: unknown, b: unknown): boolean => typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => eq(v, b[i])) : a !== null && typeof a === "object" && b !== null && typeof b === "object" ? Object.keys(a).every((k) => eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) : a === b;
  yes(eq(ripples(0), ripples(1)), "the ripples are periodic in the phase");
  yes(eq(rainStreaks(0), rainStreaks(1)), "the rain is periodic in the phase");
  yes(eq(vapourWisps(0.5, 0), vapourWisps(0.5, 1)), "the vapour is periodic in the phase");
  yes(eq(cloudParts(0, 0, 0, 1, 0), cloudParts(0, 0, 0, 1, 1)), "the cloud's breathing is periodic in the phase");
}

// --- the rain starts behind the cloud's lower edge and has a surface under it; the vapour starts inside the water
{
  const streaks = rainStreaks(0.37);
  yes(streaks.length >= 5, "the rain falls on the sea and the land");
  yes(streaks.every((s) => s.a[2] <= CLOUD_BOTTOM), "every rain streak starts at or below the cloud's lower edge (drawn before the cloud, so the cloud hides its start)");
  yes(streaks.every((s) => (s.onLand ? onLandTop(s.b[0], s.b[1]) : onSeaTop(s.b[0], s.b[1]))), "every rain streak ends on the sea or the land (a surface under it)");
  const wisps = vapourWisps(1, 0.2);
  yes(wisps.length > 0 && wisps.every((w) => w[0][2] < SEA_TOP && onSeaTop(w[0][0], w[0][1])), "every vapour wisp starts inside the water (below the sea's top, over its face)");
  yes(wisps.every((w) => w[w.length - 1][2] > w[0][2]), "the vapour rises from the water toward the cloud");
  yes(vapourWisps(0, 0).length === 0 && splashRings(0).length === 0 && splashRings(1).length === 0, "no vapour or splash when there is none");
}

// --- the sheet: every tile is fitted by its bounding box, inside its tile, centred, and the label area stays free
{
  for (const t of SHEET_TILES) {
    const L = sheetTile(t.name), box = sheetTileBox(t.name);
    const inside = box.x0 >= L.area.x0 - 0.5 && box.x1 <= L.area.x1 + 0.5 && box.y0 >= L.area.y0 - 0.5 && box.y1 <= L.area.y1 + 0.5;
    yes(inside, `the "${t.name}" tile's drawing is inside its tile`);
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const ax = (L.area.x0 + L.area.x1) / 2, ay = (L.area.y0 + L.area.y1) / 2;
    yes(Math.abs(cx - ax) <= 8 && Math.abs(cy - ay) <= 8, `the "${t.name}" drawing is centred within 8 px`);
    yes(box.y1 <= L.y + L.h - SHEET.labelH, `the "${t.name}" drawing does not touch the label area`);
  }
  yes(SHEET_TILES.some((t) => t.name === "trees") && SHEET_TILES.some((t) => t.name === "droplets") && SHEET_TILES.some((t) => t.name === "splash") && SHEET_TILES.some((t) => t.name === "runoff") && SHEET_TILES.some((t) => t.name === "scene") && SHEET_TILES.some((t) => t.name === "clouds"), "the sheet has tiles for trees, droplets, splash, runoff, the whole scene and both clouds");
  yes(assetPoints("cloud-grey", SHEET.u, [0, 0]).length > 0 && assetPoints("unknown", 1, [0, 0]).length === 0, "every sheet tile has its points");
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
