"""`python -m klipian selftest` -- the checks that let the code be moved
around without wondering what broke.

Nine checks, each one that used to be done by hand:

  migrate  Old project shapes (tests/fixtures/migrate/*.old.json) go through
           projects._migrate_project() and must come out as the matching
           *.new.json.
  brief    The Claude brief and the reading of Claude's replies (roundtrip.py)
           against tests/fixtures/brief/: the output of the browser version
           of that logic, from before it moved to Python.
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
    python -m klipian selftest --only migrate   just the fast one
    python -m klipian selftest --write-expected rewrite the *.new.json files
                                                from the current code (read
                                                the diff before committing)
"""

from __future__ import annotations

import argparse
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

    # The real rubric asks for post text, and forbids a credit line of Claude's own.
    real = roundtrip.read_rubric(roundtrip.RUBRICS["dialog"])
    if "## Teks posting" not in real or "Jangan menulis baris kredit" not in real:
        problems.append("prompts/rubrik/dialog-podcast.md lost its 'Teks posting' section or the credit rule")
    if "## Sudut pandang" not in real or "Jangan mengulang kutipan" not in real:
        problems.append("prompts/rubrik/dialog-podcast.md lost its 'Sudut pandang' section")

    fixture_cues = _load(base / "cues.json")["cues"]
    expected = _load(base / "imports.expected.json")
    for name, want in sorted(expected.items()):
        text = (base / "replies" / name).read_bytes().decode("utf-8")
        try:
            result = {"ok": True, "value": roundtrip.parse_reply(transcript.words, text, fixture_cues)}
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
    # what `klipian cues --listen` picks: near a time (1 s either side), or the strongest N of a kind
    sound = [{"kind": "laughter", "start": 170.4, "end": 171.36, "peak": 0.38, "level": "low"},
             {"kind": "laughter", "start": 300.0, "end": 302.0, "peak": 0.80, "level": "high"},
             {"kind": "laughter", "start": 400.0, "end": 401.0, "peak": 0.55, "level": "high"},
             {"kind": "pause", "start": 500.0, "end": 504.0, "len": 4.0}]
    if [c["start"] for c in cues.select(sound, at=[170.0])] != [170.4] or cues.select(sound, at=[160.0]):
        problems.append("select(at=...) is off")
    if [c["start"] for c in cues.select(sound, kind="laughter", top=2)] != [300.0, 400.0]:
        problems.append("select(top=...) did not keep the strongest, in time order")
    if [c["start"] for c in cues.select(sound, level="high")] != [300.0, 400.0]:
        problems.append("select(level=...) is off")

    if cues.counts(pool) != {"laughter": 2, "applause": 0, "shout": 0, "music": 0, "pause": 1, "fast talk": 0}:
        problems.append("counts() is off")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "levels, pauses, fast talk, per-clip cues"


# --------------------------------------------------------------------------
# check: http
# --------------------------------------------------------------------------

def check_http() -> tuple[str, str]:
    """Who the server answers: its own pages yes; another Host, a foreign Origin,
    or a JSON endpoint called with another content type, no. Runs the real
    handler on a free port."""
    import http.client
    import threading
    from http.server import ThreadingHTTPServer
    from .server import Handler

    import contextlib
    import io
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    own = f"127.0.0.1:{port}"
    quiet = contextlib.redirect_stderr(io.StringIO())     # the handler logs each /api/ request
    quiet.__enter__()

    def call(method, path, headers=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        conn.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
        # every API call names its profile (a call without one is refused: see check_profiles)
        for k, v in {"Host": own, "X-Klipian-Profile": "selftest", **(headers or {})}.items():
            if v is not None:
                conn.putheader(k, v)
        if body is not None:
            conn.putheader("Content-Length", str(len(body)))
        conn.endheaders(body)
        status = conn.getresponse().status
        conn.close()
        return status

    js = {"Content-Type": "application/json"}
    cancel = b'{"id": "none"}'
    cases = [
        ("GET own host", call("GET", "/api/video"), 200),
        ("GET localhost", call("GET", "/api/video", {"Host": f"localhost:{port}"}), 200),
        ("GET foreign host", call("GET", "/api/video", {"Host": "evil.example"}), 403),
        ("GET rebound host, right port", call("GET", "/api/video", {"Host": f"evil.example:{port}"}), 403),
        ("POST json, no Origin (curl, CLI)", call("POST", "/api/render/cancel", js, cancel), 200),
        ("POST json, own Origin", call("POST", "/api/render/cancel", {**js, "Origin": f"http://{own}"}, cancel), 200),
        ("POST json, foreign Origin", call("POST", "/api/render/cancel", {**js, "Origin": "https://evil.example"}, cancel), 403),
        ("POST json, Origin null", call("POST", "/api/render/cancel", {**js, "Origin": "null"}, cancel), 403),
        ("POST text/plain", call("POST", "/api/render/cancel", {"Content-Type": "text/plain"}, cancel), 415),
        ("POST no content type", call("POST", "/api/render/cancel", None, cancel), 415),
        ("raw upload, foreign Origin", call("POST", "/api/video-upload?name=x.mp4",
                                            {"Content-Type": "application/octet-stream", "Origin": "https://evil.example"}, b"x"), 403),
        ("foreign Host on a raw upload", call("POST", "/api/project-asset-upload?id=0&name=x.png",
                                              {"Host": "evil.example", "Content-Type": "application/octet-stream"}, b"x"), 403),
    ]
    srv.shutdown()
    quiet.__exit__(None, None, None)
    bad = [f"{name}: {got}, expected {want}" for name, got, want in cases if got != want]
    if bad:
        return FAIL, "\n      ".join(bad)
    return PASS, f"{len(cases)} requests answered as they should"


# --------------------------------------------------------------------------
# check: credits
# --------------------------------------------------------------------------

def check_credits() -> tuple[str, str]:
    """The credit line and where it is kept: built from what was entered, joined
    without duplicates, dropped with its video, and named in the brief."""
    from . import credits, roundtrip
    from .models import Transcript

    problems = []
    full = {"platform": "YouTube", "creator": "Raditya Dika", "title": "Apa Kabar Syahrini",
            "url": "https://youtu.be/x"}
    for label, got, want in [
            ("line", credits.line(full),
             'Sumber: YouTube Raditya Dika — "Apa Kabar Syahrini" (https://youtu.be/x)'),
            ("short", credits.short(full), "Sumber: YouTube · Raditya Dika"),
            ("brief source", credits.brief_source(full), 'YouTube · Raditya Dika · "Apa Kabar Syahrini"'),
            ("title only", credits.line({"title": "T"}), 'Sumber: "T"'),
            ("nothing", credits.line({}), ""),
            ("link must be http(s)", credits.clean({"url": "javascript:alert(1)", "title": "T"}), {"title": "T"}),
            ("long names are cut", len(credits.clean({"creator": "x" * 500})["creator"]), 80)]:
        if got != want:
            problems.append(f"{label}: expected {want!r}, got {got!r}")

    tmp = Path(tempfile.mkdtemp(prefix="klipian-credits-"))
    try:
        for n in ("a.mp4", "b.mp4", "c.mp4"):
            (tmp / n).write_bytes(b"x")
        credits.save("a.mp4", full, tmp)
        credits.save("b.mp4", full, tmp)                         # same credit twice
        credits.save("c.mp4", {"platform": "TikTok", "creator": "Someone"}, tmp)
        both = credits.lines(["a.mp4", "b.mp4", "c.mp4"], tmp).split("\n")
        if len(both) != 2:
            problems.append(f"two videos with one credit and a third: expected 2 lines, got {both}")
        (tmp / "b.mp4").unlink()
        credits.save("c.mp4", {"platform": "TikTok", "creator": "Someone Else"}, tmp)
        if set(credits.load(tmp)) != {"a.mp4", "c.mp4"}:
            problems.append(f"a video that is gone keeps its credit: {sorted(credits.load(tmp))}")
        credits.save("a.mp4", {}, tmp)
        if "a.mp4" in credits.load(tmp):
            problems.append("an empty credit does not remove it")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # The brief names the source, and says the credit line is klipian's.
    base = FIXTURES / "brief"
    transcript = Transcript.load(base / "transcript.json")
    text = roundtrip.build_brief(transcript, "", "x.mp4", None, full)
    if '**Source:** YouTube · Raditya Dika · "Apa Kabar Syahrini"' not in text or "Do not write a credit" not in text:
        problems.append("the brief with a credit does not name the source and forbid a credit line")
    if "**Source:**" in roundtrip.build_brief(transcript, "", "x.mp4", None):
        problems.append("the brief names a source when there is none")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "credit line, dedupe, cleanup, brief source"


# --------------------------------------------------------------------------
# check: schedule
# --------------------------------------------------------------------------

def check_schedule() -> tuple[str, str]:
    """A finished render makes one Draft row for its Result, and rendering again
    updates that row without touching what was typed into it."""
    import threading
    from . import jobs, schedule

    problems = []
    tmp = Path(tempfile.mkdtemp(prefix="klipian-schedule-"))
    path = tmp / "schedule" / "clips.json"
    lock = threading.Lock()
    post = {"title": "Judul Unggahan", "caption": "Satu kalimat. Setuju?", "hashtags": ["#a", "#b"]}
    credit = 'Sumber: YouTube Raditya Dika — "T" (https://x)'
    try:
        row_id, created = schedule.upsert_render(
            project_id="p1", result_id="res1", title="file title", file_name="one.mp4",
            post=post, credit_lines=credit, path=path, lock=lock)
        rows = schedule.load_clips(path)
        first_created = rows[0].get("createdAt") if rows else None
        want = "Satu kalimat. Setuju?\n\n#a #b\n\n" + credit
        row = rows[0] if rows else {}
        if not created or len(rows) != 1 or row.get("status") != "Draft":
            problems.append(f"first render: expected one new Draft row, got {rows}")
        if row.get("title") != "Judul Unggahan" or row.get("description") != want                 or row.get("tiktokCaption") != want or row.get("file") != "one.mp4"                 or row.get("episode") != credit:
            problems.append(f"first render: the row's text is wrong: {row}")

        # Somebody edits the row on the dashboard (it keeps its links), then the
        # Result is rendered again with a different title, post and file.
        row["title"] = "Judul Saya"
        row["description"] = ""
        schedule.save_clips(rows, path)
        again, created2 = schedule.upsert_render(
            project_id="p1", result_id="res1", title="other", file_name="two.mp4",
            post={"title": "Baru", "caption": "Baru", "hashtags": ["#z"]}, credit_lines=credit,
            path=path, lock=lock)
        rows = schedule.load_clips(path)
        row = rows[0]
        if again != row_id or created2 or len(rows) != 1:
            problems.append("rendering the same Result again did not update its row")
        if row.get("file") != "two.mp4":
            problems.append("the file was not updated to the newest render")
        if not row.get("createdAt") or row.get("createdAt") != first_created:
            problems.append("a row's createdAt changed (or was missing) after rendering again")
        if row.get("title") != "Judul Saya":
            problems.append("a title typed on the dashboard was overwritten")
        if row.get("description") != "Baru\n\n#z\n\n" + credit:
            problems.append("an empty description was not filled")
        # Another Result is another row.
        schedule.upsert_render(project_id="p1", result_id="res2", title="t", file_name="x.mp4",
                               post=None, credit_lines="", path=path, lock=lock)
        if len(schedule.load_clips(path)) != 2:
            problems.append("a second Result did not get its own row")
        # Rows from before the column get one (once); a row that has one is not touched.
        old = schedule.load_clips(path)
        old[0].pop("createdAt", None)
        old[1]["createdAt"] = 123
        old[0]["at"] = 456
        schedule.save_clips(old, path)
        schedule.migrate_created(path, lock)
        migrated = schedule.load_clips(path)
        if migrated[0].get("createdAt") != 456 or migrated[1].get("createdAt") != 123:
            problems.append(f"createdAt migration is wrong: {[r.get('createdAt') for r in migrated]}")
        # Bulk Mark as Posted: one save, an existing date is kept, createdAt untouched.
        migrated[1]["date"] = "2026-01-05"
        migrated[1]["time"] = "09:30"
        schedule.save_clips(migrated, path)
        ids = [r["id"] for r in migrated]
        res = schedule.bulk_update(ids + ["nope"], "Posted", "2026-10-18", "14:00", path, lock)
        after = {r["id"]: r for r in schedule.load_clips(path)}
        a, b = after[ids[0]], after[ids[1]]
        if (a["status"], a.get("date"), a.get("time")) != ("Posted", "2026-10-18", "14:00")                 or (b["status"], b.get("date"), b.get("time")) != ("Posted", "2026-01-05", "09:30"):
            problems.append(f"bulk Mark as Posted is wrong: {a} / {b}")
        if (res["dated"], res["kept"], res["missing"]) != (1, 1, ["nope"]) or a.get("createdAt") != 456:
            problems.append(f"bulk result is wrong: {res}")
        # Delete keeps the row in the trash, and Undo puts it back exactly, in its place.
        before_rows = schedule.load_clips(path)
        gone = schedule.delete_rows([before_rows[0]["id"], "nope"], path, lock)
        if gone != [before_rows[0]["id"]] or len(schedule.load_clips(path)) != len(before_rows) - 1:
            problems.append(f"delete_rows is wrong: {gone}")
        back = schedule.restore_rows([before_rows[0]["id"]], path, lock)
        after_rows = schedule.load_clips(path)
        if back != [before_rows[0]] or after_rows != before_rows:
            problems.append("restore_rows did not bring the row back exactly as it was")
        if schedule.restore_rows([before_rows[0]["id"]], path, lock):
            problems.append("a row that is back already was restored twice")
        # A row whose render file is not in out/ is flagged on read, and the flag is never stored.
        flagged = schedule.with_missing_flags([{"id": "x", "projectId": "0123456789ab", "file": "gone.mp4"},
                                               {"id": "y", "file": "no-project.mp4"}])
        if not flagged[0].get("fileMissing") or "fileMissing" in flagged[1]:
            problems.append(f"fileMissing flags are wrong: {flagged}")
        first_id, was_new = schedule.add_file_row("Satu", "satu.mp4", None, path, lock)
        again_id, again_new = schedule.add_file_row("Satu", "satu.mp4", None, path, lock)
        if not was_new or again_new or first_id != again_id:
            problems.append("adding a render file to the schedule twice made two rows")
        try:
            schedule.bulk_update(ids, "Nonsense", path=path, lock=lock)
            problems.append("bulk update accepted a status that does not exist")
        except ValueError:
            pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # Replays and the selftest render with record off: they must not add rows.
    import inspect
    if "record=False" not in inspect.getsource(jobs.render_request):
        problems.append("render_request must run with record=False (no schedule rows from replays)")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "one Draft row per Result, updated in place, edits kept"


# --------------------------------------------------------------------------
# check: fingerprint
# --------------------------------------------------------------------------

def check_fingerprint() -> tuple[str, str]:
    """The audio comparison that lets a baseline survive an ffmpeg upgrade must
    accept what two AAC encoders do to the same sound (measured between ffmpeg 8.1
    and 9.0: at most 0.1 dB per 50 ms window) and refuse sound that is missing,
    shifted, shorter or quieter (a clip's volume bug is 6 dB)."""
    import math
    from .fingerprint import compare_audio

    n = 600                                           # 30 s of 50 ms windows
    levels = [-20.0 + 8.0 * math.sin(i / 7.0) if i % 50 < 40 else -80.0 for i in range(n)]
    base = {"window_ms": 50, "samples": n * 2400, "rms_db": levels}

    def made(rms=None, samples=None):
        return {"window_ms": 50, "samples": samples if samples is not None else base["samples"],
                "rms_db": rms if rms is not None else list(levels)}

    problems = []
    accept = [("same sound", made()),
              ("another AAC encoder (+-0.3 dB)", made([x + (0.3 if i % 2 else -0.3) for i, x in enumerate(levels)])),
              ("two AAC frames longer", made(samples=base["samples"] + 2048))]
    refuse = [("half the volume", made([x - 6.0 for x in levels])),
              ("shifted by a second", made(levels[20:] + [-80.0] * 20)),
              ("silent", made([-120.0] * n)),
              ("a second shorter", made(samples=base["samples"] - 48000)),
              ("a loud part gone", made([(-80.0 if 100 <= i < 140 else x) for i, x in enumerate(levels)]))]
    for label, got in accept:
        if compare_audio(base, got):
            problems.append(f"should be accepted but is not: {label}: {compare_audio(base, got)}")
    for label, got in refuse:
        if not compare_audio(base, got):
            problems.append(f"should be refused but is accepted: {label}")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "accepts encoder differences, refuses quieter, shifted, missing or shorter sound"


# --------------------------------------------------------------------------
# check: decode
# --------------------------------------------------------------------------

def check_decode() -> tuple[str, str]:
    from .paths import SOURCES

    videos = sorted((p for p in SOURCES.glob("*")
                     if p.suffix.lower() in {".mp4", ".mkv", ".mov", ".webm"}),
                    key=lambda p: p.stat().st_size) if SOURCES.is_dir() else []
    if not videos:
        return SKIP, "no source video in workspace/sources/"
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


def _render_baseline(base: Path, want_fingerprint: bool):
    """Render a baseline's request. Returns (output, fingerprint or None, seconds),
    or (None, None, reason) when it cannot be rendered here."""
    from . import jobs
    from .fingerprint import fingerprint

    req = _load(base / "request.json")
    missing = jobs.missing_inputs(req)
    if missing:
        return None, None, SKIP, "not found here: " + ", ".join(missing)
    tmp = Path(tempfile.mkdtemp(prefix="klipian-selftest-"))
    try:
        started = time.time()
        outputs = jobs.render_request(req, tmp)
        took = time.time() - started
        if len(outputs) != 1:
            return None, None, FAIL, f"expected one file, got {len(outputs)}"
        fp = fingerprint(tmp / outputs[0]["file"]) if want_fingerprint else None
    except RuntimeError as exc:
        return None, None, FAIL, str(exc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return outputs[0], fp, took, ""


def _check_baseline(base: Path) -> tuple[str, str]:
    from . import fingerprint as fpm

    baseline = _load(base / "baseline.json")
    # The streams are only looked at when the bytes differ: a render that is
    # byte-identical needs no more than that.
    got, fp, took, why = _render_baseline(base, want_fingerprint=True)
    if got is None:
        return took, why                        # (status, reason)
    same_bytes = (got["md5"], got["sha256"], got["bytes"]) == (
        baseline["md5"], baseline["sha256"], baseline["bytes"])
    if same_bytes:
        return PASS, f"{got['md5'][:8]}... ({got['bytes']} bytes) in {took:.0f}s"

    was = baseline.get("ffmpeg", "an ffmpeg that was not recorded")
    now = fp["ffmpeg"]
    differs = (f"output differs from the baseline\n"
               f"      expected {baseline['md5']} ({baseline['bytes']} bytes)\n"
               f"      got      {got['md5']} ({got['bytes']} bytes)\n"
               f"      baseline made with: {was}\n      now:                {now}")
    if "video_md5" not in baseline or "audio" not in baseline:
        return FAIL, (differs + "\n      this baseline has no stream fingerprint to compare "
                      "(run `selftest --rebaseline` after checking the render by eye)")
    if fp["video_md5"] != baseline["video_md5"]:
        return FAIL, (differs + f"\n      the VIDEO stream differs "
                      f"(packet md5 {baseline['video_md5']} expected, {fp['video_md5']} got)")
    problem = fpm.compare_audio(baseline["audio"], fp["audio"])
    if problem:
        return FAIL, differs + f"\n      video stream identical, but {problem}"
    return PASS, (f"toolchain changed ({was} -> {now}): video identical, audio within tolerance; "
                  f"run `selftest --rebaseline {base.name}` to record")


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


def rebaseline(names: list[str], force: bool = False) -> int:
    """Render the baselines again and rewrite their baseline.json (hashes,
    ffmpeg version, video md5, audio fingerprint). Allowed only when the VIDEO
    stream is the one the baseline already has: a toolchain upgrade changes the
    audio encoder and the container tags, not the picture. A baseline that has no
    video md5 yet is allowed (nothing to compare with: check the render by eye
    first). A picture that changed on purpose needs --force, and what changed is
    printed."""
    bases = _baselines()
    if names:
        unknown = [n for n in names if n not in {b.name for b in bases}]
        if unknown:
            print(f"\n  no such baseline: {', '.join(unknown)}  (have: {', '.join(b.name for b in bases)})\n")
            return 1
        bases = [b for b in bases if b.name in names]
    failed = False
    print()
    for base in bases:
        old = _load(base / "baseline.json")
        got, fp, took, why = _render_baseline(base, want_fingerprint=True)
        if got is None:
            print(f"  {base.name:<18} {took}  {why}")
            failed = failed or took == FAIL
            continue
        old_video = old.get("video_md5")
        if old_video and old_video != fp["video_md5"] and not force:
            print(f"  {base.name:<18} REFUSED  the video stream changed "
                  f"({old_video} -> {fp['video_md5']}); it is not a toolchain change. "
                  f"Use --force if the picture changed on purpose.")
            failed = True
            continue
        note = old.get("note", "")
        new = {"note": note, "md5": got["md5"], "sha256": got["sha256"], "bytes": got["bytes"],
               "ffmpeg": fp["ffmpeg"], "video_md5": fp["video_md5"], "audio": fp["audio"]}
        (base / "baseline.json").write_text(json.dumps(new, indent=1) + "\n", encoding="utf-8", newline="\n")
        changes = []
        if old.get("md5") != got["md5"]:
            changes.append(f"bytes {old.get('bytes')} -> {got['bytes']}")
        if old.get("ffmpeg") != fp["ffmpeg"]:
            changes.append(f"ffmpeg {old.get('ffmpeg', '(not recorded)')} -> {fp['ffmpeg']}")
        if old_video and old_video != fp["video_md5"]:
            changes.append(f"VIDEO changed on purpose ({old_video} -> {fp['video_md5']})")
        if not old_video:
            changes.append("stream fingerprint recorded for the first time")
        print(f"  {base.name:<18} recorded in {took:.0f}s: " + ("; ".join(changes) or "nothing changed"))
    print()
    return 1 if failed else 0


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



# --------------------------------------------------------------------------
# a scratch workspace for every check
# --------------------------------------------------------------------------

import contextlib


def _real_find(name: str) -> Path | None:
    """A source video on THIS machine, wherever the real workspace keeps it (in a
    profile's sources/, or straight under workspace/sources/ before profiles)."""
    from . import paths
    real = paths.DEFAULT_WORKSPACE
    for cand in [*real.glob("profiles/*/sources/" + name), real / "sources" / name]:
        if cand.is_file():
            return cand
    return None


def _real_project_assets(pid: str) -> Path | None:
    from . import paths
    real = paths.DEFAULT_WORKSPACE
    for cand in [*real.glob(f"profiles/*/projects/{pid}/assets"), real / "projects" / pid / "assets"]:
        if cand.is_dir():
            return cand
    return None


@contextlib.contextmanager
def scratch_workspace():
    """Run the checks in a throwaway workspace with one profile ("selftest"), never in
    the real one: nothing a check writes can reach a person's data, and the checks do
    not depend on whether the real workspace has been moved to profiles yet. The source
    videos and project assets the baselines need are LINKED in (same drive: a hardlink,
    no copy), else copied. The folder is inside workspace/ (ignored by git) for that."""
    import os
    from . import paths, profiles

    real = paths.DEFAULT_WORKSPACE
    real.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=".selftest-", dir=real))
    paths.use_workspace(tmp)
    token = paths.set_profile("selftest")
    profiles.write_meta("selftest", {"name": "selftest", "color": "#888888"})
    profiles.ensure_dirs("selftest")

    def bring(src: Path, dst: Path) -> None:
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(src, dst)
        except OSError:
            shutil.copy2(src, dst)

    try:
        for base in _baselines():
            req = _load(base / "request.json")
            names = {req.get("video")}
            for k in req.get("clips", []):
                names.update(p.get("video") for p in k.get("spans", []) if isinstance(p, dict))
            for n in sorted(x for x in names if x):
                src = _real_find(n)
                if src and not (paths.SOURCES / n).exists():
                    bring(src, paths.SOURCES / n)
            pid = req.get("project")
            assets = _real_project_assets(pid) if pid else None
            if assets:
                for f in assets.iterdir():
                    if f.is_file():
                        bring(f, paths.PROJECTS_DIR / pid / "assets" / f.name)
        yield tmp
    finally:
        paths._profile.reset(token)
        paths.use_workspace(None)
        shutil.rmtree(tmp, ignore_errors=True)


# --------------------------------------------------------------------------
# check: profiles
# --------------------------------------------------------------------------

def check_profiles() -> tuple[str, str]:
    """Two profiles never see each other's projects, schedule rows, renders, sources or
    assets; a request with no profile is refused; and a job started in one profile keeps
    writing to it after the tab has switched to another."""
    import http.client
    import threading
    import contextlib
    import io
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, schedule
    from .projects import PROJECTS, _write_project, _all_projects
    from .server import Handler

    problems = []
    for pid in ("alpha", "beta"):
        profiles.write_meta(pid, {"name": pid, "color": "#123456"})
        profiles.ensure_dirs(pid)

    # --- the file layer: what each profile holds
    pid_proj = "0123456789ab"
    tok = paths.set_profile("alpha")
    try:
        _write_project(PROJECTS / f"{pid_proj}.json", {"id": pid_proj, "name": "A", "assets": []})
        schedule.add_file_row("Satu", "satu.mp4", pid_proj)
        (paths.OUT_ROOT / f"a.{pid_proj}").mkdir(parents=True)
        (paths.OUT_ROOT / f"a.{pid_proj}" / "satu.mp4").write_bytes(b"x")
        (paths.ASSETS / "logo.png").write_bytes(b"x")
        (paths.SOURCES / "only-alpha.mp4").write_bytes(b"x")
    finally:
        paths._profile.reset(tok)
    tok = paths.set_profile("beta")
    try:
        seen = {"projects": len(_all_projects()), "rows": len(schedule.load_clips()),
                "renders": len(list(paths.OUT_ROOT.glob("*/*"))), "assets": len(list(paths.ASSETS.glob("*"))),
                "sources": len(list(paths.SOURCES.glob("*")))}
        if any(seen.values()):
            problems.append(f"beta can see alpha's data: {seen}")
        if paths.find_video("only-alpha.mp4"):
            problems.append("beta finds a source video that is alpha's")
    finally:
        paths._profile.reset(tok)
    tok = paths.set_profile("alpha")
    try:
        if len(_all_projects()) != 1 or len(schedule.load_clips()) != 1:
            problems.append("alpha lost its own data")
    finally:
        paths._profile.reset(tok)

    # --- over HTTP, with the real handler
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    quiet = contextlib.redirect_stderr(io.StringIO())
    quiet.__enter__()

    def call(method, path, profile=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=60)
        headers = {"Host": f"127.0.0.1:{port}"}
        if profile:
            headers["X-Klipian-Profile"] = profile
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=data, headers=headers)
        r = conn.getresponse()
        raw = r.read()
        conn.close()
        try:
            return r.status, json.loads(raw)
        except ValueError:
            return r.status, raw

    try:
        st, _ = call("GET", "/api/workspace/clips")
        if st != 400:
            problems.append(f"a call with no profile was answered {st}, not 400")
        st, _ = call("GET", "/api/workspace/clips", "nosuch")
        if st != 404:
            problems.append(f"a call for a profile that does not exist was answered {st}, not 404")
        st, a = call("GET", "/api/workspace/clips", "alpha")
        st2, b = call("GET", "/api/workspace/clips", "beta")
        if st != 200 or st2 != 200 or len(a["clip"]) != 1 or b["clip"]:
            problems.append(f"schedule over HTTP is not separate per profile: {a} / {b}")
        st, p = call("GET", "/api/projects", "beta")
        if st != 200 or p.get("project"):
            problems.append(f"beta lists alpha's projects over HTTP: {p}")
        if call("GET", "/workspace/sources/only-alpha.mp4?profile=alpha")[0] != 200 \
                or call("GET", "/workspace/sources/only-alpha.mp4?profile=beta")[0] != 404:
            problems.append("a source is served outside its own profile")
        if call("GET", "/workspace/sources/only-alpha.mp4")[0] != 400:
            problems.append("a media URL with no profile was not refused")
        if call("GET", "/api/profiles")[0] != 200 or call("GET", "/api/version")[0] != 200:
            problems.append("the profile list and the version check must need no profile")

        # --- the Guest edits and renders only: the server refuses the schedule and YouTube
        for path in ("/api/workspace/clips", "/api/workspace/clips/bulk", "/api/youtube/status"):
            method = "GET" if path.endswith(("clips", "status")) else "POST"
            if call(method, path, "_guest", {} if method == "POST" else None)[0] != 403:
                problems.append(f"the Guest was not refused at {path}")
        if call("GET", "/api/workspace/clips", "alpha")[0] != 200:
            problems.append("a normal profile lost the schedule endpoint")

        # --- creating and changing profiles; the profile's own watermark words
        st, made = call("POST", "/api/profiles/create", None, {"name": "Lucu", "color": "#4aa8ff"})
        if st != 200 or made["profile"]["id"] != "lucu":
            problems.append(f"creating a profile failed: {st} {made}")
        elif call("POST", "/api/profiles/create", None, {"name": "lucu"})[0] != 400:
            problems.append("a second profile with the same name was accepted")
        else:
            call("POST", "/api/profiles/update", None, {"id": "lucu", "defaults": {"watermark": "@lucu {x}", "rubric": "gameplay"}})
            tok = paths.set_profile("lucu")
            try:
                from . import jobs
                got = jobs.style_with_profile({"watermark": True})
                if got.get("watermark_text") != "@lucu  x":
                    problems.append(f"the profile's watermark words were not applied: {got}")
                if jobs.style_with_profile({"watermark_text": "mine"})["watermark_text"] != "mine":
                    problems.append("a style that names its own watermark text must keep it")
            finally:
                paths._profile.reset(tok)
        if call("POST", "/api/profiles/update", None, {"id": "_guest", "name": "x"})[0] != 400:
            problems.append("the Guest could be renamed")
        if call("POST", "/api/profiles/delete", None, {"id": "_guest"})[0] != 400:
            problems.append("the Guest could be deleted")

        # --- the same video in two profiles: one file on disk, two names (a hardlink)
        tok = paths.set_profile("alpha")
        try:
            (paths.SOURCES / "same.mp4").write_bytes(b"identical bytes " * 1000)
        finally:
            paths._profile.reset(tok)
        tok = paths.set_profile("beta")
        try:
            tmpf = paths.SOURCES / "same.mp4.part"
            tmpf.write_bytes(b"identical bytes " * 1000)
            how = profiles.place_source(tmpf, paths.SOURCES / "same.mp4")
            if how == "linked" and not (paths.SOURCES / "same.mp4").samefile(paths.profile_dir("alpha") / "sources" / "same.mp4"):
                problems.append("a linked source is not the other profile's file")
            if (paths.SOURCES / "same.mp4").read_bytes() != b"identical bytes " * 1000:
                problems.append("a source placed in a second profile has the wrong bytes")
            (paths.SOURCES / "same.mp4").unlink()                  # deleting one name...
        finally:
            paths._profile.reset(tok)
        if not (paths.profile_dir("alpha") / "sources" / "same.mp4").is_file():
            problems.append("deleting a source in one profile removed it from another")

        # --- a job keeps its profile when the tab switches
        src = paths.DEFAULT_WORKSPACE
        have = (paths.profile_dir("selftest") / "sources")
        video = next((p.name for p in have.glob("*.mp4")), None) if have.is_dir() else None
        if video:
            # the baselines' videos were staged into the "selftest" profile; give alpha one
            tok = paths.set_profile("alpha")
            try:
                try:
                    os_link = __import__("os").link
                    os_link(have / video, paths.SOURCES / video)
                except OSError:
                    shutil.copy2(have / video, paths.SOURCES / video)
            finally:
                paths._profile.reset(tok)
            clip = {"title": "Switch Test", "spans": [{"start": 1.0, "end": 2.5}], "width": 360, "quality": 35}
            st, j = call("POST", "/api/render", "alpha", {"video": video, "clips": [clip]})
            if st != 200:
                problems.append(f"could not start a render: {st} {j}")
            else:
                # "the tab switches to beta" while the job runs
                done = None
                t0 = time.time()
                while time.time() - t0 < 120:
                    call("GET", "/api/workspace/clips", "beta")
                    st, s = call("GET", f"/api/render/{j['id']}", "beta")
                    if s.get("state") in ("done", "failed", "cancelled"):
                        done = s
                        break
                    time.sleep(0.4)
                if not done or done.get("state") != "done":
                    problems.append(f"the render did not finish: {done and done.get('error')}")
                else:
                    in_alpha = list(paths.profile_dir("alpha").glob("out/*/Switch-Test.mp4"))
                    in_beta = list(paths.profile_dir("beta").glob("out/*/*.mp4"))
                    if not in_alpha or in_beta:
                        problems.append(f"the job wrote to the wrong profile: alpha {len(in_alpha)}, beta {len(in_beta)}")
                    if "profile=alpha" not in (done["result"][0].get("url") or ""):
                        problems.append(f"the render's URL does not name its profile: {done['result'][0].get('url')}")
    finally:
        srv.shutdown()
        quiet.__exit__(None, None, None)

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "projects, schedule, renders, sources and assets stay in their own profile; a job keeps its profile"


# --------------------------------------------------------------------------
# check: youtube (a profile's account; every call to Google is a fake here)
# --------------------------------------------------------------------------

def check_youtube() -> tuple[str, str]:
    """Connect, check and disconnect against a fake Google: the states (linked, expired,
    another channel, offline, no client), one channel per profile, the client_secret
    validation, and that no token ever reaches an answer meant for the browser. Nothing
    here can reach Google: the four network functions are replaced."""
    import http.client
    import threading
    import contextlib
    import io
    import os
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, recycle, youtube
    from .server import Handler

    SECRET = "SECRET-TOKEN-VALUE-0123456789"
    problems = []

    class FakeNet:
        channel = {"id": "UC111", "title": "Fake Channel", "thumb": ""}
        refresh_error = None
        flow_error = None
        revoked: list = []
        revoke_error = None

        @classmethod
        def flow(cls, client_file):
            if cls.flow_error:
                raise cls.flow_error
            return {"token": SECRET, "refresh_token": SECRET + "-R", "client_id": "x"}

        @classmethod
        def refresh(cls, token):
            if cls.refresh_error:
                raise cls.refresh_error
            return token

        @classmethod
        def channels(cls, token):
            return dict(cls.channel)

        @classmethod
        def revoke(cls, token):
            if cls.revoke_error:
                raise cls.revoke_error
            cls.revoked.append(token.get("refresh_token"))

    real_net, real_bin = youtube._net, recycle.to_recycle_bin
    youtube._net = FakeNet
    recycle.to_recycle_bin = lambda p: Path(p).unlink()       # no Recycle Bin from the selftest
    for pid in ("yt1", "yt2"):
        profiles.write_meta(pid, {"name": pid, "color": "#123456"})
        profiles.ensure_dirs(pid)

    good = json.dumps({"installed": {"client_id": "1.apps.googleusercontent.com", "client_secret": "FAKE", "project_id": "p"}})
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    quiet = contextlib.redirect_stderr(io.StringIO())
    quiet.__enter__()
    seen: list[str] = []                                       # everything sent to the browser

    def call(method, path, profile, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
        headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=data, headers=headers)
        r = conn.getresponse()
        raw = r.read().decode("utf-8", "replace")
        conn.close()
        seen.append(raw)
        try:
            return r.status, json.loads(raw)
        except ValueError:
            return r.status, {}

    def connect(profile):
        st, j = call("POST", "/api/youtube/connect", profile, {})
        if st != 200:
            return j
        for _ in range(100):
            st, s = call("GET", f"/api/youtube/connect-state?id={j['id']}", profile)
            if s.get("state") in ("done", "failed"):
                return s
            time.sleep(0.05)
        return {"state": "timeout"}

    try:
        # --- the client_secret.json is checked before it is kept
        for label, text in (("not JSON", "nope"), ("a web client", json.dumps({"web": {"client_id": "1.apps.googleusercontent.com"}})),
                            ("wrong client_id", json.dumps({"installed": {"client_id": "x", "client_secret": "s"}}))):
            st, j = call("POST", "/api/youtube/client", "yt1", {"text": text})
            if st != 400 or j.get("code") != "no_client":
                problems.append(f"a client_secret that is {label} was accepted ({st})")
        st, j = call("GET", "/api/youtube/status", "yt1")
        if j.get("state") != "no_client":
            problems.append(f"with no client the state should be no_client, is {j.get('state')}")
        if call("POST", "/api/youtube/connect", "yt1", {})[0] != 400:
            problems.append("connect with no client was not refused")
        st, j = call("POST", "/api/youtube/client", "yt1", {"text": good})
        if st != 200 or j.get("state") != "none" or "FAKE" in json.dumps(j):
            problems.append(f"saving a good client_secret failed or echoed it: {st} {j}")
        if not (paths.profile_dir("yt1") / "secrets" / "client_secret.json").is_file():
            problems.append("client_secret.json was not kept in the profile's secrets/")

        # --- the client's own state, judged locally: valid (profile), shared fallback, missing, invalid
        own = paths.profile_dir("yt1") / "secrets" / "client_secret.json"
        shared = paths.workspace_dir() / "secrets" / "client_secret.json"
        st, j = call("GET", "/api/youtube/status", "yt1")
        cl = j.get("client", {})
        if cl.get("state") != "valid" or cl.get("source") != "profile" or cl.get("projectId") != "p" or j.get("light") != "grey":
            problems.append(f"a valid client from the profile should say so (and the light stays grey until linked): {j}")
        keep = own.read_bytes()
        own.unlink()
        if call("GET", "/api/youtube/status", "yt1")[1]["client"]["state"] != "missing":
            problems.append("no client anywhere should be missing")
        shared.parent.mkdir(parents=True, exist_ok=True)
        shared.write_bytes(keep)
        cl = call("GET", "/api/youtube/status", "yt1")[1]["client"]
        if cl["state"] != "valid" or cl["source"] != "shared":
            problems.append(f"the shared fallback should be valid with source shared: {cl}")
        shared.unlink()
        own.write_text("{\"installed\": {\"client_id\": \"nope\", \"client_secret\": \"HIDDEN-CLIENT-SECRET\"}}", encoding="utf-8")
        st, j = call("GET", "/api/youtube/status", "yt1")
        if j["client"]["state"] != "invalid" or j["light"] != "red" or "HIDDEN" in json.dumps(j) or not j["client"]["reason"]:
            problems.append(f"an invalid client should be red with a reason and no content: {j}")
        own.write_text("not json", encoding="utf-8")
        if call("GET", "/api/youtube/status", "yt1")[1]["client"]["state"] != "invalid":
            problems.append("a client that is not JSON should be invalid")
        own.write_bytes(keep)

        # --- connect: linked, with the channel's label and no token
        s = connect("yt1")
        if s.get("state") != "done" or s["status"]["state"] != "ok" or s["status"]["channel"]["title"] != "Fake Channel":
            problems.append(f"connecting did not link the channel: {s}")
        elif s["status"].get("light") != "green":
            problems.append(f"linked with a valid client should be green: {s['status']}")
        # the client goes bad AFTER connecting: the light must not stay green
        own.write_text("garbage", encoding="utf-8")
        if call("GET", "/api/youtube/status", "yt1")[1].get("light") != "red":
            problems.append("a client that became invalid left the light green")
        own.write_bytes(keep)
        tf = paths.profile_dir("yt1") / "secrets" / "youtube.json"
        if not tf.is_file() or SECRET not in tf.read_text(encoding="utf-8"):
            problems.append("the token was not kept in the profile's secrets/youtube.json")

        # --- one channel for one profile
        call("POST", "/api/youtube/client", "yt2", {"text": good})
        s2 = connect("yt2")
        if s2.get("state") != "failed" or "already used" not in s2.get("message", ""):
            problems.append(f"a second profile took the same channel: {s2}")
        if (paths.profile_dir("yt2") / "secrets" / "youtube.json").is_file():
            problems.append("a refused channel left a token behind")

        # --- the states of a check
        st, j = call("POST", "/api/youtube/check", "yt1", {})
        if j.get("state") != "ok" or not j.get("checkedAt"):
            problems.append(f"check should be ok: {j}")
        FakeNet.refresh_error = youtube.YouTubeError("expired", "expired")
        st, j = call("POST", "/api/youtube/check", "yt1", {})
        if j.get("state") != "expired" or call("GET", "/api/youtube/status", "yt1")[1].get("state") != "expired":
            problems.append(f"invalid_grant should give expired, remembered: {j}")
        FakeNet.refresh_error = youtube.YouTubeError("offline", "offline")
        st, j = call("POST", "/api/youtube/check", "yt1", {})
        if j.get("state") != "expired" or not j.get("offline"):
            problems.append(f"offline must keep the last state and say so: {j}")
        FakeNet.refresh_error = None
        FakeNet.channel = {"id": "UC999", "title": "Other Channel", "thumb": ""}
        st, j = call("POST", "/api/youtube/check", "yt1", {})
        if j.get("state") != "different":
            problems.append(f"a token for another channel should give different: {j}")
        FakeNet.channel = {"id": "UC111", "title": "Fake Channel", "thumb": ""}
        FakeNet.flow_error = youtube.YouTubeError("not_test_user", "add the test user")
        s3 = connect("yt1")
        if s3.get("code") != "not_test_user":
            problems.append(f"access_denied should be explained as not_test_user: {s3}")
        FakeNet.flow_error = None
        os.replace(paths.profile_dir("yt1") / "secrets" / "client_secret.json",
                   paths.profile_dir("yt1") / "secrets" / "client_secret.hold")
        if call("POST", "/api/youtube/check", "yt1", {})[1].get("state") != "no_client":
            problems.append("a missing client_secret.json should give no_client")
        os.replace(paths.profile_dir("yt1") / "secrets" / "client_secret.hold",
                   paths.profile_dir("yt1") / "secrets" / "client_secret.json")

        # --- disconnect: revoked, token gone; offline: still gone, and it says so
        st, j = call("POST", "/api/youtube/disconnect", "yt1", {})
        if j.get("state") != "none" or tf.is_file() or FakeNet.revoked != [SECRET + "-R"]:
            problems.append(f"disconnect should revoke and drop the token: {j} {FakeNet.revoked}")
        connect("yt1")
        FakeNet.revoke_error = OSError("down")
        st, j = call("POST", "/api/youtube/disconnect", "yt1", {})
        if tf.is_file() or "could not be reached" not in j.get("message", ""):
            problems.append(f"an offline disconnect must still drop the token and say so: {j}")
        FakeNet.revoke_error = None

        # --- the Guest has no account
        if call("GET", "/api/youtube/status", "_guest")[0] != 403:
            problems.append("the Guest was not refused at /api/youtube/status")

        # --- nothing sent to the browser carries a token or the client secret
        leaked = [x for x in seen if SECRET in x or "FAKE" in x or "refresh_token" in x
                  or "1.apps.googleusercontent.com" in x or "HIDDEN-CLIENT-SECRET" in x or '"client_secret"' in x]
        if leaked:
            problems.append("a token or secret reached an answer meant for the browser")
    finally:
        srv.shutdown()
        quiet.__exit__(None, None, None)
        youtube._net, recycle.to_recycle_bin = real_net, real_bin

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "client check, connect, one channel per profile, expired/different/offline/no_client/test-user, disconnect; no token reaches the browser"


# --------------------------------------------------------------------------
# check: upload (one schedule row to YouTube; Google is a fake)
# --------------------------------------------------------------------------

def check_upload() -> tuple[str, str]:
    """What an upload checks before it starts, what it does to the row, and every way it can
    fail: not connected, title/file/video problems, a time in the past, a second upload,
    quota, a lost connection, cancel, and a project that is not audited. Google is a fake."""
    import datetime as dt
    from . import paths, profiles, recycle, schedule, youtube
    from .ffmpeg_tools import _require, run

    problems = []
    uploads: list = []

    class FakeNet:
        refresh_error = None
        upload_error = None
        slow = False
        status = {"privacy": "private", "upload": "processed", "publishAt": "2031-01-01T00:00:00Z"}

        @classmethod
        def refresh(cls, token):
            if cls.refresh_error:
                raise cls.refresh_error
            return token

        @classmethod
        def channels(cls, token):
            return {"id": "UCup", "title": "Up Channel", "thumb": ""}

        @classmethod
        def upload(cls, token, file, body, progress, cancelled):
            uploads.append((file.name, body))
            if cls.upload_error:
                raise cls.upload_error
            for i in range(1, 5):
                if cancelled():
                    raise youtube.YouTubeError("cancelled", "The upload was cancelled.")
                progress(i / 4)
                if cls.slow:
                    time.sleep(0.15)
            return {"id": "VID" + str(len(uploads))}

        @classmethod
        def video_status(cls, token, video_id):
            return dict(cls.status)

        @classmethod
        def revoke(cls, token):
            pass

    real_net, real_bin = youtube._net, recycle.to_recycle_bin
    youtube._net = FakeNet
    recycle.to_recycle_bin = lambda p: Path(p).unlink()
    profiles.write_meta("up1", {"name": "up1", "color": "#123456"})
    profiles.ensure_dirs("up1")
    tok = paths.set_profile("up1")
    try:
        pid = "0a1b2c3d4e5f"
        folder = paths.OUT_ROOT / f"clips.{pid}"
        folder.mkdir(parents=True)
        ff = _require("ffmpeg")
        vertical, wide = folder / "vertical.mp4", folder / "wide.mp4"
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=108x192:d=1:r=10", "-pix_fmt", "yuv420p", str(vertical)], desc="a vertical test clip", timeout=60)
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=192x108:d=1:r=10", "-pix_fmt", "yuv420p", str(wide)], desc="a wide test clip", timeout=60)
        future = (dt.datetime.now() + dt.timedelta(days=3)).strftime("%Y-%m-%d")
        past = (dt.datetime.now() - dt.timedelta(days=1)).strftime("%Y-%m-%d")

        made = [0]

        def row(**kw):
            file = kw.pop("file", None)
            if file is None:                         # one render file per row (a file has one row)
                made[0] += 1
                file = f"clip{made[0]}.mp4"
                shutil.copy2(vertical, folder / file)
            rid, _ = schedule.add_file_row(kw.pop("title", "Judul Satu"), file, pid)
            fields = {"description": "Satu kalimat. #podcast #lucu #podcast", "date": future, "time": "18:30", "status": "Ready", **kw}
            schedule.set_fields(rid, fields)
            return rid

        def refused(rid, why, publish_now=False):
            try:
                youtube.start_upload(rid, publish_now)
            except youtube.YouTubeError as exc:
                return why in exc.message or why == exc.code
            return False

        # --- not connected
        r0 = row(title="Not Connected")
        if not refused(r0, "none") and not refused(r0, "not connected"):
            try:
                youtube.start_upload(r0)
                problems.append("an upload started with no YouTube account")
            except youtube.YouTubeError:
                pass
        # connect (fake)
        good = {"installed": {"client_id": "1.apps.googleusercontent.com", "client_secret": "s"}}
        youtube.save_client_secret(json.dumps(good))
        saved = {"token": {"token": "T", "refresh_token": "R"}, "channel": {"id": "UCup", "title": "Up Channel", "thumb": ""}}
        youtube._write_token_file({**saved, "state": "ok", "checkedAt": 1})

        # --- what is checked before anything is sent
        cases = [
            ("no title", row(title=" "), "has no title"),
            ("a title over 100", row(title="x" * 101), "101 characters"),
            ("a deleted file", row(file="gone.mp4"), "file deleted"),
            ("a wide video", row(file="wide.mp4"), "not vertical"),
            ("a date but no time", row(time=""), "both"),
            ("a time in the past", row(date=past), "already passed"),
            ("no date and no time", row(date="", time=""), "no upload date"),
        ]
        for label, rid, why in cases:
            if not refused(rid, why):
                problems.append(f"{label} was not refused with '{why}'")

        # --- a scheduled upload: the row follows, the body is right
        rid = row(title="Scheduled Clip")
        jid = youtube.start_upload(rid)
        for _ in range(100):
            st = youtube.upload_state(jid)
            if st["state"] in ("done", "failed", "cancelled"):
                break
            time.sleep(0.05)
        after = schedule.get_row(rid)
        body = uploads[-1][1]
        if st["state"] != "done" or after.get("status") != "Scheduled" or after.get("videoId") != st.get("videoId") \
                or "youtube.com/shorts/" not in (after.get("youtubeUrl") or "") or "YouTube" not in after.get("platform", ""):
            problems.append(f"a scheduled upload did not update its row: {st} {after}")
        if body["status"]["privacyStatus"] != "private" or "publishAt" not in body["status"] \
                or body["status"]["selfDeclaredMadeForKids"] is not False or body["snippet"]["tags"] != ["podcast", "lucu"]:
            problems.append(f"the upload body is wrong: {body}")
        else:
            utc = dt.datetime.strptime(body["status"]["publishAt"], "%Y-%m-%dT%H:%M:%S.000Z").replace(tzinfo=dt.timezone.utc)
            local = dt.datetime.strptime(f"{future} 18:30", "%Y-%m-%d %H:%M").astimezone()
            if utc != local.astimezone(dt.timezone.utc):
                problems.append("publishAt is not the row's local date and time in UTC")
        # the project is not audited: YouTube ignores the schedule and keeps the video private
        FakeNet.status = {"privacy": "private", "upload": "processed", "publishAt": None}
        rl = row(title="Locked Clip")
        jl = youtube.start_upload(rl)
        for _ in range(100):
            sl = youtube.upload_state(jl)
            if sl["state"] != "uploading":
                break
            time.sleep(0.05)
        if sl.get("state") != "done" or "audit" not in (sl.get("warning") or ""):
            problems.append(f"a locked-private upload was not explained: {sl}")
        FakeNet.status = {"privacy": "private", "upload": "processed", "publishAt": "2031-01-01T00:00:00Z"}

        # --- never twice
        if not refused(rid, "already"):
            problems.append("a clip that has a videoId could be uploaded again")
        FakeNet.slow = True
        r2 = row(title="Busy Clip")
        j2 = youtube.start_upload(r2)
        if not refused(r2, "being uploaded"):
            problems.append("a second upload of a clip that is uploading was not refused")
        youtube.cancel_upload(j2)
        for _ in range(100):
            s2 = youtube.upload_state(j2)
            if s2["state"] != "uploading":
                break
            time.sleep(0.05)
        FakeNet.slow = False
        if s2["state"] != "cancelled" or schedule.get_row(r2).get("videoId"):
            problems.append(f"cancel did not stop the upload cleanly: {s2}")

        # --- every way it can fail leaves the row alone and says why
        def fails(error, code):
            FakeNet.upload_error = error
            r = row(title=f"Fail {code}")
            j = youtube.start_upload(r)
            for _ in range(100):
                s = youtube.upload_state(j)
                if s["state"] != "uploading":
                    break
                time.sleep(0.05)
            FakeNet.upload_error = None
            if s["state"] != "failed" or s.get("code") != code or schedule.get_row(r).get("videoId"):
                problems.append(f"{code}: {s}")
        fails(youtube.map_http_error(403, "quotaExceeded"), "quota")
        fails(youtube.YouTubeError("offline", "down"), "offline")
        fails(youtube.map_http_error(401, ""), "expired")
        if youtube.map_http_error(403, "forbidden").code != "forbidden" or youtube.map_http_error(400, "x").code != "bad_request":
            problems.append("map_http_error gave the wrong code for 403/400")
        FakeNet.refresh_error = youtube.YouTubeError("expired", "expired")
        if not refused(row(title="Expired Token"), "expired"):
            problems.append("an upload started with an expired token")
        FakeNet.refresh_error = None

        # --- publish now (no date): only when asked for
        rn = row(title="Now Clip", date="", time="")
        jn = youtube.start_upload(rn, publish_now=True)
        for _ in range(100):
            sn = youtube.upload_state(jn)
            if sn["state"] != "uploading":
                break
            time.sleep(0.05)
        if sn["state"] != "done" or "publishAt" in uploads[-1][1]["status"] or uploads[-1][1]["status"]["privacyStatus"] != "public" \
                or schedule.get_row(rn).get("status") != "Posted":
            problems.append(f"publishing now did not give a public video and a Posted row: {sn}")

        # --- Check status brings a scheduled row up to date
        FakeNet.status = {"privacy": "public", "upload": "processed", "publishAt": None}
        out = youtube.video_status(rid)
        if schedule.get_row(rid).get("status") != "Posted" or "Public" not in out["text"]:
            problems.append(f"Check status did not mark a now-public video Posted: {out}")
    except Exception as exc:                           # noqa: BLE001
        problems.append(f"raised {type(exc).__name__}: {exc}")
    finally:
        paths._profile.reset(tok)
        youtube._net, recycle.to_recycle_bin = real_net, real_bin

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(uploads)} fake uploads: checks, schedule/publish-now, row update, no double upload, quota/offline/expired/cancel"


# --------------------------------------------------------------------------
# check: bulk upload (a queue of schedule rows; Google is a fake)
# --------------------------------------------------------------------------

def check_bulk() -> tuple[str, str]:
    """The plan (what is refused and why, today's quota), a queue that goes file by file, stops
    cleanly on a quota error and leaves the rest alone, a cancel that waits for the file being
    sent, and the local daily counter. Google is a fake."""
    import datetime as dt
    from . import paths, profiles, recycle, schedule, youtube
    from .ffmpeg_tools import _require, run

    problems = []
    order: list[str] = []

    class FakeNet:
        refresh_error = None
        fail_on = None                  # title that gets a quota error
        slow = False

        @classmethod
        def refresh(cls, token):
            return token

        @classmethod
        def channels(cls, token):
            return {"id": "UCbulk", "title": "Bulk Channel", "thumb": ""}

        @classmethod
        def upload(cls, token, file, body, progress, cancelled):
            title = body["snippet"]["title"]
            order.append(title)
            if title == cls.fail_on:
                raise youtube.map_http_error(403, "quotaExceeded")
            for i in range(1, 4):
                progress(i / 3)
                if cls.slow:
                    time.sleep(0.2)
            return {"id": "B" + str(len(order))}

        @classmethod
        def video_status(cls, token, video_id):
            return {"privacy": "private", "upload": "processed", "publishAt": "2031-01-01T00:00:00Z"}

        @classmethod
        def revoke(cls, token):
            pass

    real_net, real_bin = youtube._net, recycle.to_recycle_bin
    youtube._net = FakeNet
    recycle.to_recycle_bin = lambda p: Path(p).unlink()
    profiles.write_meta("bk1", {"name": "bk1", "color": "#123456"})
    profiles.ensure_dirs("bk1")
    tok = paths.set_profile("bk1")
    try:
        pid = "1a2b3c4d5e6f"
        folder = paths.OUT_ROOT / f"clips.{pid}"
        folder.mkdir(parents=True)
        vertical = folder / "base.mp4"
        run([_require("ffmpeg"), "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=108x192:d=1:r=10",
             "-pix_fmt", "yuv420p", str(vertical)], desc="a vertical test clip", timeout=60)
        youtube.save_client_secret(json.dumps({"installed": {"client_id": "1.apps.googleusercontent.com", "client_secret": "s"}}))
        youtube._write_token_file({"token": {"token": "T", "refresh_token": "R"},
                                   "channel": {"id": "UCbulk", "title": "Bulk Channel", "thumb": ""}, "state": "ok", "checkedAt": 1})
        future = (dt.datetime.now() + dt.timedelta(days=2)).strftime("%Y-%m-%d")
        n = [0]

        def row(title="Judul", **kw):
            n[0] += 1
            file = kw.pop("file", f"b{n[0]}.mp4")
            if file.startswith("b"):
                shutil.copy2(vertical, folder / file)
            rid, _ = schedule.add_file_row(title, file, pid)
            schedule.set_fields(rid, {"date": future, "time": f"{9 + n[0] % 10:02d}:00", "status": "Ready", **kw})
            return rid

        def wait(jid, fn, until=("done", "stopped", "cancelled")):
            for _ in range(200):
                st = fn(jid)
                if st["state"] in until:
                    return st
                time.sleep(0.05)
            return st

        # --- the plan
        good1, good2, good3 = row("Satu"), row("Dua"), row("Tiga")
        no_date = row("Tanpa Tanggal", date="", time="")
        no_title = row(" ")
        long_title = row("x" * 101)
        gone = row("File Hilang", file="gone.mp4")
        plan = youtube.bulk_plan([good1, good2, good3, no_date, no_title, long_title, gone])
        refused = {r["id"]: r["message"] for r in plan["refused"]}
        if [r["id"] for r in plan["ok"]] != [good1, good2, good3]:
            problems.append(f"the plan accepted the wrong rows: {[r['id'] for r in plan['ok']]}")
        for rid, why in ((no_date, "no upload date"), (no_title, "no title"), (long_title, "101"), (gone, "file deleted")):
            if why not in refused.get(rid, ""):
                problems.append(f"the plan did not refuse '{why}': {refused.get(rid)}")
        if plan["usedToday"] != 0 or plan["remaining"] != 100 or plan["overQuota"] != 0:
            problems.append(f"the quota in the plan is wrong: {plan}")

        # --- a queue goes one by one, rows follow
        jid = youtube.start_bulk([good1, good2, good3, no_date])
        st = wait(jid, youtube.bulk_state)
        if st["state"] != "done" or [r["state"] for r in st["rows"]] != ["done"] * 3 or order != ["Satu", "Dua", "Tiga"]:
            problems.append(f"the queue did not send the three rows in order: {st} {order}")
        for rid in (good1, good2, good3):
            r = schedule.get_row(rid)
            if r.get("status") != "Scheduled" or not r.get("videoId"):
                problems.append(f"a row was not updated after its upload: {r}")
        if youtube.uploads_today() != 3:
            problems.append(f"today's counter should be 3, is {youtube.uploads_today()}")
        if schedule.get_row(no_date).get("videoId"):
            problems.append("bulk uploaded a row that has no date and time")

        # --- a quota error stops cleanly: the rest are left alone
        q1, q2, q3 = row("Q Uno"), row("Q Dos"), row("Q Tres")
        FakeNet.fail_on = "Q Dos"
        jq = youtube.start_bulk([q1, q2, q3])
        sq = wait(jq, youtube.bulk_state)
        FakeNet.fail_on = None
        states = [r["state"] for r in sq["rows"]]
        if sq["state"] != "stopped" or states != ["done", "failed", "pending"] or "upload limit" not in sq["note"].lower() and "quota" not in sq["note"].lower():
            problems.append(f"a quota error should stop the queue and leave the rest: {sq}")
        if schedule.get_row(q3).get("videoId") or schedule.get_row(q2).get("videoId") or schedule.get_row(q3).get("status") != "Ready":
            problems.append("a row after the quota error was touched")

        # --- cancel waits for the file being sent, then stops
        FakeNet.slow = True
        c1, c2 = row("C Uno"), row("C Dos")
        jc = youtube.start_bulk([c1, c2])
        time.sleep(0.2)
        youtube.cancel_bulk(jc)
        sc = wait(jc, youtube.bulk_state)
        FakeNet.slow = False
        if sc["state"] != "cancelled" or [r["state"] for r in sc["rows"]] != ["done", "pending"]:
            problems.append(f"cancel should finish the file being sent and stop: {sc}")

        # --- one queue per profile; the local counter stops at the limit
        FakeNet.slow = True
        d1, d2 = row("D Uno"), row("D Dos")
        jd = youtube.start_bulk([d1, d2])
        try:
            youtube.start_bulk([d2])
            problems.append("a second bulk upload started while one was running")
        except youtube.YouTubeError:
            pass
        youtube.cancel_bulk(jd)
        wait(jd, youtube.bulk_state)
        FakeNet.slow = False
        youtube._usage_file().write_text(json.dumps({"day": youtube._quota_day(), "count": 100}), encoding="utf-8")
        e1 = row("E Uno")
        plan2 = youtube.bulk_plan([e1])
        if plan2["remaining"] != 0 or plan2["overQuota"] != 1:
            problems.append(f"the plan did not show the quota used up: {plan2}")
        je = youtube.start_bulk([e1])
        se = wait(je, youtube.bulk_state)
        if se["state"] != "stopped" or se["rows"][0]["state"] != "pending" or schedule.get_row(e1).get("videoId"):
            problems.append(f"the queue should stop at the local limit without sending: {se}")
    except Exception as exc:                           # noqa: BLE001
        problems.append(f"raised {type(exc).__name__}: {exc}")
    finally:
        paths._profile.reset(tok)
        youtube._net, recycle.to_recycle_bin = real_net, real_bin

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(order)} fake uploads in queues: plan refusals, order, quota stop, cancel, one queue per profile, daily counter"

CHECKS = {"migrate": check_migrate, "brief": check_brief, "cues": check_cues, "credits": check_credits, "fingerprint": check_fingerprint, "schedule": check_schedule, "http": check_http, "profiles": check_profiles, "youtube": check_youtube, "upload": check_upload, "bulk": check_bulk,
          "decode": check_decode, "render": check_render}


def run(only: list[str] | None = None, write_expected: bool = False) -> int:
    names = only or list(CHECKS)
    failed = False
    print()
    with scratch_workspace():
        for name in names:
            print(f"  {name:<8} ", end="", flush=True)
            try:
                status, detail = (check_migrate(write_expected) if name == "migrate"
                                  else CHECKS[name]())
            except Exception as exc:               # noqa: BLE001
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
    p.add_argument("--rebaseline", nargs="*", metavar="NAME", default=None,
                   help="render the baselines (all, or the ones named) again and record "
                        "their hashes, ffmpeg version and stream fingerprints; refused when "
                        "the video stream differs from the recorded one")
    p.add_argument("--force", action="store_true",
                   help="with --rebaseline: record a video that changed on purpose")
    p.set_defaults(func=lambda a: promote(*a.promote) if a.promote
                   else rebaseline(a.rebaseline, a.force) if a.rebaseline is not None
                   else run(a.only, a.write_expected))
