// npm run new-video <slug> [story.json]   ->  videos/<slug>/ from templates/video/ (index.tsx, sfx.ts, meta.json, story.json)
//
// <slug> is lowercase letters, digits and hyphens (the folder name, and the composition id video-<slug>). The story is the CHECKED story of the klipian
// project (profiles/<id>/motion/<project>/story.json), copied in so the Studio and a render read the same words; without one the template's example
// story is used. Registered in Root automatically: `npm run studio` shows it as "video-<slug>". Refuses to overwrite a folder that exists.
// It also writes videos/<slug>/plan.ts (the formula's timing, from templates/video/plan.ts) and tests/<slug>.test.ts (from templates/video-test.tpl),
// and prints the library checklist: the marks of the dictionary, the detail numbers, and which videos use each one (reuse first, B5).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStory } from "../src/schema.ts";
import { DICTIONARY } from "../src/dictionary.ts";

export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Makes the folder; returns its path. `root` is where videos/ and templates/ live (the tests use a copy). */
export function newVideo(slug, storyFile, root = ROOT) {
  if (!SLUG.test(slug ?? "")) throw new Error("the name is lowercase letters, digits and hyphens, 2 to 39 characters, e.g. kenapa-hujan-turun");
  const dest = path.join(root, "videos", slug);
  const testFile = path.join(root, "tests", `${slug}.test.ts`);
  if (existsSync(dest)) throw new Error(`videos/${slug} already exists`);
  if (existsSync(testFile)) throw new Error(`tests/${slug}.test.ts already exists`);
  let story = null;
  if (storyFile) {
    const v = validateStory(JSON.parse(readFileSync(storyFile, "utf8")));
    if (!v.ok) throw new Error(`that story is not valid:\n${v.errors.join("\n")}`);
    story = v.story;
  }
  mkdirSync(dest, { recursive: true });
  const title = story ? story.titles[0] : slug.replace(/-/g, " ");
  const from = path.join(root, "templates", "video");
  for (const f of readdirSync(from)) {
    const text = readFileSync(path.join(from, f), "utf8").replaceAll("__SLUG__", slug).replaceAll("__TITLE__", title.replaceAll('"', "'"));
    writeFileSync(path.join(dest, f), text);
  }
  if (story) writeFileSync(path.join(dest, "story.json"), `${JSON.stringify(story, null, 2)}\n`);
  mkdirSync(path.dirname(testFile), { recursive: true });
  writeFileSync(testFile, readFileSync(path.join(root, "templates", "video-test.tpl"), "utf8").replaceAll("__SLUG__", slug));
  return dest;
}

/** The library checklist: every mark of the dictionary (drawn or to build) with the videos that draw it, and the detail numbers when they are measured. */
export function libraryChecklist(root = ROOT) {
  const videosDir = path.join(root, "videos");
  const videos = existsSync(videosDir) ? readdirSync(videosDir).filter((d) => existsSync(path.join(videosDir, d, "index.tsx"))) : [];
  const sources = (slug) => ["index.tsx", "plan.ts"].filter((f) => existsSync(path.join(videosDir, slug, f)))
    .map((f) => readFileSync(path.join(videosDir, slug, f), "utf8")).join("\n");
  const usedBy = (name) => videos.filter((v) => new RegExp(`<${name}[\\s/>]`).test(sources(v))).join(", ") || "none yet";
  const lines = ["library checklist (reuse first: at most three new assets per video, DESIGN.md B5):"];
  for (const r of DICTIONARY) {
    const names = r.components.map((c) => c.name);
    const users = [...new Set(names.map(usedBy))].join(", ");
    lines.push(`  ${r.status === "drawn" ? "drawn " : "to build"} ${r.id.padEnd(8)} ${r.thing}: ${names.join(", ") || "a spec only"}${names.length ? `; used by ${users}` : ""}`);
  }
  const budget = path.join(root, "out", "detail", "budget.json");
  if (existsSync(budget)) {
    const b = JSON.parse(readFileSync(budget, "utf8"));
    lines.push(`detail budget (the bar: ${b.bar.shapes} shapes, ${b.bar.parts} parts; 80 % is the pass):`);
    for (const r of b.rows) lines.push(`  ${r.name.padEnd(22)} ${String(r.shapes).padStart(4)} shapes ${String(r.parts).padStart(3)} parts ${r.passes ? "passes" : "below the bar"}`);
  } else lines.push("detail budget: not measured yet (node scripts/detailBudget.mjs)");
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const dest = newVideo(process.argv[2], process.argv[3]);
    console.log(`made ${path.relative(process.cwd(), dest)} and tests/${path.basename(dest)}.test.ts\nnext: npm run studio, then open the composition "video-${path.basename(dest)}"; read DESIGN.md first; add the test to the npm test script`);
    console.log(`\n${libraryChecklist()}`);
  } catch (e) { console.error(String(e.message ?? e)); process.exit(1); }
}
