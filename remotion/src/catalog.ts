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
