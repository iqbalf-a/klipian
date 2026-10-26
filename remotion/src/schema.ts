/* The story: what the AI fills in (as JSON, never as code) and what klipian validates before anything is rendered.
   Coordinates are in 1080 x 1920 video units. The rules of the channel are enforced here: only components, expressions
   and poses of the catalogue, at most 6 words of screen text, every claim with a source. */
import { z } from "zod";
import {
  ANCHOR_NAMES, ARROW_COLORS, BACKGROUNDS, BEAT_KINDS, CAMERA_KINDS, CHIBI_COSTUMES, CHIBI_EXPRESSIONS, CHIBI_POSES, CHIBI_ROLES, CUTAWAY_VARIANTS, DIRECTIONS,
  ENTER_KINDS, EXIT_KINDS, LABEL_COLORS, MASCOT_EXPRESSIONS, MODELS, OUTSIDE_VARIANTS, SFX_NAMES, SOCKET_VIEWS, TRANSITION_KINDS,
} from "./catalog.ts";

export const MAX_SCREEN_WORDS = 6;
export const MAX_TRANSITIONS = 3;                                        // style bible
export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const screenText = z.string().max(120).refine((t) => wordCount(t) <= MAX_SCREEN_WORDS, {
  message: `screen text is at most ${MAX_SCREEN_WORDS} words`,
});
const num = z.number().finite();
const pos = { x: num.min(-400).max(1480), y: num.min(-400).max(2320) };
const url = z.string().url();

/* Motion (P28-A2): the fixed vocabulary an item may ask for. All optional: an item with none still enters, idles and moves. */
const Enter = z.object({
  kind: z.enum(ENTER_KINDS), dir: z.enum(DIRECTIONS).optional(),
  delay: num.min(0).max(60).optional(),                                  // seconds into the beat; default: 4 frames per item before it
  dur: num.min(0.1).max(3).optional(),
}).strict();
const Exit = z.object({ kind: z.enum(EXIT_KINDS), dir: z.enum(DIRECTIONS).optional(), at: num.min(0).max(60), dur: num.min(0.1).max(3).optional() }).strict();
const at = num.min(0).max(60);                                           // seconds into the beat
const EXPRESSIONS = Array.from(new Set<string>([...MASCOT_EXPRESSIONS, ...CHIBI_EXPRESSIONS])) as [string, ...string[]];
export const Action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("highlight"), at }).strict(),                                   // a pulse
  z.object({ kind: z.literal("shake"), at, danger: z.literal(true) }).strict(),              // only to say danger
  z.object({ kind: z.literal("look"), at, x: num, y: num, snap: z.boolean().optional() }).strict(),   // snap: already looking from the first frame                        // the mascot's lens looks at a point
  z.object({ kind: z.literal("pose"), at, pose: z.enum(CHIBI_POSES) }).strict(),            // the chibi's arms spring to a pose
  z.object({ kind: z.literal("expr"), at, expr: z.enum(EXPRESSIONS) }).strict(),            // another face
]);
// `sfx` changes the sound of the item's entrance (one name of the closed list), or silences it ("none")
const motion = { enter: Enter.optional(), exit: Exit.optional(), actions: z.array(Action).max(8).optional(), sfx: z.enum([...SFX_NAMES, "none"]).optional() };
const highlight = z.array(z.string().min(1).max(30)).max(6).optional();   // keywords of the text that turn yellow
// a label or an arrow can follow a part of a 3D item of the same beat (it is placed as usual for the resting pose and then moves with that part as the object turns)
const follow = z.object({ item: z.string().min(1).max(24), anchor: z.enum(ANCHOR_NAMES) }).strict().optional();
const itemId = z.string().regex(/^[a-z0-9-]{1,24}$/).optional();

const Mascot = z.object({
  type: z.literal("mascot"), ...pos, ...motion, w: num.min(20).max(1200),
  expr: z.enum(MASCOT_EXPRESSIONS), sparks: z.boolean().optional(), rot: num.min(-45).max(45).optional(),
  pop: z.boolean().optional(),                       // the "pop" entrance (squash, stretch, settle)
  persist: z.boolean().optional(),                   // the same mascot as in the beat before: no entrance, its idles carry on from the video's own clock
  body: z.enum(["yellow", "black"]).optional(),
}).strict();

const Chibi = z.object({
  type: z.literal("chibi"), ...pos, ...motion, u: num.min(20).max(400),            // x, y = where the feet stand; u = head half-width
  role: z.enum(CHIBI_ROLES), expr: z.enum(CHIBI_EXPRESSIONS), pose: z.enum(CHIBI_POSES),
  costume: z.enum(CHIBI_COSTUMES).optional(),
}).strict();

const Socket = z.object({
  type: z.literal("socket"), ...pos, ...motion, s: num.min(0.1).max(4), id: itemId, model: z.enum(MODELS).optional(),            // s = 1 is the size on the reference sheet
  view: z.enum(SOCKET_VIEWS),
  variant: z.enum([...OUTSIDE_VARIANTS, ...CUTAWAY_VARIANTS]),
  heat: num.min(0).max(1).optional(),                                    // cutaway: the glow at the contact
  dots: z.boolean().optional(),                                          // cutaway: the current's dots
  // outside: a plug in the socket. Its cable goes to (cableX, cableY) in a straight line (the first stories), or follows `route`
  // (points in video units, 2-6 of them: drop to the floor, run along it, leave the frame, or end behind an object)
  plug: z.object({ cableX: num.optional(), cableY: num.optional(), route: z.array(z.tuple([num, num])).min(2).max(6).optional() }).strict()
    .refine((p) => p.route !== undefined || (p.cableX !== undefined && p.cableY !== undefined), { message: "a plug needs a route or cableX and cableY" }).optional(),
  waves: z.boolean().optional(),                                         // outside: heat waves above
  smoke: z.boolean().optional(),                                         // outside: smoke above
}).strict();

const Lens = z.object({
  type: z.literal("lens"), ...pos, ...motion, id: itemId, model: z.enum(MODELS).optional(), r: num.min(30).max(700),             // the centre of the circle and its radius
  variant: z.enum(CUTAWAY_VARIANTS), heat: num.min(0).max(1).optional(),
  reveal: z.object({ from: num.min(0), dur: num.min(0.1) }).strict().optional(),   // seconds into the beat: the circle opens
}).strict();

const Banner = z.object({ type: z.literal("banner"), text: screenText, ...motion, highlight, y: num.optional(), fs: num.min(20).max(160).optional() }).strict();
const Pill = z.object({ type: z.literal("pill"), text: screenText, ...pos, ...motion, highlight, fs: num.min(20).max(200) }).strict();
const Label = z.object({
  type: z.literal("label"), text: screenText, ...pos, ...motion, highlight, follow, fs: num.min(20).max(160),
  color: z.enum(LABEL_COLORS).optional(), align: z.enum(["start", "middle"]).optional(),
  lines: z.array(screenText).max(4).optional(),                          // extra lines under the text
}).strict();
const Stack = z.object({ type: z.literal("stack"), ...pos, ...motion, s: num.min(0.1).max(4) }).strict();   // plugs piled on one socket, crossed out
// Supporting elements that fill a screen without a new fact: an arrow from (x, y) to (x2, y2), a numbered badge.
const Arrow = z.object({ type: z.literal("arrow"), ...pos, ...motion, follow, x2: num.min(-400).max(1480), y2: num.min(-400).max(2320),
  color: z.enum(ARROW_COLORS).optional(), w: num.min(4).max(40).optional() }).strict();
const Badge = z.object({ type: z.literal("badge"), text: z.string().min(1).max(3), ...pos, ...motion, r: num.min(20).max(120).optional(),
  color: z.enum(["yellow", "red", "white"]).optional() }).strict();

export const Item = z.discriminatedUnion("type", [Mascot, Chibi, Socket, Lens, Banner, Pill, Label, Stack, Arrow, Badge]);

export const Beat = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  kind: z.enum(BEAT_KINDS),
  dur: num.min(0.5).max(30),                                              // seconds
  narration: z.string().min(1).max(600),
  text: screenText,                                                       // the screen text of the beat
  // bg: brand = story scenes (lens rings + a yellow spotlight; `spot` places it, default behind the middle), lab = inside the lens
  scene: z.object({ bg: z.enum(BACKGROUNDS), spot: z.object({ x: num, y: num, r: num.min(100).max(900).optional() }).strict().optional(), items: z.array(Item).max(14) }).strict(),
  sfx: z.string().max(80),
  // the camera: push (a slow zoom 1.00 -> 1.08), pan (starts offset by dx, dy and settles) or still; default push
  camera: z.object({ kind: z.enum(CAMERA_KINDS), dx: num.min(-600).max(600).optional(), dy: num.min(-600).max(600).optional(), zoom: num.min(0.8).max(1.6).optional(), dur: num.min(0.2).max(10).optional() }).strict().optional(),
  // the transition INTO this beat; "lens" grows a circle from (x, y) of radius r over the whole screen, the beat is inside it
  transition: z.object({ kind: z.enum(TRANSITION_KINDS), dur: num.min(0.1).max(2).optional(), dir: z.enum(DIRECTIONS).optional(),
    x: num.optional(), y: num.optional(), r: num.min(30).max(900).optional() }).strict().optional(),
  blur: z.boolean().optional(),                                           // a thin motion blur for a fast beat (costs render time)
}).strict();

export const Claim = z.object({
  text: z.string().min(3).max(400),
  beats: z.array(z.string()).min(1),
  sources: z.array(url).min(1),
}).strict();

export const Story = z.object({
  question: z.string().min(3).max(140),
  titles: z.tuple([z.string().min(1).max(100), z.string().min(1).max(100), z.string().min(1).max(100)]),
  duration: num.min(1).max(120),
  beats: z.array(Beat).min(1).max(16),
  claims: z.array(Claim),
  post: z.object({ description: z.string().max(2000), hashtags: z.array(z.string().regex(/^#\S+$/)).max(10) }).strict(),
  needs: z.array(z.string()),
}).strict().superRefine((s, ctx) => {
  const ids = s.beats.map((b) => b.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) ctx.addIssue({ code: "custom", message: `two beats are called "${dup}"`, path: ["beats"] });
  const total = s.beats.reduce((a, b) => a + b.dur, 0);
  if (Math.abs(total - s.duration) > 0.01) ctx.addIssue({ code: "custom", message: `the beats last ${total} s but duration says ${s.duration}`, path: ["duration"] });
  s.beats.forEach((b, bi) => b.scene.items.forEach((item, ii) => {
    if (item.type !== "socket") return;
    const allowed: readonly string[] = item.view === "outside" ? OUTSIDE_VARIANTS : CUTAWAY_VARIANTS;
    if (!allowed.includes(item.variant)) {
      ctx.addIssue({ code: "custom", message: `the ${item.view} view of a socket has no "${item.variant}" variant`, path: ["beats", bi, "scene", "items", ii, "variant"] });
    }
  }));
  // a label or an arrow that follows a part names a 3D item (a socket or a lens with an id) of its own beat
  s.beats.forEach((b, bi) => b.scene.items.forEach((item, ii) => {
    if ((item.type !== "label" && item.type !== "arrow") || !item.follow) return;
    const target = b.scene.items.find((o) => (o.type === "socket" || o.type === "lens") && o.id === item.follow!.item);
    if (!target) ctx.addIssue({ code: "custom", message: `follows the item "${item.follow.item}", which this beat does not have (a socket or a lens with that id)`, path: ["beats", bi, "scene", "items", ii, "follow"] });
    else if ((target as { model?: string }).model === "flat") ctx.addIssue({ code: "custom", message: `"${item.follow.item}" is drawn flat: only 3D models have parts to follow`, path: ["beats", bi, "scene", "items", ii, "follow"] });
  }));
  // motion: times inside the beat, actions only on the things they make sense for, at most 3 transitions, lens needs a circle
  let moving = 0;
  s.beats.forEach((b, bi) => {
    const base = ["beats", bi] as (string | number)[];
    const t = b.transition;
    if (t && t.kind !== "cut") {
      moving += 1;
      if (bi === 0) ctx.addIssue({ code: "custom", message: "the first beat has nothing to transition from", path: [...base, "transition"] });
      const limit = 0.8 * Math.min(b.dur, s.beats[Math.max(0, bi - 1)].dur);
      if ((t.dur ?? 0.5) > limit + 1e-9) ctx.addIssue({ code: "custom", message: `a transition lasts at most 80% of the shorter beat (${limit.toFixed(2)} s)`, path: [...base, "transition", "dur"] });
      if (t.kind === "lens" && (t.x === undefined || t.y === undefined || t.r === undefined)) ctx.addIssue({ code: "custom", message: "a lens transition needs x, y and r", path: [...base, "transition"] });
    }
    b.scene.items.forEach((item, ii) => {
      const where = [...base, "scene", "items", ii] as (string | number)[];
      const late = (sec: number | undefined, what: string) => {
        if (sec !== undefined && sec > b.dur + 1e-9) ctx.addIssue({ code: "custom", message: `${what} at ${sec} s is outside the beat (${b.dur} s)`, path: where });
      };
      late(item.enter?.delay, "enter");
      late(item.exit?.at, "exit");
      (item.actions ?? []).forEach((a, ai) => {
        late(a.at, `action ${ai + 1}`);
        const bad = (message: string) => ctx.addIssue({ code: "custom", message, path: [...where, "actions", ai] });
        if (a.kind === "look" && item.type !== "mascot") bad("only a mascot can look at a point");
        if (a.kind === "pose" && item.type !== "chibi") bad("only a chibi has poses");
        if (a.kind === "expr") {
          const list: readonly string[] | null = item.type === "mascot" ? MASCOT_EXPRESSIONS : item.type === "chibi" ? CHIBI_EXPRESSIONS : null;
          if (!list) bad("only a mascot or a chibi has expressions");
          else if (!list.includes(a.expr)) bad(`a ${item.type} has no "${a.expr}" expression`);
        }
      });
      if (item.exit && item.enter?.delay !== undefined && item.exit.at <= item.enter.delay) {
        ctx.addIssue({ code: "custom", message: "an item cannot leave before it has entered", path: [...where, "exit"] });
      }
    });
  });
  if (moving > MAX_TRANSITIONS) ctx.addIssue({ code: "custom", message: `at most ${MAX_TRANSITIONS} transitions other than a cut`, path: ["beats"] });
  s.claims.forEach((c, i) => c.beats.forEach((id) => {
    if (!ids.includes(id)) ctx.addIssue({ code: "custom", message: `claim ${i + 1} names the unknown beat "${id}"`, path: ["claims", i, "beats"] });
  }));
});

export type StoryT = z.infer<typeof Story>;
export type BeatT = z.infer<typeof Beat>;
export type ItemT = z.infer<typeof Item>;

/** Validate a story coming from outside: { ok, story } or { ok: false, errors: ["path: message", ...] }. */
export function validateStory(raw: unknown): { ok: true; story: StoryT } | { ok: false; errors: string[] } {
  const r = Story.safeParse(raw);
  if (r.success) return { ok: true, story: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(story)"}: ${i.message}`) };
}
