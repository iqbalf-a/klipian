---
name: create
description: Runs for a message starting with `-create`. Make one klipian intip video from a topic in a cloud session, e.g. `-create gurita punya tiga jantung`. Builds the brief itself, follows its steps, and pushes only the video's files to the branch cloud/stok-video.
---

# -create <topic>

The topic is the argument. One video per run. Nothing is asked of the person.

Work quietly: no progress narration between steps; only the final answer.

## 0. Check the checkout

Run `git log -1 --oneline origin/main` and `test -f .claude/skills/create/SKILL.md`; `klipian/motion_brief_cli.py` must exist too. If any of that fails, stop and answer only: "checkout lama, buka sesi cloud baru".

## 1. Branch (always the same one)

```bash
git fetch origin
git checkout -B cloud/stok-video origin/cloud/stok-video 2>/dev/null || git checkout -B cloud/stok-video origin/main
```

The first form is used when `origin/cloud/stok-video` exists, otherwise the branch starts from `origin/main`. Never work on `main`.

## 2. The brief

From the repository root (no `workspace/` is needed; the profile settings fall back to the defaults and nothing is written):

```bash
python3 -m klipian.motion_brief_cli "<topic>"   # `python` if python3 is missing
```

It prints the Khusus brief with the defaults: custom video, 60 s, loop yes, the "Intip yuk!" sting yes, the voice apps elevenlabs + googleai + voicestudio, the default music. The slug in it is checked against the folders of this stock branch, so it is free.

Body and money topics are fine as explanations (why we hiccup, why banknotes do not tear). If the topic asks for medical advice, a diagnosis, a cure, a dose or a treatment, for investment or financial advice (e.g. "obat cegukan paling ampuh", "saham yang pasti naik"), or for anything dangerous: stop, write nothing, say why.

## 3. Build

Follow the printed brief, steps 1 to 8, as written (`npm ci` in `remotion` first when `remotion/node_modules` is missing). If Chrome or the render cannot run, say so and continue without the stills. Its "no push" line is overridden by step 4 below, and its step 7 (paste the narration) and step 8 (the page steps) output is overridden by step 5: -create skips both; everything else stands (never write to `workspace/`, never claim a check you did not run).

## 4. Commit and push (cloud rules)

1. `git add` only the video's own files: `remotion/stories/<slug>.json`, `remotion/videos/<slug>/`, `remotion/tests/<slug>.test.ts`. Never `remotion/out/`, never `workspace/`, nothing else.
2. One commit, message `Video: <title>`.
3. Push, up to 3 tries, because other sessions push to the same branch in parallel (their files never overlap):
   ```bash
   git pull --rebase origin cloud/stok-video && git push origin cloud/stok-video
   ```
   If the remote branch does not exist yet, `git push -u origin cloud/stok-video` creates it. Never push `main`, never force-push, never open a PR.

## 5. Answer

Answer in Indonesian, at most 6 short lines, nothing else:
1. `slug`
2. branch + hash
3. the style-check summary line
4. each FAIL/FLAG line (or "tanpa FAIL/FLAG")
5. at most 2 one-line points ian must decide
6. "merge cloud/stok-video di PC ian"

Do NOT print the narration texts (they are in the story; /remotion step "Naskah suara" shows them), no /remotion steps, no file lists, no source lists, no recap of the video.
