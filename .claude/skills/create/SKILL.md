---
name: create
description: Runs for a message starting with `-create` (not `-create-cloud`, which has its own skill). Make one klipian intip video from a topic in a cloud session, e.g. `-create gurita punya tiga jantung`. Builds the brief itself, follows its steps, and pushes only the video's files to main.
---

# -create <topic>

The topic is the argument. One video per run. Nothing is asked of the person.

Work quietly: no progress narration between steps; only the final answer.

## 0. Check the checkout

Run `git log -1 --oneline origin/main` and `test -f .claude/skills/create/SKILL.md`; `klipian/motion_brief_cli.py` must exist too. If any of that fails, stop and answer only: "checkout lama, buka sesi cloud baru".

## 1. Branch: main, detached

The video is saved on `main`, so the rules, the design and the checker are the latest ones by construction. Check out `origin/main` detached (no branch is created, so there is nothing to delete afterwards):

```bash
git fetch origin
git checkout -q --detach origin/main
grep -q "B27.16" remotion/DESIGN.md && test -f remotion/src/sets.ts
```

If the last line fails, stop and answer only: "main belum punya aturan set, update main dulu". Never create a branch such as `work/create`.

## 2. The brief

From the repository root (no `workspace/` is needed; the profile settings fall back to the defaults and nothing is written):

```bash
python3 -m klipian.motion_brief_cli "<topic>"   # `python` if python3 is missing
```

The look (B28) is chosen by you from the topic, as the brief says (iso, else 2d, else text). Only when the message is `-create 2d <topic>` or `-create teks <topic>` (the first word after `-create`), force it: drop that word from the topic and add `--look 2d` or `--look text` before the topic:

```bash
python3 -m klipian.motion_brief_cli --look text "<topic>"
```

It prints the Khusus brief with the defaults: custom video, 60 s, loop yes, the "Intip yuk!" sting yes, the voice apps elevenlabs + googleai + voicestudio, the default music. The slug in it is checked against the folders of `main`, so it is free.

Body and money topics are fine as explanations (why we hiccup, why banknotes do not tear). If the topic asks for medical advice, a diagnosis, a cure, a dose or a treatment, for investment or financial advice (e.g. "obat cegukan paling ampuh", "saham yang pasti naik"), or for anything dangerous: stop, write nothing, say why.

## 3. Build

Follow the printed brief, steps 1 to 8, as written. Write `sfx.ts` by hand: a sound on every object entering, camera move, label or card, state change and alive action that matters, on the frame of its picture, density about 1 event a second (~55 to 60 for 60 s), only names from the locked SFX set in `remotion/src/catalog.ts`, kenapa-colokan-panas/sfx.ts as the example. Before you design anything read `remotion/src/sets.ts` (the set kinds) and DESIGN.md B27.15 and B27.16: the background is never another video's, so the nature diorama of sea, land, hills and fields is not available, whatever the topic's weather; pick the free kind where the topic really happens (a kind that some `videos/*/set.json` names is taken), build it, and declare it in `remotion/videos/<slug>/set.json` (`{"kind": "<id>"}`, or a new kind with `name` and `fits`). Check from a source what real shape the hero has and draw that form (a rainbow is a ring cut by the horizon, not a half-arc). Run `npm ci` in `remotion` first when `remotion/node_modules` is missing. If Chrome or the render cannot run, say so and continue without the stills. Its "no push" line is overridden by step 4 below, and its step 7 (paste the narration) and step 8 (the page steps) output is overridden by step 5: -create skips both; everything else stands (never write to `workspace/`, never claim a check you did not run).

## 4. Commit and push to main (cloud rules)

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
6. "sudah di main, tinggal git pull di PC ian"

Do NOT print the narration texts (they are in the story; /remotion step "Naskah suara" shows them), no /remotion steps, no file lists, no source lists, no recap of the video.
