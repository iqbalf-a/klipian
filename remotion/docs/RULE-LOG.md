# RULE-LOG.md: the rule log of DESIGN.md

History of DESIGN.md rules: who asked and when. Not needed to build a video.

### The rule log

Every report adds its rows (B14). The date is the day ian asked; a row without a date was asked before the log existed.

| rule | what it says | asked by | when | revision |
| --- | --- | --- | --- | --- |
| B15 history | approved 2026-10-28 ("the sound effects and all the sounds are perfect"); the beds became an open set in PLAN-VARIETY stage 4; the variety effects and three beds were added 2026-11-13 because every video sounded alike: over 33 videos seven effects (`swish-soft`, `pop-soft`, `swish`, `pop`, `tick-soft`, `tick`, `whoosh`) carried most events and `bed-curious` was the bed of 13 | ian | 2026-10-28, 2026-11-13 | 9bc4753 |
| B22 history | the caption bottom was 1632 (the first Shorts estimate), 1620, 1590 (the web estimate 1600), then 1720 from ian's own calibration (2026-10-31); centred on the frame 2026-11-08 | ian | 2026-10-31, 2026-11-08 | |
| B25 history | measured before the fix of P28-R phase 5: kenapa-colokan-panas passes (longest still 0.25 s, longest gap 3.25 s), cara-kerja-hujan-buatan flags (3.75 s, 11 s), ngantuk-pegang-hp flags (2.75 s, 9.5 s) | ian | P28-R | |
| B29 loop clock | gurita-punya-tiga-jantung looped badly once the voice made it 62.3 s (PSNR first/last frame 26.5 dB against 41.5 dB at 60 s; fixed 38.5 dB). Every length, not one: bohlam-pijar looped badly at its voiced 57.07 s and 59.87 s, the check had only run at 62.3 s; without the tail warp 18 of 32 videos stopped mid-way at 56 and 58 s (13 to 22 dB); the steam period was 2.6 s | ian | 2026-11-09, 2026-11-12 | |
| B30 | no sound cut by the end: the closing jingle of benarkah-kita-hanya-memakai-10 was still sounding when the video ended; 13 of the 22 stock videos with a jingle were cut by 0.6 to 1.6 s | ian | 2026-11-10 | |
| B31 | the sting has five poses, chosen from the slug: every video had the mascot at the centre, a little high, and the pill at the centre, a little low | ian | 2026-11-10 | |
| B32 | the thumbnail card and the story's `thumb` | ian | 2026-11-10 | 98e71a4 |
| B33 | the narration fits its beat: syarat-jadi-anggota-dpr-ternya was planned at 60 s, its Google AI Studio voice made it 75.5 s (+26 %) and the render was refused at the 15 % limit; the planner had assumed 2.3 to 3.2 words a second; 38 of the 44 stories warn, all still valid | ian | 2026-11-15 | e7c43ad |
| motion registry | the plan's first draft gave a camera push 0.8 to 2.5 s; pilot 1's pushes last 5 to 7 s, so the registry takes the measured range | ian (pilot 1) | pilot 1 | |
| B34 (was B29) | the sting "Intip yuk!" is read plainly: no whisper tag before it in the narration export, the Google style is bright and direct | ian | 2026-11-08 | the narration export (motion_voice_export.py) |
| B1, B2 | one stage, the lens move | ian (pilot 1) | pilot 1 | 2ef1683 |
| B3, B11 | the mascot is rare: a small sting, at most two reactions, none in the outro | ian | 2026-10-26 | the brief (motion.py) |
| B6 | detail budget: 80 % of the colokan's shapes and parts | ian | 2026-10-28 | 2ef1683 (nature kit, pilot 2) |
| cables | cables and strokes are never rigid (B13) | ian (pilot 1) | pilot 1 | pilot 1 |
| highlights | a highlight lives on its object and has a meaning (round 4, rules 4 and 5) | ian | round 4 | section 8 |
| recesses | a recess shows all its holes (round 4, rule 8) | ian | round 4 | section 8 |
| depth order, holes, joints | the depth order of the kit, pins in holes are clipped, joints are smooth (round 6) | ian 2026-10-26 | round 6 | section 2.5D |
| in-between states | checked as strips (B13) | ian (pilot 1) | pilot 1 | pilot 1 |
| nature kit | the clearOf rule, periodic crests, no gradient or filter in IsoNature (phases 1b and 1c, pilot 2) | ian | pilot 2 (on origin/main, paused) | nature kit |
| B1 to B14 | the Style Bible v1 | ian | 2026-10-28 | 2ef1683, 110319f |
| B7, B12 | the free hook (not "kenapa"); the loop-back outro with no voice, mascot or text | ian | 2026-10-28 | round 2 |
| B15 | the sound set and its mix are approved and locked | ian | 2026-10-28 | round 2 |
| B16 | the three musts: the "Intip yuk!" sting, the loop, the object style and animation | ian | 2026-10-28 | round 2 |
| the registry | the motion language (src/motionLanguage.ts) and the colour rule | ian | 2026-10-28 | round 2 |
| establishing push | registered: 1.0 to 1.5 s, zoom about 0.45 to about 1.25, `Easing.inOut(Easing.quad)`; the plans' `motion-exception:` comments keep working | ian (2026-11-04) | colokan and hujan both needed one |
| animation recipe | a short section after the rules: what moves, when and how, per beat, with the rule numbers | ian (2026-11-04) | cloud video sessions |
| B21 variety | the bed, the theme and the stage of the last five videos; a repeat of bed and theme is a flag | ian (two renders, 2026-10-28) | stage 4 |
| B22 bottom | the caption as low as the safe area allows (1620); nothing but the Shorts interface below y 1632 | klipian motion plan (PLAN-LAYOUT-BOTTOM, approved by ian 2026-10-28) | stage 1 |
| B23 caption looks | three layouts of the caption (classic, wide, punch); the text style is locked | ian (choice pending, 2026-10-29) | caption options |
| B24 platform safe areas | YouTube obeyed and calibrated on ian's phone (SAFE: top 120, bottom 1730, right 930), TikTok and Instagram checked estimates; caption 1720 | ian (screenshot 2026-10-31) | safe area, round 2 |
| B25 motion density and alive assets | something moves every second, something new every 3 to 4 s; each beat its own picture; assets move a little all the time (the alive set, `IsoLife`); labels and cards never hide behind the caption; `npm run motion-density` measures it | Eksekusi (P28-R phase 5), **ian judges** | P28-R 5 |
| B15 amendment | the music beds are an open set; the sound effects and their mix stay locked | ian (2026-10-28) | stage 4 |
| music beds | four cheerful beds (sunny the default, bounce, glow, curious), measured against bed-calm | ian (2026-10-28) | stage 1 |
| technology beds | two beds, `bed-circuit` (120 BPM, A E F#m D, a saw arpeggio over a light kick and hats) and `bed-neon` (112.5 BPM, F C Dm Bb, a pumping pad and a bright pluck); levels 0.075 and 0.065 keep the voice band within about 2.5 dB of bed-calm's; a topic about a gadget or electricity suggests one ("Otomatis (sesuai topik)"), any other topic the cheerful default | made by Eksekusi (P28-R phase 4), **ian listens: out/music/** | P28-R 4 |
| themes | cream, sky, mint, peach; one per video, in the story (night waits for a light label colour) | ian (2026-10-28) | stage 2 |
| stage shapes | slab, round, strip, steps, island; three placements | ian (2026-10-28) | stage 3 |
| set, not specimen | B27 written and B1 changed: the hero stands in its set, which bleeds past the frame, with three depth layers and 2 to 4 dressing pieces; fill of empty brand background at most 35 % per beat (measured); the lens only where the narration goes inside | ian (2026-11-03) | colokan on a room wall first |
| one scale per set | B27.7: one table of real sizes in cm (`src/roomScale.ts`); big pieces cut by the frame, never shrunk; a test holds each ratio to the hero within 15 % | ian (2026-11-03) | colokan room rescaled first (the cable lies on the desk 25 cm under the socket) |
| establishing shot, readable dressing | B27.8: the hook opens on a wide shot of the whole set (about 1.5 s) and the loop-back returns to it; cut pieces show their recognisable part; no meaning colours in dressing | ian (2026-11-03) | colokan v4 |
| no overlap, no pass-through | B27.9: a world box for every piece, none intersect, stands on its surface, the cable avoids them and ends at the lamp, touching pieces share a layer; tests and strips across camera moves. B27.2 changed: set pieces stay at p = 1, the near layer holds loose things only | ian (2026-11-03) | colokan v5 |
| hero in the centre third, inside SAFE | B27.10: in the establishing shot the hero is in the middle third and inside SAFE (x 60 to 930), dressing to the sides; a plan test reads the hero's box | ian (2026-11-04) | hujan |
| no meaning colour behind the top text | B27.11: no yellow (sun, spot, lamp glow) behind the kicker and headline zone (y about 86 to 330) in any frame | ian (2026-11-04) | colokan v6 review, hujan |
| nature shapes | B27.13: boxes and hard steps for man-made things only; hills, rocks, clouds and shores are soft and organic (the terraced hills read as towers) | ian (2026-11-04) | hujan review |
| per-object sound | B13/B15: sfx.ts by hand, about 1 event a second, locked names only; style check FLAG under 0.7 a second or default-only, FAIL unknown name | ian (2026-11-04) | gurita review |
| looks | B28: `look` iso (default) / 2d / text, chosen by the agent from the topic in that order; each keeps TopText, CaptionLayer, sting, loop-back, per-element sfx, the registry, the sources; the iso-geometry check is for iso only | ian (2026-11-04) | stock videos |
| own set per video | B27.15: each video designs its own set around its hero; never another video's scene or set as a background (the far layer included); a single piece is reused only when it is the same thing and fits, adapted in size, colour or state; the iso kit stays the material | ian (2026-11-04) | sun video review |
| set registry + borrowed-set check | B27.15 made enforceable: `src/sets.ts` lists the set kinds, each video's `set.json` says which kind it stands in (a kind with no set.json naming it is free); `styleCheck` FAILs a video that draws another video's registered set and FLAGs one with no registered set of its own; the new `-create-cloud` command builds on `main`'s rules and pushes only the video's own files to cloud/stok-video (the stock branch had been cut before B27.15 existed, so the rule never reached the sessions; and that branch stays videos only) | ian (2026-11-04) | pelangi and awan videos on cloud/stok-video reused the hujan diorama |
| shape accuracy | B27.16: draw a thing in the form it really has, checked from a source (the rainbow is a ring cut by the horizon); the report names the shapes checked | ian (2026-11-04) | pelangi video |
| open water | B27.14: a sea or lake bleeds past the frame or to the horizon on its open sides, no light border all round (it read as a swimming pool) | ian (2026-11-04) | hujan review |
| smooth lines | B27.12: cables and lines bend one way at a time, no zigzag kinks; a kink test in `cableSim.test.ts` (opposite neighbouring turns above 0.3 rad, none allowed); at 0.2 rad the colokan still wiggles at 8.6 s | ian (2026-11-04) | colokan v6 review |
| wide diorama (hujan buatan) | the rain video's set is a wide diorama: the stage's sea and land go on past the frame (`wide` sea and land, crest rows and tufts over the visible part only), three stepped hills, three crop fields, two rows of trees, bushes and rocks (kit pieces `IsoHills`, `IsoFields`, `IsoFarHills`, tiles on the nature sheet); clouds at three distances (hero, p = 0.6, p = 0.3, paler by `haze`); the hook opens on a wide shot (zoom 0.46, hero cloud in the middle third inside SAFE) and the loop-back returns to it; the brand spot sits in the sky under the top text's band and shrinks away while the camera is pushed far in (`spotK`) | ian (2026-11-04) | stage 2 of the set brief |
| seeding set | the aircraft and the seed grains are dictionary marks (`aircraft`, `seed`: `src/components/IsoSeeding.tsx`, neutral tones only, never the nature tones); the growing drop is a water mark (`IsoDrop`). A story label that only names the object (the placeholder `AWAN`) is not pointer text once the object is drawn. The lens inside a cloud shows the claim as small objects: salt draws vapour, silver iodide is an ice-like crystal, the drop grows heavy and falls | hujan buatan video | 2026-10-28 | this video |

Pilots 1 and 2 are the first checked against these rows: pilot 1 passes every must except the outro's voice (its story still has narration in the outro, ian's edit); pilot 2's nature kit is not in a video yet, and its checks run on its own tests.
