# klipian

Cuts long podcasts and streams into vertical 9:16 clips ready to post to
TikTok, YouTube Shorts, and Instagram Reels.

Runs **entirely on your own machine.** No account, no uploads, no
subscription — and **no API key required.**

---

## Running it

```bash
.venv\Scripts\python.exe -m klipian serve
```

Then open **http://127.0.0.1:5177**

Always start it from the project's own `.venv` (as above, not with whichever
`python` is first on your `PATH`): the packages it needs live there, and a
Python that happens to have newer or older ones can break transcription (see
*First-time setup* for how this has already happened once).

This server is what makes Whisper and ffmpeg actually run. Without it the UI
is just a static page — the Find Clips and Render buttons have nothing to
call, and they'll say so.

Bound to `127.0.0.1` only. The server opens the file explorer and runs
ffmpeg in response to HTTP requests, so it must never be reachable from a
network.

### First-time setup

Requires **Python 3.14** and **ffmpeg** on your `PATH`. Install Python from
python.org with the `py` launcher, then:

```bash
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Install into the `.venv` only (always `.venv\Scripts\python.exe -m pip ...`),
never `pip install` to the global Python: a second copy of the packages there
is how a newer PyAV ended up under faster-whisper and broke every
transcription. `python -m klipian selftest` has a *decode* check that says so
in seconds if the environment is wrong.

**Rebuilding the environment** (a new Python, or it got into a bad state):
close any running server, rename the old `.venv` aside (`.venv-old` is ignored
by git) so there is a way back, and repeat the three commands above, plus the
AI Framing install below if you use it. Delete the old one once everything
works.

Deliberately lightweight (~300 MB): the base install does **not** use
PyTorch — faster-whisper runs on CTranslate2. The Whisper model weights
download once on first use: **1.6 GB** for `large-v3-turbo`.

**AI Framing** (automatic speaker-following crop, powered by speaker
diarization) needs a separate, optional install — it pulls in PyTorch:

```bash
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-ai-framing.txt
```

It also needs a free HuggingFace token, set once as `HF_TOKEN` in a `.env`
file (copy `.env.example`). The gated model page requires you to accept its
terms before the token can download the weights — see the comments in
`.env.example` for the exact link. After that first download it runs fully
offline, same as Whisper.

**Source videos live in `workspace/samples/`.** The browser doesn't hand the
server a full file path, so the backend looks videos up by filename in that
folder. On the Assets screen, **Add video…** copies a file from anywhere on
your disk into it (with a progress bar; up to 10 GB; mp4, mkv, mov, webm) and
adds it to the project. A file with the same name and size is reused, a
different one with the same name is saved as `name-2`, and nothing in the
folder is ever overwritten. You can also copy files in yourself and pick them
from the list on the same screen.

---

## Workflow

A **project** holds one or more source videos and one or more **Results**. A
Result is one clip in the making: a list of moments (segments) taken from any
of the project's videos, in any order, with its own framing, caption fixes,
output format and timeline elements. Rendering a Result makes one MP4;
moments from different videos are joined into it. Everything is saved as you
go (the Save button in the sidebar is only a safety net).

The screens, in the order the sidebar lists them:

```
HOME           your projects, + New Project
ASSETS         the project's videos, images and sounds
ANALYZE        find clips: transcribe, then ask Claude (A) or cut by hand (B)
CLIPS          pick moments from Claude's suggestions or the timeline
OUTPUT FORMAT  crop or blur background, resolution, quality  (per Result)
TIMELINE       order of the moments; labels, stickers, sounds, volume
FRAMING        crop position per time point
CAPTIONS       fix misheard words, style the karaoke captions
RENDER         title, quick preview, render the Result
HISTORY        render queue with live progress, finished files
```

### A. Through Claude — no API key

```
1  ASSETS     + New Project, then Add video… (or pick one from workspace/samples/)
2  ANALYZE    [ Find clips ]
              ① the transcript is made on your machine, or loaded if the
                 video already has one
              ② [ Download file ]  ->  drop it into Claude, ask it to work
              ③ paste the JSON reply  ->  [ Cut into clips ]
3  CLIPS      the suggestions fill the Result; add or trim moments on the
              timeline yourself, both feed the same Result
4  FRAMING    lock the crop position per time point (drag to reposition,
              or let AI Framing follow whoever is speaking automatically)
5  CAPTIONS   fix any misheard words, then style the captions
6  RENDER     quick preview, then render  ->  HISTORY shows progress and
              opens the output folder
```

Steps ② and ③ use a Claude subscription you already have — not a paid API.
The advantage over calling the API directly: **you see Claude's reasoning
before anything renders, and can push back on it.** The file in ② and the
reading of the reply in ③ are made by the server (`/api/brief`,
`/api/import`), with the same code the CLI uses.

Find clips never repeats a transcription that already exists: if the video
has a transcript it is loaded ("loaded from cache"), and if that transcript
was made with older settings, an older copy of the video or an older
glossary, the screen says so. **Transcribe again** (two clicks, it shows how
long it will take) makes a new one; the old one stays in use until the new
one is done.

Find clips also listens for what a transcript misses and puts it in the file
for Claude as a separate list, **Audio & timing cues**: laughter, applause and
cheering, shouts and gasps, music (marked *avoid*), long pauses and fast talk
(see *Design notes*). The export panel shows a chip per signal with how many
were found (or "none found", "not run", "failed"), each with an (i) saying what
it is and how it was detected. On the Clips screen the same cues are markers
along the timeline, and each AI suggestion lists the ones inside it.

### B. Manual — no Claude at all

On the Analyze screen, use **"Or cut it yourself."** That skips steps ② and
③ entirely — you pick ranges straight from the transcript on the Clips
screen.

### Editing before render

| Screen | What it does |
|---|---|
| **Assets** | the project's videos (several allowed: moments can come from any of them; add one from anywhere on disk with **Add video…**), plus its own images and sounds — dropped in, or imported from the shared `workspace/assets/` (a copy, so later changes to the shared file don't touch the project). Removing a video or file is two clicks |
| **Clips** | drag a range on the timeline, or pick from AI suggestions; word-boundary snapping avoids cutting mid-word |
| **Output Format** | crop or blur background, resolution (720p to 4K), quality — set per Result, so one clip can differ from another |
| **Timeline** | reorder a Result's moments; add text labels, image stickers and sounds on their own tracks; set the volume of each moment |
| **Framing** | drag/resize the crop box per time point; **AI Framing** follows whoever is speaking automatically; optional per-point head tracking for smoother motion |
| **Captions** | click any word to correct it; font, size, highlight color, position, words-per-line, outline, and watermark, all previewed live |

A Result is not a single range but a **list of cuts**. Removing a middle
section splits it in two, and captions are automatically remapped onto the
rendered timeline — a word that was at second 650 in the source lands at
second 11 in the output.

A project's renders go to `workspace/out/<slug>.<id>/`, where the slug comes
from the project's name when it was created. It stays fixed when the project
is renamed, so files you may have open don't move.

---

## CLI

The UI already covers the whole pipeline, but each stage can be run on its
own.

```bash
python -m klipian info video.mp4
```

```bash
python -m klipian transcribe video.mp4 --srt
```

```bash
python -m klipian brief video.mp4 --mode dialog
```

```bash
python -m klipian import video.mp4 reply.json
```

```bash
python -m klipian render video.mp4 workspace/out/video/candidates.json --only 1 --crop 58 8 26 84
```

```bash
python -m klipian render --replay PROJECT_ID --result RESULT_ID
```

```bash
python -m klipian selftest
```

| Command | Does |
|---|---|
| `info` | media metadata, checks the available encoder |
| `transcribe` | word-level transcription, result is cached |
| `brief` | builds the file to drop into Claude |
| `import` | reads Claude's JSON reply, snaps to word boundaries |
| `render` | produces the 9:16 MP4 from a candidates file; with `--replay`, renders again the request the editor last rendered for a Result, into a temporary folder, and compares its md5/sha256 with the file made then (nothing in `out/` is touched) |
| `selftest` | checks that nothing drifted: old project files still migrate, the Claude brief and reading of replies are unchanged, faster-whisper can decode audio in this environment, and every baseline render (`tests/fixtures/<name>/`) comes out byte-identical. A baseline whose video or project assets aren't on this machine is skipped. `--promote PROJECT_ID RESULT_ID NAME` turns a Result's last editor render into a new baseline |
| `serve` | runs the UI with everything wired up |

`brief --mode` picks a rubric from `prompts/rubrik/` — currently `dialog`
(podcast/talkshow) or `gameplay` (MLBB livestream commentary). The web UI's
own Claude round-trip always uses the `dialog` rubric; the CLI is the only
place the other one is reachable right now (`/api/brief` takes a `mode`
too, but the UI doesn't send one). Adding a new rubric means both a new `.md`
file in `prompts/rubrik/` **and** registering it in `RUBRICS` in
`klipian/roundtrip.py`.

---

## Design notes

### Word-level timestamps are the foundation

Without word-level timestamps, karaoke captions are impossible and cuts
would land mid-word. Regular subtitles (SRT) only carry sentence-level
timing — not enough.

### Division of labor with Claude

| Who | Does |
|---|---|
| Claude | judges content, gives **approximate** minute:second timing |
| klipian | snaps that timing to the **nearest word boundary** |

Claude doesn't have word-level timestamps and doesn't need them — forcing
millisecond precision out of it just makes it brittle. Measured in practice,
the snap distance is 0.01–1.77 seconds; the largest snaps happen when a
guess lands in the middle of a pause.

### Transcript cache

Transcription is paid for **once per video**. Tweaking a rubric or re-cutting
never re-runs it. Each transcript is saved under a fingerprint of the video
file (size and modified time), the model, the language and `prompts/glossary.txt`
(its size and modified time), so an edited glossary or a re-encoded video makes
a different file.

Everything that reads a transcript — captions in a render, the Claude brief,
the editor, the CLI — asks `Cache.find_transcript`, which has one rule: the
transcript made with exactly the current settings if there is one, otherwise
the newest transcript for a video of that name. Touching the glossary or the
video file doesn't throw a 40-minute transcription away; **Transcribe again**
on the Analyze screen is how to replace it on purpose.

### Audio and timing cues

Whisper writes down the words. It rarely writes laughter, never writes
applause, and says nothing about a long silence or a sudden speed-up — and on
audio mastered to the ceiling, "loudest" can't tell laughter from loud talk.
So `klipian/cues.py` finds those separately:

| Signal | How | Tells Claude |
|---|---|---|
| Laughter, applause/cheering, shouts/gasps | [YAMNet](https://www.kaggle.com/models/google/yamnet) (Google, Apache 2.0), converted to ONNX in `assets/models/` and run with onnxruntime — about 12 s for a 45-minute episode | what landed; a clip should end *after* it |
| Music | the same pass | **avoid** (intros, outros, ads, copyright) |
| Long pause | 3 s or more between two words, from the transcript's timestamps | "pause, then a confession or a punchline" |
| Fast talk | words per 10 s above the 95th percentile of that video | an excited, building story |

Each sound range gets a level — `low`, `medium` or `high` — from its score and
length (a table at the top of `cues.py`, so it can be tuned without
re-detecting). The brief lists them sorted by time, e.g.
`[12:05]–[12:09] laughter · high (4.1 s)`; the section is never left out, and
says so when nothing was found or the detection didn't run. When Claude's
reply is imported, each candidate also gets the cues inside it or within 5 s
after it (`cues` in the project), computed by klipian so the same reply always
gives the same list. The sound detection is cached per video
(`<name>.<fp>.cues.json`); the pause and fast-talk counts follow whichever
transcript is in use. `tools/cues_spike.py` writes numbered WAV clips of what
it finds, to listen to and judge.

### Glossary

`prompts/glossary.txt` holds names and terms that are commonly misheard.
Used twice: as `hotwords` fed to Whisper (re-injected every 30-second
window, so it stays recognized to the end), and as a correction pass
afterward.

Its contents come from evidence, not guesswork: `transcribe` prints a
**"possibly misheard"** list at the end. That list isn't just
`confidence < 50%` — a plain threshold flags 10.3% of words, and almost all
of them are function words that are actually correct. After filtering those
out, only 1.4% remains, and what's left really is wrong: names like
`biokul`, `biukan`, `radhi`.

---

## Performance

Measured on an **Intel Core Ultra 9 185H** (16C/22T, no discrete GPU).

| Stage | Plugged in | On battery |
|---|---|---|
| `large-v3-turbo` transcription | **2.3x realtime** | **~1.0x realtime** |
| 42-minute podcast | 18 minutes | ~42 minutes |
| 13-second clip render | ~14 seconds | slower |

**Plug in before a long transcription.** The gap is more than 2x — Intel
throttles CPU power on battery, and Whisper is one of the workloads that
feels it most. klipian detects this and warns on the Analyze screen.

Thread count is fixed at 8, not faster-whisper's default. The default (`0`)
gets translated by CTranslate2 into just 4 threads. Measured on the 185H: 8
threads is fastest, and 22 threads is actually **slower**, because it pulls
in the efficiency cores.

Projected for a 2h22m MLBB livestream: roughly 62 minutes to transcribe.

CTranslate2 is CPU-only — the Arc iGPU and NPU aren't used for
transcription. The Arc **is** used for encoding, via `h264_qsv`.

---

## Workspace dashboard

```
http://127.0.0.1:5177/workspace
```

An operational dashboard, separate from the editor — not for editing clips,
but for what happens **after** a clip becomes an MP4.

| Panel | Contents |
|---|---|
| **Clips** | upload schedule: status, title/hook, platform, date & time edited directly in the table; episode source, clip file, description + hashtags, TikTok caption, links, and notes live in a **Detail** dialog per row (the table itself stays to the essential columns, so it never needs horizontal scrolling). Saved to `workspace/schedule/clips.json` |
| **Rendered output** | `workspace/out/` as-is — same data source as the History screen in the editor |
| **Assets** | `workspace/assets/`: a shared library of watermarks, logos, banners and templates. A project's Assets screen *imports* from it (it copies the file); a project's own images and sounds live in `workspace/projects/<id>/assets/` |

`clips.json` replaces tracking uploads by hand in a spreadsheet — a row that
used to live in Excel now lives in this table, saved the moment a cell is
edited.

---

## Structure

```
klipian/
├── klipian/                       engine and server
│   ├── models.py                    Word, Segment, Transcript  ← core contract
│   ├── paths.py                     where things live: ROOT, WORKSPACE, the glossary, find_video()
│   ├── cache.py                     transcript cache; find_transcript() is the one rule
│   │                                for which transcript a video uses
│   ├── transcribe.py                faster-whisper word-level transcription
│   ├── glossary.py                  hotwords + correction pass for commonly misheard terms
│   ├── diarize.py                   speaker diarization -- lets AI Framing know who's talking
│   ├── facebox.py                   face detection, drives AI Framing's crop box and head tracking
│   ├── scenecut.py                  hard shot-change detection in the source video,
│   │                                complements AI Framing
│   ├── cues.py                      audio cues (YAMNet) and timing cues (pauses, fast talk)
│   ├── roundtrip.py                 builds the Claude brief + reads its reply (behind
│   │                                /api/brief, /api/import and the CLI)
│   ├── render.py                    cuts -> concat -> crop -> captions -> MP4, and joining
│   │                                moments from several videos
│   ├── compose.py                   second pass: labels, stickers, sounds, per-moment volume
│   ├── ffmpeg_tools.py              thin wrapper around ffmpeg/ffprobe
│   ├── projects.py                  project files: their shape, migration from older shapes,
│   │                                and the last render remembered for each Result
│   ├── jobs.py                      render / transcribe / diarize workers and the job registry
│   ├── server.py                    HTTP only: route tables, static files, quick preview,
│   │                                thumbnails, the /workspace dashboard's endpoints
│   ├── selftest.py                  `klipian selftest`
│   └── cli.py
├── tests/fixtures/                what selftest compares against: migrate/ (old project
│                                  shapes), brief/ (a Claude brief and replies), and one
│                                  folder per baseline render (request.json + baseline.json)
├── ui/                            interface -- no framework, no build step to run
│   ├── index.html                   editor shell + every screen
│   ├── workspace.html               the /workspace dashboard (see above)
│   ├── css/
│   │   ├── tokens.css                 colors/type/spacing -- shared by BOTH pages
│   │   ├── app.css                    editor styles (index.html)
│   │   ├── workspace.css              workspace styles, generated from Tailwind
│   │   └── workspace.src.css          Tailwind source -- not what the browser loads,
│   │                                  see the comment inside for how to rebuild it
│   ├── js/
│   │   ├── editor/                  one file per editor area (app, assets, analysis,
│   │   │                            roundtrip, result, interactions, framing, player,
│   │   │                            timeline, compose, captions, history, projects);
│   │   │                            classic scripts sharing one scope, so the order of
│   │   │                            the <script> tags in index.html matters
│   │   ├── shared/                  topbar.js, used by both pages
│   │   └── workspace/               one file per workspace panel (helpers, clips,
│   │                                render, assets)
│   └── tailwind.config.js
├── prompts/rubrik/                scoring rubrics, editable without touching code
├── assets/models/                 vendored ONNX models with their licenses: YuNet and SFace
│                                  (faces), YAMNet (sound events) and its class map
├── tools/                         scripts that are not part of the app (cues_spike.py)
├── requirements.txt                base install (no PyTorch)
├── requirements-ai-framing.txt     optional: AI Framing / speaker diarization
├── .env.example                    copy to .env for HF_TOKEN (AI Framing only)
└── workspace/                     ALL working files -- one place, so there's never
    │                                doubt about where a video goes (see workspace/README.md)
    ├── samples/                     videos currently being worked on -- the app reads from here
    ├── out/                         render output, one folder per project: <slug>.<id>/
    ├── cache/                       transcripts, audio cues, diarization (created
    │                                automatically); thumbs/ holds cached thumbnails
    ├── projects/                    one <id>.json per project (its videos, Results, framing
    │   │                            points, caption corrections), and per project:
    │   ├── <id>/assets/               its images and sounds
    │   ├── <id>/renders/              the last finished render of each Result, for
    │   │                              `render --replay` and `selftest --promote`
    │   └── legacy/                    files from before projects had ids, kept as they were
    ├── assets/                      shared library (logos, banners, templates), the Assets
    │                                panel in /workspace; a project imports copies from it
    └── schedule/                    upload schedule & status (clips.json), the Clips panel in /workspace
```

---

## Troubleshooting

**"Needs the backend. Run: python -m klipian serve"** — the UI was opened
without the server running. Run the command at the top of this file.

**"not in samples/"** (next to a video on Assets or on a project card, or in
an error when transcribing or rendering) — the server can't find that video
in `workspace/samples/`. A project remembers a video by file name, so put the
file back there under the same name, or use **Add video…** on the Assets
screen to copy it in again. (The paste-a-link box on Analyze isn't wired up.)

**Add video… says "not enough disk space" or "a video must be … 10 GB"** —
the copy needs the video's size plus 1 GB free on the drive that holds
`workspace/`, and one file can be at most 10 GB.

**Rendered MP4 is 0 bytes** — ffmpeg is still writing it. Wait for the
queue row to say "done" before opening the folder.

**Transcription is much slower than usual** — check whether the laptop is
running on battery. On battery, speed drops from 2.3x to roughly 1.0x
realtime; a 42-minute podcast that normally takes 18 minutes becomes
~42 minutes. klipian warns about this on the Analyze screen.

**Transcription just takes a while** — that's expected, even plugged in. A
42-minute video takes roughly 18 minutes. Anything already transcribed once
is instant and marked "loaded from cache."

**`selftest` says "faster-whisper cannot decode audio here"** — the Python
environment is broken, not the video. Run klipian from the project's `.venv`
(see *First-time setup*); a global Python with a different PyAV is the usual
cause.
