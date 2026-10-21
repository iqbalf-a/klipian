# klipian

Cuts long podcasts and streams into vertical 9:16 clips ready to post to
TikTok, YouTube Shorts, and Instagram Reels.

Runs **entirely on your own machine.** No account, no uploads, no
subscription — and **no API key required.**

---

## Running it

From `cmd` in the project folder, type `st`, press Tab, then Enter:

```bash
start.cmd
```

It starts the server from `.venv` and prints its address,
**http://127.0.0.1:5177**: open it in your browser yourself (set
`KLIPIAN_OPEN_BROWSER=1` to have it open a tab for you). `start.cmd 5180` uses
another port; if klipian is already running on that port it just says so. It checks for `.venv` and ffmpeg
first and says what to do when either is missing. Type `start.cmd` (or let
Tab complete it), not plain `start`, which is cmd's own command. Ctrl+C
stops the server.

Without the script, the same thing is:

```bash
.venv\Scripts\python.exe -m klipian serve
```

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

**Source videos live in the profile's `sources/` folder**
(`workspace/profiles/<profile>/sources/`; see *Profiles* below). The browser doesn't hand the
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
OUTPUT FORMAT  picture (9:16, 3:4 or 16:9), background, position, resolution, quality  (per Result)
TIMELINE       order of the moments; labels (+ Credit adds the source), stickers, sounds, volume
FRAMING        crop position per time point
CAPTIONS       fix misheard words, style the karaoke captions
RENDER         post text (title, caption, hashtags to paste at upload), angle
               (Claude's suggested take, intro and notes, yours to edit; Add
               intro / Add notes put them on the Timeline as ordinary labels),
               quick preview, render the Result (it also adds a Draft row to the upload
               schedule)
HISTORY        render queue with live progress, finished files
```

### A. Through Claude — no API key

```
1  ASSETS     + New Project, then Add video… (or pick one from this profile's sources)
2  ANALYZE    [ Find clips ]
              ① the transcript is made on your machine, or loaded if the
                 video already has one
              ② [ Copy ]  ->  paste it into Claude, ask it to work
                 ([ Download file ] gives the same text as a file to drop in)
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
| **Assets** | the project's videos (several allowed: moments can come from any of them; add one from anywhere on disk with **Add video…**), plus its own images and sounds — dropped in, or imported from the profile's library (`profiles/<id>/assets/`; a copy, so later changes to the library file don't touch the project). Removing a video or file is two clicks |
| **Clips** | drag a range on the timeline, or pick from AI suggestions; word-boundary snapping avoids cutting mid-word |
| **Output Format** | Picture (9:16 fills the frame; 3:4 or 16:9 sit inside the 9:16 file on a black or blurred background, at a Position you choose; Black unless you pick Blur), resolution (720p to 4K), quality — set per Result, so one clip can differ from another. The file is always 9:16. Older "Crop" Results open as 9:16, older "Blur background" ones as 16:9 on blur at 50%, and render the same |
| **Timeline** | reorder a Result's moments; add text labels, image stickers and sounds on their own tracks; set the volume of each moment |
| **Framing** | drag/resize the crop box per time point; **AI Framing** follows whoever is speaking automatically; optional per-point head tracking for smoother motion |
| **Captions** | click any word to correct it; font, size, highlight color, position, words-per-line, outline, and watermark, all previewed live |

A Result is not a single range but a **list of cuts**. Removing a middle
section splits it in two, and captions are automatically remapped onto the
rendered timeline — a word that was at second 650 in the source lands at
second 11 in the output.

A project's renders go to `workspace/profiles/<profile>/out/<slug>.<id>/`, where the slug comes
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
python -m klipian render video.mp4 workspace/profiles/podcast/out/video/candidates.json --only 1 --crop 58 8 26 84
```

```bash
python -m klipian render --replay PROJECT_ID --result RESULT_ID
```

```bash
python -m klipian selftest
```

```bash
python -m klipian cues video.mp4 --listen --kind laughter --level low --at 2:50 20:47
```

| Command | Does |
|---|---|
| `info` | media metadata, checks the available encoder |
| `transcribe` | word-level transcription, result is cached |
| `brief` | builds the file to drop into Claude |
| `import` | reads Claude's JSON reply, snaps to word boundaries |
| `render` | produces the 9:16 MP4 from a candidates file; with `--replay`, renders again the request the editor last rendered for a Result, into a temporary folder, and compares its md5/sha256 with the file made then (nothing in `out/` is touched) |
| `cues` | the audio and timing cues found in a video, counted per kind and level; detects the sound cues first if that hasn't been done. `--listen` cuts ±3 s WAV clips of them plus a `list.md` (time, level, score, the words spoken there) into `workspace/cache/cues-listen/<video>/`: `--kind`, `--level`, `--top N` (the N strongest of each kind, default 10), or `--at 2:50 …` for the cues within 1 s of given times |
| `selftest` | checks that nothing drifted: old project files still migrate, the Claude brief and reading of replies are unchanged, faster-whisper can decode audio in this environment, and every baseline render (`tests/fixtures/<name>/`) comes out byte-identical. A baseline whose video or project assets aren't on this machine is skipped. `--promote PROJECT_ID RESULT_ID NAME` turns a Result's last editor render into a new baseline |
| `serve` | runs the UI with everything wired up |

`brief --mode` picks a rubric from `prompts/rubrik/` — currently `dialog`
(podcast/talkshow) or `gameplay` (MLBB livestream commentary). The web UI's
own round-trip and Find clips with Claude use the profile's default rubric
(Profile settings), or the one picked above the cues on the Analyze screen.
Your own rubrics live in `workspace/rubrics/<name>.md`, shared by every
profile: Profile settings -> "New rubric from template..." copies one of the
templates in `prompts/rubrik/templates/` (komedi-tv, edukasi, gaming,
motivasi, podcast). A rubric must keep the sections the brief and the posting
text depend on (Tugas, Lima kriteria, Audio & timing cues, Judul dan hook,
Teks posting with the credit rule, Sudut pandang, Topik yang berpotensi
viral); one that lacks one is refused with its name (`klipian/rubrics.py`).

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
transcript is in use. `python -m klipian cues VIDEO --listen` cuts WAV clips of what was found (same
cache, same levels as the brief) so they can be judged by ear; see *CLI*.

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

## Profiles

A **profile** is one channel: its own sources, projects, renders, upload schedule,
assets and YouTube account. klipian runs on your own computer, so there is no password:
a profile only keeps the data apart (and keeps you from editing the wrong channel).

- **Picker and chip.** The first page of a tab is the profile picker
  (`/profiles`): a card per profile (name and colour), **+ Profile baru**, and a fixed
  **Masuk sebagai Guest**. The choice belongs to the *tab*: two tabs can work in two
  profiles side by side, and a background render or upload keeps writing to the profile it
  started in. A coloured chip in the top bar of the editor and of `/workspace` says who you
  are; its menu switches profile or opens the profile settings. From the picker a profile
  can be renamed, recoloured or deleted (two clicks; its folder goes to the Recycle Bin).
- **Settings per profile** (chip → *Profile settings*): the watermark's words (empty keeps
  "klipian"), the default rubric for Find clips, the caption look new projects start with,
  and **hashtag placement** for YouTube (in the title by default, in the description, or in
  both; 2 or 3 hashtags in the title; optionally `#shorts`).
- **Guest** is for editing and rendering only. It has its own folder (`_guest`) with no
  schedule and no secrets: a render makes no schedule row, there is no Post text panel, no
  Clips table and no YouTube — the server refuses those endpoints for the Guest, not only
  the page. Find clips and Copy brief still work. **Clear guest data** (two clicks) sends
  everything the Guest made to the Recycle Bin. Transcripts and thumbnails live in the
  shared cache, so a video already transcribed in another profile is ready at once.
- **The same video in two profiles.** Each profile keeps its own copy of a source, with its
  own project, renders, schedule and credit. When **Add video…** finds an identical file
  (same bytes) in another profile on the same drive, it makes a hard link instead of a
  second copy (deleting one name never removes the other), and copies that profile's
  source credit if this one has none.
- **Migration.** A workspace from before profiles (`sources/`, `projects/`, `out/`,
  `schedule/`, `assets/` and `secrets/client_secret.json` straight under `workspace/`)
  becomes the profile **podcast** ("klipian podcast") the first time the server starts, or
  on demand with `python -m klipian migrate-profiles` (stop the server first). Before
  anything moves, every JSON file is copied, with its SHA-256, to
  `workspace/backups/migrate-<time>/`; the folders are then *moved* (same drive), counts and
  hashes are checked, and everything goes back if anything differs. Running it again does
  nothing.
- **CLI.** `python -m klipian --profile lucu render …` (or `KLIPIAN_PROFILE=lucu`) works in
  that profile's folders; the default is `podcast`. A command run before the migration says
  to run `migrate-profiles` first.

## Add from YouTube

A source video can come straight from a YouTube link (yt-dlp): **From YouTube link…** in the
editor's Add video (Assets), or **+ From YouTube** in the Sources panel of `/workspace`. It
works in every profile, the Guest included, and the file goes into that profile's `sources/`.

1. Paste the link and press **Check**: the title, channel, length and an estimate of the size
   are shown, and nothing is downloaded yet.
2. **Download** runs in the background with progress, speed and time left, and a **Cancel**
   that removes everything it had written. The dialog may be closed meanwhile.

- The file is `<channel> - <title>.mp4` (no video id; characters Windows refuses are dropped,
  at most about 150 characters, ` (2)` when a *different* video already has that name).
  MP4 up to 1080p, H.264 when YouTube has it, joined with klipian's ffmpeg. One link is one
  video, never a playlist.
- **The credit is filled in** (`credits.json` of the profile: YouTube, the channel, the title,
  the link `https://www.youtube.com/watch?v=<id>`, and the video id and date), unless the video
  already has a credit. The link goes into every post description (`Sumber: YouTube <channel> —
  "<title>" (<link>)`), whichever hashtag placement the profile uses.
- The same video is never downloaded twice: the profile already has it, or another profile on
  the same drive does (then it is linked and its credit copied).
- Not possible, by design: private, age-restricted or members-only videos, live streams that are
  not finished, anything that needs a sign-in. There is no login or cookie support, and no MP3.
  Download only what you may use: a credit is attribution, not permission.
- yt-dlp is an optional install: `.venv\Scripts\python.exe -m pip install -r requirements-download.txt`
  (the dialog shows this command when it is missing). YouTube changes often, so the dialog has an
  **Update yt-dlp** button (it runs `pip install -U yt-dlp` in the `.venv`) and shows the version.

## YouTube upload

Each profile can be connected to its own YouTube channel and upload its schedule rows
(YouTube Shorts). It uses the YouTube Data API with *your* Google Cloud project; klipian
never clicks through YouTube Studio.

**One-time setup, per channel** (one Google Cloud project per channel, so each channel has
its own quota):

1. In [Google Cloud Console](https://console.cloud.google.com/), sign in with the Google
   account that owns the channel and create a project.
2. *APIs & Services → Library → YouTube Data API v3 → Enable.*
3. *Google Auth Platform*: audience **External**, app name and support email; add the
   channel owner's Google account as a **Test user**; add the scopes `youtube.upload`
   and `youtube.readonly`.
4. *Credentials → Create credentials → OAuth client ID → **Desktop app*** and download its
   JSON.
5. Install the optional packages once:
   `.venv\Scripts\python.exe -m pip install -r requirements-youtube.txt`.
6. In klipian: chip → *Profile settings → YouTube account → **Choose client_secret.json…***
   (the file is kept in that profile's `secrets/` folder, never sent back to the browser),
   then **Connect YouTube** and sign in in the tab that opens.

**The two status rows** in the settings: *Client* — green when the file is a valid Desktop
app client (project name shown), red when it is not, grey when none is chosen; *Account* —
green "Connected" with the channel's name, yellow when it needs attention (expired,
another channel, offline), red when Google refuses the sign-in because the account is not a
test user, grey when not connected. The dot on the chip follows the same colours. While the
project is in *Testing* the connection expires after about 7 days: **Connect again**. A
channel can belong to one profile only. **Disconnect** (two clicks) revokes the token at
Google and sends it to the Recycle Bin.

**Uploading.** *Detail* dialog of a clip → **Upload to YouTube**: checks first (title ≤ 100
characters, the render file is there, a vertical video of at most 3 minutes, not uploaded
before), then sends it as a background upload with progress and Cancel. The clip's date and
time become YouTube's scheduled publish time (a time in the past is refused; with no date
and time you can **Publish now**, after a second click). Afterwards the row gets its link
and video id and becomes Scheduled or Posted; **Check status** asks YouTube how the video
stands. **Bulk:** *Schedule all Ready* (Clips header) or *Upload to YouTube…* in the bar for
ticked rows opens a plan first — what will go, what is refused and why (no file, no title,
title over 100, no date/time), and today's quota — then uploads one clip after another;
*Cancel after this file* stops the queue, a quota error or an expired connection stops it
cleanly and leaves the rest as they were. A bulk upload never publishes immediately.
Quota: 100 uploads a day per Google Cloud project (what the project showed), so per profile.

**Locked private until audit.** A Google Cloud project that has not passed YouTube's API
audit makes YouTube keep API uploads **private**, whatever was asked. klipian notices that
after an upload and says so; until the audit is passed, uploads are useful as tests (or as
a way to get the file and title onto YouTube before publishing by hand).

**Hashtags and the title.** Where a clip's hashtags go (title, description, both) is the
profile's setting and is applied at upload; the Detail dialog's *On YouTube* preview and
the Post panel show the exact title and description. The brief you give Claude states the
profile's rule in numbers (e.g. "the first 3 hashtags in the title plus #shorts; title +
hashtags at most 100 characters"), and asks for hashtags ordered from the most specific to
the most general. klipian composes the final title itself and warns when it would pass 100
characters.

## Workspace dashboard

```
http://127.0.0.1:5177/workspace
```

An operational dashboard, separate from the editor — not for editing clips,
but for what happens **after** a clip becomes an MP4.

| Panel | Contents |
|---|---|
| **Clips** | upload schedule (a finished render adds a **Draft** row for its Result, with the title, file, source credit and the post text ready to paste; rendering that Result again updates the same row and never overwrites what you typed): status, title/hook, platform, date & time edited directly in the table; episode source, clip file, description + hashtags, TikTok caption, links, and notes live in a **Detail** dialog per row (the table itself stays to the essential columns, so it never needs horizontal scrolling). Saved to the profile's `schedule/clips.json`. Rows can be ticked for bulk actions (Mark as Posted, Set status, Delete, Upload to YouTube); a pasted YouTube/TikTok link marks a clip Posted; a row whose render file is gone is flagged "file deleted"; **Created** is sortable; deleting asks twice and can be undone |
| **Sources** | the raw videos in this profile's `sources/` folder: size, length, when each came in, whether it has a transcript, and which projects use it (**not used** when none does). **Open folder** opens the profile's sources folder. Lengths are read once per file and cached in `workspace/cache/` (shared). Each row has a **Credit** (platform, creator, title, link: where the video came from), kept in the profile's `sources/credits.json`. klipian builds the credit line from it — `Sumber: YouTube Raditya Dika — "Title" (link)` — for the post text and the schedule; Claude is told the source but never writes the line. A credit is attribution, not permission to reuse the video |
| **Rendered output** | the profile's `out/` as-is — same data source as the History screen in the editor; a file with no schedule row gets **Add to schedule** |
| **Assets** | the profile's `assets/` folder (**Open folder**): a library of watermarks, logos, banners and templates. A project's Assets screen *imports* from it (it copies the file); a project's own images and sounds live in `projects/<id>/assets/` of the same profile |

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
│   │   ├── shared/                  used by both pages: profile (which profile this tab is in),
│   │   │                            topbar, profile-ui (chip and settings), pager, armed (two-click
│   │   │                            buttons, Undo notices), hashtags, clipboard, version banner
│   │   └── workspace/               one file per workspace panel (helpers, clips,
│   │                                render, assets)
│   └── tailwind.config.js
├── prompts/rubrik/                scoring rubrics, editable without touching code
├── assets/models/                 vendored ONNX models with their licenses: YuNet and SFace
│                                  (faces), YAMNet (sound events) and its class map
├── start.cmd                       starts the server from .venv (no browser tab)
├── requirements.txt                base install (no PyTorch)
├── requirements-ai-framing.txt     optional: AI Framing / speaker diarization
├── requirements-claude.txt         optional: Find clips with Claude (Anthropic API)
├── requirements-youtube.txt        optional: YouTube account and upload
├── requirements-download.txt       optional: Add from YouTube (yt-dlp)
├── .env.example                    copy to .env for HF_TOKEN (AI Framing only)
└── workspace/                     ALL working files -- one place, so there's never
    │                                doubt about where a video goes (see workspace/README.md)
    ├── cache/                       SHARED by every profile: transcripts, audio cues, diarization
    │                                (created automatically); thumbs/ holds cached thumbnails
    ├── backups/                     migrate-<time>/ : the JSON backup of a migration
    ├── secrets/                     fallback client_secret.json for profiles that have none
    └── profiles/<id>/               one per channel (and _guest, with no schedule or secrets)
        ├── profile.json               name, colour, defaults (watermark, rubric, caption, hashtags)
        ├── sources/                   videos being worked on -- the app reads from here; credits.json
        ├── out/                       render output, one folder per project: <slug>.<id>/
        ├── projects/                  one <id>.json per project (its videos, Results, framing
        │   │                          points, caption corrections), and per project:
        │   ├── <id>/assets/             its images and sounds
        │   └── <id>/renders/            the last finished render of each Result, for
        │                                `render --replay` and `selftest --promote`
        ├── assets/                    library (logos, banners, templates), the Assets panel in
        │                              /workspace; a project imports copies from it
        ├── schedule/                  upload schedule (clips.json, clips.trash.json), the Clips panel
        └── secrets/                   this channel's client_secret.json and youtube.json (the token)
```

---

## Troubleshooting

**"Needs the backend. Run: python -m klipian serve"** — the UI was opened
without the server running. Run the command at the top of this file.

**"not in sources/"** (next to a video on Assets or on a project card, or in
an error when transcribing or rendering) — the server can't find that video
in this profile's sources folder. A project remembers a video by file name, so put the
file back there under the same name, or use **Add video…** on the Assets
screen to copy it in again. (The paste-a-link box on Analyze isn't wired up.)

**Add video… says "not enough disk space" or "a video must be … 10 GB"** —
the copy needs the video's size plus 1 GB free on the drive that holds
`workspace/`, and one file can be at most 10 GB. (A name that ends in a space or a dot before
the extension is tidied when saved, and the page says so.)

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
