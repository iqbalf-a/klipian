"""`python -m klipian selftest` -- the checks that let the code be moved
around without wondering what broke.

Two checks, each one that used to be done by hand:

  migrate  Old project shapes (tests/fixtures/migrate/*.old.json) go through
           server._migrate_project() and must come out as the matching
           *.new.json.
  render   The request the UI sent for the baseline Result (res2 of project
           ea8b7a796f48, tests/fixtures/res2/request.json) goes through
           server._run_render() and the MP4 must be byte-identical to the one
           recorded in tests/fixtures/res2/baseline.json.

The render check needs the source video, which stays local (it is not in the
repo): without it the check is SKIPPED, not failed.

The render goes through the real _run_render() -- the same function the
Render button reaches over HTTP -- but writes into a throwaway project
(workspace/out/selftest.<id>/, removed afterwards), so the real project's
renders are never touched.

    python -m klipian selftest                  both checks
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
    from . import server
    data, _ = server._migrate_project(_load(old_path))
    # A project with no id is given a random one; that is the one field that
    # can't be compared, so it is checked for being valid and then dropped.
    if "id" not in _load(old_path):
        assert server._valid_project_id(data.get("id")), "no valid id was minted"
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
        from . import server
        # (`id` was dropped above when the fixture has none; give it back.)
        current = json.loads(json.dumps(got))
        current.setdefault("id", SELFTEST_ID)
        again, changed = server._migrate_project(json.loads(json.dumps(current)))
        if changed or again != current:
            problems.append(f"{old.name}: migrating the result again changed it")
    if write_expected:
        return PASS, f"rewrote {len(olds)} expected file(s)"
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, f"{len(olds)} old shapes -> current shape"


# --------------------------------------------------------------------------
# check: render
# --------------------------------------------------------------------------

def check_render() -> tuple[str, str]:
    from . import server

    base = FIXTURES / "res2"
    baseline = _load(base / "baseline.json")
    req = _load(base / "request.json")

    video = server._find_video(req["video"])
    if not video:
        return SKIP, f"{req['video']} is not in workspace/samples/"

    out_dir = server.WORKSPACE / "out" / f"{SELFTEST_SLUG}.{SELFTEST_ID}"
    if out_dir.exists():
        return FAIL, f"{out_dir} already exists (left over from a killed run?) -- delete it"

    # A throwaway project: it only has to say which video it holds, and its
    # id/slug decide the output folder (server._project_out_dir).
    tmp_projects = Path(tempfile.mkdtemp(prefix="klipian-selftest-"))
    (tmp_projects / f"{SELFTEST_ID}.json").write_text(json.dumps({
        "id": SELFTEST_ID, "name": SELFTEST_SLUG, "outSlug": SELFTEST_SLUG,
        "createdAt": 0, "assets": [{"id": "a1", "kind": "video", "file": req["video"]}],
        "results": [],
    }), encoding="utf-8")

    req = dict(req, project=SELFTEST_ID)
    job_id = "selftest"
    real_projects = server.PROJECTS
    server.PROJECTS = tmp_projects
    try:
        server._register_job(job_id, {"state": "running", "done": 0,
                                      "total": len(req["clips"]), "index": 0,
                                      "current": "", "result": [], "error": None})
        started = time.time()
        server._run_render(job_id, req)
        job = server.JOBS[job_id]
        if job["state"] != "done":
            return FAIL, f"render ended {job['state']}: {job.get('error')}"
        produced = out_dir / job["result"][0]["file"]
        data = produced.read_bytes()
        md5, sha256, size = (hashlib.md5(data).hexdigest(),
                             hashlib.sha256(data).hexdigest(), len(data))
        took = time.time() - started
    finally:
        server.PROJECTS = real_projects
        server.JOBS.pop(job_id, None)
        shutil.rmtree(tmp_projects, ignore_errors=True)
        shutil.rmtree(out_dir, ignore_errors=True)

    if (md5, sha256, size) != (baseline["md5"], baseline["sha256"], baseline["bytes"]):
        return FAIL, (f"output differs from the baseline\n"
                      f"      expected {baseline['md5']} ({baseline['bytes']} bytes)\n"
                      f"      got      {md5} ({size} bytes)")
    return PASS, f"{md5[:8]}... ({size} bytes) in {took:.0f}s"


CHECKS = {"migrate": check_migrate, "render": check_render}


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
    p = sub.add_parser("selftest", help="check migration and the baseline render")
    p.add_argument("--only", nargs="+", choices=sorted(CHECKS),
                   help="run just these checks")
    p.add_argument("--write-expected", action="store_true",
                   help="rewrite the migrate fixtures' *.new.json from the current code")
    p.set_defaults(func=lambda a: run(a.only, a.write_expected))
