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
import sys
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
    from . import hashtags as ht
    rule = ht.brief_rule({"placement": "title", "shorts": True, "titleTags": 3})
    got = roundtrip.build_brief(
        transcript, roundtrip.read_rubric(base / "rubric.md"),
        "radityadika-podcast.mp4", _load(base / "cues.json"), None, rule)
    if got != want:
        at = next((i for i, (a, b) in enumerate(zip(want, got)) if a != b),
                  min(len(want), len(got)))
        problems.append(f"brief.md differs at character {at}: "
                        f"expected {want[at:at + 40]!r}, got {got[at:at + 40]!r}")

    # The profile's hashtag rule is written into the brief in numbers, and changes with the setting.
    for settings, expect in (
            ({"placement": "title", "shorts": False, "titleTags": 2}, "first 2 hashtags in the YouTube title"),
            ({"placement": "description"}, "Hashtags go in the description only"),
            ({"placement": "both", "titleTags": 3}, "and all of them in the description")):
        text = roundtrip.build_brief(transcript, "", "x.mp4", None, None, ht.brief_rule(settings))
        if "**Hashtags for this profile:**" not in text or expect not in text or "at most 100 characters" not in text:
            problems.append(f"the brief's hashtag block for {settings} should say {expect!r} and the 100-character limit")
    if "**Hashtags for this profile:**" in roundtrip.build_brief(transcript, "", "x.mp4", None):
        problems.append("a brief built with no profile rule must not carry a hashtag block")
    if '"youtubeTitle"' not in got:
        problems.append("the brief's example reply lost youtubeTitle")

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
    # An import: the final title is composed by klipian, not taken from youtubeTitle; one that
    # would pass 100 characters is flagged (the server adds postWarning), one that fits is not,
    # and a reply with no youtubeTitle at all (every older one) is as valid as before.
    reply = (base / "replies" / "with-youtube-title.txt").read_bytes().decode("utf-8")
    cands = roundtrip.parse_reply(transcript.words, reply, fixture_cues)
    default = {"placement": "title", "shorts": False, "titleTags": 3}
    warns = [ht.title_warning(k["post"]["title"], k["post"]["hashtags"], default) for k in cands]
    if not warns[0] or "characters" not in warns[0] or warns[1]:
        problems.append(f"the final-title length warning on import is wrong: {warns}")
    if "youtubeTitle" in ht.plan(cands[0]["post"]["title"], "", cands[0]["post"]["hashtags"], default):
        problems.append("klipian must compose the final title itself, not use youtubeTitle")
    if ht.plan(cands[1]["post"]["title"], "", cands[1]["post"]["hashtags"], default)["title"] != "Suka Ngigo #ngigo #tidur":
        problems.append("the final title of a short clip was composed wrongly")
    if ht.title_warning(cands[0]["post"]["title"], cands[0]["post"]["hashtags"], {"placement": "description"}):
        problems.append("a title under 100 characters needs no warning in description mode")
    expected = _load(base / "imports.expected.json")
    for name, want in sorted(expected.items()):
        text = (base / "replies" / name).read_bytes().decode("utf-8")
        try:
            result = {"ok": True, "value": roundtrip.parse_reply(transcript.words, text, fixture_cues)}
        except ValueError as exc:
            result = {"ok": False, "error": str(exc)}
        problems += [f"{name} {d}" for d in _diff(want, result)]

    # The brief says plainly that the reply is plain JSON and that tags are finished text.
    if "Plain JSON only: no code, function calls, expressions, variables or comments" not in got.replace("\n", " "):
        problems.append("the brief lost its 'plain JSON only' sentence")
    if 'Write each hashtag as plain finished text, e.g. "#beladiri"' not in got or "lowercase, no spaces" in got:
        problems.append("the brief's hashtag wording is not the finished-text rule")

    # A reply with JavaScript in the JSON: the exact .replace(" ", "") slip and a trailing comma are
    # repaired (by reading, never running) and said; other code, single quotes, comments, unquoted keys,
    # curly quotes and a comma that cannot be repaired are refused with the line, column and a hint.
    def read(name):
        text = (base / "replies" / name).read_bytes().decode("utf-8")
        try:
            cands, notes = roundtrip.parse_reply_notes(transcript.words, text, fixture_cues)
            return cands, notes, ""
        except ValueError as exc:
            return None, [], str(exc)

    cands, notes, err = read("code-replace.txt")
    if err or [c["post"]["hashtags"] for c in cands] != [["#beladiri", "#podcast", "#MuayThai"]] or not any("replace" in n for n in notes):
        problems.append(f"the .replace(' ', '') slip was not repaired and said: {err or notes}")
    cands, notes, err = read("trailing-comma.txt")
    if err or not any("comma" in n for n in notes):
        problems.append(f"a trailing comma was not repaired and said: {err or notes}")
    cands, notes, err = read("spaced-tag.txt")
    if err or cands[0]["post"]["hashtags"] != ["#beladiri", "#MuayThai", "#podcast"] or notes:
        problems.append(f"'#bela diri' should import as '#beladiri' without any repair note: {err or cands[0]['post']}")
    # The "source" line: a straight quote copied from a video name breaks the JSON. When klipian knows
    # the video, that one line is replaced by the name (with a note); no other line is ever touched.
    known = 'NOICE - DEDDY CORBUZIER GAK ADA ORANG NGEGYM BUAT KESEHATAN! TAI KUCING!” - PODCAST BAHLUL.mp4'
    text = (base / "replies" / "source-quote.txt").read_bytes().decode("utf-8")
    try:
        roundtrip.parse_reply_notes(transcript.words, text, fixture_cues)
        problems.append("a source with a straight quote in it parsed without the known video name")
    except ValueError as exc:
        if "line 2," not in str(exc) or "quote inside the video name" not in str(exc):
            problems.append(f"the source-quote error should point at the source line: {str(exc)[:120]!r}")
    cands, notes, source_err = None, [], ""
    try:
        cands, notes = roundtrip.parse_reply_notes(transcript.words, text, fixture_cues, known)
    except ValueError as exc:
        source_err = str(exc)
    if source_err or not cands or not any('"source" line was replaced' in n for n in notes):
        problems.append(f"the source line was not replaced by the known name: {source_err or notes}")
    other = (base / "replies" / "source-ok-other-broken.txt").read_bytes().decode("utf-8")
    try:
        roundtrip.parse_reply_notes(transcript.words, other, fixture_cues, known)
        problems.append("a reply broken on another line was accepted because of the source repair")
    except ValueError as exc:
        if "Single quotes" not in str(exc):
            problems.append(f"a break on another line should report its own error: {str(exc)[:120]!r}")
    # the same reply, whose source is right, is not touched and says nothing
    ok_reply = text.replace(text[text.index('"source": "'):text.index('",', text.index('"source": "')) + 2], '"source": "x.mp4",')
    cands, notes = roundtrip.parse_reply_notes(transcript.words, ok_reply, fixture_cues, known)
    if notes:
        problems.append(f"a good source line was reported as repaired: {notes}")

    # A reply that parses is never touched: text that merely looks like the slip stays as written.
    tricky = '{"a": "x.replace(\\" \\", \\"\\") a, ]", "b": [1, 2]}'
    notes = []
    if roundtrip.extract_json(tricky, notes) != {"a": 'x.replace(" ", "") a, ]', "b": [1, 2]} or notes:
        problems.append(f"valid JSON that contains the slip as text was changed: {notes}")
    for name, want, pos in (
            ("code-call.txt", "Code inside the JSON", "line 14, column 34"),
            ("code-plus.txt", "Code inside the JSON", "line 12, column 30"),
            ("single-quotes.txt", "Single quotes", "line 12, column 18"),
            ("comments.txt", "comment", "line 12, column 36"),
            ("unquoted-key.txt", "has no quotes", "line 12, column 9"),
            ("curly-quotes.txt", "Curly quotes", "line 12, column 18"),
            ("comma-and-quote.txt", "trailing comma", "line 14, column 45")):
        cands, notes, err = read(name)
        if cands is not None or want not in err or pos not in err or "^" not in err:
            problems.append(f"{name}: expected a message with '{pos}' and '{want}', got {cands and 'a result'}: {err[:160]!r}")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"brief.md identical; {len(expected)} replies read as before; JSON slips repaired or located"


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
        # overwrite (Mark as Posted: when it went live) replaces an existing date and time; the default keeps them
        res2 = schedule.bulk_update(ids, "Posted", "2026-10-19", "20:15", path, lock, overwrite=True)
        after = {r["id"]: r for r in schedule.load_clips(path)}
        if any((after[i].get("date"), after[i].get("time")) != ("2026-10-19", "20:15") for i in ids) \
                or (res2["dated"], res2["kept"]) != (len(ids), 0) or after[ids[0]].get("createdAt") != 456:
            problems.append(f"bulk overwrite should replace every date and time: {res2} {[after[i].get('date') for i in ids]}")
        schedule.bulk_update(ids, "Posted", "2026-10-30", "10:00", path, lock)
        after = {r["id"]: r for r in schedule.load_clips(path)}
        if any((after[i].get("date"), after[i].get("time")) != ("2026-10-19", "20:15") for i in ids):
            problems.append("without overwrite an existing date and time must be kept")
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
        from . import credits
        tok = paths.set_profile("alpha")
        try:
            (paths.SOURCES / "same.mp4").write_bytes(b"identical bytes " * 1000)
            credits.save("same.mp4", {"platform": "YouTube", "creator": "Raditya Dika", "title": "T", "url": "https://youtu.be/xxxxxxxxxxx"})
        finally:
            paths._profile.reset(tok)
        tok = paths.set_profile("beta")
        try:
            tmpf = paths.SOURCES / "same.mp4.part"
            tmpf.write_bytes(b"identical bytes " * 1000)
            placed = profiles.place_source(tmpf, paths.SOURCES / "same.mp4")
            how = placed["how"]
            # the credit of the same video comes along when this profile has none
            mine = credits.load().get("same.mp4") or {}
            if mine.get("creator") != "Raditya Dika" or placed.get("creditFrom") != "alpha":
                problems.append(f"the credit was not copied from the other profile: {mine} / {placed}")
            if how == "linked" and not (paths.SOURCES / "same.mp4").samefile(paths.profile_dir("alpha") / "sources" / "same.mp4"):
                problems.append("a linked source is not the other profile's file")
            if (paths.SOURCES / "same.mp4").read_bytes() != b"identical bytes " * 1000:
                problems.append("a source placed in a second profile has the wrong bytes")
            (paths.SOURCES / "same.mp4").unlink()                  # deleting one name...
        finally:
            paths._profile.reset(tok)
        if not (paths.profile_dir("alpha") / "sources" / "same.mp4").is_file():
            problems.append("deleting a source in one profile removed it from another")
        # an existing credit is never overwritten
        profiles.write_meta("gamma", {"name": "gamma", "color": "#123456"})
        profiles.ensure_dirs("gamma")
        tok = paths.set_profile("gamma")
        try:
            (paths.SOURCES / "credits.json").write_text(json.dumps({"same2.mp4": {"platform": "TikTok", "creator": "Mine"}}), encoding="utf-8")
            tmpf = paths.SOURCES / "same2.mp4.part"
            tmpf.write_bytes(b"identical bytes " * 1000)
            placed = profiles.place_source(tmpf, paths.SOURCES / "same2.mp4")
            kept = credits.load().get("same2.mp4") or {}
            if kept.get("creator") != "Mine" or placed.get("creditFrom"):
                problems.append(f"an existing credit was overwritten (or reported as copied): {kept} / {placed}")
        finally:
            paths._profile.reset(tok)

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
            fields = {"description": "Satu kalimat.\n\n#podcast #lucu #podcast", "date": future, "time": "18:30", "status": "Ready", **kw}
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
            ("no date and no time: where to set them", row(date="", time=""), "UPLOAD DATE / TIME"),
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
                or body["status"]["selfDeclaredMadeForKids"] is not False or body["snippet"]["tags"] != ["podcast", "lucu"]                 or body["snippet"]["title"] != "Scheduled Clip #podcast #lucu" or "#" in body["snippet"]["description"]:
            problems.append(f"the upload body is wrong (default: hashtags in the title, not the description): {body}")
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
            elif isinstance(error, youtube.YouTubeError) and error.extra.get("detail") and not (s.get("detail") and s.get("report")):
                problems.append(f"{code}: the job should carry detail and report: {s}")
        fails(youtube.map_http_error(403, "quotaExceeded"), "project_quota")
        fails(youtube.map_http_error(403, "uploadLimitExceeded"), "channel_limit")
        fails(youtube.map_http_error(429, "rateLimitExceeded"), "rate_limit")
        fails(youtube.YouTubeError("offline", "down"), "offline")
        fails(youtube.map_http_error(401, ""), "expired")
        if youtube.map_http_error(403, "forbidden").code != "forbidden" or youtube.map_http_error(400, "x").code != "bad_request":
            problems.append("map_http_error gave the wrong code for 403/400")
        FakeNet.refresh_error = youtube.YouTubeError("expired", "expired")
        if not refused(row(title="Expired Token"), "expired"):
            problems.append("an upload started with an expired token")
        FakeNet.refresh_error = None

        # --- the profile's hashtag placement is applied at upload
        for settings, want_title, want_desc_tags in (
                ({"hashtagPlacement": "description"}, "Placed Clip", True),
                ({"hashtagPlacement": "both", "addShorts": True, "titleTags": 2}, "Placed Clip #podcast #lucu #shorts", True),
                ({"hashtagPlacement": "title", "addShorts": False, "titleTags": 3}, "Placed Clip #podcast #lucu", False)):
            profiles.update("up1", {"defaults": settings})
            rp = row(title="Placed Clip")
            spec = youtube.prepare(schedule.get_row(rp))
            if spec["title"] != want_title or ("#podcast" in spec["description"]) != want_desc_tags:
                problems.append(f"placement {settings}: title {spec['title']!r}, description {spec['description']!r}")
        profiles.update("up1", {"defaults": {"hashtagPlacement": "title", "addShorts": False}})
        # a row stored by a render keeps its hashtag list apart from the description
        rid_h, _ = schedule.upsert_render(project_id=pid, result_id="resH", title="T", file_name="b1.mp4",
                                          post={"title": "T", "caption": "C", "hashtags": ["#a", "#b"]}, credit_lines="")
        if schedule.get_row(rid_h).get("hashtags") != ["#a", "#b"]:
            problems.append("upsert_render did not keep the hashtag list on the row")

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
        fail_reason = "quotaExceeded"   # the Google reason that error carries
        slow_down = {}                  # title -> how many more "rateLimitExceeded" answers it gets
        slow = False
        bodies: list = []               # every body sent, to see what was asked of YouTube
        public_now = False              # report a video without publishAt as public

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
            cls.bodies.append(body)
            if title == cls.fail_on:
                raise youtube.map_http_error(403, cls.fail_reason, "fake " + cls.fail_reason)
            if cls.slow_down.get(title, 0) > 0:
                cls.slow_down[title] -= 1
                raise youtube.map_http_error(429, "rateLimitExceeded", "fake slow down")
            for i in range(1, 4):
                progress(i / 3)
                if cls.slow:
                    time.sleep(0.2)
            return {"id": "B" + str(len(order))}

        @classmethod
        def video_status(cls, token, video_id):
            if cls.public_now:
                return {"privacy": "public", "upload": "processed"}
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
        for rid, why in ((no_date, "upload date and time"), (no_title, "no title"), (long_title, "101"), (gone, "file deleted")):
            if why not in refused.get(rid, ""):
                problems.append(f"the plan did not refuse '{why}': {refused.get(rid)}")
        if ("publish it now" in refused.get(no_date, "") or "never publishes" not in refused.get(no_date, "")
                or "UPLOAD DATE / TIME" not in refused.get(no_date, "") or "in Detail" not in refused.get(no_date, "")):
            problems.append(f"the bulk refusal must not offer to publish now: {refused.get(no_date)}")
        if plan.get("running") is not False:
            problems.append("the plan should say no queue is running")
        if plan["usedToday"] != 0 or plan["remaining"] != 100 or plan["overQuota"] != 0:
            problems.append(f"the quota in the plan is wrong: {plan}")

        # --- a schedule given in the dialog: rows refused ONLY for their date/time are flagged, many
        # rows are set in one request (the same two fields as the table), and the plan then accepts them
        import datetime as _dt
        e1, e2 = row("Kosong Satu", date="", time=""), row("Kosong Dua", date="", time="")
        old = row("Sudah Lewat", date=(_dt.datetime.now() - _dt.timedelta(days=2)).strftime("%Y-%m-%d"))
        plan = youtube.bulk_plan([e1, old, no_title, e2])
        flags = {r["id"]: r["needsSchedule"] for r in plan["refused"]}
        if flags != {e1: True, old: True, no_title: False, e2: True}:
            problems.append(f"only rows refused for their date/time should offer inputs: {flags}")
        d1 = (_dt.datetime.now() + _dt.timedelta(days=2)).strftime("%Y-%m-%d")
        d2 = (_dt.datetime.now() + _dt.timedelta(days=3)).strftime("%Y-%m-%d")
        out = schedule.set_schedules([{"id": e1, "date": d1, "time": "18:30"}, {"id": old, "date": d2, "time": "18:30"},
                                      {"id": e2, "date": d2, "time": "09:00"}, {"id": "nope", "date": d1, "time": "10:00"}])
        if len(out["clip"]) != 3 or out["missing"] != ["nope"]:
            problems.append(f"set_schedules should change the three rows in one go: {out}")
        got = schedule.get_row(e2)
        if (got["date"], got["time"]) != (d2, "09:00") or got["title"] != "Kosong Dua" or got.get("createdAt") != schedule.get_row(e2).get("createdAt"):
            problems.append(f"a schedule must change the date and time only: {got}")
        plan = youtube.bulk_plan([e1, old, no_title, e2])
        if [r["id"] for r in plan["ok"]] != [e1, old, e2] or {r["id"] for r in plan["refused"]} != {no_title}:
            problems.append(f"the plan should accept the rows that were given a schedule: {[r['id'] for r in plan['ok']]}")
        if plan["ok"][0]["date"] != d1 or plan["ok"][0]["time"] != "18:30":
            problems.append(f"an accepted row should carry its date and time: {plan['ok'][0]}")
        for bad in ([{"id": e1, "date": "21-10-2030", "time": "18:30"}], [{"id": e1, "date": d1, "time": "6pm"}], ["x"]):
            try:
                schedule.set_schedules(bad)
                problems.append(f"set_schedules accepted {bad}")
            except ValueError:
                pass
        if schedule.get_row(e1)["date"] != d1:
            problems.append("a refused request must not change anything")

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

        # --- "now" mode (Publish now): every row public at once, whatever its date and time; one mode per run
        FakeNet.bodies.clear()
        FakeNet.public_now = True
        nw1 = row("Now Satu")                                          # has a future date: ignored
        nw2 = row("Now Dua", date="", time="")                         # no date and time: not a reason to refuse
        nw3 = row("Now Tiga", date=(_dt.datetime.now() - _dt.timedelta(days=2)).strftime("%Y-%m-%d"))   # a past date: likewise
        n_title, n_long, n_gone = row(" "), row("y" * 101), row("Now Hilang", file="gone2.mp4")
        n_done = row("Now Sudah")
        schedule.set_fields(n_done, {"videoId": "OLD123", "status": "Posted"})
        ids_now = [nw1, nw2, nw3, n_title, n_long, n_gone, n_done]
        pn = youtube.bulk_plan(ids_now, "now")
        if pn.get("mode") != "now" or [r["id"] for r in pn["ok"]] != [nw1, nw2, nw3] or any(r["publishAt"] for r in pn["ok"]):
            problems.append(f"the 'now' plan should accept the three rows with no publishAt: {pn.get('mode')} {[r['id'] for r in pn['ok']]}")
        if {r["id"] for r in pn["refused"]} != {n_title, n_long, n_gone, n_done}:
            problems.append(f"the other refusals must stand in 'now' mode: {[r['id'] for r in pn['refused']]}")
        if any(r.get("needsSchedule") for r in pn["refused"]) or [r["when"] for r in pn["ok"]] != ["now"] * 3:
            problems.append("in 'now' mode nothing asks for a schedule and every row goes 'now'")
        ps = youtube.bulk_plan(ids_now)                                # the default is still Schedule
        if ps.get("mode") != "schedule" or nw2 in [r["id"] for r in ps["ok"]] or nw3 in [r["id"] for r in ps["ok"]]:
            problems.append("the default mode must stay Schedule (no date / a past date refused)")
        for bad in ("later", "NOW", "publish"):
            for fn in (lambda b=bad: youtube.bulk_plan([nw1], b), lambda b=bad: youtube.start_bulk([nw1], b)):
                try:
                    fn()
                    problems.append(f"mode {bad!r} should be refused: one mode per run, from the known two")
                except youtube.YouTubeError:
                    pass
        before = dt.datetime.now()
        jn = youtube.start_bulk(ids_now, "now")
        sn = wait(jn, youtube.bulk_state)
        if sn["state"] != "done" or sn.get("mode") != "now" or [r["state"] for r in sn["rows"]] != ["done"] * 3:
            problems.append(f"the 'now' queue should send the three accepted rows: {sn}")
        if len(FakeNet.bodies) != 3 or any(b["status"].get("privacyStatus") != "public" or "publishAt" in b["status"] for b in FakeNet.bodies):
            problems.append(f"'now' uploads must be public with no publishAt: {[b['status'] for b in FakeNet.bodies]}")
        for rid in (nw1, nw2, nw3):
            r = schedule.get_row(rid)
            when = dt.datetime.strptime(f"{r.get('date')} {r.get('time')}", "%Y-%m-%d %H:%M")
            if r.get("status") != "Posted" or not r.get("videoId") or "youtube.com/shorts/" not in (r.get("youtubeUrl") or "") \
                    or abs((when - before.replace(second=0, microsecond=0)).total_seconds()) > 180:
                problems.append(f"a 'now' row should be Posted with the moment it went live, a video id and a link: {r}")
        for rid in (n_title, n_long, n_gone, n_done):
            if schedule.get_row(rid).get("videoId") not in (None, "", "OLD123"):
                problems.append("a refused row was uploaded in 'now' mode")
        # cancel after the current file, and the quota stop, in 'now' mode
        FakeNet.slow = True
        k1, k2 = row("Kan Uno", date="", time=""), row("Kan Dos", date="", time="")
        jk = youtube.start_bulk([k1, k2], "now")
        time.sleep(0.2)
        youtube.cancel_bulk(jk)
        sk = wait(jk, youtube.bulk_state)
        FakeNet.slow = False
        if sk["state"] != "cancelled" or [r["state"] for r in sk["rows"]] != ["done", "pending"] or schedule.get_row(k2).get("videoId"):
            problems.append(f"cancel in 'now' mode should finish the file being sent and stop: {sk}")
        z1, z2, z3 = row("Z Uno", date="", time=""), row("Z Dos", date="", time=""), row("Z Tres", date="", time="")
        FakeNet.fail_on = "Z Dos"
        jz = youtube.start_bulk([z1, z2, z3], "now")
        sz = wait(jz, youtube.bulk_state)
        FakeNet.fail_on = None
        if sz["state"] != "stopped" or [r["state"] for r in sz["rows"]] != ["done", "failed", "pending"] or schedule.get_row(z3).get("videoId"):
            problems.append(f"a quota error in 'now' mode should stop the queue and leave the rest: {sz}")
        FakeNet.public_now = False
        if youtube.bulk_state(jn).get("mode") != "now" or youtube.bulk_state(jid).get("mode") != "schedule":
            problems.append("a run keeps the mode it started with")

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

        # --- upload-limit errors: each Google reason keeps its own code and sentence, the raw error is logged
        # (redacted) and handed back as detail / report, "slow down" is retried, the limits stop the queue cleanly
        import types
        from . import youtube as _yt

        def google_error(status, reason, message):
            body = json.dumps({"error": {"code": status, "message": message, "errors": [{"reason": reason, "domain": "youtube.video"}]}})
            return types.SimpleNamespace(resp=types.SimpleNamespace(status=status), content=body.encode("utf-8"))

        real_now, real_tz = _yt._now, _yt._LOCAL_TZ
        _yt._LOCAL_TZ = dt.timezone(dt.timedelta(hours=7))
        _yt._now = lambda: dt.datetime(2026, 10, 22, 2, 0, tzinfo=dt.timezone.utc)      # 19:00 Pacific (PDT), 09:00 WIB
        try:
            e_ch = _yt._http_error(google_error(403, "uploadLimitExceeded", "Bearer ya29.FAKE-SECRET-TOKEN exceeded the limit"))
            e_pq = _yt._http_error(google_error(403, "quotaExceeded", "quota"))
            e_dl = _yt._http_error(google_error(403, "dailyLimitExceeded", "daily"))
            e_rl = _yt._http_error(google_error(429, "rateLimitExceeded", "slow"))
        finally:
            _yt._now, _yt._LOCAL_TZ = real_now, real_tz
        if (e_ch.code, e_pq.code, e_dl.code, e_rl.code) != ("channel_limit", "project_quota", "project_quota", "rate_limit"):
            problems.append(f"the reasons must map to channel_limit / project_quota / rate_limit: {[e.code for e in (e_ch, e_pq, e_dl, e_rl)]}")
        if "daily upload limit" not in e_ch.message or "youtube.com/verify" not in e_ch.message or "24 hours" not in e_ch.message:
            problems.append(f"the channel-limit sentence is wrong: {e_ch.message}")
        if "midnight Pacific" not in e_pq.message or "14:00 (WIB) today" not in e_pq.message:
            problems.append(f"the project-quota sentence should give the reset as 14:00 (WIB) today: {e_pq.message}")
        if "slow down" not in e_rl.message or "retry" not in e_rl.message:
            problems.append(f"the rate-limit sentence is wrong: {e_rl.message}")
        if e_ch.extra.get("reason") != "uploadLimitExceeded" or e_ch.extra.get("status") != 403 or "uploadLimitExceeded" not in e_ch.extra.get("detail", ""):
            problems.append(f"the Google reason / status must be kept in the detail: {e_ch.extra}")
        rep = e_ch.extra.get("report", "")
        if len(rep.splitlines()) > 20 or "ya29.FAKE-SECRET" in rep or "profile: bk1" not in rep or "project:" not in rep:
            problems.append(f"the report must be at most 20 lines, redacted, with the profile and project: {rep!r}")
        logf = paths.profile_dir() / "youtube.log"
        log_text = logf.read_text(encoding="utf-8") if logf.is_file() else ""
        if "uploadLimitExceeded" not in log_text or "ya29.FAKE-SECRET" in log_text or "Authorization" in log_text:
            problems.append(f"youtube.log must hold the failure without any secret: {log_text[-300:]!r}")
        if "FAKE-SECRET" in json.dumps(e_ch.extra):
            problems.append("a token reached the error's details")

        # the reset time across daylight saving (US: second Sunday of March to first Sunday of November), today vs tomorrow
        def reset_text(iso, fallback=False):
            _yt._LOCAL_TZ = dt.timezone(dt.timedelta(hours=7))
            saved = sys.modules.get("zoneinfo", "absent")
            if fallback:
                sys.modules["zoneinfo"] = None             # import fails: the by-hand US rules take over
            try:
                return _yt.quota_reset(dt.datetime.fromisoformat(iso).replace(tzinfo=dt.timezone.utc))["text"]
            finally:
                _yt._LOCAL_TZ = real_tz
                if fallback:
                    if saved == "absent":
                        sys.modules.pop("zoneinfo", None)
                    else:
                        sys.modules["zoneinfo"] = saved
        for fallback in (False, True):
            want = [("2026-10-22T02:00:00", "14:00 (WIB) today"), ("2026-10-22T08:00:00", "14:00 (WIB) tomorrow"),
                    ("2026-01-15T02:00:00", "15:00 (WIB) today"), ("2026-03-08T06:00:00", "15:00 (WIB) today"),
                    ("2026-03-08T12:00:00", "14:00 (WIB) tomorrow"), ("2026-11-01T06:00:00", "14:00 (WIB) today"),
                    ("2026-11-01T12:00:00", "15:00 (WIB) tomorrow")]
            for iso, text in want:
                got = reset_text(iso, fallback)
                if got != text:
                    problems.append(f"quota reset at {iso} (fallback={fallback}): wanted {text}, got {got}")

        # the plan: this channel's uploads in the last 24 h, and the soft hint for a NEW channel
        FakeNet.fail_on = None
        youtube._usage_file().write_text(json.dumps({"day": youtube._quota_day(), "count": 0}), encoding="utf-8")
        for old in schedule.load_clips():                     # a clean slate: only the rows made below count
            schedule.set_fields(old["id"], {"uploadedAt": 0, "videoId": ""})
        h = [row(f"H {i}") for i in range(7)]
        for rid in h[:2]:
            schedule.set_fields(rid, {"uploadedAt": int(time.time()) - 3600, "videoId": "HV" + rid, "status": "Scheduled"})
        schedule.set_fields(h[2], {"uploadedAt": int(time.time()) - 3 * 86400, "videoId": "HVold", "status": "Scheduled"})
        ph = youtube.bulk_plan(h[3:])
        if ph.get("last24h") != 2 or not ph.get("newChannel") or ph.get("hint"):
            problems.append(f"24 h count / new channel / no hint below 6: {ph.get('last24h')} {ph.get('newChannel')} {ph.get('hint')!r}")
        ph = youtube.bulk_plan(h[3:] + [row(f"H{i}b") for i in range(3)])
        if "lower daily limit" not in ph.get("hint", "") or ph["remaining"] != 100:
            problems.append(f"a new channel above about 6 a day should get the soft hint (and nothing blocked): {ph.get('hint')!r} {ph['remaining']}")
        tokf = youtube._load_token_file()
        youtube._write_token_file({**tokf, "connectedAt": int(time.time()) - 60 * 86400})
        for rid in h[:3]:
            schedule.set_fields(rid, {"videoId": "", "uploadedAt": 0, "status": "Ready"})
        many = [row(f"M{i}") for i in range(10)]
        for rid in many:
            schedule.set_fields(rid, {"videoId": "MV" + rid})
        ph = youtube.bulk_plan(h[:3])
        if ph.get("newChannel") or ph.get("hint"):
            problems.append(f"an old channel with many uploads is not new: {ph.get('newChannel')} {ph.get('hint')!r}")
        youtube._write_token_file(tokf)

        # the bulk run: each limit stops the queue cleanly (rest "not sent"), with detail and report
        real_pauses, real_sleep = youtube._RATE_PAUSES, youtube._sleep
        youtube._RATE_PAUSES, youtube._sleep = (0.05, 0.05, 0.05), lambda s: time.sleep(min(s, 0.01))
        try:
            for reason, code in (("uploadLimitExceeded", "channel_limit"), ("quotaExceeded", "project_quota")):
                FakeNet.fail_reason = reason
                x1, x2, x3 = row(f"L {reason} 1"), row(f"L {reason} 2"), row(f"L {reason} 3")
                FakeNet.fail_on = f"L {reason} 2"
                sx = wait(youtube.start_bulk([x1, x2, x3]), youtube.bulk_state)
                FakeNet.fail_on = None
                if sx["state"] != "stopped" or [r["state"] for r in sx["rows"]] != ["done", "failed", "pending"] or sx.get("code") != code:
                    problems.append(f"{reason} should stop the queue cleanly with code {code}: {sx['state']} {sx.get('code')}")
                if reason not in sx.get("detail", "") or not sx.get("report") or sx["rows"][2]["message"] != "not sent" \
                        or schedule.get_row(x3).get("videoId"):
                    problems.append(f"{reason}: detail / report / 'not sent' missing: {sx.get('detail')!r} {sx['rows'][2]}")
            FakeNet.fail_reason = "quotaExceeded"
            # "slow down" twice, then it works: the file is retried and the queue goes on
            r1, r2 = row("R Uno"), row("R Dos")
            FakeNet.slow_down = {"R Uno": 2}
            sr = wait(youtube.start_bulk([r1, r2]), youtube.bulk_state)
            if sr["state"] != "done" or [r["state"] for r in sr["rows"]] != ["done", "done"] or FakeNet.slow_down.get("R Uno") != 0:
                problems.append(f"a rate limit that clears should be retried and the run completed: {sr['state']} {[r['state'] for r in sr['rows']]} {FakeNet.slow_down}")
            # "slow down" forever: three retries, then the queue stops
            s1, s2 = row("S Uno"), row("S Dos")
            FakeNet.slow_down = {"S Uno": 99}
            ss = wait(youtube.start_bulk([s1, s2]), youtube.bulk_state)
            tried = 99 - FakeNet.slow_down["S Uno"]
            if ss["state"] != "stopped" or ss.get("code") != "rate_limit" or tried != 4 or ss["rows"][1]["state"] != "pending" or schedule.get_row(s2).get("videoId"):
                problems.append(f"a rate limit that stays should be tried 4 times (1 + 3 retries) and then stop the queue: {ss['state']} {ss.get('code')} tried={tried}")
        finally:
            youtube._RATE_PAUSES, youtube._sleep = real_pauses, real_sleep
            FakeNet.slow_down = {}
            FakeNet.fail_reason = "quotaExceeded"
        # the server's answer carries the detail and report
        from . import server as _srv
        sent = {}
        fake_self = types.SimpleNamespace(_send_json=lambda body, code=200: sent.update(body=body, code=code))
        _srv.Handler._youtube_reply(fake_self, lambda: (_ for _ in ()).throw(e_ch))
        if sent.get("code") != 400 or sent["body"].get("code") != "channel_limit" or not sent["body"].get("detail") or not sent["body"].get("report"):
            problems.append(f"the API answer should carry code, detail and report: {sent}")
    except Exception as exc:                           # noqa: BLE001
        problems.append(f"raised {type(exc).__name__}: {exc}")
    finally:
        paths._profile.reset(tok)
        youtube._net, recycle.to_recycle_bin = real_net, real_bin

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(order)} fake uploads in queues: plan refusals, order, quota stop, cancel, one queue per profile, daily counter"


# --------------------------------------------------------------------------
# check: hashtags (where they go on YouTube; Python and the browser's JS agree)
# --------------------------------------------------------------------------

def check_hashtags() -> tuple[str, str]:
    """Title / description / both, 2 or 3 tags in the title, #shorts, the 100-character cut, a tag
    already in the title, an old row (tags only in its description), normalisation and the 15-tag
    cap -- and the SAME answers from ui/js/shared/hashtags.js (run with node), which the browser's
    preview and the Render screen's Copy use."""
    import shutil as _sh
    import subprocess
    from . import hashtags as ht

    desc = "Satu kalimat. Setuju?\n\n#raditya #komedi #podcast #lucu\n\nSumber: YouTube Raditya Dika"
    tags4 = ["#raditya", "#komedi", "#podcast", "#lucu"]
    descy = desc.replace("Sumber: YouTube Raditya Dika", 'Sumber: YouTube Raditya Dika — "Apa Kabar" (https://www.youtube.com/watch?v=aaaaaaaaaaa)')
    T2 = {"placement": "title", "shorts": False, "titleTags": 2}
    T3 = {"placement": "title", "shorts": False, "titleTags": 3}
    long_title = "x" * 88
    cases = [
        ("title mode, 2 tags", "Podcast Lucu", desc, tags4, T2),
        ("title mode, 3 tags", "Podcast Lucu", desc, tags4, T3),
        ("the 100-character cut", long_title, desc, tags4, T3),
        ("a tag already in the title", "Raditya #komedi", desc, tags4, T2),
        ("#shorts on, last", "Podcast Lucu", desc, tags4, {**T3, "shorts": True}),
        ("#shorts off", "Podcast Lucu", desc, tags4, T3),
        ("an old row: tags only in the description", "Podcast Lucu", desc, None, T3),
        ("description mode, as today", "Podcast Lucu", desc, tags4, {**T3, "placement": "description", "shorts": True}),
        ("both", "Podcast Lucu", desc, tags4, {**T3, "placement": "both"}),
        ("normalisation", "Judul", "x", ["#Ra Ditya!", "KOMEDI-2", "\u00c9COLE", "", "#", "komedi2", "snake_case"], T3),
        ("credit link, title mode", "Podcast Lucu", descy, tags4, T3),
        ("credit link, description mode", "Podcast Lucu", descy, tags4, {**T3, "placement": "description"}),
        ("credit link, both", "Podcast Lucu", descy, tags4, {**T3, "placement": "both"}),
        ("the 15-tag cap", "Judul", "x", [f"t{i}" for i in range(20)], {**T3, "placement": "both"}),
        ("tags with commas on their own line", "Judul", "Cap\n\n#a, #b,#c\n\nSumber", None, T2),
        ("a long title that cannot take its tags", "y" * 97, "x", ["#a", "#b"], {**T3, "shorts": True}),
        ("a title over 100 in description mode", "z" * 101, "x", ["#a"], {**T3, "placement": "description"}),
    ]
    problems = []
    got = {name: ht.plan(t, d, h, s) for name, t, d, h, s in cases}

    def eq(name, field, want):
        if got[name][field] != want:
            problems.append(f"{name}: {field} is {got[name][field]!r}, expected {want!r}")

    without = "Satu kalimat. Setuju?\n\nSumber: YouTube Raditya Dika"
    eq("title mode, 2 tags", "title", "Podcast Lucu #raditya #komedi")
    eq("title mode, 2 tags", "description", without)
    eq("title mode, 3 tags", "title", "Podcast Lucu #raditya #komedi #podcast")
    eq("title mode, 3 tags", "tags", ["raditya", "komedi", "podcast", "lucu"])
    final = got["the 100-character cut"]["title"]
    if len(final) > 100 or not final.startswith(long_title + " #raditya") or "#komedi" in final:
        problems.append(f"the 100-character cut is wrong ({len(final)}): {final!r}")
    eq("a tag already in the title", "title", "Raditya #komedi #raditya")
    eq("#shorts on, last", "title", "Podcast Lucu #raditya #komedi #podcast #shorts")
    eq("#shorts on, last", "tags", ["raditya", "komedi", "podcast", "lucu", "shorts"])
    eq("#shorts off", "tags", ["raditya", "komedi", "podcast", "lucu"])
    eq("an old row: tags only in the description", "title", "Podcast Lucu #raditya #komedi #podcast")
    eq("an old row: tags only in the description", "description", without)
    eq("description mode, as today", "title", "Podcast Lucu")
    eq("description mode, as today", "description", desc)
    eq("both", "title", "Podcast Lucu #raditya #komedi #podcast")
    eq("both", "description", desc)
    eq("normalisation", "tags", ["raditya", "komedi2", "\u00e9cole", "snake_case"])
    if len(got["the 15-tag cap"]["tags"]) != 15:
        problems.append(f"the 15-tag cap: {len(got['the 15-tag cap']['tags'])} tags")
    eq("tags with commas on their own line", "description", "Cap\n\nSumber")
    eq("tags with commas on their own line", "title", "Judul #a #b")

    # the browser's JS must say the same
    node = _sh.which("node")
    js = ROOT / "ui" / "js" / "shared" / "hashtags.js"
    if not node or not js.is_file():
        note = " (the JS agreement was skipped: node is not installed)"
    else:
        driver = ("const m=require(process.argv[1]);const cs=JSON.parse(require('fs').readFileSync(0,'utf8'));"
                  "process.stdout.write(JSON.stringify(cs.map(c=>[m.hashtagPlan(c.title,c.description,c.hashtags,c.settings),"
                  "m.hashtagWarning(c.title,c.hashtags,c.settings)])));")
        payload = json.dumps([{"title": t, "description": d, "hashtags": h, "settings": s} for _, t, d, h, s in cases])
        proc = subprocess.run([node, "-e", driver, str(js)], input=payload.encode("utf-8"), capture_output=True, timeout=60)
        if proc.returncode != 0:
            problems.append(f"node could not run hashtags.js: {proc.stderr.decode('utf-8', 'replace')[:200]}")
        else:
            theirs = json.loads(proc.stdout.decode("utf-8"))
            for (name, t, d, h, s_), (want, want_warn) in zip(cases, theirs):
                if want != got[name]:
                    problems.append(f"JS and Python disagree on '{name}': JS {want} / Python {got[name]}")
                if want_warn != ht.title_warning(t, h, s_):
                    problems.append(f"JS and Python disagree on the length warning of '{name}': "
                                    f"JS {want_warn!r} / Python {ht.title_warning(t, h, s_)!r}")
        note = " and the browser's JS agrees"
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(cases)} placements{note}"

def check_ytdl() -> tuple[str, str]:
    """Add from YouTube with a fake yt-dlp (nothing here reaches the network): the link, the file
    name, the credit (filled in, never overwritten, with its link in the description in every
    hashtag placement), no second download in the same profile or another, cancel and failure
    cleaning up, the error messages, yt-dlp missing, and the endpoints (the Guest included)."""
    import contextlib
    import http.client
    import importlib.util
    import io
    import os
    import threading
    from http.server import ThreadingHTTPServer
    from unittest import mock
    from . import credits, hashtags as ht, paths, profiles, schedule, ytdl
    from .server import Handler

    problems = []
    A, B, C, D, E, LIVE = "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd", "eeeeeeeeeee", "lllllllllll"
    URL_A = f"https://www.youtube.com/watch?v={A}"

    def mkinfo(vid, channel, title, **more):
        return {"id": vid, "channel": channel, "title": title, "duration": 61, "height": 1080,
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hq.jpg",
                "requested_formats": [{"filesize": 3_000_000}, {"filesize_approx": 500_000}], **more}

    class Fake:
        infos = {A: mkinfo(A, "Raditya Dika", "Apa Kabar Syahrini"),
                 B: mkinfo(B, "Raditya Dika", "Apa Kabar Syahrini"),
                 C: mkinfo(C, "Chan: nel?", 'Odd <title> "quoted" / slash \\ pipe | star * ... '),
                 D: mkinfo(D, "Cancel Chan", "Cancel me"), E: mkinfo(E, "Guest Chan", "Guest video"),
                 LIVE: mkinfo(LIVE, "Live Chan", "Live now", is_live=True)}
        installed = True
        err = None
        dl_error = None
        cancel_mid = False
        calls = {"info": 0, "download": 0}

        @classmethod
        def version(cls):
            return "2099.01.01" if cls.installed else None

        js = {"runtime": "node", "path": "node", "ejs": True}
        qualities: list = []

        @classmethod
        def js_state(cls):
            return cls.js

        @classmethod
        def info(cls, url, quality=1080):
            cls.qualities.append(quality)
            cls.calls["info"] += 1
            if not cls.installed:
                raise ytdl.YtError("missing", "yt-dlp is not installed.", command="pip install yt-dlp")
            if cls.err:
                raise cls.err
            return dict(cls.infos[url.split("v=")[-1]])

        @classmethod
        def download(cls, url, folder, hook, ffmpeg_dir, quality=1080):
            cls.calls["download"] += 1
            (folder / "video.f137.mp4.part").write_bytes(b"partial")
            step = {"status": "downloading", "filename": "video.f137.mp4", "downloaded_bytes": 50,
                    "total_bytes": 100, "speed": 1e6, "eta": 3, "info_dict": {"requested_formats": [1, 2]}}
            hook(step)
            if cls.cancel_mid:
                for ev in list(ytdl._CANCEL.values()):
                    ev.set()
            hook(step)                                   # raises once cancelled
            if cls.dl_error:
                raise cls.dl_error
            hook({"postprocessor": "Merger", "status": "started"})
            (folder / "video.mp4").write_bytes(b"VIDEO " + url.encode())
            (folder / "video.f137.mp4.part").unlink()

        @classmethod
        def cancelled_exception(cls):
            return ytdl._Cancelled

    @contextlib.contextmanager
    def as_profile(pid):
        tok = paths.set_profile(pid)
        try:
            yield
        finally:
            paths._profile.reset(tok)

    def wait(jid, limit=15):
        t0 = time.time()
        while time.time() - t0 < limit:
            s = ytdl.state(jid)
            if s.get("state") not in ("queued", "running"):
                return s
            time.sleep(0.05)
        return ytdl.state(jid)

    def code_of(fn, *a):
        try:
            fn(*a)
        except ytdl.YtError as exc:
            return exc.code
        return None

    for pid in ("yta", "ytb"):
        profiles.write_meta(pid, {"name": pid, "color": "#123456"})
        profiles.ensure_dirs(pid)
    profiles.ensure_dirs(paths.GUEST)
    real_net = ytdl._net
    ytdl._net = Fake
    hush = contextlib.redirect_stderr(io.StringIO())         # the failures logged to the console on purpose
    hush.__enter__()
    try:
        # --- the link
        good = {f"https://www.youtube.com/watch?v={A}": A, f"youtube.com/watch?v={A}&t=5s": A,
                f"https://youtu.be/{A}?si=x": A, f"https://m.youtube.com/watch?v={A}&list=PLx": A,
                f"https://www.youtube.com/shorts/{A}": A, f"https://www.youtube.com/live/{A}": A, A: A}
        for link, want in good.items():
            if code_of(ytdl.video_id, link) or ytdl.video_id(link) != want:
                problems.append(f"a YouTube link was not understood: {link}")
        for link in ("", "https://vimeo.com/12345", "https://www.youtube.com/playlist?list=PLabc",
                     "https://www.youtube.com/@somechannel", "https://evil.example/watch?v=" + A,
                     "https://www.youtube.com.evil.example/watch?v=" + A, "file:///c:/x.mp4", "not a link at all"):
            if code_of(ytdl.video_id, link) != "not_youtube":
                problems.append(f"'{link}' should be refused as not a YouTube video link")

        # --- the file name
        stems = {
            ("Raditya Dika", "Apa Kabar Syahrini"): "Raditya Dika - Apa Kabar Syahrini",
            ("Chan: nel?", "Judul. "): "Chan nel - Judul",
            ("  Chan  ", "  ...Judul...  "): "Chan - Judul",
            ("", "Only a title"): "Only a title",
            ("Only Channel", ""): "Only Channel",
            ("CON", ""): "CON-video",
            ("", ""): "YouTube video",
            ("Chan", "Emoji \U0001F602 ok"): "Chan - Emoji \U0001F602 ok",
            # quote characters never stay in a name (they would break the reply's "source" line)
            ("NOICE", "GAK ADA ORANG! TAI KUCING!” - PODCAST"): "NOICE - GAK ADA ORANG! TAI KUCING! - PODCAST",
            ("Chan", 'a "b" “c” „d‟ ‘f’ ‚s‛ `g` ´h´ «i» ‹j› \'k\''): "Chan - a b c d f s g h i j k",
            ("Chan", "Don't miss Jum'at"): "Chan - Dont miss Jumat",
            ("Chan", '"“”\''): "Chan",
            ('“', '”'): "YouTube video",
        }
        for (ch, ti), want in stems.items():
            got = ytdl.file_stem(ch, ti)
            if got != want:
                problems.append(f"file name for {ch!r} / {ti!r}: {got!r}, wanted {want!r}")
        for ch, ti in (("Chan: nel?", 'a<b>c"d/e\\f|g?h*i'), ("x" * 300, "y" * 300), ("Chan", "t" * 400 + "... ")):
            stem = ytdl.file_stem(ch, ti)
            if len(stem) > ytdl.MAX_STEM or stem != stem.strip(" ."):
                problems.append(f"a long or odd name is not cut cleanly: {stem[:40]!r} ({len(stem)})")
            if any(c in stem for c in '<>:"/\\|?*'):
                problems.append(f"a forbidden character stayed in {stem!r}")
        long_stem = ytdl.file_stem("x" * 300, "y" * 300)
        if not long_stem.startswith("x" * ytdl.MAX_CHANNEL + " - y"):
            problems.append(f"a long channel name should be cut so the title keeps room: {long_stem[:70]!r}")

        # --- the preview (nothing is downloaded)
        with as_profile("yta"):
            before = dict(Fake.calls)
            p = ytdl.preview(URL_A)
            if (p["id"], p["title"], p["channel"], p["fileName"], p["size"], p["url"]) != (
                    A, "Apa Kabar Syahrini", "Raditya Dika", "Raditya Dika - Apa Kabar Syahrini.mp4", 3_500_000, URL_A):
                problems.append(f"preview: {p}")
            if Fake.calls["download"] != before["download"]:
                problems.append("a preview downloaded something")
            if code_of(ytdl.preview, f"https://youtu.be/{LIVE}") != "live":
                problems.append("a live stream should be refused with the 'live' code")
            if code_of(ytdl.preview, "https://vimeo.com/1") != "not_youtube":
                problems.append("the preview accepted a link that is not YouTube")

        # --- the download: file, credit, link in the description
        with as_profile("yta"):
            r = ytdl.start(URL_A)
            s = wait(r["id"])
            name = "Raditya Dika - Apa Kabar Syahrini.mp4"
            if s.get("state") != "done" or s.get("name") != name:
                problems.append(f"the download did not finish as {name}: {s}")
            f = paths.SOURCES / name
            if not f.is_file() or f.read_bytes() != b"VIDEO " + URL_A.encode():
                problems.append("the downloaded file is missing or wrong")
            c = credits.load().get(name) or {}
            want = {"platform": "YouTube", "creator": "Raditya Dika", "title": "Apa Kabar Syahrini",
                    "url": URL_A, "videoId": A}
            if {k: c.get(k) for k in want} != want or c.get("downloaded") != time.strftime("%Y-%m-%d"):
                problems.append(f"the credit is not filled in as expected: {c}")
            if (paths.SOURCES / ".ytdl").exists():
                problems.append("the temporary folder was left behind after a finished download")
            line = credits.line(c)
            expect = f'Sumber: YouTube Raditya Dika — "Apa Kabar Syahrini" ({URL_A})'
            if line != expect:
                problems.append(f"the credit line changed: {line!r}")
            # the same link, the same profile: no second download
            n = Fake.calls["download"]
            again = ytdl.start(URL_A)
            if again.get("id") or again.get("name") != name or Fake.calls["download"] != n:
                problems.append(f"the same video was downloaded again: {again}")
            if ytdl.preview(URL_A)["inProfile"] != name:
                problems.append("the preview does not say the video is already in this profile")
            # editing the credit in Sources keeps which video it is
            credits.save(name, {"platform": "YouTube", "creator": "Raditya", "title": "Apa Kabar", "url": URL_A})
            if (credits.load().get(name) or {}).get("videoId") != A:
                problems.append("editing the credit forgot the video id")
            credits.save(name, {"platform": "YouTube", "creator": "Raditya Dika", "title": "Apa Kabar Syahrini", "url": URL_A})
            # a DIFFERENT video with the same channel and title gets " (2)"
            s2 = wait(ytdl.start(f"https://youtu.be/{B}")["id"])
            if s2.get("name") != "Raditya Dika - Apa Kabar Syahrini (2).mp4":
                problems.append(f"a name clash with a different video should end in (2): {s2.get('name')}")
            # a file that was put there by hand under the wanted name is not taken for the video
            (paths.SOURCES / "Chan nel - Odd title.mp4").write_bytes(b"mine")
            Fake.infos[C] = mkinfo(C, "Chan: nel?", "Odd title")
            s3 = wait(ytdl.start(f"https://youtu.be/{C}")["id"])
            if s3.get("name") != "Chan nel - Odd title (2).mp4" or (paths.SOURCES / "Chan nel - Odd title.mp4").read_bytes() != b"mine":
                problems.append(f"a file that was already there was replaced or not avoided: {s3.get('name')}")
            # an existing credit is never overwritten
            (paths.SOURCES / "hand.mp4").write_bytes(b"x")
            credits.save("hand.mp4", {"platform": "TikTok", "creator": "Mine"})
            if ytdl._put_credit("hand.mp4", {"platform": "YouTube", "creator": "Other", "videoId": A}):
                problems.append("_put_credit reported writing over an existing credit")
            if (credits.load().get("hand.mp4") or {}).get("creator") != "Mine":
                problems.append("an existing credit was overwritten")

            # the credit line with its link, in the description, in every hashtag placement
            post = {"caption": "Cuplikan lucu.", "hashtags": ["#raditya", "#komedi", "#podcast"]}
            desc = schedule.description(post, credits.lines([name]))
            for placement in ht.PLACEMENTS:
                for shorts in (False, True):
                    plan = ht.plan("Judul Clip", desc, post["hashtags"],
                                   {"placement": placement, "shorts": shorts, "titleTags": 3})
                    if expect not in plan["description"]:
                        problems.append(f"the credit line (with its link) is not in the description in '{placement}' mode")
            brief = credits.brief_source(credits.load().get(name))
            if brief != 'YouTube · Raditya Dika · "Apa Kabar Syahrini"':
                problems.append(f"the brief names the source differently: {brief!r}")

        # --- the same video in another profile: linked, credit copied, no download
        with as_profile("ytb"):
            n = Fake.calls["download"]
            p = ytdl.preview(URL_A)
            if p["inOtherProfile"] != "yta" or p["inProfile"]:
                problems.append(f"the preview does not say another profile has it: {p}")
            r = ytdl.start(URL_A)
            if r.get("id") or r.get("copiedFrom") != "yta" or Fake.calls["download"] != n:
                problems.append(f"another profile's copy was not used: {r}")
            mine = paths.SOURCES / (r.get("name") or "none.mp4")
            theirs = paths.profile_dir("yta") / "sources" / "Raditya Dika - Apa Kabar Syahrini.mp4"
            if not mine.is_file() or mine.read_bytes() != theirs.read_bytes():
                problems.append("the copied video is missing or wrong")
            c = credits.load().get(mine.name) or {}
            if c.get("url") != URL_A or c.get("videoId") != A or c.get("creator") != "Raditya Dika":
                problems.append(f"the credit was not copied with the video: {c}")
            mine.unlink()                                       # deleting here keeps the other profile's file
            if not theirs.is_file():
                problems.append("deleting the copy removed the other profile's video")

        # --- cancel and failure clean up
        with as_profile("ytb"):
            Fake.cancel_mid = True
            s = wait(ytdl.start(f"https://youtu.be/{D}")["id"])
            Fake.cancel_mid = False
            if s.get("state") != "cancelled":
                problems.append(f"cancel did not end as cancelled: {s}")
            left = [p.name for p in paths.SOURCES.iterdir() if p.name != "credits.json"]
            if left or (paths.SOURCES / ".ytdl").exists():
                problems.append(f"a cancelled download left files behind: {left}")
            Fake.dl_error = RuntimeError("ERROR: [youtube] bbbbbbbbbbb: Private video. Sign in if you've been granted access")
            s = wait(ytdl.start(f"https://youtu.be/{D}")["id"])
            Fake.dl_error = None
            if s.get("state") != "failed" or s.get("code") != "private":
                problems.append(f"a failed download should say it is private: {s}")
            if [p.name for p in paths.SOURCES.iterdir() if p.name != "credits.json"]:
                problems.append("a failed download left files behind")
            # an old leftover (the server died mid-download) is swept at the next start
            (paths.SOURCES / ".ytdl" / "deadbeef").mkdir(parents=True)
            (paths.SOURCES / ".ytdl" / "deadbeef" / "video.mp4.part").write_bytes(b"x")
            ytdl.clean_stale()
            if (paths.SOURCES / ".ytdl").exists():
                problems.append("a stale temporary folder was not swept")
            # no ffmpeg: said before anything starts
            with mock.patch("klipian.ytdl.shutil.which", return_value=None):
                if code_of(ytdl.start, f"https://youtu.be/{D}") != "no_ffmpeg":
                    problems.append("no ffmpeg should be reported before the download starts")

        # --- what yt-dlp says, as the person reads it
        table = {
            "ERROR: [youtube] x: Private video. Sign in": "private",
            "ERROR: [youtube] x: Video unavailable. This video has been removed by the uploader": "removed",
            "ERROR: [youtube] x: This video is not available": "removed",
            "ERROR: [youtube] x: Sign in to confirm your age. This video may be inappropriate": "age",
            "ERROR: [youtube] x: This video is available to this channel's members on level: Gold (members-only content)": "paywall",
            "ERROR: [youtube] x: This live event will begin in 2 hours.": "live",
            "ERROR: [youtube] x: Premieres in 3 days": "live",
            "ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>": "network",
            "ERROR: unable to download video data: HTTP Error 403: Forbidden": "outdated",
            "ERROR: [youtube] x: Sign in to confirm you\u2019re not a bot": "outdated",
            "ERROR: [youtube] Requested format is not available": "outdated",
            "ERROR: Postprocessing: ffprobe and ffmpeg not found": "no_ffmpeg",
            "ERROR: Something nobody has seen before": "other",
            "\x1b[0;31mERROR:\x1b[0m [youtube] x: Private video": "private",
        }
        for text, want in table.items():
            got = ytdl.map_error(RuntimeError(text))
            if got.code != want or not got.message or "\x1b" in got.message:
                problems.append(f"'{text[:60]}' came out as {got.code}, wanted {want}")
        if ytdl.map_error(ConnectionError("x")).code != "network":
            problems.append("a ConnectionError is a network error")
        with as_profile("yta"):
            Fake.err = RuntimeError("ERROR: [youtube] x: Private video")
            if code_of(ytdl.preview, f"https://youtu.be/{C}") != "private":
                problems.append("an error from yt-dlp in the preview was not mapped")
            Fake.err = None

        # --- the JavaScript runtime (YouTube's signature challenge): a refusal without one is not "outdated"
        Fake.js = {"runtime": None, "path": None, "ejs": True}
        no_js = {
            "ERROR: unable to download video data: HTTP Error 403: Forbidden": "js_runtime",
            "ERROR: [youtube] x: Sign in to confirm you\u2019re not a bot": "js_runtime",
            "ERROR: [youtube] Requested format is not available": "js_runtime",
            "WARNING: nsig extraction failed: Some formats may be missing": "js_runtime",
            "ERROR: [youtube] x: Private video. Sign in": "private",
            "ERROR: [youtube] x: Sign in to confirm your age": "age",
            "ERROR: Unable to download webpage: getaddrinfo failed": "network",
        }
        for text, want in no_js.items():
            got = ytdl.map_error(RuntimeError(text))
            if got.code != want:
                problems.append(f"without a JS runtime '{text[:50]}' came out as {got.code}, wanted {want}")
        m = ytdl.map_error(RuntimeError("HTTP Error 403: Forbidden"))
        if "No JavaScript runtime found" not in m.message or "Node.js" not in m.message or "outdated" in m.message.lower():
            problems.append(f"the js_runtime sentence: {m.message!r}")
        if ytdl.status()["jsRuntime"] is not None:
            problems.append("the status should say there is no JavaScript runtime")
        Fake.js = {"runtime": "node", "path": "node", "ejs": False}
        got = ytdl.map_error(RuntimeError("HTTP Error 403: Forbidden"))
        if got.code != "js_runtime" or "yt-dlp-ejs" not in got.message:
            problems.append(f"a runtime without the solver should say so: {got.code} {got.message!r}")
        Fake.js = {"runtime": "node", "path": "node", "ejs": True}
        if ytdl.map_error(RuntimeError("HTTP Error 403: Forbidden")).code != "outdated":
            problems.append("with a runtime and the solver, a 403 stays 'outdated'")
        st = ytdl.status()
        if st["jsRuntime"] != "node" or st["ejs"] is not True:
            problems.append(f"the status should name the runtime: {st}")

        # --- the real error is kept: returned as detail, logged, nothing secret in either
        with as_profile("yta"):
            log = Path(paths.profile_dir()) / "ytdl.log"
            log.unlink(missing_ok=True)
            Fake.js = {"runtime": None, "path": None, "ejs": True}
            Fake.dl_error = RuntimeError("ERROR: unable to download video data: HTTP Error 403: Forbidden\n"
                                         "url https://rr1.googlevideo.com/videoplayback?expire=1&sig=SECRETSIG&n=NN&key=yt8\n"
                                         "Cookie: SID=SECRETCOOKIE")
            with contextlib.redirect_stderr(io.StringIO()) as console:
                s = wait(ytdl.start(f"https://youtu.be/{D}")["id"])
            Fake.dl_error = None
            Fake.js = {"runtime": "node", "path": "node", "ejs": True}
            if s.get("state") != "failed" or s.get("code") != "js_runtime":
                problems.append(f"a 403 without a runtime should fail as js_runtime: {s}")
            if not str(s.get("detail", "")).startswith("ERROR: unable to download video data: HTTP Error 403"):
                problems.append(f"the job should carry the first line of the real error: {s.get('detail')!r}")
            blob = json.dumps(s) + (log.read_text(encoding="utf-8") if log.is_file() else "") + console.getvalue()
            if "SECRETSIG" in blob or "SECRETCOOKIE" in blob or "SID=" in blob:
                problems.append("a token or cookie reached the detail, the log or the console")
            if not log.is_file() or "403" not in log.read_text(encoding="utf-8") or "[ytdl]" not in console.getvalue():
                problems.append("the real error was not written to ytdl.log and the console")
            if len(s.get("report", "").splitlines()) > 20:
                problems.append("the report should be cut at 20 lines")
            with contextlib.redirect_stderr(io.StringIO()):
                Fake.err = RuntimeError("ERROR: [youtube] x: Something odd happened")
                try:
                    ytdl.preview(f"https://youtu.be/{C}")
                except ytdl.YtError as exc:
                    if not exc.extra.get("detail", "").startswith("ERROR: [youtube] x: Something odd"):
                        problems.append(f"a preview failure should carry the detail too: {exc.extra}")
                Fake.err = None

        # --- the real network layer: js_runtimes passed (deno first, else node, else none), the quality picks the format
        seen_opts = []

        class FakeYT:
            class YoutubeDL:
                def __init__(self, opts):
                    seen_opts.append(opts)

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

                def extract_info(self, url, download=False):
                    return {}

                def download(self, urls):
                    pass

        real = ytdl._Net()
        real.module = lambda: FakeYT
        for have, want in (({"deno": "/bin/deno", "node": "/bin/node"}, "deno"), ({"node": "/bin/node"}, "node"), ({}, None)):
            with mock.patch("klipian.ytdl.shutil.which", side_effect=lambda n, have=have: have.get(n)):
                seen_opts.clear()
                real.info("u")
                real.download("u", Path("."), lambda d: None, "ff")
                for o in seen_opts:
                    jr = o.get("js_runtimes")
                    if (want is None and jr is not None) or (want and jr != {want: {"path": have[want]}}):
                        problems.append(f"js_runtimes with {sorted(have)} on the PATH: {jr}")
        seen_opts.clear()
        real.info("u", 720)
        real.download("u", Path("."), lambda d: None, "ff", 720)
        real.info("u")
        if "height<=720" not in seen_opts[0]["format"] or "height<=720" not in seen_opts[1]["format"] \
                or "height<=1080" not in seen_opts[2]["format"] or "720" in seen_opts[2]["format"]:
            problems.append("the quality should choose the format (1080 is the default)")
        with as_profile("yta"):
            Fake.qualities.clear()
            ytdl.preview(f"https://youtu.be/{E}", 720)
            ytdl.preview(f"https://youtu.be/{E}", "banana")
            if Fake.qualities != [720, 1080] or ytdl.preview(f"https://youtu.be/{E}", 720)["quality"] != 720:
                problems.append(f"the preview did not pass the quality on: {Fake.qualities}")
        req = (Path(paths.ROOT) / "requirements-download.txt").read_text(encoding="utf-8")
        if not any(ln.strip().startswith("yt-dlp[default]") for ln in req.splitlines()):
            problems.append("requirements-download.txt must ask for yt-dlp[default] (it brings yt-dlp-ejs)")
        with as_profile("yta"):
            ran = []
            with mock.patch("klipian.ytdl.subprocess.run", side_effect=lambda cmd, **kw: ran.append(cmd) or type(
                    "P", (), {"returncode": 0, "stdout": "", "stderr": ""})()):
                wait(ytdl.start_update())
            if not ran or "yt-dlp[default]" not in ran[0] or "-U" not in ran[0]:
                problems.append(f"Update yt-dlp should run pip install -U yt-dlp[default]: {ran}")

        # --- yt-dlp not installed
        Fake.installed = False
        with as_profile("yta"):
            st = ytdl.status()
            if st["installed"] or "pip install" not in st["command"] or "requirements-download.txt" not in st["command"]:
                problems.append(f"the status should say yt-dlp is missing and how to install it: {st}")
            if code_of(ytdl.start, f"https://youtu.be/{C}") != "missing":
                problems.append("a download without yt-dlp should say it is missing")
            if code_of(ytdl.preview, f"https://youtu.be/{C}") != "missing":
                problems.append("a preview without yt-dlp should say it is missing")
        Fake.installed = True
        ytdl._net = real_net
        if importlib.util.find_spec("yt_dlp") is None:
            with as_profile("yta"):
                if code_of(ytdl.preview, URL_A) != "missing":
                    problems.append("the real network layer should report yt-dlp missing when it is not installed")
        ytdl._net = Fake

        # --- over HTTP (the Guest is allowed)
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet = contextlib.redirect_stderr(io.StringIO())
        quiet.__enter__()

        def call(method, path, profile=None, body=None):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
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
                return r.status, {}

        try:
            if call("GET", "/api/ytdl/status")[0] != 400:
                problems.append("/api/ytdl/status without a profile should be refused")
            st, j = call("GET", "/api/ytdl/status", "yta")
            if st != 200 or not j.get("installed") or j.get("version") != "2099.01.01":
                problems.append(f"/api/ytdl/status: {st} {j}")
            st, j = call("POST", "/api/ytdl/preview", "yta", {"url": "https://vimeo.com/1"})
            if st != 400 or j.get("code") != "not_youtube":
                problems.append(f"a link that is not YouTube over HTTP: {st} {j}")
            st, j = call("POST", "/api/ytdl/preview", paths.GUEST, {"url": f"https://youtu.be/{E}"})
            if st != 200 or j.get("title") != "Guest video":
                problems.append(f"the Guest could not preview: {st} {j}")
            st, j = call("POST", "/api/ytdl/start", paths.GUEST, {"url": f"https://youtu.be/{E}"})
            if st != 200 or not j.get("id"):
                problems.append(f"the Guest could not start a download: {st} {j}")
            else:
                t0 = time.time()
                s = {}
                while time.time() - t0 < 15:
                    st, s = call("GET", f"/api/ytdl/state?id={j['id']}", paths.GUEST)
                    if s.get("state") in ("done", "failed", "cancelled"):
                        break
                    time.sleep(0.05)
                if s.get("state") != "done":
                    problems.append(f"the Guest's download: {s}")
                elif not (paths.profile_dir(paths.GUEST) / "sources" / s["name"]).is_file() \
                        or not credits.load(paths.profile_dir(paths.GUEST) / "sources").get(s["name"]):
                    problems.append("the Guest's video or credit is not in the Guest's sources")
                # another profile cannot read this job
                if call("GET", f"/api/ytdl/state?id={j['id']}", "yta")[1].get("state") != "missing":
                    problems.append("one profile can see another's download job")
            if call("POST", "/api/ytdl/cancel", "yta", {"id": "nothing"})[1].get("state") != "missing":
                problems.append("cancelling an unknown job should say it is missing")
        finally:
            quiet.__exit__(None, None, None)
            srv.shutdown()
    finally:
        hush.__exit__(None, None, None)
        ytdl._net = real_net
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "names, credit with link in all hashtag modes, no second download, cancel/fail clean, errors, JS runtime handling, real error kept (detail, log, no secrets), quality, missing yt-dlp"


def check_refresh() -> tuple[str, str]:
    """The automatic check of Scheduled rows (youtube.refresh_due), against a fake Google: which
    rows are due (date and time past, with the grace), 50 ids per call, public -> Posted, still
    scheduled stays, locked / removed -> a warning on the row (said once), other profiles untouched,
    not connected / offline / nothing due as quiet answers, the 10-minute throttle (kept across a
    restart; the manual Check status ignores it), and the Guest refused."""
    import contextlib
    import datetime as dt
    import http.client
    import io
    import threading
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, recycle, schedule, youtube
    from .server import Handler

    problems = []
    calls: list[list[str]] = []
    singles: list[str] = []

    class FakeNet:
        statuses: dict = {}
        offline = False

        @classmethod
        def refresh(cls, token):
            if cls.offline:
                raise youtube.YouTubeError("offline", "Could not reach Google.")
            return token

        @classmethod
        def channels(cls, token):
            return {"id": "UCrf", "title": "Rf Channel", "thumb": ""}

        @classmethod
        def video_statuses(cls, token, ids):
            if cls.offline:
                raise youtube.YouTubeError("offline", "Could not reach Google.")
            calls.append(list(ids))
            return {i: dict(cls.statuses.get(i) or {"gone": True}) for i in ids}

        @classmethod
        def video_status(cls, token, vid):
            singles.append(vid)
            return dict(cls.statuses.get(vid) or {"gone": True})

        @classmethod
        def revoke(cls, token):
            pass

    PUBLIC = {"privacy": "public", "upload": "processed"}
    SCHED = {"privacy": "private", "upload": "processed", "publishAt": "2031-01-01T00:00:00Z"}
    LOCKED = {"privacy": "private", "upload": "processed"}

    def connect(pid):
        profiles.write_meta(pid, {"name": pid, "color": "#123456"})
        profiles.ensure_dirs(pid)
        tok = paths.set_profile(pid)
        try:
            good = {"installed": {"client_id": "1.apps.googleusercontent.com", "client_secret": "s"}}
            youtube.save_client_secret(json.dumps(good))
            youtube._write_token_file({"token": {"token": "T", "refresh_token": "R"},
                                       "channel": {"id": "UCrf", "title": "Rf Channel", "thumb": ""},
                                       "state": "ok", "checkedAt": 1})
        finally:
            paths._profile.reset(tok)

    def when(minutes_ago):
        t = dt.datetime.now() - dt.timedelta(minutes=minutes_ago)
        return t.strftime("%Y-%m-%d"), t.strftime("%H:%M")

    def put(pid, rows):
        tok = paths.set_profile(pid)
        try:
            schedule.save_clips(rows)
        finally:
            paths._profile.reset(tok)

    def rows_of(pid):
        tok = paths.set_profile(pid)
        try:
            return {r["id"]: r for r in schedule.load_clips()}
        finally:
            paths._profile.reset(tok)

    def refresh(pid, age=None):
        """refresh_due as profile `pid`; `age` pretends the last check was that many seconds ago."""
        tok = paths.set_profile(pid)
        try:
            if age is not None:
                youtube._set_last_refresh(int(time.time()) - age)
            return youtube.refresh_due()
        finally:
            paths._profile.reset(tok)

    real_net, real_bin = youtube._net, recycle.to_recycle_bin
    youtube._net = FakeNet
    recycle.to_recycle_bin = lambda p: Path(p).unlink()
    youtube._REFRESH_LAST.clear()
    try:
        for pid in ("rf1", "rf2", "rf3", "rf4"):
            connect(pid) if pid != "rf4" else (profiles.write_meta(pid, {"name": pid, "color": "#123456"}), profiles.ensure_dirs(pid))
        d3, t3 = when(3)
        d1, t1 = when(1)
        df, tf = (dt.datetime.now() + dt.timedelta(days=2)).strftime("%Y-%m-%d"), "10:00"

        def row(i, vid, status="Scheduled", date=d3, time_=t3, **kw):
            return {"id": i, "title": f"T {i}", "status": status, "videoId": vid, "date": date, "time": time_, **kw}

        FakeNet.statuses = {"vA": PUBLIC, "vB": SCHED, "vC": LOCKED, "vG": PUBLIC, "vZ": PUBLIC,
                            "vP": {"privacy": "private", "upload": "uploaded"}}
        put("rf1", [row("A", "vA"), row("B", "vB"), row("C", "vC"), row("D", "vD"),
                    row("E", "vE", date=df, time_=tf),               # not due: in the future
                    row("F", "vF", date=d1, time_=t1),               # not due yet: inside the grace
                    row("H", "vH", status="Posted"),                 # already Posted
                    row("I", "", status="Scheduled"),                # never uploaded
                    row("P", "vP")])                                 # still processing
        put("rf2", [row("Z", "vZ")])                                 # another profile's due row
        ZBEFORE = rows_of("rf2")

        # --- due rows are checked in one call; the answers are applied
        r = refresh("rf1")
        if len(calls) != 1 or sorted(calls[0]) != ["vA", "vB", "vC", "vD", "vP"]:
            problems.append(f"only the due rows should be asked for, in one call: {calls}")
        got = rows_of("rf1")
        if r["checked"] != 5 or r["posted"] != ["A"] or got["A"]["status"] != "Posted":
            problems.append(f"a public video should become Posted: {r}")
        if got["B"]["status"] != "Scheduled" or got["B"].get("ytWarning"):
            problems.append(f"a video still scheduled on YouTube must stay as it is: {got['B']}")
        kinds = {w["id"]: w["kind"] for w in r["warnings"]}
        if kinds != {"C": "locked", "D": "removed", "P": "processing"} or got["C"]["ytWarning"] != "locked" \
                or got["D"]["ytWarning"] != "removed" or not got["C"].get("ytWarningText"):
            problems.append(f"locked / removed / processing should be warnings on the row: {r['warnings']}")
        if got["C"]["status"] != "Scheduled" or got["E"]["status"] != "Scheduled" or got["F"].get("ytWarning"):
            problems.append("a warning must not change the status, and rows not due are not touched")
        if r["skipped"] is not None or not r["nextCheckAt"] > time.time():
            problems.append(f"a normal check has no skipped reason and a next time: {r}")
        if rows_of("rf2") != ZBEFORE or any("vZ" in c for c in calls):
            problems.append("another profile's row was asked about or changed")

        # --- the throttle: nothing is sent within 10 minutes, even after a restart; Check status ignores it
        n = len(calls)
        r2 = refresh("rf1")
        if r2["skipped"] != "throttled" or len(calls) != n or r2["checked"]:
            problems.append(f"a second check within 10 minutes should send nothing: {r2}")
        youtube._REFRESH_LAST.clear()                                # a restart: the time is read from the file
        r2 = refresh("rf1")
        if r2["skipped"] != "throttled" or len(calls) != n:
            problems.append("the throttle was lost when the server restarted")
        tok = paths.set_profile("rf1")
        try:
            youtube.video_status("C")
        finally:
            paths._profile.reset(tok)
        if singles != ["vC"]:
            problems.append(f"the manual Check status should ask at once, whatever the throttle: {singles}")

        # --- later: the warnings are not repeated; a locked video that went public is Posted and cleared
        r3 = refresh("rf1", age=601)
        if len(calls) != n + 1 or r3["warnings"] or r3["posted"]:
            problems.append(f"the same warnings must not be reported again: {r3}")
        FakeNet.statuses["vC"] = PUBLIC
        r3 = refresh("rf1", age=601)
        got = rows_of("rf1")
        if r3["posted"] != ["C"] or got["C"]["status"] != "Posted" or got["C"].get("ytWarning"):
            problems.append(f"a video that went public should become Posted and lose its warning: {r3} {got['C']}")

        # --- the 50-id batches: 70 videos are 2 calls
        put("rf3", [row(f"R{i}", f"v{i}") for i in range(70)])
        FakeNet.statuses = {f"v{i}": PUBLIC for i in range(70)}
        before = len(calls)
        r4 = refresh("rf3")
        sizes = [len(c) for c in calls[before:]]
        if sizes != [50, 20] or r4["checked"] != 70 or len(r4["posted"]) != 70:
            problems.append(f"70 videos should be asked for in calls of 50 and 20: {sizes} {r4['checked']}")

        # --- quiet answers: not connected, offline, nothing due
        put("rf4", [row("N", "vN")])
        before = len(calls)
        r5 = refresh("rf4")
        if r5["skipped"] != "not connected" or len(calls) != before or r5["checked"]:
            problems.append(f"a profile that is not connected should be skipped quietly: {r5}")
        FakeNet.offline = True
        put("rf1", [row("W", "vW")])
        r5 = refresh("rf1", age=601)
        FakeNet.offline = False
        if r5["skipped"] != "offline" or rows_of("rf1")["W"]["status"] != "Scheduled":
            problems.append(f"offline should be a quiet skip that changes nothing: {r5}")
        put("rf1", [row("E", "vE", date=df, time_=tf)])
        r5 = refresh("rf1", age=601)
        if r5["skipped"] != "nothing due" or r5["checked"]:
            problems.append(f"with nothing due the answer is 'nothing due': {r5}")

        # --- over HTTP: the Guest is refused, a profile gets the same answer shape
        refresh("rf1", age=5)                                        # a check just happened
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet = contextlib.redirect_stderr(io.StringIO())
        quiet.__enter__()
        try:
            def call(profile):
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
                conn.request("POST", "/api/youtube/refresh-due", body=b"{}",
                             headers={"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile,
                                      "Content-Type": "application/json"})
                resp = conn.getresponse()
                raw = resp.read()
                conn.close()
                return resp.status, (json.loads(raw) if raw else {})
            if call(paths.GUEST)[0] != 403:
                problems.append("the Guest should be refused (403)")
            st, j = call("rf1")
            if st != 200 or not j.get("ok") or j.get("skipped") != "throttled" or "nextCheckAt" not in j or "posted" not in j:
                problems.append(f"the endpoint's answer: {st} {j}")
        finally:
            quiet.__exit__(None, None, None)
            srv.shutdown()
    finally:
        youtube._net, recycle.to_recycle_bin = real_net, real_bin
        youtube._REFRESH_LAST.clear()
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "due/grace, 50-id batches, Posted, scheduled stays, warnings once, throttle (restart, manual bypass), quiet skips, other profiles untouched, Guest 403"


def check_manual() -> tuple[str, str]:
    """A clip row with a video of its own (out/manual/): the upload and its name cleaning, the same
    bytes reused and a different file with the same name kept as " (2)", the title made from the
    file name, the file resolved and flagged when missing, the upload checks accepting it, the
    History listing, "Add to schedule" for a manual file, and the Guest refused."""
    import contextlib
    import http.client
    import io
    import threading
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, schedule, youtube
    from .ffmpeg_tools import _require, run
    from .server import Handler

    problems = []
    profiles.write_meta("mn1", {"name": "mn1", "color": "#123456"})
    profiles.ensure_dirs("mn1")
    tok = paths.set_profile("mn1")
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    try:
        # --- the title from a file name
        for name, want in (("bela_diri-pagi.mp4", "Bela Diri Pagi"), ("Bela-Diri Pagi.mp4", "Bela Diri Pagi"),
                           ("udah  siap__lagi.mov", "Udah Siap Lagi"), ("x" * 150 + ".mp4", "X" + "x" * 99)):
            if schedule.title_from_file(name) != want:
                problems.append(f"title from {name[:30]!r}: {schedule.title_from_file(name)[:40]!r}, wanted {want[:40]!r}")

        ff = _require("ffmpeg")
        work = paths.workspace_dir() / "mn-src"
        work.mkdir(parents=True, exist_ok=True)
        vertical, vertical2, wide = work / "v1.mp4", work / "v2.mp4", work / "wide.mp4"
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=108x192:d=1:r=10", "-pix_fmt", "yuv420p", str(vertical)], desc="a vertical clip", timeout=60)
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=green:s=108x192:d=1:r=10", "-pix_fmt", "yuv420p", str(vertical2)], desc="another vertical clip", timeout=60)
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=192x108:d=1:r=10", "-pix_fmt", "yuv420p", str(wide)], desc="a wide clip", timeout=60)

        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def call(method, path, profile="mn1", body=None, raw=None):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=60)
            headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
            data = raw
            if body is not None:
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            elif raw is not None:
                headers["Content-Type"] = "application/octet-stream"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            content = r.read()
            conn.close()
            try:
                return r.status, json.loads(content)
            except ValueError:
                return r.status, {}

        def put(path, name):
            return call("POST", "/api/workspace/clips/file?name=" + __import__("urllib.parse").parse.quote(name), raw=path.read_bytes())

        # --- the upload: a clean name, the same bytes reused, a different file kept apart
        st, a = put(vertical, 'Bela_Diri  "Pagi" .mp4')
        manual = schedule.manual_dir()
        if st != 200 or a.get("file") != "Bela_Diri Pagi.mp4" or a.get("folder") != "manual" or a.get("existed") \
                or a.get("title") != "Bela Diri Pagi" or not (manual / "Bela_Diri Pagi.mp4").is_file():
            problems.append(f"the manual upload: {st} {a}")
        st, b = put(vertical, "other name.mp4")
        if st != 200 or b.get("file") != "Bela_Diri Pagi.mp4" or not b.get("existed"):
            problems.append(f"the same bytes should reuse the file that is there: {st} {b}")
        st, c = put(vertical2, "Bela_Diri Pagi.mp4")
        if st != 200 or c.get("file") != "Bela_Diri Pagi (2).mp4" or c.get("existed"):
            problems.append(f"a different file with the same name should become (2): {st} {c}")
        if put(wide, "wide.txt")[0] != 400:
            problems.append("a file that is not mp4/mov/webm should be refused")
        if [p.name for p in manual.glob(".*")]:
            problems.append("temporary upload files were left behind")
        if call("POST", "/api/workspace/clips/file?name=x.mp4", paths.GUEST, raw=b"abc")[0] != 403:
            problems.append("the Guest should be refused (no clips table)")

        # --- a row with that file
        rid, _ = schedule.add_file_row("Bela Diri Pagi", "Bela_Diri Pagi.mp4", None)
        schedule.set_fields(rid, {"fileFolder": "manual", "description": "Satu kalimat.", "date": "", "time": ""})
        row = schedule.get_row(rid)
        if schedule.row_file(row) != manual / "Bela_Diri Pagi.mp4" or schedule.row_file_created(row) is None:
            problems.append("the row's file was not found in out/manual")
        if any(r.get("fileMissing") for r in schedule.with_missing_flags([row])):
            problems.append("a manual row whose file is there must not be flagged")
        # the upload checks accept it (vertical, short, title), and refuse a wide one like any other file
        try:
            spec = youtube.prepare(row, publish_now=True)
            if Path(spec["file"]) != manual / "Bela_Diri Pagi.mp4":
                problems.append(f"prepare used another file: {spec['file']}")
        except youtube.YouTubeError as exc:
            problems.append(f"prepare refused a good manual row: {exc.message}")
        shutil.copy2(wide, manual / "wide clip.mp4")
        rid2, _ = schedule.add_file_row("Wide", "wide clip.mp4", None)
        schedule.set_fields(rid2, {"fileFolder": "manual"})
        try:
            youtube.prepare(schedule.get_row(rid2), publish_now=True)
            problems.append("a wide manual video was accepted")
        except youtube.YouTubeError as exc:
            if "vertical" not in exc.message.lower():
                problems.append(f"a wide manual video should be refused as not vertical: {exc.message}")
        # History lists the file under "manual", and it is already in the schedule
        st, h = call("GET", "/api/history")
        listed = {(r["video"], r["file"]): r for r in h.get("render", [])}
        got = listed.get(("manual", "Bela_Diri Pagi.mp4"))
        if not got or got.get("scheduled") is not True:
            problems.append(f"History should list the manual file as scheduled: {got}")
        # a manual file with no row can be added to the schedule, and the row knows it is a manual one
        shutil.copy2(vertical2, manual / "Tanpa Baris.mp4")
        st, j = call("POST", "/api/workspace/clips/from-render", body={"folder": "manual", "file": "Tanpa Baris.mp4"})
        added = schedule.get_row(j.get("id", "")) or {}
        if st != 200 or added.get("fileFolder") != "manual" or schedule.row_file(added) is None:
            problems.append(f"'Add to schedule' for a manual file: {st} {j} {added}")
        # deleting the row never deletes the video
        schedule.delete_rows([rid])
        if not (manual / "Bela_Diri Pagi.mp4").is_file():
            problems.append("deleting the row removed the video file")
        # the file goes missing: flagged, and the upload says so
        (manual / "Bela_Diri Pagi.mp4").unlink()
        row = schedule.get_row(rid) or {**row}
        if not schedule.with_missing_flags([row])[0].get("fileMissing") or schedule.row_file(row) is not None:
            problems.append("a manual row whose file is gone should be flagged fileMissing")
        try:
            youtube.prepare(row, publish_now=True)
            problems.append("prepare accepted a manual row whose file is gone")
        except youtube.YouTubeError as exc:
            if "file deleted" not in exc.message:
                problems.append(f"a missing manual file should say 'file deleted': {exc.message}")
    finally:
        if srv:
            quiet.__exit__(None, None, None)
            srv.shutdown()
        paths._profile.reset(tok)
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "upload and name cleaning, same bytes reused, (2) on a clash, title from the name, file resolved and flagged, upload checks, History, Add to schedule, Guest 403"


def check_captions() -> tuple[str, str]:
    """When caption words are on screen: lines break at pauses and sentence ends (per_line is a
    maximum), short gaps are bridged and long ones leave the screen empty, "As spoken" hides the
    words not yet said while "Whole line" shows them, the last word keeps a short tail -- in the
    planner, in the .ass text build_ass writes (plain, square-box and rounded-box styles), and in
    the editor's JS (ui/js/shared/captionplan.js, run with node) on the same word list."""
    import contextlib
    import re
    from unittest import mock
    import shutil as _sh
    import subprocess
    from . import render
    from .models import Word
    from .render import RenderJob, Span, build_ass, caption_at, caption_plan

    problems = []
    # (start, end, text): a 0.2 s gap is bridged, a 0.3 s gap (inside a line) is not, a 0.8 s pause splits a
    # line, a full line (3) splits, a full stop splits, a comma splits only after two words
    W = [(0.00, 0.30, "Halo,"),       # a comma after ONE word: no split
         (0.50, 0.80, "semua"),       # 0.2 gap from "Halo," -> bridged
         (1.10, 1.40, "yang"),        # 0.3 gap: inside the line and bridged too (HOLD_GAP = PAUSE_SPLIT = 0.35)
         (1.45, 1.70, "hadir"),       # the line was full (3) -> new line
         (1.75, 2.00, "hari,"),       # a comma after the SECOND word: the line ends
         (2.05, 2.30, "ini."),        # a full stop: the line ends (a line of one word)
         (3.10, 3.40, "Lanjut"),      # a 0.8 s pause: new line
         (3.45, 3.70, "ya")]          # the last word
    lines = caption_plan(W, 3)
    got = [[w[2] for w in line["words"]] for line in lines]
    if got != [["Halo,", "semua", "yang"], ["hadir", "hari,"], ["ini."], ["Lanjut", "ya"]]:
        problems.append(f"the lines are wrong: {got}")
    wins = [[(round(s, 3), round(e, 3)) for s, e in line["windows"]] for line in lines]
    want = [[(0.0, 0.5), (0.5, 1.1), (1.1, 1.45)],       # bridged (0.2) | bridged (0.3) | bridged (0.05)
            [(1.45, 1.75), (1.75, 2.05)],
            [(2.05, 2.45)],                              # 2.30 + tail: the pause after it is empty
            [(3.1, 3.45), (3.45, 3.85)]]                 # the last word: 3.70 + tail
    if wins != want:
        problems.append(f"the windows are wrong: {wins}")
    one = caption_plan([(0.0, 0.3, "Satu,"), (0.4, 0.7, "dua")], 3)
    if [len(x["words"]) for x in one] != [2]:
        problems.append("a comma after the first word of a line must not split it")
    if [len(x["words"]) for x in caption_plan([(0, .3, "a"), (.35, .6, "b"), (.65, .9, "c"), (.95, 1.2, "d")], 3)] != [3, 1]:
        problems.append("per_line is a maximum: 4 words in a row make 3 + 1")
    if [len(x["words"]) for x in caption_plan([(0, .3, "a"), (.7, 1.0, "b")], 3)] != [1, 1]:
        problems.append("a pause above PAUSE_SPLIT must start a new line (a line of one word is fine)")
    # on screen: nothing during the long silence, the tail after the last word, short gaps bridged
    if caption_at(W, 3, "spoken", 2.6) is not None or caption_at(W, 3, "spoken", 2.44) is None:
        problems.append("the screen should be empty during a long pause and not before the tail is over")
    if caption_at(W, 3, "spoken", 3.84) is None or caption_at(W, 3, "spoken", 3.86) is not None:
        problems.append("the last word should keep a 0.15 s tail")
    if caption_at(W, 3, "spoken", 0.4) is None:
        problems.append("a gap of 0.2 s must be bridged (no flicker)")
    if caption_at(W, 3, "spoken", 0.97) is None:
        problems.append("a gap of 0.3 s inside a line is bridged: the text must not blank")
    # just under and just over the line-break gap: 0.34 s stays one line with no blank; 0.36 s is a new line
    # and the screen is empty between the tail and the next word
    near = caption_plan([(0.0, 0.3, "a"), (0.64, 0.9, "b")], 3)
    far = caption_plan([(0.0, 0.3, "a"), (0.66, 0.9, "b")], 3)
    if [len(x["words"]) for x in near] != [2] or near[0]["windows"][0] != (0.0, 0.64):
        problems.append(f"a gap of 0.34 s should be bridged inside one line: {near}")
    if [len(x["words"]) for x in far] != [1, 1] or abs(far[0]["windows"][0][1] - 0.45) > 1e-9             or caption_at([(0.0, 0.3, "a"), (0.66, 0.9, "b")], 3, "spoken", 0.5) is not None:
        problems.append(f"a gap of 0.36 s should start a new line and leave the screen empty after the tail: {far}")
    a1, a2 = caption_at(W, 3, "spoken", 0.2), caption_at(W, 3, "line", 0.2)
    if not (a1 and a2 and a1["shown"] == 1 and a2["shown"] == 3 and a1["highlight"] == a2["highlight"] == 0):
        problems.append(f"'As spoken' shows only the words said, 'Whole line' all of them: {a1} {a2}")

    # --- the .ass text, in the three highlight styles
    words = [Word(t, a, b) for a, b, t in W]
    job = RenderJob(title="t", spans=[Span(0.0, 4.0)])
    for hs in ("text", "box", "square"):
        for reveal in ("spoken", "line"):
            # "square" = the box without measurable fonts (libass draws it as BorderStyle 3)
            with mock.patch.object(render, "_measure", return_value=None) if hs == "square" else contextlib.nullcontext():
                ass = build_ass(job, words, {"highlight_style": "box" if hs == "square" else hs, "reveal": reveal, "watermark": False})
            events = re.findall(r"Dialogue: (\d),(\d+:\d\d:\d\d\.\d\d),(\d+:\d\d:\d\d\.\d\d),(Utama|Kotak),,[^,]*,[^,]*,[^,]*,,(.*)", ass)

            def secs(x):
                h, m, s = x.split(":")
                return int(h) * 3600 + int(m) * 60 + float(s)
            spans = [(secs(a), secs(b), txt) for _, a, b, _, txt in events]
            if not spans:
                problems.append(f"{hs}/{reveal}: no caption events were written")
                continue
            if any(s < 3.09 and e > 2.46 for s, e, _ in spans):
                problems.append(f"{hs}/{reveal}: text is on screen during the pause between 2.45 and 3.10")
            if max(e for _, e, _ in spans) > 3.86:
                problems.append(f"{hs}/{reveal}: the last line stays longer than its tail: {max(e for _, e, _ in spans)}")
            body = [t for _, _, t in spans if "\\p1" not in t]
            if any("\\an1\\pos" in t for t in body):
                # rounded box: every word is its own event, so "hidden" means "not there yet"
                said = min(a for a, _, t in spans if t.endswith("semua") and "\\an1\\pos" in t)
                if abs(said - (0.5 if reveal == "spoken" else 0.0)) > 0.011:
                    problems.append(f"{hs}/{reveal}: 'semua' appears at {said}")
            else:
                hidden = [t for t in body if "\\alpha&HFF&" in t or "\\1a&HFF&" in t]
                if reveal == "spoken" and not hidden:
                    problems.append(f"{hs}/spoken: the words not yet said are not hidden")
                if reveal == "line" and hidden:
                    problems.append(f"{hs}/line: the whole line must show without hidden words")
            # the first event of the first line hides the two words that are not yet said, keeping their place
            first = min(spans)[2] if reveal == "spoken" and hs == "text" else ""
            if first and not re.search(r"\{\\c&H0000D6FF&\}Halo,\{\\c&H00FFFFFF&\} \{\\alpha&HFF&\}semua yang$", first):
                problems.append(f"the first event of 'As spoken' should show only 'Halo,': {first}")

    # --- the editor's JS on the same list
    node = _sh.which("node")
    js = Path(__file__).resolve().parent.parent / "ui" / "js" / "shared" / "captionplan.js"
    note = ""
    if not node or not js.is_file():
        note = " (the JS agreement was skipped: node is not installed)"
    else:
        driver = (
            "const m = require(process.argv[1]); const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
            "const used = input.words.map(([a, b, text]) => ({ a, b, text }));"
            "const plan = m.captionPlan(used, input.perLine).map((l) => ({ words: l.words.map((w) => w.text), windows: l.windows }));"
            "const at = input.times.map((t) => ['spoken', 'line'].map((r) => { const x = m.captionAt(used, input.perLine, r, t);"
            "  return x ? { words: x.words.map((w) => w.text), shown: x.shown, highlight: x.highlight } : null; }));"
            "process.stdout.write(JSON.stringify({ plan, at }));")
        times = [round(0.05 * i, 3) for i in range(0, 80)] + [0.4, 0.97, 1.02, 2.44, 2.6, 3.84, 3.86]
        payload = json.dumps({"words": W, "perLine": 3, "times": times})
        proc = subprocess.run([node, "-e", driver, str(js)], input=payload.encode("utf-8"), capture_output=True, timeout=60)
        if proc.returncode != 0:
            problems.append(f"node could not run captionplan.js: {proc.stderr.decode('utf-8', 'replace')[:200]}")
        else:
            out = json.loads(proc.stdout.decode("utf-8"))
            for pl, jl in zip(caption_plan(W, 3), out["plan"]):
                if [w[2] for w in pl["words"]] != jl["words"] or any(abs(x - y) > 1e-9 for a, b in zip(pl["windows"], jl["windows"]) for x, y in zip(a, b)):
                    problems.append(f"JS and Python disagree on a line: {pl} / {jl}")
            if len(out["plan"]) != len(caption_plan(W, 3)):
                problems.append("JS and Python disagree on the number of lines")
            for t, js_at in zip(times, out["at"]):
                for r, got in zip(("spoken", "line"), js_at):
                    py = caption_at(W, 3, r, t)
                    py = {"words": [w[2] for w in py["words"]], "shown": py["shown"], "highlight": py["highlight"]} if py else None
                    if py != got:
                        problems.append(f"JS and Python disagree at {t}s ({r}): {py} / {got}")
                        break
            note = " and the editor's JS agrees"
    if problems:
        return FAIL, "\n      ".join(problems[:12])
    return PASS, "lines break at pauses, silence is empty, As spoken hides future words, tails" + note


def check_renderreq() -> tuple[str, str]:
    """The render request built on the server from a saved project (renderreq.py): the requests of
    tests/fixtures/renderreq/ (a project with framing points, corrections, an overlay, volumes, two videos, a
    reversed Result and an empty one), spot-checked by hand below and compared with the checked-in expected
    requests. The proof against the REAL stored requests of a workspace is run by hand (docs/roadmap.md P23);
    this keeps the rules from drifting."""
    import copy
    from . import renderreq

    base = FIXTURES / "renderreq"
    project = _load(base / "project.json")
    expected = _load(base / "expected.json")
    words = {"ep1.mp4": [{"text": f"w{k}", "start": k * 0.5, "end": k * 0.5 + 0.4} for k in range(120)],
             "ep2.mp4": [{"text": f"v{k}", "start": 100 + k * 0.5, "end": 100 + k * 0.5 + 0.4} for k in range(20)]}
    sizes = {"ep1.mp4": (1920, 1080), "ep2.mp4": (1280, 720)}
    problems = []
    built = {}
    for rid in ("res1", "res2", "res3", "res4"):
        try:
            built[rid] = renderreq.build_request(project, rid, words_of=words.get, size_of=sizes.get)
        except renderreq.RequestError as exc:
            built[rid] = {"error": exc.code}
        problems += [f"{rid} {d}" for d in _diff(expected[rid], built[rid])]

    # by hand, so the expected file is not just a copy of what the code says
    c1 = built["res1"]["clips"][0]
    if [(s["start"], s["end"], s["crop"]["left"]) for s in c1["spans"]] != [(10, 15, 40), (15, 20, 60)]:
        problems.append("res1: the range should be split at the framing point inside it (15 s), and the point at 400 s ignored")
    if abs(c1["spans"][0]["crop"]["height"] - 20 * (16 / 9) * (16 / 9)) > 1e-9:
        problems.append("res1: a box's height follows its width and the shape of the source and of the picture (16:9 and 16:9)")
    if [(w["text"], w["start"]) for w in c1["words"] if w["start"] in (12.5, 13.0)] != [("Dikoreksi", 12.5), ("", 13.0)]:
        problems.append("res1: corrections are keyed by the word's start with three decimals, and an empty one is kept")
    if (c1["picture"], c1["background"], c1["position"], c1["width"], c1["quality"]) != ("16:9", "black", 30, 1440, 26):
        problems.append("res1: the output options are read by index in the saved order")
    if c1["style"] != {"font": "Impact", "size": 90, "highlight": "&H0076E600&", "highlight_style": "box", "position": 30,
                       "x": -5, "per_line": 2, "reveal": "line", "outline": 8, "watermark": True, "watermark_size": 40,
                       "watermark_opacity": "80", "watermark_y": 20, "watermark_x": 2}:
        problems.append(f"res1: the caption style (including 'Words appear') was not read from the project: {c1['style']}")
    if c1["title"] != "Satu" or "overlays" in c1 or "volumes" in c1:
        problems.append("res1: the title falls back to the first moment's; no overlays or volumes were asked for")
    c2 = built["res2"]["clips"][0]
    if built["res2"]["video"] != "ep1.mp4" or [s.get("video") for s in c2["spans"]] != [None, "ep2.mp4"] \
            or [s["start"] for s in c2["spans"]] != [5, 100]:
        problems.append(f"res2: spans are in the real seconds of their own video; only the other video names itself: {c2['spans']}")
    if any(w.get("video") != "ep2.mp4" for w in c2["words"][6:]) or [w["text"] for w in c2["words"][6:8]] != ["v0", "Ganti"]:
        problems.append("res2: words of the second video carry their file and its corrections (keyed on the shared timeline)")
    if c2["overlays"] != [{"kind": "label", "start": 1, "end": 7.25, "text": "Halo"}] \
            or c2["volumes"] != [{"start": 0.0, "end": 3.0, "volume": 0.5}]:
        problems.append(f"res2: overlays are cut to the clip's length (the second starts after it) and volumes are in output seconds: {c2.get('overlays')} {c2.get('volumes')}")
    if (c2["picture"], c2["background"], c2["position"], c2["width"], c2["quality"]) != ("9:16", "black", 50, 1080, 21):
        problems.append("res2: a Result with no saved output takes the defaults")
    c3 = built["res3"]["clips"][0]
    if [(s["start"], s["end"]) for s in c3["spans"]] != [(30, 35), (10, 12)] or c3["words"][0]["text"] != "w60" \
            or c3["words"][10]["text"] != "w20":
        problems.append("res3: spans keep the order they play in, and the words are listed as they will be heard")
    if [k["t"] for k in c3["spans"][1].get("tracking", [])] != [20.0, 22.0, 25.0]:
        problems.append("res3: a tracked point's keyframes are shifted to the start of each piece")
    if (c3["picture"], c3["background"], c3["position"]) != ("3:4", "black", 70):
        problems.append("res3: a Background that was never chosen (null) is black")
    if built["res4"] != {"error": "no_spans"}:
        problems.append("res4: a Result with no moments cannot be rendered")
    try:
        renderreq.build_request(project, "nope", words_of=words.get, size_of=sizes.get)
        problems.append("an unknown Result was accepted")
    except renderreq.RequestError as exc:
        if exc.code != "no_result":
            problems.append(f"an unknown Result: {exc.code}")
    # The default framing box: the FULL height of the source, as wide as the picture's shape needs on that source,
    # centred -- for an `auto` point (the untouched start point), whatever crop it has stored; a box the person
    # placed is never touched.
    def auto_project(picture, auto=True, stored=None):
        pr = copy.deepcopy(project)
        pr["results"] = [{"id": "resA", "title": "A", "corrections": {}, "output": [picture, 1, 1, 1, 50],
                          "segments": [{"id": "s1", "asset": "a1", "start": 10, "end": 20, "title": "t", "source": "manual"}],
                          "framing": [{"id": "f1", "asset": "a1", "at": 10, "format": "single",
                                       "crops": [stored or {"left": 1, "top": 2, "width": 3, "height": 4}], **({"auto": True} if auto else {})}]}]
        return pr

    def box(picture, size, **kw):
        pr = auto_project(picture, **kw)
        return renderreq.build_request(pr, "resA", words_of=words.get, size_of=lambda f: size)["clips"][0]["spans"][0]["crop"]

    for picture, size, want_w in ((0, (1920, 1080), 100 / (16 / 9 * 16 / 9)), (2, (1920, 1080), 100 / (16 / 9 * 4 / 3)),
                                  (0, (1440, 1080), 100 / (4 / 3 * 16 / 9)), (2, (1440, 1080), 100 / (4 / 3 * 4 / 3))):
        b = box(picture, size)
        if abs(b["width"] - want_w) > 1e-9 or abs(b["left"] - (100 - want_w) / 2) > 1e-9 or b["top"] != 0 or abs(b["height"] - 100) > 1e-9:
            problems.append(f"default box for picture {picture} on {size}: {b}, wanted width {want_w}")
    if abs(box(0, (1920, 1080))["width"] - 31.640625) > 1e-9:
        problems.append("a 9:16 box on a 16:9 source should be 31.64% wide")
    tall = box(0, (1080, 2400))                          # too tall a source: the width would pass 100%
    if (tall["left"], tall["width"]) != (0, 100) or abs(tall["height"] - 100 * 0.45 * 16 / 9) > 1e-6 or abs(tall["top"] - (100 - tall["height"]) / 2) > 1e-9:
        problems.append(f"the clamp: full width, the height that fits, centred: {tall}")
    mine = box(0, (1920, 1080), auto=False, stored={"left": 37, "top": 4, "width": 26, "height": 92})
    if (mine["left"], mine["top"], mine["width"]) != (37, 4, 26):
        problems.append(f"a box the person placed must be used as it is: {mine}")
    if box(0, (1920, 1080), auto=True, stored={"left": 37, "top": 4, "width": 26, "height": 92})["width"] == 26:
        problems.append("an auto point's stored box must not be used")
    # no framing at all: the same default
    bare = auto_project(0)
    bare["results"][0]["framing"] = []
    nb = renderreq.build_request(bare, "resA", words_of=words.get, size_of=lambda f: (1920, 1080))["clips"][0]["spans"][0]["crop"]
    if abs(nb["width"] - 31.640625) > 1e-9 or nb["top"] != 0:
        problems.append(f"a Result with no framing points should get the default box: {nb}")

    # An Output Format applied to SEVERAL Results (the Results list, "Output format..."): each chosen Result's
    # request changes, and the one that was not chosen, and the one that cannot be rendered, do not.
    changed = copy.deepcopy(project)
    applied = [1, 0, 2, 0, 20]                     # 16:9 · 720p · Best · Blur · position 20 (app.js OPTIONS order)
    for r in changed["results"]:
        if r["id"] in ("res1", "res2"):
            r["output"] = list(applied)
    again = {rid: renderreq.build_request(changed, rid, words_of=words.get, size_of=sizes.get) for rid in ("res1", "res2", "res3")}
    for rid in ("res1", "res2"):
        cc = again[rid]["clips"][0]
        if (cc["picture"], cc["background"], cc["position"], cc["width"], cc["quality"]) != ("16:9", "blur", 20, 720, 17):
            problems.append(f"an applied Output Format did not reach the request of {rid}: {cc['picture']} {cc['background']} {cc['position']} {cc['width']} {cc['quality']}")
    if again["res3"] != built["res3"]:
        problems.append("a Result that was not chosen changed when others got a new Output Format")
    # only the Picture changed, the rest kept (the "keep each Result's own" choice): width, quality, position stay
    only = copy.deepcopy(project)
    for r in only["results"]:
        if r["id"] == "res1":
            r["output"] = [2] + list(r["output"][1:])          # Picture 3:4, everything else as it was
    o1 = renderreq.build_request(only, "res1", words_of=words.get, size_of=sizes.get)["clips"][0]
    if (o1["picture"], o1["width"], o1["quality"], o1["position"]) != ("3:4", c1["width"], c1["quality"], c1["position"]):
        problems.append("changing only the Picture must leave resolution, quality and position as they were")
    # JavaScript rounding: halves go up, and a second video's seconds lose their offset to the microsecond
    if renderreq._js_round(2.5) != 3 or renderreq._js_round(-0.5) != 0 or renderreq._unshift(1000100.123456789, 1e6) != 100.123457:
        problems.append("the JavaScript rounding is not reproduced")
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "4 Results built from a saved project equal the expected requests (framing split, corrections, two videos, overlays, volumes)"


def check_batch() -> tuple[str, str]:
    """Rendering Results of a saved project (jobs.start_project_render): the server builds each request,
    runs them one after another, every finished clip records its last request and makes its schedule Draft
    row (none for the Guest), one clip or all can be cancelled, and a Result that cannot be rendered is
    refused with a reason. Real renders of the baseline's short test video."""
    import os
    from . import jobs, paths, profiles, schedule
    from .projects import PROJECTS_DIR, _read_project, _write_project, read_render_records

    video = "podcast-test.mp4"
    if not (paths.SOURCES / video).is_file():
        return SKIP, f"{video} is not available here"
    problems = []

    def result(rid, start, title, **more):
        return {"id": rid, "title": "", "segments": [{"id": "r1", "asset": "a1", "start": start, "end": start + 1.5,
                                                      "title": title, "source": "ai"}],
                "framing": [], "corrections": {}, "output": [0, 0, 2, None, 50],
                "post": {"title": f"Post {title}", "caption": "Teks.", "hashtags": ["#a", "#b"]}, **more}

    def make_project(pid, results, assets=None):
        _write_project(PROJECTS_DIR / f"{pid}.json", {
            "id": pid, "name": "Batch", "assets": assets or [{"id": "a1", "kind": "video", "file": video}],
            "activeAsset": "a1", "results": results, "activeResult": results[0]["id"], "candidates": [],
            "caption": {"per-line": 1}, "at": 1, "createdAt": 1})

    def wait(job_id, limit=120):
        t0 = time.time()
        while time.time() - t0 < limit:
            with jobs.LOCK:
                t = jobs.JOBS.get(job_id)
                state = t["state"] if t else "missing"
            if state != "running":
                return state
            time.sleep(0.1)
        return "timeout"

    pid = "00a1b2c3d4e5"
    make_project(pid, [result("res1", 3.0, "Satu"), result("res2", 5.0, "Dua"), result("res3", 7.0, "Tiga"),
                       {"id": "res4", "title": "", "segments": [], "framing": [], "corrections": {}},
                       result("res5", 9.0, "Lima")])
    try:
        # --- all in order; refused ones listed with a reason
        started = jobs.start_project_render(pid, ["res1", "res4", "res2", "nope", "res3"])
        if [r["result"] for r in started["refused"]] != ["res4", "nope"] \
                or [r["code"] for r in started["refused"]] != ["no_spans", "no_result"]:
            problems.append(f"refused Results: {started['refused']}")
        state = wait(started["id"])
        batch = dict(jobs.JOBS[started["id"]])
        items = batch["items"]
        if state != "done" or [i["state"] for i in items] != ["done"] * 3 or [i["result"] for i in items] != ["res1", "res2", "res3"]:
            problems.append(f"the batch did not render the three Results in order: {state} {[(i['result'], i['state'], i.get('error')) for i in items]}")
        files = [i.get("output", {}).get("file") for i in items]
        out_dir = paths.OUT_ROOT
        found = [next(iter(out_dir.glob(f"*/{f}")), None) for f in files if f]
        if len(found) != 3 or not all(found):
            problems.append(f"the rendered files are not in the project's out folder: {files}")
        if [i.get("schedule", {}).get("created") for i in items] != [True, True, True]:
            problems.append(f"every clip should make its schedule Draft row: {[i.get('schedule') for i in items]}")
        rows = schedule.load_clips()
        by_result = {r.get("resultId"): r for r in rows}
        if sorted(by_result) != ["res1", "res2", "res3"] or by_result["res2"]["title"] != "Post Dua" or by_result["res1"]["status"] != "Draft":
            problems.append(f"the schedule rows: {[(r.get('resultId'), r.get('title'), r.get('status')) for r in rows]}")
        records = read_render_records(pid)
        if sorted(records) != ["res1", "res2", "res3"]:
            problems.append(f"the last request of each Result should be stored: {sorted(records)}")
        else:
            from . import renderreq
            words_of, size_of = jobs._request_adapters()
            want = renderreq.build_request(_read_project(PROJECTS_DIR / f"{pid}.json"), "res2", words_of=words_of, size_of=size_of)
            if records["res2"]["request"] != want:
                problems.append("the stored last request is not the one the server built")

        # --- cancel one clip that is still queued: the others go on
        started = jobs.start_project_render(pid, ["res1", "res2", "res3"])
        jobs.cancel_job(started["id"], 2)
        state = wait(started["id"])
        states = [i["state"] for i in jobs.JOBS[started["id"]]["items"]]
        if state != "done" or states != ["done", "done", "cancelled"]:
            problems.append(f"cancelling one queued clip: {state} {states}")

        # --- cancel the clip that is rendering: the next one still renders
        started = jobs.start_project_render(pid, ["res1", "res2"])
        for _ in range(100):                                # until the first one runs
            if jobs.JOBS[started["id"]]["items"][0]["state"] == "running" and jobs.JOBS[started["id"]]["items"][0].get("job"):
                break
            time.sleep(0.02)
        jobs.cancel_job(started["id"], 0)
        state = wait(started["id"])
        states = [i["state"] for i in jobs.JOBS[started["id"]]["items"]]
        if state != "done" or states[1] != "done" or states[0] not in ("cancelled", "done"):
            problems.append(f"cancelling the running clip must not stop the next one: {state} {states}")

        # --- cancel all
        before = len(schedule.load_clips())
        started = jobs.start_project_render(pid, ["res5", "res1", "res2"])
        jobs.cancel_job(started["id"])
        state = wait(started["id"])
        items = jobs.JOBS[started["id"]]["items"]
        if state != "cancelled" or any(i["state"] not in ("cancelled", "done") for i in items) \
                or [i["state"] for i in items[1:]] != ["cancelled", "cancelled"]:
            problems.append(f"Cancel all: {state} {[i['state'] for i in items]}")
        if len(schedule.load_clips()) != before + (1 if items[0]["state"] == "done" else 0):
            problems.append("a cancelled clip must not make a schedule row")

        # --- a source that is not in this profile's sources
        make_project("00a1b2c3d4e6", [result("res1", 3.0, "X")], [{"id": "a1", "kind": "video", "file": "gone.mp4"}])
        try:
            jobs.start_project_render("00a1b2c3d4e6", ["res1"])
            problems.append("a Result whose video is not in the sources was accepted")
        except ValueError as exc:
            if "gone.mp4" not in str(exc):
                problems.append(f"a missing source should be named: {exc}")
        try:
            jobs.start_project_render("ffffffffffff", ["res1"])
            problems.append("an unsaved project was accepted")
        except ValueError:
            pass

        # --- the Guest renders, and makes no schedule row
        gtok = paths.set_profile(paths.GUEST)
        try:
            profiles.ensure_dirs(paths.GUEST)
            src = paths.SOURCES / video
            if not src.exists():
                os.link(paths.profile_dir("selftest") / "sources" / video, src)
            make_project("00a1b2c3d4e7", [result("res1", 3.0, "Tamu")])
            started = jobs.start_project_render("00a1b2c3d4e7", ["res1"])
            state = wait(started["id"])
            it = jobs.JOBS[started["id"]]["items"][0]
            if state != "done" or it["state"] != "done" or it.get("schedule"):
                problems.append(f"the Guest renders without a schedule row: {state} {it}")
        finally:
            paths._profile.reset(gtok)
    finally:
        for f in (PROJECTS_DIR).glob("00a1b2c3d4e*.json"):
            f.unlink(missing_ok=True)
    if problems:
        return FAIL, "\n      ".join(problems[:8])
    return PASS, "3 Results in order, refusals with reasons, schedule rows and last requests, cancel one / the running one / all, the Guest"


def check_claude() -> tuple[str, str]:
    """Find clips with Claude through the API (claude_api.py) with a FAKE client: nothing here reaches the
    network, and no real key is used. The request (streamed, adaptive thinking, the static part cached, no
    sampling parameters, no prefill), the model chosen, structured output and the plain-text fallback, usage
    and cost recorded, every error class mapped, a refusal and a cut-off reply imported as nothing, cancel,
    the key never in a response or a log, the SDK missing."""
    import contextlib
    import http.client
    import io
    import os
    import threading
    from datetime import datetime, timezone
    from http.server import ThreadingHTTPServer
    from types import SimpleNamespace as NS
    from . import claude_api as ca, paths, profiles, roundtrip
    from .cache import Cache
    from .models import Transcript
    from .server import Handler

    problems = []
    SECRET = "sk-ant-TESTSECRET-0123456789"

    # ---- a fake SDK: the classes carry the real SDK's names (the mapping reads the names)
    class AnthropicError(Exception):
        pass

    class APIError(AnthropicError):
        def __init__(self, message="x", status_code=None):
            super().__init__(message)
            self.message, self.status_code = message, status_code

    class APIConnectionError(APIError):
        pass

    class APITimeoutError(APIConnectionError):
        pass

    class APIStatusError(APIError):
        pass

    def status_class(name, code, base=APIStatusError):
        return type(name, (base,), {"code": code})

    AuthenticationError = status_class("AuthenticationError", 401)
    PermissionDeniedError = status_class("PermissionDeniedError", 403)
    NotFoundError = status_class("NotFoundError", 404)
    BadRequestError = status_class("BadRequestError", 400)
    RequestTooLargeError = status_class("RequestTooLargeError", 413)
    RateLimitError = status_class("RateLimitError", 429)
    InternalServerError = status_class("InternalServerError", 500)
    OverloadedError = status_class("OverloadedError", 529)
    ServiceUnavailableError = status_class("ServiceUnavailableError", 503)

    GOOD = json.dumps({"source": "x", "clips": [
        {"start": "0:10", "end": "0:30", "title": "Satu", "hook": "halo", "scores": {"hook": 8, "complete": 8, "payoff": 8},
         "reason": "bagus", "post": {"title": "Judul", "caption": "Teks.", "hashtags": ["#a", "#b"]}}]})

    class Fake:
        """The client and the SDK module in one."""
        def __init__(self):
            self.keys, self.streams, self.counts, self.closed = [], [], [], False
            self.model_list = [NS(id="claude-opus-4-8", display_name="Claude Opus 4.8", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
                           NS(id="claude-opus-5-5", display_name="Claude Opus 5.5", created_at=datetime(2026, 6, 1, tzinfo=timezone.utc)),
                           NS(id="claude-sonnet-5", display_name="Claude Sonnet 5", created_at=datetime(2026, 7, 1, tzinfo=timezone.utc)),
                           NS(id="other-thing", display_name="x", created_at=datetime(2026, 8, 1, tzinfo=timezone.utc))]
            self.list_error = None
            self.retrieve_error = None
            self.script = []                       # what each stream call does: an Exception to raise, or a dict
            self.slow = 0.0
            self.sdk = True

        # -- the SDK module
        def available(self):
            return self.sdk

        def client(self, api_key):
            if not self.sdk:
                raise ca.ClaudeError("no_sdk", "not installed", command="pip install")
            self.keys.append(api_key)
            return self

        # -- the client
        @property
        def messages(self):
            return self

        def count_tokens(self, **kw):
            self.counts.append(kw)
            if self.count_error and "format" in kw["output_config"]:
                raise self.count_error
            return NS(input_tokens=48000)

        count_error = None

        def stream(self, **kw):
            self.streams.append(kw)
            return Fake.Stream(self, kw, self.script.pop(0) if self.script else {})

        class Stream:
            def __init__(self, fake, kw, plan):
                self.fake, self.kw, self.plan = fake, kw, plan

            def __enter__(self):
                if isinstance(self.plan, BaseException):
                    raise self.plan
                return self

            def __exit__(self, *a):
                return False

            def __iter__(self):
                yield NS(type="content_block_start", content_block=NS(type="thinking"))
                for _ in range(int(self.fake.slow * 20)):
                    time.sleep(0.05)
                    yield NS(type="ping")
                yield NS(type="content_block_start", content_block=NS(type="text"))

            def close(self):
                self.fake.closed = True

            def get_final_message(self):
                p = self.plan
                usage = NS(input_tokens=p.get("in", 1000), output_tokens=p.get("out", 2000),
                           cache_read_input_tokens=p.get("read", 0), cache_creation_input_tokens=p.get("write", 0))
                return NS(stop_reason=p.get("stop", "end_turn"), stop_details=p.get("details"), usage=usage,
                          content=[NS(type="thinking", thinking=""), NS(type="text", text=p.get("text", GOOD))])

    class ModelsApi:
        def __init__(self, fake):
            self.fake = fake

        def list(self):
            if self.fake.list_error:
                raise self.fake.list_error
            return iter(self.fake.model_list)

        def retrieve(self, mid):
            if self.fake.retrieve_error:
                raise self.fake.retrieve_error
            return NS(id=mid, display_name="Fake " + mid)

    Fake.models = property(lambda self: ModelsApi(self))
    fake = Fake()

    def wait(jid, limit=20):
        t0 = time.time()
        while time.time() - t0 < limit:
            s = ca.job_state(jid)
            if s.get("state") != "running":
                return s
            time.sleep(0.03)
        return ca.job_state(jid)

    # a transcript for the brief
    video = "claude-test.mp4"
    (paths.SOURCES / video).write_bytes(b"not a real video")
    cache = Cache(paths.CACHE_DIR)
    from .paths import GLOSSARY
    from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
    tpath = cache.transcript_path(paths.SOURCES / video, DEFAULT_MODEL, DEFAULT_LANGUAGE, GLOSSARY if GLOSSARY.is_file() else None)
    Transcript.load(FIXTURES / "brief" / "transcript.json").save(tpath)
    other = "claude-other.mp4"
    (paths.SOURCES / other).write_bytes(b"another one")
    Transcript.load(FIXTURES / "brief" / "transcript.json").save(cache.transcript_path(
        paths.SOURCES / other, DEFAULT_MODEL, DEFAULT_LANGUAGE, GLOSSARY if GLOSSARY.is_file() else None))

    from . import server as _server
    real_sdk = ca._sdk
    ca._sdk = fake
    saved_env = {k: os.environ.pop(k, None) for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    srv = None
    err = io.StringIO()
    quiet = contextlib.redirect_stderr(err)
    try:
        ca.save_settings(api_key=SECRET)
        parts = _server._claude_parts(video)

        # --- the model: the newest Opus of the account (not a Sonnet that is newer), else the one chosen
        job = ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video, count=9)
        s = wait(job)
        kw = fake.streams[-1]
        if s["state"] != "done" or s["model"] != "claude-opus-5-5":
            problems.append(f"the default model should be the newest Opus of the account: {s.get('model')} {s.get('message')}")
        if fake.keys[-1] != SECRET:
            problems.append("the saved key was not the one handed to the SDK")
        # --- the request: streamed, adaptive thinking, cached static part, no sampling, no prefill
        if kw["thinking"] != {"type": "adaptive"} or kw["max_tokens"] != ca.MAX_TOKENS or kw["model"] != "claude-opus-5-5":
            problems.append(f"request shape: {kw['thinking']} {kw['max_tokens']} {kw['model']}")
        if any(k in kw for k in ("temperature", "top_p", "top_k", "budget_tokens", "prefill")):
            problems.append("a sampling parameter was sent (current models reject them)")
        if kw["system"][0].get("cache_control") != {"type": "ephemeral"} or "Evaluation rubric" not in kw["system"][0]["text"]:
            problems.append("the static part (rubric, format) must be the system block with cache_control")
        if len(kw["messages"]) != 1 or kw["messages"][0]["role"] != "user" or "## Transcript" not in kw["messages"][0]["content"] \
                or "about 9 moments" not in kw["messages"][0]["content"] or video not in kw["messages"][0]["content"]:
            problems.append("the episode (and how many clips) belongs in the user message, with no assistant prefill")
        if kw["output_config"].get("effort") != "high" or kw["output_config"].get("format", {}).get("type") != "json_schema":
            problems.append(f"effort high and the JSON schema were expected: {kw['output_config']}")
        if video in kw["system"][0]["text"] or "about 9" in kw["system"][0]["text"]:
            problems.append("the system block must not change from one episode to the next (it is the cached part)")
        sysB = _server._claude_parts(other)(5)[0]
        if sysB != kw["system"][0]["text"]:
            problems.append("two episodes of one profile must share a byte-identical system block")
        if s.get("how") != "structured output" or len(s["candidates"]) != 1 or s["candidates"][0]["title"] != "Satu":
            problems.append(f"the structured reply was not imported like a pasted one: {s.get('how')} {s.get('candidates')}")

        # --- usage and cost: recorded per call, summed per month
        ca.save_settings(model="claude-opus-4-8")
        fake.script = [{"in": 2000, "out": 3000, "read": 40000, "write": 7000}]
        s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        want = (2000 * 5 + 40000 * 5 * 0.1 + 7000 * 5 * 1.25 + 3000 * 25) / 1e6
        if s["state"] != "done" or s["model"] != "claude-opus-4-8" or abs(s["usage"]["cost"] - round(want, 4)) > 1e-9 \
                or s["usage"]["cacheRead"] != 40000 or s["usage"]["cacheWrite"] != 7000:
            problems.append(f"usage and cost: {s.get('usage')} wanted {want}")
        total = ca.usage_summary()["months"][0]
        if total["calls"] != 2 or total["cacheRead"] != 40000 or abs(total["cost"] - (round(want, 4) + ca.cost_of("claude-opus-5-5", {"input": 1000, "output": 2000}))) > 1e-3:
            problems.append(f"the monthly total: {total}")

        # --- the plan: the exact request is counted, nothing is generated
        n = len(fake.streams)
        plan = ca.plan_find(parts, 9)
        c = fake.counts[-1]
        if plan["inputTokens"] != 48000 or plan["model"] != "claude-opus-4-8" or len(fake.streams) != n:
            problems.append(f"plan: {plan}")
        if "max_tokens" in c or c["thinking"] != {"type": "adaptive"} or c["system"][0].get("cache_control") is None:
            problems.append("the tokens must be counted for the very request that would be sent")
        if abs(plan["cost"]["low"] - round(48000 * 5 / 1e6 + ca.EXPECTED_OUTPUT_TOKENS * 25 / 1e6, 2)) > 1e-9 or plan["cost"]["assumed"]:
            problems.append(f"plan cost: {plan['cost']}")
        if ca.price_of("claude-opus-9-9") is None or not ca.price_of("claude-opus-9-9")[2] or ca.price_of("zzz") is not None:
            problems.append("an unknown Opus is priced as the family (assumed), an unknown model not at all")

        # --- the schema is refused (a 400 about the format): plain text and the repairs, and it says so
        fake.script = [BadRequestError("output_config.format: json_schema is not supported for this model", 400), {"text": "```json\n" + GOOD + "\n```"}]
        n = len(fake.streams)
        s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        if s["state"] != "done" or s["how"] != "plain text and the import repairs" or len(fake.streams) != n + 2 \
                or "format" in fake.streams[-1]["output_config"] or "format" not in fake.streams[-2]["output_config"]:
            problems.append(f"the plain-text fallback: {s.get('state')} {s.get('how')} {len(fake.streams) - n} calls")
        fake.count_error = BadRequestError("output_config.format is not supported", 400)
        if ca.plan_find(parts, 9)["structured"] is not False:
            problems.append("count_tokens should fall back to plain text too")
        fake.count_error = None

        # --- every error class
        cases = [(AuthenticationError("bad key", 401), "auth"), (PermissionDeniedError("no", 403), "permission"),
                 (NotFoundError("model", 404), "model"), (RateLimitError("slow", 429), "rate_limit"),
                 (OverloadedError("busy", 529), "overloaded"), (InternalServerError("boom", 500), "overloaded"),
                 (ServiceUnavailableError("down", 503), "overloaded"), (APIStatusError("teapot", 418), "api"),
                 (APIStatusError("gateway", 502), "overloaded"), (RequestTooLargeError("big", 413), "too_large"),
                 (BadRequestError("Your credit balance is too low to access the API", 400), "no_credit"),
                 (BadRequestError("messages: roles must alternate", 400), "bad_request"),
                 (APITimeoutError("t"), "timeout"), (APIConnectionError("c"), "offline"),
                 (AnthropicError("Could not resolve authentication method. Expected api_key"), "no_key"),
                 (RuntimeError("weird"), "other")]
        for exc, code in cases:
            fake.script = [exc]
            s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
            if s["state"] != "failed" or s.get("code") != code or SECRET in s.get("message", "") or s.get("candidates"):
                problems.append(f"{type(exc).__name__} should end as {code}: {s.get('state')} {s.get('code')} {s.get('message', '')[:60]}")

        # --- a refusal, a reply cut at max_tokens, an empty one, one that is not JSON: nothing is imported
        before = len(ca._read_usage())
        for plan_, code in (({"stop": "refusal", "details": NS(explanation="a policy")}, "refusal"),
                            ({"stop": "max_tokens", "text": GOOD[:60]}, "max_tokens"),
                            ({"text": "   "}, "empty"), ({"text": "this is not json at all"}, "bad_reply")):
            fake.script = [plan_]
            s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
            if s["state"] != "failed" or s.get("code") != code or "candidates" in s:
                problems.append(f"{code}: {s.get('state')} {s.get('code')} {'candidates' in s}")
            if code == "bad_reply" and s.get("reply") != "this is not json at all":
                problems.append("a reply that could not be read is kept for the manual import")
        if len(ca._read_usage()) != before + 4:
            problems.append("a call that cost tokens is recorded even when nothing is imported")

        # --- cancel: the stream is closed and nothing is imported or recorded
        fake.slow, fake.closed = 3.0, False
        before = len(ca._read_usage())
        fake.script = [{}]
        jid = ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video)
        time.sleep(0.4)
        ca.cancel(jid)
        s = wait(jid)
        fake.slow = 0.0
        if s["state"] != "cancelled" or not fake.closed or s.get("candidates") or len(ca._read_usage()) != before:
            problems.append(f"cancel: {s.get('state')} closed={fake.closed}")

        # --- settings: the key goes in and never comes out
        ca.save_settings(remove_key=True)
        if ca.key_source() != "none" or ca.load_settings().get("apiKey"):
            problems.append("the key was not removed")
        os.environ["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
        if ca.key_source() != "env":
            problems.append("ANTHROPIC_API_KEY should count as a key")
        del os.environ["ANTHROPIC_API_KEY"]
        ca.save_settings(api_key=SECRET, effort="low")
        try:
            ca.save_settings(effort="turbo")
            problems.append("an unknown effort was accepted")
        except ca.ClaudeError:
            pass
        if ca.status()["effort"] != "low" or SECRET in json.dumps(ca.status()):
            problems.append("the settings answer must not hold the key")
        fake.script = [{}]
        wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        if fake.streams[-1]["output_config"]["effort"] != "low":
            problems.append("the effort of the settings was not used")
        ca.save_settings(effort="high")

        # --- over HTTP: every answer is free of the key; the Guest can look for clips but not change the key
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()
        seen = []

        def call(method, path, profile="selftest", body=None):
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

        st, j = call("GET", "/api/claude/status")
        if st != 200 or not j["sdk"] or j["keySource"] != "saved" or "apiKey" in j:
            problems.append(f"status: {st} {j}")
        st, j = call("GET", "/api/claude/models")
        if st != 200 or j["newestOpus"] != "claude-opus-5-5" or [m["id"] for m in j["models"]][0] != "claude-sonnet-5":
            problems.append(f"models: {st} {j}")
        st, j = call("POST", "/api/claude/test", body={})
        if st != 200 or not j["ok"]:
            problems.append(f"test: {st} {j}")
        fake.retrieve_error = AuthenticationError("nope", 401)
        st, j = call("POST", "/api/claude/test", body={})
        fake.retrieve_error = None
        if st != 400 or j.get("code") != "auth":
            problems.append(f"a refused key on Test: {st} {j}")
        st, j = call("POST", "/api/claude/settings", body={"model": "claude-opus-4-8", "apiKey": SECRET})
        if st != 200 or SECRET in json.dumps(j) or j["model"] != "claude-opus-4-8":
            problems.append(f"settings: {st}")
        st, j = call("POST", "/api/claude/plan", body={"video": video, "count": 9})
        if st != 200 or j["inputTokens"] != 48000 or j["count"] != 9:
            problems.append(f"plan over HTTP: {st} {j}")
        st, j = call("POST", "/api/claude/plan", body={"video": "no-such.mp4"})
        if st != 400 or "transcript" not in j.get("error", "").lower():
            problems.append(f"plan with no transcript: {st} {j}")
        fake.script = [{}]
        st, j = call("POST", "/api/claude/find", body={"video": video, "count": 9})
        done = {}
        for _ in range(100):
            st2, done = call("GET", f"/api/claude/job?id={j.get('id')}")
            if done.get("state") != "running":
                break
            time.sleep(0.05)
        if st != 200 or done.get("state") != "done" or done["candidates"][0]["title"] != "Satu" or not done.get("usage"):
            problems.append(f"find over HTTP: {st} {done.get('state')} {done.get('message')}")
        gtok = paths.set_profile(paths.GUEST)
        try:
            profiles.ensure_dirs(paths.GUEST)
            (paths.SOURCES / video).write_bytes(b"guest copy")
        finally:
            paths._profile.reset(gtok)
        if call("POST", "/api/claude/settings", paths.GUEST, {"apiKey": "x"})[0] != 403:
            problems.append("the Guest must not change the key")
        if call("GET", "/api/claude/status", paths.GUEST)[0] != 200:
            problems.append("the Guest can see the status")
        st, j = call("GET", "/api/claude/usage")
        if st != 200 or not j["months"] or j["months"][0]["calls"] < 5:
            problems.append(f"usage over HTTP: {st} {str(j)[:120]}")
        if any(SECRET in raw for raw in seen) or SECRET in ca._usage_file().read_text(encoding="utf-8") \
                or SECRET in err.getvalue():
            problems.append("the API key appeared in a response, the usage log or a log")

        # --- the SDK is not installed
        fake.sdk = False
        st, j = call("GET", "/api/claude/status")
        if j.get("sdk") is not False:
            problems.append("status should say the SDK is missing")
        st, j = call("POST", "/api/claude/plan", body={"video": video})
        if st != 400 or j.get("code") != "no_sdk" or "requirements-claude.txt" not in j.get("command", "") + ca.install_command():
            problems.append(f"missing SDK: {st} {j}")
        fake.sdk = True
        ca._sdk = real_sdk
        import importlib.util
        if importlib.util.find_spec("anthropic") is None:
            try:
                real_sdk.client(None)
                problems.append("the real SDK layer should say the package is missing")
            except ca.ClaudeError as exc:
                if exc.code != "no_sdk":
                    problems.append(f"the real SDK layer: {exc.code}")
        ca._sdk = fake
    finally:
        if srv:
            quiet.__exit__(None, None, None)
            srv.shutdown()
        ca._sdk = real_sdk
        for k, v in saved_env.items():
            if v is not None:
                os.environ[k] = v
        for f in (ca._file(), ca._usage_file()):
            f.unlink(missing_ok=True)
        for n in (video, other):
            (paths.SOURCES / n).unlink(missing_ok=True)
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "request shape, model default, cached system block, structured/plain fallback, usage and cost, 16 error classes, refusal/max_tokens/empty/bad reply import nothing, cancel, key never leaks, no SDK"



def check_rubrics() -> tuple[str, str]:
    """Rubrics per niche (rubrics.py): every template passes the required-section check and goes into a brief
    with its own text and the hashtag block; a rubric in the workspace is listed, chosen and used; a deleted one
    falls back to dialog with a note; a bad id is refused; a rubric missing a section is refused naming it; the
    dialog brief stays what it was. Nothing is opened and nothing reaches the real Recycle Bin."""
    import contextlib
    import http.client
    import io
    import threading
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, recycle, roundtrip, rubrics
    from .cache import Cache
    from .models import Transcript
    from .server import Handler

    problems = []
    real_open, real_bin = rubrics._open, recycle.to_recycle_bin
    opened = []
    rubrics._open = opened.append
    recycle.to_recycle_bin = lambda path: Path(path).unlink(missing_ok=True)       # the scratch workspace: no bin
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    video = "rubric-test.mp4"
    try:
        transcript = Transcript.load(FIXTURES / "brief" / "transcript.json")
        rule = "TESTRULE: hashtags go first in the title."
        # --- every template is complete, and is what the brief carries
        names = [t["id"] for t in rubrics.templates()]
        if sorted(names) != ["edukasi", "gaming", "komedi-tv", "motivasi", "podcast"]:
            problems.append(f"templates found: {names}")
        for t in names:
            text = rubrics._read(rubrics._template_path(t))
            if rubrics.check(text):
                problems.append(f"template {t} lacks {rubrics.check(text)}")
            body = roundtrip.build_brief(transcript, text, "x.mp4", None, None, rule)
            api_sys, _ = roundtrip.build_api_brief(transcript, text, "x.mp4", None, None, rule, 5)
            marker = next(ln for ln in text.splitlines() if ln.startswith("### 1."))
            for label, out in (("brief", body), ("api brief", api_sys)):
                if marker not in out or "TESTRULE" not in out or "## Teks posting" not in out:
                    problems.append(f"{label} of template {t} lost its text or the hashtag block")
        for t in ("edukasi", "gaming", "komedi-tv", "motivasi"):
            if "podcast" in rubrics._read(rubrics._template_path(t)).lower():
                problems.append(f"template {t} still speaks of podcast")
        # --- the dialog rubric is the file as it was
        if rubrics.load("dialog") != ("dialog", roundtrip.read_rubric(roundtrip.RUBRICS["dialog"]), None) \
                or rubrics.load(None)[0] != "dialog" or rubrics.check(rubrics.load("dialog")[1]):
            problems.append("the dialog rubric changed or does not pass its own check")
        # --- a workspace rubric: made from a template, listed, chosen by the profile, used by the brief
        made = rubrics.create("komedi-tv", "Komedi Uji")
        if made != {"id": "komedi-uji", "name": "Komedi Uji"} or not (rubrics.workspace_dir() / "komedi-uji.md").is_file():
            problems.append(f"create: {made}")
        text = rubrics._read(rubrics.workspace_dir() / "komedi-uji.md")
        if not text.startswith("# Rubrik: Komedi Uji") or rubrics.check(text):
            problems.append("the copy should carry the new name and stay complete")
        for bad in (("komedi-tv", "Komedi Uji"), ("komedi-tv", "Dialog"), ("nope", "x"), ("../x", "x"), ("komedi-tv", "!!!")):
            try:
                rubrics.create(*bad)
                problems.append(f"create{bad} should have been refused")
            except rubrics.RubricError:
                pass
        listing = rubrics.list_all()
        if [r["id"] for r in listing["workspace"]] != ["komedi-uji"] or [r["id"] for r in listing["builtin"]] != ["dialog", "gameplay"]:
            problems.append(f"listing: {listing}")
        profiles.update("selftest", {"defaults": {"rubric": "komedi-uji"}})
        if profiles.defaults().get("rubric") != "komedi-uji":
            problems.append("the profile could not choose a workspace rubric")
        profiles.update("selftest", {"defaults": {"rubric": "../evil"}})
        if profiles.defaults().get("rubric") == "../evil":
            problems.append("a rubric id with a path in it was stored")
        profiles.update("selftest", {"defaults": {"rubric": "komedi-uji"}})
        # the brief uses it: through the server (pasted brief and the API's cached block)
        (paths.SOURCES / video).write_bytes(b"not a real video")
        from .paths import GLOSSARY
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
        transcript.save(Cache(paths.CACHE_DIR).transcript_path(paths.SOURCES / video, DEFAULT_MODEL, DEFAULT_LANGUAGE,
                                                                GLOSSARY if GLOSSARY.is_file() else None))
        from . import server as _server
        marker = next(ln for ln in text.splitlines() if ln.startswith("### 1."))
        sys1, _ = _server._claude_parts(video)(5)
        sys2, _ = _server._claude_parts(video)(9)
        if marker not in sys1 or sys1 != sys2:
            problems.append("the Claude brief should use the chosen rubric, byte-identical from one call to the next")
        dialog_sys, _ = _server._claude_parts(video, "dialog")(5)
        if marker in dialog_sys or dialog_sys == sys1:
            problems.append("an explicit rubric should override the profile's")

        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def call(method, path, profile="selftest", body=None):
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
            try:
                return r.status, json.loads(raw)
            except ValueError:
                return r.status, raw

        st, brief = call("GET", f"/api/brief?video={video}")
        if st != 200 or marker not in brief:
            problems.append(f"/api/brief with the profile's rubric: {st}")
        st, brief = call("GET", f"/api/brief?video={video}&mode=dialog")
        if st != 200 or marker in brief or "## Teks posting" not in brief:
            problems.append("/api/brief?mode=dialog should override")
        st, j = call("GET", "/api/rubrics")
        if st != 200 or j["current"]["id"] != "komedi-uji" or j["current"]["note"] or len(j["templates"]) != 5:
            problems.append(f"/api/rubrics: {st} {j}")
        for bad in ("../../etc/passwd", "A%20B", "x" * 41, "a/b"):
            st, j = call("GET", f"/api/brief?video={video}&mode={bad}")
            if st != 400:
                problems.append(f"mode {bad!r} should be refused: {st}")
        for path, body in (("/api/rubrics/delete", {"id": "../x"}), ("/api/rubrics/delete", {"id": "dialog"}),
                           ("/api/rubrics/open", {"id": "../x"}), ("/api/rubrics/create", {"template": "../x", "name": "q"})):
            st, j = call("POST", path, body=body)
            if st != 400 or j.get("ok") is not False:
                problems.append(f"{path} {body} should be refused: {st}")
        # --- open: the file in the workspace folder, or the folder
        st, j = call("POST", "/api/rubrics/open", body={"id": "komedi-uji"})
        st2, j2 = call("POST", "/api/rubrics/open", body={})
        if st != 200 or st2 != 200 or [Path(o).name for o in opened] != ["komedi-uji.md", "rubrics"]:
            problems.append(f"open: {st} {st2} {opened}")
        # --- the Guest can choose too: it lists, creates and briefs
        st, j = call("GET", "/api/rubrics", profile="_guest")
        st2, j2 = call("POST", "/api/rubrics/create", profile="_guest", body={"template": "edukasi", "name": "Edu Tamu"})
        if st != 200 or st2 != 200 or j2.get("id") != "edu-tamu":
            problems.append(f"guest: {st} {st2} {j2}")
        # --- a rubric that lost a section is refused, naming it; never sent out silently
        path = rubrics.workspace_dir() / "komedi-uji.md"
        path.write_bytes(path.read_bytes().replace(b"## Teks posting", b"## Teks"))
        st, j = call("GET", f"/api/brief?video={video}")
        if st != 400 or "Teks posting" not in j.get("error", ""):
            problems.append(f"a rubric without 'Teks posting' must be refused with its name: {st} {j}")
        try:
            _server._claude_parts(video)
            problems.append("the Claude brief must not be built from an incomplete rubric")
        except rubrics.RubricError as exc:
            if "Teks posting" not in str(exc):
                problems.append(f"the message should name the section: {exc}")
        st, j = call("GET", "/api/rubrics")
        mine = {r["id"]: r for r in j["workspace"]}
        if not any("Teks posting" in m for m in mine["komedi-uji"]["missing"]) or j["current"].get("id") is not None:
            problems.append(f"the listing should show what is missing: {mine['komedi-uji']}")
        # --- deleted: the profile falls back to dialog, with a note
        st, j = call("POST", "/api/rubrics/delete", body={"id": "komedi-uji"})
        if st != 200 or path.exists():
            problems.append(f"delete: {st}")
        st, j = call("GET", "/api/rubrics")
        if j["current"]["id"] != "dialog" or "komedi-uji" not in (j["current"]["note"] or ""):
            problems.append(f"a deleted rubric should fall back to dialog with a note: {j['current']}")
        st, brief = call("GET", f"/api/brief?video={video}")
        if st != 200 or "## Teks posting" not in brief:
            problems.append("the brief should still be made (with dialog) after the rubric was deleted")
        st, j = call("POST", "/api/rubrics/delete", body={"id": "komedi-uji"})
        if st != 400:
            problems.append("deleting what is gone should say so")
    finally:
        if srv:
            quiet.__exit__(None, None, None)
            srv.shutdown()
        rubrics._open, recycle.to_recycle_bin = real_open, real_bin
        (paths.SOURCES / video).unlink(missing_ok=True)
        for f in list(rubrics.workspace_dir().glob("*.md")):
            f.unlink(missing_ok=True)
        profiles.update("selftest", {"defaults": {"rubric": ""}})
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "5 templates complete and in the brief, workspace rubric listed/chosen/used (cached block byte-stable), deleted falls back with a note, bad ids refused, a missing section refused by name, dialog unchanged, Guest allowed"


def check_guide() -> tuple[str, str]:
    """The guide page (ui/guide.html): /guide is served with no profile, its stylesheet too, and every anchor the
    interface links to (/guide#...) and every entry of its table of contents exists in the page."""
    import contextlib
    import http.client
    import io
    import re
    import threading
    from http.server import ThreadingHTTPServer
    from .server import Handler

    problems = []
    page = (ROOT / "ui" / "guide.html").read_text(encoding="utf-8")
    ids = set(re.findall(r'\bid="([^"]+)"', page))
    for must in ("youtube", "youtube-status", "youtube-limits", "claude", "download", "profiles", "bulk", "youtube-client", "youtube-test-user",
                 "youtube-expired"):
        if must not in ids:
            problems.append(f"the guide lost its #{must} section")
    for anchor in re.findall(r'href="#([^"]+)"', page):
        if anchor not in ids:
            problems.append(f"the guide's own link #{anchor} points nowhere")
    linked = set()
    for f in list((ROOT / "ui").rglob("*.js")) + list((ROOT / "ui").rglob("*.html")):
        if f.name == "guide.html":
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        linked |= set(re.findall(r"/guide#([A-Za-z0-9_-]+)", text))
        linked |= set(re.findall(r'guideUrl\("#([A-Za-z0-9_-]+)"', text))
        for block in re.findall(r"YT_GUIDE = \{([^}]*)\}", text):
            linked |= set(re.findall(r'"([a-z-]+)"', block)) - {"none", "no_client", "expired", "different", "not_test_user", "offline", "no_library"}
    for anchor in sorted(linked):
        if anchor not in ids:
            problems.append(f"the interface links to /guide#{anchor}, which the guide does not have")
    if not linked:
        problems.append("expected the interface to link to the guide")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    quiet = contextlib.redirect_stderr(io.StringIO())
    quiet.__enter__()
    try:
        for path, needle in (("/guide", 'id="youtube"'), ("/guide/", 'id="bulk"'), ("/ui/css/guide.css", ".guide-toc")):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
            conn.request("GET", path, headers={"Host": f"127.0.0.1:{port}"})
            r = conn.getresponse()
            body = r.read().decode("utf-8", "replace")
            conn.close()
            if r.status != 200 or needle not in body:
                problems.append(f"GET {path}: {r.status}")
    finally:
        quiet.__exit__(None, None, None)
        srv.shutdown()
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, f"/guide and its stylesheet are served without a profile; the {len(linked)} anchors the interface links to and the table of contents all exist"


def check_timefield() -> tuple[str, str]:
    """The browser code's pure functions, run by node on tests/*.test.js: the masked time field (ui/js/editor/timefield.js:
    digits fill from the right, tenths, the shapes for a short and a long source, seconds and minutes above 59 refused,
    empty and garbage, formatting and the round trip) and the merge of Claude's reply for one Result into its fields
    (postreply.js). Skipped (with a note) when node is not installed."""
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        return PASS, "skipped: node is not installed (tests/*.test.js not run)"
    done = []
    for test in sorted((ROOT / "tests").glob("*.test.js")):
        proc = subprocess.run([node, str(test)], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        if proc.returncode != 0:
            return FAIL, f"{test.name}: " + (proc.stderr or proc.stdout).strip().splitlines()[-1][:300]
        done.append(proc.stdout.strip().splitlines()[-1])
    return PASS, "; ".join(done)


def check_resultpost() -> tuple[str, str]:
    """Post text for ONE Result through Claude chat (roundtrip.build_result_brief / parse_result_reply): the brief holds
    only that Result's words (corrections applied, times from the clip's start, two videos), the cues inside it, the
    credit context, the rubric's three sections and the hashtag rule; a rubric without a section is refused by name; a
    reply fills every field (tags normalised, note times in seconds), the .replace slip is repaired, a missing key is
    reported by name."""
    import copy
    import re
    from . import roundtrip

    base = FIXTURES / "renderreq"
    project = _load(base / "project.json")
    words = {"ep1.mp4": [{"text": f"w{k}", "start": k * 0.5, "end": k * 0.5 + 0.4} for k in range(120)],
             "ep2.mp4": [{"text": f"v{k}", "start": 100 + k * 0.5, "end": 100 + k * 0.5 + 0.4} for k in range(20)]}
    rubric = roundtrip.read_rubric(roundtrip.RUBRICS["dialog"])
    rule = "TESTRULE: the first 3 hashtags go in the title."
    credit = {"ep1.mp4": {"platform": "YouTube", "creator": "Raditya Dika", "title": "Ep Satu", "url": "https://youtu.be/x"}}
    laugh = [{"kind": "laughter", "start": 14.0, "end": 15.5, "level": "high", "peak": 0.9, "len": 1.5},
             {"kind": "laughter", "start": 50.0, "end": 51.0, "level": "high", "peak": 0.9, "len": 1.0}]
    problems = []

    def brief(rid, rub=rubric):
        return roundtrip.build_result_brief(project, rid, words_of=words.get, size_of=lambda f: (1920, 1080),
                                            cues_of=lambda f: laugh if f == "ep1.mp4" else [], credit_of=credit.get,
                                            rubric=rub, hashtag_rule=rule)

    b = brief("res1")                                     # moment 10-20 s of ep1, corrections at 12.5 and 13.0
    if "Dikoreksi" not in b or re.search(r"\bw25\b", b):
        problems.append("the corrected word should be in the brief and the one it replaced not")
    for k in (20, 21, 39):
        if not re.search(rf"\bw{k}\b", b):
            problems.append(f"a word of the clip (w{k}) is missing")
    for k in (0, 5, 19, 40, 100):
        if re.search(rf"\bw{k}\b", b):
            problems.append(f"a word outside the clip (w{k}) is in the brief")
    if "[0:00] w20" not in b:
        problems.append("times should start at 0:00 at the start of the clip")
    if "laughter · high" not in b or "[0:04]" not in b or b.count("laughter") != 1:
        problems.append("only the cue inside the clip should be listed, from the clip's start (14 s -> 0:04)")
    if "YouTube · Raditya Dika" not in b or "https://youtu.be/x" in b or "Do not write a credit" not in b:
        problems.append("the credit context should name the source, without the link, and forbid a credit line of Claude's own")
    for h in ("## Judul dan hook", "## Teks posting", "## Sudut pandang"):
        if h not in b:
            problems.append(f"the rubric section {h} is not in the brief")
    if "Jangan menulis baris kredit" not in b or "Jangan mengulang kutipan" not in b:
        problems.append("the rubric sections should come verbatim")
    if "## Lima kriteria" in b or "## Berapa klip" in b:
        problems.append("only the three sections of the rubric belong in this brief")
    if rule not in b or "Plain JSON only" not in b or '"angle"' not in b or '"youtubeTitle"' not in b or "START OF THE CLIP" not in b:
        problems.append("the hashtag rule, the JSON sentence and the reply shape belong in the brief")
    two = brief("res2")                                   # two videos
    if not re.search(r"\bv0\b", two) or "ep2.mp4" not in two or re.search(r"\bw30\b", two):
        problems.append("a Result of two videos: its words from both, no others")
    for rid, want in (("res4", "no time points"), ("nope", "not in the project")):
        try:
            brief(rid)
            problems.append(f"{rid} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{rid}: {exc}")
    try:
        brief("res1", rubric.replace("## Teks posting", "## Teks"))
        problems.append("a rubric without 'Teks posting' must be refused")
    except ValueError as exc:
        if "Teks posting" not in str(exc):
            problems.append(f"the message should name the section: {exc}")
    for tpl in ("komedi-tv", "edukasi", "gaming", "motivasi"):
        if "## Teks posting" not in brief("res1", roundtrip.read_rubric(ROOT / "prompts" / "rubrik" / "templates" / f"{tpl}.md")):
            problems.append(f"the {tpl} template should work for this brief")

    # the reply
    good = """Tentu, ini:
```json
{"title": "Rugi Karena Timing", "hook": "satu keputusan", "post": {"title": "Rugi 300 Juta", "caption": "Satu keputusan. Kamu pernah?",
 "hashtags": "bisnis, #podcast lucu", "youtubeTitle": "x"},
 "angle": {"take": "Keputusan kecil mahal.", "intro": "Satu keputusan ini", "notes": [{"at": "0:04", "text": "Dengar nadanya"}, {"at": "9:59", "text": "Jauh"}]}}
```"""
    f, notes = roundtrip.parse_result_reply(good, 10.0)
    if (f["title"], f["hook"]) != ("Rugi Karena Timing", "satu keputusan") or f["post"]["hashtags"] != ["#bisnis", "#podcast", "#lucu"] \
            or f["post"]["caption"] != "Satu keputusan. Kamu pernah?" or f["angle"]["take"] != "Keputusan kecil mahal." \
            or f["angle"]["intro"] != "Satu keputusan ini" or [n["at"] for n in f["angle"]["notes"]] != [4.0, 10.0] or notes:
        problems.append(f"a reply did not fill every field: {f} {notes}")
    slipped = good.replace('"Satu keputusan. Kamu pernah?"', '"Satu keputusan. Kamu pernah?".replace(" ", "")').replace('"Jauh"}]', '"Jauh"},]')
    f2, notes2 = roundtrip.parse_result_reply(slipped, 10.0)
    if f2["post"]["caption"] != "Satukeputusan.Kamupernah?" or len(notes2) != 2:
        problems.append(f"the .replace slip and the trailing comma should be repaired and said: {f2['post']['caption']} {notes2}")
    wrapped = '{"clips": [{"title": "Dari klip", "post": {"title": "T", "caption": "C", "hashtags": ["a"]}, "angle": {"take": "k", "intro": "i"}}]}'
    if roundtrip.parse_result_reply(wrapped, 10.0)[0]["title"] != "Dari klip":
        problems.append("a reply in the clips shape should be read from its first clip")
    broken = '{"title": "x", "post": {"title": "T", "hashtags": ["a"]}, "angle": {"intro": "i"}}'
    try:
        roundtrip.parse_result_reply(broken, 10.0)
        problems.append("a reply with missing keys should be refused")
    except ValueError as exc:
        for key in ("post.caption", "angle.take"):
            if key not in str(exc):
                problems.append(f"the message should name {key}: {exc}")
        if "post.title" in str(exc) or "angle.intro" in str(exc):
            problems.append(f"the message names something that is there: {exc}")
    for bad, want in (("no json here", "No JSON block"), ('{"title": "x", "post": {"a": }}', "broken")):
        try:
            roundtrip.parse_result_reply(bad, 10.0)
            problems.append(f"{bad!r} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{bad!r}: {exc}")
    # ONE brief for several Results, and the reply with one entry per Result
    def many(ids):
        return roundtrip.build_results_brief(project, ids, words_of=words.get, size_of=lambda f: (1920, 1080),
                                             cues_of=lambda f: laugh if f == "ep1.mp4" else [], credit_of=credit.get,
                                             rubric=rubric, hashtag_rule=rule)

    mb = many(["res1", "res2"])
    if "`res1`" not in mb or "`res2`" not in mb or not re.search(r"\bw20\b", mb) or not re.search(r"\bv0\b", mb) or re.search(r"\bw100\b", mb):
        problems.append("the brief of several Results should hold each one's own id and words, and nobody else's")
    if mb.count("## Teks posting") != 1 or mb.count(rule) != 1 or mb.count("Plain JSON only") != 1 or '"results"' not in mb:
        problems.append("the rubric sections, the hashtag rule and the JSON sentence belong once; the reply shape has a results list")
    if mb.count("[0:00]") < 2:
        problems.append("each clip's times start at 0:00")
    for ids, want in ((["res1", "res4"], "res4"), ([], "No Result")):
        try:
            many(ids)
            problems.append(f"{ids} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{ids}: {exc}")
    entry = lambda rid, **kw: {"id": rid, "title": "T " + rid, "post": {"title": "P", "caption": "C", "hashtags": ["a"]},   # noqa: E731
                               "angle": {"take": "k", "intro": "i"}, **kw}
    reply = "```json\n" + json.dumps({"results": [entry("res1"), entry("res2", hook="h"), entry("zzz")]}) + "\n```"
    got, notes = roundtrip.parse_results_reply(reply, {"res1": 10.0, "res2": 7.25})
    if sorted(got) != ["res1", "res2"] or got["res2"]["hook"] != "h" or got["res1"]["post"]["hashtags"] != ["#a"] or not any("zzz" in n for n in notes):
        problems.append(f"a reply of several Results: {sorted(got)} {notes}")
    for text, want in ((json.dumps({"results": [entry("res1")]}), "res2: no entry"),
                       (json.dumps({"results": [entry("res1"), {"id": "res2", "title": "x", "post": {"title": "P"}, "angle": {"take": "k"}}]}),
                        "res2: post.caption, post.hashtags, angle.intro"),
                       (json.dumps({"clips": []}), 'no "results" list')):
        try:
            roundtrip.parse_results_reply(text, {"res1": 10.0, "res2": 7.25})
            problems.append(f"{want!r} should have been refused")
        except ValueError as exc:
            if want not in str(exc) or ("res1:" in str(exc)):
                problems.append(f"the message should name {want!r} and only what is wrong: {exc}")
    one = roundtrip.parse_results_reply(json.dumps({k: v for k, v in entry("x").items() if k != "id"}), {"res1": 10.0})[0]
    if list(one) != ["res1"]:
        problems.append("a reply for a single clip without a list should be read for the one Result asked for")
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "the brief holds only the Result's words (corrections, clip times, two videos), cues inside it, credit context, the rubric's 3 sections, the hashtag rule; rubric sections refused by name; reply fills every field, slips repaired, missing keys named"


# --------------------------------------------------------------------------
# check: the shared queue for heavy jobs (sched.py), the file-keyed transcribe dedupe
# --------------------------------------------------------------------------

def check_sched() -> tuple[str, str]:
    """One heavy AI job at a time across profiles, renders limited to the setting (1 or 2), round-robin between
    profiles with a slot per batch ITEM, a waiting job can be cancelled, and a transcribe is shared by FILE
    (same bytes: one job; same name but another file: two jobs). Work is faked."""
    import os
    import threading
    from . import jobs, paths, profiles, sched
    from .jobs import JOBS, LOCK

    problems: list[str] = []
    for pid, name in (("sa", "Alpha"), ("sb", "Beta")):
        profiles.write_meta(pid, {"name": name, "color": "#123456"})
        profiles.ensure_dirs(pid)

    def in_profile(pid, fn, *a):
        def run():
            paths.set_profile(pid)
            fn(*a)
        th = threading.Thread(target=run, daemon=True)
        th.start()
        return th

    def until(cond, secs=5.0):
        end = time.time() + secs
        while time.time() < end:
            if cond():
                return True
            time.sleep(0.01)
        return False

    log: list[str] = []
    live = {"n": 0, "max": 0}
    lock = threading.Lock()

    def work(group, kind, jid, hold, tag, cancelled=lambda: False, update=None):
        with sched.slot(group, kind, jid, cancelled, update) as t:
            if t is None:
                with lock:
                    log.append(f"{tag}:cancelled")
                return
            with lock:
                live["n"] += 1
                live["max"] = max(live["max"], live["n"])
                log.append(tag)
            hold.wait(5)
            with lock:
                live["n"] -= 1

    saved_limit = sched.render_limit()
    try:
        # --- the setting: default 1, only 1 or 2, kept in a global file
        sched.set_render_limit(1)
        if sched.render_limit() != 1 or not (paths.workspace_dir() / "machine.json").is_file():
            problems.append("the render limit should default to 1 and live in workspace/machine.json")
        for bad in (0, 3, "x", None):
            try:
                sched.set_render_limit(bad)
                problems.append(f"render limit {bad!r} should be refused")
            except ValueError:
                pass

        # --- two transcribe-like jobs from two profiles run one after another; a third waits and is cancelled
        h1, h2, h3 = threading.Event(), threading.Event(), threading.Event()
        shown: dict[str, list] = {"b": [], "c": []}
        cancel_c = threading.Event()
        t1 = in_profile("sa", work, sched.GROUP_AI, "transcribe", "j1", h1, "T-A")
        until(lambda: "T-A" in log)
        t2 = in_profile("sb", work, sched.GROUP_AI, "transcribe", "j2", h2, "T-B", lambda: False, shown["b"].append)
        until(lambda: shown["b"])
        t3 = in_profile("sb", work, sched.GROUP_AI, "diarize", "j3", h3, "D-B", cancel_c.is_set, shown["c"].append)
        until(lambda: shown["c"])
        if not shown["b"] or "Alpha" not in shown["b"][-1]["text"] or shown["b"][-1]["position"] != 1 \
                or "transcription" not in shown["b"][-1]["text"]:
            problems.append(f"the waiting job should say it waits for Alpha's transcription at position 1: {shown['b'][-1:]}")
        until(lambda: shown["c"] and shown["c"][-1] and shown["c"][-1]["position"] == 2)
        if not shown["c"] or not shown["c"][-1] or shown["c"][-1]["position"] != 2:
            problems.append(f"the third job should be at position 2: {shown['c'][-1:]}")
        if log != ["T-A"]:
            problems.append(f"only the first job may run: {log}")
        cancel_c.set()
        sched.poke()
        until(lambda: "D-B:cancelled" in log)
        if "D-B:cancelled" not in log or shown["c"][-1] is not None:
            problems.append(f"a waiting job should leave the queue when cancelled (and its notice cleared): {log} {shown['c'][-1:]}")
        h1.set()
        until(lambda: "T-B" in log)
        if "T-B" not in log or shown["b"][-1] is not None:
            problems.append(f"the second profile's job should start after the first, and clear its waiting notice: {log}")
        h2.set()
        t1.join(5)
        t2.join(5)
        t3.join(5)
        if live["max"] != 1:
            problems.append(f"the AI group must never run two at once: max {live['max']}")

        # --- renders: 1 at a time, then 2 when the setting is raised while jobs wait
        log.clear()
        live.update(n=0, max=0)
        hs = [threading.Event() for _ in range(3)]
        ths = [in_profile("sa", work, sched.GROUP_RENDER, "render", f"r{i}", hs[i], f"R{i}") for i in range(3)]
        until(lambda: "R0" in log)
        time.sleep(0.2)
        if live["max"] != 1 or log != ["R0"]:
            problems.append(f"renders must run one at a time by default: {log} max {live['max']}")
        sched.set_render_limit(2)
        until(lambda: len(log) == 2)
        time.sleep(0.2)
        if live["max"] != 2 or sorted(log) != ["R0", "R1"]:
            problems.append(f"raising the limit to 2 should start exactly one more at once: {log} max {live['max']}")
        for h in hs:
            h.set()
        for th in ths:
            th.join(5)
        sched.set_render_limit(1)

        # --- round-robin: A's batch takes a slot per ITEM, B's two jobs wait together: A1, B1, A2, B2, A3, A4
        log.clear()
        gate = threading.Event()
        a_started = threading.Event()

        def batch_a():
            for i in range(1, 5):
                with sched.slot(sched.GROUP_RENDER, "render", f"A{i}"):
                    log.append(f"A{i}")
                    if i == 1:
                        a_started.set()
                        gate.wait(5)
                    else:
                        time.sleep(0.05)

        def one_b(i):
            with sched.slot(sched.GROUP_RENDER, "render", f"B{i}"):
                log.append(f"B{i}")
                time.sleep(0.05)

        ta = in_profile("sa", batch_a)
        a_started.wait(5)
        tb1 = in_profile("sb", one_b, 1)
        until(lambda: len(sched.snapshot()["render"]["waiting"]) == 1)
        tb2 = in_profile("sb", one_b, 2)
        until(lambda: len(sched.snapshot()["render"]["waiting"]) == 2)
        gate.set()
        for th in (ta, tb1, tb2):
            th.join(5)
        if log != ["A1", "B1", "A2", "B2", "A3", "A4"]:
            problems.append(f"profiles should take turns (a batch must not starve the other profile): {log}")

        # --- the real wrappers with faked work: batch items interleave with another profile's render, a waiting
        # item shows why it waits and can be cancelled, a waiting transcribe is "queued" and can be cancelled
        order: list[str] = []
        real_body, real_tbody, real_need = jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work
        hold = threading.Event()

        def fake_render(job_id, req, into=None, record=True):
            order.append(job_id)
            if req.get("hold"):
                hold.wait(5)
            else:
                time.sleep(0.05)
            with LOCK:
                JOBS[job_id].update(state="done", result=[{"file": job_id + ".mp4", "duration": 1, "mb": 0.1}])

        def fake_transcribe(job_id, req):
            order.append(job_id)
            hold.wait(5)
            with LOCK:
                JOBS[job_id]["state"] = "done"

        jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work = fake_render, fake_transcribe, lambda req: True
        try:
            items = [{"result": f"x{i}", "title": f"item {i}", "duration": 1, "layout": "9:16", "state": "queued",
                      "error": None, "cancel": False} for i in range(4)]
            jobs._register_job("bt", {"state": "running", "done": 0, "total": 4, "index": 0, "current": "", "result": [],
                                      "error": None, "batch": True, "items": items, "refused": []})
            reqs = [{"hold": i == 0} for i in range(4)]
            tbatch = in_profile("sa", jobs._run_batch, "bt", reqs)
            until(lambda: order == ["bt-0"])
            jobs._register_job("rb", {"state": "running", "done": 0, "total": 1, "index": 0, "current": "", "result": [], "error": None})
            trb = in_profile("sb", jobs._run_render, "rb", {"hold": False})
            until(lambda: JOBS["rb"].get("state") == "queued")
            with LOCK:
                qtext = (JOBS["rb"].get("queue") or {}).get("text", "")
            if "Alpha" not in qtext or "render" not in qtext:
                problems.append(f"a waiting render should say what it waits for: {qtext!r}")
            if not jobs.cancel_job("bt", 3):
                problems.append("a not-yet-started batch item should be cancellable")
            hold.set()
            tbatch.join(10)
            trb.join(10)
            if order[:3] != ["bt-0", "rb", "bt-1"] or "bt-3" in order:
                problems.append(f"the other profile's render should run between two items of the batch, and a cancelled item not at all: {order}")
            if [x["state"] for x in items] != ["done", "done", "done", "cancelled"]:
                problems.append(f"batch items: {[x['state'] for x in items]}")
            if JOBS["rb"]["state"] != "done" or "queue" in JOBS["rb"]:
                problems.append(f"a render that got its slot is done without a queue note: {JOBS['rb']}")

            # transcribes: A holds Whisper, B's is queued (state + text), then cancelled while queued
            order.clear()
            hold.clear()
            for jid in ("tr1", "tr2"):
                jobs._register_job(jid, {"state": "running", "key": "k" + jid, "stage": "start", "percent": 0})
            u1 = in_profile("sa", jobs._run_transcribe, "tr1", {"video": "none.mp4"})
            until(lambda: order == ["tr1"])
            u2 = in_profile("sb", jobs._run_transcribe, "tr2", {"video": "none.mp4"})
            until(lambda: JOBS["tr2"].get("state") == "queued")
            if "Alpha" not in (JOBS["tr2"].get("queue") or {}).get("text", ""):
                problems.append(f"a queued transcribe should name the profile it waits for: {JOBS['tr2'].get('queue')}")
            if not jobs.cancel_job("tr2"):
                problems.append("cancel_job should accept a queued job")
            u2.join(5)
            if JOBS["tr2"]["state"] != "cancelled" or "tr2" in order or "tr2" in jobs.CANCELLED:
                problems.append(f"a queued transcribe cancelled before it ran: {JOBS['tr2']} {order}")
            hold.set()
            u1.join(5)
        finally:
            jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work = real_body, real_tbody, real_need
            hold.set()

        # --- the transcribe dedupe is by FILE: same name + other bytes = two keys; a hardlinked/identical copy = one
        src_a, src_b = paths.profile_dir("sa") / "sources", paths.profile_dir("sb") / "sources"
        src_a.mkdir(parents=True, exist_ok=True)
        src_b.mkdir(parents=True, exist_ok=True)
        (src_a / "episode.mp4").write_bytes(b"aaaa" * 100)
        (src_b / "episode.mp4").write_bytes(b"bbbbbb" * 100)                    # same name, another video
        (src_a / "twin.mp4").write_bytes(b"cccc" * 50)
        try:
            os.link(src_a / "twin.mp4", src_b / "twin.mp4")
        except OSError:
            shutil.copy2(src_a / "twin.mp4", src_b / "twin.mp4")
        keys = {}
        for pid in ("sa", "sb"):
            tok = paths.set_profile(pid)
            try:
                keys[pid] = (jobs.transcribe_key("episode.mp4"), jobs.transcribe_key("twin.mp4"), jobs.transcribe_key("nope.mp4"))
            finally:
                paths._profile.reset(tok)
        if keys["sa"][0] == keys["sb"][0]:
            problems.append("the same file NAME with different videos must not share a transcribe job")
        if keys["sa"][1] != keys["sb"][1]:
            problems.append("identical copies (same size + mtime) should share one transcribe job")
        if keys["sa"][2] == keys["sb"][2]:
            problems.append("a missing file must not share a key across profiles")
    finally:
        sched.set_render_limit(saved_limit)

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "AI jobs one at a time across profiles, renders 1 then 2, round-robin per batch item, waiting jobs show why and cancel, transcribe shared by file not name"


# --------------------------------------------------------------------------
# check: the transcript fallback (a transcript of another file with the same name is not reused)
# --------------------------------------------------------------------------

def check_fallback() -> tuple[str, str]:
    """Cache.find_transcript falls back to the newest transcript of the same file NAME only when it plausibly
    belongs to this file: same size, else the same duration (0.5 s); a transcript that records neither is
    refused. Another video with the same name (two profiles), an old transcript of a different length and one
    with no metadata give a fresh transcription; a touched copy and a re-muxed copy keep their transcript."""
    import os
    from .cache import Cache
    from .ffmpeg_tools import _require, run
    from .models import Transcript

    problems: list[str] = []
    ffmpeg = _require("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        cache = Cache(root / "cache")

        def make(folder: str, seconds: int, crf: str = "28") -> Path:
            d = root / folder
            d.mkdir(exist_ok=True)
            out = d / "episode.mp4"
            run([ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc=s=160x90:d={seconds}:r=10",
                 "-f", "lavfi", "-i", f"sine=f=330:d={seconds}", "-shortest", "-pix_fmt", "yuv420p", "-crf", crf, str(out)],
                desc="a test video", timeout=60)
            return out

        def store(name: str, duration: float, size: int) -> Path:
            p = cache.root / f"episode.{name}.transcript.json"
            Transcript(source="episode.mp4", duration=duration, language="id", model="m", segments=[],
                       source_size=size).save(p)
            return p

        a = make("a", 3)
        b = make("b", 7)
        a_size, b_size = a.stat().st_size, b.stat().st_size
        if a_size == b_size:
            problems.append("test setup: the two videos should differ in size")
        mine = store("mine", 3.0, a_size)

        got, why = cache.find_transcript_why(a)
        if got != mine:
            problems.append(f"the same video (same size) should find its transcript: {got} {why}")
        got, why = cache.find_transcript_why(b)
        if got is not None or not why or "duration" not in why[0]:
            problems.append(f"another video with the same name must not get it, and say why: {got} {why}")

        touched = root / "touched"
        touched.mkdir()
        tcopy = touched / "episode.mp4"
        shutil.copy2(a, tcopy)
        os.utime(tcopy, (time.time() + 99, time.time() + 99))
        if cache.find_transcript(tcopy) != mine:
            problems.append("a touched copy (same size, new mtime) should keep the transcript")

        remux = make("remux", 3, crf="40")                   # another size, the same length
        if remux.stat().st_size == a_size:
            problems.append("test setup: the re-encoded video should differ in size")
        if cache.find_transcript(remux) != mine:
            problems.append("a re-saved copy with another size but the same duration should keep the transcript")

        # a transcript with no size (made before sizes were kept): the duration decides
        mine.unlink()
        old = store("old", 3.0, 0)
        if cache.find_transcript(remux) != old:
            problems.append("an older transcript without a size but with the right duration should be accepted")
        if cache.find_transcript(b) is not None:
            problems.append("an older transcript without a size and another duration must be refused")
        # neither size nor duration: refused, with the reason
        old.unlink()
        bare = store("bare", 0.0, 0)
        got, why = cache.find_transcript_why(a)
        if got is not None or not why or "neither" not in why[0]:
            problems.append(f"a transcript that records neither size nor duration must be refused: {got} {why}")
        bare.unlink()
        # the exact one always wins, and a missing file cannot be compared
        from .paths import GLOSSARY
        exact = cache.transcript_path(a, "mm", "id", GLOSSARY if GLOSSARY.is_file() else None)
        Transcript(source="x", duration=99.0, language="id", model="mm", segments=[]).save(exact)
        if cache.find_transcript(a, "mm", "id") != exact:
            problems.append("the exact transcript must be used whatever it records")
        store("again", 3.0, a_size)
        if cache.find_transcript(root / "nowhere" / "episode.mp4") is not None:
            problems.append("without the file there is nothing to compare: no fallback")
        # new transcripts keep the size
        t = Transcript(source="x", duration=1.0, language="id", model="m", segments=[], source_size=1234)
        if Transcript.from_dict(t.to_dict()).source_size != 1234 or "source_size" not in t.to_dict():
            problems.append("a transcript must keep the size of its source through save and load")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "same name + other video refused (with the reason), touched and re-muxed copies and old duration-only transcripts accepted, nothing recorded refused"


# --------------------------------------------------------------------------
# check: render progress (percent, stage weights, ETA), the layout words
# --------------------------------------------------------------------------

def check_progress() -> tuple[str, str]:
    """ffmpeg's -progress lines parsed, the percent split by stage weight and never above 99 before the end, throttled to
    about 4 a second, the time left (initial estimate, real pace, smoothing, hidden under 3 s), the batch's total, a real
    ffmpeg run reporting seconds (and the same bytes with the progress flags), cancel still killing it, and the layout
    words the same in Python and JS."""
    import hashlib
    import shutil
    import subprocess
    from . import progress as pg
    from . import jobs, render as engine
    from .ffmpeg_tools import _require

    problems: list[str] = []

    # --- parsing: a recorded sample of `ffmpeg -progress pipe:1`
    sample = """frame=48
fps=95.2
stream_0_0_q=-1.0
bitrate=N/A
total_size=N/A
out_time_us=1900000
out_time_ms=1900000
out_time=00:00:01.900000
dup_frames=0
drop_frames=0
speed=3.8x
progress=continue
frame=120
out_time_us=4800000
out_time=00:00:04.800000
progress=continue
out_time_us=N/A
out_time=N/A
progress=end
"""
    got = [pg.parse_progress_line(ln) for ln in sample.splitlines()]
    secs = [g for g in got if g is not None]
    if secs != [1.9, 1.9, 1.9, 4.8, 4.8]:
        problems.append(f"progress lines should give 1.9 (x3 spellings) and 4.8 (x2): {secs}")
    if pg.parse_progress_line("out_time=01:02:03.500000") != 3723.5 or pg.parse_progress_line("out_time_us=-9223372036854775807") is not None \
            or pg.parse_progress_line("speed=2x") is not None:
        problems.append("progress parsing: hours, negative and unrelated lines")

    # --- the percent: weights, cap, stages, throttle (a fake clock)
    def run(durations, runs, pass2, ticks_each=40, clip=0, step=0.05):
        clock = {"t": 100.0}
        seen: list[dict] = []
        p = pg.JobProgress(durations, None, seen.append, clock=lambda: clock["t"])
        for i in range(clip + 1):
            p.begin_clip(i, runs if i == clip else [durations[i]], pass2 if i == clip else False)
        return p, seen, clock

    p, seen, clock = run([10.0], [10.0], True)
    p.advance()                                           # the encode
    marks = {}
    for n in range(1, 41):
        clock["t"] += 0.05
        p.tick(10.0 * n / 40)
    marks["encoded"] = p.snapshot()["percent"]
    p.advance()                                           # the second pass
    for n in range(1, 41):
        clock["t"] += 0.05
        p.tick(10.0 * n / 40)
    marks["overlays"] = p.snapshot()["percent"]
    p.finish_clip()
    marks["finish"] = p.snapshot()
    if marks["encoded"] != 60 or marks["overlays"] != 99 or marks["finish"]["percent"] != 99 or marks["finish"]["stage"] != "finishing…":
        problems.append(f"with a second pass the encode is worth 60 % (2 + 98 x 0.6), the end holds 99 'finishing…': {marks}")
    percents = [s["percent"] for s in seen]
    if percents != sorted(percents) or max(percents) > 99:
        problems.append(f"the percent must only rise and never pass 99: {percents[-5:]}")
    if not 8 <= len(seen) <= 20:
        problems.append(f"80 ticks over 4 s should be throttled to about 4 a second: {len(seen)} updates")
    if "overlays…" not in {s["stage"] for s in seen} or "preparing…" not in {s["stage"] for s in seen}:
        problems.append(f"the stages preparing… and overlays… should show: {sorted({s['stage'] for s in seen})}")

    p, seen, clock = run([10.0], [10.0], False)
    p.advance()
    p.tick(10.0)
    if p.snapshot()["percent"] != 99:
        problems.append(f"without a second pass the full encode is 99, not 100: {p.snapshot()}")
    p, seen, clock = run([10.0], [6.0, 4.0], False)
    p.advance()
    p.tick(6.0)
    first = p.snapshot()["percent"]                       # 2 + (98 - 4) x 0.6 = 58.4
    p.advance()
    p.tick(4.0)
    p.advance()                                           # joining
    st = p.snapshot()
    if first != 58 or st["stage"] != "joining…" or st["percent"] != 96:
        problems.append(f"two pieces then the join (4): wanted 58 then 96 'joining…': {first} {st}")
    # several clips are weighed by their length
    p = pg.JobProgress([10.0, 30.0], None, lambda s: None)
    p.begin_clip(0, [10.0], False)
    p.advance()
    p.tick(10.0)
    p.finish_clip()
    p.begin_clip(1, [30.0], False)
    p.advance()
    p.tick(15.0)
    expect = int((10 + (2 + 98 * 0.5) / 100 * 30) / 40 * 100)
    if p.snapshot()["percent"] != expect:
        problems.append(f"two clips (10 s and 30 s), half way through the second: wanted {expect}, got {p.snapshot()['percent']}")

    # --- the time left
    e = pg.Eta(initial_total=40.0)
    first_eta = e.update(0.0, 0.0)
    early = e.update(1.0, 0.02)
    if first_eta != 40.0 or not 38 < early <= 40:
        problems.append(f"before ffmpeg says anything the time left is the profile's usual estimate: {first_eta} {early}")
    for k in range(1, 60):                                 # a steady pace: 10 s elapsed at 50 % -> 10 s left
        last = e.update(10.0, 0.5)
    if last is None or abs(last - 10.0) > 0.6:
        problems.append(f"the smoothed time left should settle on the real pace (10): {last}")
    e = pg.Eta(None)
    if e.update(1.0, 0.01) is not None:
        problems.append("without history nothing is shown before 5 % or 3 s")
    shown = e.update(3.5, 0.35)
    if shown is None or abs(shown - 6.5) > 0.01:
        problems.append(f"after 3 s the pace decides (3.5 s for 35 % -> 6.5 s left): {shown}")
    e = pg.Eta(None)
    e.update(10.0, 0.9)
    if e.update(10.0, 0.9) is not None:                    # 1.1 s left
        problems.append("under 3 s left is hidden")
    # smoothing: one slow tick does not make the estimate jump
    e = pg.Eta(None)
    for k in range(20):
        base = e.update(10.0, 0.5)
    jumped = e.update(10.0, 0.25)                          # a stall: raw says 30 s
    if base is None or jumped is None or jumped - base > 0.31 * (30 - 10) + 0.01:
        problems.append(f"one odd tick must not make the estimate jump: {base} -> {jumped}")
    # the batch's total
    if pg.batch_eta(20.0, 5.0, [30.0, 30.0], 0.5) != 50.0 or pg.batch_eta(None, 10.0, [30.0], 2.0) != 80.0 \
            or pg.batch_eta(None, 10.0, [30.0], None) is not None or pg.batch_eta(7.0, 5.0, [], None) != 7.0:
        problems.append("batch total: the running clip's time left + the queued clips' length x the usual speed")
    b = {"ratio": 2.0, "items": [{"state": "done", "duration": 10}, {"state": "running", "duration": 20, "percent": 50, "eta": 12},
                                 {"state": "queued", "duration": 15}, {"state": "queued", "duration": 5, "cancel": True}]}
    if jobs._batch_total_eta(b) != 42:                    # 12 (running) + 15 x 2 (the cancelled one does not count)
        problems.append(f"the batch's total left should be 42: {jobs._batch_total_eta(b)}")

    # --- a real ffmpeg: it reports seconds, the bytes are the same with the progress flags, cancel kills it
    ffmpeg = _require("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        base_cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=320x180:d=4:r=25",
                    "-f", "lavfi", "-i", "sine=f=300:d=4", "-shortest", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
                    "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart"]
        plain, with_flags = Path(tmp) / "plain.mp4", Path(tmp) / "flags.mp4"
        subprocess.run([*base_cmd, str(plain)], capture_output=True, check=True)
        marks_seen: list[float] = []
        code, err = engine._run_ffmpeg([*base_cmd, str(with_flags)], None, with_flags, marks_seen.append)
        if code != 0 or hashlib.sha256(plain.read_bytes()).hexdigest() != hashlib.sha256(with_flags.read_bytes()).hexdigest():
            problems.append(f"the progress flags must not change the encode: exit {code}, {err[-200:]}")
        if not marks_seen or marks_seen != sorted(marks_seen) or not 3.5 <= marks_seen[-1] <= 4.2:
            problems.append(f"ffmpeg's progress should report rising output seconds up to about 4: {marks_seen[-4:]}")
        stopped = Path(tmp) / "stopped.mp4"
        long_cmd = list(base_cmd)
        long_cmd[long_cmd.index("testsrc=s=320x180:d=4:r=25")] = "testsrc=s=1280x720:d=600:r=25"
        long_cmd[long_cmd.index("sine=f=300:d=4")] = "sine=f=300:d=600"
        seen_one = {"n": 0}

        def on(sec):
            seen_one["n"] += 1

        t0 = time.time()
        try:
            engine._run_ffmpeg([*long_cmd, str(stopped)], lambda: seen_one["n"] > 0, stopped, on)
            problems.append("cancel should stop a running ffmpeg")
        except engine.RenderCancelled:
            if time.time() - t0 > 20 or stopped.exists():
                problems.append("cancel should kill ffmpeg quickly and delete the partial file")

    # --- the layout words: the same in Python and JS
    cases = [("9:16", "blur", 50), ("16:9", "blur", 50), ("16:9", "blur", 0), ("3:4", "black", 100), ("16:9", "black", 30),
             ("16:9", "blur", 29.6), ("3:4", "blur", 75)]
    py = [jobs.layout_label(*c) for c in cases]
    want = ["9:16", "16:9 · blur bg · center", "16:9 · blur bg · top", "3:4 · black bg · bottom", "16:9 · black bg · pos 30%",
            "16:9 · blur bg · pos 30%", "3:4 · blur bg · pos 75%"]
    if py != want:
        problems.append(f"layout_label: {py}")
    node = shutil.which("node")
    if node:
        js = subprocess.run([node, "-e", "const {layoutLabel}=require('./ui/js/editor/renderlabels.js');"
                             f"console.log(JSON.stringify({json.dumps(cases)}.map(c=>layoutLabel(...c))))"],
                            capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), timeout=60)
        if js.returncode != 0 or json.loads(js.stdout) != py:
            problems.append(f"the JS layoutLabel must say what the server says: {js.stdout.strip()[:200]} {js.stderr.strip()[:100]}")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "progress lines parsed, 60/40 weights, 99 held until done, ~4 updates/s, ETA initial/real/smoothed/hidden, batch total, same bytes with the flags, cancel kills ffmpeg, layout words match in Python and JS"


CHECKS = {"migrate": check_migrate, "brief": check_brief, "cues": check_cues, "credits": check_credits, "fingerprint": check_fingerprint, "schedule": check_schedule, "http": check_http, "profiles": check_profiles, "youtube": check_youtube, "upload": check_upload, "refresh": check_refresh, "manual": check_manual, "captions": check_captions, "renderreq": check_renderreq, "batch": check_batch, "claude": check_claude, "rubrics": check_rubrics, "guide": check_guide, "timefield": check_timefield, "resultpost": check_resultpost, "bulk": check_bulk, "hashtags": check_hashtags, "ytdl": check_ytdl, "sched": check_sched, "fallback": check_fallback, "progress": check_progress,
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
