# workspace/

Every working file klipian produces or reads -- not part of the source, and
deliberately gitignored (see `.gitignore`). These used to be scattered across
the repo root as `samples/`, `out/`, `cache/`, `projects/`, `sources/` and
`content/`; they were merged into this one folder so that everything that is
*work* lives in a single place.

- `samples/` -- **put your source videos here.** A browser does not give the
  server a full path, so the backend looks a video up by filename in this
  folder (see `find_video()` in `klipian/paths.py`). A project's videos are
  added from here on the Assets screen; **Add video…** there copies a file
  in from anywhere on disk, or you can copy it here yourself.
- `out/` -- rendered output, one subfolder per project (`<slug>.<id>/`, the
  slug fixed when the project was created). This is what the
  editor's History screen and the Rendered files panel at `/workspace` both
  read. Quick previews live in a `.preview/` subfolder and are deliberately
  excluded from both.
- `cache/` -- transcripts, audio-cue analysis and diarization results.
  Created automatically, safe to delete: anything needed is rebuilt on the
  next run. Thumbnails are cached under `cache/thumbs/` and are equally safe
  to delete. (Older `out/<video>/thumbs/` folders are leftovers and can be
  deleted by hand.)
- `projects/` -- one `<id>.json` per project: its videos, Results, framing
  points, caption corrections. Next to it, per project, `<id>/assets/` (its
  images and sounds) and `<id>/renders/` (the last finished render of each
  Result, used by `klipian render --replay`). `legacy/` holds project files
  from before projects had ids, kept as they were.
- `assets/` -- a shared library: your own watermarks, logos, fonts and
  templates, beyond the ones klipian ships with. Listed as-is in the Assets
  panel at `/workspace`; a project's Assets screen imports copies from it.
- `schedule/clips.json` -- the upload-schedule tracker, one object per clip:
  status (Draft/Ready/Scheduled/Posted/Discarded), title and hook, platform,
  date and time, source episode, clip file, YouTube description and hashtags,
  TikTok caption, YouTube/TikTok links, notes. Edited through the
  `/workspace` dashboard (Clips panel) rather than by hand -- see the
  Workspace section of the main README.
- `schedule/content-calendar.xlsx` -- the tracker that predates `/workspace`,
  kept as an archive. klipian no longer reads it.
