/* The motion language of the klipian intip channel (Style Bible v1 round 2, DESIGN.md section 0b, must 3: a consistent animation). It is measured from
   pilot 1 (videos/kenapa-colokan-panas: its plan.ts, index.tsx, src/motion.ts and its story's camera and transition values) and written here, so every
   video moves with the same easings, the same springs and the same camera. tests/style.test.ts and scripts/styleCheck.mjs read this file.
   A video may leave a range only with a reason written in its plan.ts (a comment "motion-exception: <reason>") and ian's OK. Pure data: no React here. */

// The easings a video may use. Each is the exact expression in src/motion.ts (or the camera push in src/motion.ts cameraAt).
export const EASINGS = {
  easeOut: "Easing.out(Easing.cubic)",                      // src/motion.ts easeOut: entrances and slides
  easeInOut: "Easing.inOut(Easing.cubic)",                  // src/motion.ts easeInOut: exits and fades
  easeOutBack: "Easing.out(Easing.back(1.4))",              // src/motion.ts easeOutBack: a small overshoot (the pop)
  cameraPush: "Easing.inOut(Easing.quad)",                  // src/motion.ts cameraAt: the slow push of a stage
} as const;
// the Easing functions a video may name (the parts of the expressions above): anything else is a FAIL
export const EASING_TOKENS = ["Easing.out", "Easing.in", "Easing.inOut", "Easing.cubic", "Easing.quad", "Easing.back"] as const;

// The springs: src/motion.ts springAt. `default` for an object or a label, `soft` for arms and faces (less overshoot).
export const SPRINGS = {
  default: { damping: 12, stiffness: 150, mass: 0.8 },
  soft: { damping: 20, stiffness: 120, mass: 0.9 },
} as const;

// The ranges of each kind of move, in seconds, measured from pilot 1 (the bounds are the measured values, widened only where pilot 1 has one value).
// The lens dive is the fastest camera move (the transition "lens"); the pushes are the slow stage moves.
export const RANGES = {
  enter: [0.25, 0.6],                 // an object enters (a spring: settles inside this)
  labelIn: [0.2, 0.4],                // a label or a pill comes in
  cameraPush: [4, 8],                 // a push over the beat: pilot 1's pushes last 5 to 7 s
  cameraPan: [0.8, 2.5],              // a pan that settles (the plan's range; pilot 1 has none)
  lensDive: [0.7, 1.0],               // the lens transition in or out: pilot 1 has 0.8 s
  wipeSlide: [0.4, 1.0],              // a wipe or a slide between beats: pilot 1 has 0.5 and 0.6 s
} as const;

// the camera's top speeds: a zoom per second and a pan in px per second (pilot 1's fastest move is the lens dive, the pushes are far below both)
export const CAMERA_MAX = { zoomPerSecond: 0.05, panPxPerSecond: 800 } as const;

// the ambient motions: their periods in seconds, from src/motion.ts (hover, breathe, blink). A video uses these constants, not its own.
export const AMBIENT = { hoverPeriod: 1 / 0.55, breathePeriod: 1 / 0.4, blinkPeriod: 3.4 } as const;

// the small continuous motion of an "alive" asset (P28-R phase 5, DESIGN.md B25, src/alive.ts): the sizes and periods every asset uses. A figure that is too big is
// a distraction (an asset that dances), one that is too small is not seen at the phone's size; these are the measured middle (a 1080 px frame, an asset 300 to 650 px).
export const ALIVE = {
  breatheAmp: 0.02,                   // a body breathes +/- 2 % of its size
  swayDeg: 2, swayPeriod: 3.2,        // a leaf or a lamp sways +/- 2 degrees over 3.2 s
  bobPx: 6,                           // a floating thing bobs +/- 6 px
  driftPx: 14, driftPeriod: 9,        // a cloud drifts +/- 14 px over 9 s
  pulsePeriod: 2.4,                   // a glow breathes over 2.4 s
  heartBpm: 72, fanRps: 2.2,
  flickerAmp: 0.04,                   // a light flickers +/- 4 %
  risePeriod: 2.6,                    // a wisp of steam lives 2.6 s
} as const;

// the motion density (B25): something moves about every second, and something new (an element comes in, the camera moves to another place, the scene changes)
// every 3 to 4 seconds. scripts/motionDensity.mjs measures it on the picture of a rendered video (the frame difference at 4 samples a second).
export const DENSITY = {
  sampleFps: 4,                        // the samples a second the measure takes
  aliveMax: 1.25,                      // seconds: the longest stretch in which nothing in the picture moves
  newMax: 4,                           // seconds: the longest stretch without something new (a bigger change of the picture)
  region: [0.21, 0.76],                // the rows (shares of the height) the measure reads: below the top text, above the captions and the source chips
  moveEps: 0.12,                       // the mean difference (0..255, on a 54 x 96 grey picture) above which a sample counts as moving
  newEps: 12,                          // the mean difference from the last new thing above which the picture is something new (a camera move, another scene)
} as const;

// the motion blur is for the fast moves only: a beat may set `blur` when it has a transition other than a cut or a pan camera
export const BLUR_TRANSITIONS = ["lens", "slide", "wipe", "zoom"] as const;

/** Exceptions to the colour rule (a literal colour or a gradient the video still has), each with its reason. The checker FAILs any other. */
export const STYLE_EXCEPTIONS: readonly { video: string; match: string; reason: string }[] = [
  { video: "kenapa-colokan-panas", match: "rgb(52,52,54)", reason: "the dark scrim of the lab over the cutaway (one fixed grey; move it to tokens.ts in a later round)" },
  { video: "kenapa-colokan-panas", match: "linearGradient", reason: "the same scrim as a gradient (fades the lab into the stage); a gradient is an exception of the lab only" },
  { video: "kenapa-colokan-panas", match: "\"DM Mono\", monospace", reason: "the DM Mono label font (B17) written out where the token FONT_MONO is not imported yet; move it to tokens in a later round" },
  { video: "kenapa-colokan-panas", match: "\"Outfit\", sans-serif", reason: "the Outfit bold font (B17) written out where the token FONT_BOLD is not imported yet; move it to tokens in a later round" },
];

/** B17 (the text style is locked): the fonts of a video are the tokens' fonts (FONT_BOLD, FONT_MONO); a literal font name is a FAIL unless registered above. */
export const FONTS = { bold: "Outfit", mono: "DM Mono" } as const;
