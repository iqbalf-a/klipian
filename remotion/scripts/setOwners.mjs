/* Who stands in which set kind: reads videos/<slug>/set.json ({"kind": "<id>", and for a NEW kind also "name", "fits", "recipe", and optionally "signature" and
   "minMatch"}). Used by styleCheck.mjs and tests/sets.test.ts. A video registers its set by adding this one file inside its own folder: nothing outside the
   video's folder changes, so the stock branch needs no edit to a shared file (B27.15). */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SETS } from "../src/sets.ts";

/** { owners: kind id -> slugs, kinds: SETS plus the new kinds the videos declare, problems: unreadable set.json files } */
export function loadSetOwners(videosDir) {
  const owners = {}, kinds = [...SETS], problems = [];
  const dirs = existsSync(videosDir) ? readdirSync(videosDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
  for (const slug of dirs) {
    const file = path.join(videosDir, slug, "set.json");
    if (!existsSync(file)) continue;
    let j;
    try { j = JSON.parse(readFileSync(file, "utf8")); } catch (e) { problems.push(`${slug}/set.json is not valid JSON`); continue; }
    if (typeof j.kind !== "string" || !/^[a-z0-9-]{2,40}$/.test(j.kind)) { problems.push(`${slug}/set.json needs "kind": a lowercase id`); continue; }
    if (!kinds.some((k) => k.id === j.kind)) {
      if (!j.name || !j.fits) { problems.push(`${slug}/set.json names a new kind "${j.kind}": add "name" and "fits"`); continue; }
      kinds.push({ id: j.kind, name: j.name, status: "drawn", signature: Array.isArray(j.signature) ? j.signature : [], minMatch: j.minMatch ?? 99, fits: j.fits, recipe: j.recipe ?? "a new set" });
    }
    (owners[j.kind] ??= []).push(slug);
  }
  return { owners, kinds, problems };
}
