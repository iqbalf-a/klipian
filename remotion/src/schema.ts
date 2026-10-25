/* The story: what the AI fills in (as JSON, never as code) and what klipian validates before anything is rendered.
   Coordinates are in 1080 x 1920 video units. The rules of the channel are enforced here: only components, expressions
   and poses of the catalogue, at most 6 words of screen text, every claim with a source. */
import { z } from "zod";
import {
  BACKGROUNDS, BEAT_KINDS, CHIBI_COSTUMES, CHIBI_EXPRESSIONS, CHIBI_POSES, CHIBI_ROLES, CUTAWAY_VARIANTS,
  LABEL_COLORS, MASCOT_EXPRESSIONS, OUTSIDE_VARIANTS, SOCKET_VIEWS,
} from "./catalog.ts";

export const MAX_SCREEN_WORDS = 6;
export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const screenText = z.string().max(120).refine((t) => wordCount(t) <= MAX_SCREEN_WORDS, {
  message: `screen text is at most ${MAX_SCREEN_WORDS} words`,
});
const num = z.number().finite();
const pos = { x: num.min(-400).max(1480), y: num.min(-400).max(2320) };
const url = z.string().url();

const Mascot = z.object({
  type: z.literal("mascot"), ...pos, w: num.min(20).max(1200),
  expr: z.enum(MASCOT_EXPRESSIONS), sparks: z.boolean().optional(), rot: num.min(-45).max(45).optional(),
  pop: z.boolean().optional(),                       // the "pop" entrance (squash, stretch, settle)
  body: z.enum(["yellow", "black"]).optional(),
}).strict();

const Chibi = z.object({
  type: z.literal("chibi"), ...pos, u: num.min(20).max(400),            // x, y = where the feet stand; u = head half-width
  role: z.enum(CHIBI_ROLES), expr: z.enum(CHIBI_EXPRESSIONS), pose: z.enum(CHIBI_POSES),
  costume: z.enum(CHIBI_COSTUMES).optional(),
}).strict();

const Socket = z.object({
  type: z.literal("socket"), ...pos, s: num.min(0.1).max(4),            // s = 1 is the size on the reference sheet
  view: z.enum(SOCKET_VIEWS),
  variant: z.enum([...OUTSIDE_VARIANTS, ...CUTAWAY_VARIANTS]),
  heat: num.min(0).max(1).optional(),                                    // cutaway: the glow at the contact
  dots: z.boolean().optional(),                                          // cutaway: the current's dots
  plug: z.object({ cableX: num, cableY: num }).strict().optional(),     // outside: a plug in the socket, its cable going to here
  waves: z.boolean().optional(),                                         // outside: heat waves above
  smoke: z.boolean().optional(),                                         // outside: smoke above
}).strict();

const Lens = z.object({
  type: z.literal("lens"), ...pos, r: num.min(30).max(700),             // the centre of the circle and its radius
  variant: z.enum(CUTAWAY_VARIANTS), heat: num.min(0).max(1).optional(),
  reveal: z.object({ from: num.min(0), dur: num.min(0.1) }).strict().optional(),   // seconds into the beat: the circle opens
}).strict();

const Banner = z.object({ type: z.literal("banner"), text: screenText, y: num.optional(), fs: num.min(20).max(160).optional() }).strict();
const Pill = z.object({ type: z.literal("pill"), text: screenText, ...pos, fs: num.min(20).max(200) }).strict();
const Label = z.object({
  type: z.literal("label"), text: screenText, ...pos, fs: num.min(20).max(160),
  color: z.enum(LABEL_COLORS).optional(), align: z.enum(["start", "middle"]).optional(),
  lines: z.array(screenText).max(4).optional(),                          // extra lines under the text
}).strict();
const Stack = z.object({ type: z.literal("stack"), ...pos, s: num.min(0.1).max(4) }).strict();   // plugs piled on one socket, crossed out

export const Item = z.discriminatedUnion("type", [Mascot, Chibi, Socket, Lens, Banner, Pill, Label, Stack]);

export const Beat = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  kind: z.enum(BEAT_KINDS),
  dur: num.min(0.5).max(30),                                              // seconds
  narration: z.string().min(1).max(600),
  text: screenText,                                                       // the screen text of the beat
  scene: z.object({ bg: z.enum(BACKGROUNDS), items: z.array(Item).max(12) }).strict(),
  sfx: z.string().max(80),
}).strict();

export const Claim = z.object({
  text: z.string().min(3).max(400),
  beats: z.array(z.string()).min(1),
  sources: z.array(url).min(1),
}).strict();

export const Story = z.object({
  question: z.string().min(3).max(140),
  titles: z.tuple([z.string().min(1).max(100), z.string().min(1).max(100), z.string().min(1).max(100)]),
  duration: num.min(5).max(120),
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
