/* What exists. The schema, the components and (later) the brief's catalogue all read these lists, so the AI can only
   pick what can really be rendered. No TypeScript-only syntax besides types: node can run this file as it is. */

export const MASCOT_EXPRESSIONS = ["curious", "surprised", "think", "understand", "laugh", "ouch"] as const;
export const CHIBI_EXPRESSIONS = ["calm", "happy", "surprised", "ouch"] as const;
export const CHIBI_POSES = ["idle", "point", "ouch", "wave", "cheer"] as const;
export const CHIBI_ROLES = ["pemuda"] as const;                  // more roles (ibu, kakak berhijab, ...) come with P28-B
export const CHIBI_COSTUMES = ["none", "helmet"] as const;
export const BACKGROUNDS = ["room", "black", "brand", "lab"] as const;   // room/black: the first stories; brand: story scenes; lab: inside the lens and 3D
export const BEAT_KINDS = ["hook", "sting", "lens", "normal", "loose", "result", "tips", "outro"] as const;
export const SOCKET_VIEWS = ["outside", "cutaway"] as const;
export const OUTSIDE_VARIANTS = ["plain", "scorched"] as const;
export const CUTAWAY_VARIANTS = ["tight", "loose"] as const;
export const LABEL_COLORS = ["black", "red", "white"] as const;
export const ITEM_TYPES = ["mascot", "chibi", "socket", "lens", "banner", "pill", "label", "stack", "arrow", "badge"] as const;
export const ARROW_COLORS = ["black", "red", "yellow", "white"] as const;
export const MODELS = ["toon3d", "flat"] as const;               // how a socket or a lens is drawn: a 3D toon model (default) or the flat 2D one
/** Named points of the 3D models a label or an arrow can follow (see ANCHORS in three/Socket3D.tsx). */
export const ANCHOR_NAMES = ["center", "contact", "pin", "clip", "plug", "wire", "recess", "plugface", "cable", "top"] as const;

export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];
export type ChibiExpression = (typeof CHIBI_EXPRESSIONS)[number];
export type ChibiPose = (typeof CHIBI_POSES)[number];

/* The motion vocabulary (P28-A2): everything the story JSON may ask a thing to do. Fixed here, never written by the AI. */
export const ENTER_KINDS = ["pop", "slide", "fade-up", "draw", "none"] as const;   // none: there from the first frame (a thing revealed through the lens, a persistent mascot)     // draw: a wire's path draws itself (socket cable, cutaway wires)
export const EXIT_KINDS = ["pop", "slide", "fade-up"] as const;
export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export const ACTION_KINDS = ["highlight", "shake", "look", "pose", "expr"] as const;
export const CAMERA_KINDS = ["push", "pan", "still"] as const;
export const TRANSITION_KINDS = ["cut", "slide", "wipe", "zoom", "lens"] as const;

// ---------------------------------------------------------------- sound effects (P28-A4) ----------------------------------------------------------
/** Every sound effect there is (sfx/synth.mjs makes each as sfx/wav/<name>.wav), with how it is mixed: `vol` is its gain (0..1), `cooldown` the
    least gap between two of it (seconds), `dur` its length, `loop` marks a bed that is repeated for as long as the event lasts.
    A story can only name one of these (or "none") in an item's `sfx`; everything else is chosen from the motion vocabulary (see src/sfx.ts). */
export const SFX = {
  "pop":              { vol: 0.55, cooldown: 0.10, dur: 0.20 },
  "pop-soft":         { vol: 0.32, cooldown: 0.08, dur: 0.18 },
  "boing":            { vol: 0.50, cooldown: 0.40, dur: 0.60 },
  "whoosh":           { vol: 0.50, cooldown: 0.50, dur: 0.65 },
  "swish":            { vol: 0.40, cooldown: 0.30, dur: 0.35 },
  "swish-soft":       { vol: 0.26, cooldown: 0.20, dur: 0.30 },
  "zoom-whoosh":      { vol: 0.50, cooldown: 0.50, dur: 0.80 },
  "glass-ting":       { vol: 0.34, cooldown: 0.50, dur: 1.00 },
  "tick":             { vol: 0.34, cooldown: 0.08, dur: 0.08 },
  "tick-soft":        { vol: 0.16, cooldown: 0.12, dur: 0.07 },
  "zip":              { vol: 0.34, cooldown: 0.20, dur: 0.25 },
  "thump":            { vol: 0.62, cooldown: 0.30, dur: 0.35 },
  "rattle":           { vol: 0.40, cooldown: 0.50, dur: 0.65 },
  "sizzle":           { vol: 0.34, cooldown: 1.00, dur: 2.50, bed: true },
  "hum":              { vol: 0.11, cooldown: 0.00, dur: 1.00, loop: true },
  "puff":             { vol: 0.34, cooldown: 0.40, dur: 0.45 },
  "blip-alert":       { vol: 0.34, cooldown: 0.30, dur: 0.30 },
  "huh":              { vol: 0.42, cooldown: 0.40, dur: 0.45 },
  "slide-whistle-down": { vol: 0.36, cooldown: 0.50, dur: 0.80 },
  "chime":            { vol: 0.36, cooldown: 0.50, dur: 1.00 },
  "chime-bright":     { vol: 0.36, cooldown: 0.50, dur: 1.10 },
  "squeak":           { vol: 0.20, cooldown: 0.30, dur: 0.14 },
  "click-crack":      { vol: 0.52, cooldown: 0.08, dur: 0.22 },
  "jingle-sting":     { vol: 0.42, cooldown: 1.00, dur: 1.30 },
  "jingle-outro":     { vol: 0.42, cooldown: 1.00, dur: 2.20 },
} as const satisfies Record<string, { vol: number; cooldown: number; dur: number; loop?: boolean; bed?: boolean }>;
export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as [SfxName, ...SfxName[]];
export const MAX_SIMULTANEOUS_SFX = 3;               // at most this many one-shots sound at once (a loop is a bed, it does not count)
export const SFX_MASTER_CEILING = 0.5;               // the mix never goes above -6 dBFS: the rest is headroom for a voice-over bus (P28-C)
export const SFX_SAMPLE_RATE = 48000;

/** What a motion word sounds like. Each is read by src/sfx.ts; a story can change one item's sound with `sfx`, or silence it with "none". */
export const SFX_FOR = {
  transition: { slide: "swish", wipe: "whoosh", zoom: "zoom-whoosh", lens: "glass-ting" },     // the lens one also gets a zoom whoosh
  enter: {
    mascot: { pop: "boing", slide: "swish-soft", "fade-up": "pop-soft", draw: "tick" },
    chibi: { pop: "pop", slide: "swish-soft", "fade-up": "pop-soft", draw: "tick" },
    socket: { pop: "pop", slide: "swish-soft", "fade-up": "pop-soft", draw: "zip" },
    lens: { pop: "pop", slide: "swish-soft", "fade-up": "glass-ting", draw: "glass-ting" },
    banner: { pop: "thump", slide: "thump", "fade-up": "thump", draw: "thump" },              // the banner drops: a thump when it lands
    pill: { pop: "pop", slide: "swish-soft", "fade-up": "tick-soft", draw: "tick" },
    label: { pop: "tick", slide: "tick-soft", "fade-up": "tick-soft", draw: "tick" },
    stack: { pop: "pop", slide: "swish-soft", "fade-up": "pop-soft", draw: "tick" },
    arrow: { pop: "tick", slide: "tick", "fade-up": "tick", draw: "tick" },
    badge: { pop: "tick", slide: "tick", "fade-up": "tick", draw: "tick" },                   // a "!" badge is an alert blip instead
  },
  action: { highlight: "tick", shake: "rattle" },
  mascotExpr: { surprised: "huh", ouch: "slide-whistle-down", understand: "chime", laugh: "chime-bright" },   // the others are silent
  chibiExpr: { surprised: "huh", ouch: "slide-whistle-down" },
  beat: { sting: "jingle-sting", outro: "jingle-outro" },
  heat: "sizzle", current: "hum", smoke: "puff", alertBadge: "blip-alert",
} as const;

// ---------------------------------------------------------------- what the validator checks, in words (for the brief) -----------------------------
/** The rules src/schema.ts enforces beyond the shape of the fields, as sentences. catalog-export.mjs prints them into the brief, so what the
    AI is told is what the validator checks (keep this list in step with the superRefine in schema.ts). */
export const STORY_RULES = [
  "the beats' durations add up to `duration`, and every beat id is unique (lowercase letters, digits, hyphen)",
  "screen text (`text`, banner/pill/label text, label lines) is at most 6 words",
  "at most 3 transitions other than a cut; the first beat has no transition; a transition lasts at most 80% of the shorter of its two beats; a `lens` transition needs x, y and r",
  "a socket's `variant` must belong to its `view`: outside has plain/scorched, cutaway has tight/loose",
  "an action's time, an enter `delay` and an exit `at` must be inside the beat; an item cannot exit before it enters",
  "`look` is only for the mascot, `pose` only for the chibi; `expr` only for the mascot or chibi and only with an expression they have",
  "a label or arrow with `follow` names a socket or lens `id` of its own beat (not one drawn flat)",
  "every claim names beats that exist and has at least one source URL",
] as const;
