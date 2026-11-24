---
name: create
description: Runs for a message starting with `-create`. Make one klipian intip video from a topic, in a cloud session or in ian's own checkout, e.g. `-create gurita punya tiga jantung` or `-create 2.5d 45 noloop "gurita punya tiga jantung"`. Builds the brief itself, follows its steps, and pushes only the video's files to main.
---

# -create [options] <topic>

The message is `-create [2.5d|iso|2d|teks|ricks] [30|40|45|60] [noloop] [nointip|intip] [langsung] [dongeng|kisah] [suara=voicestudio,googleai,elevenlabs] [musik=<id>] [catatan="..."] [wav="<path>"] "<topic>"`. Every token before the topic is optional and may come in any order; the topic is the last quoted text, or, when nothing is quoted, all the text after the options (`-create gurita punya tiga jantung`, `-create 2d gurita punya tiga jantung`). One video per run. Nothing is asked of the person.

| Token | Meaning | Flag for the brief CLI |
|---|---|---|
| `2.5d` or `iso` / `2d` / `teks` / `ricks` | force the look (missing: you choose from the topic, B28; `ricks` is never chosen by you, B46) | `--look iso` / `--look 2d` / `--look text` / `--look ricks` |
| `30` `40` `45` `60` | the duration (missing: 40) | `--duration 45` |
| `noloop` | no loop-back ending (missing: loop) | `--no-loop` |
| `nointip` | no "Intip yuk!" sting (missing: the voice-only sting; for `ricks` missing means no sting, B46 l) | `--no-sting` |
| `intip` | look `ricks` only: add the voice-only "Intip yuk!" sting | `--sting` |
| `langsung` | the hook goes straight into the topic: a statement naming who did what, no "Kenapa ..." opener (missing: any hook B41 allows; `ricks` always goes straight in, B46 l) | `--direct` |
| `dongeng` | a made-up everyday story carried by one true fact (B47; missing: the fact explained) | `--dongeng` |
| `kisah` | a real, sourced story with a twist and one true cause (B49; missing: the fact explained) | `--kisah` |
| `suara=a,b` | the voice apps (missing: all three) | `--voice a,b` |
| `musik=<id>` | a music bed or `auto` (missing: the default) | `--music <id>` |
| `catatan="..."` | notes for the AI (missing: none) | `--notes "..."` |
| `wav="<path>"` | look `ricks` only: the voice ian made from the stage 1 text; runs stage 2 (section 2b) | none |

Work quietly: no progress narration between steps; only the final answer.

## 0. Check the checkout

Run `git log -1 --oneline origin/main`; `klipian/motion_brief_cli.py` must exist too. If any of that fails, stop and answer only: "checkout lama, buka sesi cloud baru".

Where you run decides step 1: **cloud** when there is no `workspace/` folder at the repository root; **local** when `workspace/` exists (ian's own folder).

## 1. Branch: main, detached

The video is saved on `main`, so the rules, the design and the checker are the latest ones by construction.

**Cloud** (no `workspace/`): check out `origin/main` detached (no branch is created, so there is nothing to delete afterwards):

```bash
git fetch origin
git checkout -q --detach origin/main
```

**Local** (`workspace/` exists): never check out, switch branches, stash or reset in ian's checkout, and never write to `workspace/`. Work in a throwaway worktree of `origin/main` instead, and run every later command from inside it:

```bash
git fetch origin
WT="$(mktemp -d)/klipian-create"            # a temp folder outside the checkout (the slug is not known yet)
git worktree add --detach "$WT" origin/main
cd "$WT/remotion" && npm ci                       # node_modules is not shared with ian's checkout
```

Remove the worktree ONLY after a successful push (step 4): `git worktree remove --force "$WT"`, from ian's checkout. On any failure (a step, or the push refused three times) keep it: its detached HEAD holds the only reference to the video commit and the half-done work. Then answer with its path, in line 5 of the answer: "worktree tersimpan di <path>; hapus dengan git worktree remove --force <path> setelah dicek".

Never create a branch such as `work/create`.

## 2. The brief

From the repository root (no `workspace/` is needed; the profile settings fall back to the defaults and nothing is written):

```bash
python3 -m klipian.motion_brief_cli "<topic>"   # `python` if python3 is missing
```

Read the options off the message as in the table above and pass each as its flag, before the topic. The look (B28) is chosen by you from the topic, as the brief says (iso, else 2d, else text), unless the message forces it with `2.5d`/`iso`, `2d` or `teks`, which become `--look iso`, `--look 2d` or `--look text`:

```bash
python3 -m klipian.motion_brief_cli --look text --duration 45 --no-loop "<topic>"
```

With no option it prints the Khusus brief with the defaults: custom video, 40 s, loop yes, the voice-only "Intip yuk!" sting yes (the narration says it, nothing is drawn), the voice apps elevenlabs + googleai + voicestudio, the default music. A wrong value (an unknown voice app or music) is refused with a message: stop and answer only that message. The slug in it is checked against the folders of `main`, so it is free.

Body and money topics are fine as explanations (why we hiccup, why banknotes do not tear). If the topic asks for medical advice, a diagnosis, a cure, a dose or a treatment, for investment or financial advice (e.g. "obat cegukan paling ampuh", "saham yang pasti naik"), or for anything dangerous: stop, write nothing, say why.

## 2b. Look ricks: the voice comes first (B46)

A ricks video is built to its voice: every shot, face, pill and caption word lands on a word, and a TTS voice's pace cannot be guessed. So `-create ricks` runs in two stages; the topic (and so the slug) is the same in both.

**Stage 1, no `wav=`: the story and the text for the voice.** Steps 0 to 2 as usual (`--look ricks`), then only brief steps 1 and 2: research, write `remotion/stories/<slug>.json` (narration per beat, energetic and punchy like a storyteller telling a friend a crazy fact: short sentences, numbers written as words, the hook goes straight into the story at word one, a statement naming who did what, never a question such as "Kenapa ...", "Tahukah kamu ..." or "Pernah gak ..." (B46 l: not "Kenapa petugas SPBU selalu bilang mulai dari nol?" but "Petugas SPBU ini nunjuk angka nol, dan itu bukan basa-basi."), no "Intip yuk!" sting unless `intip` was given, the last sentence leading back into the hook, and two to four short quoted lines (at most 8 words) that a named person says inside the narration, e.g. Mang Udin bilang, "Mi instan lagi, Mas?": only those lines are lip-synced in stage 2, everything else is the narrator, B46 n), validate it. Commit and push only that story (step 4, message `Story: <title> (ricks, waiting for the voice)`). Do not build the folder. Answer, in place of step 5, with exactly:
1. `slug` and "gaya: ricks (B46), tahap 1: tinggal voice"
2. `main` + hash
3. a fenced block "Voice: Puck (atau Fenrir)"
4. a fenced block with the style instructions: `Narrate in Indonesian like an energetic YouTube Shorts storyteller: fast, punchy, playful and a bit dramatic, as if telling a friend a crazy fact. Smile while talking. Hit the first line hard. Short beat pauses at "...". Rise in excitement on the numbers, and slow down slightly with suspense on the last sentence.`
5. a fenced block with the text: every beat's narration in order, one paragraph each (the outro has none)
6. "Buat di Google AI Studio (Generate speech, single-speaker), lalu kirim: -create ricks wav=\"<path>\" \"<topic>\""

**Stage 2, with `wav=`: the picture to the voice.** Only in ian's own checkout (the WAV is on his PC); in the cloud answer only "wav hanya bisa di PC ian" and stop. Steps 0 and 1 (the worktree), then read `remotion/stories/<slug>.json` from `origin/main` (missing: answer "jalankan tahap 1 dulu" and stop). Follow the brief from step 3 (`new-video`) on, with these steps added before the build:
1. The word timings, with the `.venv` of ian's checkout (a worktree has none): `"<ian checkout>/.venv/Scripts/python.exe" -I remotion/scripts/ricksWords.py "<wav>" remotion/videos/<slug>/words.json <a text file with the narration>`. faster-whisper missing: say so and stop.
2. Retime the story to the voice: each beat runs from its first word to the next beat's first word (the hook from 0), the outro is 0.7 s after the last word, `duration` is their sum; validate again.
3. Build `index.tsx` on the ricks kit (`src/ricks/kit.tsx`, example `src/DioramaDemo.tsx`): shots, faces, pills and caption words keyed to `words.json`; every person unique: their own `Outfit` (clothes, hair colour, face; heads always white; B46 i, see `src/RicksCastSheet.tsx`); every shot busy in three depths with something moving besides the hero (B46 j); no prop, set, outfit or peak effect reused (B46 k); an active cast (B46 m: every sentence gives someone an acted beat, walking, hopping, leaning, arm poses, props; somebody walks across the set at least once; example `videos/anak-begadang-yang-jajan-tiap/index.tsx`) whose mouths move only on the quoted lines (B46 n: `TALK` windows from `words.json`, never the whole narration); a visual hyperbole on the turning sentence when the story has one (`src/ricks/fx.tsx`, B46 h); `sfx.ts` exports `sfx(story)` (a whoosh on every cut, a sound on every state change and pill, at the same times) and `music`.
4. After the stills and the checklist (3b), render: `node scripts/ricksRender.mjs <slug> "<wav>"` (from `remotion/`), which mixes and sets about -14 LUFS; paste its line. Copy `out/<slug>/<slug>.mp4` next to the WAV (the worktree is removed after the push).
The WAV and `out/` are never committed; `words.json` is (it is the video's timing).

## 3. Build

Follow the printed brief, steps 1 to 6, as written: it is the instruction, and its hard rules already say how to choose the set, draw the real form, write `sfx.ts` by hand and write the story's `thumb`. Run `npm ci` in `remotion` first when `remotion/node_modules` is missing. If Chrome or the render cannot run, say so and continue without the stills. Its "no push" line is overridden by step 4 below, and its report by step 5 (the brief has no narration or page steps: -create needs neither); everything else stands (never write to `workspace/`, never claim a check you did not run).

## 3b. Before you push: the checklist

Tick each with evidence (a command output or a still you opened); fix, then push. A topic that needs a full body or a sitting or standing person is not built until the Chibi rig exists (B43): answer with that reason and stop, except in look `ricks`, whose stick cast is the person (B46); in look `ricks`, item 3 below reads B46 instead of B44's plain background and 70 to 80 % hero.

1. **B41 (the hook wins the first second):** the hook claim is big text at frame 0, the first word at 0 s, the main answer held to about 70 % of the duration, the title does not start with "Intip", and the hook text fades back in over the last 0.5 s of the outro so the loop holds (`npm run style-report`: loop PSNR about 35 dB or more).
2. **B42 and B48 (no reuse in the last 10 videos, now for EVERY asset: also effects, sfx choice, music track, colour set, icon, texture, font treatment):** before drawing run `node scripts/styleCheck.mjs <slug> --b48` from `remotion` and fix every FLAG (the set kind, the effects; the music track and the sounds shared above 90 % only bind once the catalog has 30 beds and 100 sound names, until then they print as INFO); then you listed the 10 most recent videos by the commit date that first added each `index.tsx`, grepped their `index.tsx` and `set.json`, and drew every backdrop, set, hook hero, supporting object and prop yourself; the answer lists what you avoided and which video each came from (the Chibi cast, B43, is the one reuse on purpose).
3. **B44 (the feed look):** the hook text is 2 to 5 words at about 120 to 150 px (a black box per line, key words yellow, in the top third); the hook background is plain (one saturated palette colour or clean off-white) and the set comes in after it; the hero is 70 to 80 % of the width at frame 0 (`style-report` line `hero0`); objects have no faces (only the mascot and the Chibi do); you rendered frame 0 and a 200 px wide copy of it and looked at both.
4. **B36 and B39 (body parts and real proportions):** a body part is drawn in its most recognisable pose, every object is the real thing it names (flat silhouette test), proportions are real, and nothing is drawn inside something solid.

## 4. Commit and push to main (the same rules in the cloud and in the local worktree)

1. `git add` only the video's own files: `remotion/stories/<slug>.json`, `remotion/videos/<slug>/` (it includes `set.json`), `remotion/tests/<slug>.test.ts`. Never `remotion/out/`, never `workspace/`, and never a change to a rule, design or code file that is not the video's own.
2. One commit, message `Video: <title>`.
3. Push, up to 3 tries, because other sessions push to `main` in parallel (their files never overlap):
   ```bash
   git fetch origin main && git rebase origin/main && git push origin HEAD:main
   ```
   Never force-push, never open a PR. If the push is refused three times, say so and leave the commit as it is.

## 5. Answer

Answer in Indonesian, at most 6 short lines, nothing else:
1. `slug` and "gaya: iso/2d/teks, karena ..."
2. `main` + hash
3. the style-check summary line
4. each FAIL/FLAG line (or "tanpa FAIL/FLAG"), and the pieces as "baru: ... / pakai ulang: ..."
5. at most 2 one-line points ian must decide
6. cloud: "sudah di main, tinggal git pull di PC ian"; local: "sudah di main; git pull, lalu di /remotion langkah 3 pilih folder remotion/videos/<slug>"; ricks stage 2: "video jadi: <path of the mp4 next to the WAV>"

Do NOT print the narration texts (they are in the story; /remotion step "Voice script" shows them), no /remotion steps, no file lists, no source lists, no recap of the video.
