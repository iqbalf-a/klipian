/* The wide diorama of the rain video (B27 "Set, not specimen" with B27.7 one scale, B27.9 no overlap, B27.10 the hero in the centre third inside SAFE, B27.11 no
   yellow behind the top text): `npm test`. The geometry of the extra pieces (src/natureGeometry.ts), the one scale (NATURE_SIZE_M in src/roomScale.ts), the plan's
   cameras (videos/cara-kerja-hujan-buatan/plan.ts) and the draw order of the video's source. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStory } from "../src/schema.ts";
import { FPS } from "../src/timeline.ts";
import { SAFE } from "../src/tokens.ts";
import { toScreen } from "../src/iso.ts";
import { BUSHES, BUSHES_WIDE, FIELDS, HILL, HILLS_WIDE, LAND, LAND_TOP, ROCKS, ROCKS_WIDE, SEA, TREES, TREES_WIDE, WORLD, crestsWide, footprints, inView, landTufts } from "../src/natureGeometry.ts";
import { NATURE_EXAGGERATED, NATURE_SIZE_M, NATURE_UNIT_M } from "../src/roomScale.ts";
import { CLOUD, CLOUD_PT, FAR, OUT, SPOT, WIDE, cloudBox, makePlan, spotScreen } from "../videos/cara-kerja-hujan-buatan/plan.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const v = validateStory(JSON.parse(read("videos", "cara-kerja-hujan-buatan", "story.json")));
if (!v.ok) throw new Error(v.errors.join("\n"));
const P = makePlan(v.story);
const within = (x: number, r: readonly number[]) => x >= r[0] && x <= r[1];
const EPS = 1e-6;

// --- the ground: the diorama's sea and land contain the stage's and go on past it; the land stands higher, they meet along x
yes(WORLD.sea.a[0] < SEA.a[0] && WORLD.sea.b[1] > SEA.b[1] && WORLD.sea.a[1] < SEA.a[1] && WORLD.sea.b[0] === SEA.b[0], "the wide sea contains the stage's sea and goes on to the back, the left and the front");
yes(WORLD.land.b[0] > LAND.b[0] && WORLD.land.b[1] > LAND.b[1] && WORLD.land.a[0] === LAND.a[0] && WORLD.land.a[1] < LAND.a[1], "the wide land contains the stage's land and goes on to the right and the front");
yes(WORLD.land.b[2] === LAND_TOP && WORLD.sea.b[2] < LAND_TOP, "the land is higher than the sea");

// --- B27.9: every piece on the land has a footprint on the land's top; none intersect, none go over the edge
{
  const fp = footprints();
  yes(fp.length > 40, `the land carries ${fp.length} pieces (hills, fields, trees, bushes, rocks, puddles)`);
  yes(fp.every((f) => f.x0 >= WORLD.land.a[0] && f.y0 >= WORLD.land.a[1] && f.x1 <= WORLD.land.b[0] && f.y1 <= WORLD.land.b[1]), "every piece stands on the land's top face");
  const hits: string[] = [];
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) {
    const a = fp[i], b = fp[j];
    // the stage's puddles lie on the grass round the trunks and bushes (water on the ground under the crown); everything else is solid, and a puddle never lies on a field or a hill
    if ((a.kind === "puddle" && ["tree", "bush", "rock"].includes(b.kind)) || (b.kind === "puddle" && ["tree", "bush", "rock"].includes(a.kind))) continue;
    if (a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS) hits.push(`${a.kind}(${a.x0.toFixed(2)},${a.y0.toFixed(2)}) x ${b.kind}(${b.x0.toFixed(2)},${b.y0.toFixed(2)})`);
  }
  yes(hits.length === 0, `no two pieces intersect (${hits.slice(0, 4).join("; ") || "none"})`);
  // the runoff channel and the stage's own pieces are the stage's (nature.test.ts); the grass tufts keep off every piece
  const tufts = landTufts();
  yes(tufts.length >= 40 && tufts.every(([x, y]) => fp.every((f) => !(x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1))), `${tufts.length} grass tufts, none on a piece`);
  // a hill is a stack: each step on the one under it, smaller, from the land's top
  yes(HILLS_WIDE.every((h) => h[0].a[2] === LAND_TOP && h.every((b, i) => i === 0 || (b.a[2] === h[i - 1].b[2] && b.a[0] > h[i - 1].a[0] && b.a[1] > h[i - 1].a[1] && b.b[0] < h[i - 1].b[0] && b.b[1] < h[i - 1].b[1]))), "every hill stands on the land and each step rests on the one under it");
  yes(FIELDS.every((f) => f.rows >= 5 && f.b[0] > f.a[0] && f.b[1] > f.a[1]), "every field has its rows");
}

// --- B27.7: one scale (NATURE_UNIT_M metres a unit); every piece in the range of what it really is; the sky things are exaggerated and listed
{
  const m = (units: number) => units * NATURE_UNIT_M;
  const trees = [...TREES, ...TREES_WIDE];
  yes(trees.every((t) => within(m(t.h), NATURE_SIZE_M.tree)), `every tree is 10 to 20 m (${Math.min(...trees.map((t) => m(t.h))).toFixed(0)} to ${Math.max(...trees.map((t) => m(t.h))).toFixed(0)} m)`);
  yes([...BUSHES, ...BUSHES_WIDE].every((b) => within(m(2.8 * b.r), NATURE_SIZE_M.bushClump)), "every bush is 4 to 8 m across");
  yes([...ROCKS, ...ROCKS_WIDE].every((r) => within(m(2 * r.s), NATURE_SIZE_M.rock)), "every rock is 3 to 5 m across");
  yes(FIELDS.every((f) => within(m(Math.max(f.b[0] - f.a[0], f.b[1] - f.a[1])), NATURE_SIZE_M.fieldLong)), "every field is 68 to 92 m long");
  yes(HILLS_WIDE.every((h) => within(m(h[h.length - 1].b[2] - LAND_TOP), NATURE_SIZE_M.hillHeight)), "every hill is 34 to 46 m high");
  yes(within(m(HILL.b[2] - HILL.a[2]), NATURE_SIZE_M.hillStep), "the stage's hill step is 4 to 8 m high");
  const cb = cloudBox(), cloudM = ((cb.x1 - cb.x0) / OUT.u) * NATURE_UNIT_M, planeM = (P.planeAt(P.m.plane + 1)!.w / OUT.u) * NATURE_UNIT_M;
  yes(Math.abs(cloudM / NATURE_EXAGGERATED.cloud.drawnM - 1) < 0.15, `the hero cloud is the listed exaggerated size (${cloudM.toFixed(0)} m for ${NATURE_EXAGGERATED.cloud.drawnM}; a real one is km wide)`);
  yes(Math.abs(planeM / NATURE_EXAGGERATED.plane.drawnM - 1) < 0.15, `the aircraft is the listed exaggerated size (${planeM.toFixed(0)} m for ${NATURE_EXAGGERATED.plane.drawnM}; a real one is about ${NATURE_EXAGGERATED.plane.realM} m)`);
  // the distance: a cloud further away is smaller and paler, only by its parallax and its own size, never bigger than the hero
  const width = (g: number, u: number) => 3.65 * g * u;
  const near = FAR.clouds06.map((c) => width(c.grow, c.u)), far = FAR.clouds03.map((c) => width(c.grow, c.u)), hero = cb.x1 - cb.x0;
  yes(Math.max(...near) < 0.6 * hero && Math.max(...far) < Math.min(...near), `the clouds at a distance are smaller than the hero (${Math.round(100 * Math.max(...near) / hero)} % at most) and the far ones smaller than the middle ones`);
}

// --- the sea's crests and the glints stay on the visible water
{
  const cs = crestsWide(0.3);
  yes(cs.length >= 60 && cs.every((c) => c.pts.every(([x, y]) => x >= WORLD.sea.a[0] && x <= SEA.b[0] && y >= WORLD.sea.a[1] && y <= WORLD.sea.b[1])), `${cs.length} crests, all on the sea's top face`);
  yes(crestsWide(0).every((c, i) => c.pts.every((q, k) => Math.abs(q[0] - crestsWide(1)[i].pts[k][0]) < 1e-9 && Math.abs(q[1] - crestsWide(1)[i].pts[k][1]) < 1e-9)), "the wide sea's crests are periodic in the phase");
  yes(inView(0, 0) && !inView(-8, 6) && !inView(10, -4), "the view predicate keeps what the widest shot can see");
}

// --- the cameras: B27.8 the establishing shot, B27.10 the hero in the middle third inside SAFE, the loop-back
{
  const cam0 = P.outCam(0.5), cb = cloudBox(), a = toScreen(cam0, [cb.x0, cb.y0]), b = toScreen(cam0, [cb.x1, cb.y1]);
  yes(a[0] >= SAFE.left && b[0] <= SAFE.right, `the hero cloud is inside SAFE in the establishing shot (x ${a[0].toFixed(0)} to ${b[0].toFixed(0)})`);
  const mid = (a[0] + b[0]) / 2;
  yes(mid >= 360 && mid <= 720, `the hero cloud's centre is in the middle third (x ${mid.toFixed(0)})`);
  yes((b[0] - a[0]) / 1080 >= 0.25 && (b[0] - a[0]) / 1080 <= 0.4, `the hero is about a third of the width in the wide shot (${Math.round(100 * (b[0] - a[0]) / 1080)} %)`);
  yes(P.outCam(0).zoom === WIDE.zoom && P.outCam(1.4).zoom === WIDE.zoom, "the hook holds the wide shot for 1.5 s");
  const c3 = P.outCam(3.0), cm = toScreen(c3, [cb.x0, cb.y0]), cn = toScreen(c3, [cb.x1, cb.y1]);
  yes((cn[0] - cm[0]) / 1080 >= 0.6 && (cn[0] - cm[0]) / 1080 <= 0.7, `then it pushes to the hero's main shot, 60 to 70 % of the width (${Math.round(100 * (cn[0] - cm[0]) / 1080)} %)`);
  const first = P.outCam(0), last = P.outCam(P.total);
  yes(first.x === last.x && first.y === last.y && first.zoom === last.zoom, "the loop-back returns to the wide shot (the last frame's camera is the first one's)");
  yes(/motion-exception:/.test(read("videos", "cara-kerja-hujan-buatan", "plan.ts")), "the faster establishing push says why (motion-exception)");
}

// --- B27.11: nothing yellow behind the top text's band (y 86 to 330) in any frame where it is on the screen
{
  let worst = Infinity, at = 0;
  const frames = Math.round(P.total * FPS);
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    if (!P.outsideVisible(t)) continue;
    const s = spotScreen(P.outCam(t));
    if (s.y - s.r < worst) { worst = s.y - s.r; at = t; }
  }
  yes(worst >= 330, `the brand spot's top edge stays under the top text's band (lowest ${worst.toFixed(0)} px at ${at.toFixed(1)} s; the band ends at 330)`);
  yes(SPOT.r > 0, "the spot is drawn in the far layer");
  // the sun of the first tip, behind the cloud
  let sunTop = Infinity;
  for (let f = 0; f < frames; f++) {
    const t = f / FPS, tp = P.tips[0];
    if (!tp || t < tp.from || t > tp.to + 0.5) continue;
    const cam = P.outCam(t), c = toScreen(cam, [CLOUD_PT[0] - 175, CLOUD_PT[1] - 120]);
    sunTop = Math.min(sunTop, c[1] - 72 * 1.75 * cam.zoom);
  }
  yes(sunTop >= 330, `the sun of the first tip is under the band (top ${sunTop.toFixed(0)} px)`);
}

// --- the video's source: the draw order and the three layers (B27.2)
{
  const src = read("videos", "cara-kerja-hujan-buatan", "index.tsx");
  const at = (tag: string) => src.indexOf(`<${tag} `);
  const seq = ["IsoSea", "IsoLand", "IsoHill", "IsoHills", "IsoFields", "IsoPuddles", "IsoTreeShadows", "IsoRunoff", "IsoBushes", "IsoRocks", "IsoTrees", "IsoRain"].map(at);
  yes(seq.every((i) => i > -1) && seq.every((x, i) => i === 0 || x > seq[i - 1]), "the video draws the sea, land, hills, fields, puddles, shadows, runoff, bushes, rocks, trees, rain in the depth order");
  yes(at("IsoFarHills") > -1 && at("IsoFarHills") < at("IsoSea"), "the far hills are drawn behind the stage");
  yes(/layerTransform\(oc, 0\.3\)/.test(src) && /layerTransform\(oc, 0\.6\)/.test(src) && /layerTransform\(oc, 1\.35\)/.test(src) && /<Motes /.test(src), "three depth layers: far (0.3, 0.6), the set (1), near (1.35, only dust)");
  yes(/<IsoSea [^>]*wide/.test(src) && /<IsoLand [^>]*wide/.test(src), "the sea and the land are the wide ones (they bleed past the frame)");
  yes(CLOUD.grow > 0, "the hero cloud stays one and the biggest");
}

console.log(`diorama: ${n} checks ok`);
