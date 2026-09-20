# workspace/

Every working file klipian produces or reads -- not part of the source, and
deliberately gitignored (see `.gitignore`). These used to be scattered across
the repo root as `samples/`, `out/`, `cache/`, `projects/`, `sources/` and
`content/`; they were merged into this one folder so that everything that is
*work* lives in a single place.

- `samples/` -- **put your source videos here.** A browser does not give the
  server a full path, so the backend looks a video up by filename in this
  folder (see `_find_video()` in `klipian/server.py`). Dropping a file into
  the browser only creates a local preview; it does not copy the file to the
  server. Copy the actual file here before transcription or rendering can
  run.
- `out/` -- rendered output, one subfolder per source video. This is what the
  editor's History screen and the Rendered files panel at `/workspace` both
  read. Quick previews live in a `.preview/` subfolder and are deliberately
  excluded from both.
- `cache/` -- transcripts, audio-energy analysis and diarization results.
  Created automatically, safe to delete: anything needed is rebuilt on the
  next run. Thumbnails are cached under `out/<video>/thumbs/` and are equally
  safe to delete.
- `projects/` -- per-video state: saved Results, framing points, caption
  corrections. One JSON file per video.
- `assets/` -- your own watermarks, fonts and templates, beyond the ones
  klipian ships with. Listed as-is in the Assets panel at `/workspace`.
- `schedule/clips.json` -- the upload-schedule tracker, one object per clip:
  status (Draft/Ready/Scheduled/Posted/Discarded), title and hook, platform,
  date and time, source episode, clip file, YouTube description and hashtags,
  TikTok caption, YouTube/TikTok links, notes. Edited through the
  `/workspace` dashboard (Clips panel) rather than by hand -- see the
  Workspace section of the main README.
- `schedule/content-calendar.xlsx` -- the tracker that predates `/workspace`,
  kept as an archive. klipian no longer reads it.
