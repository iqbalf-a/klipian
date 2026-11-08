"""Face/person detection for tightening crop boxes -- complement to AI Framing.

Diarization (diarize.py) knows WHEN to change frames. This module answers
the different question: WHERE exactly the box should point -- two methods,
each requiring a different kind of initial position hint:

  - track_crops()       -- ONE RANGE, AROUND a known rough box
  - locate_speaker()    -- ONE RANGE, WITHOUT any rough box at all
    (searching from scratch across nearly the entire frame -- used so AI
    Framing can be fully automatic, without manual confirmation per speaker)

Without track_crops, every framing point created by AI Framing is just a
RAW copy of a position manually shifted once at the start of the clip --
if the initial shift was off, or the person moves slightly in their chair
throughout the clip, the result can cut off a face or point at an empty
chair beside them. It RE-CHECKS the actual face position at EVERY point,
instead of trusting a single static coordinate.

(There used to be a third, fit_crop_to_face() -- one point around a rough
box, behind POST /api/facefit -- plus a HOG+SVM body-detection fallback
underneath it. The UI button that called the endpoint was removed a while
back and the endpoint was kept "just in case", but nothing could reach it
from anywhere, which meant the body-detection fallback the docstring used
to advertise as step 3 never ran in production either. All of it removed;
it is one `git revert` away if a caller ever comes back.)

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
import threading
from pathlib import Path

_YUNET_MODEL = Path(__file__).resolve().parent.parent / "assets" / "models" / "face_detection_yunet_2023mar.onnx"
_SFACE_MODEL = Path(__file__).resolve().parent.parent / "assets" / "models" / "face_recognition_sface_2021dec.onnx"

_face_detector = None
_face_recognizer = None
# One lock per model: the detector and the recognizer are single native objects shared by every request thread
# (ThreadingHTTPServer), and two threads in setInputSize()/detect() at once corrupt them -- "Unknown C++ exception",
# or the whole process gone without a traceback.
_DETECTOR_LOCK = threading.RLock()
_RECOGNIZER_LOCK = threading.RLock()


def _load_face_detector():
    """YuNet needs setInputSize() called before every detect() with a
    DIFFERENT image size -- callers (_detect_faces) do that per region,
    the (320, 320) here is just a required construction-time placeholder."""
    global _face_detector
    with _DETECTOR_LOCK:
        if _face_detector is None:
            import cv2
            _face_detector = cv2.FaceDetectorYN.create(
                str(_YUNET_MODEL), "", (320, 320),
                score_threshold=0.6, nms_threshold=0.3, top_k=5000)
    return _face_detector


def _load_face_recognizer():
    """SFace -- same opencv_zoo family as YuNet above (see
    assets/models/SFace-LICENSE.txt), used to confirm face IDENTITY when
    _pick_active_face()'s mouth-motion signal is ambiguous (see there).
    No setInputSize() equivalent needed -- alignCrop() takes the raw
    detection size as-is."""
    global _face_recognizer
    with _RECOGNIZER_LOCK:
        if _face_recognizer is None:
            import cv2
            _face_recognizer = cv2.FaceRecognizerSF.create(str(_SFACE_MODEL), "")
    return _face_recognizer


def _detect_faces(region_bgr, rw: float, min_frac: float = 0.15) -> list[dict]:
    """All faces INSIDE `region_bgr` (BGR color image -- YuNet needs color,
    unlike the Haar cascades this replaced) -> list of
    {cx, bbox:(x,y,w,h), mouth:(x,y,w,h), score, raw} in REGION coordinates.

    No NMS step here (unlike the old Haar version) -- YuNet already
    deduplicates internally (nms_threshold in _load_face_detector()), and
    there's only one detector pass now, not three fighting over the same
    face. `mouth` is centered on YuNet's own right/left mouth-corner
    landmarks -- tighter than the old "bottom 30% of face bbox" guess, and
    used for mouth-motion scoring in _pick_active_face. `raw` is YuNet's
    untouched detection row (bbox + 5 landmarks + score) -- kept around
    ONLY because _face_embedding()'s alignCrop() needs that exact
    landmark-bearing row, not the simplified bbox/mouth klipian derives
    from it. Size filtered (>= rw*0.15) same as before to keep
    small/distant faces from leaking through as candidates."""
    import cv2
    h, w = region_bgr.shape[:2]
    if w <= 0 or h <= 0:
        return []
    detector = _load_face_detector()
    with _DETECTOR_LOCK:
        detector.setInputSize((w, h))
        _, raw = detector.detect(region_bgr)
    if raw is None:
        return []

    faces = []
    for row in raw:
        fw = float(row[2])
        if fw < rw * min_frac:
            continue
        x, y = int(round(float(row[0]))), int(round(float(row[1])))
        fw, fh = int(round(fw)), int(round(float(row[3])))
        rmx, rmy, lmx, lmy = float(row[10]), float(row[11]), float(row[12]), float(row[13])
        mw = max(8, int(abs(lmx - rmx) * 1.6))
        mh = max(8, int(fh * 0.28))
        mouth = (int((rmx + lmx) / 2 - mw / 2), int((rmy + lmy) / 2 - mh / 2), mw, mh)
        faces.append({"cx": x + fw // 2, "bbox": (x, y, fw, fh),
                      "mouth": mouth, "score": float(row[14]), "raw": row})
    return faces


def _face_embedding(region_bgr, face: dict):
    """128-d identity embedding for one detected `face` (see
    _detect_faces()) -- used by _pick_active_face() to confirm a
    candidate is the SAME PERSON as whichever face was last confidently
    locked, not just nearby. alignCrop() needs YuNet's raw landmark row
    (`face["raw"]`), not the simplified bbox/mouth tuples klipian derives
    from it -- the alignment is landmark-driven (rotates/scales the crop
    so the eyes/mouth land on fixed reference points), which is why SFace
    is paired with YuNet upstream in the first place."""
    recognizer = _load_face_recognizer()
    with _RECOGNIZER_LOCK:
        aligned = recognizer.alignCrop(region_bgr, face["raw"])
        return recognizer.feature(aligned)


def _face_similarity(a, b) -> float:
    """SFace cosine similarity of two embeddings (>= _SFACE_SAME_PERSON_COSINE is the same person)."""
    import cv2
    with _RECOGNIZER_LOCK:
        return _load_face_recognizer().match(a, b, cv2.FaceRecognizerSF_FR_COSINE)


# opencv_zoo's own documented threshold (sface.py in the model's reference
# implementation): cosine similarity >= this -> same person. NOT a number
# klipian invented -- using the vendor's own calibration rather than
# guessing one from scratch.
_SFACE_SAME_PERSON_COSINE = 0.363


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


def _pick_active_face(faces: list[dict], grays: list,
                       locked_cx: float, region_bgr=None,
                       locked_embedding=None):
    """From several faces in a region, pick the one CURRENTLY SPEAKING.

    Priority: clear mouth-motion winner -> SAME PERSON as last time
    (identity, via SFace -- only tried when `region_bgr`/`locked_embedding`
    are given) -> face nearest to the tracked position (continuity) ->
    sharpest face (only if nothing is tracked yet). `grays` = several
    consecutive region frames; mouth motion is summed across pairs so a
    mouth phase (coincidentally closed in one frame) doesn't mislead.
    Logic ported from smart_crop.pick_speaker_cx, but returns the FACE
    (need bbox for centering the box), not just cx.

    The identity tier exists because plain nearest-x has no notion of
    WHO is nearest -- after a scene cut, or when someone leans out of
    frame and back, the spatially-closest face can easily be the WRONG
    person. `region_bgr`/`locked_embedding` are optional so a caller that
    doesn't track identity across calls (or is on its very first sample,
    with nothing locked yet) can omit them and fall straight to
    nearest-x, same as before this tier existed.

    Returns (face, embedding) -- `embedding` is populated only when
    `region_bgr` was given (None otherwise); it's for the CALLER to
    remember and pass back in as `locked_embedding` on the NEXT call, the
    same way `locked_cx` already gets threaded through track_crops()/
    track_head()'s loops."""
    if not faces:
        return None, None

    chosen = None
    chosen_embedding = None
    if len(faces) == 1:
        chosen = faces[0]
    elif len(grays) >= 2:
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
            chosen = best

    if chosen is None and region_bgr is not None and locked_embedding is not None:
        import cv2
        scored_id = [(f, _face_embedding(region_bgr, f)) for f in faces]
        best_f, best_emb = max(scored_id, key=lambda t: _face_similarity(locked_embedding, t[1]))
        best_sim = _face_similarity(locked_embedding, best_emb)
        if best_sim >= _SFACE_SAME_PERSON_COSINE:
            chosen, chosen_embedding = best_f, best_emb

    if chosen is None:
        # Ambiguous motion, AND (no locked identity yet, or nothing matched
        # it): fall back to the face nearest the tracked position, don't
        # guess. This was also the old facebox's intent -- "face nearest
        # the rough box" -- mouth-motion and identity just get first chance
        # before falling here.
        chosen = min(faces, key=lambda f: abs(f["cx"] - locked_cx))

    if chosen_embedding is None and region_bgr is not None:
        chosen_embedding = _face_embedding(region_bgr, chosen)
    return chosen, chosen_embedding


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


# ══════════════════════════════ tracking ══════════════════════════════
# track_crops answers ONE point -- noise-resistant, because its position
# is the MEDIAN of MANY samples across [start, end), not a single frame.
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
    (the caller falls through to it)."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return [{"at": start, "crop": dict(rough)}]

    # Tracking region is padded wider than a single-point lookup would
    # need (0.6): within one turn a person can shift in their chair further
    # than one manual adjustment, and we want to keep chasing them rather
    # than lose them at the edge.
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
        locked_embedding = None    # SFace identity of the last confidently-chosen face
        for p in files:
            img = cv2.imread(str(p))
            if img is None:
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(region, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen, embedding = _pick_active_face(
                faces, grays, locked_cx,
                region_bgr=region, locked_embedding=locked_embedding)
            if chosen is not None:
                locked_cx = chosen["cx"]                       # region-coord
                locked_embedding = embedding
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
        locked_embedding = None    # SFace identity of the last confidently-chosen face
        for i, p in enumerate(files):
            img = cv2.imread(str(p))
            if img is None:
                prev_gray = None
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(region, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen, embedding = _pick_active_face(
                faces, grays, locked_cx,
                region_bgr=region, locked_embedding=locked_embedding)
            if chosen is not None:
                locked_cx = chosen["cx"]
                locked_embedding = embedding
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
# track_crops NEEDS a rough box -- an initial position hint to limit the
# search area, which is exactly what used to be manually confirmed per
# speaker in AI Framing ("shift the box to the person").
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
    falls through to the default box, same as track_crops when no face is
    found)."""
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


# ══════════════════════════════ shot framing ══════════════════════════════
# One box per camera shot, on the faces in it -- no speech, no diarization. For multi-camera TV where people
# move between shots and the 3:4 box only has to hold the main faces.

SHOT_MIN = 0.6          # a shot shorter than this (flicker, transition) joins its neighbour
SHOT_SAMPLES = 4        # frames looked at per shot, at most
SHOT_MERGE_PCT = 3.0    # consecutive boxes this close (percent of the frame) are one point
SHOT_CUT_THRESHOLD = 0.35  # scenecut score that counts as a camera change here
_SHOT_FRAME_W = 1600    # detection runs on frames this wide at most: faces in a wide TV shot are ~4% of it
SHOT_MIN_FACE = 0.015   # smallest face, as a share of the frame width (a wide TV shot: the front people are 2-3 %)


def _merge_faces(samples: list[list[dict]]) -> list[dict]:
    """Faces of several frames of one shot -> {cx, cy, w} per PERSON: faces with near centres are one person
    (median position and size); a face seen in fewer than half the frames is dropped."""
    people: list[list[dict]] = []
    for faces in samples:
        for f in faces:
            for group in people:
                g = group[0]
                if abs(f["cx"] - g["cx"]) < max(f["w"], g["w"]) * 0.6 and abs(f["cy"] - g["cy"]) < max(f["w"], g["w"]) * 0.8:
                    group.append(f)
                    break
            else:
                people.append([f])
    med = lambda v: sorted(v)[len(v) // 2]
    return [{**{k: med([f[k] for f in g]) for k in ("cx", "cy", "w")}, "mouth": g[0].get("mouth"), "region": g[0].get("region"), "raw": g[0].get("raw")}
            for g in people if len(g) * 2 >= len(samples)]


def _group_span(faces: list[dict], cw: float) -> tuple[list[dict], float, float]:
    """The main faces (width >= half the largest) and the left/right edge of them, padded 4% of the box width."""
    biggest = max(f["w"] for f in faces)
    main = [f for f in faces if f["w"] >= biggest * 0.5]
    pad = cw * 0.04
    return (main, min(f["cx"] - f["w"] / 2 for f in main) - pad,
            max(f["cx"] + f["w"] / 2 for f in main) + pad)


def _fits(faces: list[dict], W: int, crop_size: dict) -> bool:
    """Whether all the main faces of a shot fit side by side in the box."""
    if not faces:
        return True
    _, left, right = _group_span(faces, max(1.0, crop_size.get("width", 26) / 100 * W))
    return right - left <= max(1.0, crop_size.get("width", 26) / 100 * W)


def _largest(people: list[dict], W: int) -> dict:
    """The largest face; the one nearer the centre only when the two largest are as large."""
    ranked = sorted(people, key=lambda f: -f["w"])
    if len(ranked) > 1 and ranked[1]["w"] >= ranked[0]["w"] * 0.85:
        return min(ranked[:2], key=lambda f: abs(f["cx"] - W / 2))
    return ranked[0]


def _choose_box(faces: list[dict], W: int, H: int, crop_size: dict) -> dict:
    """The crop box (percent of the frame, the size of `crop_size`) for the faces {cx, cy, w} (pixels) of a
    shot: centred on the main faces when they fit side by side, else on the largest face (the nearer to the centre
    only when two are as large).
    No faces: the centre of the frame."""
    cw = max(1.0, crop_size.get("width", 26) / 100 * W)
    ch = max(1.0, crop_size.get("height", 84) / 100 * H)
    if not faces:
        return _place_box(W / 2, H / 2, cw, ch, W, H)
    main, left, right = _group_span(faces, cw)
    if right - left <= cw:
        cx, cy = (left + right) / 2, sum(f["cy"] for f in main) / len(main)
    else:
        pick = _largest(faces, W)
        cx, cy = pick["cx"], pick["cy"]
    # the face sits about a third from the top of the box
    return _place_box(cx, cy + 0.15 * ch, cw, ch, W, H)


MAX_MAIN_FACES = 6      # a wide shot of a studio audience has dozens of faces; the front few are the shot
BACK_ROW_FACES = 4.0    # a face this many of its own widths above the front row is the audience behind them


def _main_faces(people: list[dict]) -> list[dict]:
    """The faces of the front layer: at least half as wide as the largest (the rest are small, far away) and not a
    row up behind the front people (a face more than BACK_ROW_FACES of its own widths above where the near-largest
    faces are), the MAX_MAIN_FACES largest at most."""
    if not people:
        return []
    biggest = max(f["w"] for f in people)
    core = sorted(f["cy"] for f in people if f["w"] >= biggest * 0.75)
    row = core[len(core) // 2]
    front = [f for f in people if f["w"] >= biggest * 0.5 and row - f["cy"] <= BACK_ROW_FACES * f["w"]]
    return sorted(front, key=lambda f: -f["w"])[:MAX_MAIN_FACES]


def _learn_faces(evidence: dict, similar) -> dict:
    """{speaker: [embedding]} of what the first pass saw (a segment with one face in one speaker's turn) -> the
    faces to look for, one set per speaker. Two speakers whose evidence points at the same face (similarity at or
    above the same-person threshold) cannot both be right: the one with more evidence keeps it, the other has none."""
    known = {k: list(v) for k, v in evidence.items() if v}
    order = sorted(known, key=lambda k: (-len(evidence[k]), str(k)))
    for i, a in enumerate(order):
        for b in order[i + 1:]:
            if a in known and b in known and any(similar(x, y) >= _SFACE_SAME_PERSON_COSINE for x in known[a] for y in known[b]):
                del known[b]
    return known


PEOPLE_CLOSE_W = 0.10   # a face this wide is a close-up: one segment is enough to count that person
PEOPLE_MIN_W = 0.06     # a face narrower than this share of the frame is too poor to tell people apart
AV_SMALL_FACE = 0.05    # a face narrower than this share of the frame: the mouth cannot be read, the body counts more
AV_MOUTH_SMALL = 0.2    # weight of the mouth in `act` for such a face (0.5 for a sizeable one)
AV_LEARN_MIN = 3.0      # an av-sync win in a segment shorter than this is no evidence of a speaker's face (a listener's
                        # reaction to the words follows the sound too, and 2 s of it is all there is to tell them apart)
AV_FPS = 8              # frames per second looked at to match movement with speech
AV_WINDOW = 12.0        # at most this many seconds of a long segment, from its middle
AV_MIN_SCORE = 0.25     # a clear winner scores at least this ...
AV_MIN_MARGIN = 0.10    # ... and this much more than the runner-up
AV_OVERRIDE_SCORE = 0.5     # to beat the face recognised as the speaker's, movement must score at least this ...
AV_OVERRIDE_MARGIN = 0.25   # ... and this much more than the runner-up


def _av_winner(people: list[dict], min_score: float = AV_MIN_SCORE, min_margin: float = AV_MIN_MARGIN):
    """The person whose movement follows the speech clearly (`av`, see _av_core): at least AV_MIN_SCORE and
    AV_MIN_MARGIN ahead of the next one. None when nobody stands out."""
    scored = sorted((f for f in people if f.get("av") is not None), key=lambda f: -f["av"])
    if not scored or scored[0]["av"] < min_score:
        return None
    if len(scored) > 1 and scored[0]["av"] - scored[1]["av"] < min_margin:
        return None
    return scored[0]


def _body_windows(people: list[dict], W: int, H: int) -> list[tuple[int, int, int, int]]:
    """(x0, y0, x1, y1) of each person's body and hands: below the face, two face widths to each side and three
    face heights down, clipped to the frame and to the middle between the neighbouring faces so a person's
    window never takes in the next person's movement."""
    order = sorted(range(len(people)), key=lambda i: people[i]["cx"])
    out: list = [None] * len(people)
    for pos, i in enumerate(order):
        p = people[i]
        fw = p["w"]
        fh = fw * 1.25
        x0, x1 = p["cx"] - 2 * fw, p["cx"] + 2 * fw
        if pos > 0:
            x0 = max(x0, (people[order[pos - 1]]["cx"] + p["cx"]) / 2)
        if pos < len(order) - 1:
            x1 = min(x1, (people[order[pos + 1]]["cx"] + p["cx"]) / 2)
        y0 = p["cy"] + fh / 2
        down = 5 if fw < AV_SMALL_FACE * W else 3        # people stand full length in a wide shot
        out[i] = (int(max(0, x0)), int(max(0, min(H - 1, y0))), int(min(W, x1)), int(min(H, y0 + down * fh)))
    return out


def _av_core(mouth, body, glob, env, mouth_weight=None) -> list[float] | None:
    """How well each face's movement follows the speech. `mouth` and `body` are (faces, steps) arrays of movement
    per time step, `glob` the movement of the whole frame per step (camera moves, zooms, transitions), `env` the
    loudness per step. Steps with big global movement are left out and the rest is taken off the body movement.
    Per face: z-scored mouth and body movement are averaged into `act`; the score is half the best Pearson
    correlation of `act` with `env` (act lagging the sound by 0 to 2 steps) plus a quarter of how much more `act`
    is up when the sound is loud than when it is quiet. `mouth_weight` (per face, default 0.5) is the share of the mouth
    in `act`. None when there is too little to go on."""
    import numpy as np

    mouth, body = np.asarray(mouth, float), np.asarray(body, float)
    glob, env = np.asarray(glob, float), np.asarray(env, float)
    n = env.size
    keep = glob <= np.median(glob) * 4 + 2.0
    if n < 12 or keep.sum() < 10 or float(env.std()) < 1e-6:
        return None
    body = np.maximum(body - glob, 0.0)

    def z(v):
        sd = v[keep].std()
        return (v - v[keep].mean()) / sd if sd > 1e-9 else np.zeros_like(v)

    scores = []
    weights = list(mouth_weight) if mouth_weight is not None else [0.5] * len(mouth)
    for m, b, wm in zip(mouth, body, weights):
        act = wm * z(m) + (1 - wm) * z(b)
        best = -1.0
        for lag in range(3):
            a, e, k = act[lag:], env[:n - lag], keep[lag:] & keep[:n - lag]
            if k.sum() < 8 or a[k].std() < 1e-9 or e[k].std() < 1e-9:
                continue
            best = max(best, float(np.corrcoef(a[k], e[k])[0, 1]))
        loud = (env > np.median(env)) & keep
        quiet = (env <= np.median(env)) & keep
        diff = float(act[loud].mean() - act[quiet].mean()) if loud.any() and quiet.any() else 0.0
        scores.append(0.5 * max(best, -1.0) + 0.25 * diff)
    return scores


def _grab_seq(video: Path, t0: float, dur: float, tmp: str, tag: str, fps: int) -> list:
    """The frames of [t0, t0 + dur) at `fps`, gray, at most _SHOT_FRAME_W wide (the size faces were found at)."""
    import cv2

    from .ffmpeg_tools import _require, run

    run([_require("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{t0:.3f}", "-i", str(video), "-t", f"{dur:.3f}",
         "-vf", f"fps={fps},scale=min({_SHOT_FRAME_W}\\,iw):-2", str(Path(tmp) / f"{tag}_%03d.jpg")],
        desc="grabbing frames to match movement with speech")
    return [cv2.imread(str(p), cv2.IMREAD_GRAYSCALE) for p in sorted(Path(tmp).glob(f"{tag}_*.jpg"))]


def _audio_env(video: Path, t0: float, dur: float, steps: int, fps: int, tmp: str, tag: str):
    """Loudness (RMS) at the time of each of `steps` video steps (step i at t0 + (i + 1) / fps), or None."""
    import numpy as np
    import soundfile as sf

    from .ffmpeg_tools import _require, run

    wav = Path(tmp) / f"{tag}.wav"
    run([_require("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{t0:.3f}", "-t", f"{dur + 0.2:.3f}", "-i", str(video),
         "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)], desc="extracting the audio of a segment")
    data, sr = sf.read(str(wav), dtype="float32")
    if data.ndim > 1:
        data = data[:, 0]
    half = int(sr / fps / 2)
    out = []
    for i in range(steps):
        c = int((i + 1) / fps * sr)
        w = data[max(0, c - half):c + half]
        out.append(float(np.sqrt(np.mean(w * w))) if w.size else 0.0)
    return np.asarray(out)


def _av_scores(video: Path, a: float, b: float, people: list[dict], W: int, H: int, tmp: str, tag: str) -> None:
    """Sets `av` on each person of a segment: how well their mouth and body movement follow the sound (_av_core)."""
    import cv2
    import numpy as np

    dur = min(b - a, AV_WINDOW)
    t0 = a + (b - a - dur) / 2
    frames = [f for f in _grab_seq(video, t0, dur, tmp, tag, AV_FPS) if f is not None]
    if len(frames) < 13:
        return
    h, w = frames[0].shape[:2]
    sx, sy = w / W, h / H
    scaled = [{**p, "cx": p["cx"] * sx, "cy": p["cy"] * sy, "w": p["w"] * sx} for p in people]
    bodies = _body_windows(scaled, w, h)
    mouths = []
    for p in people:
        mx, my, mw, mh = p.get("mouth") or (int(p["cx"] - p["w"] / 4), int(p["cy"] + p["w"] / 4), int(p["w"] / 2), int(p["w"] / 4))
        mouths.append((max(0, int(mx * sx)), max(0, int(my * sy)), max(8, int(mw * sx)), max(8, int(mh * sy))))
    small = [cv2.resize(f, (w // 4, h // 4)).astype(np.float32) for f in frames]
    mouth = [[] for _ in people]
    body = [[] for _ in people]
    glob = []
    for i in range(1, len(frames)):
        glob.append(float(np.median(np.abs(small[i] - small[i - 1]))))
        diff = cv2.absdiff(frames[i], frames[i - 1]).astype(np.float32)
        for k in range(len(people)):
            mouth[k].append(_mouth_motion(frames[i], frames[i - 1], mouths[k]))
            x0, y0, x1, y1 = bodies[k]
            body[k].append(float(diff[y0:y1, x0:x1].mean()) if y1 > y0 and x1 > x0 else 0.0)
    env = _audio_env(video, t0, dur, len(glob), AV_FPS, tmp, tag)
    scores = _av_core(mouth, body, glob, env, [AV_MOUTH_SMALL if p['w'] < AV_SMALL_FACE * W else 0.5 for p in people])
    if scores:
        for p, s in zip(people, scores):
            p["av"] = s


def _speaking(video: Path, a: float, b: float, face: dict, W: int, H: int, tmp: str, tag: str) -> bool:
    """Whether the one face of a segment moves with the sound (av at least AV_MIN_SCORE): a shot of someone laughing,
    listening or nodding in the turn of another speaker is not evidence of whose face that speaker has. A segment
    too short to tell is no evidence either: no face is better than a wrong one."""
    if face.get("av") is None:
        _av_scores(video, a, b, [face], W, H, tmp, tag)
    return face.get("av") is not None and face["av"] >= AV_MIN_SCORE


def _count_people(items: list[tuple], similar, min_segments: int = 2) -> int:
    """How many different people the faces are: `items` are (segment, embedding[, close]) of the faces on screen;
    faces at or above the same-person similarity are one person (two faces of one segment never are). A person
    counts when seen in `min_segments` segments, or once in a close-up (`close`: a face wide enough to be sure);
    someone small who passes by once is not counted."""
    people: list[list[tuple]] = []
    for seg, emb, *rest in items:
        item = (seg, emb, bool(rest and rest[0]))
        for group in people:
            if seg not in {g[0] for g in group} and any(similar(emb, g[1]) >= _SFACE_SAME_PERSON_COSINE for g in group):
                group.append(item)
                break
        else:
            people.append([item])
    return sum(1 for g in people if len({x[0] for x in g}) >= min_segments or any(x[2] for x in g))


def _decide(people: list[dict], W: int, H: int, size: dict, speaker, known: dict, prev: dict | None,
            new_shot: bool = True, embed=None, similar=None, weak: dict | None = None,
            picked: dict | None = None, seconds: float = 99.0) -> tuple[dict, str]:
    """The box and why for one segment: (crop, why). The box is always centred on ONE face, the person speaking;
    the others may be cut. `people` are its faces {cx, cy, w[, av]}; `speaker` is who speaks in it (diarization,
    or None); `known` {speaker: [embedding]} is what the first pass learned (a clear av-sync winner adds to it for a
    speaker the first pass never saw), `prev` is the previous box and
    `new_shot` whether a camera cut starts this segment. why, in order of trust: av-sync (movement follows the
    sound clearly: it beats the recognised face only at AV_OVERRIDE_SCORE / AV_OVERRIDE_MARGIN, the conflict is noted) | speaker-face (the face recognised as this
    speaker's) | single (the only face) | largest | kept (previous box: the speaker is not in view and the camera
    did not cut) | center (nothing at all)."""
    if not people:
        return (prev, "kept") if prev else (_choose_box([], W, H, size), "center")
    pick = why = None
    winner = _av_winner(people)
    faces = known.get(speaker, [])
    face_pick = None
    if faces and embed and similar:
        pool = _main_faces(people)                                # the audience behind is nobody's face
        best = max(pool, key=lambda p: max(similar(e, embed(p)) for e in faces))
        if max(similar(e, embed(best)) for e in faces) >= _SFACE_SAME_PERSON_COSINE:
            face_pick = best
    if winner is not None and face_pick is not None and winner is not face_pick:
        winner["conflict"] = True                                 # movement and the recognised face disagree
        winner = _av_winner(people, AV_OVERRIDE_SCORE, AV_OVERRIDE_MARGIN)   # movement must then be very clear
    if winner is not None:
        pick, why = winner, "av-sync"
        if speaker is not None and speaker not in known and embed and seconds >= AV_LEARN_MIN:
            known[speaker] = [embed(winner)]                      # clear, so it counts as evidence
    elif face_pick is not None:
        pick, why = face_pick, "speaker-face"
    if pick is None and speaker in known and prev is not None and not new_shot:
        return prev, "kept"                                       # the speaker is out of view: same shot, same box
    if pick is None:
        main = _main_faces(people)
        pick, why = (main[0], "single") if len(main) == 1 else (_largest(people, W), "largest")
    if picked is not None:
        picked["face"] = pick
    return _choose_box([pick], W, H, size), why                   # centred on the one face


def _face_in_box(face: dict, crop: dict, W: int, H: int) -> bool:
    """Whether the whole face (a little more than its box, for the forehead and chin) lies inside the crop (percent)."""
    x0, x1 = crop["left"] / 100 * W, (crop["left"] + crop["width"]) / 100 * W
    y0, y1 = crop["top"] / 100 * H, (crop["top"] + crop["height"]) / 100 * H
    hw, hh = face["w"] * 0.6, face["w"] * 0.75
    return x0 <= face["cx"] - hw and face["cx"] + hw <= x1 and y0 <= face["cy"] - hh and face["cy"] + hh <= y1


def _shot_bounds(cuts: list[float], start: float, end: float, hard: list[float] | None = None) -> list[tuple[float, float]]:
    """[(segment start, segment end)] from the boundary times; a segment under SHOT_MIN joins the one before it (the
    first, the one after) unless it is a real shot: a camera cut (`hard`) on both of its sides."""
    hard = hard or []

    def is_cut(t: float) -> bool:
        return any(abs(t - c) < 0.005 for c in hard)

    edges = [start] + sorted(c for c in cuts if start < c < end) + [end]
    shots = [[a, b] for a, b in zip(edges, edges[1:])]
    out: list[list[float]] = []
    for sh in shots:
        if out and (sh[1] - sh[0] < SHOT_MIN) and not (is_cut(sh[0]) and is_cut(sh[1])):
            out[-1][1] = sh[1]
        else:
            out.append(sh)
    if len(out) > 1 and out[0][1] - out[0][0] < SHOT_MIN and not is_cut(out[0][1]):
        out[1][0] = out[0][0]
        out.pop(0)
    return [(a, b) for a, b in out]


def _same_box(a: dict, b: dict) -> bool:
    return abs(a["left"] - b["left"]) < SHOT_MERGE_PCT and abs(a["top"] - b["top"]) < SHOT_MERGE_PCT


def _shot_grab(video: Path, t: float, tmp: str, tag: str, frames: int = 1) -> list:
    """`frames` BGR frames from second t on (10 fps apart when more than one), at most _SHOT_FRAME_W wide."""
    import cv2

    from .ffmpeg_tools import _require, run

    pattern = str(Path(tmp) / f"{tag}_%02d.jpg")
    cmd = [_require("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video)]
    if frames > 1:
        cmd += ["-t", f"{frames / 10 + 0.05:.2f}", "-vf", f"fps=10,scale=min({_SHOT_FRAME_W}\\,iw):-2"]
    else:
        cmd += ["-frames:v", "1", "-vf", f"scale=min({_SHOT_FRAME_W}\\,iw):-2"]
    run(cmd + [pattern], desc="grabbing a frame of the shot")
    return [im for im in (cv2.imread(str(p)) for p in sorted(Path(tmp).glob(f"{tag}_*.jpg"))) if im is not None][:frames]


def _shot_faces(img) -> list[dict]:
    """The faces {cx, cy, w, mouth, region, raw} of a frame (pixels of the frame), 3% edge margin, small faces
    included. `region` and `raw` are what SFace needs for the face's embedding."""
    H, W = img.shape[:2]
    sx, sy = int(W * 0.03), int(H * 0.03)
    region = img[sy:H - sy, sx:W - sx]
    out = []
    for fc in _detect_faces(region, W, min_frac=SHOT_MIN_FACE):
        if fc["score"] < 0.7:
            continue
        x, y, w, h = fc["bbox"]
        mx, my, mw, mh = fc["mouth"]
        out.append({"cx": x + sx + w / 2, "cy": y + sy + h / 2, "w": w, "mouth": (mx + sx, my + sy, mw, mh),
                    "region": region, "raw": fc["raw"]})
    return out


def _segments(cuts: list[float], turns: list[dict], start: float, end: float) -> list[tuple[float, float, object]]:
    """[(start, end, speaker)]: the span cut at every camera change and every change of speaker. The audio is often
    a little behind the picture, so a speaker's turn that starts within 2 s after a cut starts at that cut. The
    speaker is whoever speaks most of the segment."""
    bounds = list(cuts)
    for t in turns:
        if start < t["start"] < end and not any(t["start"] - 2 <= c <= t["start"] for c in cuts):
            bounds.append(t["start"])
    out = []
    for a, b in _shot_bounds(bounds, start, end, cuts):
        over: dict = {}
        for t in turns:
            o = min(b, t["end"]) - max(a, t["start"])
            if o > 0:
                over[t["speaker"]] = over.get(t["speaker"], 0) + o
        out.append((a, b, max(over, key=over.get) if over else None))
    return out


def _alone_in_turn(a: float, b: float, speaker, turns: list[dict]) -> bool:
    """Whether the whole segment lies in the turns of this one speaker (so a lone face in it is theirs)."""
    if speaker is None:
        return False
    mine = sum(max(0.0, min(b, t["end"]) - max(a, t["start"])) for t in turns if t["speaker"] == speaker)
    return mine >= (b - a) * 0.9


def _frame_pass(video: Path, start: float, end: float, size: dict, turns: list[dict], cuts: list[float], recognizer: bool,
                embed, tmp: str, tag: str, progress=None):
    """One look at the span with these speaker turns: (points, evidence for the people count, speakers seen).
    Every segment's faces are found (and, where several are main faces, matched to the sound), then the first pass
    learns each speaker's face and the second boxes every segment."""
    segs = _segments(cuts, turns, start, end)
    seen = []                                              # per segment: (a, b, speaker, people, W, H)
    for n, (a, b, speaker) in enumerate(segs):
        if progress:
            progress(n / len(segs))                        # the caller may raise here to stop (Autopilot's Cancel)
        samples: list[list[dict]] = []
        W = H = 0
        k = min(SHOT_SAMPLES, max(1, int((b - a) / 0.5)))
        for i in range(k):
            got = _shot_grab(video, a + (b - a) * (i + 0.5) / k, tmp, f"{tag}s{n}_{i}")
            if got:
                H, W = got[0].shape[:2]
                samples.append(_shot_faces(got[0]))
        if not W:
            continue
        people = _merge_faces(samples)
        main = _main_faces(people)
        if len(main) > 1:
            _av_scores(video, a, b, main, W, H, tmp, f"{tag}v{n}")
        seen.append((a, b, speaker, people, W, H))

    # pass 1: a lone face in one speaker's turn is that speaker's face
    known: dict = {}
    alone: list = []                                       # (segment, embedding, close-up) of every sizeable face
    if recognizer:
        evidence: dict = {}
        for n, (a, b, speaker, people, W, H) in enumerate(seen):
            main = _main_faces(people)
            for f in main:                                 # identities for the people count: every sizeable face
                if f["w"] >= PEOPLE_MIN_W * W:
                    alone.append((n, embed(f), f["w"] >= PEOPLE_CLOSE_W * W))
            if len(main) != 1:
                continue
            if _alone_in_turn(a, b, speaker, turns) and _speaking(video, a, b, main[0], W, H, tmp, f"{tag}e{n}"):
                evidence.setdefault(speaker, []).append(embed(main[0]))
        known = _learn_faces(evidence, _face_similarity)

    # pass 2: the box of every segment
    points: list[dict] = []
    prev = None
    weak: dict = {}
    for a, b, speaker, people, W, H in seen:
        new_shot = prev is None or any(abs(a - c) < 0.1 for c in cuts)
        picked: dict = {}
        crop, why = _decide(people, W, H, size, speaker, known, prev, new_shot, embed if recognizer else None,
                            _face_similarity, weak, picked, b - a)
        if prev is not None and not new_shot and picked.get("face") is not None and _face_in_box(picked["face"], prev, W, H):
            crop = prev                                    # same shot, and the speaker is already whole in the box
        prev = crop
        if points and _same_box(points[-1]["crop"], crop):
            continue
        point = {"at": round(a, 3), "crop": crop, "why": why}
        scored = sorted((p["av"] for p in people if p.get("av") is not None), reverse=True)[:2]
        if scored:
            point["av"] = [round(s, 2) for s in scored]
        if any(p.get("conflict") for p in people):
            point["conflict"] = True
        points.append(point)
    return points, alone, len({t["speaker"] for t in turns})


def frame_segments(video: Path, start: float, end: float, size: dict, turns: list[dict] | None = None,
                   rediarize=None, progress=None) -> tuple[list[dict], dict]:
    """([{at, crop, why}], info) (real seconds): one box per segment of [start, end) -- cut at every camera change
    and every change of speaker -- centred on the face of the person speaking (see _decide). Two passes: the first
    learns each speaker's face from the segments with one face in one speaker's turn; the second boxes every
    segment, matching movement with the sound where several faces are in view. When more different faces were
    seen alone on screen than the diarization found speakers, `rediarize(n)` (if given) splits the speech again
    into n speakers and the span is looked at once more. Without turns it is one box per camera shot.
    info: {people, speakers, resplit}. `progress(fraction)` (optional) is called as each segment is looked at, with
    0..1 of the first look (the heavy part); an exception it raises ends the call."""
    from .scenecut import detect_cuts_exact

    turns = turns or []
    # a lower threshold than the podcast one (0.6): fast TV editing has cuts that one misses; the thumbnail check
    # backs it up and gives the frame the new shot begins on
    cuts = detect_cuts_exact(video, start, end, SHOT_CUT_THRESHOLD)
    recognizer = True
    try:
        _load_face_recognizer()
    except Exception:                                      # noqa: BLE001  no SFace: movement and size only
        recognizer = False

    def embed(p):
        if "emb" not in p:
            p["emb"] = _face_embedding(p["region"], p)
        return p["emb"]

    info = {"people": 0, "speakers": len({t["speaker"] for t in turns}), "resplit": False}
    with tempfile.TemporaryDirectory(prefix="klipian-segments-") as tmp:
        points, alone, speakers = _frame_pass(video, start, end, size, turns, cuts, recognizer, embed, tmp, "a", progress)
        n = min(_count_people(alone, _face_similarity), MAX_MAIN_FACES) if recognizer else 0   # a crowd is no 20 speakers
        info["people"] = n
        if rediarize and turns and n > speakers:
            try:
                new_turns = rediarize(n)
            except Exception:                              # noqa: BLE001  keep what there is
                new_turns = None
            if new_turns:
                points, alone, speakers = _frame_pass(video, start, end, size, new_turns, cuts, recognizer, embed, tmp, "b")
                info.update(resplit=True, speakers=speakers)
    return points, info
