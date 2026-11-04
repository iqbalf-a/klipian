/* The set kinds (DESIGN.md B27.15 and B27.16): every video stands in its OWN set. This file lists the KINDS of set (what each is, what it fits, how to build
   it); WHO uses a kind is not written here but in each video's own `videos/<slug>/set.json` ({"kind": "<id>"}), so a session adds its set by adding a file inside
   its own video folder and never edits this file or main. A kind is taken when some video's set.json names it (scripts/setOwners.mjs reads them).
   Read this BEFORE you design a video's set. `scripts/styleCheck.mjs` FAILs a video that draws the set of another video or names a kind that is taken, and FLAGs
   one without a set.json. `tests/sets.test.ts` checks this file. Pure data and small functions: no React, no file access here. */

export type SetStatus = "drawn" | "to build";
export type SetKind = {
  id: string;
  name: string;              // what the set is, in words
  status: SetStatus;         // drawn: the kind has a drawing in the kit (a video stands in it); to build: a recipe only
  signature: string[];       // the components that DRAW this set; using minMatch of them = drawing the set
  minMatch: number;
  fits: string;              // the topics that really happen in this place
  recipe: string;            // how to compose it from the iso kit (src/iso.ts) so it looks like the channel
};

export const SETS: readonly SetKind[] = [
  { id: "nature-landscape", name: "the wide nature diorama: a sea and a land with hills, fields, trees, bushes and rocks", status: "drawn",
    signature: ["IsoSea", "IsoLand", "IsoHill", "IsoHills", "IsoFields", "IsoTrees", "IsoBushes", "IsoRocks", "IsoFarHills", "IsoTreeShadows", "IsoPuddles"], minMatch: 4,
    fits: "only the rain video (rain falling on land and sea); a topic that is NOT about land, sea and fields must not stand in it, whatever the weather in the topic",
    recipe: "taken: do not draw it again, not even with other numbers of trees" },
  { id: "wall-room", name: "an indoor wall with a window and a bedside table", status: "drawn",
    signature: ["IsoRoomWall", "IsoWallSocket"], minMatch: 2,
    fits: "only the colokan video (a socket in a wall)", recipe: "taken: another room needs a different room (a kitchen, a classroom), not this wall" },
  { id: "bedroom", name: "a bedroom: bed, phone, lamp, clock", status: "drawn",
    signature: ["IsoBed", "IsoPhone"], minMatch: 2,
    fits: "only the sleepy-with-a-phone video", recipe: "taken" },
  { id: "seabed", name: "a seabed: far ridge, sand, kelp, bubbles (drawn inside the video's own index.tsx)", status: "drawn",
    signature: [], minMatch: 99,
    fits: "only the octopus video; another underwater topic needs another underwater place (open water, a reef wall, a trench)", recipe: "taken" },
  // ---- the free kinds: pick one of these when the topic fits, then build the set as an iso kit piece and declare it in videos/<slug>/set.json
  { id: "sky-horizon", name: "a wide sky over a thin horizon band (no sea, no fields): air, light, clouds, optics", status: "to build",
    signature: [], minMatch: 99,
    fits: "rainbow, why the sky is blue, sunset, lightning, wind, a plane in the air; the camera looks along the horizon, the hero hangs in the sky",
    recipe: "a vertical gradient of two sky tones, one far-hills strip at parallax 0.3, at most one cloud or sun as a single piece; NOT the nature diorama" },
  { id: "tabletop", name: "a table top seen from above: a cloth, a plate, a few things on it", status: "to build",
    signature: [], minMatch: 99,
    fits: "food, kitchen, magnets and fridge, a cup, a coin; objects small enough to hold", recipe: "one iso slab as the table, the hero on it, two or three real-size neighbours (B27.7)" },
  { id: "inside-body", name: "inside the body: a cut-away of an organ in soft tissue tones", status: "to build",
    signature: [], minMatch: 99, fits: "the heart, the brain, hiccups, sleep, digestion (explanations only, no medical advice)", recipe: "a cut-away slab in skin and organ tones, the organ as the hero, vessels as lines (B27.12)" },
  { id: "street-city", name: "a street with buildings, a road and a pavement", status: "to build",
    signature: [], minMatch: 99, fits: "traffic, buildings, bridges, power lines, money in a shop", recipe: "iso blocks for buildings (man-made things are boxes, B27.13), a road strip, a lamp post as a dressing piece" },
  { id: "space", name: "space: a dark sky, a planet or the sun as a sphere, a few stars", status: "to build",
    signature: [], minMatch: 99, fits: "the sun seen from space, the moon, seasons, gravity", recipe: "a dark brand tone, a single large sphere as the hero, no ground slab (B1's round stage may serve as the planet)" },
  { id: "lab-bench", name: "a lab bench with a few instruments", status: "to build",
    signature: [], minMatch: 99, fits: "an experiment: magnets, light and a prism, a battery and a bulb", recipe: "an iso slab as the bench, the experiment as the hero, two instruments as dressing" },
  { id: "underground", name: "a cross-section of the ground: soil layers, roots, water, pipes", status: "to build",
    signature: [], minMatch: 99, fits: "roots, wells, earthquakes, pipes, cables under the street", recipe: "a cut slab with layered soil tones, the hero in the cut, a thin strip of grass on top" },
] as const;

export type Owners = Record<string, string[]>;   // kind id -> the slugs whose set.json names it (scripts/setOwners.mjs builds it)

/** The kinds a video's source draws (by their signature components), with the components found. `source` is the text of the video's .ts and .tsx files. */
export function setsDrawn(source: string, kinds: readonly SetKind[] = SETS): { set: SetKind; found: string[] }[] {
  const out: { set: SetKind; found: string[] }[] = [];
  for (const set of kinds) {
    if (set.signature.length === 0) continue;
    const found = set.signature.filter((n) => new RegExp(`<${n}[\\s/>]`).test(source));
    if (found.length >= set.minMatch) out.push({ set, found });
  }
  return out;
}

/** The kinds this video draws that another video owns: each one is a FAIL (B27.15). */
export function borrowedSets(source: string, slug: string, owners: Owners, kinds: readonly SetKind[] = SETS): { set: SetKind; found: string[]; owner: string }[] {
  const out: { set: SetKind; found: string[]; owner: string }[] = [];
  for (const d of setsDrawn(source, kinds)) {
    const other = (owners[d.set.id] ?? []).find((o) => o !== slug);
    if (other) out.push({ ...d, owner: other });
  }
  return out;
}

/** The kind this video declares in its set.json, and the other videos that declare the same kind (a kind is used once). */
export function declaredKind(slug: string, owners: Owners): { kind: string | null; sharedWith: string[] } {
  const kind = Object.keys(owners).find((k) => owners[k].includes(slug)) ?? null;
  return { kind, sharedWith: kind ? owners[kind].filter((o) => o !== slug) : [] };
}

/** The kinds nobody declares: the ones a new video may pick. */
export function freeSets(owners: Owners, kinds: readonly SetKind[] = SETS): SetKind[] {
  return kinds.filter((k) => (owners[k.id] ?? []).length === 0);
}
