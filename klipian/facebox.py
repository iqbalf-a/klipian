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

Face detection is YuNet (cv2.FaceDetectorYN), a small (~230KB) ONNX model
vendored at assets/models/face_detection_yunet_2023mar.onnx (MIT license,
see assets/models/YuNet-LICENSE.txt) -- NOT a PyTorch model, doesn't add to
the load already used by diarization, no download at runtime. Previously
this was 3 Haar cascade passes per frame (frontal + profile + flipped
profile); YuNet is trained on faces at varied angles so one pass covers
what needed three, runs faster, and reports a real confidence score per
detection -- Haar's binary detect/no-detect output structurally couldn't
give the size-filter/NMS logic below anything to work with beyond box size.

  1. Face detection, searched ONLY around the rough box (not the whole
     frame) -- limiting the search area alone filters out many false
     positives without needing tight detector parameters.
  2. If MORE than one face is found in that area (two people sitting close
     together), the one chosen is NOT the largest but the one whose MOUTH
     IS MOVING -- that's the person currently speaking. Measured from
     inter-frame differences in the mouth region (located via YuNet's own
     mouth-corner landmarks), weighted by Sobel gradient so lip/jaw motion
     stands out above background noise, and stabilized against a head's
     own rigid motion first via optical-flow realignment (see
     _mouth_motion()) so a nod or lean isn't mistaken for talking. This
     idea comes from the smart_crop reference; here it's used to pick the
     RIGHT PERSON, not for continuous panning -- klipian still does hard cuts.
  3. If no face is found at all: HOG+SVM person detection (built-in to
     OpenCV, no download) as fallback -- less accurate (trained for
     standing pedestrians, not sitting podcasters), but better than the raw
     rough box if it does find something.
  4. All methods fail -> None, caller falls through to the rough box as-is.

Real-world report before this module was rewritten: searching the ENTIRE
frame with loose parameters occasionally misidentified textures (hair,
fabric patterns) as small "faces", and the resulting box OVERWROTE a
previously correct point -- not just a silent failure. Limiting the search
area to around the rough box was the primary fix; size filters and
mouth-motion selection below are the next layers of defense.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

_YUNET_MODEL = Path(__file__).resolve().parent.parent / "assets" / "models" / "face_detection_yunet_2023mar.onnx"

_face_detector = None
_hog_detector = None


def _load_face_detector():
    """YuNet needs setInputSize() called before every detect() with a
    DIFFERENT image size -- callers (_detect_faces) do that per region,
    the (320, 320) here is just a required construction-time placeholder."""
    global _face_detector
    if _face_detector is not None:
        return _face_detector
    import cv2
    _face_detector = cv2.FaceDetectorYN.create(
        str(_YUNET_MODEL), "", (320, 320),
        score_threshold=0.6, nms_threshold=0.3, top_k=5000)
    return _face_detector


def _load_hog_detector():
    global _hog_detector
    if _hog_detector is not None:
        return _hog_detector
    import cv2
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    _hog_detector = hog
    return _hog_detector


def _detect_faces(region_bgr, rw: float) -> list[dict]:
    """All faces INSIDE `region_bgr` (BGR color image -- YuNet needs color,
    unlike the Haar cascades this replaced) -> list of
    {cx, bbox:(x,y,w,h), mouth:(x,y,w,h), score} in REGION coordinates.

    No NMS step here (unlike the old Haar version) -- YuNet already
    deduplicates internally (nms_threshold in _load_face_detector()), and
    there's only one detector pass now, not three fighting over the same
    face. `mouth` is centered on YuNet's own right/left mouth-corner
    landmarks -- tighter than the old "bottom 30% of face bbox" guess, and
    used for mouth-motion scoring in _pick_active_face. Size filtered
    (>= rw*0.15) same as before to keep small/distant faces from leaking
    through as candidates."""
    import cv2
    h, w = region_bgr.shape[:2]
    if w <= 0 or h <= 0:
        return []
    detector = _load_face_detector()
    detector.setInputSize((w, h))
    _, raw = detector.detect(region_bgr)
    if raw is None:
        return []

    faces = []
    for row in raw:
        fw = float(row[2])
        if fw < rw * 0.15:
            continue
        x, y = int(round(float(row[0]))), int(round(float(row[1])))
        fw, fh = int(round(fw)), int(round(float(row[3])))
        rmx, rmy, lmx, lmy = float(row[10]), float(row[11]), float(row[12]), float(row[13])
        mw = max(8, int(abs(lmx - rmx) * 1.6))
        mh = max(8, int(fh * 0.28))
        mouth = (int((rmx + lmx) / 2 - mw / 2), int((rmy + lmy) / 2 - mh / 2), mw, mh)
        faces.append({"cx": x + fw // 2, "bbox": (x, y, fw, fh),
                      "mouth": mouth, "score": float(row[14])})
    return faces


def _mouth_motion(gray_curr, gray_prev, mouth: tuple) -> float:
    """How much the mouth region MOVES between two frames. Raw diff is
    weighted by Sobel gradient magnitude: motion at lip/jaw edges is
    amplified, flat background noise is suppressed. x-gradient captures
    jaw shift (profile), y-gradient captures lip open/close (frontal).
    Ported from smart_crop.

    Before the diff, `gray_prev`'s mouth crop is realigned to `gray_curr`'s
    using the dominant (median) optical-flow vector between them -- this
    cancels out RIGID motion (a head nod, leaning toward the mic) that
    would otherwise show up as false mouth motion in a raw pixel diff,
    isolating genuine non-rigid lip movement instead. Ported from research
    on this exact problem (Huang, CVPRW 2020, "Improved Active Speaker
    Detection Based on Optical Flow"). Deliberately only ADDS an alignment
    step before the same diff+Sobel scoring used before -- not a wholesale
    replacement with raw flow magnitude -- so the output stays on roughly
    the same numeric scale as before (confirmed against real footage: two
    candidate faces averaged 22.05/16.96 before, 21.10/14.07 after --
    same ballpark, WIDER separation between them). That matters because
    _pick_active_face()/locate_speaker() compare this score against fixed
    thresholds (>1.0, 2x the runner-up) calibrated for the old scale --
    replacing the formula outright would have made those numbers
    meaningless without a fresh (and much harder to validate) calibration."""
    import cv2
    import numpy as np
    mx, my, mw, mh = mouth
    if mw <= 0 or mh <= 0:
        return 0.0
    c = gray_curr[my:my + mh, mx:mx + mw]
    p = gray_prev[my:my + mh, mx:mx + mw]
    if c.size == 0 or c.shape != p.shape:
        return 0.0

    if c.shape[0] >= 6 and c.shape[1] >= 6:
        flow = cv2.calcOpticalFlowFarneback(
            p, c, None, 0.5, 2, 7, 3, 5, 1.1, 0)
        dx, dy = np.median(flow.reshape(-1, 2), axis=0)
        shift = np.array([[1, 0, dx], [0, 1, dy]], dtype=np.float32)
        p = cv2.warpAffine(p, shift, (p.shape[1], p.shape[0]),
                           borderMode=cv2.BORDER_REPLICATE)

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
        regions = [img[sy:ey, sx:ex] for _, img in frames]
        grays = [cv2.cvtColor(r, cv2.COLOR_BGR2GRAY) for r in regions]

        faces = _detect_faces(regions[ref_idx], rw)
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
                fps: int = 5) -> list[dict]:
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
            faces = _detect_faces(region, rw)
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
#
# Two separate problems used to make the result look choppy, not one:
#   1. the raw per-sample cx jittered (fixed by smoothing, see
#      _one_euro_smooth below)
#   2. even after smoothing, samples were only ~3/sec apart, and the
#      ffmpeg side that consumes them (sendcmd in render.py's
#      _concat_filter) does NOT interpolate between command lines -- it
#      HOLDS the crop position constant until the next line fires. Sparse
#      commands produce a visible staircase (snap, hold, snap, hold) in
#      the actual rendered file, not just a rough preview. Fixed by
#      _resample_dense() below, which turns the smoothed trajectory into
#      one point per output frame -- steps too fine-grained to perceive.

def _one_euro_smooth(samples: list[tuple[float, float]], *, mincutoff: float = 1.0,
                      beta: float = 0.3, dcutoff: float = 1.0) -> list[tuple[float, float]]:
    """1-euro filter (Casiez et al. 2012) -- adaptive smoothing built for
    exactly this kind of noisy position signal: kills small jitter while the
    head is roughly still, but doesn't lag behind on genuine fast motion the
    way a fixed-window moving average does (a wide window smooths jitter but
    also smears real movement into a delayed, floaty box).

    `samples` = (t, x) pairs, already time-sorted; gaps (frames where no face
    was found are simply absent, not zero-filled) are fine -- dt is measured
    from the actual previous sample, not assumed uniform."""
    import math

    def alpha(cutoff: float, dt: float) -> float:
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    out: list[tuple[float, float]] = []
    x_prev = dx_prev = t_prev = None
    for t, x in samples:
        if t_prev is None:
            out.append((t, x))
            x_prev, dx_prev, t_prev = x, 0.0, t
            continue
        dt = max(t - t_prev, 1e-3)
        dx = (x - x_prev) / dt
        a_d = alpha(dcutoff, dt)
        dx_hat = a_d * dx + (1 - a_d) * dx_prev
        cutoff = mincutoff + beta * abs(dx_hat)
        a = alpha(cutoff, dt)
        x_hat = a * x + (1 - a) * x_prev
        out.append((t, x_hat))
        x_prev, dx_prev, t_prev = x_hat, dx_hat, t
    return out


def _resample_dense(samples: list[tuple[float, float]], out_fps: float) -> list[tuple[float, float]]:
    """Upsamples an already-smoothed trajectory to one point per output
    frame via linear interpolation -- not for extra smoothness, but so the
    ffmpeg sendcmd step-holds (see the module docstring above) fire close
    enough together to look continuous. `out_fps` is clamped to [12, 24]:
    below 12 the steps stay visible, above 24 the command file grows for no
    perceptible gain (24 is already smooth-panning territory)."""
    import bisect

    if len(samples) < 2 or out_fps <= 0:
        return samples
    out_fps = max(12.0, min(24.0, out_fps))
    times = [s[0] for s in samples]
    t0, t1 = times[0], times[-1]
    step = 1.0 / out_fps
    count = max(2, int(round((t1 - t0) / step)) + 1)
    out: list[tuple[float, float]] = []
    for i in range(count):
        t = min(t1, t0 + i * step)
        idx = max(0, min(bisect.bisect_right(times, t) - 1, len(samples) - 2))
        a, b = samples[idx], samples[idx + 1]
        frac = 0.0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
        out.append((t, a[1] + (b[1] - a[1]) * frac))
    return out


def track_head(video: Path, start: float, end: float, rough: dict,
               fps: int = 8) -> list[dict] | None:
    """Trajectory of active face position across [start, end) -> list of
    {t, left} sorted by time (t seconds RELATIVE to `start`, left percent
    box position) -- not a single median point like track_crops(), because
    here the motion is what we want to preserve.

    Samples where no face is found are skipped (not filled with
    placeholders) -- interpolation (preview JS) and the dense resampling
    below both bridge across the gap using the nearest valid samples on
    either side, so short gaps are seamlessly "bridged" rather than
    stalling.

    Raw cx series is smoothed with a 1-euro filter, then resampled dense
    (see _one_euro_smooth/_resample_dense above) before being returned --
    per-frame face detection always jitters slightly, and ffmpeg's sendcmd
    (render.py) holds position between commands rather than interpolating,
    so both a smooth SIGNAL and a DENSE one are needed for the box to
    actually look like it's panning instead of snapping.

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
            faces = _detect_faces(region, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]
                fx, fy, fw, fh = chosen["bbox"]
                samples.append((i / fps, fx + sx + fw / 2))
            prev_gray = gray

    if len(samples) < 2:
        return None

    smoothed = _one_euro_smooth(samples)
    dense = _resample_dense(smoothed, info.fps or fps)
    keyframes = []
    for t, cx in dense:
        left = max(0, min(W - rw, cx - rw / 2))
        keyframes.append({
            "t": round(t, 3),
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
                    crop_size: dict, fps: int = 5) -> dict | None:
    """Find the active speaker's position in [start, end) WITHOUT any
    initial position hint -- unlike track_crops() which tracks AROUND a
    known rough box, this searches from SCRATCH across (nearly) the entire
    frame, guided by mouth-motion across several samples. fps bumped from
    3 to 5 (more independent samples -> less chance the "clear winner"
    threshold below fails on a single unlucky window) -- affordable now
    that each sample's detection cost dropped too (see _detect_faces()).

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
            # `cw` (the OUTPUT crop width), NOT the search-area width
            # (ex - sx, ~94% of the frame) -- _detect_faces' size filter is
            # `w < rw * 0.15`, meant to compare against a face's EXPECTED
            # size. This was a real, pre-existing bug (the search-area
            # width used to be passed here), just masked until now: Haar
            # cascade's looser boxes tended to run bigger, so real faces
            # usually cleared the (wrong, oversized) threshold by accident.
            # YuNet's boxes are tighter/more accurate -- the same threshold
            # against the search-area width started rejecting every real
            # face (measured: a 190px face vs. a ~270px minimum).
            faces = _detect_faces(region, cw)
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
