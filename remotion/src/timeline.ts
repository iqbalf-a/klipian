/* The plan of time, with no drawing: where each beat starts, how long its sequence is once the transitions overlap, what an
   item does by default. Pure, so `npm test` can check that the video lasts exactly the sum of the beats. */
import type { BeatT, ItemT, StoryT } from "./schema.ts";

export const FPS = 30;
export const STAGGER_S = 4 / FPS;                 // items enter one after another, 4 frames apart, when the story gives no delay
export const MAX_STAGGER_ITEMS = 6;               // the 7th and later do not wait longer than the 6th
export const DEFAULT_ENTER_DUR = 0.55;
export const DEFAULT_TRANSITION_DUR = 0.5;
export const DEFAULT_LENS_TRANSITION_DUR = 0.9;
export const MAX_NON_CUT_TRANSITIONS = 3;         // style bible: at most 3 transitions in a video

export const framesOf = (seconds: number): number => Math.round(seconds * FPS);

export type TransitionPlan = { kind: "cut" | "slide" | "wipe" | "zoom" | "lens"; dur: number; frames: number };

/** The transition INTO beat `i` (the first beat has none). It overlaps the end of the previous beat, so the beats keep their length. */
export function transitionInto(story: StoryT, i: number): TransitionPlan {
  const t = story.beats[i]?.transition;
  if (i === 0 || !t || t.kind === "cut") return { kind: "cut", dur: 0, frames: 0 };
  const dur = t.dur ?? (t.kind === "lens" ? DEFAULT_LENS_TRANSITION_DUR : DEFAULT_TRANSITION_DUR);
  return { kind: t.kind, dur, frames: Math.max(1, framesOf(dur)) };
}

export type SequencePlan = { beat: BeatT; from: number; beatFrames: number; sequenceFrames: number; overlapAfter: number };

/** For each beat: where it starts in the video, its own length, and the length of its sequence (its own plus the overlap
    of the transition into the next beat). Sum(sequence) - Sum(overlaps) = Sum(beats): the video keeps its length. */
export function sequencePlan(story: StoryT): SequencePlan[] {
  let from = 0;
  return story.beats.map((beat, i) => {
    const beatFrames = framesOf(beat.dur);
    const overlapAfter = i + 1 < story.beats.length ? transitionInto(story, i + 1).frames : 0;
    const plan = { beat, from, beatFrames, sequenceFrames: beatFrames + overlapAfter, overlapAfter };
    from += beatFrames;
    return plan;
  });
}

export const totalFrames = (story: StoryT): number => story.beats.reduce((a, b) => a + framesOf(b.dur), 0);

export type EnterPlan = { kind: "pop" | "slide" | "fade-up" | "draw" | "none"; dir: "left" | "right" | "up" | "down"; delay: number; dur: number };

/** What an item does when it appears, with the story's own words winning over the defaults. */
export function enterOf(item: ItemT, index: number): EnterPlan {
  const given = item.enter;
  const byType: Record<ItemT["type"], EnterPlan["kind"]> = {
    mascot: "pop", chibi: "slide", socket: "fade-up", lens: "fade-up", banner: "slide", pill: "pop", label: "fade-up", stack: "pop", arrow: "draw", badge: "pop", source: "pop",
  };
  const kind = given?.kind ?? (item.type === "mascot" && item.persist ? "none" : item.type === "socket" && item.view === "outside" && item.plug ? "draw" : byType[item.type]);
  const dir = given?.dir ?? (item.type === "banner" ? "down" : item.type === "chibi" ? "up" : "right");
  const auto = Math.min(index, MAX_STAGGER_ITEMS) * STAGGER_S;
  return { kind, dir, delay: given?.delay ?? auto, dur: given?.dur ?? DEFAULT_ENTER_DUR };
}

export type CameraPlan = { kind: "push" | "pan" | "still"; dx: number; dy: number; zoom: number; dur: number };

/** The camera of a beat: a slow push by default (the sting and the outro hold still). Pan starts offset by (dx, dy) and zoomed by `zoom`, and settles to rest. */
export function cameraOf(beat: BeatT): CameraPlan {
  const c = beat.camera;
  if (c) return { kind: c.kind, dx: c.dx ?? 0, dy: c.dy ?? 0, zoom: c.zoom ?? 1, dur: c.dur ?? 1.2 };
  return { kind: beat.kind === "sting" || beat.kind === "outro" ? "still" : "push", dx: 0, dy: 0, zoom: 1, dur: 1.2 };
}
