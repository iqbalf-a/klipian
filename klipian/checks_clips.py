"""Selftest checks: ranges, cues, the cold open, the HTTP guard, credits, the upload schedule and the audio fingerprint."""

from __future__ import annotations


import shutil
import tempfile
from pathlib import Path

from .selftest_base import FIXTURES, PASS, FAIL, SKIP


def check_ranges() -> tuple[str, str]:
    """Transcribing only some ranges: the range arithmetic, a partial transcript added to and replaced, and a real
    transcription of two ranges of a synthetic spoken file (skipped where Windows speech or the small model is missing)."""
    import tempfile
    from .models import Segment, Transcript, Word, merge_ranges, subtract_ranges

    nl = chr(10) + "      "
    problems = []
    if merge_ranges([[5, 10], [0, 3], [9, 12], [20, 20]]) != [[0.0, 3.0], [5.0, 12.0]]:
        problems.append("merge_ranges: sorted, overlaps joined, empty ones dropped")
    if merge_ranges([[0, 3], [5, 8]], gap=5) != [[0.0, 8.0]]:
        problems.append("merge_ranges: closer than the gap joins")
    if subtract_ranges([[0, 100]], [[10, 20], [50, 60]]) != [[0, 10], [20, 50], [60, 100]]:
        problems.append("subtract_ranges: the uncovered parts")
    if subtract_ranges([[10, 20]], [[0, 100]]) != [] or subtract_ranges([[10, 20]], None) != [[10, 20]]:
        problems.append("subtract_ranges: all covered / nothing covered")

    def seg(a, b, text):
        return Segment(text, a, b, [Word(text, a, b)])

    old = Transcript("v.mp4", 600.0, "id", "m", [seg(10, 20, "a"), seg(30, 40, "b")], ranges=[[0.0, 50.0]])
    new = Transcript("v.mp4", 600.0, "id", "m", [seg(100, 110, "c"), seg(45, 48, "dup")], ranges=[[90.0, 120.0]])
    both = old.merged_with(new)
    if [g.text for g in both.segments] != ["a", "b", "c"] or both.ranges != [[0.0, 50.0], [90.0, 120.0]]:
        problems.append(f"merged_with: segments in order, nothing twice, ranges joined: {[g.text for g in both.segments]} {both.ranges}")
    if old.uncovered(40, 95) != [[50, 95]] or both.uncovered(95, 100) != []:
        problems.append("uncovered: the part of a span the transcript has no words for")
    whole = Transcript("v.mp4", 600.0, "id", "m", [seg(0, 5, "x")])
    if whole.partial or whole.uncovered(0, 600) != [] or "ranges" in whole.to_dict():
        problems.append("a whole transcript has no ranges, covers everything and is written as before")
    d = whole.to_dict()
    d.pop("ranges", None)
    if Transcript.from_dict(d).ranges is not None:
        problems.append("a transcript written before ranges existed reads as the whole video")

    def verdict(extra=""):
        if problems:
            return FAIL, nl.join(problems)
        return PASS, "ranges merged and subtracted; partial transcripts added to and read back" + extra

    with tempfile.TemporaryDirectory(prefix="klipian-ranges-") as tmp:
        f = Path(tmp) / "p.transcript.json"
        both.save(f)
        if Transcript.load(f).ranges != [[0.0, 50.0], [90.0, 120.0]]:
            problems.append("ranges are saved and read back")

        # real: phrases spoken at 2 s, 32 s and 62 s; only the ranges around the first and the last are transcribed
        import shutil
        import subprocess
        import sys
        from .ffmpeg_tools import _require
        model_dir = Path.home() / ".cache" / "huggingface" / "hub" / "models--Systran--faster-whisper-small"
        if sys.platform != "win32" or not shutil.which("powershell") or not model_dir.is_dir():
            return verdict("; no real transcription here (Windows speech or the small model is missing)")
        tts = []
        for i, line in enumerate(("Hello everyone, this is the first part of the test.",
                                  "Now we talk about something else entirely.",
                                  "And this is the last part of the recording.")):
            wav = Path(tmp) / f"s{i}.wav"
            ps = ("Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                  f"$s.SetOutputToWaveFile('{wav}'); $s.Speak('{line}'); $s.Dispose()")
            subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, timeout=60)
            tts.append(wav)
        if not all(w.is_file() for w in tts):
            return verdict("; Windows speech could not make the test audio")
        mix = Path(tmp) / "mix.wav"
        subprocess.run([_require("ffmpeg"), "-y", "-loglevel", "error", "-f", "lavfi", "-t", "75", "-i", "anullsrc=r=16000:cl=mono",
                        *sum((["-i", str(w)] for w in tts), []),
                        "-filter_complex", "[1]aresample=16000,adelay=2000|2000[a];[2]aresample=16000,adelay=32000|32000[b];"
                        "[3]aresample=16000,adelay=62000|62000[c];[0][a][b][c]amix=inputs=4:normalize=0[o]",
                        "-map", "[o]", "-ac", "1", str(mix)], check=True, timeout=120)
        from .transcribe import transcribe
        done = []
        got = transcribe(mix, model_size="small", language="en", threads=4, verbose=False,
                         ranges=[[0, 20], [55, 75]], on_segment=lambda pos, total: done.append((pos, total)))
        words = [(w.text.strip().lower(), w.start) for w in got.words]
        inside = all(any(a <= t <= b for a, b in ((0, 20), (55, 75))) for _, t in words)
        said = " ".join(w for w, _ in words)
        if got.ranges != [[0.0, 20.0], [55.0, 75.0]] or abs(got.duration - 75) > 1:
            problems.append(f"real transcription: ranges {got.ranges}, duration {got.duration}")
        if not words or not inside:
            problems.append(f"real transcription: every word must lie inside a range, in the time of the whole file: {words[:6]}")
        if "first" not in said or "last" not in said or "else" in said:
            problems.append(f"real transcription: the first and last phrase only, got {said!r}")
        if not done or done[-1][1] != 40.0 or max(p for p, _ in done) > 40.0:
            problems.append(f"real transcription: progress counts the 40 s of the ranges, got {done[-1:]}")
    return verdict("; two ranges of a spoken file transcribed at their own times")


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

    # energy: 200 s at 0 dB with a 4 s burst at 90 s -> one loud peak there; flat audio and no heatmap -> nothing
    flat = [0.0] * 200
    burst = [8.0 if 90 <= i < 94 else 0.0 for i in range(200)]
    peaks = cues.energy_peaks(burst)
    if len(peaks) != 1 or not (88 <= peaks[0]["start"] and peaks[0]["end"] <= 96) or cues.energy_peaks(flat):
        problems.append(f"energy_peaks wrong: {peaks}")
    heat = [{"start_time": i * 10.0, "end_time": i * 10.0 + 10, "value": 0.9 if i == 7 else 0.2} for i in range(20)]
    hp = cues.heatmap_peaks(heat)
    if [(p["kind"], p["start"]) for p in hp] != [("replayed", 70.0)] or cues.heatmap_peaks(None) or cues.heatmap_peaks([]):
        problems.append(f"heatmap_peaks wrong: {hp}")
    from . import roundtrip
    text = roundtrip._cues_block({"status": {"audio": "ok"}, "cues": [], "energy": peaks + hp})
    if "loud peak" not in text or "most replayed" not in text or "No audio or timing cues" in text:
        problems.append("energy lines missing from the brief's cue block")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "levels, pauses, fast talk, per-clip cues, energy peaks, heatmap"


def check_coldopen() -> tuple[str, str]:
    """The cold open (render.py, jobs.py, tts.py): the hook found in the clip's words (also when the transcript writes numbers or
    word endings differently), off by default, a skip always says why, the AI voice (a fake client: no network) cached and
    levelled, the held frame as long as the voice, the big text in the thumbnail look, captions shifted."""
    import math
    import struct
    import tempfile
    from . import render, tts
    from .models import Word
    from .jobs import cold_open_for

    problems = []
    ws = "ini adalah kalimat pembuka yang sangat menarik sekali bagi penonton".split()
    words = [Word(text=t, start=1.0 + i * 0.4, end=1.35 + i * 0.4) for i, t in enumerate(ws)]
    spans = [render.Span(0.5, 8.0)]
    got = render.hook_window(words, "Kalimat pembuka, yang sangat menarik!", spans)
    if not got or abs(got[0] - 1.8) > 1e-9 or abs(got[1] - 3.75) > 1e-9:
        problems.append(f"hook_window = {got}, expected (1.8, 3.75)")
    cut = render.hook_window(words, "kalimat pembuka yang sangat menarik sekali bagi", spans)
    if not cut or cut[1] - cut[0] > render.COLD_MAX_SEC:
        problems.append(f"a long hook is not cut at {render.COLD_MAX_SEC} s: {cut}")
    if render.hook_window(words, "tidak ada di sini", spans) or render.hook_window(words, "ini adalah", [render.Span(5, 8)]):
        problems.append("a hook that is not inside the clip must give None")

    # the real case: the AI wrote "Tensinya 230 per 130", the transcript says "tensinya 2 .30 per 1 .30" and has other words before it
    real = "Abi begitu bangun tensinya 2 .30 per 1 .30 yaudah langsung".split()
    rw = [Word(text=" " + t, start=10.0 + i * 0.4, end=10.35 + i * 0.4) for i, t in enumerate(real)]
    m = render.hook_match(rw, "Kemarin itu dia bangun tidur. Tensinya 230 per 130", [render.Span(9, 20)])
    if not m or m[2] != "approx" or abs(m[0] - 10.8) > 1e-9:
        problems.append(f"the number case is not matched: {m}")
    if render.hook_match(rw, "Obat itu bagus sekali untuk kita semua", [render.Span(9, 20)]) or render.hook_match(rw, "dia bangun tidur", [render.Span(9, 20)]):
        problems.append("an unrelated hook (or one with only a single word in common) must not match")
    if (render.hook_match(words, "kalimat pembuka yang sangat menarik", spans) or ("", 0, ""))[2] != "exact":
        problems.append("a hook spoken as written must be an exact match")

    # a voice from a fake Gemini client: raw PCM as the API may send it, asked once, then from the cache
    calls = []

    class Fake:
        class interactions:
            @staticmethod
            def create(model, input, response_format, generation_config):
                import base64
                item = input[0]["content"][0]
                calls.append((model, item["text"], item.get("annotations"), generation_config))
                pcm = b"".join(struct.pack("<h", int(8000 * math.sin(i / 20))) for i in range(24000 * 2))      # 2 s of tone at 24 kHz
                return type("R", (), {"output_audio": type("A", (), {"data": base64.b64encode(pcm).decode()})})
    with tempfile.TemporaryDirectory() as td:
        a, secs = tts.voice_for("Tensi *230* pas bangun tidur", client=Fake, cache_dir=Path(td))
        b, _ = tts.voice_for("Tensi 230 pas bangun tidur", client=Fake, cache_dir=Path(td))
        if len(calls) != 1 or a != b or not 1.5 < secs < 2.2:
            problems.append(f"voice: {len(calls)} calls, {secs} s (one call, about 2 s, expected)")
        want_style = tts.settings()[2]
        if (not calls or calls[0][1] != "Tensi 230 pas bangun tidur!" or calls[0][2] != [{"type": "speech_metadata", "style": want_style}]
                or calls[0][3] != {"speech_config": [{"voice": tts.settings()[1]}]}):
            problems.append(f"the transcript must be the hook alone, the style an annotation: {calls}")
        if calls and calls[0][0] != tts.settings()[0]:
            problems.append("the model must come from the settings")

        job = render.RenderJob(title="t", spans=spans)
        k = {"hook": "kalimat pembuka yang sangat menarik", "thumb": "Kalimat *pembuka* menarik"}
        off = cold_open_for(k, job, words)                          # the request alone decides: nothing asked, nothing done
        if off[0] or off[4] or job.lead:
            problems.append("the cold open must be off, with nothing to say, unless asked for")
        plain = render.build_filter(job, 1280, 720, None)
        speak = lambda text: (a, 2.0)
        mode, cold, text, wav, note = cold_open_for({**k, "coldOpen": "freeze", "coldVoice": "tts"}, job, words, speak)
        j = render.RenderJob(title="t", spans=spans, cold_open=mode, cold=cold, cold_text=text, cold_voice=wav)
        filt = render.build_filter(j, 1280, 720, None)
        if mode != "freeze" or abs(j.lead - 2.1) > 1e-9 or abs(j.duration - (7.5 + 2.1)) > 1e-9 or wav != a:
            problems.append(f"freeze: {mode} lead {j.lead} duration {j.duration}")
        if "tpad" not in filt or "stop_duration=2.100" not in filt or "[1:a]" not in filt or "concat=n=2" not in filt or "tpad" in plain:
            problems.append("freeze: the graph must hold a frame for the voice's length and take the sound from input 1")
        if "atrim=start=1.800:end=4.050" in filt:
            problems.append("freeze with the AI voice must not play the clip's own sound")
        ass = render.build_ass(j, words, {"watermark": False})
        if "0:00:00.00,0:00:02.10,Hook" not in ass or "KALIMAT" not in ass or "Impact" not in ass or "\\1c&H" not in ass or ass.count("Dialogue: 3,") != 1:
            problems.append("freeze: the big text is not written in the thumbnail look for the held frame")
        if "0:00:02.60" not in ass:                       # "ini" (1.0 s in the source, 0.5 s into the clip) lands 2.1 s later
            problems.append("freeze: captions are not shifted by the cold open")
        # the clip's own voice under the held frame, and "move": the hook window, no AI voice
        for extra, name in (({"coldOpen": "freeze", "coldVoice": "original"}, "freeze+original"), ({"coldOpen": "move"}, "move")):
            mode, cold, text, wav, note = cold_open_for({**k, **extra}, job, words, lambda t: 1 / 0)
            j2 = render.RenderJob(title="t", spans=spans, cold_open=mode, cold=cold, cold_text=text, cold_voice=wav)
            f2 = render.build_filter(j2, 1280, 720, None)
            if wav or abs(j2.lead - 1.95) > 1e-9 or "[1:a]" in f2 or ("tpad" in f2) != (name == "freeze+original"):
                problems.append(f"{name}: lead {j2.lead}, filter off")

        def failing(t):
            raise tts.TtsError("quota")
        # the skips say why; the AI voice failing never raises
        for what, kk, sp, expect in (
                ("no hook", {"coldOpen": "freeze", "coldVoice": "tts"}, speak, "no hook or thumb"),
                ("move, hook not found", {"coldOpen": "move", "hook": "tidak ada di sini sama sekali"}, speak, "not in the clip"),
                ("voice fails", {**k, "coldOpen": "freeze", "coldVoice": "tts"}, failing, "AI voice failed (quota)"),
                ("voice too long", {**k, "coldOpen": "freeze", "coldVoice": "tts"}, lambda t: (a, 6.0), "even with a shorter text")):
            r_ = cold_open_for(kk, job, words, sp)
            if r_[0] or expect not in r_[4]:
                problems.append(f"{what}: expected a skip saying {expect!r}, got {r_[0]!r} / {r_[4]!r}")
        mode, cold, text, wav, note = cold_open_for({"coldOpen": "freeze", "coldVoice": "tts", "hook": "tidak ada di sini sama sekali", "thumb": "Kalimat *pembuka* menarik"}, job, words, speak)
        if mode != "freeze" or cold[0] != 0.5 or "first frame" not in note:
            problems.append(f"freeze with the hook not found must hold the first frame and say so: {cold} {note}")
    # the choice comes from the request only: an old profile that still has coldOpen / coldVoice loads, is ignored, and loses them on save
    from . import jobs, paths, profiles
    if jobs.clean_cold({"coldOpen": "freeze", "coldVoice": "original", "x": 1}) != {"coldOpen": "freeze", "coldVoice": "original"} \
            or jobs.clean_cold({"coldOpen": "evil", "coldVoice": "tts"}) or jobs.clean_cold(None) or jobs.clean_cold({"coldOpen": "move"}) != {"coldOpen": "move"}:
        problems.append("clean_cold must keep only freeze/move and original")
    profiles.write_meta("cold1", {"name": "cold1", "color": "#336699",
                                  "defaults": {"coldOpen": "freeze", "coldVoice": "original", "rubric": "dialog"}})
    profiles.ensure_dirs("cold1")
    tok = paths.set_profile("cold1")
    try:
        if profiles.read_meta("cold1") is None or profiles.defaults().get("rubric") != "dialog":
            problems.append("a profile with the old cold open fields must still load")
        old = cold_open_for({"hook": "kalimat pembuka yang sangat menarik"}, job, words, speak)
        if old[0] or old[4] or old[3]:
            problems.append(f"an old profile default must not switch a cold open on: {old}")
        asked = cold_open_for({"hook": "kalimat pembuka yang sangat menarik", **jobs.clean_cold({"coldOpen": "move"})}, job, words, speak)
        if asked[0] != "move":
            problems.append("the request's coldOpen must work without any profile default")
        profiles.update("cold1", {"defaults": {"addShorts": True}})
        left = profiles.defaults()
        if "coldOpen" in left or "coldVoice" in left or left.get("rubric") != "dialog":
            problems.append(f"saving an old profile keeps its other settings and drops the cold open ones: {left}")
    finally:
        paths._profile.reset(tok)

    # the voice settings of the profile page: saved in the Gemini settings file (a temp one here), blank = default, "no style" is not blank
    from . import gemini_api
    with tempfile.TemporaryDirectory() as td2:
        real_file = gemini_api._file
        gemini_api._file = lambda: Path(td2) / "gemini.json"
        try:
            gemini_api.save_settings(api_key="k-test-1234")
            st = tts.state()
            if not st["hasKey"] or st["style"] or st["noStyle"] or tts.settings() != (tts.DEFAULT_MODEL, tts.DEFAULT_VOICE, tts.DEFAULT_STYLE):
                problems.append(f"tts defaults: {st} {tts.settings()}")
            tts.save("m-1", "Puck", "Pelan saja", False)
            if tts.settings() != ("m-1", "Puck", "Pelan saja") or tts.state()["noStyle"]:
                problems.append(f"tts save: {tts.settings()}")
            tts.save("", "", "", True)                     # the empty style on purpose: no style, the model and voice back to default
            if tts.settings() != (tts.DEFAULT_MODEL, tts.DEFAULT_VOICE, "") or not tts.state()["noStyle"]:
                problems.append(f"tts 'no style': {tts.settings()} {tts.state()}")
            tts.save("", "", "  ", False)                  # blank and not on purpose: the default again
            if tts.settings()[2] != tts.DEFAULT_STYLE or not tts.state()["hasKey"]:
                problems.append("a blank style must fall back to the default and the key must survive")
            gemini_api.save_settings(api_key="", remove_key=True)
            try:
                tts.voice_for("satu dua tiga", cache_dir=Path(td2))
                problems.append("a voice without a key must say so")
            except tts.TtsError as exc:
                if "key" not in str(exc).lower():
                    problems.append(f"the no-key message does not say it: {exc}")
        finally:
            gemini_api._file = real_file
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "hook found (also with numbers written differently, no false match), a skip always says why, the AI voice cached and asked once, the held frame as long as the voice, the thumbnail-look text, shifted captions"


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
        # Upload marks per platform: old rows are read from their old fields (nothing is written), marking changes only uploads, never the status
        U = schedule.uploads_of
        old_rows = {
            "posted_yt": {"id": "a", "status": "Posted", "platform": "YouTube", "date": "2026-11-09", "time": "18:30", "videoId": "v", "youtubeUrl": "https://youtube.com/shorts/v"},
            "plan_only": {"id": "b", "status": "Draft", "platform": "YouTube + TikTok"},
            "tt_link": {"id": "c", "status": "Posted", "platform": "YouTube + TikTok", "tiktokUrl": "https://tiktok.com/@a/video/1", "date": "2026-11-01", "time": "10:00"},
            "sched": {"id": "d", "status": "Scheduled", "platform": "YouTube", "date": "2026-12-01", "time": "09:00", "videoId": "v2"},
            "tt_only": {"id": "e", "status": "Posted", "platform": "TikTok", "date": "2026-11-02", "time": "11:00"},
        }
        got = {k: {p: u["state"] for p, u in U(r).items()} for k, r in old_rows.items()}
        want = {"posted_yt": ("done", "none", "none"), "plan_only": ("none", "none", "none"), "tt_link": ("none", "done", "none"),
                "sched": ("scheduled", "none", "none"), "tt_only": ("none", "done", "none")}
        if any(tuple(got[k].values()) != w for k, w in want.items()):
            problems.append(f"uploads_of on old rows: {got}")
        if U(old_rows["posted_yt"])["youtube"]["url"] != "https://youtube.com/shorts/v" or "uploads" in old_rows["posted_yt"]:
            problems.append("an old row is read without being changed")
        schedule.save_clips([dict(r) for r in old_rows.values()], path)
        res = schedule.mark_uploads(["a", "nope"], "instagram", "done", "2026-11-10", "08:00", "https://instagram.com/reel/x", path, lock)
        a = {r["id"]: r for r in schedule.load_clips(path)}["a"]
        if res["missing"] != ["nope"] or a["status"] != "Posted" or a["platform"] != "YouTube" or a["uploads"] != {"instagram": {"state": "done", "date": "2026-11-10", "time": "08:00", "url": "https://instagram.com/reel/x"}}:
            problems.append(f"marking Instagram changes only uploads: {res} {a}")
        view = U(a)
        if (view["youtube"]["state"], view["tiktok"]["state"], view["instagram"]["state"]) != ("done", "none", "done"):
            problems.append(f"marked platform wins, the others are still read from the old fields: {view}")
        schedule.mark_uploads(["a"], "youtube", "none", path=path, lock=lock)
        if U({r["id"]: r for r in schedule.load_clips(path)}["a"])["youtube"]["state"] != "none":
            problems.append("an explicit Belum diupload beats the old fields")
        for bad in (("x", "done", "", "", ""), ("tiktok", "maybe", "", "", ""), ("tiktok", "done", "10-11-2026", "", ""), ("tiktok", "done", "", "8am", ""), ("tiktok", "done", "", "", "javascript:alert(1)")):
            try:
                schedule.mark_uploads(["a"], *bad, path=path, lock=lock)
                problems.append(f"mark_uploads accepted {bad}")
            except ValueError:
                pass
        if "uploadsView" not in schedule.with_missing_flags([{"id": "z"}])[0]:
            problems.append("rows for the dashboard carry uploadsView")
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
