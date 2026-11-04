/* The sound of "Kenapa bintang terlihat berkelip?", written by hand against index.tsx: a sound on every camera move, every label, card and chip, every
   state change of the light (the star going dim, the bending growing, the colours) and the alive things that matter, on the frame of its picture (the moments
   come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-calm", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook: the wide shot of the roof, the star twinkles, the establishing push
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.8, "tick-soft", "the star twinkles", 0.5); add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "glass-ting", "the star flashes bright", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // jauh: up to the star, a point of light
  add(4.1, "swish-soft", "headline", 0.7); add(4.3, "zoom-whoosh", "the camera rises to the star", 0.7); add(T.tagTitik, "pop", "label: titik cahaya"); add(T.rings, "chime", "rings round the point", 0.6);
  add(T.rings + 1.6, "tick-soft", "a ring again", 0.4); add(T.tagJauh, "pop-soft", "label: sangat jauh"); add(8.6, "tick-soft", "a ring again", 0.4); add(9.8, "swish", "the camera drops back", 0.6);
  // udara: the shell of air and its pockets
  add(10.4, "swish-soft", "headline", 0.7); add(T.layers, "whoosh", "the layers of air light up", 0.6); add(T.warm, "pop", "label: hangat"); add(12.7, "puff", "a warm pocket drifts", 0.5);
  add(T.cold, "pop", "label: dingin"); add(14.1, "puff", "a cold pocket drifts", 0.5); add(T.wind, "swish-soft", "the air churns", 0.6); add(T.tagGolak, "pop-soft", "label: udara bergolak"); add(17.4, "swish", "the camera moves in", 0.6);
  // belok: the straight way and the bent way
  add(18.4, "swish-soft", "headline", 0.7); add(T.ghost, "zip", "the straight line draws itself", 0.7); add(T.tagLurus, "pop-soft", "label: lurus"); add(T.bend, "slide-whistle-down", "the light bends more", 0.5);
  add(T.tagBelok, "pop", "label: dibelokkan"); add(22.4, "tick-soft", "the light wobbles", 0.5); add(T.lens, "glass-ting", "the pockets shine like lenses", 0.7); add(T.tagLensa, "pop-soft", "label: lensa goyang"); add(24.8, "tick-soft", "the light wobbles", 0.5); add(25.9, "swish", "the camera pans to the telescope", 0.6);
  // kedip: the meter of the light that arrives
  add(26.4, "swish-soft", "headline", 0.7); add(T.meter, "pop", "the light meter"); add(T.tagTerang, "chime-bright", "label: terang", 0.7); add(28.8, "tick", "the light dips", 0.6);
  add(T.tagRedup, "pop-soft", "label: redup"); add(30.0, "tick", "the light jumps back", 0.6); add(T.colour, "glass-ting", "the star changes colour", 0.6); add(T.tagWarna, "pop", "label: warna berganti"); add(32.4, "tick-soft", "the star flickers", 0.5); add(33.5, "swish", "the camera pans to the planet", 0.6);
  // planet: a small steady disc
  add(34.4, "swish-soft", "headline", 0.7); add(T.planet, "chime", "the planet glows", 0.6); add(T.tagPlanet, "pop", "label: planet tenang"); add(T.rays, "zip", "the planet's many paths", 0.7);
  add(T.tagCakram, "pop-soft", "label: cakram kecil"); add(T.chip, "tick", "the source chip"); add(T.tagBintang, "pop", "label: bintang berkelip"); add(40.6, "swish", "the camera backs off", 0.6);
  // ufuk: the low star and the long way through the air
  add(41.4, "swish-soft", "headline", 0.7); add(T.low, "glass-ting", "the low star rises over the city", 0.6); add(T.pathHigh, "zip", "the short way draws", 0.7); add(43.0, "pop", "label: jalur pendek");
  add(T.pathLow, "zip", "the long way draws", 0.8); add(44.1, "pop", "label: jalur panjang"); add(T.tagTebal, "chime-bright", "label: udara lebih tebal", 0.7); add(46.0, "tick-soft", "the low star flickers", 0.5); add(47.0, "whoosh", "the camera drops for the tips", 0.6);
  // tips: three cards and the chip
  add(47.4, "swish-soft", "headline", 0.7); add(T.card1, "pop", "card 1"); add(49.0, "tick-soft", "the star twinkles", 0.4); add(T.card2, "pop", "card 2"); add(51.5, "tick-soft", "the star twinkles", 0.4);
  add(T.card3, "pop", "card 3"); add(T.chipTips, "tick", "the source chip"); add(55.6, "swish", "the cards leave", 0.6);
  // outro
  add(56.2, "whoosh", "the camera eases back to the wide shot", 0.6); add(57.1, "jingle-outro", "loop back", 0.7); add(58.6, "tick-soft", "the star twinkles", 0.4);
  return ev.sort((a, b) => a.t - b.t);
}
