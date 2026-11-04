# Branch cleanup: merge cloud/stok-video and matahari into main, delete merged branches

Plan session, 2026-11-04. ian approved every choice below. The push and the remote deletes are part of that approval.

## Context
The finished cloud videos sit on `cloud/stok-video` and are not on `main` yet. A few old branches are either fully merged or left over. Goal: every video is on `main`, and the only branches left are `main` and `cloud/stok-video`.

## State found (read-only, local refs)
| Branch | vs main | Decision |
|---|---|---|
| `origin/cloud/stok-video` | +29 commits, 21 video slugs, adds files only (`remotion/videos|stories|tests/<slug>`), no shared file | **merge into main, keep the branch** (`-create-cloud` keeps using it) |
| `origin/video/matahari-tidak-kuning` | +1 commit, 7 new files of that video only | **merge into main, then delete** |
| `origin/claude/sharp-mayer-7k0q6z` | fully merged | delete (remote) |
| `fix/audit-bugfixes` (local + origin) | fully merged | delete both |
| `origin/video/gurita-punya-tiga-jantung` | fully merged | delete (remote) |
| main, not committed | `remotion/videos/fakta-seru-tentang-cegukan/`, its story json and test, `docs/briefs/` | **commit to main** (its own commit) |

The local `origin/cloud/stok-video` ref is stale. The local ref is at `1a7d762`, the remote at `1a07353`, so fetch first and merge the newer tip.

## Steps (/execute)
1. `git fetch origin --prune` and confirm that `main` == `origin/main` and the working tree is clean apart from the cegukan and briefs files.
2. Commit 1: `git add remotion/videos/fakta-seru-tentang-cegukan remotion/stories/fakta-seru-tentang-cegukan.json remotion/tests/fakta-seru-tentang-cegukan.test.ts docs/briefs` → "Video: Fakta seru tentang cegukan; briefs".
3. Run `git diff --name-only main...origin/cloud/stok-video | grep -vE '^remotion/(videos|stories|tests)/'`. It must print nothing (this is a recheck after the fetch). If it prints anything, stop and report.
4. `git merge --no-ff origin/cloud/stok-video -m "Merge cloud/stok-video: <N> stock videos"`.
5. `git merge --no-ff origin/video/matahari-tidak-kuning -m "Merge video/matahari-tidak-kuning"`.
6. Verify (below). If a video fails, **do not fix it here**. Report the slug and the failure to the Plan session. Rule: defects become rules, don't polish one video.
7. `git push origin main`.
8. Delete branches:
   `git push origin --delete claude/sharp-mayer-7k0q6z fix/audit-bugfixes video/gurita-punya-tiga-jantung video/matahari-tidak-kuning`
   `git branch -d fix/audit-bugfixes`, then `git fetch --prune`.
9. Final `git branch -a`: only `main`, `origin/main` and `origin/cloud/stok-video` are left.

## Verification (in `remotion/`)
- `npm run check` and `npm test` both pass.
- Each merged video's own test: run `node tests/<slug>.test.ts` for each new `tests/*.test.ts` (21 stock + matahari + cegukan).
- Watch out: `matahari-tidak-kuning` has no `set.json` and was made before B28 Looks and the set registry. If `sets.test.ts` or `style.test.ts` fails because of it, report it per step 6.

## Flag for ian (no action)
- The stock branch has `gurita-punya-tiga-jantung-2`, and `main` already has the gurita video from the old branch. Both stay. ian decides later which one to keep.
