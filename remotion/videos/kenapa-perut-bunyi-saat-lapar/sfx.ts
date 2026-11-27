/* Hand-timed cues for the intestinal cutaway, loop-back, captions and the result reveal. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";

const q = (t: number) => Math.round(t * FPS) / FPS;
const BEFORE: [SfxName, string][] = [
  ["low-whoomp", "the hook lands on the belly silhouette"], ["gut-gurgle", "a quiet gurgle hints at internal movement"],
  ["hollow-tube-ping", "the question mark pulses"], ["jingle-sting", "the voice-only Intip yuk sting"], ["liquid-glug", "the camera enters the cutaway"], ["soft-air-sweep", "the first cutaway settles"],
  ["muted-knock", "the outer tissue edge settles"], ["double-knock", "the colon outline appears"], ["rounded-thump", "the intestinal tube takes shape"],
  ["rubber-wobble", "the tissue gives a small pulse"], ["elastic-pluck", "a small intestine loop settles"], ["small-gliss", "the view traces the first loop"],
  ["falling-chime", "a caption page turns over"], ["rising-chime", "the second loop comes into view"], ["shimmer-tap", "a tiny highlight travels along the lumen"],
  ["hollow-wood-tap", "a tube bend rounds into place"], ["soft-metal-tick", "the cutaway edge gets a clean marker"], ["paper-flick", "the caption changes"],
  ["cloth-flick", "the surrounding tissue shifts"], ["granular-shiver", "small contents move through the tube"], ["granular-drop", "one particle passes the bend"],
  ["soft-static-burst", "a faint movement ripple appears"], ["muted-rattle", "the bowel coils flex gently"], ["airy-pop", "a small gas pocket passes"],
  ["bubble-chain", "two bubbles travel through the lumen"], ["drip-pair", "fluid moves through the hollow tube"], ["liquid-ripple", "the movement echoes down the intestine"],
  ["resonant-bong", "the hollow space resonates"], ["tiny-whistle", "the camera eases toward the next bend"], ["tremolo-ping", "the contents vibrate softly"],
  ["breath-flutter", "the soft tissue breathes"], ["brush-swish", "the frame shifts to the after-meal scene"], ["soft-zipper", "the outer contour closes"],
  ["sonar-sweep", "a faint wave crosses the cutaway"], ["gentle-impact", "the intestinal wall meets its contents"], ["pulse-pair", "two slow contractions pass"],
  ["glass-shiver", "the hollow tube rings lightly"], ["steam-puff-soft", "the final pre-turn motion dissipates"],
  ["stomach-bubble", "one final bubble rises before the reveal"],
];
const TURN: [SfxName, string] = ["gut-rumble", "signature moment: the migrating motor complex contracts"];
const AFTER: [SfxName, string][] = [
  ["peristaltic-pulse", "the contraction rolls onward"], ["gut-gurgle", "the contents follow the contraction"],
  ["hollow-tube-ping", "the lumen gives a soft echo"], ["liquid-glug", "the residue moves ahead"],
  ["muted-knock", "the cutaway settles after the reveal"], ["rubber-wobble", "the intestinal wall relaxes"],
  ["elastic-pluck", "the food marker reaches the next bend"], ["small-gliss", "the result caption enters"],
  ["rising-chime", "the tip card appears"], ["paper-flick", "the final fact changes"],
  ["granular-drop", "a small particle exits the cutaway"], ["bubble-chain", "the last bubbles drift past"],
  ["liquid-ripple", "the motion echoes back toward the first frame"], ["breath-flutter", "the abdomen eases into the loop pose"],
  ["sonar-sweep", "the camera returns to the opening composition"],
];

export function sfx(_story: StoryT): SfxEvent[] {
  const events: SfxEvent[] = BEFORE.map(([name, why], i) => ({
    t: q(i * 40.8 / (BEFORE.length - 1)), name, why, vol: name === "jingle-sting" ? 0.45 : 0.24,
  }));
  events.push({ t: q(42), name: TURN[0], why: TURN[1], vol: 1.35 });
  AFTER.forEach(([name, why], i) => events.push({ t: q(43.05 + i * 1.08), name, why, vol: 0.24 }));
  return events.sort((a, b) => a.t - b.t);
}
