"""Selftest checks: project migration, the Claude brief, the autopilot and the admin model settings."""

from __future__ import annotations


import json
import tempfile
from pathlib import Path

from .selftest_base import ROOT, FIXTURES, SELFTEST_ID, PASS, FAIL, _load, _diff


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


def check_autopilot() -> tuple[str, str]:
    """Autopilot phase 1: the run's schedule slots (the day after the start, split evenly over the Admin hours),
    the shared settings, the Admin profile (no work folders, cannot be changed or deleted) and the Gemini key
    handling (a fake client: no network; the key never leaves the server)."""
    import json as _json
    import random
    from datetime import date
    from . import autopilot as ap, gemini_api as gm, paths, profiles

    problems = []

    # --- slots
    hours = ["11:00", "18:00"]
    for start, day in ((date(2026, 11, 8), "2026-11-09"), (date(2026, 11, 30), "2026-12-01"), (date(2026, 12, 31), "2027-01-01"),
                       (date(2028, 2, 28), "2028-02-29"), (date(2026, 2, 28), "2026-03-01")):
        got = ap.run_slots(start, hours, 5, rng=random.Random(1))
        if {d for d, _ in got} != {day}:
            problems.append(f"a run started {start} goes out on {day}: {got}")
    for hs in (hours, ["09:00", "13:00", "20:30"], ["12:00"]):
        for n in range(0, 14):
            for seed in range(4):
                got = ap.run_slots(date(2026, 11, 8), hs, n, rng=random.Random(seed))
                per = [sum(1 for _, h in got if h == x) for x in hs]
                if len(got) != n or (per and max(per) - min(per) > 1) or not {h for _, h in got} <= set(hs):
                    problems.append(f"{n} clips over {hs}: {per}")
    if [x[1] for x in ap.run_slots(date(2026, 11, 8), hours, 8, rng=random.Random(3))].count("11:00") != 4:
        problems.append("8 clips over two hours are 4 and 4")
    firsts = {tuple(ap.run_slots(date(2026, 11, 8), hours, 3, rng=random.Random(s))) for s in range(30)}
    if len(firsts) < 2 or {sum(1 for _, h in f if h == "11:00") for f in firsts} != {1, 2}:
        problems.append("3 clips: 2 and 1, the extra at a random hour, in a random order")
    got = ap.assign_slots(["a", "b", "c"], date(2026, 11, 8), hours, rng=random.Random(5))
    if sorted(g["id"] for g in got) != ["a", "b", "c"] or ap.run_slots(date(2026, 11, 8), [], 3) != []:
        problems.append(f"every clip gets a slot: {got}")

    # --- the air date is Start + N days
    for start, n, day in ((date(2026, 11, 8), 0, "2026-11-08"), (date(2026, 11, 8), 2, "2026-11-10"), (date(2026, 12, 31), 2, "2027-01-02"),
                          (date(2026, 11, 8), 1, "2026-11-09")):
        got = ap.run_slots(start, hours, 4, n, rng=random.Random(2))
        if {d for d, _ in got} != {day}:
            problems.append(f"start {start} + {n} days is {day}: {got}")

    # --- a slot that has passed moves to the next hour; past the last hour, to the first hour of the next day
    from datetime import datetime
    s0 = date(2026, 11, 8)
    for now, days, want in ((datetime(2026, 11, 8, 12, 0), 0, {("2026-11-08", "18:00")}),
                            (datetime(2026, 11, 8, 19, 0), 0, {("2026-11-09", "11:00")}),
                            (datetime(2026, 11, 8, 8, 0), 0, {("2026-11-08", "11:00"), ("2026-11-08", "18:00")}),
                            (datetime(2026, 11, 8, 19, 0), 1, {("2026-11-09", "11:00"), ("2026-11-09", "18:00")}),
                            (datetime(2026, 12, 31, 19, 0), 0, {("2027-01-01", "11:00")})):
        st = date(2026, 12, 31) if now.year == 2026 and now.month == 12 else s0
        got = ap.run_slots(st, hours, 8, days, now, rng=random.Random(4))
        if len(got) != 8 or set(got) != want:
            problems.append(f"now {now}, N = {days}: {sorted(set(got))}, wanted {sorted(want)}")
    got = ap.run_slots(s0, ["09:00", "12:00", "18:00"], 6, 0, datetime(2026, 11, 8, 13, 0), rng=random.Random(1))
    if set(got) != {("2026-11-08", "18:00")}:
        problems.append(f"several passed hours go on to the first one still to come: {got}")
    if ap.run_slots(s0, hours, 5, 0, None, rng=random.Random(1)) != ap.run_slots(s0, hours, 5, 0, datetime(2026, 11, 8, 0, 0), rng=random.Random(1)):
        problems.append("a day that has not started is not changed by now")

    # --- templates
    d = ap.get_template("default")
    want = {"picture": "3:4", "background": "blur", "angleIntro": True, "introStyle": "dark", "introSeconds": 2.5}
    if any(d["format"][k] != v for k, v in want.items()) or d["schedule"] != {"hours": ["11:00", "18:00"], "days": 1, "autoUpload": True} \
            or d["quality"] != 1080 or d["framing"] is not True or d["maxClips"] != 4 or d["name"] != "Default":
        problems.append(f"the Default template: {d}")
    if [t["id"] for t in ap.list_templates()] != ["default"]:
        problems.append("a fresh workspace has only the Default template")
    saved = ap.save_template("default", {"schedule": {"hours": ["7:05", "18:00", "18:00"], "days": 2}, "format": {"picture": "9:16"}, "name": "X"})
    if saved["schedule"]["hours"] != ["07:05", "18:00"] or saved["schedule"]["days"] != 2 or saved["format"]["picture"] != "9:16" \
            or saved["format"]["background"] != "blur" or saved["name"] != "Default":
        problems.append(f"a change keeps the rest, tidies the hours, and the Default keeps its name: {saved}")
    if ap.get_template("default") != {k: v for k, v in saved.items() if k != "id"}:
        problems.append("the template is read back as saved")
    for bad in ({"format": {"picture": "1:1"}}, {"schedule": {"hours": []}}, {"schedule": {"hours": ["25:00"]}}, {"quality": 999},
                {"maxClips": 0}, {"maxClips": 11}, {"maxClips": "4"}, {"schedule": {"days": -1}}, {"schedule": {"days": 1.5}}, {"format": {"introSeconds": 99}}):
        try:
            ap.save_template("default", bad)
            problems.append(f"{bad} should be refused")
        except ValueError:
            pass
    if ap.get_template("default")["schedule"]["days"] != 2:
        problems.append("a refused change must not change the template")
    r = ap.reset_template("default")
    if r["schedule"]["days"] != 1 or ap.get_template("default")["format"]["picture"] != "3:4":
        problems.append("Reset to defaults")
    lucu = ap.create_template("Lucu")
    ap.save_template(lucu["id"], {"schedule": {"hours": ["09:00"]}})
    cp = ap.create_template("Lucu 2", copy_of=lucu["id"])
    if cp["schedule"]["hours"] != ["09:00"] or cp["id"] == lucu["id"] or ap.get_template(cp["id"])["name"] != "Lucu 2":
        problems.append(f"Duplicate copies the values under a new name: {cp}")
    for what, fn in (("a name used twice", lambda: ap.create_template("lucu")), ("a rename to a used name", lambda: ap.save_template(cp["id"], {"name": "LUCU"})),
                     ("a delete of the Default", lambda: ap.delete_template("default")), ("a reset of another", lambda: ap.reset_template(cp["id"]))):
        try:
            fn()
            problems.append(f"{what} should be refused")
        except ValueError:
            pass
    if ap.save_template(cp["id"], {"name": "Lucu dua"})["name"] != "Lucu dua":
        problems.append("a template can be renamed")
    # a profile picks a template (default: Default); deleting it sends the profile back
    profiles.write_meta("tplp", {"name": "tplp", "color": "#123456"})
    profiles.ensure_dirs("tplp")
    if profiles.read_meta("tplp")["template"] != "default" or ap.profile_template("tplp")["name"] != "Default":
        problems.append("a profile starts on the Default template")
    profiles.update("tplp", {"template": lucu["id"]})
    if ap.profile_template("tplp")["schedule"]["hours"] != ["09:00"] or profiles.read_meta("tplp")["name"] != "tplp":
        problems.append("the profile uses its template and keeps its name")
    try:
        profiles.update("tplp", {"template": "nope"})
        problems.append("a template that does not exist should be refused")
    except profiles.ProfileError:
        pass
    if ap.delete_template(lucu["id"]) != ["tplp"] or profiles.read_meta("tplp")["template"] != "default":
        problems.append("deleting a template sends its profiles back to the Default")
    if ap.get_template("gone")["name"] != "Default":
        problems.append("an unknown template reads as the Default")

    # --- the Admin profile
    meta = profiles.read_meta(paths.ADMIN)
    if not meta or meta["id"] != "_admin" or not meta.get("admin") or not profiles.exists(paths.ADMIN):
        problems.append(f"the Admin is always there: {meta}")
    if paths.ADMIN in [p["id"] for p in profiles.list_profiles()]:
        problems.append("the Admin is not one of the profiles to pick from")
    base = profiles.ensure_dirs(paths.ADMIN)
    if base.exists() and any(base.iterdir()):
        problems.append("the Admin has no work folders")
    for what, fn in (("deleted", lambda: profiles.delete(paths.ADMIN)), ("renamed", lambda: profiles.update(paths.ADMIN, {"name": "X"})),
                     ("created", lambda: profiles.create("Admin"))):
        try:
            fn()
            problems.append(f"the Admin cannot be {what}")
        except profiles.ProfileError:
            pass
    profiles.write_meta(paths.ADMIN, {"name": "X"})
    if (paths.profile_dir(paths.ADMIN) / "profile.json").exists():
        problems.append("the Admin has no profile.json")

    # --- Gemini (fake client)
    class M:
        def __init__(self, name, actions=("generateContent",)):
            self.name, self.display_name, self.supported_actions = name, name, list(actions)

    class Boom(Exception):
        def __init__(self, code, message):
            super().__init__(message)
            self.code, self.message = code, message

    class Fake:
        def __init__(self, models=None, err=None):
            self._models, self._err = models, err
            self.models = self

        def list(self):
            if self._err:
                raise self._err
            return iter(self._models)

    ok = Fake([M("models/gemini-2.5-flash"), M("models/gemini-2.5-pro"), M("models/embedding-001"), M("models/gemini-embed", ["embedContent"])])
    ids = [m["id"] for m in gm.list_models(ok)]
    if ids != ["gemini-2.5-pro", "gemini-2.5-flash"]:
        problems.append(f"only Gemini models that write text, from the account's list: {ids}")
    gm.save_settings(api_key="AIzaSECRET12345678", model="gemini-2.5-flash")
    st = gm.status()
    if "AIzaSECRET12345678" in _json.dumps(st) or st["keyHint"] != "…5678" or not st["hasKey"]:
        problems.append(f"the status never carries the key: {st}")
    r = gm.test_key(ok)
    if "works" not in r["note"] or gm.status()["lastError"]:
        problems.append(f"a good key: {r['note']}")
    gm.save_settings(model="gemini-9")
    if "choose another model" not in gm.test_key(ok)["note"]:
        problems.append("a model that is not on the list is said so")
    for code, text, want_code in ((400, "API key not valid. Please pass a valid API key.", "bad_key"), (403, "denied", "bad_key"),
                                  (429, "RESOURCE_EXHAUSTED", "quota"), (500, "boom", "failed")):
        try:
            gm.test_key(Fake(err=Boom(code, text)))
            problems.append(f"{code} should be an error")
        except gm.GeminiError as err:
            if err.code != want_code or gm.status()["lastError"] != err.message:
                problems.append(f"{code} -> {err.code} (wanted {want_code}), last error {gm.status()['lastError']!r}")
    gm.save_settings(api_key="AIzaOTHER00009999")
    if gm.status()["lastError"]:
        problems.append("a new key clears the last error")
    # --- Gemini finds clips (fake client)
    from types import SimpleNamespace as NS

    class Gen:
        def __init__(self, *steps):
            self.steps, self.configs = list(steps), []
            self.models = self

        def generate_content(self, model, contents, config):
            self.configs.append(config)
            step = self.steps.pop(0)
            if isinstance(step, BaseException):
                raise step
            return step

    def reply(text='{"clips": []}', finish="STOP", block=None, tin=31000, tout=4000):
        return NS(text=text, candidates=[NS(finish_reason=NS(name=finish))], prompt_feedback=NS(block_reason=NS(name=block)) if block else None,
                  usage_metadata=NS(prompt_token_count=tin, candidates_token_count=tout))

    def find(*steps):
        slept, g = [], Gen(*steps)
        try:
            return gm.find_clips("SYS", "USER", client=g, pause=slept.append), g, slept
        except gm.GeminiError as err:
            return err, g, slept

    gm.save_settings(api_key="AIzaFINDER12345678")
    r, g, _ = find(reply())
    if not isinstance(r, dict) or r["input"] != 31000 or r["output"] != 4000 or r["model"] != "gemini-9" or not r["at"]:
        problems.append(f"Gemini find: a valid answer returns the text, the model and the tokens: {r}")
    elif g.configs[0].get("system_instruction") != "SYS" or "response_json_schema" not in g.configs[0]:
        problems.append("Gemini find: the system text and the reply schema are sent")
    r, g, _ = find(Boom(400, "response_json_schema is not supported by this model"), reply())
    if not isinstance(r, dict) or len(g.configs) != 2 or "response_json_schema" in g.configs[1]:
        problems.append(f"Gemini find: a model that refuses the schema is asked again for plain JSON: {r}")
    r, g, _ = find(reply())
    if g.configs[0].get("http_options") != {"timeout": gm.TIMEOUT_SEC * 1000} or "thinking_config" in g.configs[0]:
        problems.append(f"Gemini find: a 300 s request timeout and the model's own thinking: {g.configs[0]}")

    class SlowTimeout(Exception):
        pass
    SlowTimeout.__name__ = "ReadTimeout"
    r, g, slept = find(SlowTimeout("The read operation timed out"))
    if getattr(r, "code", "") != "timeout" or f"{gm.TIMEOUT_SEC // 60} minutes" not in r.message or slept or len(g.configs) != 1:
        problems.append(f"Gemini find: a request that times out fails with the reason, no wait and no second try: {r}")
    r, _, _ = find(Boom(400, "API key not valid. Please pass a valid API key."))
    if getattr(r, "code", "") != "bad_key" or "check the key in Admin" not in r.message or gm.status()["lastError"] != r.message:
        problems.append(f"Gemini find: a bad key says so: {r}")
    r, g, slept = find(Boom(429, "RESOURCE_EXHAUSTED. Please retry in 3.5s."), reply())
    if not isinstance(r, dict) or slept != [4.5]:
        problems.append(f"Gemini find: a 429 waits for the delay Google gives and succeeds: {r} {slept}")
    r, g, slept = find(Boom(429, "quota"), Boom(429, "quota"))
    if getattr(r, "code", "") != "quota" or "try again later" not in r.message or slept != [60.0] or len(g.configs) != 2:
        problems.append(f"Gemini find: a second 429 fails, after one wait of 60 s: {r} {slept}")
    if gm._retry_delay(Boom(429, "x 'retryDelay': '34s' y")) != 35.0:
        problems.append("Gemini find: retryDelay '34s' is read")
    for what, step, want in (("cut", reply(finish="MAX_TOKENS"), "cut"), ("block", reply(text="", block="PROHIBITED_CONTENT"), "blocked"),
                             ("safety", reply(text="", finish="SAFETY"), "blocked"), ("empty", reply(text=""), "empty")):
        r, _, _ = find(step)
        if getattr(r, "code", "") != want:
            problems.append(f"Gemini find: {what} -> {getattr(r, 'code', r)}")
    gm.save_settings(model="")
    r, _, _ = find(reply())
    if getattr(r, "code", "") != "no_model" or "Admin" not in r.message:
        problems.append(f"Gemini find: no model chosen: {r}")
    gm.save_settings(remove_key=True)
    if gm.status()["hasKey"] or _json.loads(gm._file().read_text(encoding="utf-8")).get("apiKey"):
        problems.append("Remove key removes the key")
    from .autopilot_deps import RealDeps
    chk = RealDeps().ai_check("gemini")
    if chk["ok"] or chk.get("link") != "/admin" or "Admin" not in chk["fix"]:
        problems.append(f"Check says Gemini is not set up and links to /admin: {chk}")
    gm.save_settings(api_key="AIzaFINDER12345678")
    chk = RealDeps().ai_check("gemini")
    if chk["ok"] or "model" not in chk["detail"].lower():
        problems.append(f"Check asks for a model when none is chosen: {chk}")
    gm.save_settings(model="gemini-9")
    if not RealDeps().ai_check("gemini")["ok"]:
        problems.append("Check is green with key and model")
    gm.save_settings(remove_key=True, model="")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "slots: Start + N days, even split; templates; the Admin has no folders and cannot change; Gemini key stays on the server"


def check_autopilotresult() -> tuple[str, str]:
    """A Result built on the server from a clip candidate (autopilot.build_result) is the Result the editor builds for
    it: the same fields, the output format of the template, the intro label of withAngleIntro (tests/autoresult.test.js
    checks the label against the editor's own code), and the render request made from it has the template's picture."""
    import copy
    import json as _json
    from . import autopilot as ap, renderreq

    problems = []
    fx = _json.loads((ROOT / "tests" / "fixtures" / "autopilot-result.json").read_text(encoding="utf-8"))
    cand, want = fx["candidate"], fx["expected"]
    tpl = ap.get_template("default")
    got = ap.build_result(cand, tpl, "res1")
    if got != want:
        problems.append(f"the Default template's Result differs from the editor's:\n        got    {got}\n        wanted {want}")

    def variant(**fmt):
        t = copy.deepcopy(tpl)
        t["format"].update(fmt)
        return ap.build_result(cand, t, "res1")

    r = variant(angleIntro=False)
    if "overlays" in r or r["angle"] != want["angle"]:
        problems.append("angle intro off: no label, the angle is kept")
    r = variant(introStyle="light", introSeconds=4.0)
    lab = (r.get("overlays") or [{}])[0]
    if (lab.get("color"), lab.get("boxStyle"), lab.get("end")) != ("#111111", "light", 4.0) \
            or r["angle"].get("introSeconds") != 4.0 or r["angle"].get("boxStyle") != "light":
        problems.append(f"a light intro of 4 s: {lab} {r['angle']}")
    r = variant(picture="9:16")
    if r["output"] != [0, 1, 1, None, 50]:
        problems.append(f"9:16 has no background chosen: {r['output']}")
    r = variant(picture="16:9", background="black")
    if r["output"] != [1, 1, 1, 1, 50]:
        problems.append(f"16:9 black: {r['output']}")
    bare = ap.build_result({"title": "T", "startSec": 1, "endSec": 20}, tpl, "res2")
    if any(k in bare for k in ("post", "angle", "overlays")):
        problems.append("a candidate with no post or angle makes none")
    with_hook = ap.build_result({"title": "T", "startSec": 1, "endSec": 20, "hook": "  Dia bilang gini  di depan semua orang "}, tpl, "res4")
    if with_hook.get("hook") != "Dia bilang gini di depan semua orang" or "hook" in bare:
        problems.append("build_result keeps the candidate's hook (and none when it has none): the thumbnail text comes from it")
    with_thumb = ap.build_result({"title": "T", "startSec": 1, "endSec": 20, "thumb": "Gurita punya *3 jantung*?"}, tpl, "res5")
    if with_thumb.get("thumb") != "Gurita punya *3 jantung*?" or "thumb" in bare or "thumb" in ap.build_result({"title": "T", "startSec": 1, "endSec": 20, "thumb": "Satu"}, tpl, "res6"):
        problems.append("build_result keeps the AI's thumb (cleaned: one word is ignored) and none when it has none")
    for bad in ({"title": "x", "startSec": 5, "endSec": 5.2}, {"title": "x"}):
        try:
            ap.build_result(bad, tpl, "res3")
            problems.append(f"{bad} should be refused")
        except ValueError:
            pass

    # the render request made from it: the template's picture, blur, the intro label, the words of the clip
    project = {"id": "0123456789ab", "assets": [{"id": "a1", "kind": "video", "file": "talk.mp4"}], "results": [got]}
    words = [{"text": f"w{i}", "start": 120.0 + i, "end": 120.9 + i} for i in range(60)]
    req = renderreq.build_request(project, "res1", words_of=lambda f: words, size_of=lambda f: (1920, 1080))
    hooked = renderreq.build_request({**project, "results": [{**got, "hook": "Dia bilang gini"}]}, "res1", words_of=lambda f: words, size_of=lambda f: (1920, 1080))
    if hooked["clips"][0].get("hook") != "Dia bilang gini" or "hook" in req["clips"][0]:
        problems.append("the render request carries the Result's hook (jobs.py then writes it on the Clips row)")
    thumbed = renderreq.build_request({**project, "results": [{**got, "thumb": "Wow gila banget"}]}, "res1", words_of=lambda f: words, size_of=lambda f: (1920, 1080))
    if thumbed["clips"][0].get("thumb") != "Wow gila banget" or "thumb" in req["clips"][0]:
        problems.append("the render request carries the Result's thumb (the AI's thumbnail text)")
    k = req["clips"][0]
    if (k["picture"], k["background"], k["position"]) != ("3:4", "blur", 50):
        problems.append(f"the request's picture: {k['picture']} {k['background']} {k['position']}")
    if [o["origin"] for o in k.get("overlays") or []] != ["angle-intro"] or k["post"]["title"] != "Judul":
        problems.append("the request carries the intro label and the post text")
    if not k["spans"] or abs(k["spans"][0]["start"] - 120.5) > 1e-6:
        problems.append(f"the request's span: {k['spans']}")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the server's Result = the editor's (fields, output, intro label) and renders with the template's picture"


def check_autopilotrun() -> tuple[str, str]:
    """An Autopilot run end to end with fakes for ytdl, transcribe, the AI, framing, render and the YouTube upload:
    the steps in order, the template copied at Start, at most N clips, 0 clips, a failure and its Retry (nothing before
    the failed step is done twice), Manual mode and its reply, auto upload off, cancel, and the schedule."""
    import json as _json
    from datetime import date, timedelta
    from . import autopilot as ap, paths, profiles, schedule

    problems = []
    PID = "aprun"
    profiles.write_meta(PID, {"name": PID, "color": "#123456"})
    profiles.ensure_dirs(PID)
    token = paths.set_profile(PID)

    def cands(n):
        return [{"title": f"Klip {i}", "startSec": 100.0 * i, "endSec": 100.0 * i + 40, "post": {"title": f"Judul {i}", "caption": "c", "hashtags": ["#x"]},
                 "angle": {"take": "t", "intro": f"Intro {i}", "notes": []}} for i in range(1, n + 1)]

    class Fake:
        count = 0

        def __init__(self, n=3, fail=None):
            self.calls, self.n, self.fail, self.projects = [], n, dict(fail or {}), {}
            self.uploaded = {}
            Fake.count += 1
            self.pid = f"{Fake.count:012x}"                      # a project of its own: its rows are its own

        def _go(self, name):
            self.calls.append(name)
            if self.fail.get(name):
                self.fail[name] -= 1
                raise ap.RunError(f"{name} broke")

        def video_id(self, url):
            if "v=" not in url:
                raise ap.RunError("not a YouTube video link")
            return url.split("v=")[1][:11]

        def preview(self, url, quality):
            return {"title": "Talk", "duration": 3000}

        def download(self, url, quality, report):
            self._go("download")
            report(50, "half")
            return "talk.mp4"

        def transcribe(self, name, report):
            self._go("transcribe")

        def make_project(self, name, title, url):
            self._go("project")
            self.projects[self.pid] = {"id": self.pid, "assets": [{"id": "a1", "kind": "video", "file": name}], "results": []}
            return self.pid

        def read_project(self, pid):
            return _json.loads(_json.dumps(self.projects[pid]))

        def write_project(self, pid, data):
            self.projects[pid] = data

        def brief(self, name, most):
            self._go("brief")
            return f"BRIEF at most {most}"

        def candidates_from_reply(self, name, text):
            if text == "bad":
                raise ValueError("That is not JSON")
            return self._cands(), ["a note"]

        def _cands(self):
            found = cands(self.n)
            if getattr(self, "long", False) and found:                 # the AI ignored the length limit: 5:35
                found[0]["endSec"] = found[0]["startSec"] + 335
            return found

        def sentence_ends(self, name):
            return [100.0 + 50 * k for k in range(1, 12)]

        def ask_claude(self, name, most, project, report):
            self._go("ask")
            return self._cands(), []

        def ask_gemini(self, name, most, project, report):
            self._go("ask")
            return self._cands(), [], {"model": "gemini-x", "input": 31000, "output": 4000, "at": 1700000000}

        def ai_framing(self, pid, rid, report=None):
            self._go("framing")
            if report:
                for f in (0.2, 0.6, 0.9):                     # progress inside one clip
                    report(f, "following faces")
                    if getattr(self, "cancel_in_clip", None):
                        ap.cancel(self.cancel_in_clip)
            if rid == "res2":
                raise RuntimeError("no frames")

        def render(self, pid, ids, report):
            self._go("render")
            for rid in ids:
                title = next(r for r in self.projects[pid]["results"] if r["id"] == rid)["segments"][0]["title"]
                schedule.upsert_render(project_id=pid, result_id=rid, title=title, file_name=f"{rid}.mp4",
                                       post=None, credit_lines="")

        def upload(self, rows, report):
            self.calls.append("upload")
            bad = rows[1:] if self.fail.get("upload") else []      # the first call sends one clip and stops
            self.fail["upload"] = 0
            for r in rows:
                if r not in bad:
                    self.uploaded[r] = True
                    schedule.set_fields(r, {"videoId": "vid" + r, "status": "Scheduled"})
            return [("Klip", "quota") for _ in bad]

        def youtube_checks(self):
            return [{"key": "client", "ok": True, "label": "YouTube client", "detail": "", "fix": ""}]

        def ai_check(self, mode):
            return {"key": "ai", "ok": mode not in getattr(self, "blocked", ()), "label": mode, "detail": "no key", "fix": "Add it"}

    def run_one(deps, ai="claude", settings=None):
        profiles.update(PID, {"ai": ai})
        if settings is not None:
            ap.save_template("default", settings)
        made = ap.start_runs([f"https://www.youtube.com/watch?v=AAAAAAAAAA{len(ap.load_runs()) % 10}"], deps)
        ap.wait_idle(30)
        return ap.get_run(made[0]["id"])

    try:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        # a full run
        d = Fake(n=3)
        run = run_one(d)
        order = [c for c in d.calls if c in ("download", "transcribe", "project", "ask", "framing", "render", "upload")]
        if run["state"] != "done" or order != ["download", "transcribe", "project", "ask", "framing", "framing", "framing", "render", "upload"]:
            problems.append(f"a full run: {run['state']} {run.get('error')} {order}")
        pdata = d.projects[d.pid]
        if [r["id"] for r in pdata["results"]] != ["res1", "res2", "res3"] or pdata["results"][0]["output"][0] != 2:
            problems.append("the project holds the 3 Results in the template's format")
        rows = [schedule.get_row(i) for i in run["rows"].values()]
        slots = sorted((r["date"], r["time"]) for r in rows)
        if {s[0] for s in slots} != {tomorrow} or sorted(t for _, t in slots) != ["11:00", "11:00", "18:00"] and sorted(t for _, t in slots) != ["11:00", "18:00", "18:00"]:
            problems.append(f"3 clips go out tomorrow, split over the two hours: {slots}")
        if any(r["status"] != "Scheduled" for r in rows) or run["done"] != list(ap.STEPS):
            problems.append(f"the rows are Scheduled after the upload: {[r['status'] for r in rows]} {run['done']}")
        if "res2" not in _json.dumps(run.get("framingNotes", "")) and not run.get("framingNotes"):
            problems.append("a clip whose AI Framing failed is noted, not fatal")
        if run["template"]["framing"] is not True or ap.public_run(run).get("template") != {"name": "Default"}:
            problems.append("the template is copied into the run")

        # Gemini mode: the same steps, the usage is kept on the run; a failure is a Retry
        d = Fake(n=2, fail={"ask": 1})
        run = run_one(d, ai="gemini")
        if run["state"] != "failed" or "ask broke" not in run["error"] or run["step"] != "clips":
            problems.append(f"Gemini failure stops at clips: {run['state']} {run.get('error')}")
        ap.retry(run["id"], d)
        ap.wait_idle(30)
        run = ap.get_run(run["id"])
        if run["state"] != "done" or run.get("ai_usage", {}).get("model") != "gemini-x" or ap.public_run(run)["ai_usage"]["input"] != 31000:
            problems.append(f"a Gemini run after Retry: {run['state']} {run.get('ai_usage')}")
        profiles.update(PID, {"ai": "claude"})

        # at most N clips; the template is copied at Start (an edit later changes the next run only)
        d = Fake(n=6)
        run = run_one(d, settings={"maxClips": 2, "framing": False})
        if len(run["results"]) != 2 or "framing" in d.calls:
            problems.append(f"at most 2 clips and no framing: {len(run.get('results', []))} {d.calls}")
        ap.save_template("default", {"maxClips": 5})
        if run["template"]["maxClips"] != 2:
            problems.append("a run keeps the template it started with")
        ap.reset_template("default")

        # 0 clips: done, with a note, nothing made after it
        d = Fake(n=0)
        run = run_one(d)
        if run["state"] != "done" or "worth a clip" not in " ".join(run["notes"]) or "render" in d.calls or d.projects[d.pid]["results"]:
            problems.append(f"0 clips: {run['state']} {run['notes']!r} {d.calls}")

        # a failure at the render, then Retry: nothing before it runs again
        d = Fake(n=2, fail={"render": 1})
        run = run_one(d)
        if run["state"] != "failed" or run["step"] != "render" or "render broke" not in run["error"]:
            problems.append(f"a failed render: {run['state']} {run['step']} {run['error']}")
        ap.retry(run["id"], d)
        ap.wait_idle(30)
        run = ap.get_run(run["id"])
        if run["state"] != "done" or [d.calls.count(c) for c in ("download", "transcribe", "project", "ask", "render")] != [1, 1, 1, 1, 2]:
            problems.append(f"Retry goes on from the render: {run['state']} {d.calls}")

        # a failure at the download: the first step is retried and the rest follow
        d = Fake(n=1, fail={"download": 1})
        run = run_one(d)
        ap.retry(run["id"], d)
        ap.wait_idle(30)
        if ap.get_run(run["id"])["state"] != "done" or d.calls.count("download") != 2:
            problems.append("Retry of a failed download")

        # an upload that fails for one clip: the run fails at the schedule, Retry uploads only the rest
        d = Fake(n=2, fail={"upload": 1})
        run = run_one(d)
        if run["state"] != "failed" or run["step"] != "schedule" or "Klip" not in run["error"]:
            problems.append(f"a partly failed upload: {run['state']} {run['step']} {run['error']}")
        slots_before = run["slots"]
        ap.retry(run["id"], d)
        ap.wait_idle(30)
        run = ap.get_run(run["id"])
        if run["state"] != "done" or run["slots"] != slots_before:
            problems.append("Retry of the upload keeps the slots and finishes")

        # Manual mode: waits with a brief; a reply that cannot be read is refused; a good one goes on
        d = Fake(n=2)
        run = run_one(d, ai="manual")
        if run["state"] != "waiting" or run["brief"] != "BRIEF at most 4" or "ask" in d.calls or "render" in d.calls:
            problems.append(f"Manual mode waits for the reply: {run['state']} {run.get('brief')!r}")
        try:
            ap.reply(run["id"], "bad", d)
            problems.append("an unreadable reply should be refused")
        except ap.RunError:
            pass
        ap.reply(run["id"], "{}", d)
        ap.wait_idle(30)
        run = ap.get_run(run["id"])
        if run["state"] != "done" or len(run["results"]) != 2 or run["brief"]:
            problems.append(f"Manual reply goes on: {run['state']} {run.get('error')}")

        # auto upload off: stops at Ready
        d = Fake(n=2)
        run = run_one(d, settings={"schedule": {"autoUpload": False}})
        rows = [schedule.get_row(i) for i in run["rows"].values()]
        if run["state"] != "done" or "upload" in d.calls or {r["status"] for r in rows} != {"Ready"} or not all(r["date"] for r in rows):
            problems.append(f"auto upload off stops at Ready with dates: {run['state']} {[r['status'] for r in rows]}")
        ap.reset_template("default")

        # a link that is not a video link, a link already in progress, cancel
        try:
            ap.start_runs(["https://example.com/x"], Fake())
            problems.append("a link that is not a YouTube video should be refused")
        except ap.RunError:
            pass
        d = Fake(n=2)
        profiles.update(PID, {"ai": "manual"})
        made = ap.start_runs(["https://www.youtube.com/watch?v=BBBBBBBBBBB"], d)
        ap.wait_idle(30)
        again = ap.start_runs(["https://www.youtube.com/watch?v=BBBBBBBBBBB"], d)
        if again:
            problems.append("a link whose run is not over is not queued twice")
        ap.cancel(made[0]["id"])
        if ap.get_run(made[0]["id"])["state"] != "cancelled" or ap.get_run(made[0]["id"]).get("stoppedAt") != "clips":
            problems.append(f"Cancel of a waiting run marks the step it waited at: {ap.get_run(made[0]['id']).get('stoppedAt')!r}")
        ap.retry(made[0]["id"], d)
        ap.wait_idle(30)
        if ap.get_run(made[0]["id"])["state"] != "waiting":
            problems.append("a cancelled run can be retried")

        # the run list: updatedAt, stoppedAt, notes whole, stalled, Clear finished
        d = Fake(n=2, fail={"render": 1})
        run = run_one(d)
        if run["state"] != "failed" or run.get("stoppedAt") != "render" or not run.get("updatedAt"):
            problems.append(f"a failure inside a step marks it: {run.get('stoppedAt')!r} {run.get('updatedAt')}")
        ap.retry(run["id"], d)
        ap.wait_idle(30)
        run = ap.get_run(run["id"])
        if run["state"] != "done" or run.get("stoppedAt"):
            problems.append(f"Retry clears stoppedAt: {run['state']} {run.get('stoppedAt')!r}")
        d = Fake(n=1)
        run = run_one(d, ai="manual")
        ap.update_run(run["id"], state="queued", step="clips", done=["download", "transcribe", "project"])
        ap.update_run(run["id"], state="running")                # the worker of this profile is gone: nobody is working on it
        pub = ap.public_run(ap.get_run(run["id"]))
        if not pub["stalled"] or ap.public_run({**ap.get_run(run["id"]), "state": "waiting"})["stalled"]:
            problems.append("a running run without a worker is stalled, a waiting one is not")
        ap.cancel(run["id"])
        run = ap.get_run(run["id"])
        if run["state"] != "cancelled" or run.get("stoppedAt") != "clips":
            problems.append(f"Cancel of a stalled run: {run['state']} {run.get('stoppedAt')!r}")
        ap.update_run(run["id"], state="running")
        ap.retry(run["id"], d)                                  # Retry of a stalled run is allowed
        ap.wait_idle(30)
        if ap.get_run(run["id"])["state"] == "running":
            problems.append("a stalled run can be resumed")
        old = {"id": "x", "note": "old text"}
        if ap.run_notes(old) != ["old text"] or ap.public_run(old)["notes"] != ["old text"] or "note" in ap.public_run(old):
            problems.append("an old run with one string note is still readable")
        if len(ap._with_notes({}, ["n%d" % i for i in range(40)])) != 20 or len(ap._with_notes({}, ["x" * 999])[0]) != 300:
            problems.append("notes are kept up to 20 x 300 chars")
        ap.update_run(run["id"], state="failed")
        keep_failed = ap.start_runs(["https://www.youtube.com/watch?v=FFFFFFFFFFF"], Fake(n=1))[0]["id"]
        ap.wait_idle(30)
        ap.update_run(keep_failed, state="failed")
        before = {r["id"]: r["state"] for r in ap.load_runs()}
        removed = ap.clear_finished()
        after = {r["id"]: r["state"] for r in ap.load_runs()}
        if not after or any(s in ("done", "cancelled") for s in after.values()) or keep_failed not in after                 or removed != len(before) - len(after) or any(before[i] != s for i, s in after.items()):
            problems.append(f"Clear finished removes only done and cancelled: {before} -> {after}")

        # no clip longer than 90 s, whatever the AI wrote; progress inside one clip of AI Framing; Cancel in the middle of it
        short, long_ = cands(1)[0], dict(cands(1)[0], endSec=435.0, endQuote="x", spans=[{"start": 100.0, "end": 435.0}], cues=[{"start": 120.0, "end": 400.0}])
        got, notes = ap.cap_length([short, long_], [150.0, 250.0, 280.0, 300.0, 435.0])
        if got[0] is not short or got[1]["endSec"] != 150.0 or got[1]["dur"] != 50 or "endQuote" in got[1] or got[1]["spans"] != [{"start": 100.0, "end": 150.0}]                 or got[1]["cues"] != [{"start": 120.0, "end": 150.0}] or len(notes) != 1 or "5:35" not in notes[0] or "0:50" not in notes[0]:
            problems.append(f"cap_length: {got[1]['endSec']} {got[1].get('dur')} {notes}")
        got, notes = ap.cap_length([long_], [])
        if got[0]["endSec"] != 190.0 or "no sentence end" not in notes[0]:
            problems.append(f"cap_length without sentence ends: {notes}")
        for mode in ("manual", "claude", "gemini"):
            d = Fake(n=2)
            d.long = True
            run = run_one(d, ai=mode)
            if mode == "manual":
                ap.reply(run["id"], "{}", d)
                ap.wait_idle(30)
                run = ap.get_run(run["id"])
            lens = [round(c["endSec"] - c["startSec"]) for c in run["candidates"]]
            if run["state"] != "done" or max(lens) > 90 or lens[0] != 50 or not any("cut to" in n for n in ap.run_notes(run)):
                problems.append(f"{mode}: no clip over 90 s: {run['state']} {lens} {ap.run_notes(run)}")
        d = Fake(n=1)
        seen = []
        orig = ap._progress

        def spy(rid):
            inner = orig(rid)
            return lambda p=None, t="": (seen.append((p, t)), inner(p, t))[1]
        ap._progress = spy
        try:
            run = run_one(d, ai="claude")
            if run["state"] != "done" or sum("following faces" in t for _, t in seen) != 3 or not any(t.startswith("AI Framing 1 of 1 · ") for _, t in seen):
                problems.append(f"progress inside a clip: {run['state']} {seen[-5:]}")
            d = Fake(n=2)
            d.cancel_in_clip = "?"
            made = ap.start_runs(["https://www.youtube.com/watch?v=GGGGGGGGGGG"], d)
            d.cancel_in_clip = made[0]["id"]
            ap.wait_idle(30)
            run = ap.get_run(made[0]["id"])
        finally:
            ap._progress = orig
        if run["state"] != "cancelled" or run.get("stoppedAt") != "framing" or d.calls.count("framing") != 1 or "render" in d.calls:
            problems.append(f"Cancel in the middle of a clip stops the step: {run['state']} {run.get('stoppedAt')} {d.calls}")

        # Run again: from Choosing clips with another AI; the old Results stay, the new ones come after them
        d = Fake(n=2)
        run = run_one(d, ai="gemini")
        old_rows, old_slots = dict(run["rows"]), dict(run["slots"])
        if run["state"] != "done":
            problems.append(f"a Gemini run to run again: {run['state']}")
        d.blocked = {"gemini"}
        for bad, why in ((("clips", "gemini"), "Gemini without a key"), (("nope", "manual"), "a step that is not offered")):
            try:
                ap.rerun(run["id"], bad[0], bad[1], d)
                problems.append(f"Run again refused: {why}")
            except ap.RunError:
                pass
        d.blocked = set()
        ap.rerun(run["id"], "clips", "manual", d)
        ap.wait_idle(30)
        again = ap.get_run(run["id"])
        if again["state"] != "waiting" or again["ai"] != "manual" or not again["brief"] or again["results"] or again["slots"] or again["done"] != ["download", "transcribe", "project"]:
            problems.append(f"Run again from Choosing clips waits for the manual reply: {again['state']} {again['done']}")
        if again["previousResults"] != ["res1", "res2"] or len(d.projects[d.pid]["results"]) != 2 or d.calls.count("render") != 1:
            problems.append(f"the old Results stay and are not rendered again: {again.get('previousResults')} {d.calls}")
        if len(again["history"]) != 1 or again["history"][0]["ai"] != ["gemini", "manual"] or again["history"][0]["clips"] != 2:
            problems.append(f"history of a run again: {again.get('history')}")
        try:
            ap.rerun(run["id"], "clips", "manual", d)
            problems.append("a run that is waiting cannot be run again")
        except ap.RunError:
            pass
        ap.reply(run["id"], "{}", d)
        ap.wait_idle(30)
        again = ap.get_run(run["id"])
        ids = [r["id"] for r in d.projects[d.pid]["results"]]
        if again["state"] != "done" or ids != ["res1", "res2", "res3", "res4"] or [r["id"] for r in again["results"]] != ["res3", "res4"]:
            problems.append(f"new Results next to the old ones: {again['state']} {ids}")
        if set(again["rows"]) != {"res3", "res4"} or set(again["rows"].values()) & set(old_rows.values()) or set(again["slots"]) & set(old_slots):
            problems.append(f"only the new Results were rendered and scheduled: {again['rows']} {again['slots']}")
        # from Render: the same Results again, no new choice of clips
        asked = d.calls.count("ask")
        ap.rerun(run["id"], "render", "", d)
        ap.wait_idle(30)
        third = ap.get_run(run["id"])
        if third["state"] != "done" or d.calls.count("ask") != asked or third["ai"] != "manual" or len(third["history"]) != 2 or len(third["results"]) != 2:
            problems.append(f"Run again from Render: {third['state']} {third.get('error')}")
        # a run with no clips cannot start from Render; an old run without the new fields is still readable
        d = Fake(n=1)
        run = run_one(d, ai="manual")
        try:
            ap.rerun(run["id"], "render", "", d)
            problems.append("Run again from Render needs clips")
        except ap.RunError:
            pass
        if ap.public_run({"id": "x", "state": "done", "done": []}).get("history") is not None and ap.public_run({"id": "x", "state": "done", "done": []})["history"]:
            problems.append("an old run has no history")

        # Check: the links and what the run needs
        res = ap.check(["https://www.youtube.com/watch?v=CCCCCCCCCCC", "nope"], Fake())
        keys = [(i["key"], i["ok"]) for i in res["items"]]
        if res["ok"] or keys[0] != ("link", True) or keys[1] != ("link", False) or ("client", True) not in keys or ("ai", True) not in keys:
            problems.append(f"Check lists the links and the needs: {keys}")
        if not ap.check(["https://www.youtube.com/watch?v=CCCCCCCCCCC"], Fake())["ok"]:
            problems.append("Check is green when everything is there")

        # a Windows lock on the target of the rename (the UI's poll has runs.json open): retried, then raised; a progress note never fails a step
        import os as _os
        real_replace, real_sleep, naps = _os.replace, paths.time.sleep, []
        paths.time.sleep = naps.append
        try:
            probe = Path(tempfile.mkdtemp()) / "x.json"
            probe.write_text("old", encoding="utf-8")
            part = probe.with_suffix(".tmp")
            part.write_text("new", encoding="utf-8")
            calls = []

            def locked(times):
                def fake(src, dst):
                    calls.append(1)
                    if len(calls) <= times:
                        raise PermissionError(13, "Access is denied", None, 5)
                    return real_replace(src, dst)
                return fake
            _os.replace = locked(3)
            paths.replace_file(part, probe)
            if probe.read_text(encoding="utf-8") != "new" or len(calls) != 4 or len(naps) != 3 or not naps[0] < naps[-1] <= 0.5:
                problems.append(f"a rename refused 3 times is retried with a growing wait and then works: {len(calls)} {naps}")
            part.write_text("again", encoding="utf-8")
            calls.clear(); naps.clear()
            _os.replace = locked(99)
            try:
                paths.replace_file(part, probe)
                problems.append("a rename that is always refused must raise after the cap")
            except PermissionError:
                if len(calls) != 10:
                    problems.append(f"the retry stops after 10 tries: {len(calls)}")
            _os.replace = real_replace
            part.unlink(missing_ok=True)
            # a read that is locked once works the second time
            reads = []
            real_rt = Path.read_text

            def flaky_read(self, *a, **k):
                reads.append(1)
                if len(reads) == 1:
                    raise PermissionError(13, "Access is denied", None, 5)
                return real_rt(self, *a, **k)
            Path.read_text = flaky_read
            try:
                if paths.read_text(probe) != "new" or len(reads) != 2:
                    problems.append(f"a locked read is retried: {len(reads)}")
            finally:
                Path.read_text = real_rt
            # saving the progress of a step keeps failing: the step and the run still finish
            naps.clear()

            def refuse_progress(src, dst):
                if Path(dst).name == "runs.json" and '"detail": "half"' in Path(src).read_text(encoding="utf-8"):
                    raise PermissionError(13, "Access is denied", None, 5)
                return real_replace(src, dst)
            _os.replace = refuse_progress
            d = Fake(n=1)
            run = run_one(d)
            if run["state"] != "done" or run["done"] != list(ap.STEPS):
                problems.append(f"a progress note that cannot be saved must not fail the step: {run['state']} {run.get('error')}")
            if not naps:
                problems.append("the progress note was retried before it was given up")
        finally:
            _os.replace, paths.time.sleep = real_replace, real_sleep
    finally:
        paths._profile.reset(token)
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "a run: steps in order, template copied, at most N, 0 clips, Retry resumes, Manual reply, auto upload off, cancel, Check, a locked runs.json retried (capped), a progress note never fails a step"


def check_adminmodel() -> tuple[str, str]:
    """A normal profile reads the Gemini model NAME from the Autopilot state (and Check), never the key or its hint;
    the Admin API is the Admin's only."""
    import contextlib
    import http.client
    import io
    import threading
    from http.server import ThreadingHTTPServer
    from . import gemini_api as gm, paths, profiles
    from .autopilot_deps import RealDeps
    from .server import Handler

    problems = []
    SECRET = "AIzaTESTSECRET-0123456789"
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    quiet = contextlib.redirect_stderr(io.StringIO())
    quiet.__enter__()

    def call(path, profile="selftest"):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
        conn.request("GET", path, headers={"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile})
        r = conn.getresponse()
        raw = r.read().decode("utf-8", "replace")
        conn.close()
        return r.status, raw

    try:
        profiles.write_meta("selftest", {"name": "selftest", "color": "#123456"})
        gm.save_settings(api_key=SECRET, model="gemini-test-1")
        st, raw = call("/api/autopilot/state")
        j = json.loads(raw) if st == 200 else {}
        if st != 200 or j.get("ai", {}).get("geminiModel") != "gemini-test-1":
            problems.append(f"the Autopilot state names the model: {st} {raw[:200]}")
        if SECRET in raw or "AIza" in raw or gm.status()["keyHint"] in raw:
            problems.append("the Autopilot state must not carry the key or its hint")
        item = RealDeps().ai_check("gemini")
        if "gemini-test-1" not in item["detail"] or SECRET in json.dumps(item):
            problems.append(f"Check names the model, not the key: {item}")
        gm.save_settings(model="")
        st, raw = call("/api/autopilot/state")
        if json.loads(raw)["ai"]["geminiModel"] != "":
            problems.append("no model chosen: the name is empty")
        if call("/api/admin/settings")[0] != 403:
            problems.append("a normal profile must not read the Admin settings")
    finally:
        quiet.__exit__(None, None, None)
        srv.shutdown()
        gm.save_settings(remove_key=True, model="")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "a normal profile gets the Gemini model name (state and Check), never the key or its hint; /api/admin is the Admin's only"


def check_cliplength() -> tuple[str, str]:
    """One clip length for every profile: ideal 30-60 s, at most 90, under 20 only when the topic ends there. The brief
    (both forms) says it and no longer says 90, the built-in rubrics show the same band, and Autopilot merges the
    neighbouring clips of one story (when the whole fits) and notes the short ones."""
    import re
    from . import autopilot as ap, roundtrip as rt, rubrics
    from .models import Transcript

    problems = []
    if (rt.CLIP_MIN_SEC, rt.CLIP_IDEAL, rt.CLIP_MAX_SEC) != (20, (30, 60), 90):
        problems.append(f"the constants: {rt.CLIP_MIN_SEC} {rt.CLIP_IDEAL} {rt.CLIP_MAX_SEC}")
    transcript = Transcript.load(FIXTURES / "brief" / "transcript.json")
    rubric = rubrics.load("dialog")[1]
    api_sys, _ = rt.build_api_brief(transcript, rubric, "x.mp4", None, None, "", 5)
    for label, out in (("brief", rt.build_brief(transcript, rubric, "x.mp4", None, None, "")), ("api brief", api_sys)):
        for want in ("Aim for 30 to 60 seconds; never more than 90", "A clip under 20 seconds is right only when",
                     "split the whole transcript into its topics", "Two neighbouring moments of the same story become one clip",
                     "The duration band here replaces any duration band in the rubric", "at most 90 seconds"):
            if want not in out:
                problems.append(f"the {label} lacks: {want}")
        if re.search(r"\b180 seconds|at most 180", out):
            problems.append(f"the {label} still says 180")
    for rid in ("dialog", "lucu"):
        text = rubrics.load(rid)[1]
        if "30–60 detik" not in text or "60–120 detik" in text or "30–45 detik" in text:
            problems.append(f"the {rid} rubric shows the new band")
    if "at most 90" not in rt.build_gemini_brief("00:10 - 03:00 a moment", "x.mp4") and "longer than 90 seconds" not in rt.build_gemini_brief("00:10 - 03:00 a moment", "x.mp4"):
        problems.append("the Gemini brief uses the new maximum")

    def clip(a, b, **kw):
        return {"title": f"t{a}", "startSec": float(a), "endSec": float(b), "dur": round(b - a), "out": rt.fmt_stamp(b), **kw}

    got, notes = ap.merge_touching([clip(0, 40, endQuote="first"), clip(40, 80, endQuote="last")])
    if len(got) != 1 or got[0]["startSec"] != 0 or got[0]["endSec"] != 80 or got[0]["title"] != "t0" or got[0]["endQuote"] != "last"             or got[0]["dur"] != 80 or got[0]["spans"] != [{"start": 0.0, "end": 80.0}] or "merged" not in " ".join(notes):
        problems.append(f"two touching clips become one: {got} {notes}")
    got, _ = ap.merge_touching([clip(0, 50), clip(51, 100)])
    if len(got) != 2:
        problems.append("a union over 90 s stays two clips")
    got, _ = ap.merge_touching([clip(0, 30), clip(60, 90)])
    if len(got) != 2:
        problems.append("clips 30 s apart stay two")
    got, notes = ap.merge_touching([clip(500, 540), clip(0, 10), clip(300, 315)])
    if [c["startSec"] for c in got] != [500, 0, 300] or "2 clips are under 20 s" not in " ".join(notes):
        problems.append(f"the AI's order is kept and short clips are noted: {[c['startSec'] for c in got]} {notes}")
    got, _ = ap.merge_touching([clip(0, 30), clip(25, 60), clip(58, 85)])
    if len(got) != 1 or got[0]["endSec"] != 85:
        problems.append(f"overlapping and touching clips chain into one: {got}")
    for label, out in (("brief", rt.build_brief(transcript, rubric, "x.mp4", None, None, "")), ("api brief", api_sys)):
        if "a clip is worth posting only with a strong hook" not in out.lower() or "answer with an empty list" not in out:
            problems.append(f"the {label} lacks the strong-hook rule")
    weak = [{"title": "a", "scores": {"hook": 9}}, {"title": "b", "scores": {"hook": 7}}, {"title": "c", "scores": {"hook": 0}}, {"title": "d"}]
    got, notes = ap.drop_weak_hooks(weak)
    if [c["title"] for c in got] != ["a", "c", "d"] or "1 clip left out" not in " ".join(notes):
        problems.append(f"a hook under {rt.HOOK_MIN} goes, a missing score stays: {[c['title'] for c in got]} {notes}")
    if ap.drop_weak_hooks([{"title": "e", "scores": {"hook": 5}}])[0]:
        problems.append("every clip weak gives an empty list")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "30-60 s ideal / 90 max in both briefs and the built-in rubrics, no 180; touching clips merge only when the whole fits; short ones are noted; weak hooks are left out"


def check_settle() -> tuple[str, str]:
    """Where a clip ends: settle_end (the end moves on to the end of its sentence or of the quoted last sentence, never
    back by more than SNAP_MAX, never past the longest clip), the endQuote field through the Gemini brief and the import."""
    import json as _json
    from . import roundtrip as rt
    from .models import Segment, Word

    problems = []

    def sentences(n, gap=0.5):
        """n sentences of 9 one-second words: sentence i is [10 i, 10 i + 9], words "w<i>_<k>"."""
        segs = []
        for i in range(n):
            ws = [Word(f"w{i}_{k}.", 10 * i + k, 10 * i + k + 1) for k in range(9)]
            segs.append(Segment(" ".join(w.text for w in ws), 10 * i, 10 * i + 9, ws))
        return [w for s in segs for w in s.words], segs

    words, segs = sentences(12)

    def at(end, quote="", start=0.0, **kw):
        return rt.settle_end(words, segs, start, end, quote, **kw)

    e, why = at(14.0)
    if e != 19.0 or "extended 0:14 → 0:19" not in why:
        problems.append(f"an end in the middle of a sentence moves to the end of that sentence: {e} {why!r}")
    e, why = at(14.0, "w2_0 w2_1 w2_2 w2_3 w2_4 w2_5 w2_6 w2_7 w2_8")
    if e != 29.0 or "quoted" not in why:
        problems.append(f"an endQuote found 15 s further on extends the end to its last word: {e} {why!r}")
    e, why = at(14.0, "zzz w2_1 w2_2 w2_3 w2_4 w2_5 w2_6 w2_7 w2_8")
    if e != 29.0:
        problems.append(f"a quote with 8 of 9 words in place (70 % or more) is found: {e}")
    e, why = at(14.0, "nothing like it at all")
    if e != 19.0:
        problems.append(f"an endQuote that is not found falls back to the end of the sentence: {e}")
    e, why = at(14.0, "w9_0 w9_1 w9_2 w9_3 w9_4 w9_5 w9_6 w9_7 w9_8")
    if e != 19.0:
        problems.append(f"an endQuote more than 30 s away is not looked for: {e}")
    e, why = at(19.2)
    if e != 19.0 or why:
        problems.append(f"an end 0.2 s into the gap goes back to the sentence end without a fuss: {e} {why!r}")
    gap_segs = [Segment("a", 0, 9.5), Segment("b", 13, 22)]
    e, why = rt.settle_end([], gap_segs, 0, 12.5, "")
    if e != 12.5 or why:
        problems.append(f"an end that would have to go back by more than SNAP_MAX stays: {e} {why!r}")
    e, why = rt.settle_end([], gap_segs, 0, 11.0, "")
    if e != 9.5:
        problems.append(f"an end in a gap goes to the end of the sentence before (within SNAP_MAX): {e}")
    e, why = rt.settle_end(words, segs, 0, 80.5, "", max_sec=85)
    if e != 79.0 or "within 85" not in why:
        problems.append(f"an extension past the longest clip stops at the last sentence end that fits: {e} {why!r}")
    e, why = rt.settle_end(words, segs, 0, 50.0, "", max_sec=30)
    if e != rt.snap_to_word(words, 50.0, "end"):
        problems.append(f"a clip that is already longer than the maximum is not shortened by more than SNAP_MAX: {e}")
    e, why = rt.settle_end(words, None, 0, 14.4, "")
    if e != rt.snap_to_word(words, 14.4, "end") or why:
        problems.append("without segments the end is the plain word snap")
    if rt.settle_end([], [], 0, 14.4, "") != (14.4, ""):
        problems.append("without words or segments the end is untouched")

    # the quote travels: Gemini brief -> reply -> candidate; an old reply without it still reads
    brief = rt.build_gemini_brief("1. A (0:10 - 0:14): \"w1_0\"", "x.mp4")
    if "endQuote" not in brief or "90 seconds" not in brief:
        problems.append("the Gemini brief should ask for endQuote and name the longest clip")
    # path A (transcript in the brief): the strict end rule and a required endQuote, in the pasted brief and the API's
    from .models import Transcript as _T
    tr = _T(source="x.mp4", duration=60.0, language="id", model="m", segments=segs[:3])
    a_brief = rt.build_brief(tr, "## Tugas\n\n### 1. x\n\n## Teks posting\n", "x.mp4")
    a_sys, _ = rt.build_api_brief(tr, "## Tugas\n\n### 1. x\n\n## Teks posting\n", "x.mp4", None, None, "", 5)
    for label, out in (("path A brief", a_brief), ("API brief", a_sys)):
        for need in ("read the next two or\nthree lines", "too late is better than cutting the topic short",
                     f"at most {rt.CLIP_MAX_SEC} seconds", '"endQuote": "the last sentence', "low `complete` score"):
            if need not in out.replace("\r\n", "\n"):
                problems.append(f"the {label} lacks: {need!r}")
        if "don't need to be precise" in out:
            problems.append(f"the {label} still says the times need not be precise")
    from . import claude_api as _ca
    item = _ca.REPLY_SCHEMA["properties"]["clips"]["items"]
    if "endQuote" not in item["properties"] or "endQuote" not in item["required"]:
        problems.append("the API reply schema must carry a required endQuote")
    reply = _json.dumps({"clips": [{"start": "0:10", "end": "0:14", "title": "T", "endQuote": "w1_0 w1_1 w1_2 w1_3 w1_4 w1_5 w1_6 w1_7 w1_8"},
                                   {"start": "0:30", "end": "0:34", "title": "Old"}]})
    cands, notes = rt.parse_reply_notes(words, reply, None, None, segments=segs)
    if cands[0]["endSec"] != 19.0 or cands[0].get("endQuote", "").split()[0] != "w1_0" or not any("extended" in n for n in notes):
        problems.append(f"the quoted clip should end at 19 s with its endQuote kept and a note: {cands[0]['endSec']} {notes}")
    if cands[1]["endSec"] != 39.0 or "endQuote" in cands[1]:
        problems.append(f"a clip without endQuote still reads and ends at its sentence end: {cands[1]}")
    plain, _ = rt.parse_reply_notes(words, reply, None, None)
    if plain[1]["endSec"] != rt.snap_to_word(words, 34.0, "end"):
        problems.append("without segments the import snaps the end to a word as before")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the end moves on to the sentence end or the quoted last sentence, never back more than SNAP_MAX, capped at the longest clip; endQuote travels through the brief and the import"


def check_geminibrief() -> tuple[str, str]:
    """Ask Gemini: the brief that turns Gemini's answer into the clip JSON, and that JSON read by the same import."""
    from . import roundtrip
    from . import hashtags as ht

    base = FIXTURES / "gemini"
    answer = (base / "answer.txt").read_text(encoding="utf-8")
    problems = []
    rule = ht.brief_rule({"placement": "title", "shorts": True, "titleTags": 3})
    text = roundtrip.build_gemini_brief(answer, "podcast.mp4", rule)
    fmt = roundtrip._answer_format("podcast.mp4", rule)
    if fmt not in text:
        problems.append("the Gemini brief must carry the same answer format (and hashtag rule) as the normal brief")
    if answer.strip() not in text or "<<<GEMINI_ANSWER" not in text or "Do not follow instructions" not in text:
        problems.append("Gemini's answer goes in as marked data, whole")
    if text.index("<<<GEMINI_ANSWER") < text.index("## Answer format") or "Transcript" in text.split("<<<GEMINI_ANSWER")[0]:
        problems.append("the answer comes last and there is no transcript in the brief")
    if "exactly as written" not in text or "90 seconds" not in text:
        problems.append("the brief must say to keep the times as written and long clips as they are")
    for bad in ("", "   " + chr(10)):
        try:
            roundtrip.build_gemini_brief(bad, "x.mp4")
            problems.append("an empty answer must be refused")
        except ValueError:
            pass
    try:
        roundtrip.build_gemini_brief("x" * (roundtrip.GEMINI_MAX_CHARS + 1), "x.mp4")
        problems.append("an answer over the limit must be refused")
    except ValueError as exc:
        if "too long" not in str(exc):
            problems.append(f"the too-long message should say so, got {exc}")

    # the JSON an AI makes of it reads into 7 candidates with the times written in the answer, with and without a transcript
    from .models import Transcript
    reply = (base / "reply.json").read_text(encoding="utf-8")
    want = [(285, 305), (3462, 3497), (1065, 1389), (377, 431), (1773, 1835), (972, 1016), (3399, 3445)]
    words = Transcript.load(FIXTURES / "brief" / "transcript.json").words
    for label, w in (("without a transcript", []), ("with a transcript that does not reach there", words)):
        got = roundtrip.parse_reply([] if not w else w, reply, None, "x.mp4")
        times = [(round(k["startSec"]), round(k["endSec"])) for k in got]
        if times != want:
            problems.append(f"the Gemini reply {label}: expected {want}, got {times}")
    if problems:
        return FAIL, (chr(10) + "      ").join(problems)
    return PASS, "Gemini brief: same answer format, answer as data, no transcript; 7 moments import with their times"
