"""Shared pieces of the selftest: paths, the PASS/FAIL words and two small helpers."""

from __future__ import annotations


import json
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
