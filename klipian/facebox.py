"""Face/person detection for tightening crop boxes -- complement to AI Framing.

Diarization (diarize.py) knows WHEN to change frames. This module answers
the different question: WHERE exactly the box should point -- three methods,
each requiring a different kind of initial position hint:

  - fit_crop_to_face()  -- ONE point, AROUND a known rough box
  - track_crops()       -- ONE RANGE, AROUND a known rough box
  - locate_speaker()    -- ONE RANGE, WITHOUT any rough box at all
    (searching from scratch across nearly the entire frame -- used so AI
    Framing can be fully automatic, without manual confirmation per speaker)

Without fit_crop_to_face/track_crops, every framing point created by AI
Framing is just a RAW copy of a position manually shifted once at the
start of the clip -- if the initial shift was off, or the person moves
slightly in their chair throughout the clip, the result can cut off a
face or point at an empty chair beside them. Both methods RE-CHECK the
actual face position at EVERY point, instead of trusting a single static
coordinate.

All classic OpenCV -- NOT deep learning models, doesn't add to the PyTorch
load already used by diarization, no separate weight downloads from
anywhere:

  1. Haar cascade face detection, FRONTAL + PROFILE (two directions via
     cv2.flip), searched ONLY around the rough box (not the whole frame) --
     limiting the search area alone filters out many false positives without
     needing super tight parameters. Profile is added so speakers whose heads
     are turned (common in two-person face-to-face podcasts) are still
     caught; frontal-only would miss them.
  2. If MORE than one face is found in that area (two people sitting close
     together), the one chosen is NOT the largest but the one whose MOUTH
     IS MOVING -- that's the person currently speaking. Measured from
     inter-frame differences in the mouth region, weighted by Sobel gradient
     so lip/jaw motion stands out above background noise. This idea comes
     from the smart_crop reference; here it's used to pick the RIGHT PERSON,
     not for continuous panning -- klipian still does hard cuts.
  3. If no face is found at all: HOG+SVM person detection (built-in to
     OpenCV, no download) as fallback -- less accurate (trained for
     standing pedestrians, not sitting podcasters), but better than the raw
     rough box if it does find something.
  4. All methods fail -> None, caller falls through to the rough box as-is.

Real-world report before this module was rewritten: searching the ENTIRE
frame with loose parameters occasionally misidentified textures (hair,
fabric patterns) as small "faces", and the resulting box OVERWROTE a
previously correct point -- not just a silent failure. Limiting the search
area to around the rough box was the primary fix; size filters, NMS, and
mouth-motion selection below are the next layers of defense.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

_face_detector = None
_profile_detector = None
_hog_detector = None


def _load_face_detector():
    global _face_detector
    if _face_detector is not None:
        return _face_detector
    import cv2
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    _face_detector = cv2.CascadeClassifier(cascade_path)
    return _face_detector


def _load_profile_detector():
    """Profile face cascade (side-facing). Used in two directions: as-is for
    faces looking one way, then on a flipped frame for the opposite direction
    (OpenCV's profile cascade is only trained for one direction). May not
    exist in certain OpenCV builds -> _detect_faces ignores it if empty."""
    global _profile_detector
    if _profile_detector is not None:
        return _profile_detector
    import cv2
    _profile_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_profileface.xml")
    return _profile_detector


def _load_hog_detector():
    global _hog_detector
    if _hog_detector is not None:
        return _hog_detector
    import cv2
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    _hog_detector = hog
    return _hog_detector


def _nms(boxes: list, iou_thr: float = 0.35) -> list:
    """Discard duplicate detections (frontal & profile often mark the same
    face). The largest area is kept first."""
    if len(boxes) <= 1:
        return boxes
    import numpy as np
    b = np.array(boxes, dtype=float)
    x1, y1 = b[:, 0], b[:, 1]
    x2, y2 = b[:, 0] + b[:, 2], b[:, 1] + b[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = areas.argsort()[::-1]
    keep = []
    while len(order):
        i = order[0]
        keep.append(int(i))
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        order = order[1:][iou < iou_thr]
    return [boxes[k] for k in keep]


def _detect_faces(gray_region, rw: float) -> list[dict]:
    """All faces INSIDE `gray_region` -> list of
    {cx, bbox:(x,y,w,h), mouth:(x,y,w,h)} in REGION coordinates.

    Frontal + profile (two directions). minNeighbors is left at 5 (not
    increased) because the search area is already limited to around the
    rough box -- that area limit itself filters most false positives.
    `mouth` = bottom 30% of face bbox; used for mouth-motion scoring in
    _pick_active_face. Size filtered (>= rw*0.15) same as the old version
    to keep small textures from leaking through."""
    import cv2
    kw = dict(scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    raw: list[tuple] = []

    front = _load_face_detector()
    for (x, y, w, h) in front.detectMultiScale(gray_region, **kw):
        raw.append((int(x), int(y), int(w), int(h)))

    prof = _load_profile_detector()
    if prof is not None and not prof.empty():
        for (x, y, w, h) in prof.detectMultiScale(gray_region, **kw):
            raw.append((int(x), int(y), int(w), int(h)))
        W = gray_region.shape[1]
        flipped = cv2.flip(gray_region, 1)
        for (x, y, w, h) in prof.detectMultiScale(flipped, **kw):
            # Facing the opposite direction: detect on the flipped frame,
            # then mirror the x-coordinate back to original region coords.
            raw.append((W - int(x) - int(w), int(y), int(w), int(h)))

    if not raw:
        return []

    faces = []
    for (x, y, w, h) in _nms(raw):
        if w < rw * 0.15:
            continue
        my = y + int(h * 0.65)
        mh = max(8, int(h * 0.30))
        faces.append({"cx": x + w // 2, "bbox": (x, y, w, h),
                      "mouth": (x, my, w, mh)})
    return faces


def _mouth_motion(gray_curr, gray_prev, mouth: tuple) -> float:
    """How much the mouth region MOVES between two frames. Raw diff is
    weighted by Sobel gradient magnitude: motion at lip/jaw edges is
    amplified, flat background noise is suppressed. x-gradient captures
    jaw shift (profile), y-gradient captures lip open/close (frontal).
    Ported from smart_crop."""
    import cv2
    import numpy as np
    mx, my, mw, mh = mouth
    if mw <= 0 or mh <= 0:
        return 0.0
    c = gray_curr[my:my + mh, mx:mx + mw]
    p = gray_prev[my:my + mh, mx:mx + mw]
    if c.size == 0 or c.shape != p.shape:
        return 0.0
    diff = cv2.absdiff(c, p).astype(np.float32)
    gx = cv2.Sobel(c, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(c, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx * gx + gy * gy)
    mean_grad = float(grad_mag.mean())
    if mean_grad > 1.0:
        weight = np.clip(grad_mag / (mean_grad + 1e-6), 0.5, 2.5)
        return float((diff * weight).mean())
    return float(diff.mean())


def _sharpness(gray, bbox: tuple) -> float:
    import cv2
    x, y, w, h = bbox
    roi = gray[y:y + h, x:x + w]
    if roi.size == 0:
        return 0.0
    return float(cv2.Laplacian(roi, cv2.CV_64F).var())


def _pick_active_face(faces: list[dict], grays: list, ref_idx: int,
                       locked_cx: float | None) -> dict | None:
    """From several faces in a region, pick the one CURRENTLY SPEAKING.

    Priority: clear mouth-motion winner -> face nearest to the tracked
    position (continuity) -> sharpest face (only if nothing is tracked yet).
    `grays` = several consecutive region frames; mouth motion is summed
    across pairs so a mouth phase (coincidentally closed in one frame)
    doesn't mislead. Logic ported from smart_crop.pick_speaker_cx, but
    returns the FACE (need bbox for centering the box), not just cx."""
    if not faces:
        return None
    if len(faces) == 1:
        return faces[0]

    if len(grays) >= 2:
        scored = []
        for f in faces:
            total, pairs = 0.0, 0
            for i in range(1, len(grays)):
                if grays[i].shape == grays[i - 1].shape:
                    total += _mouth_motion(grays[i], grays[i - 1], f["mouth"])
                    pairs += 1
            scored.append((f, total / pairs if pairs else 0.0))
        best, best_score = max(scored, key=lambda t: t[1])
        rest_avg = (sum(s for _, s in scored) - best_score) / (len(scored) - 1)
        # Threshold same as smart_crop: the winner must be clear (>1.0) AND
        # far above the average of the rest (2x), otherwise treat as ambiguous.
        if best_score > 1.0 and best_score > rest_avg * 2.0:
            return best

    # Ambiguous motion signal (two people both still or both moving):
    # fall back to the face nearest the tracked position, don't guess.
    # This was also the old facebox's intent -- "face nearest the rough box"
    # -- just now mouth-motion gets first chance before falling here.
    if locked_cx is not None:
        return min(faces, key=lambda f: abs(f["cx"] - locked_cx))

    return max(faces, key=lambda f: _sharpness(grays[ref_idx], f["bbox"]))


def _region_rect(rough: dict, W: int, H: int, pad: float = 0.4) -> tuple:
    """Rough box (percent) -> pixel search rect (sx,sy,ex,ey), EXTENDED by
    `pad` on each side. Manual shifts can be slightly off from the actual
    face (which is exactly why this feature exists), so extra room ensures
    faces slightly outside the rough box are still reached."""
    rx = (rough.get("left", 0) / 100) * W
    ry = (rough.get("top", 0) / 100) * H
    rw = (rough.get("width", 100) / 100) * W
    rh = (rough.get("height", 100) / 100) * H
    pad_x, pad_y = rw * pad, rh * pad
    sx = int(max(0, rx - pad_x))
    sy = int(max(0, ry - pad_y))
    ex = int(min(W, rx + rw + pad_x))
    ey = int(min(H, ry + rh + pad_y))
    return sx, sy, ex, ey, rw, rh


def _detect_person(bgr_region) -> tuple | None:
    """Fallback when no face is found -- HOG+SVM person/body detection.
    Trained for standing full-body pedestrians, so for sitting podcasters
    the results are rough (usually wider than the actual body) -- but still
    better than a static rough box that may have drifted off the person."""
    hog = _load_hog_detector()
    rects, weights = hog.detectMultiScale(bgr_region, winStride=(8, 8))
    if len(rects) == 0:
        return None
    idx = max(range(len(rects)), key=lambda i: float(weights[i]))
    return tuple(rects[idx])


def _extract_frames(video: Path, at: float, tmp: str,
                    span: float = 0.4, fps: int = 10) -> list:
    """Grab several BGR frames around `at` (need >=2 for mouth-motion diff).
    Single ffmpeg call with fps filter, not multiple -ss, so the process
    spawn cost stays at one like the old version that only grabbed 1 frame.
    Return list of (t_relative_to_video, img_bgr) sorted by time."""
    import cv2

    from .ffmpeg_tools import _require, run

    t0 = max(0.0, at - span / 2)
    run([
        _require("ffmpeg"), "-y", "-loglevel", "error",
        "-ss", f"{t0:.3f}", "-i", str(video),
        "-t", f"{span:.3f}", "-vf", f"fps={fps}",
        str(Path(tmp) / "f_%03d.jpg"),
    ], desc="extracting frames for face detection")

    frames = []
    for i, p in enumerate(sorted(Path(tmp).glob("f_*.jpg"))):
        img = cv2.imread(str(p))
        if img is not None:
            frames.append((t0 + i / fps, img))
    return frames


def _place_box(fcx: float, fcy: float, width: float, height: float,
               W: int, H: int) -> dict:
    """Face center (pixels) + rough box size (pixels) -> crop box in
    PERCENT of frame, clamped to stay within the frame. Size is EXACTLY
    the same as the rough box -- detection only shifts the POSITION, it
    doesn't determine zoom (that's the user's decision via their rough box)."""
    left = max(0, min(W - width, fcx - width / 2))
    top = max(0, min(H - height, fcy - height / 2))
    # Explicit float(): OpenCV returns np.float64/np.int32, and the built-in
    # json module doesn't know how to serialize numpy types -> the endpoint
    # crashes with "Object of type float64 is not JSON serializable" without this.
    return {
        "left": round(float(left) / W * 100, 2),
        "top": round(float(top) / H * 100, 2),
        "width": round(float(width) / W * 100, 2),
        "height": round(float(height) / H * 100, 2),
    }


def fit_crop_to_face(video: Path, at: float, rough: dict) -> dict | None:
    """Find the MOST ACTIVE face (or, failing that, the person's body)
    AROUND the ROUGH box `rough` ({left,top,width,height} percent), return
    a new box centered on it -- also percent, aspect ratio NOT yet locked
    (the client locks its own ratio via samakanRasio). None if everything
    fails."""
    import cv2

    from .ffmpeg_tools import probe

    info = probe(video)
    W, H = info.width, info.height
    if not W or not H:
        return None

    with tempfile.TemporaryDirectory(prefix="klipian-face-") as tmp:
        frames = _extract_frames(video, at, tmp)
        if not frames:
            return None

        sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H)
        if ex <= sx or ey <= sy:
            return None

        # Reference frame = the one closest to `at`; detection runs there,
        # other frames are only used for measuring mouth motion.
        ref_idx = min(range(len(frames)), key=lambda i: abs(frames[i][0] - at))
        grays = [cv2.cvtColor(img[sy:ey, sx:ex], cv2.COLOR_BGR2GRAY)
                 for _, img in frames]

        faces = _detect_faces(grays[ref_idx], rw)
        chosen = _pick_active_face(faces, grays, ref_idx,
                                   locked_cx=(rw / 2))  # region center ~ rough box center
        if chosen is not None:
            fx, fy, fw, fh = chosen["bbox"]
        else:
            found = _detect_person(frames[ref_idx][1][sy:ey, sx:ex])
            if found is None:
                return None
            fx, fy, fw, fh = found

        # REGION -> WHOLE FRAME, then find the center point.
        fcx = fx + sx + fw / 2
        fcy = fy + sy + fh / 2
        return _place_box(fcx, fcy, rw, rh, W, H)


# ══════════════════════════════ tracking ══════════════════════════════
# fit_crop_to_face answers ONE point. track_crops also answers ONE
# point -- but is more noise-resistant, because its position is the
# MEDIAN of MANY samples across [start, end), not just a single frame.
#
# Previously this function could also emit EXTRA points whenever the
# subject shifted far enough (deadzone) and held long enough (min_chunk) --
# the intent was to follow someone who moves seats during a long turn.
# In practice, speakers naturally move (turn, lean forward) WITHOUT the
# source video itself changing shots or speakers -- and since klipian does
# HARD cuts (not continuous panning, see the style note above), these
# extra points from normal movement looked like framing errors in
# preview/render, not helpful corrections (real report from ian: "the
# target is still the same person... it should just stay still").
#
# The ONLY valid reason for a new framing point now comes from the
# CALLER (aiFramingTerapkan in framing.js): a speaking turn changes, or
# the source video itself changes shots (klipian/scenecut.py). This
# function no longer guesses when to split on its own -- just one position
# representing the ENTIRE given range.


def track_crops(video: Path, start: float, end: float, rough: dict,
                fps: int = 3) -> list[dict]:
    """Active face position representing the ENTIRE [start, end) -> one
    {at: start, crop}. Derived from the MEDIAN position across many samples
    (not just one frame) -- median is resistant to momentary outliers
    (head turned fully for a second, face misdetected once), unlike the
    mean which can be pulled far off by a single odd sample.

    If no face is found throughout the range, return the rough box as-is
    (caller falls through to it, same behavior as fit_crop_to_face
    returning None)."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return [{"at": start, "crop": dict(rough)}]

    # Tracking region is wider than fit_crop_to_face's (0.6): within one
    # turn a person can shift in their chair further than a single manual
    # adjustment, and we want to keep chasing them, not lose them at the edge.
    sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H, pad=0.6)
    if ex <= sx or ey <= sy:
        return [{"at": start, "crop": dict(rough)}]

    with tempfile.TemporaryDirectory(prefix="klipian-track-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "t_%04d.jpg"),
        ], desc="extracting frames for face tracking")

        files = sorted(Path(tmp).glob("t_*.jpg"))
        if not files:
            return [{"at": start, "crop": dict(rough)}]

        # Active subject's center-x per sample (FRAME pixels), None if no
        # face in that frame. prev_gray rolls so mouth motion can be
        # measured without storing all frames at once.
        cx_list: list[float] = []
        prev_gray = None
        locked_cx = rw / 2          # region-coord; ~ rough box center at start
        for p in files:
            img = cv2.imread(str(p))
            if img is None:
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]                       # region-coord
                fx, fy, fw, fh = chosen["bbox"]
                cx_list.append(fx + sx + fw / 2)
            prev_gray = gray

    if not cx_list:
        return [{"at": start, "crop": dict(rough)}]

    cx_list.sort()
    median_cx = cx_list[len(cx_list) // 2]

    # x follows the face; y/height/width follow the rough box. Tracking x
    # only (like smart_crop) keeps the vertical axis stable -- seated faces
    # barely move up and down, and holding it prevents vertical jitter.
    left = max(0, min(W - rw, median_cx - rw / 2))
    crop = {
        "left": round(float(left) / W * 100, 2),
        "top": float(rough.get("top", 4)),
        "width": round(float(rw) / W * 100, 2),
        "height": round(float(rh) / H * 100, 2),
    }
    return [{"at": start, "crop": crop}]


# ══════════════════════════════ head tracking ══════════════════════════════
# track_crops (above) collapses the entire [start, end) into ONE median
# point -- right for AI Framing (one box per turn, hard cut).
# track_head() has a different purpose: not collapsing, but PRESERVING
# motion as a TRAJECTORY -- used for the OPTIONAL head tracking feature
# per framing point (ian: "applies to 1 framing point only, not the
# whole thing, and optional -- not every point needs it"). The box moves
# to follow the head WITHIN a single point, hard cuts still happen BETWEEN
# points -- klipian doesn't become continuous panning across the video.

def track_head(video: Path, start: float, end: float, rough: dict,
               fps: int = 3, smooth_window: int = 5) -> list[dict] | None:
    """Trajectory of active face position across [start, end) -> list of
    {t, left} sorted by time (t seconds RELATIVE to `start`, left percent
    box position) -- not a single median point like track_crops(), because
    here the motion is what we want to preserve.

    Samples where no face is found are skipped (not filled with
    placeholders) -- the caller (interpolation in preview JS, sendcmd in
    render.py) linearly interpolates between valid keyframes, so short
    gaps are seamlessly "bridged" rather than stalling.

    Raw cx series is smoothed with a symmetric moving average before
    being returned -- per-frame face detection always jitters slightly,
    without this the box wobbles instead of moving smoothly.

    None if fewer than 2 valid samples (not enough for a trajectory) --
    the caller leaves the point static, same as before tracking was
    attempted."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return None

    # Region is as wide as track_crops (pad=0.6) -- same reasoning:
    # the head may move far from the initial rough box.
    sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H, pad=0.6)
    if ex <= sx or ey <= sy:
        return None

    with tempfile.TemporaryDirectory(prefix="klipian-headtrack-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "h_%04d.jpg"),
        ], desc="tracking head motion")

        files = sorted(Path(tmp).glob("h_*.jpg"))
        if not files:
            return None

        # (t relative to start, cx FRAME pixels) per sample where a face
        # was found. prev_gray is reset to None if a frame fails to read,
        # so mouth-motion isn't calculated across an unsmooth gap.
        samples: list[tuple[float, float]] = []
        prev_gray = None
        locked_cx = rw / 2
        for i, p in enumerate(files):
            img = cv2.imread(str(p))
            if img is None:
                prev_gray = None
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]
                fx, fy, fw, fh = chosen["bbox"]
                samples.append((i / fps, fx + sx + fw / 2))
            prev_gray = gray

    if len(samples) < 2:
        return None

    # Symmetric moving average, small window (clamped at series edges) --
    # dampens detection jitter without delaying real motion too much.
    half = smooth_window // 2
    keyframes = []
    for i in range(len(samples)):
        lo, hi = max(0, i - half), min(len(samples), i + half + 1)
        avg_cx = sum(c for _, c in samples[lo:hi]) / (hi - lo)
        left = max(0, min(W - rw, avg_cx - rw / 2))
        keyframes.append({
            "t": round(samples[i][0], 3),
            "left": round(float(left) / W * 100, 2),
        })
    return keyframes


# ══════════════════════════════ blind search ══════════════════════════════
# fit_crop_to_face and track_crops NEED a rough box -- an initial position
# hint to limit the search area, which is exactly what used to be manually
# confirmed per speaker in AI Framing ("shift the box to the person").
# locate_speaker() DOESN'T need that hint -- used so AI Framing can be
# fully automatic, without confirmation (ian: podcasts aren't always 2
# people, confirming one-by-one per speaker isn't practical).
#
# The risk is EXACTLY what already happened and is documented in this
# module's docstring: searching as wide as the frame easily misidentifies
# textures (hair, fabric patterns) as small faces. locate_speaker() does
# NOT blindly copy _pick_active_face's safety net (which can fall back to
# "sharpest face" when mouth-motion is ambiguous) -- in a search this
# wide that's dangerous, random textures can easily be "sharp". Samples
# with multiple faces but NO clear mouth-motion winner are DISCARDED, not
# guessed at; the final position comes only from samples that are truly
# confident, combined via median across the entire speaking turn -- not a
# single frame.

def locate_speaker(video: Path, start: float, end: float,
                    crop_size: dict, fps: int = 3) -> dict | None:
    """Find the active speaker's position in [start, end) WITHOUT any
    initial position hint -- unlike track_crops() which tracks AROUND a
    known rough box, this searches from SCRATCH across (nearly) the entire
    frame, guided by mouth-motion across several samples.

    `crop_size` = {width, height} PERCENT -- the OUTPUT box size, deliberately
    fully decoupled from the search area width (which is nearly the whole
    frame) so the result stays a narrow portrait, not as wide as the area
    scanned. The output `top`/`left` is computed from the found face center,
    not from `crop_size`.

    None if not a single sample passes the mouth-motion criteria (caller
    falls through to the default box, same as fit_crop_to_face/track_crops
    when no face is found)."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return None

    cw = max(1, (crop_size.get("width", 26) / 100) * W)
    ch = max(1, (crop_size.get("height", 84) / 100) * H)

    # Thin margin at edges -- seated podcast faces almost never touch pixel 0,
    # and excluding the edges catches a few false positives in frame corners
    # (studio logos, watermarks).
    margin = 0.03
    sx, sy = int(W * margin), int(H * margin)
    ex, ey = int(W * (1 - margin)), int(H * (1 - margin))
    rw_scan = ex - sx   # SEARCH area width -- not the output box width

    with tempfile.TemporaryDirectory(prefix="klipian-locate-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "l_%04d.jpg"),
        ], desc="searching for active speaker")

        files = sorted(Path(tmp).glob("l_*.jpg"))
        if not files:
            return None

        kandidat: list[tuple[float, float]] = []   # (cx, cy) FRAME pixels, per sample that passes
        prev_gray = None
        for p in files:
            img = cv2.imread(str(p))
            if img is None:
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw_scan)
            if not faces:
                prev_gray = gray
                continue
            if len(faces) == 1:
                fx, fy, fw, fh = faces[0]["bbox"]
                kandidat.append((fx + sx + fw / 2, fy + sy + fh / 2))
            elif prev_gray is not None and prev_gray.shape == gray.shape:
                # >1 face: MUST have a clear mouth-motion winner. No
                # "sharpest" fallback like normal _pick_active_face --
                # see the reasoning in the module comment above.
                scored = [(f, _mouth_motion(gray, prev_gray, f["mouth"])) for f in faces]
                best, best_score = max(scored, key=lambda s: s[1])
                rest_avg = (sum(s for _, s in scored) - best_score) / (len(scored) - 1)
                if best_score > 1.0 and best_score > rest_avg * 2.0:
                    fx, fy, fw, fh = best["bbox"]
                    kandidat.append((fx + sx + fw / 2, fy + sy + fh / 2))
            prev_gray = gray

    if not kandidat:
        return None

    cx_med = sorted(c[0] for c in kandidat)[len(kandidat) // 2]
    cy_med = sorted(c[1] for c in kandidat)[len(kandidat) // 2]
    return _place_box(cx_med, cy_med, cw, ch, W, H)
