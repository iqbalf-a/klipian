"""The thumbnail card of a video: one function (`write`) makes the real JPG next to the MP4 and the preview in the profile settings,
so what ian sees there is what is uploaded. The look is a `thumbStyle` (profile.json); a profile with none gets the default of its kind:
a clip profile the sticker look (heavy capitals, light-yellow fill, thick dark outline, centred in the middle), the motion channel
(klipian-intip) the plain look (white capitals left aligned in the lower third over a gradient from the bottom).

The card holds the frame and the text and nothing else. The text stays inside the centre 70% of the width, so a 16:9 centre crop still reads."""
from __future__ import annotations

import re
from pathlib import Path

from .render import THUMB_MAX_BYTES, _escape_filter_path, _font_path, _require

FONT_CHOICES = {                                   # settings value -> render._FONT_FILES key (a heavy sans each; the first one ships with klipian)
    "mona": "mona sans extrabold", "arialblack": "arial black", "impact": "impact", "arial": "arial", "verdana": "verdana",
}
FONT_EM = {"mona": 0.66, "arialblack": 0.66, "impact": 0.50, "arial": 0.68, "verdana": 0.78}   # an average capital's width in em (wrapping; no PIL to measure)
POSITIONS = ("auto", "top", "middle", "lower")      # auto: the free band that holds no face and no burned caption
ALIGNS = ("left", "center")

PLAIN = {"font": "mona", "size": 8.5, "color": "#FFFFFF", "outlineColor": "#000000", "outline": 0, "accent": "#FFD447",
         "position": "lower", "align": "left", "gradient": 0.78, "caps": True, "lines": 4}
STICKER = {"font": "arialblack", "size": 10.0, "color": "#FFF3A0", "outlineColor": "#1A1A1A", "outline": 11, "accent": "#FFFFFF",
           "position": "auto", "align": "center", "gradient": 0.0, "caps": True, "lines": 2}


def default_style(pid: str | None = None) -> dict:
    """The default look of a profile: the plain one for the motion channel, the sticker for the others (clip profiles)."""
    return dict(PLAIN if pid and "intip" in pid else STICKER)


def clean_style(raw, base: dict | None = None) -> dict:
    """Only valid settings of `raw`, each fixed to its range; anything else is dropped (so a hand-edited profile.json cannot break a render)."""
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    num = lambda k, lo, hi: out.__setitem__(k, round(max(lo, min(hi, float(raw[k]))), 2)) if isinstance(raw.get(k), (int, float)) and not isinstance(raw.get(k), bool) else None
    num("size", 4, 14), num("outline", 0, 20), num("gradient", 0, 1)
    if isinstance(raw.get("lines"), int) and not isinstance(raw.get("lines"), bool):
        out["lines"] = max(1, min(4, raw["lines"]))
    for k in ("color", "outlineColor", "accent"):
        if isinstance(raw.get(k), str) and re.fullmatch(r"#[0-9a-fA-F]{6}", raw[k]):
            out[k] = raw[k].upper()
    for k, ok in (("font", FONT_CHOICES), ("position", POSITIONS), ("align", ALIGNS)):
        if raw.get(k) in ok:
            out[k] = raw[k]
    if isinstance(raw.get("caps"), bool):
        out["caps"] = raw["caps"]
    return out


def style_of(pid: str | None = None) -> dict:
    """The look in force for a profile (the current one when `pid` is None): its default with its saved settings on top."""
    from . import paths, profiles
    pid = pid or paths.current_profile()
    meta = profiles.read_meta(pid) or {}
    return {**default_style(pid), **clean_style(meta.get("thumbStyle"))}


def lines_of(text: str, per_line: int, caps: bool = True) -> list[tuple[str, bool]]:
    """The card's text as lines [(words, is_accent)], wrapped at `per_line` characters. `*...*` marks the accent words (one run is
    kept); they start their own line(s), so a line has one colour and no text measuring is needed."""
    text = " ".join(str(text or "").replace("#", " ").split())
    text = text.upper() if caps else text
    runs, acc_done = [], False
    for m in re.finditer(r"\*([^*]+)\*([^\w\s*]*)|([^*]+)", text):
        if m.group(1) and not acc_done:
            runs.append(((m.group(1) + m.group(2)).strip(), True))
            acc_done = True
        else:
            runs.append(((m.group(1) or "") + (m.group(2) or "") + (m.group(3) or ""), False))
    lines: list[tuple[str, bool]] = []
    for run, acc in runs:
        cur = ""
        for w in run.split():
            if cur and len(cur) + 1 + len(w) > per_line:
                lines.append((cur, acc))
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            lines.append((cur, acc))
    return lines


def text_of(thumb: str | None, title: str | None, words: int = 6) -> str:
    """What the card says: the story's `thumb` or the row's `thumbText` when there is one, else the title cut to six words."""
    t = " ".join(str(thumb or "").split())
    return t or " ".join(re.sub(r"#\S+", " ", str(title or "")).split()[:words])


# --- which frame, and where the text goes -----------------------------------------------------------------------------------------------
CAPTION_ZONES = ((0.08, 0.23), (0.58, 0.80))        # vertical bands (fractions of the height) where a clip's own title box and karaoke caption sit by default


def score_face(faces: list[tuple]) -> float:
    """How good a frame is as a thumbnail for its faces: boxes (x0, y0, x1, y1) in 0..1. 0 = no face; a larger face scores higher
    (1 at a fifth of the width); a face cut by the edge of the frame counts 30%."""
    if not faces:
        return 0.0
    x0, y0, x1, y1 = max(faces, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    size = min(1.0, (x1 - x0) / 0.2)
    return size * (0.3 if x0 < 0.01 or x1 > 0.99 or y0 < 0.01 else 1.0)


def place_top(block: float, faces: list[tuple], x_span: tuple, zones=CAPTION_ZONES, prefer: float = 0.46) -> tuple[float, float]:
    """The top (fraction of the height) of a text block `block` tall that overlaps the least with the faces it would cover (only those that
    share its horizontal span `x_span`) and the caption zones; among equals the one closest to `prefer` (the middle). Returns (top, overlap):
    overlap 0 means the place is free."""
    def over(a0, a1, b0, b1):
        return max(0.0, min(a1, b1) - max(a0, b0))
    hit = [(max(0.0, b[1] - 0.03), min(1.0, b[3] + 0.03)) for b in faces if over(b[0], b[2], *x_span) > 0]
    best = None
    for i in range(10, int((0.92 - block) * 100) + 1):          # tops from 10% down to where the block still ends by 92%
        top = i / 100
        cost = sum(over(top, top + block, z0, z1) for z0, z1 in zones) + 3 * sum(over(top, top + block, f0, f1) for f0, f1 in hit)
        key = (round(cost, 4), abs(top + block / 2 - prefer))
        if best is None or key < best[0]:
            best = (key, top, cost)
    return (best[1], best[2]) if best else (0.12, 0.0)


def pick_frame(video: Path, duration: float, n: int = 10) -> dict:
    """The best moment of the finished video for a thumbnail: {t, faces [(x0,y0,x1,y1) in 0..1], how: face|clean|fixed}. `n` frames over the 12%..60% of
    the video (never the first frames) are looked at: the best face (score_face) wins; with no face anywhere, the frame with the least edge detail in
    the caption zones (the least burned text on it). Without OpenCV, or when anything fails: ~1 s in, no faces."""
    fixed = {"t": min(1.0, duration / 2), "faces": [], "how": "fixed"}
    try:
        import tempfile
        import cv2
        from . import facebox
        from .ffmpeg_tools import run
        t0, span = max(0.8, 0.12 * duration), max(0.5, 0.48 * duration)
        with tempfile.TemporaryDirectory() as d:
            run([_require("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{t0:.2f}", "-i", str(video), "-t", f"{span:.2f}",
                 "-vf", f"fps={n / span:.4f},scale=540:-2", str(Path(d) / "f_%02d.jpg")], desc="sampling frames for the thumbnail", timeout=90)
            frames = []
            for i, fp in enumerate(sorted(Path(d).glob("f_*.jpg"))):
                img = cv2.imread(str(fp))
                if img is None:
                    continue
                h, w = img.shape[:2]
                faces = [(f["bbox"][0] / w, f["bbox"][1] / h, (f["bbox"][0] + f["bbox"][2]) / w, (f["bbox"][1] + f["bbox"][3]) / h)
                         for f in facebox._detect_faces(img, w, min_frac=0.08)]
                edges = cv2.Canny(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 80, 160)
                clutter = sum(float(edges[int(z0 * h):int(z1 * h)].mean()) for z0, z1 in CAPTION_ZONES) / len(CAPTION_ZONES)
                frames.append((t0 + (i + 0.5) * span / n, faces, clutter))
        if not frames:
            return fixed
        top = max(c for _, _, c in frames) or 1.0
        face_frames = [f for f in frames if f[1]]
        if face_frames:                                           # a face wins; among similar faces the cleaner frame
            t, faces, _ = max(face_frames, key=lambda f: score_face(f[1]) - 0.35 * f[2] / top)
            return {"t": t, "faces": faces, "how": "face"}
        t, _, _ = min(frames, key=lambda f: f[2])
        return {"t": t, "faces": [], "how": "clean"}
    except Exception:                                             # noqa: BLE001
        return fixed


def write(video: Path, text: str | None = None, style: dict | None = None, at: float | None = None, out: Path | None = None, info: dict | None = None) -> Path | None:
    """The thumbnail JPG (default: next to the video, <name>.jpg), <= 2 MB, at the video's own size. Without `text` it is the plain frame.
    `at` None: the frame is picked (pick_frame); `info`, when given, is filled with what was chosen {t, how, faces, position, overlap}.
    Returns None when it could not be made: a render or an upload never fails because of it."""
    from .ffmpeg_tools import probe, run
    thumb = out or video.with_suffix(".jpg")
    tmp: list[Path] = []
    try:
        s = {**default_style(), **(style if style is not None else style_of())}
        info_v = probe(video)
        W, H = info_v.width, info_v.height
        chosen = ({"t": min(at, info_v.duration / 2), "faces": [], "how": "fixed"} if at is not None
                  else pick_frame(video, info_v.duration) if text else {"t": min(1.0, info_v.duration / 2), "faces": [], "how": "fixed"})
        at = chosen["t"]
        vf = []
        font = next((p for p in (_font_path(FONT_CHOICES[s["font"]]), _font_path("mona sans extrabold"), _font_path("arial")) if p), None)
        fs = int(s["size"] / 100 * W)
        room = 0.70 * W                                          # the centre 70%: a 16:9 centre crop still reads
        wrap = lambda size: lines_of(text, int(room / (FONT_EM[s["font"]] * size)), s["caps"])
        lines = wrap(fs) if text and font else []
        too_wide = lambda: lines and max(len(t) for t, _ in lines) * FONT_EM[s["font"]] * fs > room      # one long word does not break
        while (len(lines) > s["lines"] or too_wide()) and fs > 0.03 * W:      # smaller until it fits
            fs = int(fs * 0.92)
            lines = wrap(fs)
        if lines:
            if s["gradient"] > 0:
                k = "clip((Y-0.45*H)/(0.55*H),0,1)"              # 0 at 45% down, 1 at the bottom
                g = f"(1-{s['gradient']}*{k})"
                vf.append(f"geq=lum='lum(X,Y)*{g}':cb='128+(cb(X,Y)-128)*{g}':cr='128+(cr(X,Y)-128)*{g}'")
            lh = int(fs * 1.12)
            block = lh * len(lines)
            width = max(len(t) for t, _ in lines) * FONT_EM[s["font"]] * fs / W
            x_span = (0.15, 0.15 + width) if s["align"] == "left" else (0.5 - width / 2, 0.5 + width / 2)
            auto_top, overlap = place_top(block / H, chosen["faces"], x_span)
            top = {"auto": auto_top * H, "top": 0.12 * H, "middle": 0.46 * H - block / 2, "lower": 0.76 * H - block}[s["position"]]
            if info is not None:
                info.update({**chosen, "position": s["position"], "top": round(top / H, 3), "overlap": round(overlap, 3) if s["position"] == "auto" else None})
            ff = _escape_filter_path(str(font))
            x = f"{int(0.15 * W)}" if s["align"] == "left" else "(w-text_w)/2"
            bw = int(fs * s["outline"] / 100)
            for i, (t, acc) in enumerate(lines):
                f = thumb.with_name(f".{thumb.stem}.thumb{i}.txt")
                f.write_text(t, encoding="utf-8")
                tmp.append(f)
                color = (s["accent"] if acc else s["color"]).replace("#", "0x")
                vf.append(f"drawtext=fontfile='{ff}':textfile='{_escape_filter_path(str(f))}':fontsize={fs}:fontcolor={color}:x={x}:y={int(top) + i * lh}"
                          + (f":borderw={bw}:bordercolor={s['outlineColor'].replace('#', '0x')}" if bw else ""))
        for q in (3, 8, 16):                                     # ffmpeg's JPEG quality, lower is better; coarser until it fits
            run([_require("ffmpeg"), "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{at:.2f}", "-i", str(video),
                 *(["-vf", ",".join(vf)] if vf else []), "-frames:v", "1", "-q:v", str(q), str(thumb)], desc="making the thumbnail", timeout=60)
            if thumb.stat().st_size <= THUMB_MAX_BYTES:
                return thumb
    except Exception:                                            # noqa: BLE001
        pass
    finally:
        for f in tmp:
            f.unlink(missing_ok=True)
    thumb.unlink(missing_ok=True)
    return None


def preview(style, text: str) -> bytes | None:
    """The JPEG of the settings preview: `style` (its valid fields on the profile's default) on the current profile's newest rendered
    video, or on a placeholder frame when it has none; `text` or a sample line."""
    import tempfile
    from . import paths
    from .ffmpeg_tools import run
    s = {**default_style(paths.current_profile()), **clean_style(style)}
    newest = max((p for p in Path(paths.OUT_ROOT).rglob("*.mp4") if not p.stem.endswith((".pass1", "_preview"))), key=lambda p: p.stat().st_mtime, default=None)
    with tempfile.TemporaryDirectory() as d:
        src = newest
        if src is None:                                          # no video yet: a plain 9:16 placeholder
            src = Path(d) / "placeholder.mp4"
            run([_require("ffmpeg"), "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x8a93a3:s=1080x1920:d=2:r=10",
                 "-pix_fmt", "yuv420p", str(src)], desc="making the placeholder frame", timeout=60)
        out = write(src, " ".join(text.split())[:80] or "Gurita punya *3 jantung*?", s, out=Path(d) / "preview.jpg")
        return out.read_bytes() if out else None
