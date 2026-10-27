# Pilot 1 "Kenapa colokan bisa panas?": plan round 3 for klipian eksekusi (approved by ian)

Written by klipian motion (planning only). Rounds 1 and 2 are done (d1dcade, 7fc542a). Ian's two revisions after watching the render:

1. The mascot is too prominent in the "Intip yuk!" moment (it takes the whole screen, then the video continues with the plug). It should be small.
2. The ending shows the mascot again with "klipian intip" and "Intip yuk fakta lainnya!". Not needed. Make the ending a loop: the last seconds flow back into the first scene (the plug and socket), so the video loops seamlessly.

This replaces the earlier rule "big mascot in the sting and in the outro" (DESIGN.md section 3 and the brief text). The mascot stays rare: the sting (small) and at most 2 short reactions. The outro has no mascot.

## Read first
`HANDOVER.md`, `remotion/DESIGN.md` (sections 3 mascot, 11, 12, "2.5D isometrik"), then `videos/kenapa-colokan-panas/plan.ts` (cameras `outKeys`, `m.sting`, `m.stingEnd`, `m.outro`, `state(t)`) and `index.tsx` (the sting block, the outro block, `outroFade`).

## A. The sting: a small pop, not a full-screen takeover (`index.tsx`, `plan.ts`)
Today: a veil over the whole picture, `Mascot w=600` at the centre and a pill with font 96 (about 3.0–3.9 s).
Target:
- no veil: the plug, the heat and the camera push keep moving behind it (the world never freezes or hides);
- `Mascot` about w 200–240 (same size as the existing "surprised" reaction, w 230), expression `curious`, with the same pop-in and pop-out;
- the pill "Intip yuk!" about font 56 (text still from the story: `stingPill`), next to or under the small mascot;
- place it in the zone the caption would use (the sting beat has no caption), centred horizontally inside the safe area, clear of the plug, the cable and the top text; let the layout checker confirm it. Not parked in a corner;
- duration unchanged (the narration "Intip yuk!" still lasts its second); sfx stay on the same frames (`boing`, `jingle-sting`, `pop`, `swish`), but lower `jingle-sting` a bit so it does not feel bigger than the picture.

## B. The ending: no mascot, no text; a seamless loop back to the first frame
Remove from the outro: the `Mascot`, the label ("klipian intip"), the pill ("Intip yuk fakta lainnya!"), the end zoom-out/fade (`outroFade`, key `m.outro + 1.2` with y - 700) and the outro `sfx` (`jingle-outro`, `boing`, the `tick-soft`, the last `pop`).
Replace with a loop-back that uses the whole outro beat (no dead hold at the end):
1. At the start of the outro, the pulled-out plug goes back in (the plate ring fades out), the camera eases back to the opening shot: key `{ x: 520, y: 980, zoom: 0.8 }` (the key at t = 0).
2. By the last frame, **the state equals the state at t = 0**: the same camera, the same plug (`gap` 0, no heat yet, no scorch), the same background phase, no caption, no label, no top text, nothing in the lab.
3. Anything that moves by itself (glow breathing from round 2, heat rise, motes, the brand rings) must be periodic in the video length (period an exact divisor of the total, or a function of `t / total`) or ease to its t = 0 value at the end, so frame N-1 flows into frame 0 without a jump.
4. Audio: remove any fade-out of the music at the very end so the loop does not dip to silence; the first sfx at 0.0 s (`whoosh`) can stay. Check the mix at the seam (the last 0.3 s and the first 0.3 s).
5. Keep one soft sfx for the plug going back in (`thump`) and nothing else in the outro.

The story's outro beat (hook first, outro last) stays in `story.json`; the video simply draws it as the loop-back. The spoken line "Intip yuk fakta lainnya!" is in the story's narration (ian's file). That is ian's decision: see "For ian" below. Do not edit anything under `workspace/`.

## C. Tests (`tests/colokan.test.ts`)
- Sting: no full-screen veil; the mascot width is at most about 25% of the frame width; its box does not touch the plug core, the cable or the top text (use the layout checker at several frames in the sting).
- Outro: no `Mascot`, no label and no pill in the outro frames; `specsAt` for t in the outro has no text.
- Loop: `state(0)` and `state(total - 1/FPS)` have the same camera and the same object state (gap, heat, loose, scorch, ring); every periodic ambient value matches at both ends within a small tolerance.
- sfx: no `jingle-outro` and no outro `boing`; nothing is still on a frame that no longer exists.

## D. Docs (`remotion/DESIGN.md`)
Update section 3 and the notes that say "big mascot in the sting and the outro": the sting is a small pop (about 200–240 wide, no veil); the outro may be a **loop-back** with no mascot and no text; the mascot is limited to the sting and at most 2 reactions. Add a short "How to make a seamless loop ending" paragraph (state at the end equals state at 0; periodic ambient motion; no music fade-out).

## E. Verify before reporting
- `npm run check && npm test`.
- Frames in one browser session (`node scripts/frames.mjs video-kenapa-colokan-panas out/colokan/r3 <seconds...>`): about 2.6, 3.0, 3.4, 3.9 s (sting); 40.5, 41.5, 42.5, 43.5, 44.5 and the last frame (loop-back).
- Loop proof: render the MP4, then compare the first frame and the last frame (`ffmpeg ... psnr` or `ssim` on the two frames) and report the number; also view them side by side. Also play the last 2 s followed by the first 2 s (concatenate them with ffmpeg) and look for a jump.
- No ffmpeg/python load before the render (`node render.mjs out/colokan-video.json`); report the render time.
- Commit only your own paths locally. Do NOT push; ian approves pushes.

## For ian (decisions, not for eksekusi)
1. **The spoken closing line: DECIDED (ian): remove it.** The outro beat's narration "Intip yuk fakta lainnya!" is removed, so the loop-back is silent (no voice). Ian edits the outro beat in the Storyboard at `/remotion` himself (the narration and the on-screen label/pill texts); eksekusi must not touch `workspace/`. Until he has done it, the video code must not depend on those outro texts (it draws no outro text at all), and the narration/timing code must cope with an outro beat that has an empty or missing narration (no voice words, no caption). Add a test with an outro beat whose narration is empty.
2. **How long the loop-back lasts** follows the outro beat in the story (now about 3.8 s). If that feels slow, shorten the outro beat to about 1.5–2 s in the story; the extra seconds can go to the tips.
3. **The brief for new stories** (Python text in `klipian/motion.py`, about lines 761, 775, 777, 815) still says "the outro has the mascot / logo and klipian intip" and the "Intip yuk!" beat uses a big mascot. This is a separate task for klipian eksekusi after this round: it changes the AI brief and its validator text, so it needs ian's OK first. Not part of round 3.
