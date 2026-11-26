// The six axes a video is compared on with each of the last 10 (DESIGN.md "Q3 six axes"): structure, opening, signature move, camera path, music, ending.
// "Different" on at least 4 of the 6 axes from every one of them; 3 or more equal axes with one video is a FLAG in styleCheck.mjs.
// Everything is read from the files: story.json (beat kinds, camera, transition, music) and the video's .ts/.tsx (the `// PUSH+ORBIT: ...` shot comments of B59/B66,
// the `signature-moment: <beat id> | <the move in 2 to 4 words>` comment of plan.ts).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const src = (dir) => readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");

/** The six-axis profile of one video folder, or null when it has no story. */
export function profileOf(dir) {
  const sf = path.join(dir, "story.json");
  if (!existsSync(sf)) return null;
  const story = JSON.parse(readFileSync(sf, "utf8")), beats = story.beats ?? [], code = src(dir);
  const shotMoves = [...code.matchAll(/\/\/\s*([A-Z][A-Z+\-]{2,}):/g)].map((m) => m[1]);                  // "// PUSH+ORBIT+ROLL: sentence"
  const beatMoves = beats.map((b) => b.camera?.kind).filter(Boolean);
  const cam = shotMoves.length ? shotMoves : beatMoves;
  const sig = /signature-moment:\s*([^\n*]+)/.exec(code)?.[1]?.trim() ?? null;                              // "<beat id> | <the move>"
  const move = sig ? (sig.split("|")[1] ?? sig).trim().toLowerCase() : null;
  const first = beats[0], last = beats[beats.length - 1];
  const edge = (b, shot) => { const t = [b?.camera?.kind ?? shot, b?.transition?.kind].filter(Boolean); return t.length ? [b?.kind, ...t].join("/") : null; };   // only a camera or a transition says something: the kind alone is the fixed formula
  return {
    structure: beats.map((b) => b.kind).join(">"),
    opening: edge(first, shotMoves[0]),
    signature: move,
    cam,
    music: story.music?.track ?? (/track:\s*"([\w-]+)"/.exec(code)?.[1] ?? null),
    ending: edge(last, shotMoves[shotMoves.length - 1]),
    sigRaw: sig,
  };
}

const bigrams = (a) => new Set(a.slice(1).map((x, i) => `${a[i]}>${x}`));
const jaccard = (a, b) => { const A = bigrams(a), B = bigrams(b); if (!A.size && !B.size) return 1; const n = [...A].filter((x) => B.has(x)).length; return n / (A.size + B.size - n); };

/** Which axes are equal between two profiles: an array of axis names. */
export function sameAxes(a, b) {
  const s = [];
  if (a.structure === b.structure) s.push("structure");
  if (a.opening && a.opening === b.opening) s.push("opening");
  if (a.signature && b.signature && a.signature === b.signature) s.push("signature");
  if (a.cam.length > 2 && b.cam.length > 2 && jaccard(a.cam, b.cam) >= 0.6) s.push("camera path");
  if (a.music && a.music === b.music) s.push("music");
  if (a.ending && a.ending === b.ending) s.push("ending");
  return s;
}
