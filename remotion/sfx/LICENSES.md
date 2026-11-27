# Sound effects: sources and licences

Every sound in `sfx/wav/` is **synthesised by `sfx/synth.mjs`** (sines, filtered noise, envelopes). Nothing is sampled, downloaded or
taken from a pack, so there is no third-party licence, no attribution to carry and no Content-ID risk. The files are deterministic:
`npm run sfx` regenerates them byte for byte. They are released as **CC0 / public domain** together with the rest of this repository's
original work.

| File | What it is | Source / licence |
| --- | --- | --- |
| `pop.wav` | a short bubble pop (falling sine + click) | synth.mjs, CC0 |
| `pop-soft.wav` | the same, lower and softer | synth.mjs, CC0 |
| `boing.wav` | a springy, wobbling falling tone (mascot appears) | synth.mjs, CC0 |
| `whoosh.wav` | band-passed noise sweeping up and down (wipe) | synth.mjs, CC0 |
| `swish.wav` | a short rising noise sweep (slide) | synth.mjs, CC0 |
| `swish-soft.wav` | a softer, lower swish (slide-in objects) | synth.mjs, CC0 |
| `zoom-whoosh.wav` | a rising noise sweep with a rising tone (zoom, through the lens) | synth.mjs, CC0 |
| `glass-ting.wav` | three inharmonic partials, a glass tap (the lens opens) | synth.mjs, CC0 |
| `tick.wav` | a short tick (highlight, arrow, label) | synth.mjs, CC0 |
| `tick-soft.wav` | a quieter tick (a label's words) | synth.mjs, CC0 |
| `zip.wav` | a quick rising buzz (a cable is drawn) | synth.mjs, CC0 |
| `thump.wav` | a low thump with a pitch drop (a banner lands) | synth.mjs, CC0 |
| `rattle.wav` | eight quick decaying knocks (danger shake) | synth.mjs, CC0 |
| `sizzle.wav` | crackle and hiss that grow for 2.5 s (heat rising) | synth.mjs, CC0 |
| `hum.wav` | a 100 Hz electric hum, exactly periodic so it loops (current) | synth.mjs, CC0 |
| `puff.wav` | a soft low-passed noise puff (smoke) | synth.mjs, CC0 |
| `blip-alert.wav` | two short beeps (a "!" badge) | synth.mjs, CC0 |
| `huh.wav` | a rising "huh?" glide and a tiny pluck, no voice (mascot surprised) | synth.mjs, CC0 |
| `slide-whistle-down.wav` | a falling slide whistle (mascot ouch) | synth.mjs, CC0 |
| `chime.wav` | two bell notes G5 D6 (mascot understands) | synth.mjs, CC0 |
| `chime-bright.wav` | three bell notes C6 E6 G6 (mascot laughs) | synth.mjs, CC0 |
| `squeak.wav` | a tiny rising squeak (available, not used by default) | synth.mjs, CC0 |
| `click-crack.wav` | a plastic click and crack (the shell splits) | synth.mjs, CC0 |
| `jingle-sting.wav` | a four-note plucked motif (the sting) | synth.mjs, CC0 (an original motif) |
| `jingle-outro.wav` | a five-note motif ending in a C major chord (the outro) | synth.mjs, CC0 (an original motif) |
| `rain-patter.wav` | soft rain on a surface: filtered noise bursts (pilot 2, nature) | synth.mjs, CC0 |
| `drip.wav` | a water drip: a falling sine with a fast decay (pilot 2, nature) | synth.mjs, CC0 |
| `bubble-rise.wav` | a bubble rising: a gliding sine under a soft envelope (pilot 2, nature) | synth.mjs, CC0 |
| `plop.wav` | a plop: a quick rising sine (variety set, a pop) | synth.mjs, CC0 |
| `pop-wood.wav` | a woodblock pop: a sine with a short high partial (variety set, a pop) | synth.mjs, CC0 |
| `swish-down.wav` | a short falling noise sweep (variety set, a swish) | synth.mjs, CC0 |
| `whoosh-soft.wav` | a softer, lower whoosh (variety set) | synth.mjs, CC0 |
| `swoop.wav` | a rising tone with a little air (variety set, a swish) | synth.mjs, CC0 |
| `tock.wav` | a lower, woody tick (variety set, a tick) | synth.mjs, CC0 |
| `click-soft.wav` | a tiny soft click (variety set, a tick) | synth.mjs, CC0 |
| `marimba.wav` | two marimba notes C5 G5 (variety set, a result) | synth.mjs, CC0 |
| `bell-soft.wav` | one soft bell A5 with its fifth (variety set, a result) | synth.mjs, CC0 |
| `page-flip.wav` | a page turning: a fluttering noise sweep (variety set) | synth.mjs, CC0 |
| `stamp.wav` | a stamp or a gavel: a low knock with a slap (variety set) | synth.mjs, CC0 |
| `coin.wav` | a coin: two quick high bell notes G6 C7 (variety set) | synth.mjs, CC0 |
| `switch.wav` | a switch: click and clack (variety set) | synth.mjs, CC0 |
| `key-blip.wav` | a soft keyboard blip (variety set) | synth.mjs, CC0 |

**The growth of 2026-11-23 (B48):** 72 more sounds in `sfx/more.mjs` (water, wood, metal, cloth, paper, glass, food, animals, vehicles, household, devices, weather, interface, body, cartoon) and 21 more music beds in `sfx/beds-more.mjs`, all synthesised from sines, noise and filters like the rest (no sample, no download), CC0, open until ian approves them. Each file is the name in `src/catalog.ts` plus `.wav`.

**The growth of 2026-11-28:** 19 more sounds in `sfx/more3.mjs` (brick click, clack and tumble, stick creak, deep rumble, quindar tone, rising pop, tiny step, long ding, purr hum, three log drums, three plips, shaker tick). The recipes are ported from the synthesis code of the lemo-opuscar library (`core/audio/sfx.py` and the films' `audio.py`, MIT licence, Copyright (c) 2026 SecondFirst Pty Ltd, trading as LemoLab); only the recipes are used, none of its sample libraries or recordings. The sounds are generated here from sines and noise like all the others, and are open until ian approves them (B15).

No voice is synthesised or sampled anywhere: the voice-over is a separate task (P28-C).
