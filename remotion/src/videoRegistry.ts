/* Every custom video: the folders videos/<slug>/ that have an index.tsx, found by the bundler (no list to keep). A video exports `Video` (a
   component taking `{ story }`) and `story` (the checked story it was made from, for the Studio); an optional meta.json says its title and
   whether klipian hides it. Root.tsx registers each as the composition `video-<slug>`. */
import type React from "react";
import { validateStory, type StoryT } from "./schema.ts";

type Mod = { Video: React.ComponentType<{ story: StoryT; layoutDebug?: boolean }>; story: unknown };
type Ctx = { keys(): string[]; (key: string): Mod };
const context = (import.meta as unknown as { webpackContext(dir: string, opts: { recursive: boolean; regExp: RegExp }): Ctx })
  .webpackContext("../videos", { recursive: true, regExp: /^\.\/[a-z0-9-]+\/index\.tsx$/ });

export type RegisteredVideo = { slug: string; id: string; Video: Mod["Video"]; story: StoryT };

export const VIDEO_SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;

export const VIDEOS: RegisteredVideo[] = context.keys().map((key) => {
  const slug = key.split("/")[1];
  const mod = context(key);
  const v = validateStory(mod.story);
  if (!v.ok) throw new Error(`videos/${slug}/story.json is not a valid story:\n${v.errors.join("\n")}`);
  return { slug, id: `video-${slug}`, Video: mod.Video, story: v.story };
});
