// node scripts/detailBudget.mjs
//
// The detail budget of the nature kit (phase 1c): for each object, three numbers, the same way for the colokan (the bar) and the nature assets:
//   shapes        the drawn SVG elements (polygon, polyline, path, circle, ellipse, line, rect, text), not counting clip paths
//   toneRegions   the distinct fill or stroke colours of those elements (the tones of the parts)
//   quantColours  the colours, each channel rounded to 8 levels, that cover at least 0.5 % of the object's own pixels in its rendered tile
// The markup comes from scripts/detailEntry.tsx (bundled with esbuild into out/detail/); the pixels come from the tile PNGs (ffmpeg crops).
// Writes out/detail/budget.json and prints the table. The nature tiles must be rendered first (NatureSheet, NatureDemo).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "detail");
mkdirSync(OUT, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(ROOT, "scripts", "detailEntry.tsx")], bundle: true, format: "esm", platform: "node", jsx: "automatic",
  outfile: path.join(OUT, "entry.mjs"), external: ["remotion"], logLevel: "warning",
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const E = await import(pathToFileURL(path.join(OUT, "entry.mjs")).href);

// the objects: the colokan's tile in the colokan sheet (video scale, 1080 px wide), and each nature tile in the nature sheet (the same scale)
const COKAN_SHEET = path.join(ROOT, "out", "assets-sheet-iso.png");
const NATURE_SHEET = path.join(ROOT, "out", "nature3", "sheet.png");
const OBJECTS = [
  { name: "colokan socket + plug", markup: E.colokanMarkup(), png: COKAN_SHEET, box: [40, 370, 330, 420] },
  ...(E.natureObjects ? E.natureObjects() : []).map((o) => ({ ...o, png: NATURE_SHEET })),
];

const SHAPE_TAG = /<(polygon|polyline|path|circle|ellipse|line|rect|text)\b([^>]*)>/g;
export function countMarkup(markup) {
  const drawn = markup.replace(/<clipPath\b[\s\S]*?<\/clipPath>/g, "");
  let shapes = 0;
  const colours = new Set();
  for (const [, , attrs] of drawn.matchAll(SHAPE_TAG)) {
    shapes++;
    for (const key of ["fill", "stroke"]) {
      const m = attrs.match(new RegExp(`${key}="([^"]+)"`));
      if (m && m[1] !== "none") colours.add(m[1]);
    }
  }
  return { shapes, toneRegions: colours.size };
}

// the pixels of a tile, as rgb bytes (ffmpeg crops the PNG)
function tilePixels(png, [x, y, w, h]) {
  if (!existsSync(png)) return null;
  return execFileSync("ffmpeg", ["-v", "error", "-i", png, "-vf", `crop=${w}:${h}:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1 << 28 });
}
const key8 = (buf, i) => `${buf[i] >> 5},${buf[i + 1] >> 5},${buf[i + 2] >> 5}`;

// the colours (8 levels a channel) that cover at least 0.5 % of the object's pixels; the object is every pixel that is not the tile's plate colour
export function quantColours(buf) {
  const count = new Map();
  for (let i = 0; i < buf.length; i += 3) count.set(key8(buf, i), (count.get(key8(buf, i)) ?? 0) + 1);
  const plate = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const obj = new Map();
  let objectPx = 0;
  for (let i = 0; i < buf.length; i += 3) {
    const k = key8(buf, i);
    if (k === plate) continue;
    objectPx++;
    obj.set(k, (obj.get(k) ?? 0) + 1);
  }
  const kept = [...obj.values()].filter((n) => n >= 0.005 * objectPx).length;
  return { quantColours: kept, objectPx, plate };
}

const rows = [];
for (const o of OBJECTS) {
  const markup = countMarkup(o.markup);
  const buf = tilePixels(o.png, o.box);
  const px = buf ? quantColours(buf) : { quantColours: null, objectPx: null, plate: null };
  rows.push({ name: o.name, ...markup, ...px });
}
writeFileSync(path.join(OUT, "budget.json"), JSON.stringify(rows, null, 2));
console.log("object".padEnd(30), "shapes", "tones", "colours", "object px");
for (const r of rows) console.log(r.name.padEnd(30), String(r.shapes).padStart(6), String(r.toneRegions).padStart(5), String(r.quantColours ?? "-").padStart(7), String(r.objectPx ?? "-").padStart(10));
