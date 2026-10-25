/* The plan of time and the motion functions (src/timeline.ts, src/motion.ts): `npm test`. The video keeps its length whatever the
   transitions, items enter one after another by default, springs settle, the camera ends where it should. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStory } from "../src/schema.ts";
import { cameraOf, enterOf, framesOf, sequencePlan, totalFrames, transitionInto } from "../src/timeline.ts";
import { blink, cameraAt, easeInOut, emphasisFx, enterFx, exitFx, exprAt, isKeyword, lookAt, poseAt, springAt } from "../src/motion.ts";

const raw = JSON.parse(readFileSync(new URL("../stories/colokan-panas.json", import.meta.url), "utf8"));
const checked = validateStory(raw);
assert.ok(checked.ok, "the sample story");
const story = checked.ok ? checked.story : (null as never);
let n = 0;
const eq = (got: unknown, want: unknown, what: string) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const near = (got: number, want: number, tol: number, what: string) => { n++; assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, wanted ${want} +- ${tol}`); };
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };

// the video keeps its length: sequences overlap by the transitions
const plan = sequencePlan(story);
const sumSeq = plan.reduce((a, p) => a + p.sequenceFrames, 0), sumOverlap = plan.reduce((a, p) => a + p.overlapAfter, 0);
eq(totalFrames(story), 1260, "42 s at 30 fps");
eq(sumSeq - sumOverlap, 1260, "sequences minus overlaps = the beats' total");
eq(plan.map((p) => p.from), [0, 90, 120, 270, 480, 720, 900, 1140], "each beat starts where the previous one ends");
eq(transitionInto(story, 1).kind, "wipe", "the wipe into the sting");
eq(transitionInto(story, 3).kind, "lens", "through the lens into the tight cutaway");
eq(transitionInto(story, 3).frames, framesOf(0.9), "the lens transition lasts 0.9 s");
eq(transitionInto(story, 0).kind, "cut", "no transition into the first beat");
eq(plan.filter((_, i) => transitionInto(story, i).kind !== "cut").length, 3, "three transitions in all");

// defaults: items enter in turn, 4 frames apart; the sting and the outro hold the camera still
const items = story.beats[0].scene.items;
near(enterOf(items[1], 1).delay, 4 / 30, 1e-9, "the second item waits 4 frames");
near(enterOf(items[2], 2).delay, 8 / 30, 1e-9, "the third waits 8");
eq(enterOf(items[0], 0).kind, "slide", "a banner slides in by default");
eq(enterOf(items[0], 0).dir, "down", "a banner drops in from above");
eq(enterOf(items[1], 1).kind, "draw", "a socket with a cable draws it");
eq(cameraOf(story.beats[1]).kind, "still", "the sting holds still");
eq(cameraOf(story.beats[0]).kind, "push", "a beat pushes in by default");
eq(cameraOf(story.beats[3]).kind, "pan", "the lens beat settles with a pan");

// enter and exit effects
const pop = enterOf({ ...items[2], enter: { kind: "pop", delay: 0.5 } } as any, 2);
eq(enterFx(pop, 0.2).scale, 0, "a pop has not begun before its delay");
near(enterFx(pop, 3).scale, 1, 0.01, "a pop settles at full size");
yes(Math.max(...Array.from({ length: 40 }, (_, i) => enterFx(pop, 0.5 + i / 30).scale)) > 1.02, "a pop overshoots a little");
const slide = enterOf({ ...items[2], enter: { kind: "slide", dir: "up", delay: 0 } } as any, 0);
yes(enterFx(slide, 0.05).ty > 0 && enterFx(slide, 0.05).ty < 170, "sliding up starts below");
near(enterFx(slide, 2).ty, 0, 1e-6, "and arrives");
const fade = enterOf({ ...items[2], enter: { kind: "fade-up", delay: 0 } } as any, 0);
const opacities = Array.from({ length: 30 }, (_, i) => enterFx(fade, i / 30).opacity);
yes(opacities.every((o, i) => i === 0 || o >= opacities[i - 1]), "a fade-up only gets more visible");
eq(exitFx({ kind: "pop", at: 2 } as any, 1).scale, 1, "before its exit an item is whole");
near(exitFx({ kind: "pop", at: 2, dur: 0.4 } as any, 3).scale, 0, 1e-9, "after its exit it is gone");

// emphasis: a pulse returns to rest, a danger shake dies away
near(emphasisFx([{ at: 1, kind: "highlight" }], 1.35).scale, 1.14, 1e-9, "a pulse peaks halfway");
eq(emphasisFx([{ at: 1, kind: "highlight" }], 2).scale, 1, "and is over");
yes(Math.abs(emphasisFx([{ at: 1, kind: "shake", danger: true }], 1.05).tx) > 1, "a shake moves");
near(emphasisFx([{ at: 1, kind: "shake", danger: true }], 3).tx, 0, 1e-9, "and dies away");

// the mascot looks, the chibi changes pose, faces change
eq(lookAt([{ at: 2, kind: "look", x: 5, y: 6 }], 1), null, "no look before its time");
near(lookAt([{ at: 2, kind: "look", x: 5, y: 6 }], 5)!.mix, 1, 0.01, "the look completes");
eq(poseAt("idle", [{ at: 1, kind: "pose", pose: "point" }], 0.5), { from: "idle", to: "idle", mix: 1 }, "no pose change before its time");
const mid = poseAt("idle", [{ at: 1, kind: "pose", pose: "point" }], 1.2);
eq([mid.from, mid.to], ["idle", "point"], "springing from one pose to the next");
yes(mid.mix > 0 && mid.mix < 1.2, "part way");
eq(exprAt("curious", [{ at: 2, kind: "expr", expr: "surprised" }], 2.1).expr, "surprised", "the face changes at its time");
eq(exprAt("curious", [{ at: 2, kind: "expr", expr: "surprised" }], 1).expr, "curious", "and not before");

// blink and camera
eq(blink(1, 3.4, 0), 1, "eyes are open between blinks");
yes(blink(3.4 + 0.07, 3.4, 0) < 0.25, "and nearly shut in the middle of one");
near(cameraAt({ kind: "push", dx: 0, dy: 0, zoom: 1, dur: 1 }, 0, 5).scale, 1, 1e-9, "a push starts at 1.00");
near(cameraAt({ kind: "push", dx: 0, dy: 0, zoom: 1, dur: 1 }, 5, 5).scale, 1.08, 1e-9, "and ends at 1.08");
const pan = { kind: "pan" as const, dx: -80, dy: 250, zoom: 1.08, dur: 1.5 };
eq(cameraAt(pan, 0, 7), { scale: 1.08, tx: -80, ty: 250 }, "a pan starts offset and zoomed");
eq(cameraAt(pan, 2, 7), { scale: 1, tx: 0, ty: 0 }, "and settles at rest");
near(easeInOut(0.5), 0.5, 1e-9, "ease in-out is symmetrical");
near(springAt(5), 1, 0.001, "a spring settles");

// keywords
eq(isKeyword("panas?", ["panas"]), true, "a keyword matches without punctuation or case");
eq(isKeyword("Lebar", ["lebar"]), true, "or case");
eq(isKeyword("rapat", ["lebar"]), false, "other words stay");

// --- P28-A3: what the colokan story does about the seven fixes ---
const beatOf = (id: string) => story.beats.find((b) => b.id === id)!;
const mascots = (id: string) => beatOf(id).scene.items.filter((i) => i.type === "mascot") as any[];
// 3 the lens flash: the cutaway revealed through the lens is there from its first frame (no enter fade), inside the lab
eq(beatOf("rapat").transition?.kind, "lens", "through the lens into the tight cutaway");
eq(beatOf("rapat").scene.bg, "lab", "inside the lens is the lab");
const cut = beatOf("rapat").scene.items.find((i) => i.type === "socket" && i.view === "cutaway")!;
eq(enterOf(cut, 1).kind, "none", "the revealed cutaway does not fade in");
// 4 the corner mascot stays: one place, no entrance after its first appearance
const corner = ["lensa", "rapat", "kendur", "akibat"].map((id) => mascots(id).find((m) => m.persist));
yes(corner.every(Boolean), "a persistent mascot in each of the four beats");
eq(new Set(corner.map((m) => `${m.x},${m.y},${m.w}`)).size, 1, "in the same place every time");
eq(enterOf(corner[0], 3).kind, "pop", "it pops on its first appearance");
eq(corner.slice(1).map((m) => enterOf(m, 4).kind), ["none", "none", "none"], "and never again");
// 5 the safe area (the Shorts interface covers the bottom 15 % and the right 12 %): faces, text and badges stay inside
const unsafe: string[] = [];
for (const b of story.beats) for (const it of b.scene.items) {
  if (it.type === "mascot" && (it.x + it.w / 2 > 950 || it.y + it.w * 0.52 > 1632)) unsafe.push(`${b.id} mascot`);
  if ((it.type === "label" || it.type === "pill" || it.type === "badge") && (it.x > 950 || it.y > 1632)) unsafe.push(`${b.id} ${it.type}`);
  if (it.type === "chibi" && (it.x > 950 || it.y > 1632)) unsafe.push(`${b.id} chibi`);
}
eq(unsafe, [], "nothing key in the bottom 15 % or the right 12 %");
// 1 the cable never runs on through the lens: in the lens beat it ends inside the lens circle
const lensBeat = beatOf("lensa").scene.items;
const lens = lensBeat.find((i) => i.type === "lens") as any, plugged = lensBeat.find((i) => i.type === "socket") as any;
const end = plugged.plug.route[plugged.plug.route.length - 1];
yes(Math.hypot(end[0] - lens.x, end[1] - lens.y) < lens.r, "the cable of the lens beat ends inside the lens, hidden by it");
// the backgrounds of the beats: brand outside, lab inside, black for the sting and the outro
eq(story.beats.map((b) => b.scene.bg), ["brand", "black", "brand", "lab", "lab", "brand", "brand", "black"], "brand for the story, lab inside the lens");

console.log(`timeline: ${n} checks ok`);
