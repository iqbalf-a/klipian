# klipian

Cuts long podcasts and streams into vertical 9:16 clips ready to post to
TikTok, YouTube Shorts, and Instagram Reels.

Runs **entirely on your own machine.** No account, no uploads, no
subscription — and **no API key required.**

---

## Running it

```bash
python -m klipian serve
```

Then open **http://127.0.0.1:5177**

This server is what makes Whisper and ffmpeg actually run. Without it the UI
is just a static page — the Find Clips and Render buttons have nothing to
call, and they'll say so.

Bound to `127.0.0.1` only. The server opens the file explorer and runs
ffmpeg in response to HTTP requests, so it must never be reachable from a
network.

### First-time setup

Requires **Python 3.10+** and **ffmpeg** on your `PATH`.

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` elsewhere
pip install -r requirements.txt
```

Deliberately lightweight (~300 MB): the base install does **not** use
PyTorch — faster-whisper runs on CTranslate2. The Whisper model weights
download once on first use: **1.6 GB** for `large-v3-turbo`.

**AI Framing** (automatic speaker-following crop, powered by speaker
diarization) needs a separate, optional install — it pulls in PyTorch:

```bash
pip install -r requirements.txt -r requirements-ai-framing.txt
```

It also needs a free HuggingFace token, set once as `HF_TOKEN` in a `.env`
file (copy `.env.example`). The gated model page requires you to accept its
terms before the token can download the weights — see the comments in
`.env.example` for the exact link. After that first download it runs fully
offline, same as Whisper.

**Put your source videos in `workspace/samples/`.** The browser doesn't hand
the server a full file path, so the backend looks videos up by filename in
that folder — dragging a file into the browser previews it locally, but you
still need to copy the actual file there before transcription or rendering
can run.

---

## Workflow

Two paths reach the same editor.

### A. Through Claude — no API key

```
1  HOME       drop a video, choose crop/blur and resolution   [ Find clips ]
2  ANALYZE    ① transcription runs on your machine
              ② [ Download file ]  ->  drop it into Claude, ask it to work
              ③ paste the JSON reply  ->  [ Cut into clips ]
3  CLIPS      pick from Claude's suggestions or select ranges on the
              timeline yourself, both feed the same Result
4  FRAMING    lock the crop position per time point (drag to reposition,
              or let AI Framing follow whoever is speaking automatically)
5  CAPTIONS   fix any misheard words, then style the karaoke captions
6  HISTORY    render queue with live progress  ->  open the output folder
```

Steps ② and ③ use a Claude subscription you already have — not a paid API.
The advantage over calling the API directly: **you see Claude's reasoning
before anything renders, and can push back on it.**

### B. Manual — no Claude at all

On the Analyze screen, use **"Or cut it yourself."** That skips steps ② and
③ entirely — you pick ranges straight from the transcript on the Clips
screen.

### Editing before render

| Screen | What it does |
|---|---|
| **Clips** | drag a range on the timeline, or pick from AI suggestions; word-boundary snapping avoids cutting mid-word |
| **Framing** | drag/resize the crop box per time point; **AI Framing** follows whoever is speaking automatically; optional per-point head tracking for smoother motion |
| **Captions** | click any word to correct it; font, size, highlight color, position, words-per-line, outline, and watermark, all previewed live |

A clip is not a single range but a **list of cuts**. Removing a middle
section splits it in two, and captions are automatically remapped onto the
rendered timeline — a word that was at second 650 in the source lands at
second 11 in the output.

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

| Command | Does |
|---|---|
| `info` | media metadata, checks the available encoder |
| `transcribe` | word-level transcription, result is cached |
| `brief` | builds the file to drop into Claude |
| `import` | reads Claude's JSON reply, snaps to word boundaries |
| `render` | produces the 9:16 MP4 |
| `serve` | runs the UI with everything wired up |

`brief --mode` picks a rubric from `prompts/rubrik/` — currently `dialog`
(podcast/talkshow) or `gameplay` (MLBB livestream commentary). The web UI's
own Claude round-trip always uses the `dialog` rubric; the CLI is the only
place the other one is reachable right now. Adding a new rubric means both
a new `.md` file in `prompts/rubrik/` **and** registering it in `RUBRICS`
in `klipian/cli.py`.

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

Transcription is paid for **once per video**, keyed to a fingerprint of the
file + model + language. Tweaking a rubric or re-cutting never re-runs it.

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
| **Assets** | `workspace/assets/`, for custom watermarks/fonts/templates beyond klipian's defaults |

`clips.json` replaces tracking uploads by hand in a spreadsheet — a row that
used to live in Excel now lives in this table, saved the moment a cell is
edited.

---

## Structure

```
klipian/
├── klipian/                       engine
│   ├── models.py                    Word, Segment, Transcript  ← core contract
│   ├── cache.py                     transcript cache, keyed by video+model+language fingerprint
│   ├── transcribe.py                faster-whisper word-level transcription
│   ├── glossary.py                  hotwords + correction pass for commonly misheard terms
│   ├── diarize.py                   speaker diarization -- lets AI Framing know who's talking
│   ├── facebox.py                   face detection, drives AI Framing's crop box and head tracking
│   ├── scenecut.py                  hard shot-change detection in the source video,
│   │                                complements AI Framing
│   ├── audio_energy.py              volume-spike detection, a secondary hook signal
│   ├── roundtrip.py                 builds the Claude brief + imports its reply
│   ├── render.py                    cuts -> concat -> crop -> captions -> MP4
│   ├── ffmpeg_tools.py              thin wrapper around ffmpeg/ffprobe
│   ├── server.py                    local API: transcription, render, thumbnails, workspace
│   └── cli.py
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
│   │   ├── editor/                  one file per editor screen (app, interactions,
│   │   │                            framing, analysis, player, roundtrip, history,
│   │   │                            timeline, captions, result, projects)
│   │   └── workspace/               one file per workspace panel (helpers, clips,
│   │                                render, assets)
│   └── tailwind.config.js
├── prompts/rubrik/                scoring rubrics, editable without touching code
├── requirements.txt                base install (no PyTorch)
├── requirements-ai-framing.txt     optional: AI Framing / speaker diarization
├── .env.example                    copy to .env for HF_TOKEN (AI Framing only)
└── workspace/                     ALL working files -- one place, so there's never
    │                                doubt about where a video goes (see workspace/README.md)
    ├── samples/                     videos currently being worked on -- the app reads from here
    ├── out/                         render output
    ├── cache/                       transcripts (created automatically)
    ├── projects/                    per-video state (Result, framing points, caption corrections)
    ├── assets/                      custom watermarks/fonts/templates, the Assets panel in /workspace
    └── schedule/                    upload schedule & status (clips.json), the Clips panel in /workspace
```

---

## Troubleshooting

**"Needs the backend. Run: python -m klipian serve"** — the UI was opened
without the server running. Run the command at the top of this file.

**"not reachable in the server's folder"** — the video isn't in
`workspace/samples/` yet. Dragging a file into the browser only previews it
locally, it doesn't copy the file to the server — copy the actual file
there first.

**Rendered MP4 is 0 bytes** — ffmpeg is still writing it. Wait for the
queue row to say "done" before opening the folder.

**Transcription is much slower than usual** — check whether the laptop is
running on battery. On battery, speed drops from 2.3x to roughly 1.0x
realtime; a 42-minute podcast that normally takes 18 minutes becomes
~42 minutes. klipian warns about this on the Analyze screen.

**Transcription just takes a while** — that's expected, even plugged in. A
42-minute video takes roughly 18 minutes. Anything already transcribed once
is instant and marked "loaded from cache."
