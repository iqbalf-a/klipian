"""Real progress and time left of a render (what ffmpeg reports, turned into a percent and an ETA).

Three small pieces, all pure (no clock of their own unless given one) so the selftest can drive them:
    parse_progress_line   one line of `ffmpeg -progress pipe:1` -> output seconds done, or None
    Eta                   time left: from the profile's usual speed at first, then from the real pace, smoothed
    JobProgress           the percent of a job (one or several clips) split by stage weight, throttled

The weights of a clip, in percent: preparing 2 (caption file, probing), then the encode; with a second pass
(timeline elements or volumes, compose.py) the encode gets 60 % of what is left and the second pass 40 %; a clip
made of several videos spends 4 of its encode share joining the pieces. Never more than 99 until the job is
really finished (the caller sets 100 when the file is final).
"""

from __future__ import annotations

import re
import time
from typing import Callable

PREPARE = 2.0
PASS2_SHARE = 0.40              # of what is left after preparing: the compose pass. Measured 2026-10-22 on a 30 s
                                # 1080p clip with a text label, 4 runs: the second pass was 40 % (16:9 blur) to
                                # 43-54 % (9:16) of the wall time, since it re-encodes the whole clip. 85/15 was the
                                # first guess and left the bar stuck at 85 % for most of the render.
JOIN = 4.0                      # joining the pieces of a multi-video clip
CAP = 99
MIN_INTERVAL = 0.25             # about 4 updates a second
EARLY_FRACTION, EARLY_SECONDS = 0.05, 3.0
HIDE_BELOW = 3.0                # a time left under this many seconds is not shown
SMOOTHING = 0.3                 # weight of the newest estimate in the moving average

_TIME = re.compile(r"^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)$")


def parse_progress_line(line: str) -> float | None:
    """Output seconds done from one `-progress` line (`out_time_us=`, the older `out_time_ms=` which is also in
    microseconds, or `out_time=HH:MM:SS.ffffff`); None for any other line, and for N/A or negative values."""
    line = line.strip()
    for key in ("out_time_us=", "out_time_ms="):
        if line.startswith(key):
            try:
                us = int(line[len(key):])
            except ValueError:
                return None
            return us / 1_000_000 if us >= 0 else None
    m = _TIME.match(line)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return None


class Eta:
    """Time left. Before there is a real pace (under 5 % or 3 s) it is the initial estimate (the profile's usual
    seconds per output second × the length), if there is one; after that elapsed / fraction - elapsed, smoothed
    with an exponential moving average so it does not jump. None when unknown or under 3 seconds."""

    def __init__(self, initial_total: float | None = None):
        self.initial = initial_total
        self.value: float | None = None

    def update(self, elapsed: float, fraction: float) -> float | None:
        fraction = max(0.0, min(1.0, fraction))
        if fraction < EARLY_FRACTION and elapsed < EARLY_SECONDS:
            raw = self.initial * (1 - fraction) if self.initial else None
        else:
            raw = elapsed / fraction - elapsed if fraction > 0 else None
        if raw is None:
            return None if self.value is None else self._shown()
        raw = max(0.0, raw)
        self.value = raw if self.value is None else self.value * (1 - SMOOTHING) + raw * SMOOTHING
        return self._shown()

    def _shown(self) -> float | None:
        return None if self.value is None or self.value < HIDE_BELOW else self.value


class JobProgress:
    """The percent / stage / ETA of a render job with `clip_durations` (output seconds per clip). The overall
    fraction weighs each clip by its length. `publish({"percent", "stage", "eta"})` is called at most about 4 times a
    second, and at once when the stage changes."""

    def __init__(self, clip_durations: list[float], ratio: float | None, publish: Callable[[dict], None],
                 clock: Callable[[], float] = time.monotonic, interval: float = MIN_INTERVAL):
        self.d = [max(0.0, float(x)) for x in clip_durations]
        self.total = sum(self.d) or 1.0
        self.publish, self.clock, self.interval = publish, clock, interval
        self.t0 = clock()
        self.eta = Eta(ratio * self.total if ratio else None)
        self.i = 0
        self.stages: list[dict] = []
        self.cur = 0
        self.frac = 0.0
        self.finishing = False
        self._last = -1e9

    # --- a clip's stages -------------------------------------------------
    def begin_clip(self, i: int, runs: list[float], pass2: bool) -> None:
        """`runs`: output seconds of each piece (one per source video run); `pass2`: a compose pass follows."""
        self.i = i
        rest = 100.0 - PREPARE
        over = rest * PASS2_SHARE if pass2 else 0.0
        join = JOIN if len(runs) > 1 else 0.0
        enc = rest - over - join
        total_runs = sum(runs) or 1.0
        stages = [{"label": "preparing…", "w": PREPARE, "dur": 0.0}]
        for n, r in enumerate(runs):
            stages.append({"label": f"part {n + 1} of {len(runs)}" if len(runs) > 1 else "", "w": enc * r / total_runs, "dur": r})
        if join:
            stages.append({"label": "joining…", "w": join, "dur": 0.0})
        if pass2:
            stages.append({"label": "overlays…", "w": over, "dur": sum(runs)})
        self.stages, self.cur, self.frac, self.finishing = stages, 0, 0.0, False
        self._emit(force=True)

    def advance(self) -> None:
        """The current stage is done; the next one starts."""
        if self.cur < len(self.stages) - 1:
            self.cur += 1
        self.frac = 0.0
        self._emit(force=True)

    def tick(self, out_seconds: float) -> None:
        """ffmpeg says `out_seconds` of the current stage's output are written."""
        dur = self.stages[self.cur]["dur"] if self.stages else 0.0
        if dur > 0:
            self.frac = max(self.frac, min(1.0, out_seconds / dur))
            self._emit()

    def finish_clip(self) -> None:
        self.cur, self.frac, self.finishing = len(self.stages) - 1, 1.0, True
        self._emit(force=True)

    # --- what is shown -----------------------------------------------------
    def fraction(self) -> float:
        done = sum(self.d[: self.i])
        clip = 0.0
        if self.stages:
            clip = (sum(s["w"] for s in self.stages[: self.cur]) + self.stages[self.cur]["w"] * self.frac) / 100.0
        return (done + clip * (self.d[self.i] if self.i < len(self.d) else 0.0)) / self.total

    def snapshot(self) -> dict:
        f = self.fraction()
        stage = "finishing…" if self.finishing and self.i >= len(self.d) - 1 else (self.stages[self.cur]["label"] if self.stages else "")
        return {"percent": min(CAP, int(f * 100)), "stage": stage, "eta": self.eta.update(self.clock() - self.t0, f)}

    def _emit(self, force: bool = False) -> None:
        now = self.clock()
        if not force and now - self._last < self.interval:
            return
        self._last = now
        self.publish(self.snapshot())


def batch_eta(running_eta: float | None, running_left: float, queued_durations: list[float], ratio: float | None) -> float | None:
    """Total time left of a batch: what the running clip still needs (its own ETA, else its length left × the usual
    speed) plus every queued clip's length × the usual speed. None when nothing can be said."""
    if ratio is None and running_eta is None and queued_durations:
        return None
    first = running_eta if running_eta is not None else (running_left * ratio if ratio else 0.0)
    return first + (sum(queued_durations) * ratio if ratio else 0.0)
