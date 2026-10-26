// npm run new-video <slug> [story.json]   ->  videos/<slug>/ from templates/video/ (index.tsx, sfx.ts, meta.json, story.json)
//
// <slug> is lowercase letters, digits and hyphens (the folder name, and the composition id video-<slug>). The story is the CHECKED story of the klipian
// project (profiles/<id>/motion/<project>/story.json), copied in so the Studio and a render read the same words; without one the template's example
// story is used. Registered in Root automatically: `npm run studio` shows it as "video-<slug>". Refuses to overwrite a folder that exists.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStory } from "../src/schema.ts";

export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Makes the folder; returns its path. `root` is where videos/ and templates/ live (the tests use a copy). */
export function newVideo(slug, storyFile, root = ROOT) {
  if (!SLUG.test(slug ?? "")) throw new Error("the name is lowercase letters, digits and hyphens, 2 to 39 characters, e.g. kenapa-hujan-turun");
  const dest = path.join(root, "videos", slug);
  if (existsSync(dest)) throw new Error(`videos/${slug} already exists`);
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
  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const dest = newVideo(process.argv[2], process.argv[3]);
    console.log(`made ${path.relative(process.cwd(), dest)}\nnext: npm run studio, then open the composition "video-${path.basename(dest)}"; read DESIGN.md first`);
  } catch (e) { console.error(String(e.message ?? e)); process.exit(1); }
}
