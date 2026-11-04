---
name: create-cloud
description: Runs for a message starting with `-create-cloud`. Make one klipian intip video from a topic in a cloud session, e.g. `-create-cloud "gurita punya tiga jantung"`. Reads the rules and the design from the latest main (never from the stock branch), builds the video, and pushes only the video's own files to the branch cloud/stok-video.
---

# -create-cloud "<topic>"

The topic is the rest of the message, without its quotation marks. This command is not `-create`: `-create` works on the stock branch's own checkout; `-create-cloud` always reads the rules and the design from `origin/main` and uses the stock branch only as the shelf the finished video goes to.

The topic is the argument. **One topic per session:** a session makes one video and saves it to `cloud/stok-video`. If a second `-create-cloud` arrives in a session that already made a video, do not start it; answer only: "satu topik satu sesi, buka sesi baru". One video per run. Nothing is asked of the person.

Work quietly: no progress narration between steps; only the final answer.

## 0. Check the checkout

Run `git log -1 --oneline origin/main` and `test -f .claude/skills/create/SKILL.md`; `klipian/motion_brief_cli.py` must exist too. If any of that fails, stop and answer only: "checkout lama, buka sesi cloud baru".

## 1. Read main's rules; the stock branch only holds videos

`cloud/stok-video` is a shelf of finished videos and nothing else: never put rules, design or code on it. The rules, the brief and the checker are always `main`'s. Check out `origin/main` detached (no branch is created, so there is nothing to delete afterwards) and look at the stock videos from there:

```bash
git fetch origin
git checkout -q --detach origin/main
for d in $(git ls-tree -d --name-only origin/cloud/stok-video remotion/videos/); do
  s=${d##*/}; git cat-file -e "origin/main:$d" 2>/dev/null && continue        # a video that main has already stays main's
  git checkout origin/cloud/stok-video -- "$d" 2>/dev/null
  git checkout origin/cloud/stok-video -- "remotion/stories/$s.json" "remotion/tests/$s.test.ts" 2>/dev/null
done
git reset -q                                                                  # the stock videos stay in the working tree, not staged
grep -q "B27.16" remotion/DESIGN.md && test -f remotion/src/sets.ts && test -f remotion/scripts/setOwners.mjs
```

The stock videos are copied in so that the brief's slug is free (it checks the folders) and so that every `videos/*/set.json` shows which set kinds are taken. If the last line fails (main does not have the set rules yet), stop and answer only: "main belum punya aturan set, update main dulu". Never work on `main` or on `cloud/stok-video` directly, and never create a branch such as `work/create`.

## 2. The brief

From the repository root (no `workspace/` is needed; the profile settings fall back to the defaults and nothing is written):

```bash
python3 -m klipian.motion_brief_cli "<topic>"   # `python` if python3 is missing
```

The look (B28) is chosen by you from the topic, as the brief says (iso, else 2d, else text). Only when the message is `-create-cloud 2d "<topic>"` or `-create-cloud teks "<topic>"` (the first word after the command), force it: drop that word from the topic and add `--look 2d` or `--look text` before the topic:

```bash
python3 -m klipian.motion_brief_cli --look text "<topic>"
```

It prints the Khusus brief with the defaults: custom video, 60 s, loop yes, the "Intip yuk!" sting yes, the voice apps elevenlabs + googleai + voicestudio, the default music. The slug in it is checked against the folders of this stock branch, so it is free.

Body and money topics are fine as explanations (why we hiccup, why banknotes do not tear). If the topic asks for medical advice, a diagnosis, a cure, a dose or a treatment, for investment or financial advice (e.g. "obat cegukan paling ampuh", "saham yang pasti naik"), or for anything dangerous: stop, write nothing, say why.

## 3. Build

Follow the printed brief, steps 1 to 8, as written. Write `sfx.ts` by hand: a sound on every object entering, camera move, label or card, state change and alive action that matters, on the frame of its picture, density about 1 event a second (~55 to 60 for 60 s), only names from the locked SFX set in `remotion/src/catalog.ts`, kenapa-colokan-panas/sfx.ts as the example. Before you design anything read `remotion/src/sets.ts` (the taken sets and the free kinds) and DESIGN.md B27.15 and B27.16: **the background is never another video's**, so the nature diorama of sea, land, hills and fields is not available, whatever the topic's weather; pick the free kind where the topic really happens (a kind that some `videos/*/set.json` names is taken), build it, and declare it in `remotion/videos/<slug>/set.json` (`{"kind": "<id>"}`, or a new kind with `name` and `fits`). Never edit `src/sets.ts` or any other shared file: the push below carries only the video's own files. Check from a source what real shape the hero has and draw that form (a rainbow is a ring cut by the horizon, not a half-arc). Run `npm ci` in `remotion` first when `remotion/node_modules` is missing. If Chrome or the render cannot run, say so and continue without the stills. Its "no push" line is overridden by step 4 below, and its step 7 (paste the narration) and step 8 (the page steps) output is overridden by step 5: -create skips both; everything else stands (never write to `workspace/`, never claim a check you did not run).

## 4. Commit and push (cloud rules)

Only the video's own files go to `cloud/stok-video`: `remotion/stories/<slug>.json`, `remotion/videos/<slug>/` (it includes `set.json`), `remotion/tests/<slug>.test.ts`. Never `remotion/out/`, never `workspace/`, nothing else, and never a change to a file that `main` has. The commit is built on top of the stock branch without switching branches, so nothing else can slip in:

```bash
F="remotion/stories/<slug>.json remotion/videos/<slug> remotion/tests/<slug>.test.ts"
for i in 1 2 3; do
  git fetch origin cloud/stok-video
  export GIT_INDEX_FILE=$(mktemp -u) && git read-tree origin/cloud/stok-video && git add $F
  C=$(git commit-tree "$(git write-tree)" -p origin/cloud/stok-video -m "Video: <title>") && unset GIT_INDEX_FILE
  git push origin "$C:refs/heads/cloud/stok-video" && break
done
```

One commit, message `Video: <title>`. Up to 3 tries, because other sessions push to the same branch in parallel (their files never overlap); a rejected push is retried on the fresh branch tip. If the remote branch does not exist yet, the same push creates it. Never push `main`, never force-push, never open a PR. The hash to report is `$C`.

**Clean up after a successful push only** (if the push failed, leave everything as it is and say so): go back to the session's own branch and remove the copies and the local output, so the working tree is clean:

```bash
git switch -q - 2>/dev/null || true
git branch -D work/create 2>/dev/null || true
git clean -fdq remotion/videos remotion/stories remotion/tests remotion/out
```

## 5. Answer

Answer in Indonesian, at most 6 short lines, nothing else:
1. `slug` and "gaya: iso/2d/teks, karena ..."
2. `cloud/stok-video` + hash
3. the style-check summary line
4. each FAIL/FLAG line (or "tanpa FAIL/FLAG"), the pieces as "baru: ... / pakai ulang: ...", and "set: <id>, bentuk dicek: ..."
5. at most 2 one-line points ian must decide
6. "merge cloud/stok-video di PC ian"

Do NOT print the narration texts (they are in the story; /remotion step "Naskah suara" shows them), no /remotion steps, no file lists, no source lists, no recap of the video.
