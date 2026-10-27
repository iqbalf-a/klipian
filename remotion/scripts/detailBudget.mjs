// node scripts/detailBudget.mjs
//
// The detail budget of a hero asset (Style Bible v1, DESIGN.md section 0b, lock 3). The bar is the colokan socket + plug (the first video's hero).
// Each object is measured with two counts that the bar uses, and two that only inform:
//   shapes  the drawn SVG elements (polygon, polyline, path, circle, ellipse, line, rect, text), not counting clip paths        (bar)
//   parts   the groups that make the object (each <g>: a part with its own tones, rims or layers)                           (bar)
//   tones   the distinct fill or stroke colours (informational only: a three-tone material cannot have more than three tones)
//   colours the colours, each channel rounded to 8 levels, that cover at least 0.5 % of the object's own pixels (informational)
// An object passes when it reaches 80 % of the colokan's shapes AND 80 % of its parts. The markup comes from scripts/detailEntry.tsx (bundled with
// esbuild into out/detail/); the pixels come from the tile PNGs (ffmpeg crops). Writes out/detail/budget.json and prints the table. The nature tiles
// must be rendered first (NatureSheet: out/nature3/sheet.png).
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
  const parts = (drawn.match(/<g[\s>]/g) ?? []).length;
  return { shapes, parts, tones: colours.size };
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

const KEEP = new Set(["nature sea", "nature land", "nature trees", "nature pine tree", "nature round tree", "nature cloud white", "nature cloud grey"]);
const rows = [];
for (const o of OBJECTS) {
  if (o.name !== "colokan socket + plug" && !KEEP.has(o.name)) continue;
  const markup = countMarkup(o.markup);
  const buf = tilePixels(o.png, o.box);
  const px = buf ? quantColours(buf) : { quantColours: null, objectPx: null, plate: null };
  rows.push({ name: o.name, ...markup, colours: px.quantColours });
}
const bar = rows.find((r) => r.name === "colokan socket + plug");
for (const r of rows) {
  r.shapesOk = r.shapes >= 0.8 * bar.shapes;
  r.partsOk = r.parts >= 0.8 * bar.parts;
  r.passes = r.shapesOk && r.partsOk;
}
writeFileSync(path.join(OUT, "budget.json"), JSON.stringify({ bar: { shapes: bar.shapes, parts: bar.parts }, rows }, null, 2));
console.log("object".padEnd(24), "shapes", "parts", "pass", "  (tones, colours: info)");
for (const r of rows) {
  console.log(r.name.padEnd(24), String(r.shapes).padStart(6), String(r.parts).padStart(5), (r.passes ? "yes" : "no").padStart(4), `  (${r.tones}, ${r.colours ?? "-"})`);
}
console.log(`bar: 80% of colokan = ${(0.8 * bar.shapes).toFixed(0)} shapes and ${(0.8 * bar.parts).toFixed(0)} parts`);
