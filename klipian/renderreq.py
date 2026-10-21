"""The render request of a saved Result, built on the server (P23).

The editor used to put this request together in the browser, from the Result that happened to be open
(ui/js/editor/player.js sendRender and the files it reads: framing.js spansWithFraming, assets.js
serverClipFields, captions.js wordsForRender, result.js resultAsClip, compose.js overlaysForRender and
segmentVolumes, app.js captionStyle and optionOut). Rendering many Results, or rendering without the page,
needs the same request from the saved project, so the rules are written here once, in the same order and
with the same arithmetic (floats rounded the way JavaScript rounds them), and `selftest` / the proof in
docs/roadmap.md P23 check that this builds the request the browser stored for every Result.

What is read:
  * the project document: `assets` (the videos), `caption` (the project-wide caption style, by option id),
    `results` (each with segments, framing, corrections, output, title, post, overlays);
  * the transcript of every video (cache), for the caption words;
  * the size of each source video (ffprobe), because a framing box is matched to the shape of the picture.

Nothing here writes anything.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable

ASSET_STRIDE = 1e6          # assets.js: each video has its own stretch of one long virtual timeline
CLIP_EDGE = 0.05            # framing.js: how far before a Result's start a framing point still counts

# app.js CAPTION_OPTIONS: id -> (kind, choices' `out` values or (min, max), default)
_CAPTION = {
    "font": ("choice", ["Arial", "Impact", "Verdana"], 0),
    "size": ("range", (32, 160), 84),
    "highlight": ("choice", ["&H0000D6FF&", "&H00FFFFFF&", "&H0076E600&", "&H004040FF&"], 0),
    "highlight-style": ("choice", ["text", "box"], 0),
    "position": ("range", (2, 90), 24),
    "x": ("range", (-25, 25), 0),
    "per-line": ("choice", [2, 3, 4], 1),
    "reveal": ("choice", ["spoken", "line"], 0),
    "outline": ("choice", [0, 4, 8], 1),
    "watermark": ("choice", [True, False], 0),
    "watermark-size": ("range", (10, 90), 32),
    "watermark-opacity": ("choice", ["D8", "C0", "A0", "80", "40"], 2),
    "watermark-y": ("range", (2, 90), 18),
    "watermark-x": ("range", (-25, 25), 0),
}
# captionStyle(): the request's key for each option, in the order the browser writes them
_STYLE_KEYS = [("font", "font"), ("size", "size"), ("highlight", "highlight"), ("highlight-style", "highlight_style"),
               ("position", "position"), ("x", "x"), ("per-line", "per_line"), ("reveal", "reveal"),
               ("outline", "outline"), ("watermark", "watermark"), ("watermark-size", "watermark_size"),
               ("watermark-opacity", "watermark_opacity"), ("watermark-y", "watermark_y"),
               ("watermark-x", "watermark_x")]

# app.js OPTIONS, in SAVED order (a Result's `output` has one entry for each, in this order)
_OUT_PICTURE = ["9:16", "16:9", "3:4"]
_OUT_RESOLUTION = [720, 1080, 1440, 2160]
_OUT_QUALITY = [26, 21, 17]
_OUT_BACKGROUND = ["blur", "black"]
_OUTPUT_ORDER = ["picture", "resolution", "quality", "background", "position"]

INITIAL_CROP = {"left": 37, "top": 8, "width": 26, "height": 84}        # framing.js
INITIAL_CROP_34 = {"left": 30, "top": 4, "width": 39, "height": 92}


class RequestError(Exception):
    """A Result that cannot be rendered, with a sentence for the person."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def _js_round(x: float) -> int:
    """Math.round: halves go up (Python's round() goes to even)."""
    return math.floor(x + 0.5)


def _asset_num(asset_id) -> int:
    try:
        n = int(str(asset_id or "")[1:])
    except ValueError:
        return 1
    return n if n > 0 else 1


def _offset(asset_id) -> float:
    return (_asset_num(asset_id) - 1) * ASSET_STRIDE


def _asset_id_at(vt: float) -> str:
    return f"a{math.floor(max(0, vt) / ASSET_STRIDE) + 1}"


def _unshift(vt: float, off: float):
    """assets.js unshift: the first video's seconds pass through untouched, the others lose their offset
    and are rounded to the microsecond."""
    return _js_round((vt - off) * 1e6) / 1e6 if off else vt


def _round2(n: float) -> float:
    return _js_round(n * 100) / 100


def _round3(n: float) -> float:
    return _js_round(n * 1000) / 1000


def _to_fixed3(x: float) -> str:
    return f"{x:.3f}"


# --------------------------------------------------------------------------
# options
# --------------------------------------------------------------------------

def caption_style(saved) -> dict:
    """app.js captionStyle(): the project's caption options (by id; a missing one is the default)."""
    state = saved if isinstance(saved, dict) else {}
    out = {}
    values = {}
    for oid, (kind, spec, default) in _CAPTION.items():
        raw = state.get(oid)
        if kind == "range":
            lo, hi = spec
            ok = isinstance(raw, (int, float)) and not isinstance(raw, bool) and math.isfinite(raw)
            values[oid] = min(hi, max(lo, raw)) if ok else default
        else:
            ok = isinstance(raw, int) and not isinstance(raw, bool) and 0 <= raw < len(spec)
            values[oid] = spec[raw] if ok else spec[default]
    for oid, key in _STYLE_KEYS:
        out[key] = values[oid]
    return out


def output_options(saved) -> dict:
    """app.js applyOutput() + optionOut(): picture, background, position, width, quality of one Result."""
    lst = saved if isinstance(saved, list) else []

    def entry(k):
        return lst[k] if k < len(lst) else None

    def index(k, count, default):
        raw = entry(k)
        return raw if (isinstance(raw, int) and not isinstance(raw, bool) and 0 <= raw < count) else default

    picture = index(0, len(_OUT_PICTURE), 0)
    resolution = index(1, len(_OUT_RESOLUTION), 1)
    quality = index(2, len(_OUT_QUALITY), 1)
    raw_bg = entry(3)
    bg_valid = isinstance(raw_bg, int) and not isinstance(raw_bg, bool) and 0 <= raw_bg < len(_OUT_BACKGROUND)
    background = raw_bg if bg_valid else 1                      # not chosen: Black (the fallback)
    # a Result from before Background existed whose picture is the second one ("Blur background") was
    # always rendered on a blurred copy: that is a real choice that was never written down
    if lst and lst[0] == 1 and len(lst) <= 3:
        background = 0
    raw_pos = entry(4)
    position = (min(100, max(0, raw_pos)) if isinstance(raw_pos, (int, float)) and not isinstance(raw_pos, bool)
                and math.isfinite(raw_pos) else 50)
    return {"picture": _OUT_PICTURE[picture], "background": _OUT_BACKGROUND[background], "position": position,
            "width": _OUT_RESOLUTION[resolution], "quality": _OUT_QUALITY[quality]}


# --------------------------------------------------------------------------
# framing (framing.js)
# --------------------------------------------------------------------------

def _initial_crop(picture: str) -> dict:
    return dict(INITIAL_CROP_34 if picture == "3:4" else INITIAL_CROP)


def _ratio_for(fmt: str, picture: str) -> float:
    if fmt == "split":
        return 8 / 9
    return 4 / 3 if picture == "3:4" else 16 / 9


def _match_ratio(crop: dict, fmt: str, picture: str, base_ratio: float) -> dict:
    """framing.js matchRatio: the box's height follows its width and the real shape of the source."""
    width = crop["width"]
    ratio = _ratio_for(fmt, picture)
    height = width * base_ratio * ratio
    if crop["top"] + height > 100:
        height = 100 - crop["top"]
        width = height / (base_ratio * ratio)
    return {**crop, "width": width, "height": height}


def _interpolate_path(keyframes, t):
    if not keyframes:
        return None
    if t <= keyframes[0]["t"]:
        return keyframes[0]["left"]
    last = keyframes[-1]
    if t >= last["t"]:
        return last["left"]
    for i in range(1, len(keyframes)):
        if t <= keyframes[i]["t"]:
            a, b = keyframes[i - 1], keyframes[i]
            span = b["t"] - a["t"]
            frac = (t - a["t"]) / (span if span else 1)
            return a["left"] + (b["left"] - a["left"]) * frac
    return last["left"]


class _Framing:
    """The framing points of one Result on the virtual timeline, and the questions framing.js asks of them."""

    def __init__(self, stored: list, result: list[dict], picture: str, ratio_of_virtual: Callable[[float], float]):
        self.result = result
        self.picture = picture
        self.ratio = ratio_of_virtual
        points = []
        for f in stored or []:
            if not isinstance(f, dict):
                continue
            g = {k: v for k, v in f.items() if k != "asset"}
            g["at"] = f["at"] + _offset(f.get("asset") or "a1")
            points.append(g)
        points.sort(key=lambda p: p["at"])
        if not points:
            points = [{"id": "f1", "at": 0, "format": "single", "crops": [_initial_crop(picture)], "auto": True}]
        self.points = points
        self._ensure_start_point()

    def _in_clip(self, f) -> bool:
        return not self.result or any(f["at"] >= r["start"] - CLIP_EDGE and f["at"] < r["end"] for r in self.result)

    def used(self):
        return [f for f in self.points if self._in_clip(f)]

    def _ensure_start_point(self) -> None:
        """framing.js ensureStartPoint: a point exactly at the start of the clip."""
        if not self.result:
            return
        s = self.result[0]["start"]
        placeholder = next((f for f in self.points if f.get("auto")), None)
        taken = any(f is not placeholder and abs(f["at"] - s) < CLIP_EDGE for f in self.points)
        changed = False
        if placeholder and taken:
            self.points = [f for f in self.points if f is not placeholder]
            changed = True
        elif placeholder:
            if placeholder["at"] != s:
                placeholder["at"] = s
                changed = True
        elif not taken:
            self.points.append({"id": f"f{len(self.points) + 1}", "at": s, "format": "single",
                                "crops": [_initial_crop(self.picture)], "auto": True})
            changed = True
        if changed:
            self.points.sort(key=lambda p: p["at"])

    def point_at(self, seconds):
        points = self.used()
        result = points[0] if points else None
        for f in points:
            if f["at"] <= seconds + 0.001:
                result = f
            else:
                break
        return result

    def frame_at(self, seconds):
        f = self.point_at(seconds)
        fmt = "split" if (f and f.get("format") == "split" and self.picture == "9:16") else "single"
        crops = f["crops"] if f else [_initial_crop(self.picture)]
        tracking = (f or {}).get("tracking")
        if tracking and len(tracking.get("keyframes") or []) >= 2 and fmt == "single":
            left = _interpolate_path(tracking["keyframes"], seconds - f["at"])
            if left is not None:
                crops = [{**crops[0], "left": left}]
        base = self.ratio(seconds)
        return fmt, [_match_ratio(c, fmt, self.picture, base) for c in crops]

    def spans(self, ranges: list[dict]) -> list[dict]:
        """framing.js spansWithFraming: each range split at the framing points, each piece with its box."""
        out = []
        for r in ranges:
            bounds = [r["start"]]
            for f in self.used():
                if f["at"] > r["start"] + 0.05 and f["at"] < r["end"] - 0.05:
                    bounds.append(f["at"])
            bounds.append(r["end"])
            for i in range(len(bounds) - 1):
                fmt, crops = self.frame_at(bounds[i])
                piece = {"start": bounds[i], "end": bounds[i + 1]}
                if fmt == "split" and len(crops) >= 2:
                    piece["crops"] = crops
                else:
                    piece["crop"] = crops[0]
                point = self.point_at(bounds[i])
                kf = ((point or {}).get("tracking") or {}).get("keyframes") or []
                if fmt == "single" and len(kf) >= 2:
                    shifted = [{"t": _round3(k["t"] - (bounds[i] - point["at"])), "left": k["left"]} for k in kf]
                    shifted = [k for k in shifted if k["t"] >= 0]
                    if len(shifted) >= 2:
                        piece["tracking"] = shifted
                out.append(piece)
        return out


# --------------------------------------------------------------------------
# one Result -> one request
# --------------------------------------------------------------------------

def _default_title(segments: list[dict]) -> str:
    if not segments:
        return ""
    return segments[0].get("title") or "" if len(segments) == 1 else f"{segments[0].get('title') or ''} +{len(segments) - 1}"


def build_request(project: dict, result_id: str, *,
                  words_of: Callable[[str], list[dict] | None],
                  size_of: Callable[[str], tuple[int, int] | None]) -> dict:
    """The request the editor would send for this Result of this saved project.

    `words_of(file)` -> the transcript's words of that video (dicts with text/start/end), or None.
    `size_of(file)` -> (width, height) of that video, or None when it cannot be read.
    Raises RequestError for a Result that cannot be rendered."""
    results = project.get("results") or []
    entry = next((r for r in results if isinstance(r, dict) and r.get("id") == result_id), None)
    if entry is None:
        raise RequestError("no_result", "That Result is not in the project.")
    assets = [a for a in (project.get("assets") or []) if isinstance(a, dict) and a.get("id") and a.get("file")]
    files = {a["id"]: a["file"] for a in assets}
    video_ids = [a["id"] for a in assets if (a.get("kind") or "video") == "video"]

    stored = entry.get("segments") if isinstance(entry.get("segments"), list) else (
        entry.get("result") if isinstance(entry.get("result"), list) else [])
    segments = []                                    # RESULT: on the virtual timeline
    for s in stored:
        off = _offset(s.get("asset") or "a1")
        seg = {k: v for k, v in s.items() if k != "asset"}
        seg["start"], seg["end"] = s["start"] + off, s["end"] + off
        segments.append(seg)
    if not segments or not all(isinstance(s.get("start"), (int, float)) and isinstance(s.get("end"), (int, float))
                               and math.isfinite(s["start"]) and math.isfinite(s["end"]) for s in segments):
        raise RequestError("no_spans", "This Result has no time points.")

    output = output_options(entry.get("output"))
    picture = output["picture"]

    def real(vt: float):
        aid = _asset_id_at(vt)
        return aid, _unshift(vt, _offset(aid)), files.get(aid, "")

    def ratio_of_virtual(vt: float) -> float:
        # framing.js sourceRatio(): the shape of the video the preview holds (16:9 when there is none)
        size = size_of(real(vt)[2])
        return size[0] / size[1] if size and size[1] else 16 / 9

    framing = _Framing(entry.get("framing"), segments, picture, ratio_of_virtual)
    framed = framing.spans([{"start": s["start"], "end": s["end"]} for s in segments])
    main = real(framed[0]["start"])[2] if framed else ""

    def conv(p: dict) -> dict:
        aid, t, file = real(p["start"])
        out = {**p, "start": t, "end": _unshift(p["end"], _offset(aid))}
        if file and file != main:
            out["video"] = file
        return out

    # the words that make it into the Result, corrections applied (captions.js resultWords)
    corrections = entry.get("corrections") if isinstance(entry.get("corrections"), dict) else {}
    all_words = []
    for aid in (video_ids if len(video_ids) > 1 else (video_ids[:1] or ["a1"])):
        ws = words_of(files.get(aid, "")) or []
        off = _offset(aid)
        all_words += [{**w, "start": w["start"] + off, "end": w["end"] + off} for w in ws] if off else list(ws)
    chosen = []
    for w in all_words:
        if not any(w["start"] >= p["start"] and w["end"] <= p["end"] for p in segments):
            continue
        k = _to_fixed3(w["start"])
        text = corrections[k] if k in corrections else w["text"]
        chosen.append({"text": str(text).strip(), "start": w["start"], "end": w["end"]})
    if not all(segments[i - 1]["start"] <= segments[i]["start"] for i in range(1, len(segments))):
        # the Timeline screen put the spans in another order: the words are listed as they will be heard
        def out_at(w):
            at = 0.0
            for p in segments:
                if p["start"] <= w["start"] <= p["end"]:
                    return at + (w["start"] - p["start"])
                at += p["end"] - p["start"]
            return 0.0
        chosen.sort(key=out_at)

    total = sum(s["end"] - s["start"] for s in segments)
    typed = (entry.get("title") or "").strip()
    clip = {
        "title": typed or _default_title(segments),
        "spans": [conv(p) for p in framed],
        "style": caption_style(project.get("caption")),
        "words": [conv(w) for w in chosen],
        "picture": output["picture"],
        "background": output["background"],
        "position": output["position"],
        "width": output["width"],
        "quality": output["quality"],
    }
    post = entry.get("post")
    if post:
        clip["post"] = post
    overlays = [{**{k: v for k, v in e.items() if k != "id"}, "end": min(e["end"], total)}
                for e in (entry.get("overlays") or []) if isinstance(e, dict) and e.get("start", 0) < total]
    if overlays:
        clip["overlays"] = overlays
    volumes = []
    at = 0.0
    for s in segments:
        length = s["end"] - s["start"]
        vol = s.get("volume")
        if vol is not None and abs(vol - 1) > 1e-6:
            volumes.append({"start": _round2(at), "end": _round2(at + length), "volume": vol})
        at += length
    if volumes:
        clip["volumes"] = volumes
    request = {"video": main or "", "project": project.get("id"), "result": result_id, "clips": [clip]}
    return request


def project_sources(project: dict) -> list[str]:
    """The video files a project's Results may use."""
    return [a["file"] for a in (project.get("assets") or []) if isinstance(a, dict) and a.get("file")
            and (a.get("kind") or "video") == "video"]


def words_from_transcript_json(path: Path) -> list[dict]:
    """What the editor holds as realTranscript.words: every segment's words, in order."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return [w for s in data.get("segments") or [] for w in (s.get("words") or [])]
