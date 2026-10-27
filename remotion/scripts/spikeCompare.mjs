// node scripts/spikeCompare.mjs <svg.png> <three.png>   (the Three.js spike, round 2: the numbers for the look comparison)
// Reads both pictures as raw RGB (ffmpeg), takes the object mask from the SVG picture (the pixels within 6 of an ISO object colour, outside the
// caption and top-text bands), and prints: the mean absolute RGB error over the mask, the share of mask pixels whose mean channel error is above 16,
// and the three-tone histogram (the share of mask pixels within 6 of each tone of the object kinds, in each picture).
import { execFileSync } from "node:child_process";
import { ISO } from "../src/tokens.ts";

const W = 1080, H = 1920;
const [svgPath, threePath] = process.argv.slice(2);
if (!svgPath || !threePath) { console.error("usage: node scripts/spikeCompare.mjs <svg.png> <three.png>"); process.exit(1); }

const raw = (file) => new Uint8Array(execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 * 1024 * 1024 }));
const parse = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
const KINDS = ["plastic", "wall", "floor", "dark", "metal", "brass", "labPlastic"];
const tones = [0, 1, 2].map((k) => KINDS.map((kind) => parse(ISO[kind][k])));   // tones[k] = the object colours of tone k
const objectColours = tones.flat();
const near = (a, i, c, d) => Math.abs(a[i] - c[0]) <= d && Math.abs(a[i + 1] - c[1]) <= d && Math.abs(a[i + 2] - c[2]) <= d;

const svg = raw(svgPath), three = raw(threePath);
const inBand = (y) => (y >= 1400 && y <= 1625) || y < 300;          // the caption band and the top text
let n = 0, sumErr = 0, above = 0;
const histS = [0, 0, 0], histT = [0, 0, 0];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (inBand(y)) continue;
  const i = (y * W + x) * 3;
  if (!objectColours.some((c) => near(svg, i, c, 6))) continue;     // the object mask (from the SVG picture)
  n++;
  const e = (Math.abs(svg[i] - three[i]) + Math.abs(svg[i + 1] - three[i + 1]) + Math.abs(svg[i + 2] - three[i + 2])) / 3;
  sumErr += e; if (e > 16) above++;
  for (let k = 0; k < 3; k++) {
    if (tones[k].some((c) => near(svg, i, c, 6))) histS[k]++;
    if (tones[k].some((c) => near(three, i, c, 6))) histT[k]++;
  }
}
const pct = (v) => (100 * v / n).toFixed(1) + " %";
console.log(JSON.stringify({
  maskPixels: n,
  meanAbsRgbError: +(sumErr / n).toFixed(2),
  shareAbove16: pct(above),
  histogramSvg: { light: pct(histS[0]), mid: pct(histS[1]), dark: pct(histS[2]) },
  histogramThree: { light: pct(histT[0]), mid: pct(histT[1]), dark: pct(histT[2]) },
}, null, 2));
