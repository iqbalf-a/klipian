"""`python -m klipian selftest` -- the checks that let the code be moved
around without wondering what broke.

Five checks, each one that used to be done by hand:

  migrate  Old project shapes (tests/fixtures/migrate/*.old.json) go through
           projects._migrate_project() and must come out as the matching
           *.new.json.
  brief    The Claude brief and the reading of Claude's replies (roundtrip.py)
           against tests/fixtures/brief/: the output of the browser version
           of that logic, from before it moved to Python.
  cues     The rules in klipian/cues.py (levels, pauses, fast talk, which cues a
           clip has) on small known inputs.
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
what it produced, to tests/fixtures/NAME/.

    python -m klipian selftest                  all checks
    python -m klipian selftest --only migrate   just the fast one
    python -m klipian selftest --write-expected rewrite the *.new.json files
                                                from the current code (read
                                                the diff before committing)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures"

# A project id (lowercase hex) that no real project has.
SELFTEST_ID = "5e1f7e57"
SELFTEST_SLUG = "selftest"

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _diff(want, got, where: str = "") -> list[str]:
    """Human-readable differences between two JSON values."""
    if isinstance(want, dict) and isinstance(got, dict):
        out = []
        for k in sorted(set(want) | set(got)):
            if k not in got:
                out.append(f"{where}/{k}: missing (expected {json.dumps(want[k])[:80]})")
            elif k not in want:
                out.append(f"{where}/{k}: unexpected {json.dumps(got[k])[:80]}")
            else:
                out += _diff(want[k], got[k], f"{where}/{k}")
        return out
    if isinstance(want, list) and isinstance(got, list) and len(want) == len(got):
        out = []
        for i, (a, b) in enumerate(zip(want, got)):
            out += _diff(a, b, f"{where}[{i}]")
        return out
    return [] if want == got else [
        f"{where}: expected {json.dumps(want)[:80]}, got {json.dumps(got)[:80]}"]


# --------------------------------------------------------------------------
# check: migrate
# --------------------------------------------------------------------------

def _migrated(old_path: Path) -> dict:
    from . import projects
    data, _ = projects._migrate_project(_load(old_path))
    # A project with no id is given a random one; that is the one field that
    # can't be compared, so it is checked for being valid and then dropped.
    if "id" not in _load(old_path):
        assert projects._valid_project_id(data.get("id")), "no valid id was minted"
        del data["id"]
    return data


def check_migrate(write_expected: bool = False) -> tuple[str, str]:
    olds = sorted((FIXTURES / "migrate").glob("*.old.json"))
    if not olds:
        return FAIL, "no fixtures in tests/fixtures/migrate/"
    problems = []
    for old in olds:
        expected = old.with_name(old.name.replace(".old.", ".new."))
        try:
            got = _migrated(old)
        except Exception as exc:                   # noqa: BLE001
            problems.append(f"{old.name}: raised {type(exc).__name__}: {exc}")
            continue
        if write_expected:
            expected.write_text(json.dumps(got, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")
            continue
        if not expected.is_file():
            problems.append(f"{expected.name}: missing (run with --write-expected)")
            continue
        problems += [f"{old.name} {d}" for d in _diff(_load(expected), got)]
        # Migrating what is already current must change nothing.
        from . import projects
        # (`id` was dropped above when the fixture has none; give it back.)
        current = json.loads(json.dumps(got))
        current.setdefault("id", SELFTEST_ID)
        again, changed = projects._migrate_project(json.loads(json.dumps(current)))
        if changed or again != current:
            problems.append(f"{old.name}: migrating the result again changed it")
    if write_expected:
        return PASS, f"rewrote {len(olds)} expected file(s)"
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(olds)} old shapes -> current shape"


# --------------------------------------------------------------------------
# check: brief
# --------------------------------------------------------------------------

def check_brief() -> tuple[str, str]:
    from . import roundtrip
    from .models import Transcript

    base = FIXTURES / "brief"
    transcript = Transcript.load(base / "transcript.json")
    problems = []

    # Read as bytes so the comparison is on the bytes, not on what the
    # platform makes of line endings.
    want = (base / "brief.md").read_bytes().decode("utf-8")
    got = roundtrip.build_brief(
        transcript, roundtrip.read_rubric(base / "rubric.md"),
        "radityadika-podcast.mp4", _load(base / "cues.json"))
    if got != want:
        at = next((i for i, (a, b) in enumerate(zip(want, got)) if a != b),
                  min(len(want), len(got)))
        problems.append(f"brief.md differs at character {at}: "
                        f"expected {want[at:at + 40]!r}, got {got[at:at + 40]!r}")

    # The cues section is never left out: with nothing found, with the
    # detection not run, and with it failed, it still says so.
    for label, data, expect in [
            ("nothing found", {"status": {"audio": "ok", "timing": "ok"}, "cues": []},
             "No audio or timing cues were detected"),
            ("not run", None, "Audio analysis was not run"),
            ("failed", {"status": {"audio": "failed", "audio_error": "boom", "timing": "ok"}, "cues": []},
             "Audio analysis failed (boom)")]:
        text = roundtrip.build_brief(transcript, "", "x.mp4", data)
        if "## Audio & timing cues" not in text or expect not in text:
            problems.append(f"brief with cues {label}: expected the section to say {expect!r}")

    expected = _load(base / "imports.expected.json")
    for name, want in sorted(expected.items()):
        text = (base / "replies" / name).read_bytes().decode("utf-8")
        try:
            result = {"ok": True, "value": roundtrip.parse_reply(transcript.words, text)}
        except ValueError as exc:
            result = {"ok": False, "error": str(exc)}
        problems += [f"{name} {d}" for d in _diff(want, result)]

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"brief.md identical; {len(expected)} replies read as before"


# --------------------------------------------------------------------------
# check: cues
# --------------------------------------------------------------------------

def check_cues() -> tuple[str, str]:
    """The rules in cues.py, on small known inputs (no audio, no model)."""
    from . import cues
    from .models import Word

    problems = []
    for kind, peak, length, want in [
            ("laughter", 0.60, 0.9, "high"), ("laughter", 0.50, 2.5, "high"),
            ("laughter", 0.50, 1.0, "medium"), ("laughter", 0.45, 0.9, "medium"),
            ("laughter", 0.449, 0.9, "low"), ("laughter", 0.30, 0.9, "low"),
            ("laughter", 0.299, 0.9, None), ("applause", 0.61, 1.0, "high"),
            ("music", 0.50, 5.0, "avoid")]:
        got = cues.level_of(kind, peak, length)
        if got != want:
            problems.append(f"level_of({kind}, {peak}, {length}) = {got}, expected {want}")

    # Pauses and fast talk from word times: 30 s of 3 words per second, then a
    # 3.5 s silence, then a 10 s burst of 8 words per second.
    words, t = [], 0.0
    for i in range(90):
        words.append(Word(text=f"w{i}", start=t, end=t + 0.2, prob=1.0))
        t += 1 / 3
    t += 3.5
    for i in range(80):
        words.append(Word(text=f"f{i}", start=t, end=t + 0.1, prob=1.0))
        t += 1 / 8
    got = cues.timing_cues(words, t + 5)
    pauses = [c for c in got if c["kind"] == "pause"]
    fast = [c for c in got if c["kind"] == "fast talk"]
    if len(pauses) != 1 or pauses[0]["len"] < 3.4 or not pauses[0]["before"].startswith("f0 f1"):
        problems.append(f"pause cue wrong: {pauses}")
    if not fast or not (fast[0]["start"] >= 25 and fast[-1]["end"] <= t + 5):
        problems.append(f"fast talk cue wrong: {fast}")

    pool = [{"kind": "laughter", "start": 100.0, "end": 101.0, "level": "high"},
            {"kind": "pause", "start": 123.0, "end": 126.4, "len": 3.4, "before": "x"},
            {"kind": "laughter", "start": 140.0, "end": 141.0, "level": "low"}]
    inside = cues.for_range(pool, 90.0, 135.1)           # a clip's cues: overlapping, or starting <= 5 s after its end
    if [c["kind"] for c in inside] != ["laughter", "pause", "laughter"]:
        problems.append(f"for_range kept {inside}")
    if len(cues.for_range(pool, 90.0, 135.0)) != 2 or len(cues.for_range(pool, 90.0, 134.0)) != 2:
        problems.append("for_range tail of 5 s is off")
    if cues.counts(pool) != {"laughter": 2, "applause": 0, "shout": 0, "music": 0, "pause": 1, "fast talk": 0}:
        problems.append("counts() is off")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "levels, pauses, fast talk, per-clip cues"


# --------------------------------------------------------------------------
# check: decode
# --------------------------------------------------------------------------

def check_decode() -> tuple[str, str]:
    from .paths import WORKSPACE

    videos = sorted((p for p in (WORKSPACE / "samples").glob("*")
                     if p.suffix.lower() in {".mp4", ".mkv", ".mov", ".webm"}),
                    key=lambda p: p.stat().st_size) if (WORKSPACE / "samples").is_dir() else []
    if not videos:
        return SKIP, "no sample video in workspace/samples/"
    try:
        from faster_whisper.audio import decode_audio
        import av
    except ImportError as exc:
        return FAIL, f"faster-whisper is not installed in this Python ({exc})"

    from .ffmpeg_tools import _require, run
    tmp = Path(tempfile.mkdtemp(prefix="klipian-selftest-"))
    try:
        wav = tmp / "sample.wav"
        # A few seconds from the middle of the smallest sample, so it holds speech.
        run([_require("ffmpeg"), "-y", "-loglevel", "error", "-ss", "10", "-t", "5",
             "-i", str(videos[0]), "-vn", "-ac", "1", "-ar", "16000", str(wav)],
            desc="cutting a few seconds of audio", timeout=120)
        try:
            audio = decode_audio(str(wav), sampling_rate=16000)
        except Exception as exc:                       # noqa: BLE001
            return FAIL, (f"faster-whisper cannot decode audio here "
                          f"(PyAV {getattr(av, '__version__', '?')}): {exc}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if len(audio) < 16000:
        return FAIL, f"decoded only {len(audio) / 16000:.1f}s of 5s"
    return PASS, f"{len(audio) / 16000:.0f}s decoded from {videos[0].name} (PyAV {av.__version__})"


# --------------------------------------------------------------------------
# check: render
# --------------------------------------------------------------------------

def _baselines() -> list[Path]:
    return sorted(d for d in FIXTURES.iterdir()
                  if (d / "request.json").is_file() and (d / "baseline.json").is_file())


def _check_baseline(base: Path) -> tuple[str, str]:
    from . import jobs

    baseline = _load(base / "baseline.json")
    req = _load(base / "request.json")

    missing = jobs.missing_inputs(req)
    if missing:
        return SKIP, "not found here: " + ", ".join(missing)

    tmp = Path(tempfile.mkdtemp(prefix="klipian-selftest-"))
    try:
        started = time.time()
        outputs = jobs.render_request(req, tmp)
        took = time.time() - started
    except RuntimeError as exc:
        return FAIL, str(exc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if len(outputs) != 1:
        return FAIL, f"expected one file, got {len(outputs)}"
    got = outputs[0]
    if (got["md5"], got["sha256"], got["bytes"]) != (
            baseline["md5"], baseline["sha256"], baseline["bytes"]):
        return FAIL, (f"output differs from the baseline\n"
                      f"      expected {baseline['md5']} ({baseline['bytes']} bytes)\n"
                      f"      got      {got['md5']} ({got['bytes']} bytes)")
    return PASS, f"{got['md5'][:8]}... ({got['bytes']} bytes) in {took:.0f}s"


def check_render() -> tuple[str, str]:
    bases = _baselines()
    if not bases:
        return FAIL, "no baselines in tests/fixtures/*/ (request.json + baseline.json)"
    results = [(b.name, *_check_baseline(b)) for b in bases]
    statuses = {r[1] for r in results}
    status = (FAIL if FAIL in statuses else SKIP if statuses == {SKIP} else PASS)
    if len(results) == 1:
        return status, results[0][2]
    return status, "\n      ".join(f"{n:<14} {s}  {d}" for n, s, d in results)


def promote(project_id: str, result_id: str, name: str) -> int:
    """Turn the last render the server remembered for a Result into a baseline."""
    import re
    from .projects import read_render_records

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name):
        print(f"\n  NAME must be lowercase letters, digits and dashes, not {name!r}\n")
        return 1
    dest = FIXTURES / name
    if dest.exists():
        print(f"\n  {dest} already exists -- choose another NAME, or delete it first\n")
        return 1
    rec = read_render_records(project_id, result_id).get(result_id)
    if not rec:
        print(f"\n  No finished render is remembered for Result {result_id} of project "
              f"{project_id}.\n  Render it from the editor first.\n")
        return 1
    if len(rec["outputs"]) != 1:
        print(f"\n  That render made {len(rec['outputs'])} files; a baseline is one file.\n")
        return 1
    out = rec["outputs"][0]
    dest.mkdir(parents=True)
    (dest / "request.json").write_text(
        json.dumps(rec["request"], ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8", newline="\n")
    (dest / "baseline.json").write_text(json.dumps({
        "note": f"Result {result_id} of project {project_id}, rendered "
                f"{time.strftime('%Y-%m-%d', time.localtime(rec['at']))}; promoted with selftest --promote.",
        "md5": out["md5"], "sha256": out["sha256"], "bytes": out["bytes"],
    }, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"\n  {dest.relative_to(ROOT)}  <-  {out['file']} ({out['bytes']:,} bytes)")
    print("  It needs the same source video(s) and project assets on any machine that runs it.\n")
    return 0


CHECKS = {"migrate": check_migrate, "brief": check_brief, "cues": check_cues, "decode": check_decode,
          "render": check_render}


def run(only: list[str] | None = None, write_expected: bool = False) -> int:
    names = only or list(CHECKS)
    failed = False
    print()
    for name in names:
        print(f"  {name:<8} ", end="", flush=True)
        try:
            status, detail = (check_migrate(write_expected) if name == "migrate"
                              else CHECKS[name]())
        except Exception as exc:                   # noqa: BLE001
            status, detail = FAIL, f"raised {type(exc).__name__}: {exc}"
        print(f"{status}  {detail}")
        failed = failed or status == FAIL
    print()
    print("selftest FAILED" if failed else "selftest ok")
    print()
    return 1 if failed else 0


def add_parser(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("selftest", help="check migration, the Claude brief and the baseline renders")
    p.add_argument("--only", nargs="+", choices=sorted(CHECKS),
                   help="run just these checks")
    p.add_argument("--write-expected", action="store_true",
                   help="rewrite the migrate fixtures' *.new.json from the current code")
    p.add_argument("--promote", nargs=3, metavar=("PROJECT_ID", "RESULT_ID", "NAME"),
                   help="save the last render remembered for that Result as the baseline "
                        "tests/fixtures/NAME/")
    p.set_defaults(func=lambda a: promote(*a.promote) if a.promote
                   else run(a.only, a.write_expected))
