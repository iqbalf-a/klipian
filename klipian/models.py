"""Kontrak data inti klipian.

Semua tahap pipeline (ingest -> transcribe -> select -> refine -> render)
bicara lewat struktur di file ini. Kalau ada yang perlu diubah, ubah di sini
dulu supaya tahap lain ikut menyesuaikan.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path


def fmt_duration(seconds: float) -> str:
    """Format durasi jadi H:MM:SS atau MM:SS."""
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


# Kata fungsi dan partikel percakapan Indonesia.
# Diukur pada podcast 42 menit: 10.3% kata punya keyakinan di bawah 50%, tapi
# hampir semuanya kata-kata ini -- pendek, diucapkan cepat, sering tumpang
# tindih. Whisper ragu, tulisannya benar. Menandai semuanya membuat transkrip
# terlihat rusak dan melatih pengguna mengabaikan peringatan.
# Menyaringnya menurunkan penandaan dari 618 kata jadi 84 (1.4%), dan yang
# tersisa memang salah dengar sungguhan.
STOPWORDS = set("""
yang di ke dari ini itu dan atau tapi jadi kalau kalo gak nggak ga ya iya oke
ada gue lu lo aku kamu saya kita mereka dia nya kan sih dong deh nah tuh kok
gitu gini kayak udah sudah belum bisa mau harus buat untuk sama juga cuma aja
saja lagi terus karena emang sekarang waktu orang apa siapa gimana kenapa
berapa satu dua tiga tidak akan pada dalam oleh agar supaya bahwa adalah
""".split())

LOW_CONF = 0.5      # batas keyakinan
MIN_LEN_SUSPECT = 5   # kata pendek terlalu sering ragu untuk jadi sinyal


@dataclass
class Word:
    """Satu kata dengan timestamp. Fondasi caption karaoke dan cut presisi."""

    text: str
    start: float
    end: float
    prob: float = 1.0

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def suspect(self) -> bool:
        """Layak ditandai sebagai kemungkinan salah dengar.

        Bukan sekadar `prob < 0.5`: itu menandai satu dari sepuluh kata dan
        sebagian besar salah alarm. Lihat catatan di STOPWORDS.
        """
        t = re.sub(r"[^\w-]", "", self.text.strip().lower())
        return (self.prob < LOW_CONF
                and len(t) >= MIN_LEN_SUSPECT
                and t not in STOPWORDS)


@dataclass
class Segment:
    """Satu kalimat/frasa dari Whisper, berisi kata-katanya."""

    text: str
    start: float
    end: float
    words: list[Word] = field(default_factory=list)


@dataclass
class MediaInfo:
    """Hasil ffprobe."""

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
    """Transkrip lengkap satu video, dengan timestamp per kata."""

    source: str
    duration: float
    language: str
    model: str
    segments: list[Segment] = field(default_factory=list)
    _words_cache: list[Word] = field(default_factory=list, repr=False)

    @property
    def words(self) -> list[Word]:
        """Daftar semua kata. Di-cache supaya tidak rebuild setiap akses."""
        if not self._words_cache:
            self._words_cache = [w for s in self.segments for w in s.words]
        return self._words_cache

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments).strip()

    @property
    def suspect_words(self) -> list[Word]:
        """Kata yang layak dicek manusia -- calon isi glosarium."""
        return [w for w in self.words if w.suspect]

    def words_between(self, start: float, end: float) -> list[Word]:
        """Kata-kata yang jatuh di dalam rentang waktu tertentu."""
        return [w for w in self.words if w.start >= start and w.end <= end]

    # -- serialisasi -------------------------------------------------------

    def to_dict(self) -> dict:
        # _words_cache dibuang: asdict() ikut menyalinnya, dan kalau .words
        # pernah diakses sebelum save() seluruh kata tersimpan dua kali.
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
        # Tulis ke file sementara dulu, lalu rename — atomic di filesystem
        # yang sama, supaya pembaca concurrently tidak dapat JSON setengah jadi.
        tmp = path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=1), encoding="utf-8"
        )
        tmp.replace(path)  # atomic rename

    @classmethod
    def load(cls, path: Path) -> "Transcript":
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))

    # -- ekspor ------------------------------------------------------------

    def to_srt(self) -> str:
        """SRT kalimat-level. Bukan untuk pipeline, hanya untuk dibaca manusia
        atau dikoreksi manual kalau ada episode yang transkripnya kacau."""

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
