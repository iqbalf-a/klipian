"""Selftest checks: yt-dlp downloads, refresh, manual rows, captions, render requests and batches."""

from __future__ import annotations


import json
import shutil
import time
from pathlib import Path

from .selftest_base import FIXTURES, PASS, FAIL, SKIP, _load, _diff


def check_ytdl() -> tuple[str, str]:
    """Add from YouTube with a fake yt-dlp (nothing here reaches the network): the link, the file
    name, the credit (filled in, never overwritten, with its link in the description in every
    hashtag placement), no second download in the same profile or another, cancel and failure
    cleaning up, the error messages, yt-dlp missing, and the endpoints (the Guest included)."""
    import contextlib
    import http.client
    import importlib.util
    import io
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
        sections: list = []

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
        def download(cls, url, folder, hook, ffmpeg_dir, quality=1080, section=None):
            cls.calls["download"] += 1
            cls.sections.append(section)
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

            # --- parts only: a section is a file of its own, named with its range, never "the video already here"
            if ytdl.section_label((750.2, 850.9)) != "12m30s-14m11s" or ytdl.section_label((3725, 7300)) != "1h02m05s-2h01m40s":
                problems.append("the range in a part's file name is not 12m30s-14m11s (start down, end up) / 1h02m05s-2h01m40s")
            n = Fake.calls["download"]
            Fake.sections.clear()
            for bad in ((5, 5), (9, 2), ("x", 3), (-1, 4)):
                if code_of(ytdl.start, URL_A, 1080, None, bad) != "other":
                    problems.append(f"a bad section {bad} should be refused")
            if Fake.calls["download"] != n:
                problems.append("a refused section started a download")
            part_names = []
            for sec in ((750.2, 850.9), (1000, 1100)):
                with mock.patch("klipian.ffmpeg_tools._require", lambda b: b), \
                        mock.patch("klipian.ffmpeg_tools.run", lambda *a, **k: type("R", (), {"stdout": "0.04\n"})()):
                    sp = wait(ytdl.start(URL_A, 1080, None, sec)["id"])
                if sp.get("state") != "done":
                    problems.append(f"the part {sec} did not finish: {sp}")
                    continue
                part_names.append(sp["name"])
            if Fake.sections != [(750.2, 850.9), (1000.0, 1100.0)]:
                problems.append(f"download_ranges did not get the two sections: {Fake.sections}")
            if part_names != ["Raditya Dika - Apa Kabar Syahrini [12m30s-14m11s].mp4",
                              "Raditya Dika - Apa Kabar Syahrini [16m40s-18m20s].mp4"]:
                problems.append(f"the part files are not named by their range: {part_names}")
            if len(part_names) == 2 and not all((paths.SOURCES / p).is_file() for p in part_names):
                problems.append("a part file is missing")
            pc = credits.load().get(part_names[0]) or {} if part_names else {}
            if pc.get("section") != [750.24, 850.9] or pc.get("videoId") != A or pc.get("creator") != "Raditya Dika":
                problems.append(f"the part's credit should be the video's, plus the REAL section (start measured: 750.2 + 0.04): {pc}")
            if ytdl.find_in_profile(A) != name:
                problems.append("a part-only file was taken for the whole video")
            if not credits.line(pc).startswith("Sumber: YouTube Raditya Dika"):
                problems.append("the part's credit line is not the original video's")
            if part_names:
                credits.save(part_names[0], {"platform": "YouTube", "creator": "Raditya", "title": "T", "url": URL_A})
                if (credits.load().get(part_names[0]) or {}).get("section") != [750.24, 850.9]:
                    problems.append("saving the four credit fields forgot the section")
                # Download again: the file is deleted, then comes back as the same part under the same name
                credits.mark_deleted(part_names[0])
                (paths.SOURCES / part_names[0]).unlink()
                Fake.sections.clear()
                again2 = wait(ytdl.start(URL_A, 1080, part_names[0], tuple(pc["section"]))["id"])
                if again2.get("state") != "done" or again2.get("name") != part_names[0] or Fake.sections != [(750.24, 850.9)]:
                    problems.append(f"Download again did not fetch the same section under the same name: {again2} {Fake.sections}")
                if (credits.load().get(part_names[0]) or {}).get("section") != [750.24, 850.9]:
                    problems.append("Download again lost the section")

            from . import projects as _projects
            if _projects._migrate_project({"youtube": {"title": "A talk"}})[0].get("name") != "A talk":
                problems.append("a project with a YouTube link and no video is not named after the video")

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

        # --- Sources page: delete keeps the credit, Download again returns the same name
        with as_profile("yta"):
            from . import recycle
            name = "Raditya Dika - Apa Kabar Syahrini.mp4"
            real_bin = recycle.to_recycle_bin
            recycle.to_recycle_bin = lambda p: Path(p).unlink()       # no Recycle Bin from the selftest
            h = Handler.__new__(Handler)
            sent = []
            h._send_json = lambda obj, status=200: sent.append((status, obj))
            def delete(file):
                h._read_json = lambda: {"file": file}
                sent.clear()
                h._post_workspace_sources_delete()
                return sent[-1]
            def rows():
                sent.clear()
                h._get_workspace_sources()
                return {r["name"]: r for r in sent[-1][1]["source"]}
            try:
                for bad in ("../x.mp4", "a/b.mp4", "notes.txt", "missing.mp4"):
                    if delete(bad)[0] != 400:
                        problems.append(f"deleting {bad!r} should be refused with 400")
                if delete(name) != (200, {"ok": True}) or (paths.SOURCES / name).exists():
                    problems.append("Delete did not remove the file")
                gone = credits.deleted_load().get(name) or {}
                if gone.get("videoId") != A or gone.get("deleted") != time.strftime("%Y-%m-%d"):
                    problems.append(f"the credit was not kept in deleted.json before the file went: {gone}")
                r = rows().get(name) or {}
                if not (r.get("deleted") and r.get("can_redownload") and r.get("bytes") is None
                        and r.get("credit", {}).get("videoId") == A):
                    problems.append(f"the deleted source is not marked in the list: {r}")
                credits.save("hand.mp4", {"platform": "TikTok", "creator": "Mine"})      # drops the credit of gone files
                if name not in credits.deleted_load():
                    problems.append("saving another credit removed the deleted entry")
                if code_of(ytdl.start, f"https://youtu.be/{B}", 1080, name) != "other":
                    problems.append("Download again with another video's link should be refused")
                if code_of(ytdl.start, URL_A, 1080, "never-deleted.mp4") != "other":
                    problems.append("Download again of a name that was never deleted should be refused")
                s4 = wait(ytdl.start(URL_A, 1080, name)["id"])
                c = credits.load().get(name) or {}
                if (s4.get("name") != name or not (paths.SOURCES / name).is_file()
                        or c.get("videoId") != A or name in credits.deleted_load()
                        or rows().get(name, {}).get("deleted")):
                    problems.append(f"Download again did not bring {name} back with its credit: {s4} {c}")
                (paths.SOURCES / name).unlink()
                credits.mark_deleted(name)
                (paths.SOURCES / name).write_bytes(b"back")
                if rows().get(name, {}).get("deleted"):
                    problems.append("a deleted entry whose file is back is still shown as deleted")
                credits.unmark_deleted(name)
            finally:
                recycle.to_recycle_bin = real_bin

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
        elif not all(f.with_suffix(".jpg").is_file() for f in found):
            problems.append("a rendered Result (also an autopilot one: same render job) should leave its thumbnail .jpg next to the mp4")
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

        # --- the thumbnail never fails a render, is tried twice, and a failure is kept on the Clips row (thumbError)
        from . import thumbnail as _tn
        real_write, real_wait, tries = _tn.write, jobs.THUMB_RETRY_WAIT, []

        def flaky(fails):
            def write(video, text=None, style=None, at=None, out=None, info=None):
                tries.append(video.name)
                if len(tries) <= fails:
                    if info is not None:
                        info["error"] = "RuntimeError: ffmpeg failed (fake)"
                    return None
                return real_write(video, text, style, at, out, info)
            return write
        jobs.THUMB_RETRY_WAIT = 0
        try:
            _tn.write = flaky(1)
            started = jobs.start_project_render(pid, ["res5"])
            state = wait(started["id"])
            r5 = next((r for r in schedule.load_clips() if r.get("resultId") == "res5"), {})
            f5 = next(iter(paths.OUT_ROOT.glob(f"*/{r5.get('file')}")), None) if r5.get("file") else None
            if state != "done" or len(tries) != 2 or not f5 or not f5.with_suffix(".jpg").is_file() or r5.get("thumbError"):
                problems.append(f"a thumbnail that fails once is tried again: the jpg is there and no note: {state} {tries} {r5.get('thumbError')!r}")
            tries.clear()
            _tn.write = flaky(2)
            started = jobs.start_project_render(pid, ["res5"])
            state = wait(started["id"])
            r5 = next((r for r in schedule.load_clips() if r.get("resultId") == "res5"), {})
            if f5:
                f5.with_suffix(".jpg").unlink(missing_ok=True)       # the fake failed twice, so none was written by this render
            if state != "done" or len(tries) != 2 or "ffmpeg failed" not in (r5.get("thumbError") or ""):
                problems.append(f"a thumbnail that fails twice keeps the render and says why on the row: {state} {tries} {r5.get('thumbError')!r}")
            tries.clear()
            _tn.write = real_write
            started = jobs.start_project_render(pid, ["res5"])        # a later good render clears the note
            wait(started["id"])
            r5 = next((r for r in schedule.load_clips() if r.get("resultId") == "res5"), {})
            if r5.get("thumbError"):
                problems.append(f"a good render clears thumbError: {r5.get('thumbError')!r}")
        finally:
            _tn.write, jobs.THUMB_RETRY_WAIT = real_write, real_wait

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
