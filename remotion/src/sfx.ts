/* Which sound plays when (P28-A4). A pure function of the story: it reads the same motion words the picture does (transitions, enters,
   actions, heat, current, smoke) and the table SFX_FOR in catalog.ts, and returns a list of events { t, name, ... } with t in seconds of the
   video, on a frame boundary, so a sound lands on the frame its picture does. The mixer (sfx/mix.mjs) turns the list into audio;
   nothing here touches the DOM. A story can only change a sound with an item's `sfx` (a name of the closed list, or "none"). */
import { MAX_SIMULTANEOUS_SFX, SFX, SFX_FOR, type SfxName } from "./catalog.ts";
import type { BeatT, ItemT, StoryT } from "./schema.ts";
import { FPS, enterOf, sequencePlan, transitionInto, totalFrames } from "./timeline.ts";
import { DISSECT_SECONDS, HEAT_FROM, LABEL_AT, PART_AT, SPLIT_AT } from "./dissectTimeline.ts";

export type SfxEvent = {
  t: number;                  // seconds into the video (a multiple of 1 / FPS)
  name: SfxName;
  vol: number;                // a factor on the sound's own volume (1 = as in the table)
  dur?: number;               // how long a loop (the hum) lasts
  pan?: number;               // -1 (left) .. 1 (right), 0 = centre
  why: string;                // for the timeline table: what happens on screen
};

const q = (t: number): number => Math.round(t * FPS) / FPS;

/** The events of a story, in time order. Nothing is dropped here: see planSfx for the cooldowns and the cap on simultaneous sounds. */
export function storyEvents(story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(Math.max(0, t)), name, vol: 1, why, ...extra });

  sequencePlan(story).forEach((sp, bi) => {
    const beat = sp.beat, b = sp.from / FPS;

    // the transition into this beat runs over its first tr.dur seconds (the sequence of the beat before it is extended to cover it)
    const tr = transitionInto(story, bi);
    if (tr.kind !== "cut") {
      const at = b, pan = beat.transition?.dir === "left" ? -0.3 : beat.transition?.dir === "right" ? 0.3 : 0;
      if (tr.kind === "lens") {
        add(at, "zoom-whoosh", `transition "through the lens" into ${beat.id}`, { vol: 0.8 });
        add(at + tr.dur * 0.55, SFX_FOR.transition.lens, `the lens opens (${beat.id})`);
      } else add(at, SFX_FOR.transition[tr.kind], `transition ${tr.kind} into ${beat.id}`, { pan });
    }

    if (beat.kind === "sting" || beat.kind === "outro") add(b + 0.1, SFX_FOR.beat[beat.kind], `${beat.kind} jingle (${beat.id})`);

    beat.scene.items.forEach((item, ii) => itemEvents(item, ii, beat, b, add));
  });
  return ev.sort((x, y) => x.t - y.t);
}

type Add = (t: number, name: SfxName, why: string, extra?: Partial<SfxEvent>) => void;

function itemEvents(item: ItemT, ii: number, beat: BeatT, b: number, add: Add): void {
  const plan = enterOf(item, ii);
  const label = `${item.type}${"text" in item ? ` "${item.text}"` : ""} (${beat.id})`;
  const end = beat.dur;

  // --- the entrance ---------------------------------------------------------------------------------------------------------------
  if (plan.kind !== "none") {
    let name: SfxName | null = SFX_FOR.enter[item.type][plan.kind];
    let at = b + plan.delay;
    if (item.type === "badge" && item.text.includes("!")) name = SFX_FOR.alertBadge;
    if (item.type === "banner") at += plan.dur * 0.55;                                 // it thumps as it lands
    if (item.type === "arrow") at += plan.dur * 0.85;                                  // a tick at the arrow head
    if (item.type === "lens") at = b + (item.reveal?.from ?? plan.delay);
    if (item.type === "socket" && plan.kind === "draw") at += 0.05;
    if (item.sfx) name = item.sfx === "none" ? null : item.sfx;
    if (name) add(at, name, `${label} enters (${plan.kind})`, item.type === "label" ? { vol: 0.9 } : {});
  }

  // --- the face it comes with: a surprised or an ouch mascot says so (the mascot is rare now, so its first face is its reaction) ---------------------
  if ((item.type === "mascot" || item.type === "chibi") && plan.kind !== "none") {
    const table: Record<string, SfxName | undefined> = item.type === "mascot" ? SFX_FOR.mascotExpr : SFX_FOR.chibiExpr;
    const face = table[item.expr];
    if (face && !item.sfx) add(b + plan.delay + 0.15, face, `${item.type} looks ${item.expr} (${beat.id})`);
  }

  // --- what an item keeps doing ---------------------------------------------------------------------------------------------------
  if (item.type === "socket") {
    const heat = item.heat ?? (item.variant === "loose" ? 1 : 0);
    if (heat > 0) add(b + plan.delay, SFX_FOR.heat, `${label}: heat rising`, { vol: heat });
    if (item.view === "cutaway" && (item.dots ?? true)) add(b + plan.delay, SFX_FOR.current, `${label}: current flowing`, { dur: end - plan.delay });
    if (item.smoke) [0.3, 1.3, 2.4].forEach((d) => add(b + plan.delay + d, SFX_FOR.smoke, `${label}: smoke`, { vol: 0.9 - d * 0.1 }));
  }
  if (item.type === "lens") {
    const from = item.reveal?.from ?? plan.delay;
    add(b + from + 0.5, SFX_FOR.current, `${label}: current flowing`, { dur: Math.max(0.5, end - from - 0.5) });
    if ((item.heat ?? 0) > 0) add(b + from, SFX_FOR.heat, `${label}: heat rising`, { vol: item.heat });
  }

  // --- the actions the story asks for -----------------------------------------------------------------------------------------------
  for (const a of item.actions ?? []) {
    if (a.kind === "highlight") add(b + a.at, SFX_FOR.action.highlight, `${label} pulses`);
    else if (a.kind === "shake") add(b + a.at, SFX_FOR.action.shake, `${label} shakes (danger)`);
    else if (a.kind === "expr") {
      const table: Record<string, SfxName | undefined> = item.type === "mascot" ? SFX_FOR.mascotExpr : item.type === "chibi" ? SFX_FOR.chibiExpr : {};
      const name = table[a.expr];
      if (name) add(b + a.at, name, `${item.type} looks ${a.expr} (${beat.id})`);
    }
  }
}

/** The events of the Dissect3D composition: spin-in, the shell, the parts, the labels, the chip heating. */
export function dissectEvents(): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });
  add(0, "whoosh", "the charger spins in");
  add(SPLIT_AT, "click-crack", "the shell splits (front)");
  add(SPLIT_AT + 0.1, "click-crack", "the shell splits (back)", { vol: 0.7 });
  (Object.entries(PART_AT) as [string, number][]).forEach(([part, at]) => add(at, "pop-soft", `${part} separates`));
  LABEL_AT.forEach((at, i) => add(at, i === LABEL_AT.length - 1 ? "blip-alert" : "tick", i === LABEL_AT.length - 1 ? "label: hot spot" : "a label appears"));
  add(HEAT_FROM, "sizzle", "the chip heats up", { dur: DISSECT_SECONDS - HEAT_FROM });
  return ev.sort((x, y) => x.t - y.t);
}

const specOf = (n: SfxName): { vol: number; cooldown: number; dur: number; loop?: boolean; bed?: boolean } => SFX[n];

export type SfxPlan = { events: SfxEvent[]; dropped: { event: SfxEvent; because: string }[] };

/** The rules of the mix: the same sound is not repeated within its cooldown, no more than MAX_SIMULTANEOUS_SFX one-shots sound at once
    (a loop is a bed and does not count), and nothing is placed past the end of the video. */
export function planSfx(events: readonly SfxEvent[], totalSeconds: number): SfxPlan {
  const kept: SfxEvent[] = [], dropped: SfxPlan["dropped"] = [];
  const lastOf = new Map<SfxName, number>();
  for (const e of [...events].sort((x, y) => x.t - y.t)) {
    const spec = specOf(e.name);
    if (e.t >= totalSeconds) { dropped.push({ event: e, because: "after the end" }); continue; }
    const last = lastOf.get(e.name);
    if (last !== undefined && e.t - last < spec.cooldown - 1e-9) { dropped.push({ event: e, because: `cooldown (${spec.cooldown}s)` }); continue; }
    if (!spec.loop && !spec.bed) {
      const playing = kept.filter((k) => !specOf(k.name).loop && !specOf(k.name).bed && k.t + specOf(k.name).dur > e.t + 1e-9).length;
      if (playing >= MAX_SIMULTANEOUS_SFX) { dropped.push({ event: e, because: `${MAX_SIMULTANEOUS_SFX} already sounding` }); continue; }
    }
    lastOf.set(e.name, e.t);
    kept.push(spec.loop || e.dur ? { ...e, dur: Math.min(e.dur ?? spec.dur, totalSeconds - e.t) } : e);
  }
  return { events: kept, dropped };
}

export const storySfx = (story: StoryT): SfxPlan => planSfx(storyEvents(story), totalFrames(story) / FPS);
export const dissectSfx = (): SfxPlan => planSfx(dissectEvents(), DISSECT_SECONDS);

/** The text table of the timeline: time, frame, sound, event. */
export function formatTimeline(plan: SfxPlan): string {
  const rows = plan.events.map((e) => `${e.t.toFixed(2).padStart(6)}s  f${String(Math.round(e.t * FPS)).padStart(4)}  ${e.name.padEnd(19)} ${e.dur ? `(${e.dur.toFixed(1)}s) `.padEnd(7) : "       "}${e.why}`);
  if (plan.dropped.length) rows.push("", ...plan.dropped.map((d) => `  dropped ${d.event.name} at ${d.event.t.toFixed(2)}s: ${d.because}`));
  return rows.join("\n");
}

/** The sound of a custom video that has no sfx.ts of its own: the jingles of the sting and the outro, and a whoosh or swish at each transition.
    A video that wants more writes its own list (videos/<slug>/sfx.ts exports `sfx(story)`), by hand or from `storyEvents`. */
export function defaultBeatSfx(story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  sequencePlan(story).forEach((sp, bi) => {
    const beat = sp.beat, b = sp.from / FPS, tr = transitionInto(story, bi);
    if (tr.kind !== "cut") ev.push({ t: q(b), name: tr.kind === "lens" ? "zoom-whoosh" : SFX_FOR.transition[tr.kind], vol: 1, why: `transition ${tr.kind} into ${beat.id}` });
    if (beat.kind === "sting" || beat.kind === "outro") ev.push({ t: q(b + 0.1), name: SFX_FOR.beat[beat.kind], vol: 1, why: `${beat.kind} jingle (${beat.id})` });
  });
  return ev;
}
