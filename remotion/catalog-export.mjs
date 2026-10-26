// node catalog-export.mjs  ->  the catalogue of the channel's assets and rules as JSON on stdout.
//
// klipian (Python) puts this in the brief it hands to the AI, so the AI can only choose what really renders, and the rules it is told are the
// ones src/schema.ts enforces: nothing is copied into Python. Everything here is read from src/catalog.ts, src/schema.ts and src/tokens.ts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as C from "./src/catalog.ts";
import { Beat, Claim, Item, MAX_SCREEN_WORDS, MAX_TRANSITIONS, Story } from "./src/schema.ts";
import { fieldsOf, unionFields } from "./src/describe.ts";
import { FPS, MAX_NON_CUT_TRANSITIONS } from "./src/timeline.ts";
import { FRAME, SAFE } from "./src/tokens.ts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export function catalog() {
  const refs = new Map([[Item, "item"], [Beat, "beat"]]);              // so a beat inside the story, or an item inside a beat, is a name and not the whole shape again
  const items = unionFields(Item, refs);
  const motionKeys = ["enter?", "exit?", "actions?", "sfx?"];          // every item has these: said once
  const motionFields = Object.fromEntries(motionKeys.map((k) => [k, items.banner[k]]));
  for (const fields of Object.values(items)) for (const k of motionKeys) delete fields[k];
  return {
    format: { width: FRAME.width, height: FRAME.height, fps: FPS, unit: "video pixels; x to the right, y down; (0,0) is the top-left corner" },
    limits: {
      maxScreenWords: MAX_SCREEN_WORDS, maxTransitions: MAX_TRANSITIONS, maxNonCutTransitions: MAX_NON_CUT_TRANSITIONS,
      safeArea: { ...SAFE, note: "keep text, mascot and chibi inside it: the Shorts interface covers the bottom 15% (y > 1632) and the right 12% (x > 950)" },
      beats: { min: 1, max: 16 }, itemsPerBeat: { max: 14 }, narrationMaxChars: 600, beatSeconds: { min: 0.5, max: 30 },
    },
    story: { fields: fieldsOf(Story, refs), beat: fieldsOf(Beat, refs), claim: fieldsOf(Claim, refs) },
    items, motionFields,
    rules: C.STORY_RULES,
    enums: {
      beatKinds: C.BEAT_KINDS, backgrounds: C.BACKGROUNDS, socketViews: C.SOCKET_VIEWS, outsideVariants: C.OUTSIDE_VARIANTS, cutawayVariants: C.CUTAWAY_VARIANTS,
      models: C.MODELS, anchors: C.ANCHOR_NAMES, labelColors: C.LABEL_COLORS, arrowColors: C.ARROW_COLORS,
    },
    characters: { roles: C.CHIBI_ROLES, expressions: C.CHIBI_EXPRESSIONS, poses: C.CHIBI_POSES, costumes: C.CHIBI_COSTUMES },
    mascot: { expressions: C.MASCOT_EXPRESSIONS },
    motion: {
      enter: C.ENTER_KINDS, exit: C.EXIT_KINDS, directions: C.DIRECTIONS, actions: C.ACTION_KINDS, camera: C.CAMERA_KINDS, transitions: C.TRANSITION_KINDS,
      notes: "Every item may carry enter / exit / actions / sfx; without them it still enters (staggered 4 frames), idles and the camera pushes slowly.",
    },
    sfx: { names: C.SFX_NAMES, none: "none", note: "every motion word already has a default sound; an item's `sfx` is only for overriding the sound of its entrance" },
    example: JSON.parse(readFileSync(path.join(ROOT, "stories", "example.json"), "utf8")),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(catalog(), null, 2)}\n`);
}
