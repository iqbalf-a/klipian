"""Render a 9:16 vertical clip -- this is what actually produces the MP4.

Three things done here, and the order matters:

1. CUTS ARE JOINED.
   A clip can consist of multiple cuts (middle parts removed). ffmpeg cuts
   each segment then joins them into one.

2. CAPTIONS ARE MAPPED TO THE OUTPUT TIMELINE.
   Once a segment is removed, all subsequent words shift forward. A word at
   source second 650 might land at output second 11. If source timestamps
   were used, subtitles would appear in the wrong place -- and that would
   only be discovered after rendering is complete.

3. CROP FIRST, THEN SCALE, not the other way around.
   Cropping at source resolution preserves detail; scaling first then
   cropping discards sharpness.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .ffmpeg_tools import _require, has_encoder
from .models import Transcript, Word

# The "klipian" watermark font is bundled here (not just relying on Google
# Fonts like the UI does) -- rendering is done via ffmpeg/libass on the
# local machine, which can't "borrow" web fonts. fontsdir points to this
# folder so libass finds "Mona Sans ExtraBold" without it needing to be
# installed as a system font.
FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"


def _escape_filter_path(p: str) -> str:
    """Characters that have syntactic meaning in FFmpeg filter graphs must
    be escaped: backslash, colon (Windows drive letter), single quote
    (string delimiter), brackets (label), semicolons (separator), equals
    (option). Used for any external file path inserted into a
    filter_complex string -- ASS (build_filter) or sendcmd
    (_concat_filter, head tracking)."""
    p = p.replace("\\", "/").replace(":", r"\:")
    p = p.replace("'", r"\'").replace("[", r"\[").replace("]", r"\]")
    return p.replace(";", r"\;").replace("=", r"\=")


@dataclass
class Span:
    """One cut. `crop` is optional: if provided, this cut is framed
    independently -- that's what allows framing to shift mid-clip. If None,
    the RenderJob's crop is used.

    `crops` holds TWO boxes for a split frame: first box becomes the top,
    second box the bottom, stacked into one 9:16 frame. Used when two
    people in a podcast sit far apart and both need to be visible. If
    `crops` is set, `crop` is ignored.

    `tracking` OPTIONAL: list of {t, left} (t seconds relative to the
    START of this cut itself, left percent) -- if set, the X of the
    `crop` box moves following this trajectory throughout the cut (see
    sendcmd in _concat_filter), instead of staying at one position.
    Y/width/height still follow `crop` as usual. None/empty = this cut is
    static like before the head tracking feature existed -- the default,
    not auto-detected; enabled manually per framing point in the UI."""
    start: float
    end: float
    crop: "CropBox | None" = None
    crops: "list[CropBox] | None" = None
    tracking: "list[dict] | None" = None

    @property
    def length(self) -> float:
        return self.end - self.start


@dataclass
class CropBox:
    """Crop range in PERCENT of source frame, not pixels -- so it doesn't
    depend on the source resolution."""
    left: float = 37.0
    top: float = 4.0
    width: float = 26.0
    height: float = 92.0


@dataclass
class RenderJob:
    title: str
    spans: list[Span]
    crop: CropBox = field(default_factory=CropBox)
    layout: str = "face"          # face | blur
    out_width: int = 1080

    def __post_init__(self):
        # Validate cuts: must be sorted & non-overlapping
        for i, p in enumerate(self.spans):
            if p.end <= p.start:
                raise ValueError(
                    f"Cut #{i+1} is invalid: end ({p.end}) "
                    f"must be greater than start ({p.start})")
            if i > 0 and p.start < self.spans[i-1].end:
                raise ValueError(
                    f"Cut #{i+1} overlaps with cut #{i}")

    @property
    def out_height(self) -> int:
        # Rounded to even: yuv420p (used for encoding) rejects odd dimensions.
        # out_width=1000 -> 1777 odd -> ffmpeg "height not divisible by 2".
        h = self.out_width * 16 // 9
        return h - (h & 1)

    @property
    def duration(self) -> float:
        return sum(p.length for p in self.spans)


# --------------------------------------------------------------------------
# caption
# --------------------------------------------------------------------------

def _ass_time(d: float) -> str:
    d = max(0.0, d)
    j = int(d // 3600)
    m = int((d % 3600) // 60)
    dt = d % 60
    return f"{j}:{m:02d}:{dt:05.2f}"


def _ass_escape(text: str) -> str:
    r"""Neutralize characters that have special meaning in ASS Dialogue text.

    `{` opens override blocks (`{\b1}`), `\` starts tags. Transcripts
    containing these characters -- e.g. text "{music}" -- would be
    interpreted as style commands instead of displayed. `\h` (hard space)
    is used so the replacement isn't swallowed as an empty override."""
    return (text.replace("\\", r"\\")
                .replace("{", r"\{")
                .replace("}", r"\}"))


def to_output_time(spans: list[Span], seconds: float) -> float | None:
    """Map source time -> output time. None if it falls in a discarded segment."""
    elapsed = 0.0
    for p in spans:
        if seconds < p.start:
            return None
        if seconds <= p.end:
            return elapsed + (seconds - p.start)
        elapsed += p.length
    return None


# Safe area bounds in the preview panel (see .safe in ui/app.css,
# top:16%, bottom:20%) -- the "Top"/"Bottom" watermark positions are
# DELIBERATELY placed OUTSIDE these lines (above the top, below the
# bottom), not inside them. The watermark isn't main content; if a
# platform UI overlay (share button, etc.) covers the edges, let the
# watermark give way first, not the face/caption.
SAFE_AREA_TOP_PERCENT = 16.0
SAFE_AREA_BOTTOM_PERCENT = 20.0


def _watermark_placement(mode: str, size: float, H: int,
                          caption_margin_bottom: int) -> tuple[int, int]:
    """(ASS Alignment, MarginV) for watermark positioning.

    Text line height is estimated at 1.3x font size -- ASS has no way to
    measure actual glyph height without truly rendering first, so this is
    an approximation, not pixel-precise. Close enough for a short one-line
    watermark like "klipian"."""
    line_height = size * 1.3
    if mode == "top":
        # Alignment 8 = top-center, MarginV counted from TOP. The bottom
        # edge of the watermark is placed right at the SAFE_AREA_TOP_PERCENT line.
        margin = max(0, int(H * SAFE_AREA_TOP_PERCENT / 100 - line_height))
        return 8, margin
    if mode == "middle":
        # Alignment 5 = dead center (vertical AND horizontal) -- MarginV
        # doesn't apply for this alignment, libass ignores it.
        return 5, 0
    # "bottom": two conditions simultaneously -- (a) right BELOW caption,
    # margin smaller than caption margin (closer to the edge) regardless of
    # which caption position is chosen, BUT (b) the ENTIRE text box (not
    # just its anchor point) must not enter the safe zone -- if the caption
    # is at Middle/Top, condition (a) alone can push the watermark INTO the
    # safe zone (real report: watermark was found above the bottom safe
    # zone line). The TOP edge of the watermark (margin + line_height,
    # because Alignment 2 grows upward from its anchor) is what's clamped
    # to not cross SAFE_AREA_BOTTOM_PERCENT -- mirror image of the "top"
    # logic above.
    caption_bottom_margin = max(int(H * 0.02),
                               caption_margin_bottom - int(line_height) - int(H * 0.01))
    margin_maks_zona_aman = max(0, int(H * SAFE_AREA_BOTTOM_PERCENT / 100 - line_height))
    margin = min(caption_bottom_margin, margin_maks_zona_aman)
    return 2, margin


def build_ass(job: RenderJob, words: list[Word] | None, style: dict | None = None) -> str:
    """Karaoke captions: one event per word, showing the full line with the
    currently-spoken word highlighted. The "klipian" watermark is also
    written here -- one static Dialogue spanning the entire video, not
    per-word like captions -- so there's only one ASS file and one `ass=`
    filter for ffmpeg to run, not two separate subtitle layers.

    `words` may be None: the watermark-without-transcript path writes ASS
    with no caption words at all."""
    words = words or []
    # Colors are written in ASS &HAABBGGRR& format -- order is
    # BLUE-GREEN-RED, opposite of web hex. Gold #FFD600 becomes &H0000D6FF&.
    g = {"font": "Arial", "size": 84, "per_line": 3,
         "outline": 4, "position": 24,
         "color": "&H00FFFFFF&",          # base text color
         "highlight": "&H0000D6FF&",      # color of the currently-spoken word
         "watermark": True,               # on/off toggle from the Captions screen
         "watermark_size": 32,
         "watermark_opacity": "80",       # ASS alpha: 00 fully opaque .. FF invisible
         "watermark_position": "bottom",  # top | middle | bottom
         **(style or {})}

    W, H = job.out_width, job.out_height
    margin_bottom = int(H * g["position"] / 100)
    # Style lines use the form without trailing "&", the \c tag uses the form with.
    warna_style = g["color"].rstrip("&")

    wm_align, wm_margin = _watermark_placement(
        g["watermark_position"], g["watermark_size"], H, margin_bottom)
    # The SAME alpha is applied to the FILL color *and* the OUTLINE color --
    # previously only the fill followed watermark_opacity, the outline was
    # locked to solid black. On bright backgrounds that black outline stays
    # contrasting regardless of chosen opacity -- it looks like "fill fades,
    # outline doesn't", not the watermark fading as a whole (real report
    # from ian, and it was indeed correct). ASS has no per-element "opacity"
    # property like CSS -- the alpha channel of THIS color is the only way,
    # so the fix is to match the alpha across all colors used, not to look
    # for an opacity property that doesn't exist.
    wm_color = f"&H{g['watermark_opacity']}FFFFFF"
    wm_outline_color = f"&H{g['watermark_opacity']}000000"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Utama,{g['font']},{g['size']},{warna_style},&H00000000,&H80000000,1,1,{g['outline']},0,2,60,60,{margin_bottom},1
Style: Watermark,Mona Sans ExtraBold,{g['watermark_size']},{wm_color},{wm_outline_color},&H60000000,0,1,1,0,{wm_align},60,60,{wm_margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    if g["watermark"]:
        header += (
            f"Dialogue: 0,{_ass_time(0)},{_ass_time(job.duration)},"
            f"Watermark,,0,0,0,,klipian\n")

    # only words that actually land in the output
    used = []
    for w in words:
        a = to_output_time(job.spans, w.start)
        b = to_output_time(job.spans, w.end)
        # Words that straddle a cut boundary (cut falls in the middle of a
        # word, or a word bridges two adjacent cuts): one end is None.
        # Don't discard -- clamp to the overlapping segment so the word
        # still appears while the audio is audible.
        if a is None or b is None:
            for p in job.spans:
                if w.end > p.start and w.start < p.end:      # ada irisan
                    a = to_output_time(job.spans, max(w.start, p.start))
                    b = to_output_time(job.spans, min(w.end, p.end))
                    break
        teks = _ass_escape(w.text.strip())
        if a is not None and b is not None and b > a and teks:
            used.append((a, b, teks))

    events = []
    per_line = max(1, int(g["per_line"]))   # 0/negative would crash range()
    for i in range(0, len(used), per_line):
        group = used[i:i + per_line]
        # When the next group starts. The last word in each group must hold
        # until that point -- if it only lasts to its own end, captions
        # flicker at every line break.
        next_start = used[i + per_line][0] if i + per_line < len(used) else None

        for j, (a, b, _) in enumerate(group):
            text = " ".join(
                (r"{\c" + g["highlight"] + "}" + t + r"{\c" + g["color"] + "}") if k == j else t
                for k, (_, _, t) in enumerate(group)
            )
            if j < len(group) - 1:
                end = group[j + 1][0]          # until the next word
            elif next_start is not None:
                end = next_start               # until the next line
            else:
                end = b + 0.4                     # last line, give some breathing room
            events.append(
                f"Dialogue: 0,{_ass_time(a)},{_ass_time(end)},Utama,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


# --------------------------------------------------------------------------
# ffmpeg
# --------------------------------------------------------------------------

def _concat_filter(job: "RenderJob", src_width: int, src_height: int,
                   crop_first: bool, dest: "Path | None" = None) -> str:
    """Cut each segment then join. setpts/asetpts are mandatory -- without
    them the second segment inherits its original timestamp and the output
    jumps.

    crop_first=True frames EACH segment before joining, not after. That's
    what allows framing to shift mid-clip: cut 1 points at the left
    person, cut 2 points at the right person.

    Segments with `crops` are split-framed: cut twice from the same frame
    then stacked top-to-bottom. So a clip can alternate between one frame
    and two frames at any point.

    Segments with `tracking` (head tracking, optional per framing point)
    have their X MOVING along a trajectory via the `sendcmd` filter --
    see the block below for why each tracked segment needs its OWN
    COMMAND FILE (not one shared across all). `dest` is required when ANY
    span is tracked (used to form the command file name, in the same
    folder as the render destination -- same pattern as `ass_path` in
    render()); not used at all when no span is tracked.
    """
    even = lambda v: max(2, int(v) // 2 * 2)
    W, H = job.out_width, job.out_height

    def box_pixels(c: "CropBox") -> tuple[int, int, int, int]:
        # Size & offset are clamped to fit within the source frame: if
        # left+width>100 (e.g. framing point dragged to the right edge)
        # ffmpeg aborts with "Invalid too big or non positive size". Clamp
        # width first, then offset so x+w never exceeds the boundary.
        cw = even(min(src_width, src_width * c.width / 100))
        ch = even(min(src_height, src_height * c.height / 100))
        cx = even(max(0, min(src_width - cw, src_width * c.left / 100)))
        cy = even(max(0, min(src_height - ch, src_height * c.top / 100)))
        return cw, ch, cx, cy

    def box(c: "CropBox") -> str:
        cw, ch, cx, cy = box_pixels(c)
        return f"crop={cw}:{ch}:{cx}:{cy}"

    parts = []
    for i, span in enumerate(job.spans):
        v = f"[0:v]trim=start={span.start:.3f}:end={span.end:.3f},setpts=PTS-STARTPTS"
        if crop_first and span.crops and len(span.crops) >= 2:
            # Split frame: ONE segment cut twice then stacked. split=2 is
            # mandatory -- a single filter output can't be used twice as
            # input. Head tracking is NOT supported in split format (v1) --
            # span.tracking is ignored here if it ever shows up, since the
            # client never sends it for Split-format points anyway.
            top, bottom = span.crops[0], span.crops[1]
            h2 = even(H / 2)
            parts.append(f"{v},split=2[s{i}a][s{i}b]")
            parts.append(f"[s{i}a]{box(top)},scale={W}:{h2},setsar=1[c{i}a]")
            parts.append(f"[s{i}b]{box(bottom)},scale={W}:{h2},setsar=1[c{i}b]")
            # Closing scale keeps height at H when H/2 is rounded.
            parts.append(f"[c{i}a][c{i}b]vstack=inputs=2,scale={W}:{H},setsar=1[v{i}]")
            parts.append(f"[0:a]atrim=start={span.start:.3f}:end={span.end:.3f},"
                         f"asetpts=PTS-STARTPTS[a{i}]")
            continue
        if crop_first:
            c = span.crop or job.crop
            if span.tracking and len(span.tracking) >= 2:
                # This box's X MOVES along a trajectory (head tracking),
                # not static -- Y/width/height remain fixed from `c` as
                # usual (only the X axis is tracked, consistent with
                # facebox.py). The box gets a UNIQUE id (@trk{i}) and is
                # controlled via sendcmd from a command file SPECIFIC to
                # this segment.
                #
                # WHY ONE FILE PER SEGMENT, not one file shared across all
                # tracked segments: `t` inside sendcmd is relative to the
                # LOCAL time of the segment that READS the file (0 at the
                # segment start, because setpts above resets each segment
                # to 0 independently). If one file contained lines for
                # MULTIPLE segments at once, sendcmd for segment A would
                # also try to execute segment B's lines whenever A's local
                # time happens to match B's numbers -- wrong box change, in
                # the WRONG segment. Separate files per segment close this
                # gap entirely: sendcmd for this segment only ever reads
                # lines belonging to this segment itself.
                if dest is None:
                    raise RuntimeError(
                        "internal: _concat_filter needs `dest` for a span "
                        "that is tracked (head tracking).")
                cw, ch, _, cy = box_pixels(c)

                def cx_from_percent(percent: float, _cw=cw) -> int:
                    return even(max(0, min(src_width - _cw, src_width * percent / 100)))

                tag = f"trk{i}"
                cmd_path = dest.parent / f"{dest.stem}.track{i}.cmd"
                # The target in command lines MUST be the full "crop@id" form,
                # not a bare id -- confirmed by direct testing: bare ids only
                # "happen to work" when the id matches the filter name
                # ("crop"), and SILENTLY fail (no error at all, just never
                # moves) for any custom id other than that.
                lines = [
                    f"{kf['t']:.3f} crop@{tag} x {cx_from_percent(kf['left'])};"
                    for kf in span.tracking
                ]
                cmd_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                x0 = cx_from_percent(span.tracking[0]["left"])
                cmd_esc = _escape_filter_path(str(cmd_path))
                v += (f",crop@{tag}={cw}:{ch}:{x0}:{cy},scale={W}:{H},setsar=1,"
                     f"sendcmd=f='{cmd_esc}'")
            else:
                v += f",{box(c)},scale={W}:{H},setsar=1"
        parts.append(f"{v}[v{i}]")
        parts.append(f"[0:a]atrim=start={span.start:.3f}:end={span.end:.3f},"
                     f"asetpts=PTS-STARTPTS[a{i}]")
    n = len(job.spans)
    inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
    parts.append(f"{inputs}concat=n={n}:v=1:a=1[vc][ac]")
    return ";".join(parts)


def build_filter(job: RenderJob, src_width: int, src_height: int,
                 ass_path: Path | None, dest: Path | None = None) -> str:
    # Blur layout uses the full frame, so crop is meaningless; segments
    # are joined first then blurred. Face layout is the opposite: each
    # segment is framed independently so framing can shift.
    crop_first = job.layout != "blur"
    # `dest` is only used by _concat_filter() when ANY span is tracked
    # (head tracking) -- see the per-segment file reasoning there.
    trim_chain = _concat_filter(job, src_width, src_height, crop_first, dest)

    even = lambda v: max(2, int(v) // 2 * 2)
    W, H = job.out_width, job.out_height

    if job.layout == "blur":
        # background: full frame scaled and blurred; foreground: full frame
        video_chain = (
            f"[vc]split=2[bg][fg];"
            f"[bg]crop={even(src_height*9/16)}:{src_height}:{even((src_width-src_height*9/16)/2)}:0,"
            f"scale={W}:{H},gblur=sigma=28[bgb];"
            f"[fg]scale={W}:-2[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[vv]"
        )
    else:
        # already cropped and scaled per segment above
        video_chain = "[vc]null[vv]"

    if ass_path:
        path = _escape_filter_path(str(ass_path))
        # fontsdir points libass to assets/fonts/ -- without this "Mona Sans
        # ExtraBold" (used by the Watermark style in build_ass) won't be
        # found unless it happens to be installed as a system font, and
        # libass silently falls back to a substitute font that doesn't look
        # anything like the logo.
        fontsdir = _escape_filter_path(str(FONTS_DIR))
        video_chain += f";[vv]ass='{path}':fontsdir='{fontsdir}'[vout]"
    else:
        video_chain += ";[vv]null[vout]"

    return trim_chain + ";" + video_chain


def safe_filename(title: str, fallback: str) -> str:
    """Clip title -> filename. One rule, used by both server and CLI.

    Previously this logic was reimplemented in three places with two
    different behaviors, so the name displayed by the UI didn't always
    match what was actually written to disk.
    """
    kept = "".join(c if c.isalnum() or c in "- " else " " for c in title)
    name = "-".join(kept.lower().split())
    return (name or fallback) + ".mp4"


class RenderCancelled(RuntimeError):
    """Render stopped on request (e.g. Cancel button in the UI)."""


def render(source: Path, job: RenderJob, dest: Path,
           words: list[Word] | None = None, style: dict | None = None,
           src_width: int = 1920, src_height: int = 1080,
           has_audio: bool = True, verbose: bool = True,
           cancel_check=None) -> Path:
    """cancel_check: zero-argument callable that returns True if the render
    should be cancelled. Checked periodically while ffmpeg runs; if True,
    the ffmpeg process is killed and RenderCancelled is raised."""
    if not job.spans:
        raise RuntimeError("No spans to render.")
    if not has_audio:
        # The filter graph below always uses [0:a]. Without this guard ffmpeg
        # fails with "Stream specifier ':a' in filtergraph description" --
        # a message that means nothing to the user.
        raise RuntimeError(
            f"{source.name} has no audio track, so it cannot be turned into "
            f"a clip. Use a source file that has sound.")

    ffmpeg = _require("ffmpeg")
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Previously the ASS file was only created when THERE WERE caption words
    # (`if words:`) -- reasonable while ASS was only for captions. Now the
    # watermark also goes through the same file (see build_ass()), and it
    # must still appear even with zero words (transcript not yet available,
    # or captions deliberately turned off) -- so the gate is now "is there
    # ANYTHING that needs writing to ASS", not "are there words".
    watermark_enabled = (style or {}).get("watermark", True)
    ass_path = None
    if words or watermark_enabled:
        ass_path = dest.with_suffix(".ass")
        ass_path.write_text(build_ass(job, words, style), encoding="utf-8")

    try:
        filt = build_filter(job, src_width, src_height, ass_path, dest)

        def build_cmd(encoder: str) -> list[str]:
            return [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-stats",
                "-i", str(source),
                "-filter_complex", filt,
                "-map", "[vout]", "-map", "[ac]",
                "-c:v", encoder,
                *(["-global_quality", "24", "-preset", "medium"] if encoder == "h264_qsv"
                  else ["-crf", "21", "-preset", "medium"]),
                "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                str(dest),
            ]

        # has_encoder only proves the encoder exists in this ffmpeg build, not
        # that the driver on this machine can use it. If QSV fails, retry
        # once with libx264 -- slower, but it works, and that's what the
        # user needs.
        encoder_order = ["h264_qsv", "libx264"] if has_encoder("h264_qsv") else ["libx264"]
        result_err = None
        for i, encoder in enumerate(encoder_order):
            if verbose:
                print(f"  encoder  : {encoder}")
                if i == 0:
                    print(f"  spans    : {len(job.spans)}  ·  duration {job.duration:.1f}s")

            code, result_err = _run_ffmpeg(build_cmd(encoder), cancel_check, dest)
            if code == 0:
                return dest
            if i < len(encoder_order) - 1 and verbose:
                print(f"  {encoder} failed, retrying with {encoder_order[i+1]}")

        tail = (result_err or "").strip().splitlines()[-14:]
        raise RuntimeError("ffmpeg failed:\n" + "\n".join(tail))

    finally:
        # Clean up leftover ASS file if render failed
        if ass_path and ass_path.exists():
            ass_path.unlink(missing_ok=True)
        # sendcmd command files (head tracking) -- one per tracked segment,
        # written directly by _concat_filter(). The names aren't known here
        # (formed inside that function), so they're found by name pattern
        # instead of an explicit path list.
        for cmd_path in dest.parent.glob(f"{dest.stem}.track*.cmd"):
            cmd_path.unlink(missing_ok=True)


def _run_ffmpeg(cmd: list[str], cancel_check, dest: Path) -> tuple[int, str]:
    """Run ffmpeg with cancellation support. Return (returncode, stderr).

    Uses Popen + poll, not subprocess.run, so cancel_check can be
    checked periodically and ffmpeg killed mid-encode -- not just between
    clips. A 1-hour timeout is enforced. If cancelled, the partial output
    file is deleted."""
    import time as _time
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    mulai = _time.time()
    try:
        while True:
            try:
                _, err = proc.communicate(timeout=0.5)
                stderr = err.decode("utf-8", "replace") if err else ""
                return proc.returncode, stderr
            except subprocess.TimeoutExpired:
                pass                                # still running
            if cancel_check and cancel_check():
                proc.kill()
                proc.wait()
                dest.unlink(missing_ok=True)        # discard partial output
                raise RenderCancelled("Render cancelled.")
            if _time.time() - mulai > 3600:
                proc.kill()
                proc.wait()
                raise RuntimeError(
                    "Render exceeded 1 hour and was stopped -- the source "
                    "file may be corrupt or on a network drive that hung.")
    except RenderCancelled:
        raise
    except Exception:
        proc.kill()
        raise
