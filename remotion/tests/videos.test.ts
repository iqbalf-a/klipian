/* Custom videos (videos/<slug>/, scripts/new-video.mjs, templates/video/): `npm test`. The scaffold makes a folder from the template, names it,
   refuses a bad name, a folder that exists and a story that is not valid; the template's story and the selftest video's story are valid; every
   video folder has what the registry needs. */
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newVideo, SLUG } from "../scripts/new-video.mjs";
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
yes(files.join() === "index.tsx,meta.json,sfx.ts,story.json", `the scaffold makes ${files.join(", ")}`);
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

console.log(`videos: ${n} checks ok`);
