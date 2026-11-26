# klipian: full audit, findings (2026-11-26)

Nothing was fixed while writing this. Baseline: HEAD `9455446`, all 17 `tests/*.test.js` pass, `selftest --only motionstate motion motionopts motionbrief` passes.
Severity: **H** breaks or risks data or trust, **M** costs time or invites bugs, **L** polish.

## What was and was not covered

| Area | How | Depth |
|---|---|---|
| Python (31k lines) | pyflakes, AST size/branching metrics, grep for risky patterns (shell, eval, path joins, atomic writes, broad excepts), read of the HTTP guard and file-serving code | static; `render.py`, `jobs.py`, `youtube.py`, `facebox.py`, `transcribe.py` bodies not read line by line |
| UI (57 JS files, 8 pages, 13 CSS) | node syntax check, duplicate-function scan, innerHTML escaping scan, page fetch metrics, screenshots in the in-app browser | the browser pane was phone-width; no full click-through of Edit's 9 screens |
| Data | read-only scan of `workspace/` (5 profiles, 60 project files, 4 schedules, backups) | project assets checked; schedule file paths NOT verified (my check used the wrong folder, discarded) |
| Text | grep for language mix, placeholders, stale claims in docs | partial |
| Logic bugs | no runtime bug was reproduced. Findings below are risks found statically | not a proof of absence |

## Findings

### UI / UX / flow (the 7 confusions, plus new)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| U1 | H | YouTube download has 3 entry points with different mental models, plus a dead one (removed in `9455446`). "Parts only" is a different flow (Gemini first, then 20 s padded clips) hidden behind a second button. | `index.html` `addYouTubeBtn`, `addYouTubePartsBtn`; `sources.html` `sourceYtBtn`; `ytdl.js`, `ytparts.js` |
| U2 | M | "A separate video for each" creates Results, it does not render, yet reads like a render mode next to "Render Result" and "Render selected". | `index.html` ~667, 699, 1176 |
| U3 | M | Bulk exists in four places with four selection models and button sets: Results (Edit), Clips (Workspace), YouTube bulk upload, bulk render. | `bulk.js` (612 lines), `workspace/clips.js` (1557 lines), `ytBulkDialog` |
| U4 | M | Motion had two flows (picture first, voice first for ricks) with one step list. Fixed in `9455446` with the Order option; `-create` and the guide are still not aligned. | `steps.js`, `SKILL.md` 2b |
| U5 | M | Edit page is one 82 KB document with 9 screens, 122 buttons and 35 script tags. A first-time user sees "Assets, Analyze, Clips, Output, Timeline, Framing, Captions, Render, History" with no stated order. | `/` fetch metrics |
| U6 | M | Profiles that only make Motion videos (`klipian-intip`: 0 projects, 46 motion; `sebatang-cerita`: 0 projects, 6 motion) still show Edit and Sources as the first two tabs, and Edit opens on "No projects yet". Navigation is not profile-aware. | data scan, screenshot |
| U7 | M | Top nav is repeated by hand in each page's HTML; `/admin` has none and `/guide` shows only "Guide". On narrow widths the nav scrolls sideways and "Guide" is cut off. | page fetch `navLinks`, screenshot |
| U8 | L | Two `.btn.main` side by side in the Post panel (`postBriefCopy`, `postReplyPaste`) against the rule "one main per area". Three "Download" buttons for three different briefs. | `index.html` ~1048-1056, 461, 496 |
| U9 | L | Control heights are not uniform (search 30, Clips table 32, pager 25 to 28). Already listed in `docs/ui-design.md`. | doc |
| U10 | L | The brief opens in Claude Code only by copy/paste of a large text; the short `-create` command is shown but only when the checkout has the skill. | `page-steps-1.js` |

### Code

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C1 | H | `server.py` is 2817 lines. `docs/roadmap.md` says it was cut from 2257 to 1251; it has more than doubled since. Render orchestration is reachable only through HTTP. | `wc -l`, roadmap line 193 |
| C2 | M | Giant functions: `jobs._render_body` 267 lines (44 branches), `render.build_ass` 247, `jobs._transcribe_body` 166, `transcribe.transcribe` 144, `renderreq.build_request` 112 lines and 53 branches. Hard to test and to change safely. | AST scan |
| C3 | M | `selftest.py` is 9048 lines, 57 checks in one file; a full run exceeds 100 s. Python has no unit tests outside it. | `wc`, my run timed out |
| C4 | M | `motion.py` re-exports about 40 names from `motion_brief`/`motion_voice_export` that pyflakes reports unused. Intentional facade, but it hides the real dependency graph. | pyflakes, `motion.py` 1766-1773 |
| C5 | M | 37 handlers repeat the same `try: req = self._read_json() except Exception as exc: return 400` block. | grep |
| C6 | L | Unused imports and one redefinition: `autopilot.py` `os` and `datetime`, `credits.py` `os`, `gemini_api.py` `os`, `facebox.py` `cv2` twice, `autopilot_deps.py` two. | pyflakes |
| C7 | L | 140 `innerHTML` sites. The 14 unescaped interpolations found are mostly safe (numbers, constants, `encodeURIComponent` URLs). `editor/app.js:773` `${r.note}` and `cues.js` `st.text`/`def.label` are not escaped; their values are program text today. | scan |
| C8 | L | Helpers duplicated across pages: `escapeHTML` and `timeAgo` (editor and workspace), `call` x3, `esc`. Each page loads its own copy. | scan |
| C9 | L | 35 separate script tags on Edit with `?v=` cache busting; no bundling. Fine on localhost. | page fetch |
| C10 | L | `remotion/.claude/skills` holds 4 copies of the maptiler skill (2.9 MB). | `find` |
| C11 | L | Tailwind output `workspace.css` is generated but the rebuild command is documented nowhere. | grep README/docs |

### Logic and bug risks (static, none reproduced)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| L1 | M | Most JSON writes go through tmp + replace, but not all: `claude_api.py:391`, `jobs.py:665/1351/1384`, `motion.py:577` (the story), `server.py:322`. A crash mid-write can leave a truncated file. | grep |
| L2 | M | After voice-first stage 2 the story file is replaced, which makes the matched voice stale. The page asks for a second Match; if the user skips it the render is blocked by a gate, so it is safe but the reason text is generic. | `motion.py` align/take |
| L3 | M | Voice-first stage 2 brief points the agent at `workspace/.../story.voiced.json`. A cloud session cannot read it. Only local Claude Code works. Not tested with a real agent. | `motion_brief._stage_steps` |
| L4 | L | 500 responses return `str(exc)` to the browser, which can include local paths. Local single-user, so low. | `server.py` 616 |
| L5 | L | `datetime.now()` (naive) in `autopilot.py` and `youtube.py` schedule math. Correct only while the PC clock is the channel's timezone (WIB). | grep |
| L6 | L | `ytdl` has an "Update yt-dlp" button that runs `pip install -U` in the venv from an HTTP request (guarded by the Origin/Host checks). | `ytdl.py` |
| L7 | L | The HTTP guard is solid: Host and Origin checks, bind to 127.0.0.1, no `shell=True`, no `eval`, file serving uses a whitelist and `is_relative_to`. Recorded so it is not re-audited. | `server.py` 454-480, 1640-1668 |

### Data

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | M | 31 of 81 project assets point to source videos that are no longer in the profile's `sources/` (23 in `klipian-lucu`, 8 in `podcast`). Those projects cannot be re-analysed or re-rendered. May be deliberate (files deleted after posting; "Download again" exists) but nothing in the project tells the user. | scan |
| D2 | M | `workspace/backups/` holds 22 xlsx backup folders from the last 3 days (21 on Nov 23 to 26, written by every Sync). No pruning in `xlsx_sync.py`. | `ls`, `xlsx_sync.py:72` |
| D3 | L | Leftovers: `workspace/.selftest-oidix5m6` (17 MB, 26 Nov 00:14, left by my own `selftest` run that I killed on a timeout; the selftest sweeps old ones itself later), `profile.json.bak-uploads-20261110` and `clips.json.bak-uploads-20261110` in `klipian-intip`, empty `workspace/jadwal`, `.tmp` folders in two motion profiles. | `find` |
| D4 | L | Schedule status counts: klipian-intip 25 Posted / 1 Scheduled, klipian-lucu 110 / 2 / 1 Draft, podcast 179 Posted / 7 Draft, sebatang-cerita 3 Posted / 1 Scheduled / 1 Draft. No duplicate titles in any. | scan |
| D5 | L | Disk: `workspace` 45 GB (podcast 37 GB, of which sources 33 GB). | `du` |
| D6 | L | Python deps have no lock file; `faster-whisper>=1.1.0` is open-ended and `av<19` is a patch for a past breakage, as the file says. | `requirements.txt` |

### Text and copy

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| T1 | L | UI text is consistently English. Internal state ids in Motion are Indonesian (`selesai`, `usang`, `menunggu`, `belum`, `folder berubah`) and mapped to English labels; two vocabularies in one codebase. | `steps.js` |
| T2 | L | The look label "Ricks (… voice first)" now clashes with the Order option. | `steps.js`, `motion.py` `LOOK_CHOICES` |
| T3 | L | `docs/roadmap.md` is out of date (line counts, "Python CLI behind the UI"). `docs/ui-design.md` is current. The guide has no mention of the Order option. | docs |
| T4 | L | Hints are long and repeated (the "Straight into the topic…" paragraph appears in the form and again in the options panel). | `remotion.html`, `page-steps-1.js` |

## Plan, in order

**P1: remove the confusion (UI/UX), about 1 to 2 days**
1. One "From YouTube…" dialog: whole video or only the clips I pick. One entry per page (U1).
2. Rename "A separate video for each" and fix the render words (U2).
3. One bulk bar pattern and one selection model for Results and Clips (U3).
4. One shared header partial; `/admin` and `/guide` get the area nav; the nav wraps or collapses on narrow widths (U7).
5. Profile-aware nav: hide or demote Edit and Sources for motion-only profiles (U6).
6. One main button per area; one "Download" meaning (U8).
7. A short numbered path on Edit ("1 Assets, 2 Analyze, 3 Clips, … 8 Render") (U5).

**P2: Motion consistency, about half a day**
8. Align `-create` (SKILL, CLAUDE.md) with the Order option, or leave it and say so in the guide (U4).
9. Rename the Ricks look label; add the Order option to the guide (T2, T3).
10. Test the stage 1 and stage 2 briefs once with a real Claude Code run, and make the stage 2 brief work without `workspace/` access or say it must be local (L3).

**P3: data safety, about half a day**
11. Prune `workspace/backups/xlsx-*` (keep the last N) (D2).
12. Atomic writes for the five remaining writers (L1).
13. Show "source file missing" on a project instead of failing later; offer "Download again" (D1).
14. Clean the leftovers listed in D3 (needs ian's OK per item).

**P4: code health, 2 to 4 days**
15. Split `server.py`: render orchestration and project storage out of HTTP; a `read_json` decorator for the 37 handlers (C1, C5).
16. Break `jobs._render_body`, `render.build_ass`, `renderreq.build_request` into steps with tests (C2).
17. Split `selftest.py` into modules and add a fast subset that runs in under 30 s (C3).
18. Remove unused imports; make the `motion` facade explicit (C4, C6).
19. Share `escapeHTML`, `timeAgo`, `call` in `ui/js/shared/`; escape the 4 unescaped spots (C7, C8).
20. Document the Tailwind rebuild; drop the duplicate skill copies (C10, C11).

**P5: polish**
21. One control height; remove inline styles on Edit (U9).
22. Shorten repeated hints (T4); retire the Indonesian state ids behind a mapper (T1).
23. Refresh `docs/roadmap.md`.
24. Pin Python deps with a lock file (D6).

**P6: the lemo-opuscar plugin**
25. Only after P1 to P3. Pilot styles: whiteboard, blueprint, one three.js style (see the earlier note); translate the look, never copy the CC BY-NC prompts.

## Open questions for ian

- U1: merge "parts only" into the one dialog?
- D1: are deleted source videos intentional (disk space), so projects should simply mark them "source removed"?
- D2: how many backups to keep (suggested 10)?
- U6: hide Edit/Sources for motion-only profiles, or keep them visible but not first?

## P1 progress (2026-11-26)

Done: item 1 (one "From YouTube…" button on Edit; the dialog offers "Download the whole video" or "Pick clips first…"), item 2 (the Results choice is now "One video per moment" / "Make one Result per moment", also in the guide), item 4 (one area switch for every page, made in `ui/js/shared/topbar.js`; the Guide page now has the full switch), item 5 (`/api/profiles` gives each profile a `focus`; a Motion-only profile gets Motion first and its brand link goes to `/remotion`), item 6 (one main button in the Post panel; the three brief downloads are all "Download brief"), item 7 (tabs 1 to 8 numbered on Edit; History is not a step).
Not done: item 3 (one bulk bar pattern for Results, Clips, YouTube bulk upload and render). It touches `bulk.js` and `workspace/clips.js` and needs a click-through of both, so it is its own piece of work.
Checked: U7's narrow-width claim was wrong; below 720 px the switch already drops to its own row and scrolls inside it.
Known failing check, not caused by P1: `selftest briefsteps` ("the 30 s brief is 40268 characters: keep it under 40000"); it also fails on `4c9a15a`, before the Order option.

Item 3 (bulk bars): done as a pattern, not a rewrite. The two bars differ on purpose in layout (Results sits under its list, Clips floats so the table does not move), so what was unified is the content: count first, one main action first, destructive actions together at the end (`.bulk-end`, red Delete), selection helpers in the list header. Workspace Clips Delete is now `.btn.danger` inside `.bulk-end`; the rules are in `docs/ui-design.md` ("Bar aksi massal"). The YouTube bulk dialog already followed rule 6. Not changed: Results still shows its bar when nothing is ticked (buttons disabled), Clips hides it; the two selection models (ticks in a list, ticks in a table) stay separate.

## P2 progress (2026-11-26)

Done: item 8 (decision: `-create` stays as it is; the guide now says so), item 9 (the Ricks look label no longer says "voice first"; the guide explains the Order option and both flows), item 10 (the stage 2 brief carries the voice-timed story inside it, 9.9 KB for a 60 s video, so it works in any Claude Code session, cloud included; it refuses with a clear message when the timed story is missing; `selftest motionstate` covers stage 1, stage 2, picture first and the missing file; the inlined story passes `remotion/validate.mjs`).
Not done: a real Claude Code run of stage 1 and stage 2 (it spends a session and writes a story and a folder); the briefs were only checked as text and by the validator.

## P3 progress (data safety)

- **D1 (correction):** the UI already marked a project whose primary video is gone. The home card now also says when any later video is missing from `sources/` (`videos` added to `_project_summary`, note via `lacking(p)` in `ui/js/editor/projects.js`).
- **D2:** `xlsx_sync.prune_backups` keeps the newest 10 automatic `xlsx-YYYYMMDD-HHMMSS` backups; manual, merge and migrate folders are never touched. The limit of 10 is my default (the question was never answered); change `KEEP_BACKUPS` if wanted.
- **L1:** the five JSON writers (claude_api, jobs x3, server) now use `paths.write_text_atomic`. `motion.py:577` writes a temp validation file, so it is left as is.
- **D3 (not done):** leftover cleanup (`workspace/.selftest-*`, `*.bak-uploads-20261110`, empty `workspace/jadwal`, `.tmp` folders) needs ian's OK per item.
- Selftest: new check `datasafe` (atomic write, prune, videos list). Pre-existing `briefsteps` failure (30 s brief 40268 > 40000 chars) is still open.

## P4 progress (partial)

- **Done:** C6 unused imports removed (`os` in autopilot, credits, gemini_api; the datetime redefinition in autopilot). Left as probes: `cv2`/`google.genai` availability checks and the `autopilot_deps` re-exports. C7 `r.note`, `st.text`, `def.label` now escaped in editor `app.js` and `cues.js`. C11 Tailwind rebuild command documented in README.
- **Not done (large, needs its own session each):** item 15 split `server.py` (2817 lines), 16 break up `_render_body`/`build_ass`/`build_request`, 17 split `selftest.py` (9128 lines), C4 explicit `motion` facade, C8 shared `escapeHTML`/`timeAgo`/`call`, C10 duplicate maptiler skill copies (285 tracked files under `remotion/.claude/skills`, so deleting needs your OK).
- Full selftest passes; node tests pass.
- **C8 (partly):** `esc` now lives once in `ui/js/shared/esc.js` (loaded by /admin, /autopilot, /profiles, /remotion; four copies removed). Checked in the browser on /autopilot, /remotion and /profiles; /admin redirects a non-admin profile so it was not opened. `timeAgo`, `escapeHTML` (editor vs workspace) and the three `call` variants differ slightly and stay as they are.
- **Item 15 (first step):** `server.py` 2817 -> 2300 lines. The Motion routes moved to `klipian/server_motion.py` (`MotionRoutes`) and the YouTube, rubrics, Claude, yt-dlp, voice, autopilot and admin routes to `klipian/server_services.py` (`ServiceRoutes`), both mixins of `Handler`; the route tables point at them (`MotionRoutes._get_...`). Methods moved verbatim; `_claude_parts` and `_import_reply` stay in `server.py` (selftest and autopilot_deps use them there) and are imported inside the one method that needs them. Full selftest passes and 10 moved routes answered on a live server. Still in `server.py`: workspace, project, render and upload routes, `_get_static`, and the shared helpers; a `read_json` decorator (C5) is not done.
