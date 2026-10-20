# workspace/

Every working file klipian produces or reads -- not part of the source, and
deliberately gitignored (see `.gitignore`; only this README is tracked). These used to
be scattered across the repo root as `samples/`, `out/`, `cache/`, `projects/`,
`sources/` and `content/`; they were merged into this one folder so that everything
that is *work* lives in a single place.

Since profiles, the work of each channel lives in its own folder:

```
workspace/
  cache/                shared by every profile
  secrets/              fallback client_secret.json for profiles that have none
  backups/migrate-*/    the JSON backup a migration made before it moved anything
  profiles/
    <id>/               one profile = one channel (e.g. podcast)
      profile.json
      sources/  out/  projects/  assets/  schedule/  secrets/
    _guest/             the Guest: sources/ out/ projects/ assets/ only
```

The folders below are **per profile** (`profiles/<id>/...`) unless it says otherwise. The
**Open folder** buttons on `/workspace` open the folder of the profile you are in, and
show its full path when you hover them.

- `cache/` -- **shared by every profile.** Transcripts, audio-cue analysis, diarization
  results, probe data, thumbnails (`cache/thumbs/`) and quick previews
  (`cache/previews/`). Created automatically, safe to delete: anything needed is rebuilt
  on the next run. It is keyed by what is *in* the video, so the same video in two
  profiles is transcribed once.
- `profiles/<id>/profile.json` -- the profile's name, colour and defaults (watermark
  words, default rubric, caption look, hashtag placement). Edited in the chip's *Profile
  settings*.
- `sources/` -- **put the profile's source videos here.** A browser does not give the
  server a full path, so the backend looks a video up by filename in this folder (see
  `find_video()` in `klipian/paths.py`). A project's videos are added from here on the
  Assets screen; **Add video…** there copies a file in from anywhere on disk (an identical
  file already in another profile on the same drive becomes a hard link, and its source
  credit comes along if this profile has none), or you can copy it here yourself. The
  **Sources** panel at `/workspace` lists what is here and which projects use each video,
  and holds its credit (`credits.json` here: platform, creator, title and link per
  video). Only this folder is searched: a render in `out/` is never taken for a source.
- `out/` -- rendered output, one subfolder per project (`<slug>.<id>/`, the slug fixed when
  the project was created). This is what the editor's History screen and the Rendered
  output panel at `/workspace` both read. A render's file name is its post title (hyphens
  for spaces; YouTube reads them as spaces), with `-2`, `-3` when another Result of the
  project already has that name.
- `projects/` -- one `<id>.json` per project: its videos, Results, framing points,
  caption corrections. Next to it, per project, `<id>/assets/` (its images and sounds)
  and `<id>/renders/` (the last finished render of each Result, used by
  `klipian render --replay`). A deleted project's JSON is kept in `projects/.trash/` for
  Undo.
- `assets/` -- the profile's library: your own watermarks, logos, fonts and templates,
  beyond the ones klipian ships with. Listed as-is in the Assets panel at `/workspace`; a
  project's Assets screen imports copies from it.
- `schedule/clips.json` -- the upload-schedule tracker, one object per clip: status
  (Draft/Ready/Scheduled/Posted/Discarded), title and hook, platform, date and time, source
  episode, clip file, description, `hashtags`, TikTok caption, YouTube/TikTok links,
  `videoId` once uploaded, notes, and `createdAt` (never changes). Edited through the
  `/workspace` dashboard (Clips panel) rather than by hand -- see the Workspace section of
  the main README. A finished render adds a Draft row (linked to its project and Result by
  `projectId` and `resultId`) and re-rendering the same Result updates that row.
  `clips.trash.json` keeps deleted rows so Undo can bring them back; `clips.pre-created.json`
  is the one-time backup made when `createdAt` was introduced.
- `secrets/` (in the profile) -- this channel's `client_secret.json` (the OAuth client of its
  Google Cloud project), `youtube.json` (the token and the channel's name) and
  `youtube-usage.json` (today's upload count). **Never commit or share these**; klipian
  never sends them to the browser or writes them to a log.
- `workspace/secrets/client_secret.json` -- only a fallback, used by a profile that has no
  `client_secret.json` of its own.
- `_guest/` -- what the Guest made. It has no `schedule/` and no `secrets/`, and "Clear
  guest data" sends its contents to the Recycle Bin. The shared `cache/` is not touched.
- `backups/migrate-<time>/` -- written once, when a pre-profile workspace was moved into
  `profiles/podcast/`: a copy of every JSON file and a `manifest.json` with their SHA-256.
  Keep it until you are happy with the result.
- `schedule/content-calendar.xlsx` -- the tracker that predates `/workspace`, kept as an
  archive. klipian no longer reads it.
