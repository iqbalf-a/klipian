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
export const ITEM_TYPES = ["mascot", "chibi", "socket", "lens", "banner", "pill", "label", "stack", "arrow", "badge", "source"] as const;
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
/** Every sound effect there is (sfx/synth.mjs makes each as sfx/wav/<name>.wav), with how it is mixed (the rows from "plop" on are the variety set
    of 2026-11-13 and the growth of 2026-11-23 (B48, water to cartoon sounds, 72 more): open until ian approves them, see OPEN_SFX in scripts/soundHash.mjs; the rows above them are the approved set and never change): `vol` is its gain (0..1), `cooldown` the
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
  // pilot 2 (nature): synthesised in sfx/synth.mjs, CC0
  "rain-patter":      { vol: 0.35, cooldown: 0.80, dur: 0.90 },
  "drip":             { vol: 0.40, cooldown: 0.25, dur: 0.35 },
  "bubble-rise":      { vol: 0.35, cooldown: 0.60, dur: 0.90 },
  "plop":             { vol: 0.45, cooldown: 0.10, dur: 0.18 },
  "pop-wood":         { vol: 0.40, cooldown: 0.10, dur: 0.14 },
  "swish-down":       { vol: 0.34, cooldown: 0.30, dur: 0.32 },
  "whoosh-soft":      { vol: 0.36, cooldown: 0.40, dur: 0.50 },
  "swoop":            { vol: 0.24, cooldown: 0.30, dur: 0.28 },
  "tock":             { vol: 0.30, cooldown: 0.08, dur: 0.09 },
  "click-soft":       { vol: 0.22, cooldown: 0.10, dur: 0.06 },
  "marimba":          { vol: 0.36, cooldown: 0.50, dur: 0.70 },
  "bell-soft":        { vol: 0.32, cooldown: 0.50, dur: 1.00 },
  "page-flip":        { vol: 0.36, cooldown: 0.30, dur: 0.32 },
  "stamp":            { vol: 0.55, cooldown: 0.30, dur: 0.30 },
  "coin":             { vol: 0.30, cooldown: 0.30, dur: 0.50 },
  "switch":           { vol: 0.50, cooldown: 0.15, dur: 0.15 },
  "key-blip":         { vol: 0.17, cooldown: 0.08, dur: 0.09 },
  "water-splash":        { vol: 0.38, cooldown: 0.30, dur: 0.70 },
  "water-pour":          { vol: 0.42, cooldown: 0.80, dur: 1.20 },
  "wave-wash":           { vol: 0.48, cooldown: 0.80, dur: 1.80 },
  "bubble-pop":          { vol: 0.36, cooldown: 0.10, dur: 0.12 },
  "stream-trickle":      { vol: 0.42, cooldown: 0.80, dur: 1.50 },
  "gulp":                { vol: 0.28, cooldown: 0.40, dur: 0.40 },
  "door-creak":          { vol: 0.37, cooldown: 0.80, dur: 1.20 },
  "wood-crack":          { vol: 0.59, cooldown: 0.30, dur: 0.30 },
  "drawer-slide":        { vol: 0.47, cooldown: 0.50, dur: 0.60 },
  "door-knock":          { vol: 0.43, cooldown: 0.50, dur: 0.50 },
  "metal-clang":         { vol: 0.37, cooldown: 0.50, dur: 1.00 },
  "anvil-ting":          { vol: 0.38, cooldown: 0.50, dur: 1.20 },
  "chain-rattle":        { vol: 0.57, cooldown: 0.50, dur: 0.80 },
  "can-tap":             { vol: 0.60, cooldown: 0.20, dur: 0.20 },
  "key-jingle":          { vol: 0.50, cooldown: 0.50, dur: 0.80 },
  "cloth-rustle":        { vol: 0.54, cooldown: 0.40, dur: 0.70 },
  "zipper-pull":         { vol: 0.60, cooldown: 0.30, dur: 0.50 },
  "velcro-rip":          { vol: 0.60, cooldown: 0.40, dur: 0.45 },
  "fabric-flap":         { vol: 0.25, cooldown: 0.30, dur: 0.50 },
  "paper-crumple":       { vol: 0.60, cooldown: 0.40, dur: 0.60 },
  "paper-tear":          { vol: 0.58, cooldown: 0.40, dur: 0.50 },
  "scribble-pen":        { vol: 0.46, cooldown: 0.50, dur: 0.80 },
  "glass-clink":         { vol: 0.36, cooldown: 0.40, dur: 0.80 },
  "cork-pop":            { vol: 0.35, cooldown: 0.30, dur: 0.25 },
  "glass-break":         { vol: 0.40, cooldown: 0.80, dur: 1.00 },
  "crunch":              { vol: 0.60, cooldown: 0.30, dur: 0.30 },
  "slurp":               { vol: 0.51, cooldown: 0.50, dur: 0.70 },
  "soda-fizz":           { vol: 0.32, cooldown: 0.80, dur: 1.50 },
  "knife-chop":          { vol: 0.52, cooldown: 0.15, dur: 0.20 },
  "egg-crack":           { vol: 0.60, cooldown: 0.30, dur: 0.40 },
  "bird-chirp":          { vol: 0.21, cooldown: 0.40, dur: 0.50 },
  "meow":                { vol: 0.23, cooldown: 0.50, dur: 0.80 },
  "frog-croak":          { vol: 0.30, cooldown: 0.40, dur: 0.50 },
  "cricket":             { vol: 0.29, cooldown: 0.50, dur: 0.80 },
  "bee-buzz":            { vol: 0.27, cooldown: 0.60, dur: 1.20 },
  "car-horn":            { vol: 0.21, cooldown: 0.60, dur: 0.60 },
  "bike-bell":           { vol: 0.35, cooldown: 0.40, dur: 0.90 },
  "engine-rev":          { vol: 0.15, cooldown: 0.80, dur: 1.50 },
  "train-whistle":       { vol: 0.30, cooldown: 0.80, dur: 1.60 },
  "brake-squeal":        { vol: 0.37, cooldown: 0.60, dur: 0.90 },
  "doorbell":            { vol: 0.26, cooldown: 0.60, dur: 1.20 },
  "alarm-ring":          { vol: 0.19, cooldown: 0.80, dur: 1.00 },
  "kettle-whistle":      { vol: 0.50, cooldown: 0.80, dur: 1.80 },
  "microwave-ding":      { vol: 0.22, cooldown: 0.60, dur: 1.00 },
  "toaster-pop":         { vol: 0.28, cooldown: 0.30, dur: 0.40 },
  "phone-buzz":          { vol: 0.20, cooldown: 0.50, dur: 0.90 },
  "camera-shutter":      { vol: 0.60, cooldown: 0.20, dur: 0.25 },
  "typing":              { vol: 0.60, cooldown: 0.50, dur: 0.90 },
  "power-up":            { vol: 0.21, cooldown: 0.60, dur: 0.80 },
  "power-down":          { vol: 0.25, cooldown: 0.60, dur: 0.80 },
  "static-burst":        { vol: 0.59, cooldown: 0.40, dur: 0.40 },
  "notify-ding":         { vol: 0.30, cooldown: 0.40, dur: 0.50 },
  "low-battery":         { vol: 0.16, cooldown: 0.60, dur: 0.70 },
  "wind-gust":           { vol: 0.46, cooldown: 0.80, dur: 1.80 },
  "thunder-rumble":      { vol: 0.35, cooldown: 1.00, dur: 2.50 },
  "leaf-rustle":         { vol: 0.60, cooldown: 0.60, dur: 1.00 },
  "fire-crackle":        { vol: 0.60, cooldown: 0.80, dur: 1.60 },
  "success-fanfare":     { vol: 0.32, cooldown: 0.80, dur: 1.20 },
  "error-buzz":          { vol: 0.19, cooldown: 0.40, dur: 0.50 },
  "level-up":            { vol: 0.34, cooldown: 0.80, dur: 1.20 },
  "toggle-on":           { vol: 0.21, cooldown: 0.15, dur: 0.12 },
  "swipe":               { vol: 0.46, cooldown: 0.30, dur: 0.30 },
  "sparkle":             { vol: 0.50, cooldown: 0.50, dur: 0.90 },
  "countdown-beep":      { vol: 0.17, cooldown: 0.30, dur: 0.20 },
  "heartbeat":           { vol: 0.26, cooldown: 0.50, dur: 0.70 },
  "footstep":            { vol: 0.31, cooldown: 0.15, dur: 0.25 },
  "clap-hands":          { vol: 0.60, cooldown: 0.20, dur: 0.30 },
  "finger-snap":         { vol: 0.60, cooldown: 0.20, dur: 0.25 },
  "bonk":                { vol: 0.27, cooldown: 0.30, dur: 0.40 },
  "slide-whistle-up":    { vol: 0.19, cooldown: 0.50, dur: 0.70 },
  "drum-roll":           { vol: 0.60, cooldown: 0.80, dur: 1.20 },
  "cymbal-crash":        { vol: 0.44, cooldown: 0.80, dur: 1.80 },
  "xylophone-c":        { vol: 0.42, cooldown: 0.25, dur: 0.45 },
  "xylophone-g":        { vol: 0.42, cooldown: 0.25, dur: 0.45 },
  "glockenspiel":       { vol: 0.30, cooldown: 0.50, dur: 0.90 },
  "triangle-ding":      { vol: 0.22, cooldown: 0.60, dur: 1.20 },
  "cowbell":            { vol: 0.40, cooldown: 0.30, dur: 0.50 },
  "gong-soft":          { vol: 0.40, cooldown: 1.00, dur: 2.00 },
  "marimba-low":        { vol: 0.45, cooldown: 0.30, dur: 0.60 },
  "pan-clang":          { vol: 0.40, cooldown: 0.50, dur: 0.70 },
  "mug-clink":          { vol: 0.45, cooldown: 0.30, dur: 0.40 },
  "elevator-ding":      { vol: 0.30, cooldown: 0.60, dur: 0.90 },
  "steel-drum":         { vol: 0.40, cooldown: 0.40, dur: 0.80 },
  "sonar-ping":         { vol: 0.28, cooldown: 0.80, dur: 1.00 },
  "kalimba-a":          { vol: 0.40, cooldown: 0.30, dur: 0.70 },
  "kalimba-e":          { vol: 0.40, cooldown: 0.30, dur: 0.70 },
  "music-box":          { vol: 0.30, cooldown: 0.40, dur: 0.80 },
  "toy-piano":          { vol: 0.38, cooldown: 0.30, dur: 0.50 },
  "claves":             { vol: 0.50, cooldown: 0.15, dur: 0.12 },
  "woodblock-hi":       { vol: 0.50, cooldown: 0.15, dur: 0.15 },
  "woodblock-lo":       { vol: 0.50, cooldown: 0.15, dur: 0.18 },
  "pizzicato":          { vol: 0.45, cooldown: 0.20, dur: 0.35 },
  "vibraphone":         { vol: 0.30, cooldown: 0.60, dur: 1.10 },
  "harp-gliss":         { vol: 0.30, cooldown: 0.60, dur: 1.00 },
  "ukulele-strum":      { vol: 0.35, cooldown: 0.40, dur: 0.70 },
  "rubber-band-twang":  { vol: 0.40, cooldown: 0.40, dur: 0.50 },
  "bongo-hi":           { vol: 0.50, cooldown: 0.15, dur: 0.25 },
  "bongo-lo":           { vol: 0.50, cooldown: 0.15, dur: 0.30 },
  "snare-hit":          { vol: 0.45, cooldown: 0.20, dur: 0.30 },
  "kick-soft":          { vol: 0.55, cooldown: 0.25, dur: 0.35 },
  "hi-hat":             { vol: 0.30, cooldown: 0.10, dur: 0.10 },
  "rimshot":            { vol: 0.45, cooldown: 0.20, dur: 0.20 },
  "tambourine":         { vol: 0.30, cooldown: 0.40, dur: 0.50 },
  "maracas":            { vol: 0.35, cooldown: 0.30, dur: 0.35 },
  "castanets":          { vol: 0.40, cooldown: 0.30, dur: 0.35 },
  "gong-wobble":        { vol: 0.30, cooldown: 1.00, dur: 1.60 },
  "spring-boing":       { vol: 0.35, cooldown: 0.40, dur: 0.70 },
  "balloon-squeak":     { vol: 0.25, cooldown: 0.40, dur: 0.50 },
  "balloon-pop":        { vol: 0.45, cooldown: 0.25, dur: 0.15 },
  "plunger-pop":        { vol: 0.45, cooldown: 0.25, dur: 0.20 },
  "ratchet":            { vol: 0.35, cooldown: 0.50, dur: 0.60 },
  "slap-hit":           { vol: 0.50, cooldown: 0.20, dur: 0.20 },
  "punch-soft":         { vol: 0.55, cooldown: 0.25, dur: 0.25 },
  "stomp":              { vol: 0.55, cooldown: 0.25, dur: 0.30 },
  "door-slam":          { vol: 0.55, cooldown: 0.50, dur: 0.40 },
  "sticker-peel":       { vol: 0.35, cooldown: 0.40, dur: 0.50 },
  "tape-rip":           { vol: 0.40, cooldown: 0.50, dur: 0.70 },
  "scissors-snip":      { vol: 0.45, cooldown: 0.20, dur: 0.25 },
  "stapler":            { vol: 0.50, cooldown: 0.25, dur: 0.20 },
  "pencil-tap":         { vol: 0.45, cooldown: 0.10, dur: 0.12 },
  "marker-squeak":      { vol: 0.25, cooldown: 0.30, dur: 0.40 },
  "eraser-rub":         { vol: 0.35, cooldown: 0.40, dur: 0.60 },
  "coin-drop":          { vol: 0.40, cooldown: 0.50, dur: 0.80 },
  "cash-register":      { vol: 0.40, cooldown: 0.60, dur: 0.90 },
  "keyboard-clack":     { vol: 0.45, cooldown: 0.30, dur: 0.35 },
  "mouse-click":        { vol: 0.50, cooldown: 0.10, dur: 0.10 },
  "usb-plug":           { vol: 0.30, cooldown: 0.30, dur: 0.25 },
  "modem-chirp":        { vol: 0.22, cooldown: 0.50, dur: 0.80 },
  "radar-blip":         { vol: 0.30, cooldown: 0.20, dur: 0.30 },
  "lock-click":         { vol: 0.45, cooldown: 0.25, dur: 0.30 },
  "shutter-roll":       { vol: 0.35, cooldown: 0.50, dur: 0.90 },
  "laser-zap":          { vol: 0.30, cooldown: 0.20, dur: 0.30 },
  "robot-chirp":        { vol: 0.25, cooldown: 0.30, dur: 0.40 },
  "teleport":           { vol: 0.25, cooldown: 0.60, dur: 0.70 },
  "magic-twinkle":      { vol: 0.25, cooldown: 0.50, dur: 0.80 },
  "jump-8bit":          { vol: 0.20, cooldown: 0.20, dur: 0.25 },
  "coin-8bit":          { vol: 0.20, cooldown: 0.20, dur: 0.25 },
  "powerdown-8bit":     { vol: 0.20, cooldown: 0.40, dur: 0.50 },
  "pickup-8bit":        { vol: 0.20, cooldown: 0.30, dur: 0.30 },
  "fan-whirr":          { vol: 0.30, cooldown: 0.80, dur: 1.00 },
  "steam-hiss":         { vol: 0.28, cooldown: 0.80, dur: 1.00 },
  "spray-can":          { vol: 0.28, cooldown: 0.50, dur: 0.70 },
  "water-drip-echo":    { vol: 0.35, cooldown: 0.60, dur: 0.80 },
  "bath-bubbles":       { vol: 0.35, cooldown: 0.60, dur: 0.80 },
  "pan-sizzle":         { vol: 0.30, cooldown: 0.80, dur: 1.00 },
  "cutlery-clatter":    { vol: 0.35, cooldown: 0.40, dur: 0.60 },
  "gate-squeak":        { vol: 0.25, cooldown: 0.60, dur: 0.80 },
  "wheel-squeak":       { vol: 0.22, cooldown: 0.50, dur: 0.60 },
  "school-bell":        { vol: 0.30, cooldown: 0.80, dur: 1.20 },
  "crowd-gasp":         { vol: 0.35, cooldown: 0.50, dur: 0.80 },
  "sigh":               { vol: 0.30, cooldown: 0.60, dur: 0.90 },
  "sniff":              { vol: 0.35, cooldown: 0.30, dur: 0.25 },
  "yawn":               { vol: 0.28, cooldown: 0.80, dur: 1.00 },
  "snore":              { vol: 0.28, cooldown: 0.80, dur: 1.20 },
  "hiccup":             { vol: 0.35, cooldown: 0.30, dur: 0.30 },
} as const satisfies Record<string, { vol: number; cooldown: number; dur: number; loop?: boolean; bed?: boolean }>;
export type SfxName = keyof typeof SFX;
/** The nature assets of pilot 2 (src/components/IsoNature.tsx, NatureDemo, NatureSheet); the rest of the catalog is the same. */
export const NATURE_ASSETS = ["sea", "land", "tree", "sun", "cloud", "rain", "vapour", "droplets", "splash", "runoff"] as const;
export const SFX_NAMES = Object.keys(SFX) as [SfxName, ...SfxName[]];
export const MAX_SIMULTANEOUS_SFX = 3;               // at most this many one-shots sound at once (a loop is a bed, it does not count)
export const SFX_MASTER_CEILING = 0.5;               // the mix never goes above -6 dBFS: the rest is headroom for a voice-over bus (P28-C)
export const SFX_SAMPLE_RATE = 48000;
/** Sounds that do the same job (ian, 2026-11-13: every video sounded alike). A hand-written sfx.ts spreads its events over the names of a family
    instead of always taking the first; the brief prints this table. The default map below (SFX_FOR) is unchanged. */
export const SFX_FAMILIES = {
  pop: ["pop", "pop-soft", "plop", "pop-wood", "drip"],
  swish: ["swish", "swish-soft", "swish-down", "swoop"],
  whoosh: ["whoosh", "whoosh-soft", "zoom-whoosh"],
  tick: ["tick", "tick-soft", "tock", "click-soft", "key-blip", "switch"],
  result: ["chime", "chime-bright", "marimba", "bell-soft", "glass-ting", "coin"],
  land: ["thump", "stamp"],
  paper: ["page-flip", "swish-soft"],
  water: ["water-splash", "water-pour", "wave-wash", "bubble-pop", "stream-trickle", "gulp"],
  wood: ["door-creak", "wood-crack", "drawer-slide", "door-knock"],
  metal: ["metal-clang", "anvil-ting", "chain-rattle", "can-tap", "key-jingle"],
  cloth: ["cloth-rustle", "zipper-pull", "velcro-rip", "fabric-flap"],
  scrap: ["paper-crumple", "paper-tear", "scribble-pen"],
  glass: ["glass-clink", "cork-pop", "glass-break"],
  food: ["crunch", "slurp", "soda-fizz", "knife-chop", "egg-crack"],
  animals: ["bird-chirp", "meow", "frog-croak", "cricket", "bee-buzz"],
  vehicles: ["car-horn", "bike-bell", "engine-rev", "train-whistle", "brake-squeal"],
  household: ["doorbell", "alarm-ring", "kettle-whistle", "microwave-ding", "toaster-pop"],
  devices: ["phone-buzz", "camera-shutter", "typing", "power-up", "power-down", "static-burst", "notify-ding", "low-battery"],
  weather: ["wind-gust", "thunder-rumble", "leaf-rustle", "fire-crackle"],
  interface: ["success-fanfare", "error-buzz", "level-up", "toggle-on", "swipe", "sparkle", "countdown-beep"],
  body: ["heartbeat", "footstep", "clap-hands", "finger-snap"],
  cartoon: ["bonk", "slide-whistle-up", "drum-roll", "cymbal-crash"],
  // the 2026-11-25 pool (B61)
  struck: ["xylophone-c", "xylophone-g", "glockenspiel", "vibraphone", "marimba-low", "steel-drum", "kalimba-a", "kalimba-e", "toy-piano", "music-box", "triangle-ding", "cowbell", "gong-soft", "gong-wobble", "harp-gliss", "pizzicato", "ukulele-strum", "school-bell", "elevator-ding", "magic-twinkle"],
  drums: ["bongo-hi", "bongo-lo", "snare-hit", "kick-soft", "hi-hat", "tambourine", "maracas", "castanets", "claves", "woodblock-hi", "woodblock-lo", "rimshot"],
  slapstick: ["balloon-pop", "balloon-squeak", "slap-hit", "punch-soft", "stomp", "spring-boing", "rubber-band-twang", "plunger-pop", "crowd-gasp", "ratchet", "wheel-squeak", "gate-squeak", "door-slam"],
  desk: ["cash-register", "coin-drop", "stapler", "mouse-click", "keyboard-clack", "pencil-tap", "marker-squeak", "eraser-rub", "scissors-snip", "sticker-peel", "tape-rip", "lock-click", "usb-plug", "shutter-roll", "spray-can"],
  kitchen: ["cutlery-clatter", "mug-clink", "pan-clang", "pan-sizzle", "steam-hiss", "bath-bubbles", "water-drip-echo", "fan-whirr"],
  retro: ["coin-8bit", "jump-8bit", "pickup-8bit", "powerdown-8bit", "laser-zap", "radar-blip", "sonar-ping", "teleport", "robot-chirp", "modem-chirp"],
  voice: ["hiccup", "sigh", "sniff", "snore", "yawn"],
} as const satisfies Record<string, readonly SfxName[]>;

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
    source: { pop: "pop-soft", slide: "swish-soft", "fade-up": "pop-soft", draw: "pop-soft" },   // a source card: a soft pop
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

// ---------------------------------------------------------------- music beds (P28-P) --------------------------------------------------------------
/** The music beds (sfx/music/<name>.wav, made by sfx/music.mjs): loops that sit under the narration. `level` is the gain of the bed WITH a voice
    (about 12 dB under it); `solo` the gain when there is no voice. A story picks one (or "none") and may scale it with `music.level`. */
export const MUSIC = {
  "bed-calm": { level: 0.06, solo: 0.18, dur: 24 },
  "bed-tech": { level: 0.06, solo: 0.18, dur: 24 },
  // the cheerful beds (PLAN-VARIETY stage 1): the levels are judged by ian's ears against the pilot 1 mix; `dur` is the loop's length in seconds
  "bed-sunny": { level: 0.06, solo: 0.18, dur: 16 },
  "bed-bounce": { level: 0.06, solo: 0.18, dur: 24 },
  "bed-glow": { level: 0.05, solo: 0.15, dur: 24 },   // a little lower: its bells sit in the voice band
  "bed-curious": { level: 0.06, solo: 0.18, dur: 24 },
  // the technology beds (P28-R phase 4): synth arpeggios over a light electronic beat; the levels keep their voice band (1 to 4 kHz) within about 2.5 dB of bed-calm's, measured in out/music/measure.md
  "bed-circuit": { level: 0.075, solo: 0.22, dur: 16 },
  "bed-neon": { level: 0.065, solo: 0.19, dur: 17.07 },
  // the variety beds (2026-11-13, open until ian approves them): the levels keep the voice band inside the range of the beds above (scripts/musicMeasure.py)
  "bed-pixel": { level: 0.07, solo: 0.21, dur: 15 },
  "bed-study": { level: 0.06, solo: 0.18, dur: 20 },
  "bed-breeze": { level: 0.05, solo: 0.15, dur: 17.78 },   // a little lower: its strum and glockenspiel sit in the voice band
  // the growth of 2026-11-23 (B48), open until ian approves them: 21 more beds, each its own key, tempo, rhythm and voices (sfx/beds-more.mjs); the levels are set from the voice band (scripts/musicMeasure.py)
  "bed-lullaby": { level: 0.027, solo: 0.081, dur: 26.67 },
  "bed-dream": { level: 0.048, solo: 0.144, dur: 29.09 },
  "bed-sleepy": { level: 0.044, solo: 0.132, dur: 32.00 },
  "bed-rainy": { level: 0.050, solo: 0.150, dur: 27.43 },
  "bed-minimal": { level: 0.032, solo: 0.096, dur: 19.20 },
  "bed-lofi": { level: 0.090, solo: 0.270, dur: 24.62 },
  "bed-groove": { level: 0.064, solo: 0.192, dur: 20.87 },
  "bed-funk": { level: 0.070, solo: 0.210, dur: 18.46 },
  "bed-disco": { level: 0.069, solo: 0.207, dur: 16.55 },
  "bed-picnic": { level: 0.024, solo: 0.072, dur: 16.27 },
  "bed-island": { level: 0.046, solo: 0.138, dur: 19.20 },
  "bed-march": { level: 0.033, solo: 0.099, dur: 17.14 },
  "bed-sparkle": { level: 0.022, solo: 0.066, dur: 14.55 },
  "bed-campfire": { level: 0.038, solo: 0.114, dur: 21.82 },
  "bed-train": { level: 0.067, solo: 0.201, dur: 16.00 },
  "bed-waltz": { level: 0.026, solo: 0.078, dur: 13.33 },
  "bed-pulse": { level: 0.062, solo: 0.186, dur: 15.48 },
  "bed-orbit": { level: 0.030, solo: 0.090, dur: 21.33 },
  "bed-clockwork": { level: 0.090, solo: 0.270, dur: 19.20 },
  "bed-boot": { level: 0.089, solo: 0.267, dur: 14.12 },
  "bed-wonder": { level: 0.043, solo: 0.129, dur: 22.86 },
} as const;
export const MUSIC_NAMES = Object.keys(MUSIC) as [keyof typeof MUSIC, ...(keyof typeof MUSIC)[]];
