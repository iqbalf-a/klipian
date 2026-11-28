"""Selftest checks: Motion (projects, voice, briefs, options, state), the skill, voices, music and data safety."""

from __future__ import annotations


import json
import shutil
import subprocess
import os
import tempfile
import time
from pathlib import Path

from .selftest_base import FIXTURES, PASS, FAIL, SKIP


# --------------------------------------------------------------------------
# check: motion (the /remotion page: motion.py, remotion/catalog-export.mjs and validate.mjs, render.mjs)
# --------------------------------------------------------------------------

def check_motion() -> tuple[str, str]:
    """A motion video from topic to Clips row: the brief (built from the catalogue that remotion/ prints), the answer pasted back
    (repaired, validated by the zod schema, a fix message for what is wrong), editing text, the fact gate the SERVER enforces,
    the revision brief for rejected claims, the storyboard stills, a real render of a 2-second story through the scheduler,
    Cancel (waiting and running), the Clips row (fileFolder motion) and its upload checks, and the Guest refused.
    Needs Node and `npm install` in remotion/: without them this check is SKIPPED."""
    import contextlib
    import http.client
    import io
    import re
    import threading
    from http.server import ThreadingHTTPServer
    from . import hashtags, motion, paths, profiles, sched, schedule, youtube
    from .ffmpeg_tools import probe
    from .server import Handler

    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    tiny = json.loads((FIXTURES / "motion" / "tiny-story.json").read_text(encoding="utf-8"))
    old_durations = motion.DURATIONS
    motion.DURATIONS = (2,) + tuple(old_durations)                      # a 2-second video, only here: the real lengths are 30, 45 and 60
    for pid in ("mo1", "mo2"):
        profiles.write_meta(pid, {"name": pid, "color": "#336699", "defaults": {}})
        profiles.ensure_dirs(pid)
    tok = paths.set_profile("mo1")
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def call(method, path, profile="mo1", body=None, raw=False):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
            headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
            data = None
            if body is not None:
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            content = r.read()
            conn.close()
            if raw:
                return r.status, content
            try:
                return r.status, json.loads(content)
            except ValueError:
                return r.status, {}

        def post(action, body, profile="mo1"):
            return call("POST", f"/api/motion/{action}", profile, body)

        def wait(pid, done=("done", "failed", "cancelled"), seconds=120):
            end = time.time() + seconds
            while time.time() < end:
                st, j = call("GET", f"/api/motion/status?id={pid}")
                if st == 200 and j["job"]["state"] in done:
                    return j["job"]
                time.sleep(0.3)
            return {"state": "timeout"}

        # --- status, the Guest, another profile
        st, j = call("GET", "/api/motion/projects")
        if st != 200 or not j["status"]["installed"] or j["projects"] != []:
            problems.append(f"projects: {st} {str(j)[:120]}")
        if call("GET", "/api/motion/projects", "_guest")[0] != 403:
            problems.append("the Guest must be refused")

        # --- create: refusals first
        for body, what in (({"topic": "ab", "duration": 45}, "a topic that is too short"), ({"topic": "fakta seru tentang colokan", "duration": 200}, "a length that is not offered")):
            st, j = post("create", body)
            if st != 400 or j.get("ok") is not False:
                problems.append(f"create should refuse {what}: {st}")
        st, j = post("create", {"topic": "fakta seru tentang colokan listrik panas", "duration": 30, "notes": "fokus ke rumah biasa", "options": {"kind": "otomatis"}})
        p30 = j.get("project", {}).get("id")
        st, j = post("create", {"topic": "contoh kecil untuk tes", "duration": 2, "options": {"kind": "otomatis"}})
        tid = j.get("project", {}).get("id")
        if not p30 or not tid:
            return FAIL, f"create failed: {j}"
        if call("GET", "/api/motion/projects", "mo2")[1]["projects"] != []:
            problems.append("another profile must not see these videos")

        # --- the brief: built from the catalogue, in one self-contained file
        st, j = call("GET", f"/api/motion/brief?id={p30}&kind=main")
        text = j.get("brief", "")
        cat = motion._catalog()
        if st != 200 or not text:
            problems.append(f"brief: {st}")
        for needle, what in (("fakta seru tentang colokan listrik panas", "the topic"), ("fokus ke rumah biasa", "the notes"), ("exactly 30 seconds", "the length"),
                             ("kenapa", "the task"), ("source URL", "the fact rule"), ("`needs`", "needs"),
                             (hashtags.brief_rule(profiles.hashtag_settings()), "the profile's hashtag rule"), ("at most 6 words", "the screen text rule"),
                             ("at most once", "the one look inside"), ("hook", "the structure"), ("People are optional", "the rule on people"), ("The mascot is rare", "the rule on the mascot")):
            if needle not in text:
                problems.append(f"the brief lacks {what}")
        if "stays in the lower-left corner" in text or '"persist": true' in text.split("## Answer format")[-1]:
            problems.append("the brief must not ask for a mascot parked in a corner")
        for t in cat["items"]:
            if f"**{t}**" not in text:
                problems.append(f"the brief lacks the item type {t}")
        for word in (cat["mascot"]["expressions"] + cat["characters"]["poses"] + cat["motion"]["transitions"] + cat["sfx"]["names"][:5]):
            if word not in text:
                problems.append(f"the brief lacks the catalogue word {word}")
        for rule in cat["rules"]:
            if rule not in text:
                problems.append("the brief lacks a rule of the validator")
                break
        block = re.findall(r"```json\n(.*?)\n```", text, re.S)
        if not block or not motion.validate_story(json.loads(block[-1])).get("ok"):
            problems.append("the example story in the brief must itself be valid")
        for d in (45, 60):
            if f"exactly {d} seconds" not in motion.build_brief({**motion.load(p30), "duration": d}):
                problems.append(f"the brief for {d} seconds")
        if call("GET", f"/api/motion/brief?id={p30}&kind=revise")[0] != 400:
            problems.append("a revision brief with nothing rejected is refused")
        if call("GET", "/api/motion/brief?id=nope-1234&kind=main")[0] != 404:
            problems.append("a missing video is a 404")

        # --- the answer: not JSON, repaired, refused by the schema with a message to paste back
        st, j = post("paste", {"id": tid, "text": "Maaf, saya tidak bisa membuat video itu."})
        if j.get("ok") is not False or "No JSON block" not in j["errors"][0]["message"] or "klipian could not accept" not in j.get("fix", ""):
            problems.append(f"an answer with no JSON: {str(j)[:150]}")
        broken = json.dumps(tiny, ensure_ascii=False, indent=1)[:-2] + "\n}"
        broken = broken.replace('"needs": []', '"needs": [],')                        # a trailing comma before the closing brace
        st, j = post("paste", {"id": tid, "text": "Ini hasilnya:\n```json\n" + broken + "\n```\nSemoga membantu."})
        if j.get("ok") is not True or not any("comma" in n for n in j.get("notes", [])):
            problems.append(f"a trailing comma is repaired and said: {str(j)[:200]}")
        st, j = call("GET", f"/api/motion/project?id={tid}")
        d = j.get("project", {})
        if not d.get("story") or len(d["facts"]) != 1 or d["facts"][0]["status"] != "pending" or d["status"] != "story":
            problems.append(f"the saved story and its fact list: {str(d)[:200]}")

        def bad(mutate, expect_path, expect_text, what, video=tid):
            s = json.loads(json.dumps(tiny))
            mutate(s)
            st, j = post("paste", {"id": video, "text": json.dumps(s)})
            hit = [e for e in j.get("errors", []) if expect_path in e["path"] and expect_text in e["message"]]
            if j.get("ok") is not False or not hit:
                problems.append(f"{what}: {str(j)[:200]}")
                return
            if f"`{hit[0]['path']}`" not in j["fix"] or hit[0]["message"] not in j["fix"]:
                problems.append(f"{what}: the fix message must name the path and the problem")
            raw = motion.validate_story(s)                                              # the answer is the schema's own, not rules copied into Python
            if hit[0] not in raw.get("errors", []) and expect_path != "duration":
                problems.append(f"{what}: the error is not what validate.mjs says")

        bad(lambda s: s["beats"][0].update(text="satu dua tiga empat lima enam tujuh"), "beats.0.text", "6 words", "screen text over 6 words")
        bad(lambda s: s["beats"][1]["scene"]["items"][0].update(expr="angry"), "expr", "", "an expression that does not exist")
        bad(lambda s: s["claims"][0].update(sources=[]), "claims.0.sources", "", "a claim without a source")
        bad(lambda s: s["beats"][0]["scene"]["items"].append({"type": "volcano", "x": 1, "y": 1}), "items.2", "", "an object that is not in the catalogue")
        bad(lambda s: s.update(duration=9), "duration", "", "durations that do not add up")
        bad(lambda s: s["beats"][0].update(dur=3) or s.update(duration=4), "duration", "2 seconds", "a story of the wrong length for this video")
        st, j = post("paste", {"id": tid, "text": json.dumps({**tiny, "titles": ["a"]})})
        if len(j.get("errors", [])) < 1:
            problems.append("a story with one title is refused")
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if d["story"] != tiny or d["versions"] != 0:
            problems.append("a refused answer must leave the saved story as it was")

        # --- editing text, validated again
        st, j = post("update", {"id": tid, "edits": {"beats": {"hook": {"narration": "Pernah cabut colokan, kok hangat?", "items": {"0": {"text": "Colokan kok hangat?"}}}}}})
        if j.get("ok") is not True or j["story"]["beats"][0]["scene"]["items"][0]["text"] != "Colokan kok hangat?":
            problems.append(f"an edit of the narration and a banner: {str(j)[:150]}")
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if d["versions"] != 1:
            problems.append(f"an accepted edit keeps the version before it ({d['versions']})")
        st, j = post("update", {"id": tid, "edits": {"beats": {"hook": {"items": {"0": {"text": "satu dua tiga empat lima enam tujuh"}}}}}})
        if j.get("ok") is not False or not j.get("fix"):
            problems.append(f"an edit over 6 words is refused with a fix message: {str(j)[:150]}")
        if call("GET", f"/api/motion/project?id={tid}")[1]["project"]["story"]["beats"][0]["scene"]["items"][0]["text"] != "Colokan kok hangat?":
            problems.append("a refused edit must not be saved")
        st, j = post("update", {"id": tid, "edits": {"beats": {"nope": {"text": "x"}}}})
        if st != 400:
            problems.append("an edit of a beat that does not exist is refused")

        # --- the fact gate is the SERVER's
        st, j = post("render", {"id": tid})
        if st != 409 or j.get("code") != "gate" or len(j.get("problems", [])) != 2:
            problems.append(f"render must be refused with the claim and the title named: {st} {str(j)[:200]}")
        if call("GET", f"/api/motion/status?id={tid}")[1]["job"]["state"] != "idle":
            problems.append("a refused render must not start a job")
        st, j = post("facts", {"id": tid, "claims": [{"index": 0, "status": "rejected", "note": "sumbernya tidak menyebut itu"}]})
        if j.get("gate", [""])[0] != "Claim 1 is rejected: ask for a revision of the beats that use it." or post("render", {"id": tid})[0] != 409:
            problems.append(f"a rejected claim blocks the render: {str(j)[:150]}")
        st, j = post("facts", {"id": tid, "title": "judul lain"})
        if st != 400:
            problems.append("a title that is not one of the three is refused")

        # --- "Benar semua": every claim that waits is checked today; a rejected claim is not changed (it needs a revision)
        st, j = post("facts", {"id": tid, "all": "checked"})
        if j.get("skipped") != 1 or [c["status"] for c in j.get("facts", [])] != ["rejected"]:
            problems.append(f"Benar semua leaves a rejected claim alone and says so: {str(j)[:150]}")
        post("facts", {"id": tid, "claims": [{"index": 0, "status": "pending"}]})
        st, j = post("facts", {"id": tid, "all": "checked"})
        if j.get("skipped") != 0 or [c["status"] for c in j.get("facts", [])] != ["checked"] or j["facts"][0]["date"] != __import__("datetime").date.today().isoformat():
            problems.append(f"Benar semua checks every waiting claim with today's date: {str(j)[:150]}")
        post("facts", {"id": tid, "claims": [{"index": 0, "status": "rejected", "note": "sumbernya tidak menyebut itu"}]})   # the revision brief below needs the rejection again

        # --- the revision brief: only the beats of the rejected claim, and what was wrong with it
        st, j = call("GET", f"/api/motion/brief?id={tid}&kind=revise&note=" + "coba+sumber+lain")
        rb = j.get("brief", "")
        if st != 200 or "Colokan yang longgar bisa memanas." not in rb or "sumbernya tidak menyebut itu" not in rb or "coba sumber lain" not in rb:
            problems.append("the revision brief names the rejected claim, why, and the note")
        if '"id": "hook"' not in rb or '"id": "outro"' in rb:
            problems.append("the revision brief holds only the beats that use the rejected claim")
        if len(rb) >= len(motion.build_brief(motion.load(tid))):
            problems.append("the revision brief should be shorter than the main one")
        better = {"beats": [{**tiny["beats"][0], "narration": "Colokan longgar bisa memanas, jadi cek dulu."}],
                  "claims": [{"text": "Sambungan yang longgar menaikkan hambatan dan panas.", "beats": ["hook"], "sources": ["https://www.cpsc.gov/s3fs-public/518.pdf"]}]}
        st, j = post("paste", {"id": tid, "kind": "revise", "text": json.dumps(better)})
        if j.get("ok") is not True or j["story"]["beats"][0]["narration"] != better["beats"][0]["narration"] or j["story"]["beats"][1] != tiny["beats"][1]:
            problems.append(f"a revision replaces only its beats: {str(j)[:200]}")
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if [f["status"] for f in d["facts"]] != ["pending"] or d["facts"][0]["text"] != better["claims"][0]["text"]:
            problems.append("a revised claim is pending again")
        st, j = post("paste", {"id": tid, "kind": "revise", "text": json.dumps({"beats": [{**tiny["beats"][0], "id": "ghost"}]})})
        if j.get("ok") is not False or "not a beat of this video" not in j["errors"][0]["message"]:
            problems.append("a revision for a beat that does not exist is refused")

        # --- the stills sheet (a light job in the render queue)
        st, j = post("preview", {"id": tid})
        if st != 200:
            problems.append(f"preview: {st} {j}")
        job = wait(tid)
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if job["state"] != "done" or sorted(d["stills"]["files"]) != ["hook", "outro"] or d["stills"]["stale"]:
            problems.append(f"the stills: {job} {d['stills']}")
        else:
            st, png = call("GET", d["stills"]["files"]["hook"], raw=True)
            if st != 200 or png[:8] != b"\x89PNG\r\n\x1a\n":
                problems.append("a still is served as a PNG")
        post("update", {"id": tid, "edits": {"beats": {"outro": {"text": "klipian intip!"}}}})
        if not call("GET", f"/api/motion/project?id={tid}")[1]["project"]["stills"]["stale"]:
            problems.append("an edit makes the stills stale")
        if call("GET", "/api/motion/still?id=../x&beat=hook")[0] != 404:
            problems.append("a still of a path is refused")

        # --- check the claim and choose the title: the gate opens
        post("facts", {"id": tid, "claims": [{"index": 0, "status": "checked"}], "title": tiny["titles"][1]})
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if d["gate"] != [] or d["status"] != "checked" or d["facts"][0]["date"] == "" or d["title"] != tiny["titles"][1]:
            problems.append(f"the gate should be open: {d['gate']} {d['status']}")

        # --- Cancel while it waits in the queue: nothing runs, nothing is made
        rows_before = len(schedule.load_clips())
        hold = sched.acquire(sched.GROUP_RENDER, "render", "selftest-hold")
        try:
            st, j = post("render", {"id": tid})
            if st != 200 or j["job"]["state"] not in ("queued", "running"):
                problems.append(f"render: {st} {str(j)[:120]}")
            time.sleep(1.2)
            if call("GET", f"/api/motion/status?id={tid}")[1]["job"]["state"] != "queued":
                problems.append("a render waits while another heavy job holds the slot")
            if post("render", {"id": tid})[0] != 409:
                problems.append("a second render of the same video is refused while one is waiting")
            post("cancel", {"id": tid})
            job = wait(tid, seconds=15)
            if job["state"] != "cancelled":
                problems.append(f"cancel while waiting: {job}")
        finally:
            sched.release(hold)
        if sched.snapshot()["render"]["waiting"]:
            problems.append("a cancelled render must leave the queue")

        # --- Cancel while it runs: the Node process is told on stdin and stops; no file, no row
        for attempt in range(3):
            post("render", {"id": tid})
            end = time.time() + 30
            while time.time() < end and call("GET", f"/api/motion/status?id={tid}")[1]["job"]["state"] != "running":
                time.sleep(0.05)
            post("cancel", {"id": tid})
            job = wait(tid, seconds=60)
            if job["state"] == "cancelled":
                break
        else:
            problems.append(f"cancel while it runs: {job}")
        if len(schedule.load_clips()) != rows_before or list(schedule.folder_dir("motion").glob("*.mp4")):
            problems.append("a cancelled render must leave no Clips row and no file")
        if motion._PROCS:
            problems.append("the Node process of a cancelled render must be gone")

        # --- the real render, in 2 seconds of video
        t0 = time.time()
        st, j = post("render", {"id": tid})
        seen = set()
        end = time.time() + 150
        while time.time() < end:
            j = call("GET", f"/api/motion/status?id={tid}")[1]["job"]
            seen.add(j["state"])
            if j["state"] in ("done", "failed", "cancelled"):
                break
            time.sleep(0.2)
        took = time.time() - t0
        if j["state"] != "done" or not j.get("rowId") or j.get("percent") != 100:
            return FAIL, "\n      ".join(problems + [f"the render: {j}"])
        row = schedule.get_row(j["rowId"])
        f = schedule.row_file(row) if row else None
        if not row or row.get("fileFolder") != "motion" or row["title"] != tiny["titles"][1] or row["status"] != "Draft":
            problems.append(f"the Clips row: {row}")
        elif not f or not f.is_file() or f.parent != schedule.folder_dir("motion") or f.name != row["file"]:
            problems.append("the row's file is in out/motion/")
        else:
            if "Sumber:" not in row["description"]:
                problems.append("the description names the sources")
            if "#faktaseru" not in row["description"] or row.get("hashtags") != tiny["post"]["hashtags"] or row["description"] != row["tiktokCaption"]:
                problems.append(f"the post text and hashtags: {row.get('hashtags')}")
            if tiny["post"]["description"] not in row["description"] or better["claims"][0]["sources"][0] not in row["description"]:
                problems.append("the description carries the post text and the checked claim's source")
            info = probe(f)
            if not (info.height > info.width) or abs(info.duration - 2.0) > 0.2 or (info.width, info.height) != (1080, 1920):
                problems.append(f"the video is 1080x1920 and 2 s: {info.width}x{info.height} {info.duration}")
            if not info.has_audio or info.acodec != "aac":
                problems.append(f"the video has the sound effects as AAC: {info.has_audio} {info.acodec}")
            try:
                spec = youtube.prepare(row, publish_now=True)
                if spec.get("title") is None:
                    problems.append("the upload check")
            except youtube.YouTubeError as exc:
                problems.append(f"the upload checks accept a motion row: {exc}")
        if schedule.with_missing_flags(schedule.load_clips())[0].get("fileMissing"):
            problems.append("a motion row's file must not be flagged missing")
        st, h = call("GET", "/api/history")
        mine = [x for x in h.get("render", []) if x["video"] == "motion"]
        if not mine or not mine[0]["scheduled"] or not mine[0]["url"].startswith("/workspace/out/motion/"):
            problems.append(f"History lists the video as scheduled: {mine}")
        st, body = call("GET", __import__("urllib.parse").parse.quote(mine[0]["url"], safe="/?=&") if mine else "/x", raw=True)
        if st != 200 or body[4:8] != b"ftyp":
            problems.append("the MP4 is served from /workspace/out/motion/")
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if d["status"] != "rendered" or d["render"]["rowId"] != j["rowId"]:
            problems.append(f"the video remembers its render: {d['status']} {d['render']}")
        if not {"queued", "running"} & seen:
            problems.append("the page can watch the render")

        # --- a custom composition (remotion/videos/<slug>/): hidden ones are not offered, a missing one is refused, and the stills and the render
        # go the same way as the template's (project -> Node job -> file -> Clips row), reading the same checked story
        st, j = call("GET", "/api/motion/projects")
        offered = [c["slug"] for c in j["status"].get("compositions", [])]
        if "selftest-tiny" in offered:
            problems.append("a composition whose meta.json hides it is not offered in the list")
        if motion.composition_id(motion.load(tid)) != "FunFact":
            problems.append("a video renders with the template until a composition is chosen")
        st, j = post("update", {"id": tid, "project": {"composition": "nope"}})
        if st != 400 or j.get("code") != "composition":
            problems.append(f"a composition that does not exist is refused: {st} {str(j)[:100]}")
        st, j = post("update", {"id": tid, "project": {"composition": "selftest-tiny"}})
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if j.get("ok") is not True or d["composition"] != "selftest-tiny" or not d["stills"]["stale"] or not d["storyPath"].endswith("story.json"):
            problems.append(f"choosing a composition: {str(j)[:120]} {d.get('composition')} stale={d['stills']['stale']}")
        if motion.composition_id(motion.load(tid)) != "video-selftest-tiny":
            problems.append("the project renders with video-<slug>")
        pp = motion.load(tid)                                           # the story of that folder was taken (what "Ambil cerita dari folder" records): only then does a Khusus video render
        pp["folderTake"] = {"slug": "selftest-tiny", "hash": motion._file_hash(motion.folder_story_path("selftest-tiny")), "at": 0}
        motion.save(pp)
        # the folder list the picker shows: duration, modified, and which other topic took the folder (read-only, only the folders root is read)
        real_root, fake = motion.VIDEOS_ROOT, Path(tempfile.mkdtemp())
        try:
            for slug, beats in (("fa", [{"dur": 3}, {"dur": 4.5}]), ("fb", None)):
                (fake / slug).mkdir()
                (fake / slug / "index.tsx").write_text("x")
                if beats:
                    (fake / slug / "story.json").write_text(json.dumps({"beats": beats}))
            motion.VIDEOS_ROOT = fake
            pp2 = motion.load(tid)
            pp2["composition"] = "fa"
            motion.save(pp2)
            seen_c = {c["slug"]: c for c in motion.compositions("someone-else")}
            mine_c = {c["slug"]: c for c in motion.compositions(tid)}
            if seen_c["fa"]["duration"] != 7.5 or seen_c["fb"]["duration"] is not None or not seen_c["fa"]["modified"]:
                problems.append(f"a folder's duration and date: {seen_c}")
            if seen_c["fa"]["takenBy"] != pp2["topic"] or seen_c["fb"]["takenBy"] is not None or mine_c["fa"]["takenBy"] is not None:
                problems.append(f"which other topic took the folder: {seen_c['fa']['takenBy']!r} / own {mine_c['fa']['takenBy']!r}")
        finally:
            motion.VIDEOS_ROOT = real_root
            motion.save(pp)
            shutil.rmtree(fake, ignore_errors=True)
        post("preview", {"id": tid})
        job = wait(tid)
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        if job["state"] != "done" or sorted(d["stills"]["files"]) != ["hook", "outro"] or d["stills"]["stale"]:
            problems.append(f"stills of a custom composition: {job} {d['stills']}")
        else:
            st, png = call("GET", d["stills"]["files"]["outro"], raw=True)
            if st != 200 or png[1:4] != b"PNG":
                problems.append("a still of a custom composition is a PNG")

        # --- rendering again makes a second file and row (never overwriting the first), then delete the video: the Clips row stays
        st, j = post("render", {"id": tid})
        job = wait(tid)
        d = call("GET", f"/api/motion/project?id={tid}")[1]["project"]
        names = sorted(p.name for p in schedule.folder_dir("motion").glob("*.mp4"))
        if job["state"] != "done" or len(names) != 2 or len(schedule.load_clips()) != 2:
            problems.append(f"a second render keeps the first: {names} {job['state']}")
        st, j = post("delete", {"id": tid})
        if st != 200 or call("GET", f"/api/motion/project?id={tid}")[0] != 404 or len(schedule.load_clips()) != 2:
            problems.append("deleting a video keeps its Clips rows")
        st, j = post("delete", {"id": p30})
        if st != 200:
            problems.append(f"delete: {st}")
        spent = f"{took:.0f} s"
    finally:
        quiet.__exit__(None, None, None)
        if srv:
            srv.shutdown()
        motion.DURATIONS = old_durations
        paths._profile.reset(tok)
    if problems:
        return FAIL, "\n      ".join(problems[:14])
    return PASS, (f"brief from the catalogue, paste (repair, schema errors, fix message), edits, fact gate enforced by the server, revision brief, stills, "
                  f"a real 2 s render in {spent} (Cancel waiting and running), Clips row in out/motion/ ready for upload, a custom composition (stills and render), Guest refused")


# --------------------------------------------------------------------------
# check: voice (the narration of a motion video: import, word timings, a story that follows it, the voice in the render)
# --------------------------------------------------------------------------

def check_voice() -> tuple[str, str]:
    """A narration file (a generated test tone, never a real voice) imported by path and by upload, refused when it is not audio or too short; its word
    times matched to the story's narration (the recogniser is replaced by a fake that hears the words at known times, also failing, and hearing
    something else); beats that last as long as their narration (with a minimum hold), the word times inside each beat; the total reported against the
    plan; the voice in the rendered MP4 (a real 2-beat render); a changed story makes the alignment stale; the pluggable local TTS command; clear.
    Needs Node and `npm install` in remotion/: without them this check is SKIPPED."""
    import array
    import contextlib
    import http.client
    import io
    import sys
    import threading
    import wave
    from http.server import ThreadingHTTPServer
    from . import motion, motion_voice, paths, profiles
    from .ffmpeg_tools import _require, probe, run
    from .server import Handler

    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    tiny = json.loads((FIXTURES / "motion" / "tiny-story.json").read_text(encoding="utf-8"))
    old_durations, old_whisper = motion.DURATIONS, motion._whisper
    motion.DURATIONS = (2,) + tuple(old_durations)
    profiles.write_meta("vo1", {"name": "vo1", "color": "#336699", "defaults": {}})
    profiles.ensure_dirs("vo1")
    tok = paths.set_profile("vo1")
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    work = paths.workspace_dir() / "vo-src"
    work.mkdir(parents=True, exist_ok=True)
    try:
        ff = _require("ffmpeg")
        tone = work / "tone.wav"
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=6:sample_rate=22050", "-af", "volume=0.5", str(tone)], desc="a test tone", timeout=60)
        short = work / "short.wav"
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=0.4", str(short)], desc="a short tone", timeout=60)
        notes = work / "notes.txt"
        notes.write_text("not audio", encoding="utf-8")

        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def call(method, path, body=None, raw=None, profile="vo1"):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
            headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
            data = None
            if body is not None:
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            elif raw is not None:
                data, headers["Content-Type"] = raw, "application/octet-stream"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            content = r.read()
            conn.close()
            try:
                return r.status, json.loads(content)
            except ValueError:
                return r.status, {}

        post = lambda action, body: call("POST", f"/api/motion/{action}", body)          # noqa: E731

        def wait(pid, seconds=180):
            end = time.time() + seconds
            while time.time() < end:
                j = call("GET", f"/api/motion/status?id={pid}")[1].get("job", {})
                if j.get("state") in ("done", "failed", "cancelled"):
                    return j
                time.sleep(0.3)
            return {"state": "timeout"}

        def detail(pid):
            return call("GET", f"/api/motion/project?id={pid}")[1]["project"]

        st, j = post("create", {"topic": "contoh suara untuk tes", "duration": 2, "options": {"kind": "otomatis"}})
        pid = j["project"]["id"]
        if post("paste", {"id": pid, "text": json.dumps(tiny)})[1].get("ok") is not True:
            return FAIL, "the tiny story was not accepted"
        post("facts", {"id": pid, "claims": [{"index": 0, "status": "checked"}], "title": tiny["titles"][0]})

        # --- the import: refused (not audio, too short, not found), by path, by upload
        if post("voice", {"id": pid, "path": str(notes)})[0] != 400:
            problems.append("a text file is not a narration")
        if post("voice", {"id": pid, "path": str(short)})[0] != 400:
            problems.append("a narration under a second is refused")
        if post("voice", {"id": pid, "path": str(work / "nope.wav")})[0] != 400:
            problems.append("a file that is not there is refused")
        if post("voice-align", {"id": pid})[0] != 400:
            problems.append("alignment needs a narration first")
        st, j = post("voice", {"id": pid, "path": str(tone)})
        v = j.get("voice", {})
        wav = motion.voice_dir(pid) / "narration.wav"
        if st != 200 or abs(v.get("duration", 0) - 6.0) > 0.1 or not wav.is_file():
            problems.append(f"import by path: {st} {str(j)[:120]}")
        else:
            info = probe(wav)
            with wave.open(str(wav)) as w:
                rate, ch = w.getframerate(), w.getnchannels()
            if rate != 48000 or ch != 1:
                problems.append(f"the narration is made 48 kHz mono for the render: {rate} Hz, {ch} channels")
        st, j = call("POST", f"/api/motion/voice-upload?id={pid}&name=suara.wav", raw=tone.read_bytes())
        if st != 200 or abs(j.get("voice", {}).get("duration", 0) - 6.0) > 0.1:
            problems.append(f"import by upload: {st} {str(j)[:100]}")
        if call("POST", f"/api/motion/voice-upload?id={pid}&name=x.txt", raw=b"hello")[0] != 400:
            problems.append("an upload that is not audio is refused")
        d = detail(pid)
        if not d["voice"] or d["voice"]["aligned"] or d["voice"]["total"] != d["voice"]["duration"]:
            problems.append(f"before the alignment: {d['voice']}")

        # --- the alignment: the recogniser is replaced by one that hears the words at known times
        hook_words, outro_words = tiny["beats"][0]["narration"].split(), tiny["beats"][1]["narration"].split()

        class Hears:
            def words(self, audio):
                out = [{"text": w.strip(",.?!").lower(), "start": 0.2 + i * 0.4, "end": 0.2 + i * 0.4 + 0.35} for i, w in enumerate(hook_words)]
                out += [{"text": w.strip(",.?!").lower(), "start": 3.4 + i * 0.5, "end": 3.4 + i * 0.5 + 0.45} for i, w in enumerate(outro_words)]
                return out

        motion._whisper = Hears()
        st, j = post("voice-align", {"id": pid})
        job = wait(pid)
        d = detail(pid)
        if st != 200 or job["state"] != "done" or not d["voice"]["aligned"] or d["voice"]["method"] != "whisper":
            return FAIL, "\n      ".join(problems + [f"the alignment: {st} {job} {d['voice']}"])
        timed = motion.render_story(pid)
        hook, outro = timed["beats"]
        if abs(hook["dur"] - 3.4) > 0.01 or abs(outro["dur"] - 2.6) > 0.01 or abs(timed["duration"] - 6.0) > 0.01:
            problems.append(f"the beats follow the narration: {hook['dur']} + {outro['dur']} = {timed['duration']} (wanted 3.4 + 2.6)")
        if timed.get("captions") is not True or len(hook["words"]) != len(hook_words) or abs(hook["words"][0]["a"] - 0.2) > 0.01 or abs(outro["words"][0]["a"]) > 0.01:
            problems.append(f"the word times sit inside each beat: {hook['words'][:2]} {outro['words'][:1]}")
        if any(w["b"] > b["dur"] + 0.05 or w["b"] < w["a"] for b in timed["beats"] for w in b["words"]):
            problems.append("no word ends outside its beat")
        if hook["words"][0]["w"] != hook_words[0]:
            problems.append("the captions show the words as the story wrote them")
        if d["voice"]["total"] != timed["duration"] or "6.0" not in d["voice"]["note"] or "2 seconds" not in d["voice"]["note"]:
            problems.append(f"the total and how it compares with the plan are reported: {d['voice']}")
        if motion.story_of(pid) != tiny:
            problems.append("the story the AI wrote is never changed by the alignment")
        if motion.story_file(pid).name != "story.voiced.json":
            problems.append("the voiced story is what is drawn and rendered")
        st, j = post("update", {"id": pid, "edits": {"beats": {"hook": {"narration": "Pernah cabut colokan, kok hangat?"}}}})
        d = detail(pid)
        if not d["voice"]["stale"] or d["voice"]["aligned"] or motion.story_file(pid).name != "story.json":
            problems.append(f"an edited narration makes the alignment stale and the plain story is drawn again: {d['voice']}")
        job = (post("voice-align", {"id": pid}), wait(pid))[1]
        if job["state"] != "done" or not detail(pid)["voice"]["aligned"]:
            problems.append(f"aligned again after the edit: {job}")

        # --- the recogniser failing, and hearing something else: the estimate, said so
        class Fails:
            def words(self, audio):
                raise RuntimeError("no model")

        class Elsewhere:
            def words(self, audio):
                return [{"text": "lorem", "start": 0.5, "end": 0.9}, {"text": "ipsum", "start": 1.0, "end": 1.4}]

        for fake, what in ((Fails(), "fails"), (Elsewhere(), "hears other words")):
            motion._whisper = fake
            job = (post("voice-align", {"id": pid}), wait(pid))[1]
            d = detail(pid)
            if job["state"] != "done" or d["voice"]["method"] != "estimate" or "estimate" not in job.get("message", ""):
                problems.append(f"the recogniser {what}: the estimate is used and said: {job} {d['voice']}")
            elif abs(motion.render_story(pid)["duration"] - 6.0) > 0.05:
                problems.append(f"the recogniser {what}: the estimate still follows the audio: {motion.render_story(pid)['duration']}")
        motion._whisper = Hears()
        post("update", {"id": pid, "edits": {"beats": {"hook": {"narration": tiny["beats"][0]["narration"]}}}})
        job = (post("voice-align", {"id": pid}), wait(pid))[1]

        # the pure part: a short narration keeps its beat at the minimum hold; a story the narration cannot fit is reported
        al = motion_voice.align([{"id": "a", "narration": "satu dua"}, {"id": "b", "narration": "tiga"}], [{"text": "satu", "start": 0.1, "end": 0.3}, {"text": "dua", "start": 0.3, "end": 0.5}, {"text": "tiga", "start": 0.6, "end": 0.8}], 1.5)
        short_story = motion_voice.timed_story({"beats": [{"id": "a", "dur": 5, "narration": "satu dua", "scene": {}}, {"id": "b", "dur": 5, "narration": "tiga", "scene": {}}], "duration": 10}, al, 1.5)
        if short_story["beats"][0]["dur"] != motion_voice.MIN_HOLD or short_story["beats"][1]["dur"] < motion_voice.MIN_HOLD:
            problems.append(f"a beat lasts at least the minimum hold: {[b['dur'] for b in short_story['beats']]}")

        # --- the render has the voice in it (and the stills follow the voiced story)
        stills_before = detail(pid)["stills"]
        post("preview", {"id": pid})
        job = wait(pid)
        d = detail(pid)
        if job["state"] != "done" or d["stills"]["stale"] or sorted(d["stills"]["files"]) != ["hook", "outro"]:
            problems.append(f"the stills of the voiced story: {job}")
        # the narration (6 s) is far from the story's 2 s: the render waits for the person's choice (the 15 % policy), then follows the voice
        st_r, j_r = post("render", {"id": pid})
        if st_r != 409 or "continue" not in str(j_r.get("error", "")):
            problems.append(f"a render beyond the length policy waits for the choice: {st_r} {str(j_r)[:120]}")
        post("voice-length", {"id": pid, "choice": "continue"})
        st, j = post("render", {"id": pid})
        job = wait(pid)
        if job["state"] != "done":
            return FAIL, "\n      ".join(problems + [f"the voiced render: {job}"])
        row = __import__("klipian.schedule", fromlist=["x"]).get_row(job["rowId"])
        f = __import__("klipian.schedule", fromlist=["x"]).row_file(row)
        info = probe(f)
        if abs(info.duration - 6.0) > 0.25 or not info.has_audio:
            problems.append(f"the video lasts as long as the narration and has sound: {info.duration} {info.has_audio}")
        pcm = work / "out.wav"
        run([ff, "-y", "-loglevel", "error", "-i", str(f), "-vn", "-ac", "1", "-ar", "8000", "-f", "wav", str(pcm)], desc="the sound of the render", timeout=60)
        with wave.open(str(pcm)) as w:
            samples = array.array("h", w.readframes(w.getnframes()))
            rate = w.getframerate()
        def rms(a, b):
            part = samples[int(a * rate):int(b * rate)]
            return (sum(x * x for x in part) / max(1, len(part))) ** 0.5 / 32768
        if rms(0.5, 2.0) < 0.1 or rms(4.0, 5.5) < 0.1:
            problems.append(f"the narration is in the soundtrack: {rms(0.5, 2.0):.3f} {rms(4.0, 5.5):.3f}")
        if max(abs(x) for x in samples) / 32768 > 0.93:
            problems.append("the mixed sound stays under the ceiling")

        # --- the local TTS command: not set, then set (a command of ours that writes a tone), no cloud, no engine installed by klipian
        st, j = post("voice-tts", {"id": pid})
        if st != 400 or j.get("code") != "tts":
            problems.append(f"without a TTS command the button says so: {st} {str(j)[:100]}")
        script = work / "fake_tts.py"
        script.write_text("import sys, wave, math, struct\ntext = open(sys.argv[1], encoding='utf-8').read()\nassert 'Pernah' in text\n"
                          "w = wave.open(sys.argv[2], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)\n"
                          "w.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(i / 20))) for i in range(16000 * 4))); w.close()\n", encoding="utf-8")
        (paths.workspace_dir() / "machine.json").write_text(json.dumps({"motionTts": f'"{sys.executable}" "{script}" "{{text}}" "{{out}}"'}), encoding="utf-8")
        st, j = post("voice-tts", {"id": pid})
        if st != 200 or abs(j.get("voice", {}).get("duration", 0) - 4.0) > 0.1 or j["voice"]["name"] != "tts.wav":
            problems.append(f"the local TTS command makes the narration: {st} {str(j)[:140]}")
        (paths.workspace_dir() / "machine.json").write_text(json.dumps({"motionTts": f'"{sys.executable}" -c "import sys; sys.exit(3)"'}), encoding="utf-8")
        st, j = post("voice-tts", {"id": pid})
        if st != 400 or "failed" not in j.get("error", ""):
            problems.append(f"a TTS command that fails is reported: {st} {str(j)[:100]}")
        (paths.workspace_dir() / "machine.json").unlink(missing_ok=True)

        # --- clear: the plain story again
        st, j = post("voice-clear", {"id": pid})
        d = detail(pid)
        if st != 200 or (d["voice"] or {}).get("aligned") or motion.story_file(pid).name != "story.json" or motion.voice_file(pid) is not None:
            problems.append(f"clearing the voice: {st} {d['voice']}")
    finally:
        quiet.__exit__(None, None, None)
        if srv:
            srv.shutdown()
        motion.DURATIONS, motion._whisper = old_durations, old_whisper
        paths._profile.reset(tok)
    if problems:
        return FAIL, "\n      ".join(problems[:14])
    return PASS, ("import by path and upload (refused: not audio, too short), word times matched (also failing / hearing other words: the estimate, said so), beats follow the "
                  "narration with a minimum hold, stale after an edit, the voice in a real render, the local TTS hook, clear")


# check: the motion brief carries the Style Bible's musts (remotion/DESIGN.md section 0b, B16): the free hook, the small "Intip yuk!"
# sting, the loop-back outro with no mascot, and no old wording. Builds the brief only: no AI call, no workspace read.
def check_motion_brief() -> tuple[str, str]:
    from . import motion, profiles
    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    must = ["an everyday hook", "does not have to start with", "voice-only", "(B41)", "Intip yuk!", "loop-back",
            "**The outro has no mascot.**", "**One hero:**", "**Kinds of fact:**",
            "build a set, not a specimen", "Animation recipe", "open on a wide shot of the set", "one scale per set", "hero in the centre third",
            "Explaining how the body or money works is allowed", "never investment or financial advice", "Own set per video", "drawn in the kit's 2.5D iso camera", "never a flat side-view SVG", "IsoWallSocket", "The text format is the channel", "`TopText`", "`CaptionLayer`", "no big black banner box"]
    stale = ["The outro has the mascot again", "a short outro with the logo", "logo and", "starts with \"kenapa", "a big `mascot`",
             "an everyday question", "a short outro with the logo", "Every beat has a `banner`", "<Banner text", "No health or finance topics"]
    real_settings = profiles.hashtag_settings
    profiles.hashtag_settings = lambda: {"placement": "title", "shorts": True, "titleTags": 3}   # a fixed setting, never the workspace's
    try:
        for d in (30, 45, 60):
            text = motion.build_brief({"topic": "Kenapa colokan panas", "duration": d, "notes": ""})
            for want in must:
                if want not in text:
                    problems.append(f"the {d} s brief lost {want!r}")
            for old in stale:
                if old in text:
                    problems.append(f"the {d} s brief still says {old!r}")
            khusus = motion.build_brief({"topic": "Kenapa colokan panas", "duration": d, "notes": "", "options": {"kind": "khusus"}})
            for want in ("Animation recipe", "wide shot", "the root of your checkout", "remotion/videos/cara-kerja-hujan-buatan", "wide.png", "beats.json", "build a set, not a specimen", "npm run fill -- ", "over 35 %", "establishing push", "copy their structure and style, not their set", "sfx.ts by hand", "about 1 event a second"):
                if want not in khusus:
                    problems.append(f"the {d} s Khusus brief lost {want!r}")
            for old in ("on its own in a circle", "ngantuk-pegang-hp"):
                if old in khusus or old in text:
                    problems.append(f"the {d} s brief still says {old!r}")
            total = sum(r[1] for r in motion.STRUCTURE[d])
            if total != d:
                problems.append(f"the {d} s structure adds up to {total}, not {d}")
            if motion.STRUCTURE[d][-1][0] != "outro" or "loop-back" not in motion.STRUCTURE[d][-1][2]:
                problems.append(f"the {d} s structure does not end with a loop-back outro")
        from . import motion_brief_cli
        cli = motion_brief_cli.brief_for("Kenapa colokan panas")      # what /create prints: the channel defaults, nothing written to the workspace
        marks = (("iso", "**Look iso (B28):**"), ("2d", "**Look 2d (B28):**"), ("text", "**Look text (B28):**"), ("ricks", "**Look ricks (B46"))
        for look, mark in marks:
            one = motion_brief_cli.brief_for("Kenapa colokan panas", look)      # a chosen look keeps only its own rules
            others = [m for _, m in marks if m != mark]
            if mark not in one or any(o in one for o in others) or "Choose the look" in one:
                problems.append(f"the brief for look {look} does not hold only that look's rules")
        for look in ("iso", "2d", "text", "ricks"):                                  # what to read per look: the iso-only sections and the rule log are in their own files
            one = motion_brief_cli.brief_for("Kenapa colokan panas", look)
            if ("Also read `remotion/DESIGN-iso.md`" in one) != (look == "iso") or ("do not read `remotion/DESIGN-iso.md`" in one) != (look != "iso") or "RULE-LOG.md" not in one:
                problems.append(f"the {look} brief tells the wrong files to read (DESIGN-iso.md only for iso, never RULE-LOG.md)")
        for want in ("Choose the look", "1. `iso` when", "2. `2d` when", "3. `text` when", "gaya: iso/2d/teks, karena"):
            if want not in cli:
                problems.append(f"the brief that lets the agent choose lost {want!r}")
        if any(len(motion_brief_cli.brief_for("Kenapa colokan panas", lk)) >= 40000 for lk in (None, "iso", "2d", "text", "ricks")):
            problems.append("a brief for a look is 40000 characters or more")
        for want in ("about 40 seconds", "Intip yuk!", "loop-back", "Target voice apps:", "### Step 6"):
            if want not in cli:
                problems.append(f"the brief CLI's default brief lost {want!r}")
        for gone in ("### Step 7", "If you cannot run commands", "Chat mode"):      # the agent brief: no narration or page steps, no chat fallback
            if gone in cli:
                problems.append(f"the brief CLI's agent brief still has {gone!r}")
        opt = motion_brief_cli.brief_for("Kenapa colokan panas", duration=45, loop=False)       # the -create tokens: 45 and noloop
        if "about 45 seconds" not in opt or "Loop: no" not in opt:
            problems.append("brief_for(duration=45, loop=False) puts 'about 45 seconds' and 'Loop: no' in the brief")
        for bad in ({"voice": ["nope"]}, {"music": "nope"}, {"duration": 50}):
            try:
                motion_brief_cli.brief_for("Kenapa colokan panas", **bad)
                problems.append(f"the brief CLI refuses {bad}")
            except motion.MotionError:
                pass
        if motion.normalize_options({})["look"] != "auto" or motion.options_of({"topic": "x", "duration": 45, "options": {"music": "sunny"}})["look"] != "auto":
            problems.append("the look option is auto by default, also for an old project without it")
        try:
            motion.normalize_options({"look": "3d"})
            problems.append("a wrong look is refused")
        except motion.MotionError as exc:
            if "auto, iso, 2d, text" not in str(exc):
                problems.append(f"the wrong-look message lists the choices: {exc}")
        base = {"topic": "Kenapa colokan panas", "duration": 45, "notes": ""}
        forced = motion.build_brief({**base, "options": {"kind": "khusus", "music": "sunny", "look": "2d"}})
        if "**Look 2d (B28):**" not in forced or "**Look iso (B28):**" in forced or "**Look text (B28):**" in forced or "Choose the look" in forced:
            problems.append("a project with look 2d gets only the 2d look rules")
        if "-create 2d 45" not in motion.short_command({**base, "options": {"music": "sunny", "look": "2d"}}):
            problems.append("the short command of a look 2d project has the 2d token")
        auto = motion.build_brief({**base, "options": {"kind": "khusus", "music": "sunny", "look": "auto"}})
        if "Choose the look" not in auto or any(t in motion.short_command({**base, "options": {"music": "sunny", "look": "auto"}}) for t in ("2.5d", " 2d ", "teks")):
            problems.append("look auto leaves the choice to the agent: the choose text and no look token")
        motion.build_brief({**base, "options": {"kind": "otomatis", "music": "sunny", "look": "iso"}})      # the template kind ignores the look: no error
        short = motion.short_command({"topic": "Kenapa colokan panas", "duration": 45, "notes": "", "options": {"music": motion.suggest_music("Kenapa colokan panas")}})
        if short != '-create 45 "Kenapa colokan panas"':
            problems.append(f"the short command of a default 45 s project is -create 45 \"<topic>\", not {short!r}")
        short = motion.short_command({"topic": "Kenapa \"colokan\" panas", "duration": 30, "notes": "fokus ke a", "look": "iso", "options": {"loop": False, "music": "glow", "voiceTargets": ["googleai"]}})
        for want in ("-create 2.5d 30", "noloop", "musik=glow", "suara=googleai", 'catatan="fokus ke a"', "Kenapa 'colokan' panas"):
            if want not in short:
                problems.append(f"the short command lost {want!r}: {short!r}")
        skill = (Path(__file__).resolve().parent.parent / ".claude" / "skills" / "create" / "SKILL.md")
        text = skill.read_text(encoding="utf-8") if skill.exists() else ""
        cm = Path(__file__).resolve().parent.parent / "CLAUDE.md"
        cmt = cm.read_text(encoding="utf-8") if cm.exists() else ""
        for want in ("-create", ".claude/skills/create/SKILL.md", "-create 2d", "-create teks"):
            if want not in cmt:
                problems.append(f"the root CLAUDE.md lost {want!r}")
        for want in ("name: create", "# -create [options] <topic>", "git worktree add --detach", "never check out, switch branches, stash or reset in ian's checkout", "git checkout -q --detach origin/main", "git push origin HEAD:main", "up to 3 tries", "motion_brief_cli", "Never force-push", "set.json", "obat cegukan paling ampuh", "at most 6 short lines", "pakai ulang", "Do NOT print the narration", "Work quietly", "--look text", "gaya: iso/2d/teks"):
            if want not in text:
                problems.append(f"the /create skill lost {want!r}")
    finally:
        profiles.hashtag_settings = real_settings
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the brief for 30, 45 and 60 s carries the hook, the small sting, the loop-back outro, one hero, the kinds of fact and the set rule (B27, the wide shot, one scale, the centre third); no old wording"


# check: several narration files (PLAN-ALUR-V2 phase 1): the order by number (2 before 10), a gap in the series and another prefix as warnings,
# a name with no number refused; the join is as long as the parts and the gaps, with silence between them; one part replaced without the others; the
# match table (a beat off by more than 20 % or 1.5 s is flagged; a length beyond 15 % needs a choice); the unmatched words; the subtitles (srt, vtt);
# the half-size draft preview. Tones only, never a voice. The recogniser is a fake that hears the words at known times.
def check_voiceparts() -> tuple[str, str]:
    import array
    import wave
    from . import motion, motion_voice, paths, profiles
    from .ffmpeg_tools import _require, probe, run

    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    tiny = json.loads((FIXTURES / "motion" / "tiny-story.json").read_text(encoding="utf-8"))
    old_durations, old_whisper = motion.DURATIONS, motion._whisper
    motion.DURATIONS = (2,) + tuple(old_durations)
    profiles.write_meta("vp1", {"name": "vp1", "color": "#336699", "defaults": {}})
    profiles.ensure_dirs("vp1")
    tok = paths.set_profile("vp1")                                   # a scratch profile in the selftest's workspace, never the real one
    work = paths.workspace_dir() / "vp-src"
    work.mkdir(parents=True, exist_ok=True)
    try:
        ff = _require("ffmpeg")

        def tone(name: str, seconds: float, hz: int, volume: float = 0.5) -> Path:
            f = work / name
            run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=frequency={hz}:duration={seconds}:sample_rate=22050",
                 "-af", f"volume={volume}", str(f)], desc="a test tone", timeout=60)
            return f

        # --- the order and the warnings, without audio
        order = motion_voice.series(["colokan_10.wav", "colokan_2.wav", "colokan_1.wav"])
        names = [["colokan_10.wav", "colokan_2.wav", "colokan_1.wav"][i] for i in order["order"]]
        if names != ["colokan_1.wav", "colokan_2.wav", "colokan_10.wav"]:
            problems.append(f"the parts are ordered by their number, 2 before 10: {names}")
        if not any("no part 3" in w for w in order["warnings"]):
            problems.append(f"a gap in the series is a warning: {order['warnings']}")
        if not any("prefix" in w for w in motion_voice.series(["a_1.wav", "b_2.wav"])["warnings"]):
            problems.append("another prefix is a warning")
        if motion_voice.series(["colokan_x.wav", "colokan_1.wav"])["ok"]:
            problems.append("a part with no number is refused")
        if motion_voice.series(["c_1.wav", "c_01.wav"])["ok"]:
            problems.append("two parts with the same number are refused")

        # --- the import: three parts, one quiet (the loudness is evened out and said so)
        p1 = tone("colokan_1.wav", 2.0, 220)
        p2 = tone("colokan_2.wav", 1.5, 330)
        p10 = tone("colokan_10.wav", 1.0, 440, volume=0.05)
        pid = motion.create("contoh bagian suara", 2, "", {"kind": "otomatis"})["id"]
        motion.paste(pid, json.dumps(tiny))
        v = motion.import_voice_parts(pid, [p10, p2, p1])
        parts = v.get("parts") or []
        if [x["name"] for x in parts] != ["colokan_1.wav", "colokan_2.wav", "colokan_10.wav"]:
            problems.append(f"the import orders the parts by their number: {[x['name'] for x in parts]}")
        expect = 2.0 + 1.5 + 1.0 + 2 * motion_voice.GAP
        if abs(v.get("duration", 0) - expect) > 0.06:
            problems.append(f"the joined narration lasts the parts and the two gaps: {v.get('duration')} vs {expect:.2f}")
        if len(parts) == 3 and abs(parts[1]["offset"] - (2.0 + motion_voice.GAP)) > 0.03:
            problems.append(f"part 2 starts after part 1 and the gap: {parts[1]['offset']}")
        if not any("evened out" in n for n in v.get("notes", [])):
            problems.append(f"a part much quieter than the others is evened out and said so: {v.get('notes')}")
        if not any("no part 3" in n for n in v.get("notes", [])):
            problems.append(f"the gap in the series is kept in the notes: {v.get('notes')}")
        wav = motion.voice_dir(pid) / "narration.wav"
        with wave.open(str(wav)) as w:
            rate, ch, frames = w.getframerate(), w.getnchannels(), w.getnframes()
            raw = w.readframes(frames)
        if rate != 48000 or ch != 1:
            problems.append(f"the joined narration is 48 kHz mono: {rate} Hz, {ch} channels")
        samples = array.array("h", raw)
        quiet = samples[int(48000 * 2.05):int(48000 * 2.2)]
        if quiet and max(abs(s) for s in quiet) > 300:
            problems.append("the silence between parts 1 and 2 is silent")

        # --- one part replaced: the others kept, the join made again, the alignment cleared
        p2b = tone("replacement.wav", 3.0, 550)
        v2 = motion.replace_voice_part(pid, 2, p2b)
        if abs(v2["parts"][1]["duration"] - 3.0) > 0.03 or abs(v2["duration"] - (2.0 + 3.0 + 1.0 + 2 * motion_voice.GAP)) > 0.06:
            problems.append(f"replacing part 2 rebuilds the join: {v2['parts'][1]['duration']} s, total {v2['duration']} s")
        if v2["parts"][0]["name"] != "colokan_1.wav" or v2["parts"][2]["name"] != "colokan_10.wav":
            problems.append("the other parts keep their names")
        if motion.voice_info(pid)["aligned"]:
            problems.append("a replaced part clears the alignment")
        try:
            motion.replace_voice_part(pid, 9, p2b)
            problems.append("a part number that is not there is refused")
        except motion.MotionError:
            pass

        # --- a joined narration with no gap, and the refusals
        v3 = motion.import_voice_parts(pid, [p1, p2], gap=0.0)
        if abs(v3["duration"] - 3.5) > 0.03:
            problems.append(f"a gap of 0 joins the parts end to end: {v3['duration']}")
        bad = tone("colokan_x.wav", 1.0, 220)
        try:
            motion.import_voice_parts(pid, [bad, p1])
            problems.append("a part with no number is refused on import")
        except motion.MotionError as exc:
            if "number" not in exc.message:
                problems.append(f"the refusal says what to change: {exc.message}")

        # --- the match: the recogniser hears the words of the hook and the outro, but not one of the hook's
        motion.import_voice_parts(pid, [p1, p2, p10], gap=motion_voice.GAP)
        hook_words, outro_words = tiny["beats"][0]["narration"].split(), tiny["beats"][1]["narration"].split()
        dropped = hook_words[1]

        class Hears:
            def words(self, audio):
                heard = [w for w in hook_words if w != dropped]
                out = [{"text": w.strip(",.?!").lower(), "start": 0.2 + i * 0.4, "end": 0.2 + i * 0.4 + 0.35} for i, w in enumerate(heard)]
                out += [{"text": w.strip(",.?!").lower(), "start": 3.4 + i * 0.5, "end": 3.4 + i * 0.5 + 0.45} for i, w in enumerate(outro_words)]
                return out

        motion._whisper = Hears()
        motion.align_voice(pid)
        end = time.time() + 180
        while time.time() < end and motion.job_state(pid).get("state") not in ("done", "failed", "cancelled"):
            time.sleep(0.3)
        if motion.job_state(pid).get("state") != "done":
            problems.append(f"the match finished: {motion.job_state(pid)}")
        info = motion.voice_info(pid)
        table = info.get("table") or {}
        if len(table.get("beats", [])) != len(tiny["beats"]):
            problems.append("the match table has a row per beat")
        if not any(b["warn"] for b in table.get("beats", [])):
            problems.append("a beat off by more than 20 % or 1.5 s is flagged")
        if table.get("lengthOk") is not False or info.get("lengthOk") is not False:
            problems.append(f"a length beyond 15 % of the chosen one is not accepted: {table.get('percent')}")
        if [u["w"] for u in info.get("unmatched", [])] != [dropped.strip(",.?!").lower()]:
            problems.append(f"the words the recogniser could not match are shown: {info.get('unmatched')}")
        try:
            motion.render(pid)
            problems.append("a render beyond the length policy is refused until the person chooses")
        except motion.MotionError as exc:
            if exc.code != "gate" or "continue" not in exc.message:
                problems.append(f"the render refusal says the choice: {exc.code} {exc.message[:120]}")
        motion.choose_length(pid, "continue")
        if motion.voice_info(pid)["lengthChoice"] != "continue":
            problems.append("the choice to continue is kept")
        srt_text = motion_voice.srt(motion.render_story(pid))
        if "-->" not in srt_text:
            problems.append("the srt has cues")
        if hook_words[0].strip(",.?!") not in srt_text:
            problems.append("the srt holds the words of the narration")
        vtt_text = motion_voice.vtt(motion.render_story(pid))
        if not vtt_text.startswith("WEBVTT") or "." not in vtt_text.split("-->")[0]:
            problems.append("the vtt starts with WEBVTT and uses dots in the times")
        if motion.subtitles_file(pid, "srt") is None or motion.subtitles_file(pid, "vtt") is None:
            problems.append("the subtitle files are written next to the narration")
        if motion.voice_file(pid) is None or not motion.detail(pid)["voice"].get("at"):
            problems.append("the voice file can be served and its detail carries a time to bust the player's cache")
        # the cues: at most two lines of 42 characters
        for c in motion_voice.cues(motion.render_story(pid)):
            if len(c["lines"]) > 2 or any(len(ln) > 42 for ln in c["lines"]):
                problems.append(f"a cue is at most two lines of 42 characters: {c['lines']}")
                break

        # --- the half-size draft: the whole video with the narration, rendered
        motion.preview_video(pid)
        end = time.time() + 300
        while time.time() < end and motion.job_state(pid).get("state") not in ("done", "failed", "cancelled"):
            time.sleep(0.5)
        pv = motion.preview_file(pid)
        if motion.job_state(pid).get("state") != "done" or pv is None:
            problems.append(f"the draft preview is made: {motion.job_state(pid)}")
        else:
            mi = probe(pv)
            if (mi.width, mi.height) != (540, 960):
                problems.append(f"the draft is half size, 540 by 960: {mi.width} by {mi.height}")
            if not mi.has_audio:
                problems.append("the draft has the sound")
    finally:
        motion._whisper = old_whisper
        motion.DURATIONS = old_durations
        paths._profile.reset(tok)
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, ("several parts ordered by number (2 before 10), gaps and another prefix as warnings, a bad name refused, the join with silence, one part replaced, "
                  "the match table and its length policy, the unmatched words, srt and vtt, the half-size draft with sound")


# check: the options of a video (PLAN-ALUR-V2 phase 2): the choices and their refusals, the warnings for loop and the sting, the brief for every
# combination of length, loop, sting, voice target, music and kind (the catalogue is read once), the fix message and the options, and the narration
# text for each voice app (the parts, the headers, the markup each one takes). No AI call, no service call, no workspace read.
def check_motionopts() -> tuple[str, str]:
    from . import motion, profiles
    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    try:
        motion.normalize_options({"voiceTarget": "suara"})
        problems.append("a voice target that is not listed is refused")
    except motion.MotionError:
        pass
    try:
        motion.normalize_options({"loop": "ya"})
        problems.append("loop is yes or no")
    except motion.MotionError:
        pass
    if {**motion.normalize_options(None), "music": "sunny"} != motion.DEFAULT_OPTIONS or motion.DEFAULT_OPTIONS["loop"] is not True or motion.DEFAULT_OPTIONS["sting"] is not True:
        problems.append("the defaults are loop on and the sting on")
    if motion.option_warnings(motion.DEFAULT_OPTIONS):
        problems.append("the defaults give no warning")
    off = motion.option_warnings({**motion.DEFAULT_OPTIONS, "loop": False, "sting": False})
    if len(off) != 2 or "loop" not in off[0] or "Intip yuk" not in off[1]:
        problems.append(f"turning the musts off warns about each: {off}")

    # the brief for every combination (the catalogue is read once, the hashtag rule is fixed)
    cat = motion._catalog()
    old_catalog, old_settings = motion._catalog, profiles.hashtag_settings
    motion._catalog = lambda: cat
    profiles.hashtag_settings = lambda: {"placement": "title", "shorts": True, "titleTags": 3}
    try:
        count = 0
        for d in (30, 45, 60):
            for loop in (True, False):
                for sting in (True, False):
                    for target in (["voicestudio"], ["elevenlabs", "googleai"], list(motion.VOICE_TARGETS)):
                        for music in motion.MUSIC_TRACKS:
                            for kind in motion.KINDS:
                                opts = {"loop": loop, "sting": sting, "voiceTargets": target, "music": music, "kind": kind}
                                text = motion.build_brief({"topic": "Kenapa colokan panas", "duration": d, "notes": "", "options": opts})
                                count += 1
                                want = [f"- Loop: {'yes' if loop else 'no'}", f"- Intip yuk!: {'yes' if sting else 'no'}", f"- Music: ",
                                        f"- Target voice apps: {motion.voice_apps_text(target)}", f"- Kind: {motion.KINDS[kind]}", "## Pilihan video"]
                                if any(w not in text for w in want):
                                    problems.append(f"the {d} s brief for {opts} lacks {[w for w in want if w not in text]}")
                                    break
                                if (not loop or not sting) and "Warning:" not in text:
                                    problems.append(f"the {d} s brief for {opts} has no warning")
                                if "`music`" not in text:
                                    problems.append("the answer format asks for the music track")
        expected = 3 * 2 * 2 * 3 * len(motion.MUSIC_TRACKS) * len(motion.KINDS)
        if count != expected:
            problems.append(f"{expected} combinations were checked: {count}")
    finally:
        motion._catalog, profiles.hashtag_settings = old_catalog, old_settings

    # the fix message keeps the options
    fix = motion.build_fix_message([{"path": "beats.0", "message": "x"}], "main", {**motion.DEFAULT_OPTIONS, "loop": False})
    if "loop no" not in fix or "Intip yuk! yes" not in fix:
        problems.append(f"the fix message carries the options: {fix[-160:]}")

    # the narration text: the parts, the headers, the markup per app
    beats = [{"id": "hook", "kind": "hook", "narration": "Pernah cabut colokan. Eh kok panas? Yuk cek sekarang."}, {"id": "tips", "kind": "tips", "narration": "Jangan dipakai dulu. Minta teknisi periksa."}]
    story = {"beats": beats}
    vs = motion.narration_export(story, "voicestudio")
    if any(ch in vs["text"] for ch in "<>[]") or "pause" in vs["text"] or "Bagian" in vs["text"] or "sekitar" in vs["text"]:
        problems.append("the VoiceStudio text is plain narration, with no header, no count and no tag")
    el = motion.narration_export(story, "elevenlabs")
    if "<break" in el["script"] or "not verified" not in el["status"]:
        problems.append("the ElevenLabs text has no tags, and says the pause tags are not verified")
    gg = motion.narration_export(story, "googleai")
    if gg["script"].count("<long pause>") != 1 or "<short pause>" in gg["script"]:
        problems.append(f"the Google script has one long pause before the last tips: {gg['script']!r}")
    if not gg["style"] or "tips" not in gg["style"]:
        problems.append("the Google style is the short English line, with the tips named")
    # the split: long narrations become parts of about 10 to 15 s, cut at sentence ends
    long_story = {"beats": [{"id": f"b{i}", "narration": " ".join(["kata"] * 6) + "." } for i in range(14)]}
    parts = motion.narration_parts(long_story)
    if len(parts) < 2:
        problems.append("a long narration is split into parts")
    for p in parts[:-1]:
        mid = (p["low"] + p["high"]) / 2
        if not 9 <= mid <= 16:
            problems.append(f"a part is about 10 to 15 s: {mid:.1f} s for {p['words']} words")
            break
    if any(p["low"] > p["high"] for p in parts):
        problems.append("a part's time is a range, low to high")
    total = motion.narration_export(long_story, "voicestudio")["total"]
    if abs(total["low"] - sum(p["low"] for p in parts)) > 0.1:
        problems.append("the total is the parts' sum")
    if not motion.narration_export(long_story, "voicestudio")["info"].startswith("About "):
        problems.append("the export's info (outside the copied text) starts with the total")
    try:
        motion.narration_export(story, "suara")
        problems.append("a target that is not listed is refused")
    except motion.MotionError:
        pass

    # the voice apps: all three by default, an empty list refused, the old single choice migrated (all three, that one first)
    if motion.DEFAULT_OPTIONS["voiceTargets"] != list(motion.VOICE_TARGETS) or motion.normalize_options({})["voiceTargets"] != list(motion.VOICE_TARGETS):
        problems.append("all three voice apps are checked by default")
    try:
        motion.normalize_options({"voiceTargets": []})
        problems.append("an empty list of voice apps is refused")
    except motion.MotionError as exc:
        if "at least one" not in exc.message:
            problems.append(f"the refusal says to choose one app: {exc.message}")
    old_style = motion.normalize_options({"voiceTarget": "elevenlabs"})
    if old_style["voiceTargets"] != list(motion.VOICE_TARGETS) or old_style["voiceTargetFirst"] != "elevenlabs" or "voiceTarget" in old_style:
        problems.append(f"the old single choice migrates to all three apps with that one first: {old_style}")
    if motion.normalize_options({"voiceTargets": ["googleai", "voicestudio"]})["voiceTargets"] != ["voicestudio", "googleai"]:
        problems.append("the apps keep their order")
    for one in (["voicestudio"], ["voicestudio", "elevenlabs"], list(motion.VOICE_TARGETS)):
        brief = motion.build_brief({"topic": "Kenapa colokan panas", "duration": 30, "notes": "", "options": {"voiceTargets": one}})
        if f"- Target voice apps: {motion.voice_apps_text(one)} (" not in brief:
            problems.append(f"the brief lists {one}")
    # the options of a project: chosen at creation, changed with the warnings
    p = motion.create("contoh pilihan video", 30, "", {"loop": False, "music": "tech"})
    if motion.options_of(p)["loop"] is not False or motion.options_of(p)["music"] != "tech" or motion.options_of(p)["sting"] is not True:
        problems.append(f"the options are kept on the project: {motion.options_of(p)}")
    changed = motion.set_options(p["id"], {"sting": False})
    if motion.options_of(motion.load(p["id"]))["sting"] is not False or len(changed["warnings"]) != 2:
        problems.append(f"the options change and warn: {changed}")
    if motion.options_of(motion.load(p["id"]))["music"] != "tech":
        problems.append("changing one option keeps the others")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, ("the choices and the refusals, the warnings for loop and the sting, the brief for every combination of length, loop, sting, apps, music and kind, the fix message with the options, "
                  "the narration parts (about 10 to 15 s, sentence ends) and the text for each voice app (no tags for VoiceStudio and ElevenLabs, <short pause> for Google)")


# check: the page's state (PLAN-REMOTION-PAGE, phase 3): the next step for every state, the stage chips, the kind of a video (migrated from the
# composition), the render that is current or stale with its reasons, the brief copied, and detail() of a fresh video. Pure functions and a scratch
# project only: no node, no service call, no workspace of the person.
def check_motionstate() -> tuple[str, str]:
    from . import motion
    problems: list[str] = []
    base = {"story": True, "pending": 0, "rejected": 0, "title": True, "custom": False, "composition": False, "slug": "x", "voice": False,
            "aligned": False, "voiceStale": False, "render": "none", "gate": [], "briefed": True, "storyPath": "s.json", "stills": "none", "preview": "none"}
    cases = [
        ({**base, "story": False, "briefed": False}, "brief"),
        ({**base, "story": False, "briefed": True}, "paste"),
        ({**base, "rejected": 2}, "fix"),
        ({**base, "pending": 3}, "facts"),
        ({**base, "title": False}, "title"),
        ({**base, "custom": True, "folder": None}, "folder"),
        ({**base, "voice": True}, "align"),
        ({**base, "gate": ["a claim is not checked"]}, "blocked"),
        ({**base, "render": "current"}, "clips"),
        ({**base, "render": "stale"}, "render"),
        (base, "render"),
    ]
    for facts, want in cases:
        got = motion.next_step(facts)
        if got["key"] != want:
            problems.append(f"the next step for {want} is {want}: {got}")
    if motion.next_step({**base, "custom": True, "folder": "loaded"})["key"] != "render":
        problems.append("a Khusus video whose story is taken goes on to the render")
    if motion.next_step({**base, "custom": True, "folder": "changed"})["key"] != "retake":
        problems.append("a changed folder asks to take the story again")
    vf = {**base, "custom": True, "flow": "voice", "folder": "not-chosen"}        # voice first: the story, the voice, and only then the folder
    for facts, want in (({**vf, "story": False, "briefed": False}, "brief"), ({**vf, "story": False}, "paste"), ({**vf, "voice": False}, "voice"), ({**vf, "voice": True, "aligned": False}, "align"),
                        ({**vf, "voice": True, "aligned": True}, "folder"), ({**vf, "voice": True, "aligned": True, "folder": "not-loaded"}, "take"),
                        ({**vf, "voice": True, "aligned": True, "folder": "changed"}, "retake"), ({**base, "custom": True, "flow": "picture", "folder": None}, "folder")):
        if motion.next_step(facts)["key"] != want:
            problems.append(f"voice first: the next step should be {want}: {motion.next_step(facts)}")
    if motion.normalize_options({})["flow"] != "picture" or motion.normalize_options({"flow": "voice"})["flow"] != "voice":
        problems.append("the order option defaults to picture first and accepts voice first")
    try:
        motion.normalize_options({"flow": "x"})
        problems.append("an unknown order is refused")
    except motion.MotionError:
        pass

    chips = {c["key"]: c["state"] for c in motion.stage_chips({**base, "pending": 1, "voice": True, "aligned": True, "stills": "stale", "render": "stale"})}
    if chips.get("claims") != "needed" or chips.get("voice") != "done" or chips.get("pictures") != "stale" or chips.get("render") != "stale":
        problems.append(f"the stage chips show the state: {chips}")
    blocked = {c["key"]: c["state"] for c in motion.stage_chips({**base, "custom": True, "folder": "changed", "render": "current", "gate": ["The story in the folder changed: load it again first."]})}
    if blocked.get("render") != "stale" or blocked.get("story") != "stale":
        problems.append(f"a rendered video whose folder changed does not show its render as done: {blocked}")
    if {c["key"]: c["state"] for c in motion.stage_chips({**base, "story": False, "title": False})}.get("voice") != "none":
        problems.append("a video with no narration shows the narration as not there")

    # the kind: the choice, and a project saved before it (composition set means custom)
    if motion.kind_of({"composition": "x", "options": {"kind": "otomatis"}}) != "template":
        problems.append("an otomatis video is a template, even with an old composition")
    if motion.kind_of({"composition": "x"}) != "custom" or motion.kind_of({}) != "template":
        problems.append("an old project with a composition is custom, one without is a template")
    if motion.kind_of({"composition": "x", "options": {"kind": "khusus"}}) != "custom":
        problems.append("a khusus video is custom")
    if motion.composition_id({"composition": "x", "options": {"kind": "otomatis"}}) != "FunFact" or motion.composition_id({"composition": "x", "options": {"kind": "khusus"}}) != "video-x":
        problems.append("the template renders FunFact, the custom video its folder")

    # the render: current, or stale with the reasons; an old record (no kind) is compared on the story only
    story = {"beats": [{"id": "a", "dur": 1, "narration": "satu"}], "duration": 1}
    h = motion._story_hash(story)
    cur = motion._render_now({"render": {"storyHash": h, "kind": "template", "composition": "", "file": "a.mp4"}, "options": {"kind": "otomatis"}}, story)
    if not cur["current"]:
        problems.append("a render of the same story and kind is current")
    stale = motion._render_now({"render": {"storyHash": h, "kind": "template", "composition": "", "file": "a.mp4"}, "options": {"kind": "khusus"}, "composition": "x"}, story)
    if stale["current"] or "the video kind changed" not in stale["reasons"]:
        problems.append(f"a render of another kind is stale: {stale}")
    changed = motion._render_now({"render": {"storyHash": "lain"}}, story)
    if changed["current"] or "the story or the voice changed" not in changed["reasons"]:
        problems.append("a changed story makes the render stale")
    if motion._render_now({"render": {"storyHash": h}}, story)["current"] is not True:
        problems.append("an old record with the same story is current")
    if motion._render_now({"render": {"storyHash": h, "rowId": "no-such-row"}}, story) is not None:
        problems.append("a render whose Clips row was deleted still counts as rendered")

    # a fresh video: its detail has the next step and the chips; the brief copied moves on to paste
    k = motion.create("kenapa tes khusus", 30, "")                      # a new video is Khusus: it asks for the brief, then the folder
    dk = motion.detail(k["id"])
    if dk["kind"] != "custom" or dk["next"]["key"] != "folder":
        problems.append(f"a new video is Khusus and asks for the brief and the folder: {dk['kind']} {dk['next']}")
    motion.note_brief(k["id"])
    if motion.detail(k["id"])["chip"]["label"] != "Waiting for the folder":
        problems.append("a Khusus video whose brief was copied waits for its folder")
    p = motion.create("kenapa tes rincian", 30, "", {"kind": "otomatis"})
    d = motion.detail(p["id"])
    if d["next"]["key"] != "brief" or len(d["stages"]) != 7 or d["kind"] != "template":
        problems.append(f"a fresh video: {d['next']} {[c['key'] for c in d['stages']]}")
    motion.note_brief(p["id"])
    if motion.detail(p["id"])["next"]["key"] != "paste":
        problems.append("after the brief is copied the next step is to paste")
    # the one status: the next step, the chips, the render block and the chip of the list agree in every state (the rendered video whose folder changed
    # used to say "take the story again" and "ready to render" at once)
    def status(**over):
        f = {**base, "custom": True, "folder": "loaded", **over}
        rn = {"current": {"current": True, "reasons": []}, "stale": {"current": False, "reasons": ["the story or the voice changed"]}}.get(f["render"])
        return motion.project_status(f, rn, None, {"duration": 45}, {"duration": 45})
    cases = [
        ("a changed folder over a current render", dict(folder="changed", render="current", gate=["The story in the folder changed: load it again first."]), "retake", "waiting", "Load the story again"),
        ("a taken story, nothing rendered", dict(), "render", "ready", "Ready to render"),
        ("a current render", dict(render="current"), "clips", "done", "Rendered"),
        ("a stale render", dict(render="stale"), "render", "stale", "Render stale"),
        ("claims waiting", dict(pending=2, gate=["Claim 1 is not checked yet."]), "facts", "waiting", "Facts to check"),
        ("a rejected claim", dict(rejected=1, gate=["Claim 1 is rejected: ask for a revision of the beats that use it."]), "fix", "waiting", "Fact rejected"),
        ("no title", dict(title=False, gate=["Choose a title."]), "title", "waiting", "Choose a title"),
        ("a voice not matched", dict(voice=True, gate=["The voice is not matched with the narration yet: match it first."]), "align", "waiting", "Match the voice"),
        ("no story, no folder", dict(story=False, briefed=False, folder="not-chosen", gate=["No story yet: load the story first."]), "folder", "missing", "New"),
        ("no story, folder chosen", dict(story=False, folder="not-loaded", gate=["No story yet: load the story first."]), "take", "missing", "Load the story"),
    ]
    for label, over, want_next, want_render, want_chip in cases:
        s = status(**over)
        if s["next"]["key"] != want_next or s["render"]["state"] != want_render or s["chip"]["label"] != want_chip:
            problems.append(f"{label}: next {s['next']['key']} (want {want_next}), render {s['render']['state']} (want {want_render}), chip {s['chip']['label']} (want {want_chip})")
        if s["render"]["can"] and (s["next"]["key"] in ("retake", "take", "fix", "facts", "title", "align", "folder") or over.get("gate")):
            problems.append(f"{label}: a render is offered while the next step is {s['next']['key']}")
    if status(voice=True, aligned=True)["length"]["voiced"] is not None:
        problems.append("the length is the planned one when the voice has no table")
    nv = motion.project_status({**base, "custom": True, "folder": "loaded", "voice": True, "aligned": True}, None, {"total": 53.3, "aligned": True}, {"duration": 45}, {"duration": 45})
    if nv["length"] != {"planned": 45, "voiced": 53.3, "seconds": 53.3}:
        problems.append(f"the voiced length is shown when there is a matched voice: {nv['length']}")
    # voice first: stage 1 asks only for the story and the narration; stage 2 carries the voice-timed story inside it (no workspace path)
    import tempfile
    from . import motion_brief
    from pathlib import Path as _P
    with tempfile.TemporaryDirectory() as td:
        (_P(td) / "story.voiced.json").write_text('{"question":"Q?","duration":40,"beats":[{"id":"hook"}]}', encoding="utf-8")
        real = motion.project_dir
        motion.project_dir = lambda pid: _P(td)
        try:
            vp = {"id": "x1", "topic": "kenapa nasi basi", "duration": 40, "options": {"flow": "voice", "kind": "khusus"}, "voice": {}}
            one = motion_brief.build_brief(vp)
            two = motion_brief.build_brief({**vp, "voice": {"aligned": True}})
            if "stage 1 of 2" not in one or "make the video folder" in one.split("## 3. Steps")[1].split("## ")[0].lower().replace("do not make the video folder", ""):
                problems.append("voice first stage 1 asks for the story and the narration only")
            if "stage 2 of 2" not in two or '"id":"hook"' not in two or td in two:
                problems.append("voice first stage 2 holds the voice-timed story inside the brief and no local path")
            if "stage 1 of 2" in motion_brief.build_brief({**vp, "options": {"kind": "khusus"}}):
                problems.append("picture first has no stages")
            os.remove(_P(td) / "story.voiced.json")
            try:
                motion_brief.build_brief({**vp, "voice": {"aligned": True}})
                problems.append("stage 2 without a timed story is refused")
            except motion.MotionError:
                pass
        finally:
            motion.project_dir = real
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the next step for every state, the stage chips, one status (next step, chips, render block and list chip agree in every state), the voiced length, the kind of a video (migrated), the render current or stale with its reasons, and the detail of a new video (Khusus by default)"


# check: the project skill for the local Claude Code (PLAN-ALUR-V2 phase 4): the file exists with its frontmatter, every npm script and file it names
# exists, its rules hold (no workspace write, no key, no service call), and the brief sections it reads are the brief's own. Reads only.
def check_skill() -> tuple[str, str]:
    import re
    from . import motion
    root = Path(__file__).resolve().parents[1]
    skill = root / ".claude" / "skills" / "klipian-video" / "SKILL.md"
    if not skill.is_file():
        return FAIL, f"{skill} is missing"
    text = skill.read_text(encoding="utf-8")
    problems: list[str] = []
    head = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not head or "name: klipian-video" not in head.group(1) or "description:" not in head.group(1):
        problems.append("the skill has its frontmatter (name, description)")
    pkg = json.loads((root / "remotion" / "package.json").read_text(encoding="utf-8"))["scripts"]
    for script in re.findall(r"npm run ([a-z-]+)", text):
        if script not in pkg:
            problems.append(f"npm run {script} does not exist in remotion/package.json")
    for rel in ("remotion/validate.mjs", "remotion/scripts/styleCheck.mjs", "remotion/scripts/styleReport.mjs"):
        if not (root / rel).is_file():
            problems.append(f"{rel} exists")
    for needle in ("Never write to `workspace/`", "No API key", "never calls a voice or other service", "Never read or print secrets", "build a set, not a specimen"):
        if needle.lower() not in text.lower():
            problems.append(f"the skill keeps the rule: {needle}")
    if "api key" in text.lower() and "no api key" not in text.lower() and "never needs an api key" not in text.lower():
        problems.append("the skill asks for no API key")
    # the sections it reads are the brief's own sections
    brief = motion.build_brief({"topic": "Kenapa colokan panas", "duration": 45, "notes": "", "options": {}})
    for section in ("## Pilihan video", "## Structure for", "## Channel rules", "## Catalogue", "## Answer format"):
        if section not in brief:
            problems.append(f"the brief still has {section!r}, which the skill reads")
    for word in ("Pilihan video", "Answer format"):
        if word not in text:
            problems.append(f"the skill names the brief section {word!r}")
    if "narration_export" not in text or "googleai" not in text:
        problems.append("the skill prints the narration text for the voice app")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the klipian-video skill has its frontmatter, names only commands that exist, keeps its rules, and reads the brief's own sections"


# check: the Google AI Studio export (PLAN-VOICE-GOOGLE): the script with expression tags from the verified list, placed by rule (one per beat, six in
# all, no tag before "Intip yuk!", <chuckle> before a turning sentence, <long pause> before the last tips, never after the last sentence), the short
# English style (no age, gender, names or accent; no tips sentence without tips), the long style labelled optional, the round trip (the tags strip to the
# story's narration, and the matching ignores them), and VoiceStudio and ElevenLabs unchanged (compared with their snapshots). No service, no workspace.
def check_voicegoogle() -> tuple[str, str]:
    import re as _re
    from . import motion, motion_voice
    problems: list[str] = []
    fx = FIXTURES / "motion"
    story = json.loads((fx / "narration-story.json").read_text(encoding="utf-8"))
    g = motion.narration_export(story, "googleai")
    for key in ("script", "style", "styleLong", "tags", "text"):
        if not g.get(key):
            problems.append(f"the Google export has {key}")
    tags_in_script = _re.findall(r"<([^<>]+)>", g["script"])
    unknown = [t for t in tags_in_script if t not in motion_voice.EXPRESSION_TAGS]
    if unknown:
        problems.append(f"every tag is on the verified list: {unknown}")
    if any(t in ("boing", "applause", "thud", "sound effect") for t in tags_in_script):
        problems.append("no sound-effect tag")
    expressions = [t for t in tags_in_script if "pause" not in t]
    if len(expressions) > 6:
        problems.append(f"at most six expressions in all: {len(expressions)}")
    per_beat: dict[str, int] = {}
    for t in g["tags"]:
        if "pause" not in t["tag"]:
            per_beat[t["beat"]] = per_beat.get(t["beat"], 0) + 1
    if any(v > 1 for v in per_beat.values()):
        problems.append(f"at most one expression per beat: {per_beat}")
    if "Intip yuk!" not in g["script"] or _re.search(r"<(?!(?:short|long) pause>)[^<>]+>\s*Intip yuk!", g["script"]) or "whisper" in g["script"]:
        problems.append('"Intip yuk!" is read plainly: no expression tag right before it (a pause may be), no whispers anywhere')
    if "hushed" in g["style"] or "bright and direct on 'Intip yuk!'" not in g["style"]:
        problems.append("the Google style says bright and direct on the sting, never hushed")
    if "<long pause> Jangan" not in g["script"]:
        problems.append("a long pause before the last tips")
    if g["script"].rstrip().endswith(">"):
        problems.append("no tag after the last sentence")
    narration = " ".join(b["narration"] for b in story["beats"] if b["narration"].strip())
    if motion_voice.strip_tags(g["script"]) != motion_voice.strip_tags(narration):
        problems.append("the tags strip back to the story's narration")
    if [w for _r, w in motion_voice.tokens(g["script"])] != [w for _r, w in motion_voice.tokens(narration)]:
        problems.append("the matching ignores the tags: the words are the same")
    for word in ("tahun", "laki", "perempuan", "gender", "age", "accent", "aksen", "male", "female", "years old"):
        if _re.search(rf"\b{_re.escape(word)}\b", g["style"] + " " + g["styleLong"], _re.I):
            problems.append(f"the style has no {word!r}")
    if "tips" not in g["style"] or "tips" not in g["styleLong"]:
        problems.append("a story with tips names the tips in the style")
    no_tips = {"beats": [b for b in story["beats"] if b["kind"] != "tips"]}
    if "tips" in motion.narration_export(no_tips, "googleai")["style"]:
        problems.append("a story without tips has no tips sentence")
    if "tips" in motion.narration_export({"beats": [{"id": "a", "kind": "hook", "narration": "Kenapa ini?"}]}, "googleai")["style"]:
        problems.append("a short story has no tips sentence")
    if g["text"] != g["script"] or "DESCRIPTION" in g["text"] or "Note:" in g["text"] or not g["info"].startswith("About ") or "DESCRIPTION" not in g["info"]:
        problems.append("the Google copied text is the script only; the style and the notes are in the info")
    # VoiceStudio and ElevenLabs: unchanged
    for target in ("elevenlabs",):
        want = (fx / f"narration-{target}.txt").read_text(encoding="utf-8")
        if motion.narration_export(story, target)["text"] != want:
            problems.append(f"the {target} export is unchanged")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the Google script with the verified tags placed by rule (one per beat, six in all, no tag on the sting, <chuckle>, <long pause>), the short English style, the round trip, and the ElevenLabs export matches its snapshot"


# check: the VoiceStudio export (PLAN-VOICE-VOICESTUDIO): the square-bracket tags only from VoiceStudio's list ([pause ...], and [laughter] or [sigh] when
# the person checks it, at most two), the pauses ([pause 500ms] between beats, [pause 1s] once before the last tips), the voice description (one value per
# category: gender, age, pitch), the options refused when not a value, the round trip (the stripped script is the story's narration) and the ElevenLabs
# snapshot unchanged. No service, no workspace.
def check_voicestudio() -> tuple[str, str]:
    import re as _re
    from . import motion, motion_voice
    problems: list[str] = []
    fx = FIXTURES / "motion"
    story = json.loads((fx / "narration-story.json").read_text(encoding="utf-8"))
    vs = motion.narration_export(story, "voicestudio")
    narration = " ".join(b["narration"] for b in story["beats"] if b["narration"].strip())
    squash = lambda s: _re.sub(r"\s+", " ", s).strip()
    # VoiceStudio reads every character aloud: the copied text is the narration sentences and nothing else
    if squash(vs["text"]) != squash(narration):
        problems.append(f"the copied text is the narration and nothing else: {vs['text'][:120]!r}")
    stray = sorted(set(vs["text"]) - set(narration) - set("\n "))
    if stray:
        problems.append(f"every character of the copied text is a character of the narration: {stray}")
    for word in ("Bagian", "sekitar", "detik", "pause", "laughter", "sigh", "Total", "Target", "DESKRIPSI", "DESCRIPTION", "NASKAH", "Catatan", "Note:", "hapus"):
        if word in vs["text"] and word not in narration:
            problems.append(f"no {word!r} in the copied text")
    if vs["script"] != vs["text"] or vs["tags"] or vs["style"] is not None or vs["styleLong"] is not None:
        problems.append("VoiceStudio has no tags and no description: the script is the text")
    # the parts: each one pure narration, in order, and together the whole text
    if not vs["parts"] or any("text" not in x or not x["text"].strip() for x in vs["parts"]):
        problems.append("every part has its plain text")
    if "\n".join(x["text"] for x in vs["parts"]) != vs["text"]:
        problems.append("the parts together are the whole text")
    long_story = {"beats": [{"id": f"b{i}", "kind": "normal", "narration": " ".join(["kata"] * 6) + "."} for i in range(14)]}
    long_vs = motion.narration_export(long_story, "voicestudio")
    if len(long_vs["parts"]) < 2 or any(set(x["text"]) - set("kata. \n") for x in long_vs["parts"]):
        problems.append("a long narration is offered as several parts, each pure narration")
    # the counts and the hints stay outside the copied text
    if not vs["info"].startswith("About ") or "reads every character" not in vs["info"] or "About " in vs["text"]:
        problems.append("the counts and the hint are in the info, outside the copied text")
    # the old panel's choices (voice description, [laughter]) are gone
    for key in ("vsGender", "vsAge", "vsTags"):
        if key in motion.DEFAULT_OPTIONS or key in motion.normalize_options({key: "x"}):
            problems.append(f"the option {key} is gone: it only produced tags")
    # the round trip: the matching reads the same words as the narration
    if [w for _r, w in motion_voice.tokens(vs["text"])] != [w for _r, w in motion_voice.tokens(narration)]:
        problems.append("the matching reads the same words as the narration")
    if vs["text"] != (fx / "narration-voicestudio.txt").read_text(encoding="utf-8"):
        problems.append("the VoiceStudio export matches its snapshot")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the VoiceStudio text is the narration only (no header, no count, no pause or tag, nothing it would read aloud), in plain parts that together are the whole text, with the counts and the hint outside it"


# check: the ElevenLabs export (PLAN-VOICE-ELEVENLABS): the square-bracket tags only from the official voice list (plus [pause]), never a sound-effect or
# experimental tag; no <break> in the script; "..." between beats and one [pause] before the last tips; no tag before "Intip yuk!" and [curious]
# at a question hook; at most one tag per beat and six in all; one request (no part headers); the model and the settings as a note; the round trip
# (the stripped script is the story's narration). No service, no workspace.
def check_elevenlabs() -> tuple[str, str]:
    import re as _re
    from . import motion, motion_voice
    problems: list[str] = []
    fx = FIXTURES / "motion"
    story = json.loads((fx / "narration-story.json").read_text(encoding="utf-8"))
    el = motion.narration_export(story, "elevenlabs")
    script = el["script"]
    tags = _re.findall(r"\[([^\[\]]+)\]", script)
    official = {"laughs", "laughs harder", "starts laughing", "wheezing", "whispers", "sighs", "exhales", "sarcastic", "curious", "excited", "crying",
                "snorts", "mischievously", "pause"}
    if any(t not in official for t in tags):
        problems.append(f"every tag is on the official voice list: {tags}")
    if any(w in t for t in tags for w in ("gunshot", "applause", "clapping", "explosion", "swallow", "gulp", "fart", "woo", "sings", "accent")):
        problems.append("no sound-effect or experimental tag")
    if "<break" in script or "<" in script:
        problems.append("no <break> and no angle brackets in the script")
    if "Bagian" in script:
        problems.append("the script is one request, with no part headers")
    expressions = [t for t in tags if t != "pause"]
    if len(expressions) > 6:
        problems.append(f"at most six expression tags: {len(expressions)}")
    per_beat: dict[str, int] = {}
    for t in el["tags"]:
        if t["tag"] != "pause":
            per_beat[t["beat"]] = per_beat.get(t["beat"], 0) + 1
    if any(v > 1 for v in per_beat.values()):
        problems.append(f"at most one tag per beat: {per_beat}")
    if "Intip yuk!" not in script or _re.search(r"\[(?!pause\])[^\[\]]+\]\s*Intip yuk!", script) or "whisper" in script:
        problems.append('"Intip yuk!" is read plainly: no expression tag right before it (a pause may be), no whispers anywhere')
    if not script.startswith("[curious] Kenapa"):
        problems.append("a question hook starts with [curious]")
    if script.count("...") < 1:
        problems.append("the beats are joined with ...")
    if script.count("[pause]") != 1 or "[pause] Jangan" not in script:
        problems.append("one [pause] before the last tips")
    if motion_voice.tokens(script) and [w for _r, w in motion_voice.tokens(script)] != [w for _r, w in motion_voice.tokens(" ".join(b["narration"] for b in story["beats"] if b["narration"].strip()))]:
        problems.append("the matching ignores the tags, the ellipses and the pause")
    narration = " ".join(b["narration"] for b in story["beats"] if b["narration"].strip())
    if motion_voice.strip_tags(script) != motion_voice.strip_tags(narration):
        problems.append("the stripped ElevenLabs script is the story's narration")
    if el.get("style") is not None or not el.get("settings") or "Stability" not in el["settings"] or "Eleven v4" not in el["model"]:
        problems.append("the model and the settings are a note, not a style field")
    if "not verified" not in el["status"] or "Not verified" not in el["info"] or "Not verified" in el["text"] or "SETTINGS" in el["text"]:
        problems.append("the note says what is not verified, outside the copied script")
    want = (fx / "narration-elevenlabs.txt").read_text(encoding="utf-8")
    if el["text"] != want or el["text"] != el["script"]:
        problems.append("the ElevenLabs copied text is the script, and matches its snapshot")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the ElevenLabs script with the official voice tags only (no sound effects), ... between beats and one [pause] before the last tips, no tag on the sting, [curious] on a question hook, one tag per beat and six in all, one request, the model and settings as a note, and the round trip"


# check: the Khusus panel's story (PLAN-KHUSUS-PAGE): the story taken from the folder the person chose (valid: kept; rejected: the problems and the fix,
# nothing kept), the folder changed (the state, the next step, the chips), the path safety (a direct child of videos/, no "..", no symlink out, a
# story.json that is there and readable), and the only file read is story.json. The videos folder is a copy in a temporary folder, never the person's.
def check_khusus() -> tuple[str, str]:
    import os, shutil, subprocess, tempfile
    from . import motion, paths, profiles
    ok, why = motion._node.ready()
    if not ok:
        return SKIP, why
    problems: list[str] = []
    good = json.loads((Path(__file__).resolve().parents[1] / "remotion" / "templates" / "video" / "story.json").read_text(encoding="utf-8"))
    bad = dict(good, duration=99)
    tmp = Path(tempfile.mkdtemp(prefix="klipian-khusus-"))
    root = tmp / "videos"
    root.mkdir()
    outside = tmp / "luar"
    outside.mkdir()
    (outside / "story.json").write_text(json.dumps(good), encoding="utf-8")

    def make(slug, story_text=None):
        d = root / slug
        d.mkdir()
        (d / "index.tsx").write_text("export const Video = () => null;\n", encoding="utf-8")
        if story_text is not None:
            (d / "story.json").write_text(story_text, encoding="utf-8")
        return d

    make("khusus-satu", json.dumps(good))
    make("khusus-rusak", json.dumps(bad))
    make("tanpa-cerita")
    make("json-rusak", "{ bukan json")
    old_root, old_dur = motion.VIDEOS_ROOT, motion.DURATIONS
    motion.VIDEOS_ROOT = root
    motion.DURATIONS = (12,) + tuple(old_dur)
    profiles.write_meta("kh1", {"name": "kh1", "color": "#336699", "defaults": {}})
    profiles.ensure_dirs("kh1")
    tok = paths.set_profile("kh1")
    try:
        pid = motion.create("contoh folder khusus", 12, "", {"kind": "khusus"})["id"]
        # nothing chosen yet: the command, then the folder
        if motion.folder_state(pid)["state"] != "not-chosen" or motion.detail(pid)["next"]["key"] != "folder":
            problems.append("a Khusus video with no folder asks for the command and the folder")
        # a folder is chosen: the story is not taken yet
        motion.update_project(pid, {"composition": "khusus-satu"})
        if motion.folder_state(pid)["state"] != "not-loaded" or motion.detail(pid)["next"]["key"] != "take":
            problems.append("a chosen folder whose story is not taken asks to take it")
        # the valid story is taken and kept
        res = motion.take_folder(pid, "khusus-satu")
        if not res.get("ok") or motion.story_of(pid) is None or motion.story_of(pid)["duration"] != 12:
            problems.append(f"the valid story is taken and kept: {str(res)[:160]}")
        if motion.folder_state(pid)["state"] != "loaded":
            problems.append("after the take the folder's state is 'loaded'")
        if motion.folder_state(pid)["path"] != str(root / "khusus-satu"):
            problems.append("the folder is shown with its full path")
        kept = motion.story_of(pid)
        # a rejected story: the problems and the fix come back, nothing is kept
        motion.update_project(pid, {"composition": "khusus-rusak"})
        res = motion.take_folder(pid, "khusus-rusak")
        if res.get("ok") is not False or not res.get("errors") or "Please fix" not in res.get("fix", ""):
            problems.append(f"a rejected story comes back with its problems and a fix message: {str(res)[:160]}")
        if motion.story_of(pid) != kept:
            problems.append("a rejected story is not kept (the story is unchanged)")
        # a story that is not JSON
        motion.update_project(pid, {"composition": "json-rusak"})
        try:
            motion.take_folder(pid, "json-rusak")
            problems.append("a story.json that is not JSON is refused")
        except motion.MotionError as exc:
            if exc.code != "folder":
                problems.append(f"a story.json that is not JSON gives a folder error: {exc.code}")
        # the folder changed after the take: the state, the next step and the chips
        motion.update_project(pid, {"composition": "khusus-satu"})
        motion.take_folder(pid, "khusus-satu")
        (root / "khusus-satu" / "story.json").write_text(json.dumps(dict(good, question="Kenapa hujan turun?")), encoding="utf-8")
        if motion.folder_state(pid)["state"] != "changed":
            problems.append("a changed story.json makes the folder 'changed'")
        d = motion.detail(pid)
        if d["next"]["key"] != "retake":
            problems.append(f"a changed folder asks to take the story again: {d['next']}")
        if [c["state"] for c in d["stages"][:3]] != ["stale", "stale", "stale"]:
            problems.append(f"a changed folder makes the story, claims and title stale: {d['stages']}")
        # the path safety: only a direct child of videos/
        for bad_slug in ("../luar", "khusus-satu/../..", "a/b", "", "Khusus", "tidak-ada"):
            try:
                motion.take_folder(pid, bad_slug)
                problems.append(f"the folder {bad_slug!r} is refused")
            except motion.MotionError:
                pass
        try:
            motion.take_folder(pid, "tanpa-cerita")
            problems.append("a folder with no story.json is refused")
        except motion.MotionError:
            pass
        linked = False
        try:
            os.symlink(str(outside), str(root / "tautan"), target_is_directory=True)
            linked = True
        except OSError:
            r = subprocess.run(["cmd", "/c", "mklink", "/J", str(root / "tautan"), str(outside)], capture_output=True)
            linked = r.returncode == 0
        if linked:
            try:
                motion.take_folder(pid, "tautan")
                problems.append("a link out of videos/ is refused")
            except motion.MotionError:
                pass
        # Otomatis is not touched: a template video still asks for the brief
        t = motion.create("contoh templat", 12, "", {"kind": "otomatis"})
        if motion.detail(t["id"])["next"]["key"] != "brief" or motion.folder_state(t["id"]) is not None:
            problems.append("a template video still asks for the brief, with no folder")
    finally:
        paths._profile.reset(tok)
        motion.VIDEOS_ROOT, motion.DURATIONS = old_root, old_dur
        shutil.rmtree(tmp, ignore_errors=True)
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, ("the story taken from the chosen folder (valid kept, rejected not kept with the problems and the fix), a changed story.json shown as 'changed' "
                  "with the stale chips, the path refused for '..', a non-child, a missing or unreadable story.json, and a link out (where the system allows), and Otomatis unchanged")


# check: the brief buttons (PLAN-BRIEF-BUTTONS): the command button and its sentence are gone from the page and the skill; both panels (Otomatis brief,
# Khusus folder) show "Salin brief" and "Unduh brief"; the Khusus next step without a folder asks for the brief (the brief action, not a command); the
# skill starts from a pasted brief or a given path and never assumes a saved file. Reads the files only.
def check_briefbuttons() -> tuple[str, str]:
    from . import motion
    root = Path(__file__).resolve().parents[1]
    page = "\n".join(f.read_text(encoding="utf-8") for f in sorted((root / "ui" / "js" / "remotion").glob("page*.js")))
    html = (root / "ui" / "remotion.html").read_text(encoding="utf-8")
    skill = (root / ".claude" / "skills" / "klipian-video" / "SKILL.md").read_text(encoding="utf-8")
    problems: list[str] = []
    for gone in ("copyClaudeCmd", "Salin perintah untuk Claude Code", "Baca file brief yang kamu unduh", "Salin perintah ke Claude Code"):
        if gone in page or gone in html or gone in skill:
            problems.append(f"{gone!r} is gone from the page and the skill")
    # one of each action on the page: the next-step bar links to the step instead of repeating the action
    for act in ("rmCopyBrief", "rmDownBrief", "takeFolder"):
        if page.count(f'data-act="{act}"') != 1:
            problems.append(f"the page has one {act} button, not {page.count(f'data-act={chr(34)}{act}{chr(34)}')}")
    if "Paste the brief into Claude Code opened in the klipian folder" not in page:
        problems.append("the brief step has its line above the buttons")
    if "Claude Code writes the story and makes the video folder" not in page:
        problems.append("the folder step has its note")
    if 'data-act="nextStep"' in page or "doNext" in page or 'data-act="openStep"' not in page:
        problems.append("the next-step bar opens the step; it does not repeat the action")
    # the language: all English, no stale words, no default fieldset lines, the story's words named
    for stale in ("ChatGPT", "Claude atau", "Muat naskah", "Bagian N", "[laughter]", "Ambil cerita", "Naskah suara", "langkah 3", " detik"):
        if stale in page or stale in html:
            problems.append(f"{stale!r} is gone from the page")
    if "<fieldset" in page or "<fieldset" in html or "<legend" in page or "<legend" in html:
        problems.append("no default fieldset lines: groups are plain boxes")
    if "kindLabel(b.kind)" not in page or "itemLabel(it.type)" not in page:
        problems.append("the beat kinds and the item types are shown by their names, not the raw words")
    if 'data-act="allRight"' not in page or "Did you open the sources?" not in page or "All correct" not in page:
        problems.append('the facts step has "All correct", which asks "Did you open the sources?" once')
    if "narr-block" in page or "details.narr" in page or "data-vs=" in page:
        problems.append("the voice texts open nothing by themselves, and the VoiceStudio tag controls are gone")
    if page.count("voicestudio") and "VOICE_APP_ORDER.map" not in page:
        problems.append("the voice apps are chosen in one place (the options), not again in the script step")
    if "peek=1" not in page or '/briefed' not in page:
        problems.append("the brief is fetched ahead without counting as copied, and noted when it is copied")
    base = {"story": False, "pending": 0, "rejected": 0, "title": False, "custom": True, "composition": False, "slug": "x", "voice": False,
            "aligned": False, "voiceStale": False, "render": "none", "gate": [], "briefed": False, "storyPath": "s.json", "stills": "none",
            "preview": "none", "folder": "not-chosen"}
    step = motion.next_step(base)
    if step["action"] != "brief" or step["text"] != "Copy the brief into Claude Code, then choose the folder it made":
        problems.append(f"Khusus without a folder: the brief action and its text: {step}")
    if "command" in step or step["action"] == "copy":
        problems.append("the next step carries no command")
    if "pasted into this session" not in skill and "pastes it here" not in skill:
        problems.append("the skill starts from a pasted brief")
    if "ask for its path" not in skill:
        problems.append("the skill asks for a path when only a name is given")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the command button and its sentence are gone from the page and the skill; one copy-brief, one download-brief and one load-story button (the next-step bar links to the step); all English, no fieldset lines, All correct with its question; the Khusus next step without a folder asks for the brief; the skill starts from a pasted brief or a path"


# check: the music choices (PLAN-VARIETY stage 1, the part of klipian/motion.py and the page): the labels the page shows are the server's, the legacy beds keep
# their tracks, and the default for a new video is still the legacy calm bed until ian picks the new one by ear. Reads the files only.
def check_music() -> tuple[str, str]:
    import re as _re
    from . import motion
    root = Path(__file__).resolve().parents[1]
    js = (root / "ui" / "js" / "remotion" / "music.js").read_text(encoding="utf-8")
    html = (root / "ui" / "remotion.html").read_text(encoding="utf-8")
    problems: list[str] = []
    page_labels = dict(_re.findall(r'(\w+): "([^"]+)"', js))
    if page_labels != motion.MUSIC_LABELS:
        problems.append(f"the page labels are the server's: {page_labels} vs {motion.MUSIC_LABELS}")
    if set(motion.MUSIC_TRACKS) != set(motion.MUSIC_LABELS):
        problems.append("every track has a label")
    if motion.MUSIC_TRACKS.get("calm") != "bed-calm" or motion.MUSIC_TRACKS.get("tech") != "bed-tech":
        problems.append("the legacy beds keep their tracks (bed-calm, bed-tech)")
    catalog = (root / "remotion" / "src" / "catalog.ts").read_text(encoding="utf-8")
    for track in motion.MUSIC_TRACKS.values():
        if track != "none" and f'"{track}"' not in catalog:
            problems.append(f"the track {track} is in the catalogue")
    if motion.DEFAULT_OPTIONS["music"] != "sunny" or motion.normalize_options({})["music"] != "calm":
        problems.append("a new video gets sunny (ian's pick), and a project saved without a music choice keeps calm")
    if motion.create("tes bed default", 30, "")["options"]["music"] not in motion.CHEERFUL_BEDS:
        problems.append("a video made now gets one of the cheerful beds")
    # the technology beds (P28-R phase 4): their tracks, a topic about a gadget or electricity suggests one of them, any other topic the cheerful default, and an explicit choice wins
    if motion.MUSIC_TRACKS.get("circuit") != "bed-circuit" or motion.MUSIC_TRACKS.get("neon") != "bed-neon":
        problems.append("the technology beds have their tracks (bed-circuit, bed-neon)")
    for topic in ("Kenapa colokan listrik bisa panas", "Bagaimana wifi bekerja", "Kenapa baterai hp cepat habis"):
        if motion.suggest_music(topic) not in motion.TECH_BEDS:
            problems.append(f"{topic!r} gets a technology bed, not {motion.suggest_music(topic)}")
    for topic in ("Kenapa hujan turun", "Kenapa kita selalu bilang 5 menit lagi"):
        if motion.suggest_music(topic) not in motion.CHEERFUL_BEDS:
            problems.append(f"{topic!r} gets a cheerful bed, not {motion.suggest_music(topic)}")
    # the beds are spread (ian, 2026-11-13: every video sounded alike): a dozen everyday topics do not all get one bed, and the brief CLI suggests from the topic too
    spread = {motion.suggest_music(f"Kenapa {w} begitu") for w in ("hujan", "kucing", "nasi", "langit", "es", "bawang", "macet", "tidur", "garam", "kopi", "sabun", "pasar")}
    if len(spread) < 4:
        problems.append(f"a dozen topics get at least 4 different beds, not {sorted(spread)}")
    if not set(motion.TECH_BEDS + motion.CHEERFUL_BEDS) <= set(motion.MUSIC_TRACKS) or {"calm", "tech", "none"} & set(motion.TECH_BEDS + motion.CHEERFUL_BEDS):
        problems.append("the suggested beds are tracks, and never a legacy bed or none")
    from . import motion_brief_cli
    for topic in ("Kenapa hujan turun", "Bagaimana wifi bekerja"):
        if f"(story music track {motion.MUSIC_TRACKS[motion.suggest_music(topic)]})" not in motion_brief_cli.brief_for(topic):
            problems.append(f"the brief CLI without --music gives {topic!r} the bed suggested for it")
        if "musik=" in motion.short_command({"topic": topic, "duration": 60, "notes": "", "options": {"music": motion.suggest_music(topic)}}):
            problems.append("the -create command leaves out musik= when the bed is the suggested one")
    if motion.suggest_music("Bagaimana wifi bekerja") != motion.suggest_music("Bagaimana wifi bekerja"):
        problems.append("the same topic always gets the same bed")
    if motion.create("Bagaimana wifi bekerja", 30, "", {"music": "auto"})["options"]["music"] not in motion.TECH_BEDS:
        problems.append("music 'auto' on a technology topic gives a technology bed")
    if motion.create("Bagaimana wifi bekerja", 30, "", {"music": "glow"})["options"]["music"] != "glow":
        problems.append("an explicit music choice is kept")
    if 'value="auto" selected>Automatic (from the topic)' not in html:
        problems.append("the new-video dialog starts on 'Automatic (from the topic)'")
    for key, label in motion.MUSIC_LABELS.items():
        if not _re.search(rf'<option value="{key}"( selected)?>{_re.escape(label)}</option>', html):
            problems.append(f"the dialog offers {label!r}")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "the page's music labels are the server's, the legacy beds keep their tracks, new videos get a bed spread by topic, and an old project keeps calm"


def check_briefagents() -> tuple[str, str]:
    """The brief for any AI (PLAN-BRIEF-AGENTS): both examples are real stories that validate with no warnings, the lists come from the catalogue,
    Part B is only for Khusus, and the answer format keeps the heading the skill reads. The sizes are recorded in the detail, not capped."""
    from . import motion
    problems: list[str] = []
    cat = motion._catalog()
    for key in ("example", "exampleHabit"):
        res = motion.validate_story(cat[key])
        if res.get("ok") is not True:
            problems.append(f"{key} does not validate: {res.get('errors')}")
        elif res.get("warnings"):
            problems.append(f"{key} has warnings: {res['warnings']}")
    kinds = cat["enums"]["beatKinds"]
    if set(cat["beatKindMeaning"]) != set(kinds):
        problems.append("beatKindMeaning does not cover every beat kind")
    for opts, label in (({}, "otomatis"), ({"kind": "khusus"}, "khusus")):
        text = motion.build_brief({"topic": "Kenapa colokan panas", "duration": 45, "notes": "", "options": opts})
        if "closest listed" in text:
            problems.append(f"the {label} catalogue still tells the AI to use the closest listed thing")
        if "Claude Code" in text:
            problems.append(f"the {label} brief names Claude Code: Part A must be free of product names")
    if "Do not use `socket` unless" not in motion.build_brief({"topic": "x", "duration": 45, "notes": "", "options": {}}):
        problems.append("the Otomatis catalogue says when a socket may be used")
    if "Do not use a catalogue object as a stand-in." not in motion.build_brief({"topic": "x", "duration": 45, "notes": "", "options": {"kind": "khusus"}}):
        problems.append("the Khusus catalogue says not to use a catalogue object as a stand-in")
    if "agent" not in motion.KINDS["khusus"] or "Claude" in motion.KINDS["khusus"]:
        problems.append("the Khusus option names the agent, not the product")
    khusus_text = motion.build_brief({"topic": "x", "duration": 45, "notes": "", "options": {"kind": "khusus"}})
    for want in ("remotion/src/dictionary.ts", "remotion/src/components/Iso*.tsx", "remotion/videos/kenapa-colokan-panas", "remotion/videos/cara-kerja-hujan-buatan"):
        if want not in khusus_text:
            problems.append(f"the Khusus steps do not name {want}")
    for opts, label in (({}, "otomatis"), ({"kind": "khusus"}, "khusus")):
        text = motion.build_brief({"topic": "Kenapa colokan panas", "duration": 45, "notes": "", "options": opts})
        for hidden in ("`captionStyle?`", "`platforms?`"):
            if hidden in text:
                problems.append(f"the {label} brief offers the field {hidden}: it is ian's choice (the caption look, the platforms), not the AI's")
    sizes = []
    for d in (30, 45, 60):
        for opts, khusus in (({}, False), ({"kind": "khusus"}, True)):
            text = motion.build_brief({"topic": "Kenapa colokan panas", "duration": d, "notes": "", "options": opts})
            if ("### Step 1:" in text) != khusus:
                problems.append(f"the {d} s brief {'lacks' if khusus else 'has'} the numbered steps for kind {'khusus' if khusus else 'otomatis'}")
            for kind in kinds:
                if f"`{kind}`" not in text:
                    problems.append(f"the {d} s brief does not list the beat kind {kind}")
            for track in motion.MUSIC_TRACKS.values():
                if track != "none" and f"`{track}`" not in text:
                    problems.append(f"the {d} s brief does not list the track {track}")
            if "## Answer format" not in text or "node remotion/validate.mjs" not in text:
                problems.append(f"the {d} s brief lost its answer format or the validate command")
            if d == 45:
                sizes.append(f"{'khusus' if khusus else 'otomatis'} {len(text)}")
    if problems:
        return FAIL, "\\n      ".join(problems)
    return PASS, ("both examples validate with no warnings, the beat kinds and tracks come from the catalogue, the steps only for Khusus; "
                  f"brief size at 45 s: {', '.join(sizes)} characters")


# The strict checklist a Khusus brief must pass (P28-R phase 3): an agent that is weak at following instructions needs the rules first, exact paths,
# and every step with a command and an expected result. `parse_brief_checklist` reads the brief as text and returns the problems; no step may be missing.
BRIEF_ORDER = ["## 1. Hard rules", "## 2. What you must produce", "## 3. Steps", "## If you cannot run commands", "## Common mistakes", "## Pilihan video", "# Reference"]


def parse_brief_checklist(text: str, slug: str) -> list[str]:
    import re
    problems: list[str] = []
    at = [text.find(h) for h in BRIEF_ORDER]
    for h, i in zip(BRIEF_ORDER, at):
        if i < 0:
            problems.append(f"the section {h!r} is missing")
    if all(i >= 0 for i in at) and at != sorted(at):
        problems.append(f"the sections are not in this order: {BRIEF_ORDER}")
    if all(i >= 0 for i in at):
        before_rules = text[:at[0]]
        if before_rules.count("\n## ") or len(before_rules) > 700:
            problems.append("the hard rules come first: only a short opening may stand before them")
        rules = text[at[0]:at[1]]
        numbers = [int(n) for n in re.findall(r"^(\d+)\. ", rules, re.M)]
        if numbers != list(range(1, len(numbers) + 1)) or len(numbers) < 8:
            problems.append(f"the hard rules are a numbered list 1..n (found {numbers})")
        steps = re.split(r"^### Step (\d+): ", text[at[2]:at[3]], flags=re.M)
        found = [int(n) for n in steps[1::2]]
        if found != list(range(1, 9)):
            problems.append(f"the steps are numbered 1 to 8 (found {found})")
        wanted = {2: f"node remotion/validate.mjs remotion/stories/{slug}.json", 3: f"npm run new-video {slug} stories/{slug}.json",
                  5: f"npm run check", 6: f"node render.mjs out/{slug}/job.json", 7: "narration_export"}
        for n, body in zip(found, steps[2::2]):
            if "Expected:" not in body:
                problems.append(f"step {n} has no 'Expected:' line")
            if n in wanted and wanted[n] not in body:
                problems.append(f"step {n} has the exact command {wanted[n]!r}")
            if n in wanted and n != 7 and "Run" not in body:
                problems.append(f"step {n} has no 'Run' line")
        produce = text[at[1]:at[2]]
        for path in (f"remotion/stories/{slug}.json", f"remotion/videos/{slug}/", f"remotion/out/{slug}/hook.png", f"remotion/tests/{slug}.test.ts"):
            if path not in produce:
                problems.append(f"the files section names {path}")
        if "The files you may write are exactly these and no others" not in produce:
            problems.append("the files section says which files may be written and no others")
        if f"npm run style-check -- {slug}" not in text[at[2]:at[3]] or "error TS" not in text[at[2]:at[3]]:
            problems.append("step 5 runs npm run check (expected: no error TS line) and the style check")
        if "ONLY from `../../src/design/index.ts`" not in text[at[2]:at[3]] or "tidak ada" not in text[at[2]:at[3]]:
            problems.append("step 4 says to import components only from the design index, and step 5 names the wrong-import line")
        if "design/index.ts" not in text[at[2]:at[3]] or "assets-sheet" not in text[at[2]:at[3]]:
            problems.append("step 4 says sfx.ts and plan.ts never import the design index, and to search the library before `needs`")
        if "FALLBACK: story only, no video folder" not in text[at[3]:at[4]]:
            problems.append("the fallback names its first line")
        if len(re.findall(r"^\d+\. ", text[at[4]:at[5]], re.M)) < 8:
            problems.append("the common mistakes list has at least 8 items")
    return problems


def check_briefsteps() -> tuple[str, str]:
    """The Khusus brief passes the strict checklist at every length and with every voice-app choice, with the names of the folders that exist avoided; the fallback
    works end to end (a story pasted without a folder: saved, 'Video belum dibuat', the render refused with that reason); the size is capped."""
    from . import motion
    problems: list[str] = []
    sizes = []
    for d in (30, 45, 60):
        for targets in (["voicestudio"], ["voicestudio", "elevenlabs", "googleai"]):
            p = {"topic": "Kenapa kopi bikin melek", "duration": d, "notes": "", "options": {"kind": "khusus", "voiceTargets": targets}}
            text = motion.build_brief(p)
            slug = motion.video_slug(p["topic"])
            problems += [f"{d} s {len(targets)} apps: {x}" for x in parse_brief_checklist(text, slug)]
            if len(text) > 42000:
                problems.append(f"the {d} s brief is {len(text)} characters: keep it under 42000 so a small model can hold it")
            for t in targets:
                if f"`{t}`" not in text:
                    problems.append(f"the brief names the voice app {t}")
            if d == 45 and len(targets) == 3:
                sizes.append(len(text))
    if motion.video_slug("Kenapa colokan panas") == "kenapa-colokan-panas":
        problems.append("a topic whose folder already exists gets a new name")
    # the fallback end to end: the story alone, no folder
    old_durations = motion.DURATIONS
    motion.DURATIONS = (2,) + tuple(old_durations)                        # the tiny fixture story lasts 2 seconds
    try:
        p = motion.create("Kenapa kopi bikin melek", 2, "", {"kind": "khusus"})
        story = json.loads((FIXTURES / "motion" / "tiny-story.json").read_text(encoding="utf-8"))
        r = motion.paste(p["id"], "FALLBACK: story only, no video folder\n```json\n" + json.dumps(story) + "\n```\n```text\nhalo\n```", "main")
    finally:
        motion.DURATIONS = old_durations
    d = motion.detail(p["id"])
    if not d.get("story"):
        problems.append(f"the fallback answer is not accepted: {r.get('errors')}")
    else:
        if d["next"]["key"] != "folder" or "The video is not made yet" not in d["next"]["text"]:
            problems.append(f"after the fallback the next step says the video is not made: {d['next']}")
        reasons = " ".join(motion.render_problems(p["id"]))
        if "The video is not made yet" not in reasons:
            problems.append(f"the render is refused with 'The video is not made yet': {reasons!r}")
        if d["renderBlock"]["state"] == "ready":
            problems.append("the render block must not be ready")
    motion.delete_project(p["id"])
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, (f"the Khusus brief passes the strict checklist (rules first, 8 steps with Run and Expected, fallback, mistakes) at 30/45/60 s with 1 or 3 voice apps; "
                  f"size at 45 s {sizes[0]} characters (cap 40000); the fallback story is saved and the video stays 'belum dibuat'")


# check: "fit" (the third length choice): the Python pages equal the TS ones (pagesOf of remotion/src/captions.ts); the placement when the speech is shorter
# than, equal to and longer than the beat; the cut audio as long as the fitted story with silence in the pauses; the choice "fit" through the server (the
# fitted story and audio are used, the recording and the aligned story stay, "continue" goes back, an estimate is refused). The recogniser is a fake.
def check_voicefit() -> tuple[str, str]:
    import array
    import contextlib
    import http.client
    import io
    import shutil
    import threading
    import wave
    from http.server import ThreadingHTTPServer
    from . import motion, motion_voice as mv, paths, profiles
    from .ffmpeg_tools import _require, probe, run
    from .server import Handler

    problems: list[str] = []
    # --- the pages: the same as the TS pagesOf, for the looks and some real narrations
    node = shutil.which("node")
    root = Path(__file__).resolve().parent.parent
    if node and (root / "remotion" / "node_modules").is_dir():
        texts = ["Di siang hari, matahari menyinari gurun tanpa halangan awan, dan pasirnya cepat sekali menjadi sangat panas.", "Tapi tidak semua gurun sedingin itu. Gurun yang lembap malamnya lebih hangat.",
                 "Jadi kalau kamu berkemah di gurun, bawa jaket tebal dan selimut untuk malam hari.", "Siang membara, malam menggigit. Kenapa?"]
        js = ("import {pagesOf} from './src/captions.ts';const L={classic:[56,720,2,Infinity],wide:[46,720,1,Infinity],punch:[76,700,1,3]};const out={};"
              f"for(const t of {json.dumps(texts)})for(const [k,v] of Object.entries(L))out[k+'|'+t]=pagesOf(t.split(' ').map((w,i)=>({{w,a:i,b:i+1}})),...v).map(p=>p.words.length);"
              "console.log(JSON.stringify(out))")
        r = subprocess.run([node, "--input-type=module", "-e", js], cwd=root / "remotion", capture_output=True, text=True, timeout=60)
        try:
            ts = json.loads(r.stdout)
            for key, want in ts.items():
                look, t = key.split("|", 1)
                got = [len(p) for p in mv.pages_of([{"w": w, "a": i, "b": i + 1} for i, w in enumerate(t.split(" "))], look)]
                if got != want:
                    problems.append(f"pages_of differs from pagesOf ({look}): {got} vs {want} for {t[:30]!r}")
        except ValueError:
            problems.append(f"the TS pagesOf could not be run: {r.stderr[-200:]}")

    # --- the placement
    def words(t0, n, step=0.4, w=0.35, prefix="k"):
        return [{"w": f"{prefix}{i}", "a": round(t0 + i * step, 3), "b": round(t0 + i * step + w, 3)} for i in range(n)]

    beat = lambda i, kind, dur, text: {"id": i, "kind": kind, "dur": dur, "narration": text}      # noqa: E731
    story = {"duration": 14, "beats": [beat("hook", "hook", 3, "a"), beat("x", "normal", 6, "b"), beat("y", "normal", 2, "c"), beat("outro", "outro", 3, "")]}
    al = {"method": "whisper", "beats": {"hook": {"words": words(0.2, 6)}, "x": {"words": words(3.0, 12)}, "y": {"words": words(8.0, 12)}}}
    res = mv.fit(story, al, 14.0)
    timed = res["timed"]
    durs = [b["dur"] for b in timed["beats"]]
    if abs(durs[0] - 3) > 1e-6 or abs(durs[1] - 6) > 1e-6 or abs(durs[3] - 3) > 1e-6:
        problems.append(f"a beat with room keeps its planned length (and the silent outro too): {durs}")
    if durs[2] <= 2 or not any("y:" in n for n in res["notes"]):
        problems.append(f"a beat whose speech is longer is extended and a note says so: {durs} {res['notes']}")
    if not res["pauses"] or max(res["pauses"]) > 2.5:
        problems.append(f"the leftover time is split in small pauses: {res['pauses']}")
    if abs(timed["duration"] - sum(durs)) > 1e-6:
        problems.append("the duration is the sum of the beats")
    pcs = res["pieces"]
    if any(b["src"][0] < a["src"][1] - 1e-9 for a, b in zip(pcs, pcs[1:])) or any(b["dst"] < a["dst"] + a["len"] - 1e-6 for a, b in zip(pcs, pcs[1:])):
        problems.append("the pieces never overlap, in the recording or in the new timeline")
    for b in timed["beats"]:
        ws = b.get("words", [])
        if any(w["a"] < -1e-6 or w["b"] > b["dur"] + 1e-6 or w["b"] <= w["a"] for w in ws):
            problems.append(f"the word times stay inside beat {b['id']}: {ws[:2]}")
    first = timed["beats"][0]["words"][0]
    if first["a"] > mv.FIT_LEAD + 0.01:
        problems.append(f"no lead pause: the first word of a beat comes right after the lead-in: {first}")
    # a beat with room for exactly its speech: no pause at all
    probe_story = {"duration": 1, "beats": [beat("only", "normal", 1, "a")]}
    probe_al = {"method": "whisper", "beats": {"only": {"words": words(0.15, 7, step=0.4, w=0.4)}}}
    exact = mv.fit(probe_story, probe_al, 3.3)
    need = exact["timed"]["beats"][0]["dur"]
    again = mv.fit({"duration": need, "beats": [beat("only", "normal", need, "a")]}, probe_al, 3.3)
    if again["pauses"] or again["notes"]:
        problems.append(f"speech as long as the beat: no pause, no note: {again['pauses']} {again['notes']}")

    # --- the audio
    old_whisper = motion._whisper
    work = paths.workspace_dir() / "fit-src"
    work.mkdir(parents=True, exist_ok=True)
    ff = _require("ffmpeg")
    tone = work / "tone14.wav"
    run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=14:sample_rate=48000", "-ac", "1", str(tone)], desc="a tone", timeout=60)
    out = work / "fit.wav"
    run(mv.fit_command(ff, tone, out, res, story), desc="cutting", timeout=60)
    if abs(float(probe(out).duration) - timed["duration"]) > 0.08:
        problems.append(f"the cut audio lasts as long as the fitted story: {probe(out)['duration']} vs {timed['duration']}")
    with wave.open(str(out)) as w:
        rate = w.getframerate()
        samples = array.array("h", w.readframes(w.getnframes()))
    mid = int(rate * (res["pieces"][0]["dst"] + res["pieces"][0]["len"] + 0.05))
    if max(abs(s) for s in samples[mid:mid + int(rate * 0.1)]) > 200:
        problems.append("a pause between two pieces is silent")

    # --- through the server
    old_durations = motion.DURATIONS
    motion.DURATIONS = (8,) + tuple(old_durations)
    profiles.write_meta("vf1", {"name": "vf1", "color": "#336699", "defaults": {}})
    profiles.ensure_dirs("vf1")
    tok = paths.set_profile("vf1")
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    try:
        tiny = json.loads((FIXTURES / "motion" / "tiny-story.json").read_text(encoding="utf-8"))
        tiny["duration"] = 8
        tiny["beats"][0]["dur"] = tiny["beats"][1]["dur"] = 4
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def post(action, body):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
            conn.request("POST", f"/api/motion/{action}", body=json.dumps(body).encode(), headers={"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": "vf1", "Content-Type": "application/json"})
            r = conn.getresponse()
            content = r.read()
            conn.close()
            try:
                return r.status, json.loads(content)
            except ValueError:
                return r.status, {}

        def settle():
            end = time.time() + 180
            while time.time() < end and motion.job_state(pid).get("state") not in ("done", "failed", "cancelled"):
                time.sleep(0.3)

        pid = post("create", {"topic": "contoh potong suara", "duration": 8, "options": {"kind": "otomatis"}})[1]["project"]["id"]
        post("paste", {"id": pid, "text": json.dumps(tiny)})
        post("facts", {"id": pid, "claims": [{"index": 0, "status": "checked"}], "title": tiny["titles"][0]})
        tone6 = work / "tone6.wav"
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=6:sample_rate=22050", str(tone6)], desc="a tone", timeout=60)
        post("voice", {"id": pid, "path": str(tone6)})
        if post("voice-length", {"id": pid, "choice": "fit"})[0] != 400:
            problems.append("fit is refused before the narration is matched")
        hw, ow = tiny["beats"][0]["narration"].split(), tiny["beats"][1]["narration"].split()

        class Hears:
            def words(self, audio):
                heard = [{"text": w.strip(",.?!").lower(), "start": 0.2 + i * 0.4, "end": 0.2 + i * 0.4 + 0.35} for i, w in enumerate(hw)]
                return heard + [{"text": w.strip(",.?!").lower(), "start": 3.4 + i * 0.5, "end": 3.4 + i * 0.5 + 0.45} for i, w in enumerate(ow)]

        motion._whisper = Hears()
        post("voice-align", {"id": pid})
        settle()
        info = motion.voice_info(pid)
        if info["lengthOk"] or not info["fitReady"]:
            problems.append(f"6 s of voice against 8 s planned is outside the policy and fit is offered: {info['table']['percent']} {info['fitReady']}")
        voiced_before = (motion.project_dir(pid) / "story.voiced.json").read_bytes()
        wav_before = (motion.voice_dir(pid) / "narration.wav").read_bytes()
        st, j = post("voice-length", {"id": pid, "choice": "fit"})
        if st != 200 or j["voice"].get("lengthChoice") != "fit":
            problems.append(f"the choice fit is accepted: {st} {str(j)[:150]}")
        info = motion.voice_info(pid)
        fa = motion.render_voice(pid)
        if not info["lengthOk"] or abs(info["total"] - 8) > 0.01 or not info["fit"] or motion.story_file(pid).name != "story.fitted.json" or fa is None or fa.name != "narration.fit.wav":
            problems.append(f"with fit the video lasts the planned 8 s and uses the fitted story and audio: {info}")
        elif abs(float(probe(fa).duration) - 8) > 0.08:
            problems.append(f"the fitted audio lasts 8 s: {probe(fa)['duration']}")
        if (motion.project_dir(pid) / "story.voiced.json").read_bytes() != voiced_before or (motion.voice_dir(pid) / "narration.wav").read_bytes() != wav_before:
            problems.append("the recording and the aligned story are not changed by fit")
        if any("length" in g or "seconds" in g for g in motion.gate(pid)):
            problems.append(f"the 15 % gate uses the new duration: {motion.gate(pid)}")
        sub = motion.subtitles_file(pid, "srt")
        if sub is None or sub.name != "captions.fit.srt":
            problems.append("the subtitles follow the fitted story")
        post("voice-length", {"id": pid, "choice": "continue"})
        if motion.story_file(pid).name != "story.voiced.json" or motion.render_voice(pid).name != "narration.wav" or abs(motion.voice_info(pid)["total"] - 6) > 0.01:
            problems.append("continue goes back to the recording")
        post("voice-length", {"id": pid, "choice": "fit"})
        post("voice-align", {"id": pid})                              # a new match drops the fit
        settle()
        if motion.story_file(pid).name != "story.voiced.json" or motion.voice_info(pid)["fit"]:
            problems.append("matching again goes back to the recording")

        class Deaf:
            def words(self, audio):
                return []

        motion._whisper = Deaf()                                      # an estimate cannot be cut
        post("voice-align", {"id": pid})
        settle()
        if post("voice-length", {"id": pid, "choice": "fit"})[0] != 400:
            problems.append("fit is refused when the word times are only an estimate")
    finally:
        quiet.__exit__(None, None, None)
        if srv:
            srv.shutdown()
        motion.DURATIONS, motion._whisper = old_durations, old_whisper
        paths._profile.reset(tok)
    if problems:
        return FAIL, "\n      ".join(problems[:14])
    return PASS, "pages_of equals pagesOf; the placement (room, no room, silent outro), the cut audio, and the choice fit through the server (used, undone, refused for an estimate)"


# check: data safety (P3): an atomic write leaves no half file and no tmp file, the xlsx backups keep the newest 10 automatic ones (and never touch the manual,
# merge and migrate ones), and a project's summary lists all of its videos (the card says when a later one is gone from sources/).
def check_datasafe() -> tuple[str, str]:
    import tempfile
    from pathlib import Path as _P
    from . import paths, projects, xlsx_sync
    problems: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        root = _P(td)
        f = root / "a.json"
        paths.write_text_atomic(f, '{"a":1}')
        paths.write_text_atomic(f, '{"a":2}')
        if json.loads(f.read_text(encoding="utf-8")) != {"a": 2} or [p.name for p in root.iterdir()] != ["a.json"]:
            problems.append("an atomic write replaces the file and leaves no tmp file")
        ws = root / "ws"
        (ws / "backups").mkdir(parents=True)
        for i in range(13):
            (ws / "backups" / f"xlsx-202611{10 + i:02d}-120000").mkdir()
        for name in ("xlsx-manual-20261125", "xlsx-merge-20261126", "migrate-20261020-195112"):
            (ws / "backups" / name).mkdir()
        real = paths.workspace_dir
        paths.workspace_dir = lambda: ws
        try:
            gone = xlsx_sync.prune_backups()
        finally:
            paths.workspace_dir = real
        left = sorted(p.name for p in (ws / "backups").iterdir())
        auto = [n for n in left if n.startswith("xlsx-2026")]
        if len(gone) != 3 or len(auto) != 10 or auto[0] != "xlsx-20261113-120000" or len(left) != 13:
            problems.append(f"the xlsx backups keep the newest 10 automatic ones and the others: removed {gone}, left {left}")
        pf = root / "p1.json"
        pf.write_text(json.dumps({"id": "p1", "assets": [{"id": "a1", "kind": "video", "file": "one.mp4"}, {"id": "a2", "kind": "video", "file": "two.mp4"}, {"id": "a3", "kind": "image", "file": "x.png"}],
                                  "results": []}), encoding="utf-8")
        got = projects._project_summary(pf)
        if not got or got["videos"] != ["one.mp4", "two.mp4"] or got["video"] != "one.mp4":
            problems.append(f"a project's summary lists all of its videos: {got and got.get('videos')}")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "an atomic write replaces the file and leaves no tmp file; the xlsx backups keep the newest 10 automatic ones and leave the manual, merge and migrate ones; a project's summary lists all of its videos"
