"""Selftest checks: profiles, YouTube, uploads, bulk actions and hashtags."""

from __future__ import annotations


import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

from .selftest_base import ROOT, PASS, FAIL


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
        if after.get("platform") != "YouTube":            # a render row starts "YouTube + TikTok": a plan, not a fact
            problems.append(f"an upload with no TikTok link should leave platform 'YouTube', got {after.get('platform')!r}")
        rid_tt = row(title="Also On TikTok", tiktokUrl="https://www.tiktok.com/@x/video/1")
        jid_tt = youtube.start_upload(rid_tt)
        for _ in range(100):
            if youtube.upload_state(jid_tt)["state"] in ("done", "failed", "cancelled"):
                break
            time.sleep(0.05)
        if (schedule.get_row(rid_tt) or {}).get("platform") != "YouTube + TikTok":
            problems.append("an upload of a row that has a TikTok link should leave platform 'YouTube + TikTok'")
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

        # --- the thumbnail: made next to the video (<= 2 MB), sent after the upload, its failure only a warning
        from . import thumbnail as thumb
        ct = thumb.clean_thumb
        if ct("  Gurita  punya *3 jantung* #fakta 🐙 \"seru\" di ") != "Gurita punya *3 jantung* seru" or ct("Satu") != "" or ct(None) != ""                 or ct("Kenapa colokan bisa panas padahal tidak dipakai sama sekali ya") != "Kenapa colokan bisa panas padahal tidak dipakai sama"                 or ct("Bahaya *besar* ini") != "Bahaya *besar*" or ct("Rusak *total") != "Rusak total" or ct("Apa itu") != "":
            problems.append(f"clean_thumb: spaces, hashtags/emoji/quotes out, trailing stop word out, 8 words, one word ignored: {ct('  Gurita  punya *3 jantung* #fakta seru di ')!r}")
        order = [thumb.text_info("Orang", "Judul satu dua tiga", "Dia bilang gini di depan", ai="Dari AI *nih*"),
                 thumb.text_info("", "Judul satu dua tiga", "Dia bilang gini di depan", ai="Dari AI *nih*"),
                 thumb.text_info("", "Judul satu dua tiga", "Dia bilang gini di depan semua orang yang hadir malam itu", ai="x"),
                 thumb.text_info("", "Judul panjang sekali dari klip ini ya terus lagi", None),
                 thumb.text_info("", "Judul pendek", None)]
        if order != [("Orang", False), ("Dari AI *nih*", False), ("Dia bilang gini di depan semua orang", True), ("Judul panjang sekali dari klip", True), ("Judul pendek", False)]:
            problems.append(f"text order: person > AI thumb > hook cut > title cut, with the 'cut' flag only for the last two: {order}")
        from . import roundtrip as _rt
        _w = _rt.parse_reply([], json.dumps({"source": "x", "clips": [
            {"start": "0:10", "end": "0:30", "title": "Satu", "hook": "halo", "thumb": "Gurita punya *3 jantung*? 🐙", "scores": {"hook": 8, "complete": 8, "payoff": 8}},
            {"start": "0:40", "end": "1:00", "title": "Dua", "hook": "halo", "scores": {"hook": 8, "complete": 8, "payoff": 8}},
            {"start": "1:10", "end": "1:30", "title": "Tiga", "hook": "halo", "thumb": 7, "scores": {"hook": 8, "complete": 8, "payoff": 8}}]}))
        if _w[0].get("thumb") != "Gurita punya *3 jantung*?" or "thumb" in _w[1] or "thumb" in _w[2] or '"thumb"' not in _rt._answer_format("x", ""):
            problems.append(f"a reply with a thumb keeps it cleaned, one without (or not text) has none, and the brief asks for it: {[c.get('thumb') for c in _w]}")
        if thumb.lines_of("Gurita punya *3 jantung*?", 14) != [("GURITA PUNYA", False), ("3 JANTUNG?", True)]                 or thumb.text_of("", "Satu dua #tag tiga empat lima enam tujuh delapan sembilan sepuluh") != "Satu dua tiga empat lima enam" or thumb.text_of("", "Colokan panas? Ini yang terjadi di dalamnya") != "Colokan panas? Ini yang terjadi di dalamnya" or thumb.text_of("", "Warung makan enak yang ada di ujung jalan itu buka terus") != "Warung makan enak yang ada" or thumb.cut_hook("Aku tidak tahu harus bilang apa ke dia") != "Aku tidak tahu harus bilang apa" or thumb.text_of("Teks *sendiri*", "x") != "Teks *sendiri*":
            problems.append("the thumbnail text is not split into a white line and an accent line, or the title / thumbText fallback is wrong")
        if thumb.default_style("klipian-intip")["position"] != "lower" or thumb.default_style("podcast")["position"] != "auto"                 or thumb.default_style("podcast")["outline"] <= 0 or thumb.default_style("klipian-intip")["outline"] != 0:
            problems.append("the default thumbnail look: plain for the motion channel, sticker (outlined, middle) for the others")
        dirty = thumb.clean_style({"size": 99, "outline": -3, "color": "red", "accent": "#abcdef", "font": "comic", "position": "top", "lines": 9, "caps": "yes", "junk": 1})
        if dirty != {"size": 20.0, "outline": 0, "accent": "#ABCDEF", "position": "top", "lines": 4}:
            problems.append(f"thumbStyle cleaning did not fix ranges or drop bad values: {dirty}")
        profiles.update("up1", {"thumbStyle": {"size": 7, "align": "left", "bogus": 1}})
        if profiles.read_meta("up1")["thumbStyle"] != {"size": 7.0, "align": "left"} or thumb.style_of("up1")["align"] != "left" or thumb.style_of("up1")["font"] != "impact":
            problems.append("a saved thumbStyle is not read back on top of the profile's default look")
        profiles.update("up1", {"thumbStyle": None})
        if profiles.read_meta("up1")["thumbStyle"] != {}:
            problems.append("resetting thumbStyle did not clear it")
        st, pl = thumb.default_style("podcast"), thumb.default_style("klipian-intip")
        if not (st["outerWidth"] > 0 and st["shadow"] > 0 and st["rotate"] < 0 and st["width"] > 80 and st["color"] == "#FFD60A")                 or (pl["outerWidth"], pl["shadow"], pl["rotate"], pl["width"], pl["outline"]) != (0, 0, 0, 70, 0):
            problems.append(f"the clip default is the loud sticker (outer border, shadow, tilt, wide) and the motion default stays plain: {st} {pl}")
        if thumb.cut_hook("Dia bilang gini, di depan semua orang yang hadir malam itu") != "Dia bilang gini, di depan semua orang" or thumb.cut_hook("Halo") != ""                 or thumb.text_of("", "Judul panjang sekali dari klip ini ya", "Ini kalimat kuat dari klip") != "Ini kalimat kuat dari klip"                 or thumb.text_of("", "Judul panjang sekali dari klip ini ya", "Halo") != "Judul panjang sekali dari klip ini ya"                 or thumb.text_of("Teks saya", "x", "Ini kalimat kuat dari klip") != "Teks saya":
            problems.append("thumbnail text: thumbText first, then the clip's hook cut to 3-7 words, then the title cut to 6 words")
        got_s = {}
        ts = thumb.write(folder / "clip1.mp4", "Dia bilang gini di depan semua", thumb.default_style("podcast"), out=folder / "sticker-test.jpg", info=got_s)
        if not ts or not ts.is_file() or ts.stat().st_size == 0:
            problems.append("the tilted sticker look (outer border, shadow, rotation) made no JPG")
        bal = thumb.balanced("NAMA BU TITI PANJANG BANGET JAWABANNYA".split(), 3)
        fl, fsz = thumb.fit_block("Wow gila", True, 0.66, 270, 907, 576, 1.1, 3)
        fl7, fsz7 = thumb.fit_block("Dia bilang gini di depan semua orang", True, 0.66, 270, 907, 576, 1.1, 3)
        ac, _ = thumb.fit_block("Gurita punya *3 jantung*?", True, 0.66, 270, 907, 576, 1.1, 3)
        if bal != ["NAMA BU TITI", "PANJANG BANGET", "JAWABANNYA"] or len(fl) != 2 or fsz < 200 or len(fl7) != 3 or not 80 < fsz7 < 140 \
                or not any(a for _, a in ac) or not all(len(t) * 0.66 * fsz7 <= 907 for t, _ in fl7) or len(fl7) * fsz7 * 1.1 > 576:
            problems.append(f"fit_block: balanced lines, 2 big lines for 2 words, 3 lines for 7 words, inside the width and height, accent kept: {bal} {fl} {fsz} {fl7} {fsz7} {ac}")
        if thumb.default_style("podcast")["lines"] != 3 or not thumb.default_style("podcast")["autoSize"] or thumb.default_style("klipian-intip")["autoSize"]:
            problems.append("the clip default fills the box on up to 3 lines; the motion default does not auto-size")
        face = (0.38, 0.30, 0.62, 0.52)                                  # a face box in 0..1
        if thumb.score_face([]) != 0 or not thumb.score_face([face]) > thumb.score_face([(0.45, 0.4, 0.55, 0.5)]) > 0                 or not thumb.score_face([(0.0, 0.3, 0.24, 0.52)]) < thumb.score_face([(0.1, 0.3, 0.34, 0.52)]):
            problems.append("score_face: no face is 0, a larger face scores higher, a face cut by the edge scores lower")
        top, over = thumb.place_top(0.12, [face], (0.15, 0.85))
        if over != 0 or not (top + 0.12 <= 0.27 or top >= 0.55) or top < 0.10:
            problems.append(f"place_top put the text on the face or a caption zone: top {top}, overlap {over}")
        top2, over2 = thumb.place_top(0.12, [], (0.15, 0.85))
        if over2 != 0 or not 0.23 <= top2 <= 0.46:
            problems.append(f"place_top with no face should stay in the free band near the middle: {top2}, {over2}")
        crowded = thumb.place_top(0.12, [(0.1, 0.1, 0.9, 0.92)], (0.15, 0.85))[1]
        if not crowded > 0:
            problems.append("place_top should report an overlap when nothing is free")
        got = {}
        th = thumb.write(folder / "clip1.mp4", "Gurita punya *3 jantung*?", info=got)
        if got.get("how") not in ("clean", "fixed") or got.get("faces"):
            problems.append(f"a clip with no face should fall back to the cleanest or the 1 s frame: {got}")
        if not th or th.suffix != ".jpg" or not 0 < th.stat().st_size <= thumb.THUMB_MAX_BYTES:
            problems.append(f"thumbnail.write made no JPG within 2 MB: {th}")
        pv = thumb.preview({"position": "top", "size": 6}, "Satu dua tiga")
        if not pv or pv[:2] != bytes([0xFF, 0xD8]):
            problems.append("the settings preview is not a JPEG")
        inf: dict = {}
        inf2: dict = {}
        thumb.preview(None, "", inf)
        thumb.preview(None, "Teks  saya", inf2)
        if not inf.get("text") or inf2.get("text") != "Teks saya":
            problems.append(f"the preview says the video's own text when the box is empty and the typed text otherwise: {inf} {inf2}")
        bad = Path(tempfile.mkdtemp()) / "nope.mp4"
        bad.write_bytes(b"not a video")
        einfo: dict = {}
        if thumb.write(bad, "Teks") is not None or not einfo == {} or not (thumb.write(bad, "Teks", info=einfo) is None and einfo.get("error")) \
                or not (Path(paths.profile_dir()) / "thumbnail.log").is_file():
            problems.append(f"thumbnail.write on a file that is not a video returns None, hands the reason back (info['error']) and logs it: {einfo}")
        sent: list = []
        order: list = []                                         # "p" = a look at the processing state, "s" = thumbnails.set
        seq: list = ["processing", "processing", "succeeded"]
        real_bg, real_sleep = youtube._background, youtube._sleep
        youtube._background, youtube._sleep = (lambda fn: fn()), (lambda sec: None)         # the wait and the set run at once

        def fake_set(cls, token, vid, img):
            order.append("s")
            sent.append((vid, img.name))

        def fake_processing(cls, token, vid):
            order.append("p")
            return {"state": seq.pop(0) if len(seq) > 1 else seq[0], "thumb": "same"}
        FakeNet.set_thumbnail = classmethod(fake_set)
        FakeNet.processing = classmethod(fake_processing)
        rt = row(title="With Thumbnail")
        shutil.copy2(th, (folder / schedule.get_row(rt)["file"]).with_suffix(".jpg"))
        def run_upload(r):
            j = youtube.start_upload(r)
            for _ in range(100):
                s = youtube.upload_state(j)
                if s["state"] != "uploading":
                    return s
                time.sleep(0.05)
            return s
        st_t = run_upload(rt)
        first_set = order.index("s") if "s" in order else -1
        if st_t.get("state") != "done" or len(sent) != 1 or sent[0][0] != st_t.get("videoId") or st_t.get("warning") \
                or order != ["p", "p", "p", "s"] or schedule.get_row(rt).get("thumbNote") != "":
            problems.append(f"thumbnails.set must come only after processingStatus=succeeded (3 looks, then one set, no check after it, the same URL is no failure): {order} {sent} {st_t} {schedule.get_row(rt).get('thumbNote')!r}")
        # never succeeds: no thumbnails.set at all, and it is said on the row, not a failure of the upload
        order.clear(); sent.clear(); seq[:] = ["processing"]
        rt_p = row(title="Still Processing")
        shutil.copy2(th, (folder / schedule.get_row(rt_p)["file"]).with_suffix(".jpg"))
        st_p = run_upload(rt_p)
        if st_p.get("state") != "done" or sent or "still processing" not in (schedule.get_row(rt_p).get("thumbNote") or ""):
            problems.append(f"a video that never finishes processing gets no thumbnails.set and a note: {st_p} {sent} {schedule.get_row(rt_p).get('thumbNote')!r}")
        # refused (403): a warning on the row, the upload is fine
        order.clear(); sent.clear(); seq[:] = ["succeeded"]
        def deny(cls, token, vid, img):
            order.append("s")
            raise youtube.map_http_error(403, "forbidden", "no custom thumbnails")
        FakeNet.set_thumbnail = classmethod(deny)
        rt2 = row(title="Thumb Denied")
        shutil.copy2(th, (folder / schedule.get_row(rt2)["file"]).with_suffix(".jpg"))
        st_d = run_upload(rt2)
        if st_d.get("state") != "done" or schedule.get_row(rt2).get("status") != "Scheduled" or "verif" not in (schedule.get_row(rt2).get("thumbNote") or ""):
            problems.append(f"a refused thumbnail failed the upload or was not explained: {st_d} {schedule.get_row(rt2).get('thumbNote')!r}")
        # Re-send thumbnail: one look then one set; still processing -> no set
        FakeNet.set_thumbnail = classmethod(fake_set)
        order.clear(); sent.clear(); seq[:] = ["succeeded"]
        got = youtube.resend_thumbnail(rt)
        if got.get("warning") or order != ["p", "s"] or len(sent) != 1:
            problems.append(f"Re-send thumbnail: one look, one set: {order} {got}")
        order.clear(); sent.clear(); seq[:] = ["processing"]
        got = youtube.resend_thumbnail(rt)
        if sent or "still processing" not in got.get("warning", ""):
            problems.append(f"Re-send while YouTube is still processing sends nothing and says so: {sent} {got}")
        try:
            youtube.resend_thumbnail(rid + "x")
            problems.append("Re-send thumbnail for a row that is not uploaded should be refused")
        except youtube.YouTubeError:
            pass
        youtube._background, youtube._sleep = real_bg, real_sleep
        del FakeNet.set_thumbnail, FakeNet.processing
        if "thumbUrl" not in schedule.with_missing_flags([schedule.get_row(rt)])[0] or "thumbUrl" in schedule.with_missing_flags([schedule.get_row(rid)])[0]:
            problems.append("thumbUrl should be on a row with a JPG and only then")

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
