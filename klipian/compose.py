"""Pass 2 of a render: what sits ON the finished clip, timed against it.

Pass 1 (render.py) turns each run of source spans into video -- crop,
framing, captions -- and the server joins the runs. What a compilation adds
on top belongs to the JOINED clip, not to any one source: a "1. Andre
kepleset" label that starts at 00:07 of the output, a sticker over a cut, a
sound sting between two moments. So they're laid on here, in one more
ffmpeg pass over the finished file, in OUTPUT seconds.

Three kinds of element, all optional:

- text     -- a label, drawn through libass like the captions, in the same
              1080x1920 reference space (render.REF_W/REF_H) so a size means
              the same thing at any resolution and in the preview.
- image    -- a still (png/jpg/webp) from workspace/assets/, scaled to a
              share of the frame width and centred on a point.
- sound    -- an audio file from workspace/assets/, started at a second of
              the clip and mixed over its own audio at a chosen volume.

Plus per-segment volume: episodes are recorded at different levels, so a
compilation jumps in loudness at every cut (ian). Each segment's range of
the output gets its own gain. Nothing is decided automatically -- no
ducking, no normalising: every level is one ian set.

A clip with none of these never reaches this module, so every render that
existed before it comes out exactly as it did (the byte-identical check
the whole library-projects plan is verified against).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from .ffmpeg_tools import _require
from .render import (FONTS_DIR, REF_H, REF_W, RenderCancelled, _ass_escape,
                     _ass_time, _escape_filter_path, _run_ffmpeg)

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
SOUND_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}

# The font the UI previews labels with (ui/css/fonts.css), and the one
# libass finds in FONTS_DIR -- one face on both sides, so the preview is
# the render.
LABEL_FONT = "Mona Sans ExtraBold"


def to_stereo(channels: int) -> str:
    """The filter that makes an audio stream plain stereo WITHOUT changing
    its level. ffmpeg's own mono->stereo upmix applies a -3 dB pan law, so
    a mono episode joined to a stereo one came out 3 dB quieter than it
    sounds on its own (measured). A mono channel is copied to both sides
    at full level instead."""
    return "pan=stereo|c0=c0|c1=c0" if channels == 1 else "aformat=channel_layouts=stereo"


def _num(v, default: float, lo: float, hi: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, x))


def _ass_colour(hex_colour: str, default: str = "&H00FFFFFF") -> str:
    """#RRGGBB -> &H00BBGGRR (ASS is blue-green-red)."""
    h = str(hex_colour or "").lstrip("#")
    if len(h) != 6 or any(c not in "0123456789abcdefABCDEF" for c in h):
        return default
    return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def clean_elements(raw, duration: float, assets_dir: Path) -> list[dict]:
    """The client's overlay list, validated. Anything malformed or pointing
    at a file that isn't in workspace/assets/ is dropped rather than failing
    the render: a broken sticker must not cost the whole clip. Times are
    clamped to the clip."""
    out = []
    for e in raw if isinstance(raw, list) else []:
        if not isinstance(e, dict):
            continue
        kind = e.get("kind")
        start = _num(e.get("start"), 0.0, 0.0, duration)
        end = _num(e.get("end"), start, 0.0, duration)
        if kind in ("text", "image") and end - start < 0.05:
            continue
        el = {"kind": kind, "start": start, "end": end,
              "x": _num(e.get("x"), 50.0, 0.0, 100.0),
              "y": _num(e.get("y"), 50.0, 0.0, 100.0)}
        if kind == "text":
            text = str(e.get("text") or "").strip()
            if not text:
                continue
            el.update(text=text[:300], size=_num(e.get("size"), 72, 12, 400),
                      color=str(e.get("color") or "#FFFFFF"), box=bool(e.get("box")))
        elif kind in ("image", "sound"):
            name = Path(str(e.get("file") or "")).name
            f = assets_dir / name
            ext = IMAGE_EXT if kind == "image" else SOUND_EXT
            if not name or f.suffix.lower() not in ext or not f.is_file():
                continue
            el["path"] = f
            if kind == "image":
                el["size"] = _num(e.get("size"), 40, 1, 100)
            else:
                el["volume"] = _num(e.get("volume"), 1.0, 0.0, 4.0)
                # A sound with no end plays to its own length; with one, it
                # is cut there.
                if el["end"] <= start:
                    el["end"] = duration
        else:
            continue
        out.append(el)
    return out


def clean_volumes(raw, duration: float) -> list[dict]:
    out = []
    for v in raw if isinstance(raw, list) else []:
        if not isinstance(v, dict):
            continue
        start = _num(v.get("start"), 0.0, 0.0, duration)
        end = _num(v.get("end"), start, 0.0, duration)
        gain = _num(v.get("volume"), 1.0, 0.0, 4.0)
        if end - start > 0.01 and abs(gain - 1.0) > 1e-6:
            out.append({"start": start, "end": end, "volume": gain})
    return out


def build_label_ass(texts: list[dict]) -> str:
    """Labels as one ASS file. \\an5\\pos puts each label's CENTRE on its
    point, the same anchor the preview uses (translate -50% -50%)."""
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {REF_W}
PlayResY: {REF_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Label,{LABEL_FONT},72,&H00FFFFFF,&H00000000,&H00000000,0,1,5,0,5,40,40,0,1
Style: LabelBox,{LABEL_FONT},72,&H00FFFFFF,&H4C000000,&H00000000,0,3,18,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for t in texts:
        x = int(REF_W * t["x"] / 100)
        y = int(REF_H * t["y"] / 100)
        style = "LabelBox" if t["box"] else "Label"
        # Line breaks typed in the UI become ASS hard breaks.
        body = _ass_escape(t["text"]).replace("\r\n", "\n").replace("\n", r"\N")
        tags = f"{{\\an5\\pos({x},{y})\\fs{int(t['size'])}\\c{_ass_colour(t['color'])}&}}"
        lines.append(f"Dialogue: 2,{_ass_time(t['start'])},{_ass_time(t['end'])},"
                     f"{style},,0,0,0,,{tags}{body}")
    return header + "\n".join(lines) + "\n"


def compose(src: Path, dest: Path, *, width: int, height: int, duration: float,
            elements: list[dict], volumes: list[dict], quality: int,
            has_audio: bool = True, cancel_check=None) -> None:
    """Lay `elements` and `volumes` over the finished clip `src`, writing
    `dest`. Both already cleaned (clean_elements / clean_volumes)."""
    ffmpeg = _require("ffmpeg")
    texts = [e for e in elements if e["kind"] == "text"]
    images = [e for e in elements if e["kind"] == "image"]
    sounds = [e for e in elements if e["kind"] == "sound"]

    inputs = ["-i", str(src)]
    for im in images:
        # -loop 1 turns a still into a stream long enough to overlay for
        # any duration; `enable` decides when it's actually visible.
        inputs += ["-loop", "1", "-t", f"{duration:.3f}", "-i", str(im["path"])]
    for s in sounds:
        inputs += ["-i", str(s["path"])]

    graph = []
    v = "[0:v]"
    for i, im in enumerate(images, start=1):
        w = max(2, int(width * im["size"] / 100) // 2 * 2)
        cx, cy = width * im["x"] / 100, height * im["y"] / 100
        graph.append(f"[{i}:v]scale={w}:-2,format=rgba[im{i}]")
        graph.append(f"{v}[im{i}]overlay=x={cx:.1f}-w/2:y={cy:.1f}-h/2:"
                     f"enable='between(t,{im['start']:.3f},{im['end']:.3f})'[v{i}]")
        v = f"[v{i}]"

    ass_path = None
    if texts:
        ass_path = dest.with_suffix(".labels.ass")
        ass_path.write_text(build_label_ass(texts), encoding="utf-8")
        graph.append(f"{v}ass='{_escape_filter_path(str(ass_path))}':"
                     f"fontsdir='{_escape_filter_path(str(FONTS_DIR))}'[vl]")
        v = "[vl]"
    graph.append(f"{v}null[vout]")

    # Audio: the clip's own track with each segment's gain, then the sounds
    # mixed over it. normalize=0 so adding a sting doesn't quietly halve
    # everything else -- amix's default would.
    from .ffmpeg_tools import probe
    a = "[0:a]"
    if has_audio:
        # Plain stereo first, at the level it already has (to_stereo), so
        # mixing a stereo sting over a mono clip can't pan-law it down.
        graph.append(f"[0:a]{to_stereo(probe(src).channels)}[a0]")
        a = "[a0]"
        for j, vol in enumerate(volumes):
            graph.append(f"{a}volume={vol['volume']:.3f}:"
                         f"enable='between(t,{vol['start']:.3f},{vol['end']:.3f})'[av{j}]")
            a = f"[av{j}]"
    else:
        graph.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[asil]")
        a = "[asil]"
    first_sound = 1 + len(images)
    mix = [a]
    for k, s in enumerate(sounds):
        idx = first_sound + k
        delay = int(s["start"] * 1000)
        length = max(0.05, s["end"] - s["start"])
        graph.append(f"[{idx}:a]{to_stereo(probe(s['path']).channels)},"
                     f"atrim=0:{length:.3f},asetpts=PTS-STARTPTS,"
                     f"volume={s['volume']:.3f},adelay={delay}:all=1[s{k}]")
        mix.append(f"[s{k}]")
    if len(mix) > 1:
        graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:"
                     f"dropout_transition=0:normalize=0[aout]")
    else:
        graph.append(f"{a}anull[aout]")

    crf = max(0, min(51, int(quality)))
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
           *inputs, "-filter_complex", ";".join(graph),
           "-map", "[vout]", "-map", "[aout]",
           "-t", f"{duration:.3f}",
           "-c:v", "libx264", "-crf", str(crf), "-preset", "medium",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
           "-movflags", "+faststart", str(dest)]
    try:
        code, err = _run_ffmpeg(cmd, cancel_check, dest)
        if code != 0:
            tail = (err or "").strip().splitlines()[-10:]
            raise RuntimeError("could not add the timeline elements:\n" + "\n".join(tail))
    finally:
        if ass_path:
            ass_path.unlink(missing_ok=True)


__all__ = ["compose", "clean_elements", "clean_volumes", "build_label_ass",
           "RenderCancelled", "IMAGE_EXT", "SOUND_EXT"]
