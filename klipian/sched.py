"""One small scheduler for the heavy jobs of ALL tabs and profiles of this computer.

Two groups, each with a number of slots:
    "ai"      transcription (Whisper), speaker analysis (diarize) and, when it runs here, AI Framing: ONE at a time
    "render"  renders (a single one, or ONE ITEM of a batch): `renderJobs` at a time, 1 by default, 1 or 2
Downloads (yt-dlp) and uploads are network-bound and never come through here.

Waiting jobs are served in turn, round-robin by profile: of those waiting, the one whose profile was served
longest ago goes first, and inside one profile it is first come first served. So one tab's 10-clip batch (a
slot per ITEM) does not starve the other profile; with a single profile it is plain FIFO. A running job is
never pre-empted. A waiting job can be cancelled (its `cancelled()` becomes true and `poke()` is called) and
leaves the queue at once.

One lock and one condition variable; no sleeps beyond the condition's own timeout. The `update` callback of a
waiting job is called (by that job's own thread) with {"text", "position", "waitingFor"} each time something
changes, and with None once it is granted its slot.
"""

from __future__ import annotations

import contextlib
import json
import threading
from dataclasses import dataclass, field
from typing import Callable

from . import paths

GROUP_AI = "ai"
GROUP_RENDER = "render"
RENDER_JOBS_DEFAULT, RENDER_JOBS_MAX = 1, 2

_KIND_LABEL = {"transcribe": "a transcription", "diarize": "a speaker analysis", "framing": "an AI Framing analysis",
               "render": "a render"}

_cv = threading.Condition()
_running: dict[str, list["Ticket"]] = {GROUP_AI: [], GROUP_RENDER: []}
_waiting: dict[str, list["Ticket"]] = {GROUP_AI: [], GROUP_RENDER: []}
_last_grant: dict[str, int] = {}                        # profile -> tick of its latest grant
_tick = 0
_seq = 0


@dataclass(eq=False)
class Ticket:
    group: str
    kind: str
    job_id: str
    profile: str
    profile_name: str
    seq: int
    cancelled: Callable[[], bool] = field(default=lambda: False)


# --------------------------------------------------------------------------
# the setting: how many renders at once (global to this computer, not per profile)
# --------------------------------------------------------------------------

def _settings_file():
    return paths.workspace_dir() / "machine.json"


def render_limit() -> int:
    try:
        n = int(json.loads(_settings_file().read_text(encoding="utf-8")).get("renderJobs", RENDER_JOBS_DEFAULT))
    except (OSError, ValueError, TypeError, AttributeError):
        n = RENDER_JOBS_DEFAULT
    return min(RENDER_JOBS_MAX, max(1, n))


def set_render_limit(n) -> int:
    """Save how many renders may run at once (1 or 2) and wake the waiting ones: a higher number frees slots now."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        raise ValueError("renderJobs must be 1 or 2.") from None
    if not 1 <= n <= RENDER_JOBS_MAX:
        raise ValueError("renderJobs must be 1 or 2.")
    f = _settings_file()
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
        data = data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        data = {}
    data["renderJobs"] = n
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(f)
    poke()
    return n


def _capacity(group: str) -> int:
    return render_limit() if group == GROUP_RENDER else 1


# --------------------------------------------------------------------------
# the queue
# --------------------------------------------------------------------------

def _live(group: str) -> list[Ticket]:
    return [w for w in _waiting[group] if not w.cancelled()]


def _order(group: str) -> list[Ticket]:
    """The waiting tickets in the order they will be served (round-robin by profile, FIFO inside one)."""
    waiting, grants, tick, out = _live(group), dict(_last_grant), _tick, []
    while waiting:
        nxt = min(waiting, key=lambda w: (grants.get(w.profile, 0), w.seq))
        out.append(nxt)
        waiting.remove(nxt)
        tick += 1
        grants[nxt.profile] = tick
    return out


def _info(t: Ticket) -> dict:
    order = _order(t.group)
    pos = order.index(t) + 1 if t in order else 1
    ahead = _running[t.group] + [w for w in order if w is not t][: pos - 1]
    other = ahead[0] if ahead else None
    if other is not None:
        who = f" ({other.profile_name})" if other.profile != t.profile else ""
        waiting_for = _KIND_LABEL.get(other.kind, "another job") + who
    else:
        waiting_for = "another job"
    return {"text": f"Waiting for {waiting_for} · position {pos}", "position": pos, "waitingFor": waiting_for}


def _profile_name(pid: str) -> str:
    try:
        from . import profiles
        meta = profiles.read_meta(pid)
        return (meta or {}).get("name") or pid
    except Exception:                                  # noqa: BLE001
        return pid


def acquire(group: str, kind: str, job_id: str, cancelled: Callable[[], bool] = lambda: False,
            update: Callable[[dict | None], None] | None = None) -> Ticket | None:
    """Wait for a slot of `group`. Returns the ticket (give it to release()), or None when the job was
    cancelled while it waited."""
    global _seq, _tick
    pid = paths.current_profile()
    name = _profile_name(pid)
    with _cv:
        _seq += 1
        t = Ticket(group, kind, job_id, pid, name, _seq, cancelled)
        _waiting[group].append(t)
        _cv.notify_all()                               # the others' positions changed
        shown = False
        try:
            while True:
                if cancelled():
                    return None
                order = _order(group)
                if order and order[0] is t and len(_running[group]) < _capacity(group):
                    _waiting[group].remove(t)
                    _running[group].append(t)
                    _tick += 1
                    _last_grant[pid] = _tick
                    if shown and update:
                        update(None)
                    _cv.notify_all()
                    return t
                if update:
                    update(_info(t))
                    shown = True
                _cv.wait(1.0)
        finally:
            if t in _waiting[group]:                   # cancelled: leave the queue, let the others re-count
                _waiting[group].remove(t)
                if shown and update:
                    update(None)
                _cv.notify_all()


def release(t: Ticket) -> None:
    with _cv:
        if t in _running[t.group]:
            _running[t.group].remove(t)
        _cv.notify_all()


def poke() -> None:
    """Something a waiting job looks at changed (it was cancelled, the limit moved): everyone re-checks."""
    with _cv:
        _cv.notify_all()


@contextlib.contextmanager
def slot(group: str, kind: str, job_id: str, cancelled: Callable[[], bool] = lambda: False,
         update: Callable[[dict | None], None] | None = None):
    """`with slot(...) as ticket:` ticket is None when the job was cancelled while waiting (do not run)."""
    t = acquire(group, kind, job_id, cancelled, update)
    try:
        yield t
    finally:
        if t is not None:
            release(t)


def reset_for_tests() -> None:
    """Forget every running and waiting ticket and the turn history. Only the selftest calls this, so one check never
    inherits what another left behind; a waiter that is still blocked in acquire() would simply be re-evaluated."""
    global _tick, _seq
    with _cv:
        for g in _running:
            _running[g].clear()
            _waiting[g].clear()
        _last_grant.clear()
        _tick = _seq = 0
        _cv.notify_all()


def snapshot() -> dict:
    """What is running and waiting, for tests and the settings page."""
    with _cv:
        def row(t):
            return {"job": t.job_id, "kind": t.kind, "profile": t.profile}
        return {g: {"running": [row(t) for t in _running[g]], "waiting": [row(t) for t in _order(g)]} for g in _running}
