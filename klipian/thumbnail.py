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
POSITIONS = ("top", "middle", "lower")
ALIGNS = ("left", "center")

PLAIN = {"font": "mona", "size": 8.5, "color": "#FFFFFF", "outlineColor": "#000000", "outline": 0, "accent": "#FFD447",
         "position": "lower", "align": "left", "gradient": 0.78, "caps": True, "lines": 4}
STICKER = {"font": "arialblack", "size": 10.0, "color": "#FFF3A0", "outlineColor": "#1A1A1A", "outline": 11, "accent": "#FFFFFF",
           "position": "middle", "align": "center", "gradient": 0.0, "caps": True, "lines": 2}


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


def write(video: Path, text: str | None = None, style: dict | None = None, at: float = 1.0, out: Path | None = None) -> Path | None:
    """The thumbnail JPG (default: next to the video, <name>.jpg), <= 2 MB, at the video's own size. Without `text` it is the plain frame.
    Returns None when it could not be made: a render or an upload never fails because of it."""
    from .ffmpeg_tools import probe, run
    thumb = out or video.with_suffix(".jpg")
    tmp: list[Path] = []
    try:
        s = {**default_style(), **(style if style is not None else style_of())}
        info = probe(video)
        at = min(at, info.duration / 2)
        W, H = info.width, info.height
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
            top = {"top": 0.12 * H, "middle": 0.46 * H - block / 2, "lower": 0.76 * H - block}[s["position"]]
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
