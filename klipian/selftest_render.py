"""The baseline renders of the selftest, the scratch workspace every check runs in, and `--promote` / `--rebaseline`."""

from __future__ import annotations


import contextlib
import json
import shutil
import os
import sys
import tempfile
import time
from pathlib import Path

from .selftest_base import ROOT, FIXTURES, PASS, FAIL, SKIP, _load


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


def _pid_alive(pid: int) -> bool:
    """Is a process with this id running? (os.kill(pid, 0) would TERMINATE it on Windows, so ask the system.)"""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes
        kernel = ctypes.windll.kernel32
        handle = kernel.OpenProcess(0x1000, False, pid)           # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        try:
            code = ctypes.c_ulong()
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259    # STILL_ACTIVE
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


STALE_SELFTEST_SECONDS = 3600


def sweep_stale_scratch(real: Path, now: float | None = None) -> list[str]:
    """Delete the scratch workspaces (.selftest-*) of runs that were killed: older than an hour AND not owned by a
    running process (each live run keeps its pid in .selftest.pid). They hold only throw-away files: hardlinks and
    copies of the fixtures' videos and what the checks rendered, so they are deleted, not sent to the Recycle Bin
    (a hardlink removed here leaves the original alone). Returns the names removed."""
    import time as _time
    now = now or _time.time()
    removed = []
    for d in sorted(Path(real).glob(".selftest-*")):
        try:
            if not d.is_dir() or now - d.stat().st_mtime < STALE_SELFTEST_SECONDS:
                continue
            try:
                pid = int((d / ".selftest.pid").read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                pid = 0
            if pid and _pid_alive(pid):
                continue
            shutil.rmtree(d, ignore_errors=True)
            if not d.exists():
                removed.append(d.name)
        except OSError:
            continue
    return removed


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
    gone = sweep_stale_scratch(real)
    if gone:
        print(f"  (removed {len(gone)} stale scratch folder{'s' if len(gone) != 1 else ''} of killed runs: {', '.join(gone)})")
    tmp = Path(tempfile.mkdtemp(prefix=".selftest-", dir=real))
    (tmp / ".selftest.pid").write_text(str(os.getpid()), encoding="utf-8")        # this run is alive: do not sweep it
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
