# Pilot 1 "Kenapa colokan bisa panas?": plan for klipian eksekusi

Written by the klipian motion session (planning only, no code changed). Self-contained: read `HANDOVER.md` in this folder and `remotion/DESIGN.md` (sections 0, 11, 12 and "2.5D isometrik") first.
Starting point: local commits 955c42a, d5559eb, 1b5826b (not pushed). `npm run check && npm test` pass (colokan 64 checks).
Reference render (CPU was free, 60 s): `out/colokan/colokan-25d.mp4` (45 s, 1080x1920, 30 fps, 61 sfx, `bed-tech`, no voice yet). Contact sheet: `out/colokan/mp4check/sheet.png`. Per-second motion (mean frame diff at 6 fps): `out/colokan/mp4check/motion.txt`.

## Score against the 8 P28 quality bars (honest, from stills + log + numbers; not yet watched on a phone)

| # | Bar | Verdict | Evidence / gap |
|---|-----|---------|----------------|
| 1 | Objects recognised without labels | Mostly | Socket and plug read instantly. The cutaway (brass clamp around the pin) only reads when zoomed; at about 9.6–10.5 s it is small. |
| 2 | Nothing overlaps, all in safe area | Mostly | Layout test (64 checks, every 3 frames) passes. Open: the hook cable runs behind the caption box; in the tips the plug hides the new plate. |
| 3 | Meaningful motion every second | Partly | Near-still stretches (motion under 1.5): about 22.5–24 s, 33 s, 35 s and the outro 43–45 s. No motion blur on the two fast moves (9.05–10 s, 28.2–29.1 s). |
| 4 | Text readable in 1 s on a phone | Partly | Headlines and karaoke caption are fine. The source chips ("SUMBER hunker.com · ...") are tiny mono; the source-card quotes are 3–4 lines for about 3 s. |
| 5 | Sound in sync, not busy | Unverified | 61 events in 45 s (about 1.4 per second), 1 dropped by cooldown (swish-soft at 32.03 s). Peak -6.4 dB, mean -23.3 dB. Timing is the estimate; there is no narration yet. Nobody has listened to it. |
| 6 | Every claim sourced and ticked | **Not met** | All 5 claims have 1–2 sources each, but are still "pending" in the fact gate. Only ian can tick them. |
| 7 | Hook holds the first 3 s | Partly | 0–3 s: the plug heats up with the caption "Colokan kok panas?", then the mascot "Intip yuk!" at 3.0 s. Clear, but quiet (second 1 has motion 1.7). Ian's call. |
| 8 | Fine to rewatch on a phone | Unverified | Needs ian to watch it on his phone. |

Not publishable yet: bar 6 (ian), bars 5 and 8 (need a listen and a phone watch).

## Work for eksekusi (in this order; each item is small and independent)

Files are under `remotion/`. Change only these files; do not touch Python, UI, server, `workspace/`, secrets or the story texts (all on-screen text must keep coming from `story.json`).

1. **Tips: make the new plate read** (`videos/kenapa-colokan-panas/plan.ts`, `src/components/Iso.tsx` if needed). At tip 2 ("menggantinya", about 40–41 s) pull the plug out (`IsoPlug.gap`) or orbit the camera so the yellow ring sits on a clearly visible plate. Done when a frame at 40.5 s shows the whole plate with the ring and nothing covers it.
2. **Hook cable** (`plan.ts` / `index.tsx`). Keep the cable out from behind the caption box in 0–3 s (route it to the side or lower, or shift the camera slightly). Done when frames 0, 30, 60, 90 show no cable under the caption.
3. **Source-card quotes** (`plan.ts`). Cap each quote at 2 lines (about 14 words) at the current card width. The quote must come from the claim/source data in `story.json`, never typed in the code; if no short quote exists, show the source name and date only. Add a test line in `tests/colokan.test.ts` for the max line count.
4. **Source chips** (`src/components/Overlays.tsx` `SourceChip`, `plan.ts`). Raise the chip font so it reads on a phone (target: at least the size of the label pills; check with a 540 px wide downscale of the 1080 frame). Keep the layout test green.
5. **First lab frames** (`plan.ts` cameras). After the lens (about 9.6–10.5 s) start with the camera already close on the clamp (larger scale), so the cutaway fills about 60–70% of the width from the first frame. Done when frame 295–315 reads without a label.
6. **Motion blur on the two fast moves** (`index.tsx`; see skill `remotion-markup/motion-blur.md`). Use it only for 9.05–10.0 s and 28.2–29.1 s so render time stays low. Report the render time before and after.
7. **Fill the near-still stretches** (`plan.ts`, `Iso.tsx` particles). At about 22.5–24 s, 33–36 s add small motion that means something (current dashes speeding up as the contact heats; heat shimmer; slow parallax drift). No new objects.
8. **Sound pass** (`sfx.ts`). Thin the ticks where two events land within 0.3 s (for example 14.10/14.83 s, 25.17–25.77 s). Keep one event per real movement. Do not change the music. Record the final event count.
9. **Verify before reporting** (all inside `remotion/`, nothing real from ian's workspace):
   - `npm run check && npm test` pass;
   - stills at every beat plus frames around 9–10 s, 28–29 s, 32 s and 40 s (`node scripts/frames.mjs video-kenapa-colokan-panas out/colokan/fix <seconds...>`);
   - make sure no ffmpeg/python load is running, then `node render.mjs out/colokan-video.json`; check `out/colokan/colokan-25d.sfx.txt`;
   - rebuild the contact sheet and the motion numbers (command in `out/colokan/mp4check/`, 6 fps frame difference) and confirm no second below 1.0 except the last 1.5 s.
10. **Commit** only your own paths locally, with a clear message. Do not push; ian approves pushes.

## For ian (not for eksekusi)
- Tick or reject the 5 claims (bar 6). If a claim is rejected, the text updates by itself; recheck the layout test.
- Import the narration in `/remotion`, then render from `story.voiced.json` with `"voice"` (see HANDOVER, Next 2). `plan.ts` follows `beat.words`; recheck the frames around each camera move.
- Listen to the final sound and watch it on a phone (bars 5 and 8), then decide on publish.
