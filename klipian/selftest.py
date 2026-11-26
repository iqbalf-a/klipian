"""`python -m klipian selftest` -- the checks that let the code be moved
around without wondering what broke.

Nine checks, each one that used to be done by hand:

  migrate  Old project shapes (tests/fixtures/migrate/*.old.json) go through
           projects._migrate_project() and must come out as the matching
           *.new.json.
  brief    The Claude brief and the reading of Claude's replies (roundtrip.py)
           against tests/fixtures/brief/: the output of the browser version
           of that logic, from before it moved to Python.
  coldopen The cold open in render.py (hook found, off by default, held frame, text, shifted captions)
  cues     The rules in klipian/cues.py (levels, pauses, fast talk, which cues a
           clip has) on small known inputs.
  credits  The credit line built from a video's platform, creator, title and link,
           joined without duplicates, dropped with its video, and named in the brief.
  fingerprint  The audio comparison behind the render baselines: accepts what another
           AAC encoder does to a sound, refuses quieter, shifted or missing sound.
  schedule A finished render makes one Draft row in the upload schedule for its
           Result, rendering it again updates that row, and what was typed in the
           row is kept.
  http     The server answers its own address and refuses another Host, a
           foreign Origin on a POST, and a JSON endpoint sent as anything but JSON.
  decode   faster-whisper can decode audio in THIS environment (a few seconds
           of a sample video). A broken install otherwise shows itself at the
           start of a transcription, minutes into the wait. Skipped without a
           sample video.
  render   Every baseline in tests/fixtures/<name>/ -- a request.json (what the
           editor sent) and a baseline.json (the md5, sha256 and size of the
           MP4 it produced). Each request goes through jobs._run_render(), the
           function the Render button reaches over HTTP, and the file must be
           byte-identical. The first baseline is res2 of project ea8b7a796f48.

A baseline needs what the request names: its source video, and the project's
images and sounds if it uses any. They stay local (they are not in the repo):
without them that baseline is SKIPPED, not failed. Files are written to a
temporary folder, never to out/.

Adding a baseline: render a Result in the editor, then

    python -m klipian selftest --promote PROJECT_ID RESULT_ID NAME

copies the request the server remembered for that Result, and the hashes of
what it produced, to tests/fixtures/NAME/. Then

    python -m klipian selftest --rebaseline NAME

adds the stream fingerprints (see fingerprint.py). A baseline is compared by its
bytes first; when only the toolchain changed (an ffmpeg upgrade), by its video
stream (exactly) and its audio (within a tolerance), and the result says so.
`--rebaseline` records the current render, and refuses when the video stream is
not the recorded one (`--force` for a picture that changed on purpose).

    python -m klipian selftest                  all checks
    python -m klipian selftest --fast           all but the slow checks (under a minute)
    python -m klipian selftest --only migrate   just the fast one
    python -m klipian selftest --write-expected rewrite the *.new.json files
                                                from the current code (read
                                                the diff before committing)
"""

from __future__ import annotations

import argparse
import time

from .checks_brief import (check_adminmodel, check_autopilot, check_autopilotresult, check_autopilotrun, check_brief, check_cliplength, check_geminibrief, check_migrate, check_settle)
from .checks_clips import (check_coldopen, check_credits, check_cues, check_decode, check_fingerprint, check_http, check_ranges, check_schedule)
from .checks_accounts import (check_bulk, check_hashtags, check_profiles, check_upload, check_youtube)
from .checks_downloads import (check_batch, check_captions, check_manual, check_refresh, check_renderreq, check_ytdl)
from .checks_claude import (check_claude, check_facelock, check_fallback, check_guide, check_labelbox, check_progress, check_resultpost, check_rubrics, check_sched, check_scratch, check_shotframe, check_timefield)
from .checks_motion import (check_briefagents, check_briefbuttons, check_briefsteps, check_datasafe, check_elevenlabs, check_khusus, check_motion, check_motion_brief, check_motionopts, check_motionstate, check_music, check_skill, check_voice, check_voicefit, check_voicegoogle, check_voiceparts, check_voicestudio)
from .selftest_base import FAIL
from .selftest_render import check_render, promote, rebaseline, scratch_workspace




# --------------------------------------------------------------------------
# a scratch workspace for every check
# --------------------------------------------------------------------------



CHECKS = {"cliplength": check_cliplength, "adminmodel": check_adminmodel, "autopilot": check_autopilot, "autopilotresult": check_autopilotresult, "autopilotrun": check_autopilotrun, "settle": check_settle, "briefagents": check_briefagents, "briefsteps": check_briefsteps, "migrate": check_migrate, "brief": check_brief, "geminibrief": check_geminibrief, "ranges": check_ranges, "cues": check_cues, "coldopen": check_coldopen, "credits": check_credits, "fingerprint": check_fingerprint, "schedule": check_schedule, "http": check_http, "profiles": check_profiles, "youtube": check_youtube, "upload": check_upload, "refresh": check_refresh, "manual": check_manual, "captions": check_captions, "renderreq": check_renderreq, "batch": check_batch, "claude": check_claude, "rubrics": check_rubrics, "guide": check_guide, "timefield": check_timefield, "resultpost": check_resultpost, "bulk": check_bulk, "hashtags": check_hashtags, "ytdl": check_ytdl, "sched": check_sched, "fallback": check_fallback, "progress": check_progress, "scratch": check_scratch, "labelbox": check_labelbox, "shotframe": check_shotframe, "facelock": check_facelock, "datasafe": check_datasafe,
          "motion": check_motion, "motionbrief": check_motion_brief, "voiceparts": check_voiceparts, "voicefit": check_voicefit, "motionopts": check_motionopts, "motionstate": check_motionstate, "skill": check_skill, "voicegoogle": check_voicegoogle, "voicestudio": check_voicestudio, "elevenlabs": check_elevenlabs, "khusus": check_khusus, "briefbuttons": check_briefbuttons, "music": check_music, "voice": check_voice, "decode": check_decode, "render": check_render}


def _guarded(name: str, fn):
    """A check writes projects, profiles and renders: called by hand (`selftest.CHECKS["motion"]()`) outside `run`, it would write into the REAL workspace (two profiles, mo1 and
    mo2, and their test projects once landed in a person's workspace that way). It refuses unless a scratch workspace is in force."""
    def checked(*a, **kw):
        from . import paths
        if paths._workspace_override is None:
            raise RuntimeError(f"the check {name!r} must run through selftest.run([{name!r}]) or `python -m klipian selftest --only {name}`: called by hand it would write into the real workspace")
        return fn(*a, **kw)
    checked.__name__ = getattr(fn, "__name__", name)
    checked.__doc__ = getattr(fn, "__doc__", None)
    return checked


CHECKS = {_name: _guarded(_name, _fn) for _name, _fn in CHECKS.items()}

# The checks that take 3 s or more (measured: the run prints a "slowest" line). `selftest --fast` skips them, which brings a full run from about 6 minutes to under a minute.
# Re-measure after adding a heavy check and move it here when it passes 3 s.
SLOW = {"motion", "voice", "voiceparts", "batch", "autopilotrun", "render", "bulk", "ranges", "upload", "motionbrief", "facelock", "briefagents", "voicefit", "profiles", "ytdl"}


def _real_profiles() -> list[str]:
    """What the real workspace holds in profiles/ (names, with the time each folder was last changed): a run must leave it as it found it."""
    from . import paths
    root = paths.DEFAULT_WORKSPACE / "profiles"
    return sorted(f"{d.name}@{int(d.stat().st_mtime)}" for d in root.iterdir()) if root.is_dir() else []


def _global_state() -> dict:
    """The shared state a check could leave behind: the profile and workspace in force, the scheduler's queues and
    limit, the seams that tests replace (Google, the clock, render and transcribe bodies) and the job registries."""
    from . import jobs, paths, sched, youtube
    return {
        "profile": paths.current_profile(),
        "workspace": str(paths.workspace_dir()),
        "sched": repr(sched.snapshot()),
        "render limit": sched.render_limit(),
        "youtube._net": id(youtube._net), "youtube._now": id(youtube._now), "youtube._sleep": id(youtube._sleep),
        "youtube._LOCAL_TZ": repr(youtube._LOCAL_TZ), "youtube._RATE_PAUSES": repr(youtube._RATE_PAUSES),
        "jobs._render_body": id(jobs._render_body), "jobs._transcribe_body": id(jobs._transcribe_body),
        "jobs._transcribe_needs_work": id(jobs._transcribe_needs_work),
        "jobs.ACTIVE_TRANSCRIBES": repr(sorted(jobs.ACTIVE_TRANSCRIBES.items())),
        "jobs.CANCELLED": repr(sorted(jobs.CANCELLED)),
    }


def _restore_global_state(before: dict) -> None:
    """After a leak was reported: put the scheduler back at least, so the next check starts clean."""
    from . import sched
    sched.reset_for_tests()
    try:
        sched.set_render_limit(before["render limit"])
    except (ValueError, OSError):
        pass


def run(only: list[str] | None = None, write_expected: bool = False, fast: bool = False) -> int:
    names = only or [n for n in CHECKS if not (fast and n in SLOW)]
    failed = False
    timings: dict[str, float] = {}
    before_profiles = _real_profiles()
    print()
    with scratch_workspace():
        for name in names:
            print(f"  {name:<8} ", end="", flush=True)
            before = _global_state()
            started = time.monotonic()
            try:
                status, detail = (check_migrate(write_expected) if name == "migrate"
                                  else CHECKS[name]())
            except Exception as exc:               # noqa: BLE001
                status, detail = FAIL, f"raised {type(exc).__name__}: {exc}"
            # A check must leave the process's shared state as it found it, or the next check inherits it.
            after = _global_state()
            leaked = sorted(k for k in before if before[k] != after[k])
            if leaked:
                status = FAIL
                detail += "\n      left global state changed: " + ", ".join(f"{k} ({before[k]!r} -> {after[k]!r})" for k in leaked)
                _restore_global_state(before)
            took = timings[name] = time.monotonic() - started
            print(f"{status}  {detail}" + (f"  [{took:.0f} s]" if took >= 5 else ""))
            failed = failed or status == FAIL
    after_profiles = _real_profiles()
    if after_profiles != before_profiles:
        # the scratch workspace sits inside workspace/ but not in profiles/: a change here is a leak into the real profiles
        changed = sorted(set(after_profiles) ^ set(before_profiles))
        print(f"  profiles FAIL  the real workspace's profiles/ changed during the run: {', '.join(changed)}")
        failed = True
    print()
    slow = ", ".join(f"{n} {t:.0f} s" for n, t in sorted(timings.items(), key=lambda kv: -kv[1]) if t >= 3)
    if slow:
        print(f"  slowest: {slow}")
    print("selftest FAILED" if failed else "selftest ok")
    print()
    return 1 if failed else 0


def add_parser(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("selftest", help="check migration, the Claude brief and the baseline renders")
    p.add_argument("--only", nargs="+", choices=sorted(CHECKS),
                   help="run just these checks")
    p.add_argument("--fast", action="store_true", help="skip the checks that take 3 s or more (see SLOW), a run of under a minute")
    p.add_argument("--write-expected", action="store_true",
                   help="rewrite the migrate fixtures' *.new.json from the current code")
    p.add_argument("--promote", nargs=3, metavar=("PROJECT_ID", "RESULT_ID", "NAME"),
                   help="save the last render remembered for that Result as the baseline "
                        "tests/fixtures/NAME/")
    p.add_argument("--rebaseline", nargs="*", metavar="NAME", default=None,
                   help="render the baselines (all, or the ones named) again and record "
                        "their hashes, ffmpeg version and stream fingerprints; refused when "
                        "the video stream differs from the recorded one")
    p.add_argument("--force", action="store_true",
                   help="with --rebaseline: record a video that changed on purpose")
    p.set_defaults(func=lambda a: promote(*a.promote) if a.promote
                   else rebaseline(a.rebaseline, a.force) if a.rebaseline is not None
                   else run(a.only, a.write_expected, a.fast))
