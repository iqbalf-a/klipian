"""Core data contracts for klipian.

All pipeline stages (ingest -> transcribe -> select -> refine -> render)
communicate through the structures in this file. If anything needs to change,
change it here first so other stages adjust accordingly.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path


def fmt_duration(seconds: float) -> str:
    """Format duration as H:MM:SS or MM:SS."""
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


# Indonesian function words and conversational particles.
# Measured on a 42-minute podcast: 10.3% of words had confidence below 50%,
# but almost all of them were these words -- short, spoken fast, often
# overlapping. Whisper is unsure, but the text is correct. Flagging them all
# makes the transcript look broken and trains the user to ignore warnings.
# Filtering them drops flagged words from 618 to 84 (1.4%), and the remainder
# are genuinely misheard.
STOPWORDS = set("""
yang di ke dari ini itu dan atau tapi jadi kalau kalo gak nggak ga ya iya oke
ada gue lu lo aku kamu saya kita mereka dia nya kan sih dong deh nah tuh kok
gitu gini kayak udah sudah belum bisa mau harus buat untuk sama juga cuma aja
saja lagi terus karena emang sekarang waktu orang apa siapa gimana kenapa
berapa satu dua tiga tidak akan pada dalam oleh agar supaya bahwa adalah
""".split())

LOW_CONF = 0.5      # confidence threshold
MIN_LEN_SUSPECT = 5   # short words are too often uncertain to be a signal


@dataclass
class Word:
    """A single word with timestamp. Foundation for karaoke captions and
    precision cuts."""

    text: str
    start: float
    end: float
    prob: float = 1.0

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def suspect(self) -> bool:
        """Worth flagging as a likely mishearing.

        Not simply `prob < 0.5`: that flags one in ten words and most are
        false alarms. See the note above STOPWORDS.
        """
        t = re.sub(r"[^\w-]", "", self.text.strip().lower())
        return (self.prob < LOW_CONF
                and len(t) >= MIN_LEN_SUSPECT
                and t not in STOPWORDS)


@dataclass
class Segment:
    """One sentence/phrase from Whisper, containing its words."""

    text: str
    start: float
    end: float
    words: list[Word] = field(default_factory=list)


@dataclass
class MediaInfo:
    """Result of ffprobe."""

    path: str
    duration: float
    width: int
    height: int
    fps: float
    has_audio: bool
    vcodec: str = ""
    acodec: str = ""

    @property
    def aspect(self) -> float:
        return self.width / self.height if self.height else 0.0

    @property
    def is_landscape(self) -> bool:
        return self.aspect > 1.05

    def summary(self) -> str:
        mins, secs = divmod(int(self.duration), 60)
        hrs, mins = divmod(mins, 60)
        dur = f"{hrs}:{mins:02d}:{secs:02d}" if hrs else f"{mins}:{secs:02d}"
        audio = self.acodec if self.has_audio else "NO AUDIO"
        return (
            f"{Path(self.path).name}\n"
            f"  length : {dur} ({self.duration:.1f}s)\n"
            f"  video  : {self.width}x{self.height} @ {self.fps:.2f}fps ({self.vcodec})\n"
            f"  audio  : {audio}\n"
            f"  aspect : {self.aspect:.3f} ({'landscape' if self.is_landscape else 'portrait/square'})"
        )


@dataclass
class Transcript:
    """Complete transcript for one video, with per-word timestamps."""

    source: str
    duration: float
    language: str
    model: str
    segments: list[Segment] = field(default_factory=list)
    _words_cache: list[Word] | None = field(default=None, repr=False)

    @property
    def words(self) -> list[Word]:
        """List of all words. Cached so we don't rebuild on every access.

        Sentinel None, not `if not cache`: a transcript that genuinely has
        no words (e.g. an old segment-only cache) would rebuild an empty
        list on EVERY access if the guard were falsy."""
        if self._words_cache is None:
            self._words_cache = [w for s in self.segments for w in s.words]
        return self._words_cache

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments).strip()

    @property
    def suspect_words(self) -> list[Word]:
        """Words worth checking by a human -- potential glossary entries."""
        return [w for w in self.words if w.suspect]

    def words_between(self, start: float, end: float) -> list[Word]:
        """Words that fall within a given time range."""
        return [w for w in self.words if w.start >= start and w.end <= end]

    # -- serialization ------------------------------------------------------

    def to_dict(self) -> dict:
        # _words_cache is excluded: asdict() would copy it, and if .words
        # was accessed before save(), all words would be stored twice.
        d = asdict(self)
        d.pop("_words_cache", None)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Transcript":
        segs = [
            Segment(
                text=s["text"],
                start=s["start"],
                end=s["end"],
                words=[Word(**w) for w in s.get("words", [])],
            )
            for s in d.get("segments", [])
        ]
        return cls(
            source=d["source"],
            duration=d["duration"],
            language=d["language"],
            model=d["model"],
            segments=segs,
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write to a temporary file first, then rename -- atomic on the same
        # filesystem, so concurrent readers don't get half-written JSON.
        tmp = path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=1), encoding="utf-8"
        )
        tmp.replace(path)  # atomic rename

    @classmethod
    def load(cls, path: Path) -> "Transcript":
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))

    # -- export -------------------------------------------------------------

    def to_srt(self) -> str:
        """Sentence-level SRT. Not for the pipeline, just for humans to read
        or manually correct when an episode's transcript is garbled."""

        def ts(t: float) -> str:
            ms = int(round(t * 1000))
            h, ms = divmod(ms, 3_600_000)
            m, ms = divmod(ms, 60_000)
            s, ms = divmod(ms, 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        lines = []
        for i, seg in enumerate(self.segments, 1):
            lines.append(str(i))
            lines.append(f"{ts(seg.start)} --> {ts(seg.end)}")
            lines.append(seg.text.strip())
            lines.append("")
        return "\n".join(lines)
