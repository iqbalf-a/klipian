/* Custom videos (videos/<slug>/, scripts/new-video.mjs, templates/video/): `npm test`. The scaffold makes a folder from the template, names it,
   refuses a bad name, a folder that exists and a story that is not valid; the template's story and the selftest video's story are valid; every
   video folder has what the registry needs. */
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { newVideo, SLUG } from "../scripts/new-video.mjs";
// @ts-expect-error plain JS
import { checkImports } from "../scripts/importCheck.mjs";
import { validateStory } from "../src/schema.ts";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const throws = (fn: () => unknown, re: RegExp, what: string) => { n++; assert.throws(fn, re, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const valid = (f: string) => validateStory(JSON.parse(readFileSync(f, "utf8"))).ok;

yes(valid(path.join(ROOT, "templates", "video", "story.json")), "the template's story is valid");
for (const slug of readdirSync(path.join(ROOT, "videos"))) {
  const d = path.join(ROOT, "videos", slug);
  yes(SLUG.test(slug), `videos/${slug}: a folder name that is a composition id`);
  yes(existsSync(path.join(d, "index.tsx")) && valid(path.join(d, "story.json")), `videos/${slug}: index.tsx and a valid story.json`);
  const index = readFileSync(path.join(d, "index.tsx"), "utf8");
  yes(/export const Video\b/.test(index) && /export const story\b/.test(index), `videos/${slug}: exports Video and story`);
  if (existsSync(path.join(d, "meta.json"))) yes(typeof JSON.parse(readFileSync(path.join(d, "meta.json"), "utf8")).title === "string", `videos/${slug}: meta.json has a title`);
}

const root = mkdtempSync(path.join(tmpdir(), "klipian-newvideo-"));
cpSync(path.join(ROOT, "templates"), path.join(root, "templates"), { recursive: true });
const made = newVideo("kenapa-hujan-turun", undefined, root);
const files = readdirSync(made).sort();
yes(files.join() === "index.tsx,meta.json,plan.ts,sfx.ts,story.json", `the scaffold makes ${files.join(", ")}`);
yes(existsSync(path.join(root, "tests", "kenapa-hujan-turun.test.ts")), "the scaffold also makes tests/kenapa-hujan-turun.test.ts (from the test skeleton)");
const index = readFileSync(path.join(made, "index.tsx"), "utf8");
yes(!index.includes("__SLUG__") && !index.includes("__TITLE__") && index.includes("videos/kenapa-hujan-turun"), "the placeholders are filled in");
yes(JSON.parse(readFileSync(path.join(made, "meta.json"), "utf8")).title === "kenapa hujan turun", "the title comes from the name when there is no story");
throws(() => newVideo("kenapa-hujan-turun", undefined, root), /already exists/, "it never overwrites a video");
for (const bad of ["", "A", "Kenapa Hujan", "x", "a_b", "-abc", "../x", "a".repeat(40)]) throws(() => newVideo(bad, undefined, root), /lowercase letters/, `the name "${bad}" is refused`);
const story = path.join(root, "checked.json");
writeFileSync(story, readFileSync(path.join(ROOT, "stories", "example.json")));
const withStory = newVideo("dari-cerita", story, root);
yes(JSON.parse(readFileSync(path.join(withStory, "meta.json"), "utf8")).title === "Kenapa colokan bisa panas?", "with a story: its first title, and its words are copied in");
yes(JSON.parse(readFileSync(path.join(withStory, "story.json"), "utf8")).question === "Kenapa colokan bisa panas?", "the checked story is the story.json");
writeFileSync(story, JSON.stringify({ nope: 1 }));
throws(() => newVideo("cerita-rusak", story, root), /not valid/, "a story that is not valid is refused");
yes(!existsSync(path.join(root, "videos", "cerita-rusak")), "and no folder is left behind");

// the files render.mjs loads in plain Node (sfx.ts, plan.ts) must load without the .tsx loader: a video scaffolded from the template, and every video of the repository, import
// only plain .ts modules (a regression: the template's sfx.ts once imported src/design/index.ts and every new video failed with "Unknown file extension .tsx")
cpSync(path.join(ROOT, "src"), path.join(root, "src"), { recursive: true });
const loaded = await import(pathToFileURL(path.join(made, "sfx.ts")).href);
const tplStory = validateStory(JSON.parse(readFileSync(path.join(ROOT, "templates", "video", "story.json"), "utf8")));
yes(tplStory.ok && typeof loaded.sfx === "function" && Array.isArray(loaded.sfx(tplStory.ok ? tplStory.story : (undefined as never))), "a scaffolded video's sfx.ts loads in plain Node and returns the events");
const loadedPlan = await import(pathToFileURL(path.join(made, "plan.ts")).href);
yes(tplStory.ok && typeof loadedPlan.makePlan === "function" && Number.isFinite(loadedPlan.makePlan(tplStory.ok ? tplStory.story : (undefined as never)).total), "a scaffolded video's plan.ts loads in plain Node");
for (const slug of readdirSync(path.join(ROOT, "videos"))) for (const f of ["sfx.ts", "plan.ts"]) {
  const file = path.join(ROOT, "videos", slug, f);
  if (existsSync(file)) yes(!/^\s*(import|export)\b[^;]*\bfrom\s+["\'][^"\']*design\/index(\.ts)?["\']/m.test(readFileSync(file, "utf8")), `videos/${slug}/${f} imports no src/design/index.ts`);
}
yes(existsSync(path.join(ROOT, "videos", "selftest-tiny", "sfx.ts")), "the selftest video has an sfx.ts (the klipian selftest renders a custom video with one)");

// styleCheck FAILs a video whose sfx.ts imports src/design/index.ts (it would not render), and passes one that does not
{
  const bad = path.join(root, "bad-video");
  cpSync(path.join(ROOT, "videos", "ngantuk-pegang-hp"), bad, { recursive: true });
  writeFileSync(path.join(bad, "sfx.ts"), 'import { defaultBeatSfx } from "../../src/design/index.ts";\nexport const sfx = (s: never) => defaultBeatSfx(s);\n');
  const run = (dir: string) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), dir], { encoding: "utf8" }).stdout;
  yes(/^FAIL\s+render: sfx\.ts and plan.ts import only plain/m.test(run(bad)), "styleCheck FAILs an sfx.ts that imports src/design/index.ts");
  yes(/^PASS\s+render: sfx\.ts and plan.ts import only plain/m.test(run(path.join(ROOT, "videos", "ngantuk-pegang-hp"))), "and passes a video that imports only plain .ts modules");
}

// every relative import of every video points at a file that exists with exactly that path and extension (tsc passes "IsoNature.ts" for IsoNature.tsx; the render bundler does not)
for (const slug of readdirSync(path.join(ROOT, "videos"))) yes(checkImports(path.join(ROOT, "videos", slug)).length === 0, `videos/${slug}: every relative import resolves to a file spelled exactly`);
{
  const wrong = path.join(root, "videos", "wrong-import");
  cpSync(path.join(ROOT, "videos", "selftest-tiny"), wrong, { recursive: true });
  writeFileSync(path.join(wrong, "extra.ts"), 'import { Polys } from "../../src/components/Iso.ts";\nimport x from "./story.json";\nexport const y = [Polys, x];\n');
  const bad = checkImports(wrong);
  yes(bad.length === 1 && /Iso\.ts tidak ada; maksudnya Iso\.tsx\?/.test(bad[0]), `a wrong extension is named with a hint (${bad[0]})`);
  writeFileSync(path.join(wrong, "extra.ts"), 'import { Polys } from "../../src/components/Nope.tsx";\nexport const y = Polys;\n');
  yes(checkImports(wrong).length === 1, "a file that does not exist is reported");
  const run = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), wrong], { encoding: "utf8" }).stdout;
  yes(/^FAIL\s+render: every relative import/m.test(run), "styleCheck FAILs it");
}

console.log(`videos: ${n} checks ok`);
