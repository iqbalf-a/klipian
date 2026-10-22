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

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .ffmpeg_tools import _require, has_encoder
from .models import Word

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


# The shape of the PICTURE inside the 9:16 file (Output Format > Picture).
#   9:16  fills the file: each span cropped to a 9:16 box (what "Crop" was).
#   3:4   each span cropped to a 3:4 box, scaled to the file's width, placed at
#         `position` in the 9:16 canvas.
#   16:9  the whole source frame, scaled to the file's width, placed the same
#         way (what "Blur background" was, with Background = blur).
# The canvas around a 3:4 or 16:9 picture is black or a blurred copy of it.
PICTURES = ("9:16", "16:9", "3:4")
BACKGROUNDS = ("blur", "black")


def picture_options(k: dict) -> dict:
    """picture / background / position of a render request's clip, as RenderJob
    keyword arguments. Requests recorded before pictures existed carry
    `layout` ("face" or "blur") instead: "blur" was the whole frame over a
    blurred copy, i.e. picture 16:9 + blur + centred; "face" was 9:16."""
    picture = k.get("picture")
    if picture not in PICTURES:
        picture = "16:9" if k.get("layout") == "blur" else "9:16"
    background = k.get("background") if k.get("background") in BACKGROUNDS else "blur"
    try:
        position = float(k.get("position", 50))
    except (TypeError, ValueError):
        position = 50.0
    if position != position:               # NaN
        position = 50.0
    return {"picture": picture, "background": background,
            "position": max(0.0, min(100.0, position))}


@dataclass
class RenderJob:
    title: str
    spans: list[Span]
    crop: CropBox = field(default_factory=CropBox)
    picture: str = "9:16"
    background: str = "blur"      # blur | black -- around a 3:4 or 16:9 picture
    # How far down the free vertical space the picture sits, 0 (top) to 100
    # (bottom). 50 centres it, which is how the whole-frame layout always sat.
    position: float = 50.0
    out_width: int = 1080
    # x264's CRF: LOWER is better quality and a bigger file. 21 is what the
    # encoder call was hardcoded to before the Settings screen let this be
    # chosen, and stays the default -- a render that sends no quality comes
    # out exactly as it used to.
    quality: int = 21

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
    def picture_height(self) -> int:
        """Height of a CROPPED picture inside the file: the whole canvas for
        9:16, a 3:4 box scaled to the file's width for 3:4. (16:9 is the whole
        source frame, so its height depends on the source and is not known
        here.)"""
        if self.picture == "3:4":
            h = self.out_width * 4 // 3
            return h - (h & 1)
        return self.out_height

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


# Alignment 2 (bottom-centre) puts the text midway between MarginL and
# MarginR, so moving the pair in opposite directions moves that centre.
# That's how X position works here, rather than a pos() override on every
# single line: the side margins also bound where the text WRAPS, so a
# shifted caption still can't run off the frame.
BASE_SIDE_MARGIN = 60

# The frame the subtitle layer is authored against, whatever the render's
# actual resolution. Everything in the ASS -- Fontsize, margins, the drawn
# box -- is expressed in this space, and libass scales it to the output.
# 1080x1920 because that's what the UI has always previewed against
# (PLAYRES_Y_DEFAULT in interactions.js), so the two finally agree.
REF_W, REF_H = 1080, 1920


# ── rounded highlight box ────────────────────────────────────────────────
# ASS has no rounded box: BorderStyle 3 draws a hard rectangle and there is
# no radius property. \blur only smears the whole box (tried it). The only
# shape ASS can round is one we draw ourselves in \p1 drawing mode -- and to
# place that we have to know where the word lands, which means measuring the
# text the way libass will lay it out.
#
# Everything here is best-effort on purpose. Pillow is NOT a declared
# dependency (requirements.txt is deliberately light), the font file has to
# be found on this machine, and the measurement has no HarfBuzz shaping
# while libass does. Any of those failing returns None, and build_ass falls
# back to the square BorderStyle 3 box -- which is always correctly placed,
# because libass places it. A square box beats a rounded one in the wrong
# spot.
_FONT_FILES = {
    "arial": ("arial.ttf", "arialbd.ttf"),
    "impact": ("impact.ttf", "impact.ttf"),      # Impact ships one weight
    "verdana": ("verdana.ttf", "verdanab.ttf"),
}
_FONT_DIRS = [
    Path("C:/Windows/Fonts"),
    Path("/usr/share/fonts"), Path("/usr/local/share/fonts"),
    Path.home() / ".fonts", Path("/Library/Fonts"), Path.home() / "Library/Fonts",
]


def _font_path(name: str, bold: bool = True) -> Path | None:
    files = _FONT_FILES.get(name.strip().lower())
    if not files:
        return None
    wanted = files[1] if bold else files[0]
    for d in _FONT_DIRS:
        if not d.is_dir():
            continue
        hit = d / wanted
        if hit.is_file():
            return hit
        # Linux buries them a few levels down
        for found in d.rglob(wanted):
            return found
    return None


def _measure(font_name: str, size: int):
    """(width_of, space_width, ascent, descent), or None if it can't be done.

    width_of is a callable rather than a precomputed list so the caller can
    measure line by line, without having to hand over every word up front."""
    try:
        from PIL import ImageFont            # noqa: PLC0415 -- optional
    except ImportError:
        return None
    path = _font_path(font_name)
    if not path:
        return None
    try:
        f = ImageFont.truetype(str(path), size)
        asc, desc = f.getmetrics()
        return f.getlength, f.getlength(" "), asc, desc
    except OSError:
        return None


def _rounded_rect(x0: int, y0: int, x1: int, y1: int, r: int) -> str:
    """ASS \\p1 drawing commands for a rounded rectangle.

    The corners are beziers whose two control points sit ON the corner,
    which is the standard way to approximate a quarter circle closely
    enough at these sizes."""
    r = max(0, min(r, (x1 - x0) // 2, (y1 - y0) // 2))
    return (f"m {x0+r} {y0} l {x1-r} {y0} b {x1} {y0} {x1} {y0} {x1} {y0+r} "
            f"l {x1} {y1-r} b {x1} {y1} {x1} {y1} {x1-r} {y1} "
            f"l {x0+r} {y1} b {x0} {y1} {x0} {y1} {x0} {y1-r} "
            f"l {x0} {y0+r} b {x0} {y0} {x0} {y0} {x0+r} {y0}")


def _side_margins(x_percent: float, W: int) -> tuple[int, int]:
    """(MarginL, MarginR) for a centre shifted x_percent of the width.

    The side being moved away from keeps the base margin and the other grows
    by twice the shift, since the centre only moves by half the difference.
    A shift big enough to squeeze the text box is the caller's business --
    the UI caps its slider well before that (see CAPTION_OPTIONS)."""
    shift = int(W * x_percent / 100)
    if shift >= 0:
        return BASE_SIDE_MARGIN + 2 * shift, BASE_SIDE_MARGIN
    return BASE_SIDE_MARGIN, BASE_SIDE_MARGIN - 2 * shift


# --------------------------------------------------------------------------
# when each caption word is on screen (shared with the editor's preview)
# --------------------------------------------------------------------------
#
# THE RULES -- ui/js/shared/captionplan.js has the same function and must give the SAME numbers
# (selftest check `captions` runs both on one word list):
#
#  1. Lines break at pauses. A new line starts when the gap between two consecutive words is above
#     PAUSE_SPLIT, after a word that ends in . ? ! , and after a word that ends in a comma when the
#     line already has two words or more. `per_line` is a MAXIMUM: a line may have one word.
#  2. No text during silence. A word's window runs from its own start to the start of the next word
#     (of the same line or of the next line) when that gap is at most HOLD_GAP (= PAUSE_SPLIT: a gap above it starts a new line, so within a
#     line the text never blanks), so short gaps do not
#     flicker; otherwise it ends TAIL after its own end. The last word of the clip: its end + TAIL.
#  3. Reveal. "spoken" (default) shows only the words that have started (the rest of the line is laid
#     out but invisible, so nothing shifts when they appear); "line" shows the whole line from the
#     first word's start, as it always did, but within the windows of rule 2.
#  4. The highlighted word is the one whose window it is.
PAUSE_SPLIT = 0.35      # seconds of silence between two words that starts a new line
HOLD_GAP = PAUSE_SPLIT  # a gap up to this is bridged (the word stays until the next one starts): the SAME
#                         number as the line break, so inside a line no gap is ever blank
TAIL = 0.15             # how long a word stays after it ended, when it is not bridged
_SENTENCE_END = re.compile(r"[.?!]$")


def _ends_with(text: str, pattern: "re.Pattern[str]") -> bool:
    return bool(pattern.search(text.rstrip("\"'\u201d\u2019)]}")))


def caption_plan(used: list, per_line: int) -> list[dict]:
    """Lines of caption words and the window of each word. `used` = [(start, end, text)] in output
    order. Returns [{"words": [(a, b, text)...], "windows": [(start, end)...]}] with one window per
    word (start == the word's start; end <= start means the window is empty and is skipped)."""
    per_line = max(1, int(per_line))
    lines: list[list] = []
    cur: list = []
    for w in used:
        if cur and (len(cur) >= per_line or w[0] - cur[-1][1] > PAUSE_SPLIT):
            lines.append(cur)
            cur = []
        cur.append(w)
        t = w[2]
        if _ends_with(t, _SENTENCE_END) or (len(cur) >= 2 and _ends_with(t, re.compile(r",$"))):
            lines.append(cur)
            cur = []
    if cur:
        lines.append(cur)
    flat = [w for line in lines for w in line]
    plan = []
    n = 0
    for line in lines:
        windows = []
        for j, (a, b, _t) in enumerate(line):
            nxt = flat[n + j + 1] if n + j + 1 < len(flat) else None
            end = nxt[0] if (nxt is not None and nxt[0] - b <= HOLD_GAP) else b + TAIL
            windows.append((a, end))
        n += len(line)
        plan.append({"words": line, "windows": windows})
    return plan


def caption_at(used: list, per_line: int, reveal: str, t: float) -> dict | None:
    """What is on screen at output time `t`: {"words", "shown", "highlight"} or None (same as the
    editor's captionAt). `shown` = how many words of the line are visible."""
    for line in caption_plan(used, per_line):
        for j, (s, e) in enumerate(line["windows"]):
            if e > s and s <= t < e:
                return {"words": line["words"], "shown": len(line["words"]) if reveal == "line" else j + 1,
                        "highlight": j}
    return None


def _merged(windows: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Non-empty windows with the ones that touch joined into one."""
    out: list[list[float]] = []
    for s, e in windows:
        if e <= s:
            continue
        if out and abs(out[-1][1] - s) < 1e-9:
            out[-1][1] = e
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


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
    # position/x and their watermark twins are percentages: position is the
    # distance up from the bottom edge, x the offset from the centre (0 =
    # centred, negative = left). Every default below reproduces what the
    # three-choice version produced, so a style that doesn't set them renders
    # exactly as it did before -- watermark_y's 18 included, which is where
    # the old "bottom" mode landed it under a default caption.
    g = {"font": "Arial", "size": 84, "per_line": 3,
         "reveal": "spoken",              # "spoken": only the words already said show; "line": the whole line

         "outline": 4, "position": 24, "x": 0,
         "color": "&H00FFFFFF&",          # base text color
         "highlight": "&H0000D6FF&",      # color of the currently-spoken word
         # "text" recolours the spoken word, "box" puts it in a filled box.
         # Defaulting to "text" is what keeps every style written before this
         # rendering exactly as it did.
         "highlight_style": "text",
         "watermark": True,               # on/off toggle from the Captions screen
         "watermark_size": 32,
         "watermark_opacity": "80",       # ASS alpha: 00 fully opaque .. FF invisible
         "watermark_y": 18, "watermark_x": 0,
         **(style or {})}

    # The ASS coordinate system is FIXED at the reference frame, not the
    # output size. PlayResX/Y is exactly that -- a coordinate space libass
    # scales to whatever frame it draws into -- and using the output size
    # instead made every absolute number mean a different thing per
    # resolution: Fontsize 84 is 4.4% of a 1920-tall frame but 6.6% of a
    # 1280-tall one, so the same style burned 50% larger at 720p than the
    # preview showed. Big enough to push a line off the frame, which is how
    # ian found it.
    #
    # Sizes and margins are authored once, here, and scale with the render.
    # Checked: text rendered from this space into a 4K frame is as sharp as
    # text authored at 4K natively -- libass scales the coordinates and
    # rasterises at the target, it does not blow up a bitmap.
    W, H = REF_W, REF_H
    margin_bottom = int(H * g["position"] / 100)
    margin_left, margin_right = _side_margins(g["x"], W)
    # Both are Alignment 2 now. The watermark used to derive its placement
    # from the caption's (see git history for _watermark_placement) so it
    # always sat just below it; ian asked for the two to be positioned
    # independently, so it carries its own percentages like the caption.
    wm_margin = int(H * g["watermark_y"] / 100)
    wm_left, wm_right = _side_margins(g["watermark_x"], W)
    # Style lines use the form without trailing "&", the \c tag uses the form with.
    warna_style = g["color"].rstrip("&")

    # BorderStyle 3 makes the outline an opaque box drawn in OutlineColour,
    # and libass draws one PER SPAN -- which is what makes a box on a single
    # word possible at all, since ASS has no inline tag for BorderStyle. So
    # in box mode the outline colour becomes the highlight colour and the
    # Outline number becomes the box's padding.
    #
    # The cost, and it's deliberate (ian chose it): a word's outline and its
    # box are the same feature, so the words that AREN'T being spoken have no
    # outline at all in this mode. Plain white text, exactly like the
    # reference -- legible on most footage, thin on very bright footage.
    box_highlight = g["highlight_style"] == "box"
    # Rounded needs the word positions, so it only happens when the text can
    # actually be measured (see _measure). Otherwise box mode still works --
    # as the square BorderStyle 3 box, placed by libass itself.
    rounded = _measure(g["font"], int(g["size"])) if box_highlight else None
    square_box = box_highlight and not rounded
    # With a drawn box the text layer goes back to being ordinary outlined
    # text: the highlight is the shape underneath it, not the border.
    border_style = 3 if square_box else 1
    border_colour = (g["highlight"] if square_box else "&H00000000&").rstrip("&")

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
Style: Utama,{g['font']},{g['size']},{warna_style},{border_colour},&H80000000,1,{border_style},{g['outline']},0,2,{margin_left},{margin_right},{margin_bottom},1
Style: Kotak,{g['font']},{g['size']},{g['highlight'].rstrip('&')},&H00000000,&H00000000,0,1,0,0,7,0,0,0,1
Style: Watermark,Mona Sans ExtraBold,{g['watermark_size']},{wm_color},{wm_outline_color},&H60000000,0,1,1,0,2,{wm_left},{wm_right},{wm_margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    # The watermark's words: "klipian" unless the profile (or style) says otherwise.
    wm_text = re.sub(r"[{}\\\r\n]", " ", str(g.get("watermark_text") or "klipian")).strip()[:40] or "klipian"
    if g["watermark"]:
        header += (
            f"Dialogue: 0,{_ass_time(0)},{_ass_time(job.duration)},"
            f"Watermark,,0,0,0,,{wm_text}\n")

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
    per_line = max(1, int(g["per_line"]))   # a MAXIMUM now (see caption_plan); 0/negative must not crash
    spoken = g.get("reveal") != "line"       # "As spoken" (default): only the words that have started

    # Rounded box mode: the box is a shape we draw and position ourselves,
    # so the text layer no longer has to carry the highlight at all. Each
    # word gets its own text event plus one drawing event per word.
    for line in caption_plan(used, per_line):
        group, windows = line["words"], line["windows"]

        # Where each word in this line starts and ends across the frame,
        # rebuilding the layout libass is about to perform: the line is
        # centred between the side margins, words separated by one space.
        spans_x = None
        if rounded:
            width_of, _space_w, asc, desc = rounded
            texts = [t for _, _, t in group]
            # Measured as PREFIXES of the real line, not as a sum of word
            # widths plus a space each. Same reason libass gets it right:
            # the width of "Dia itu suka" is not the width of its parts
            # added up -- the pairs between them kern. Summing made the
            # error grow word by word, visibly by the fourth one.
            line_w = width_of(" ".join(texts))
            left = margin_left + (W - margin_left - margin_right - line_w) / 2
            spans_x = []
            for k in range(len(texts)):
                before = (" ".join(texts[:k]) + " ") if k else ""
                spans_x.append((left + width_of(before),
                                left + width_of(" ".join(texts[:k + 1]))))
            # The line is \pos-ed at this same `left` rather than left to
            # libass's own centring -- see the text event below. Mixing the
            # two layouts was what made the boxes creep: measured here
            # without HarfBuzz, the line comes out a little wider than the
            # one libass draws, so the first box sat left of its word and
            # the last sat right of its own. Positioning both from one
            # number can't disagree with itself.
            box_bottom = H - margin_bottom
            box_top = box_bottom - asc - desc

        for j, (a, b, _) in enumerate(group):
            start, end = windows[j]
            if end <= start:
                continue
            # How many words of the line are shown in this word's window: the ones that have started
            # ("As spoken") or all of them ("Whole line"). The others are laid out but invisible, so
            # the line does not shift when they appear.
            shown = j + 1 if spoken else len(group)
            if rounded:
                # The text layer is written once per word after this loop; here only the box moves.
                text = None
            elif square_box:
                # \3a, the BORDER ALPHA, is what turns the box on and off per
                # word -- \3c (the colour) can't: with BorderStyle 3 every
                # span already draws a box, so the non-active ones are hidden
                # by making them transparent, not by recolouring them. The
                # line opens transparent (see prefix below) and each active
                # word switches its own box on and the fill to black.
                body = " ".join(
                    (r"{\3a&H00&\1c&H00000000&}" + t + r"{\3a&HFF&\1c" + g["color"] + "}")
                    if k == j else t
                    for k, (_, _, t) in enumerate(group[:shown])
                )
                if shown < len(group):                  # \1a: the fill only (the box is already transparent)
                    body += r" {\1a&HFF&}" + " ".join(t for _, _, t in group[shown:])
                text = r"{\3a&HFF&}" + body
            else:
                text = " ".join(
                    (r"{\c" + g["highlight"] + "}" + t + r"{\c" + g["color"] + "}") if k == j else t
                    for k, (_, _, t) in enumerate(group[:shown])
                )
                if shown < len(group):                  # \alpha hides fill, outline and shadow together
                    text += r" {\alpha&HFF&}" + " ".join(t for _, _, t in group[shown:])

            if rounded:
                x0, x1 = spans_x[j]
                pad = max(4, int(g["outline"]) + 4)
                # Radius from the box's own height, so it stays the same
                # shape at any font size instead of needing a setting.
                top, bottom = int(box_top - pad), int(box_bottom + pad)
                shape = _rounded_rect(int(x0) - pad, top, int(x1) + pad, bottom,
                                      int((bottom - top) * 0.28))
                events.append(
                    f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Kotak,,0,0,0,,"
                    f"{{\\pos(0,0)\\p1}}{shape}{{\\p0}}")
            else:
                events.append(
                    f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Utama,,0,0,0,,{text}")

        if rounded:
            # EVERY WORD gets its own \pos, rather than one event holding the
            # whole line. That's the point: measured here the line comes out
            # 721px where libass draws 640 -- its font matching and synthetic
            # bold aren't reproducible from outside it -- so any attempt to
            # predict where libass would put each word was always going to
            # drift, and it did, visibly by the fourth word. Laying the words
            # out here instead makes the question disappear: a word and its
            # box are placed from the same number, so they agree whether or
            # not that number matches what libass would have chosen. The only
            # thing that changes is the spacing between words, by a few
            # pixels, evenly.
            # A word's text is on screen in the windows from its own (As spoken) or the line's first
            # (Whole line) onward; windows that touch are one event.
            for k, ((wx0, _), (_, _, t)) in enumerate(zip(spans_x, group)):
                for s, e in _merged(windows[k:] if spoken else windows):
                    events.append(
                        f"Dialogue: 1,{_ass_time(s)},{_ass_time(e)},"
                        f"Utama,,0,0,0,,{{\\an1\\pos({int(wx0)},{int(box_bottom)})}}{t}")

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
    # The size each cropped span is scaled to: the whole canvas for 9:16, the
    # 3:4 picture for 3:4. The split frame is a 9:16 thing only (two boxes
    # stacked to fill the canvas), so for any other picture a span that carries
    # two boxes is framed with its first.
    W = job.out_width
    H = job.picture_height
    split_ok = job.picture == "9:16"

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
        if crop_first and split_ok and span.crops and len(span.crops) >= 2:
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
            c = span.crop or (span.crops[0] if span.crops and not split_ok else None) or job.crop
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


def picture_canvas(picture: str, background: str, position: float,
                   W: int, H: int, fw: int, fh: int,
                   src: str = "[vc]", dst: str = "[vv]") -> str:
    """The filter chain that puts a picture of `fw` x `fh` pixels (what `src`
    carries) onto the W x H canvas, and nothing else.

      9:16   the picture IS the canvas: nothing to do.
      black  scaled to the canvas width, on black, `position` percent of the
             free height down (50 = centred).
      blur   the same, on a blurred copy of itself: the centre 9:16 slice of
             the picture, scaled up to fill the canvas.

    One function for the render (build_filter) and the thumbnails (server.py),
    so a picture is composed the same way wherever it is shown."""
    even = lambda v: max(2, int(v) // 2 * 2)
    if picture == "9:16":
        return f"{src}null{dst}"
    centred = position == 50
    if background == "black":
        y = "(oh-ih)/2" if centred else f"(oh-ih)*{position / 100:g}"
        return f"{src}scale={W}:-2,pad={W}:{H}:0:{y}:black{dst}"
    y = "(H-h)/2" if centred else f"(H-h)*{position / 100:g}"
    return (
        f"{src}split=2[bg][fg];"
        f"[bg]crop={even(fh*9/16)}:{fh}:{even((fw-fh*9/16)/2)}:0,"
        f"scale={W}:{H},gblur=sigma=28[bgb];"
        f"[fg]scale={W}:-2[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:{y}{dst}"
    )


def build_filter(job: RenderJob, src_width: int, src_height: int,
                 ass_path: Path | None, dest: Path | None = None) -> str:
    # 16:9 uses the full frame, so crop is meaningless there; segments are
    # joined first, then placed on the canvas. The other pictures are the
    # opposite: each segment is framed independently so framing can shift.
    crop_first = job.picture != "16:9"
    # `dest` is only used by _concat_filter() when ANY span is tracked
    # (head tracking) -- see the per-segment file reasoning there.
    trim_chain = _concat_filter(job, src_width, src_height, crop_first, dest)

    W, H = job.out_width, job.out_height
    # What leaves the joined segments: the whole source frame (16:9), or the
    # cropped picture, already scaled to the canvas width (3:4) or the canvas
    # itself (9:16).
    fw, fh = (src_width, src_height) if job.picture == "16:9" else (W, job.picture_height)
    video_chain = picture_canvas(job.picture, job.background, job.position, W, H, fw, fh)

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


_WINDOWS_RESERVED = frozenset(
    ["CON", "PRN", "AUX", "NUL"]
    + [f"COM{i}" for i in range(1, 10)]
    + [f"LPT{i}" for i in range(1, 10)]
)


FILENAME_MAX = 100          # characters before ".mp4"


def safe_filename(title: str, fallback: str) -> str:
    """Clip title -> filename. One rule, used by both server and CLI.

    The name is the title, because YouTube reads a video's title from its file name
    when it is uploaded: "Dihujat Satu TikTok Gara-gara Peluk Artis" becomes
    "Dihujat-Satu-TikTok-Gara-gara-Peluk-Artis.mp4" (YouTube shows the hyphens as
    spaces). Upper and lower case are kept; spaces become "-" and a "-" that is
    already there stays; letters (any script) and digits stay; apostrophes are
    dropped without a gap (Don't -> Dont); everything else (punctuation, emoji,
    the characters Windows does not allow in a name) is a separator. Doubled
    separators collapse, none at either end, at most FILENAME_MAX characters, cut
    at a word.
    """
    text = str(title or "").replace("'", "").replace("\u2019", "")
    kept = "".join(c if c.isalnum() or c == "-" else " " for c in text)
    name = re.sub(r"-{2,}", "-", "-".join(kept.split())).strip("-")
    if len(name) > FILENAME_MAX:
        cut = name[:FILENAME_MAX]
        if name[FILENAME_MAX] != "-" and "-" in cut:
            cut = cut.rsplit("-", 1)[0]          # never half a word
        name = cut.strip("-")
    name = name or fallback
    # Windows reserves these as DEVICE names, with or without an extension:
    # opening "con.mp4" talks to the console, not a file. A clip titled
    # "CON" or "Aux" (or "com1".."com9", "lpt1".."lpt9") therefore failed
    # the render with an opaque OS error that said nothing about the title.
    # Harmless everywhere else -- the suffix only appears for these names.
    if name.upper() in _WINDOWS_RESERVED:
        name = f"{name}-clip"
    return name + ".mp4"


def clip_file_title(clip: dict) -> str:
    """The words a clip's file is named after, in order: the post title (what the
    upload will be called), the Result's title, the first moment's title. Empty
    when there is none (the caller falls back to clip-N)."""
    post = clip.get("post") if isinstance(clip.get("post"), dict) else {}
    for candidate in (post.get("title"), clip.get("title")):
        if isinstance(candidate, str) and candidate.strip():
            return candidate
    for span in clip.get("spans") or []:
        if isinstance(span, dict) and isinstance(span.get("title"), str) and span["title"].strip():
            return span["title"]
    return ""


def unique_filename(name: str, taken: set[str]) -> str:
    """`name`, or name-2, name-3 ... when it is in `taken` (lower-cased names: a
    Windows file system does not tell "A.mp4" from "a.mp4")."""
    if name.lower() not in taken:
        return name
    stem, ext = name.rsplit(".", 1)
    n = 2
    while f"{stem}-{n}.{ext}".lower() in taken:
        n += 1
    return f"{stem}-{n}.{ext}"


class RenderCancelled(RuntimeError):
    """Render stopped on request (e.g. Cancel button in the UI)."""


def render(source: Path, job: RenderJob, dest: Path,
           words: list[Word] | None = None, style: dict | None = None,
           src_width: int = 1920, src_height: int = 1080,
           has_audio: bool = True, verbose: bool = True,
           cancel_check=None, on_progress=None) -> Path:
    """cancel_check: zero-argument callable that returns True if the render
    should be cancelled. Checked periodically while ffmpeg runs; if True,
    the ffmpeg process is killed and RenderCancelled is raised.
    on_progress(output seconds written), when given, is called while ffmpeg encodes."""
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

        # QSV's -global_quality is its own scale, not CRF, but it tracks the
        # same direction and sat 3 above the CRF when both were hardcoded
        # (24 against 21). That offset is kept, so picking a quality moves
        # both encoders by the same amount rather than only the x264 path.
        crf = max(0, min(51, int(job.quality)))
        qsv_q = max(1, min(51, crf + 3))

        def build_cmd(encoder: str) -> list[str]:
            return [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(source),
                "-filter_complex", filt,
                "-map", "[vout]", "-map", "[ac]",
                "-c:v", encoder,
                *(["-global_quality", str(qsv_q), "-preset", "medium"] if encoder == "h264_qsv"
                  else ["-crf", str(crf), "-preset", "medium"]),
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

            code, result_err = _run_ffmpeg(build_cmd(encoder), cancel_check, dest, on_progress)
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


def _run_ffmpeg(cmd: list[str], cancel_check, dest: Path, on_progress=None) -> tuple[int, str]:
    """Run ffmpeg with cancellation support. Return (returncode, stderr).

    Uses Popen + poll, not subprocess.run, so cancel_check can be
    checked periodically and ffmpeg killed mid-encode -- not just between
    clips. A 1-hour timeout is enforced. If cancelled, the partial output
    file is deleted.

    `-nostats -progress pipe:1` makes ffmpeg write what it has done to stdout
    (progress.parse_progress_line); a thread reads it and calls
    on_progress(output seconds done). These are reporting options only: the
    encode is the same bytes. The stderr text is collected by a second thread
    (it is what the error message is made of)."""
    import threading
    import time as _time
    from .progress import parse_progress_line
    cmd = [cmd[0], "-nostats", "-progress", "pipe:1", *cmd[1:]]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    mulai = _time.time()
    err_parts: list[bytes] = []

    def read_progress() -> None:
        try:
            for raw in proc.stdout:
                sec = parse_progress_line(raw.decode("utf-8", "replace"))
                if sec is not None and on_progress is not None:
                    try:
                        on_progress(sec)
                    except Exception:                # noqa: BLE001 (a display problem never stops a render)
                        pass
        except (OSError, ValueError):
            pass

    def read_errors() -> None:
        try:
            err_parts.append(proc.stderr.read())
        except (OSError, ValueError):
            pass

    readers = [threading.Thread(target=read_progress, daemon=True), threading.Thread(target=read_errors, daemon=True)]
    for th in readers:
        th.start()

    def _stop() -> None:
        """Kill, reap, and CLOSE THE PIPES (leaked descriptors and a zombie
        otherwise: the cancel and timeout paths used to kill() + wait() and
        raise)."""
        proc.kill()
        proc.wait()
        for th in readers:
            th.join(2)
        for pipe in (proc.stdout, proc.stderr):
            if pipe is not None:
                try:
                    pipe.close()
                except OSError:
                    pass

    try:
        while True:
            try:
                proc.wait(timeout=0.25)
                for th in readers:
                    th.join(5)
                for pipe in (proc.stdout, proc.stderr):
                    if pipe is not None:
                        try:
                            pipe.close()
                        except OSError:
                            pass
                stderr = b"".join(err_parts).decode("utf-8", "replace")
                return proc.returncode, stderr
            except subprocess.TimeoutExpired:
                pass                                # still running
            if cancel_check and cancel_check():
                _stop()
                dest.unlink(missing_ok=True)        # discard partial output
                raise RenderCancelled("Render cancelled.")
            if _time.time() - mulai > 3600:
                _stop()
                raise RuntimeError(
                    "Render exceeded 1 hour and was stopped -- the source "
                    "file may be corrupt or on a network drive that hung.")
    except RenderCancelled:
        raise
    except Exception:
        _stop()
        raise


# --------------------------------------------------------------------------
# a clip made of several videos / a short slice of one
# --------------------------------------------------------------------------
# What server-side jobs need around render(): grouping a clip's spans by
# source video, joining the per-video renders, and cutting a quick preview.


def asset_runs(spans: list[dict], default_video: str) -> list[tuple[str, list[dict]]]:
    """Group a clip's raw span dicts into contiguous runs that share one
    source video. Stage 1 (see the library-projects plan) doesn't let a
    single MOMENT straddle two videos, so grouping at this level -- rather
    than per span -- is enough, and it's what keeps a single-asset clip on
    the exact path it always rendered through (one run, no join)."""
    runs: list[tuple[str, list[dict]]] = []
    for p in spans:
        v = p.get("video") or default_video
        # Same video AND still moving forward through it. The timeline
        # screen lets segments be put in any order, and RenderJob rejects
        # spans that go backwards within one render (they'd overlap in its
        # source-to-output mapping) -- so an earlier moment placed after a
        # later one starts a run of its own, joined like any other.
        # Chronological spans never go backwards, so they stay one run.
        forward = runs and float(p.get("start", 0)) >= float(runs[-1][1][-1].get("end", 0))
        if runs and runs[-1][0] == v and forward:
            runs[-1][1].append(p)
        else:
            runs.append((v, [p]))
    return runs


def concat_renders(parts: list[Path], dest: Path, quality: int) -> None:
    """Join finished per-asset renders into one file, in the given order.

    Re-encodes (ffmpeg's concat FILTER) rather than stream-copying via the
    concat DEMUXER. The pieces all come from the same pipeline -- same
    resolution, same encoder, same audio codec -- so a copy concat would
    usually work, but "usually" is exactly the kind of thing that breaks
    silently on one machine's ffmpeg build and not another's (mismatched
    SPS/PPS, non-monotonic timestamps at the join). Re-encoding costs a
    few seconds on clips this short (ian: a compilation holds 3-5 moments)
    and removes the question entirely."""
    from .ffmpeg_tools import _require
    ffmpeg = _require("ffmpeg")
    n = len(parts)
    inputs: list[str] = []
    for p in parts:
        inputs += ["-i", str(p)]
    # Every piece's audio brought to plain stereo FIRST. Left to concat's
    # own format negotiation, a mono episode joined to a stereo one was
    # upmixed with a -3 dB pan law -- measured: a mono moment came out 3 dB
    # quieter than its source. A mono channel is copied to both sides at
    # full level instead, the way it sounded on its own.
    from .compose import to_stereo
    from .ffmpeg_tools import probe
    pre = [f"[{i}:a:0]{to_stereo(probe(p).channels)}[a{i}]" for i, p in enumerate(parts)]
    filt = ";".join(pre) + ";" + "".join(f"[{i}:v:0][a{i}]" for i in range(n)) \
        + f"concat=n={n}:v=1:a=1[vout][aout]"
    crf = max(0, min(51, int(quality)))
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
           *inputs, "-filter_complex", filt,
           "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-crf", str(crf), "-preset", "medium",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
           "-movflags", "+faststart", str(dest)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"could not join the rendered moments: {result.stderr[-500:]}")


def trim_for_preview(spans: "list[Span]", max_seconds: float,
                       start_from: float = 0.0) -> "list[Span]":
    """Take a short slice from `spans`, up to max_seconds long, starting
    `start_from` seconds of OUTPUT time (after all spans are joined) from
    the beginning of the clip -- not always from the first second. Long
    clips (minutes) are rarely represented by just their first 3 seconds;
    `start_from` is usually the scrub position the user is looking at in
    the preview, so the quick preview actually shows the moment being
    checked.

    The LAST span covered is trimmed exactly at the boundary instead of
    being discarded whole -- so the preview stays as close as possible to
    the requested boundary."""
    result = []
    remaining_skip = max(0.0, start_from)
    remaining = max_seconds
    for s in spans:
        if remaining_skip > 0:
            if s.length <= remaining_skip:
                remaining_skip -= s.length
                continue
            # This segment's start is shifted forward -- if there's tracking
            # data, its times (relative to the OLD start) must be shifted
            # back by the same amount, not passed through raw (would be
            # misplaced) OR silently dropped (would fall back to a static
            # box even though the point is actually tracked).
            s = Span(s.start + remaining_skip, s.end, s.crop, s.crops,
                            shift_tracking(s.tracking, remaining_skip))
            remaining_skip = 0
        if remaining <= 0:
            break
        if s.length <= remaining:
            result.append(s)
            remaining -= s.length
        else:
            # Only the end is shortened, the start (and tracking times,
            # relative to start) don't change -- keyframes falling after
            # the new boundary are harmless if left as-is, sendcmd will
            # never reach that time in a segment this short.
            result.append(Span(s.start, s.start + remaining, s.crop, s.crops,
                                     s.tracking))
            remaining = 0
    return result


def shift_tracking(tracking: "list[dict] | None", offset: float) -> "list[dict] | None":
    """Shift every keyframe's time back by `offset` seconds -- used when a
    tracked span is cut from the FRONT for a quick preview. Keyframes that
    become negative (occurring BEFORE the new start) are discarded; fewer
    than 2 keyframes remaining -> None (falls back to a static box, safer
    than a trajectory with wrong direction/timing)."""
    if not tracking:
        return None
    shifted = [{"t": round(kf["t"] - offset, 3), "left": kf["left"]}
             for kf in tracking if kf["t"] - offset >= 0]
    return shifted if len(shifted) >= 2 else None
