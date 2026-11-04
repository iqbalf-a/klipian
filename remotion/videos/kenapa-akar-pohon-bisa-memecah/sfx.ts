/* The sound of "Kenapa akar pohon bisa memecahkan aspal?": written by hand against the scenes, on the frame of each picture (times from plan.ts), about one
   event a second, only names from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  const at = (id: keyof typeof P.B, d: number) => P.B[id].a + d;
  // hook: the wide set, the push, the question
  add(0.05, "whoosh", "the camera opens on the set", 0.7); add(0.3, "thump", "the question lands", 0.6); add(1.5, "swish", "the push to the root", 0.7); add(2.4, "tick", "the root shows", 0.6);
  // sting
  add(m.sting, "boing", "the mascot pops in"); add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7); add(m.sting + 0.3, "pop", "the pill", 0.8);
  // cari: the root looks for water and oxygen
  add(at("cari", 0.1), "swish-soft", "headline", 0.6); add(at("cari", 0.8), "drip", "water in the soil"); add(at("cari", 1.3), "tick", "label: air dan oksigen");
  add(at("cari", 2.0), "bubble-rise", "oxygen bubbles", 0.7); add(at("cari", 3.0), "drip", "another drop", 0.7); add(at("cari", 4.0), "pop-soft", "the tip turns", 0.7);
  add(at("cari", 5.2), "tick-soft", "the root grows on", 0.7); add(at("cari", 6.2), "bubble-rise", "oxygen", 0.6);
  // ujung: the tip slips under the road
  add(at("ujung", 0.1), "swish-soft", "headline", 0.6); add(at("ujung", 0.6), "zip", "the camera follows the tip", 0.7); add(at("ujung", 1.7), "tick", "label: ujung muda");
  add(at("ujung", 2.6), "squeak", "the tip squeezes through", 0.6); add(at("ujung", 3.8), "tick-soft", "the tip creeps", 0.7); add(at("ujung", 5.0), "pop-soft", "a rootlet", 0.6); add(at("ujung", 6.2), "tick-soft", "the tip creeps", 0.6);
  // tebal: the root gets fat, growth rings
  add(at("tebal", 0.1), "swish-soft", "headline", 0.6); add(at("tebal", 0.6), "whoosh", "the camera pulls back to the root", 0.6); add(at("tebal", 1.5), "pop", "the ring card");
  add(at("tebal", 2.3), "tick", "label: kayu baru"); for (const d of [3.2, 4.4, 5.6, 6.8]) add(at("tebal", d), "pop-soft", "a new wood ring", 0.8);
  add(at("tebal", 7.5), "hum", "the root swells", 0.5);
  // dorong: the root presses up, the road lifts and cracks
  add(at("dorong", 0.1), "swish-soft", "headline", 0.6); add(at("dorong", 0.8), "zoom-whoosh", "the camera drops to the road", 0.6); add(at("dorong", 2.0), "tick", "label: jalan terangkat");
  add(at("dorong", 2.8), "rattle", "the road creaks", 0.7); add(at("dorong", 4.0), "thump", "the road lifts", 0.8); add(at("dorong", 5.2), "click-crack", "the crack opens"); add(at("dorong", 6.0), "click-crack", "the crack runs", 0.8); add(at("dorong", 7.0), "puff", "dust", 0.7);
  // hasil: the answer
  add(at("hasil", 0.1), "swish-soft", "headline", 0.6); add(at("hasil", 0.6), "swish", "the camera eases out", 0.6); add(at("hasil", 1.8), "chime", "thick, not through"); add(at("hasil", 3.2), "tick-soft", "source chip", 0.7);
  add(at("hasil", 4.5), "pop-soft", "the arrows", 0.7); add(at("hasil", 5.8), "tick-soft", "the root rests", 0.5);
  // fakta: the post is swallowed
  add(at("fakta", 0.1), "swish-soft", "headline", 0.6); add(at("fakta", 0.7), "zip", "the camera goes to the tree", 0.7); add(at("fakta", 1.6), "pop", "the metal post"); add(at("fakta", 3.0), "squeak", "the trunk closes on the post", 0.7); add(at("fakta", 4.4), "tick", "source chip", 0.7);
  // tips
  add(at("tips", 0.1), "swish", "the camera settles", 0.7); add(at("tips", 0.8), "chime", "tip 1"); add(at("tips", 3.0), "chime-bright", "tip 2"); add(at("tips", 4.2), "tick", "the line under the tip", 0.7);
  add(at("tips", 6.2), "blip-alert", "the raised road marked", 0.6); add(at("tips", 7.5), "tick-soft", "the camera rests", 0.5);
  // outro: no jingle; the set eases back to the first frame
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.5); add(m.outro + 1.2, "tick-soft", "the root shrinks back", 0.5); add(m.outro + 2.4, "tick-soft", "the set rests", 0.4);
  return ev.sort((a, b) => a.t - b.t);
}
