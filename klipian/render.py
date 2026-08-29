"""Render klip vertikal 9:16 — inilah yang benar-benar menghasilkan MP4.

Tiga hal yang dikerjakan di sini, dan urutannya penting:

1. POTONGAN DISAMBUNG.
   Klip bisa terdiri dari beberapa potongan (bagian di tengah dibuang).
   ffmpeg memotong tiap bagian lalu menyambungnya jadi satu.

2. CAPTION DIPETAKAN KE TIMELINE KELUARAN.
   Setelah satu bagian dibuang, semua kata sesudahnya bergeser maju. Kata di
   detik ke-650 sumber mungkin jatuh di detik ke-11 keluaran. Kalau dipakai
   waktu sumbernya, subtitle muncul di tempat yang salah -- dan itu baru
   ketahuan setelah render selesai.

3. CROP LALU SKALA, bukan sebaliknya.
   Crop di resolusi sumber mempertahankan detail; memperbesar dulu lalu
   memotong membuang ketajaman.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .ffmpeg_tools import _require, has_encoder
from .models import Transcript, Word

# Font watermark "klipian" dibundel di sini (bukan cuma diandalkan dari
# Google Fonts seperti di UI) -- rendernya lewat ffmpeg/libass di mesin
# lokal, yang tidak bisa "pinjam" font web. fontsdir menunjuk ke folder ini
# supaya libass menemukan "Mona Sans ExtraBold" tanpa perlu terpasang
# sebagai font sistem.
FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"


@dataclass
class Span:
    """Satu potongan. `crop` opsional: kalau diisi, potongan ini dibingkai
    sendiri -- itulah yang membuat framing bisa berpindah di tengah klip.
    Kalau None, dipakai crop milik RenderJob.

    `crops` berisi DUA kotak untuk bingkai split: kotak pertama jadi bagian
    atas, kotak kedua bagian bawah, ditumpuk jadi satu frame 9:16. Dipakai
    saat dua orang di podcast duduk berjauhan dan dua-duanya mau kelihatan.
    Kalau `crops` terisi, `crop` diabaikan."""
    start: float
    end: float
    crop: "CropBox | None" = None
    crops: "list[CropBox] | None" = None

    @property
    def length(self) -> float:
        return self.end - self.start


@dataclass
class CropBox:
    """Rentang crop dalam PERSEN frame sumber, bukan piksel -- supaya tidak
    bergantung pada resolusi sumbernya."""
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
        # Validasi potongan: harus sorted & non-overlapping
        for i, p in enumerate(self.spans):
            if p.end <= p.start:
                raise ValueError(
                    f"Potongan #{i+1} tidak sah: selesai ({p.end}) "
                    f"harus lebih besar dari mulai ({p.start})")
            if i > 0 and p.start < self.spans[i-1].end:
                raise ValueError(
                    f"Potongan #{i+1} tumpang tindih dengan potongan #{i}")

    @property
    def out_height(self) -> int:
        return self.out_width * 16 // 9

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


def to_output_time(spans: list[Span], seconds: float) -> float | None:
    """Peta waktu sumber -> waktu keluaran. None kalau jatuh di bagian dibuang."""
    elapsed = 0.0
    for p in spans:
        if seconds < p.start:
            return None
        if seconds <= p.end:
            return elapsed + (seconds - p.start)
        elapsed += p.length
    return None


# Batas atas zona aman di panel preview (lihat .safe di ui/app.css,
# top:16%) -- watermark posisi "Top" SENGAJA duduk persis DI ATAS garis
# ini, bukan di dalamnya. Watermark bukan konten utama; kalau ada overlay
# UI platform (tombol share, dsb.) menutupi pinggir, biar watermark yang
# mengalah duluan, bukan wajah/caption.
SAFE_AREA_TOP_PERCENT = 16.0


def _watermark_placement(mode: str, size: float, H: int,
                          caption_margin_bottom: int) -> tuple[int, int]:
    """(Alignment ASS, MarginV) untuk posisi watermark.

    Tinggi baris teks diperkirakan 1.3x ukuran font -- ASS tidak punya cara
    mengukur tinggi glyph sungguhan tanpa benar-benar merender dulu, jadi
    ini perkiraan, bukan presisi piksel. Cukup dekat untuk watermark satu
    baris pendek seperti "klipian"."""
    tinggi_baris = size * 1.3
    if mode == "top":
        # Alignment 8 = atas-tengah, MarginV dihitung dari ATAS. Tepi bawah
        # watermark diusahakan pas di garis SAFE_AREA_TOP_PERCENT.
        margin = max(0, int(H * SAFE_AREA_TOP_PERCENT / 100 - tinggi_baris))
        return 8, margin
    if mode == "middle":
        # Alignment 5 = tengah-tengah (vertikal DAN horizontal) -- MarginV
        # tidak berlaku untuk alignment ini, libass mengabaikannya.
        return 5, 0
    # "bottom": BUKAN mepet tepi bawah -- tepat DI BAWAH caption. Margin-nya
    # selalu dibuat lebih kecil dari margin caption (lebih dekat ke tepi),
    # berapa pun posisi caption yang sedang dipilih pengguna -- watermark
    # otomatis ikut turun kalau caption digeser ke Bottom, dan ikut naik
    # kalau caption digeser ke Top.
    margin = max(int(H * 0.02),
                 caption_margin_bottom - int(tinggi_baris) - int(H * 0.01))
    return 2, margin


def build_ass(job: RenderJob, words: list[Word], style: dict | None = None) -> str:
    """Caption karaoke: satu peristiwa per kata, menampilkan barisnya utuh
    dengan kata yang sedang diucapkan disorot. Watermark "klipian" ikut
    ditulis di sini juga -- satu Dialogue statis sepanjang video, bukan
    per-kata seperti caption -- supaya cuma satu file ASS dan satu filter
    `ass=` yang perlu dijalankan ffmpeg, bukan dua lapis subtitle terpisah."""
    # Warna ditulis dalam format ASS &HAABBGGRR& -- urutannya BIRU-HIJAU-MERAH,
    # kebalikan dari hex web. Emas #FFD600 jadi &H0000D6FF&.
    g = {"font": "Arial", "size": 84, "per_line": 3,
         "outline": 4, "position": 24,
         "color": "&H00FFFFFF&",          # warna dasar teks
         "highlight": "&H0000D6FF&",      # warna kata yang sedang diucapkan
         "watermark": True,               # tombol on/off dari layar Captions
         "watermark_size": 32,
         "watermark_opacity": "80",       # alpha ASS: 00 penuh .. FF tak kelihatan
         "watermark_position": "bottom",  # top | middle | bottom
         **(style or {})}

    W, H = job.out_width, job.out_height
    margin_bottom = int(H * g["position"] / 100)
    # Baris Style memakai bentuk tanpa "&" penutup, tag \c memakai yang dengan.
    warna_style = g["color"].rstrip("&")

    wm_align, wm_margin = _watermark_placement(
        g["watermark_position"], g["watermark_size"], H, margin_bottom)
    wm_color = f"&H{g['watermark_opacity']}FFFFFF"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Utama,{g['font']},{g['size']},{warna_style},&H00000000,&H80000000,1,1,{g['outline']},0,2,60,60,{margin_bottom},1
Style: Watermark,Mona Sans ExtraBold,{g['watermark_size']},{wm_color},&H00000000,&H60000000,0,1,1,0,{wm_align},60,60,{wm_margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    if g["watermark"]:
        header += (
            f"Dialogue: 0,{_ass_time(0)},{_ass_time(job.duration)},"
            f"Watermark,,0,0,0,,klipian\n")

    # hanya kata yang benar-benar masuk keluaran
    used = []
    for w in words:
        a = to_output_time(job.spans, w.start)
        b = to_output_time(job.spans, w.end)
        if a is not None and b is not None and b > a:
            used.append((a, b, w.text.strip()))

    events = []
    per_line = g["per_line"]
    for i in range(0, len(used), per_line):
        group = used[i:i + per_line]
        # Kapan kelompok berikutnya mulai. Kata terakhir tiap kelompok harus
        # bertahan sampai titik itu -- kalau hanya sampai akhir katanya sendiri,
        # caption berkedip di setiap pergantian baris.
        next_start = used[i + per_line][0] if i + per_line < len(used) else None

        for j, (a, b, _) in enumerate(group):
            text = " ".join(
                (r"{\c" + g["highlight"] + "}" + t + r"{\c" + g["color"] + "}") if k == j else t
                for k, (_, _, t) in enumerate(group)
            )
            if j < len(group) - 1:
                end = group[j + 1][0]          # sampai kata berikutnya
            elif next_start is not None:
                end = next_start               # sampai baris berikutnya
            else:
                end = b + 0.4                     # baris terakhir, beri sisa napas
            events.append(
                f"Dialogue: 0,{_ass_time(a)},{_ass_time(end)},Utama,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


# --------------------------------------------------------------------------
# ffmpeg
# --------------------------------------------------------------------------

def _concat_filter(job: "RenderJob", src_width: int, src_height: int,
                   crop_dulu: bool) -> str:
    """Potong tiap bagian lalu sambung. setpts/asetpts wajib -- tanpa itu
    potongan kedua mewarisi timestamp aslinya dan hasilnya melompat.

    crop_dulu=True membingkai TIAP potongan sebelum disambung, bukan sesudah.
    Itulah yang memungkinkan framing berpindah di tengah klip: potongan 1
    menyorot orang kiri, potongan 2 menyorot orang kanan.

    Potongan yang punya `crops` dibingkai split: dipotong dua kali dari frame
    yang sama lalu ditumpuk atas-bawah. Jadi satu klip bisa berganti-ganti
    antara satu bingkai dan dua bingkai di titik mana pun.
    """
    even = lambda v: max(2, int(v) // 2 * 2)
    W, H = job.out_width, job.out_height

    def kotak(c: "CropBox") -> str:
        return (f"crop={even(src_width * c.width / 100)}:"
                f"{even(src_height * c.height / 100)}:"
                f"{even(src_width * c.left / 100)}:"
                f"{even(src_height * c.top / 100)}")

    parts = []
    for i, span in enumerate(job.spans):
        v = f"[0:v]trim=start={span.start:.3f}:end={span.end:.3f},setpts=PTS-STARTPTS"
        if crop_dulu and span.crops and len(span.crops) >= 2:
            # Bingkai split: SATU potongan yang sama dipotong dua kali lalu
            # ditumpuk. split=2 wajib -- satu keluaran filter tidak boleh
            # dipakai dua kali sebagai masukan.
            atas, bawah = span.crops[0], span.crops[1]
            h2 = even(H / 2)
            parts.append(f"{v},split=2[s{i}a][s{i}b]")
            parts.append(f"[s{i}a]{kotak(atas)},scale={W}:{h2},setsar=1[c{i}a]")
            parts.append(f"[s{i}b]{kotak(bawah)},scale={W}:{h2},setsar=1[c{i}b]")
            # scale penutup menjaga tinggi tetap H kalau H/2 dibulatkan.
            parts.append(f"[c{i}a][c{i}b]vstack=inputs=2,scale={W}:{H},setsar=1[v{i}]")
            parts.append(f"[0:a]atrim=start={span.start:.3f}:end={span.end:.3f},"
                         f"asetpts=PTS-STARTPTS[a{i}]")
            continue
        if crop_dulu:
            c = span.crop or job.crop
            v += f",{kotak(c)},scale={W}:{H},setsar=1"
        parts.append(f"{v}[v{i}]")
        parts.append(f"[0:a]atrim=start={span.start:.3f}:end={span.end:.3f},"
                     f"asetpts=PTS-STARTPTS[a{i}]")
    n = len(job.spans)
    inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
    parts.append(f"{inputs}concat=n={n}:v=1:a=1[vc][ac]")
    return ";".join(parts)


def build_filter(job: RenderJob, src_width: int, src_height: int,
                 ass_path: Path | None) -> str:
    # Layout blur memakai seluruh frame, jadi crop-nya tidak berarti apa-apa;
    # potongannya disambung dulu baru dikaburkan. Layout wajah sebaliknya:
    # tiap potongan dibingkai sendiri supaya framing bisa berpindah.
    crop_dulu = job.layout != "blur"
    trim_chain = _concat_filter(job, src_width, src_height, crop_dulu)

    even = lambda v: max(2, int(v) // 2 * 2)
    W, H = job.out_width, job.out_height

    if job.layout == "blur":
        # latar: seluruh frame diperbesar dan dikaburkan; depan: frame utuh
        video_chain = (
            f"[vc]split=2[bg][fg];"
            f"[bg]crop={even(src_height*9/16)}:{src_height}:{even((src_width-src_height*9/16)/2)}:0,"
            f"scale={W}:{H},gblur=sigma=28[bgb];"
            f"[fg]scale={W}:-2[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[vv]"
        )
    else:
        # sudah di-crop dan di-skala per potongan di atas
        video_chain = "[vc]null[vv]"

    if ass_path:
        # Karakter yang punya makna syntaktis di FFmpeg filter graph harus
        # di-escape: backslash, colon (Windows drive), single quote (string
        # delimiter), brackets (label), semicolons (separator), equals (option).
        def _escape(p: str) -> str:
            p = p.replace("\\", "/").replace(":", r"\:")
            p = p.replace("'", r"\'").replace("[", r"\[").replace("]", r"\]")
            return p.replace(";", r"\;").replace("=", r"\=")

        path = _escape(str(ass_path))
        # fontsdir menunjuk libass ke assets/fonts/ -- tanpa ini "Mona Sans
        # ExtraBold" (dipakai style Watermark di build_ass) tidak ketemu
        # kecuali kebetulan sudah terpasang sebagai font sistem, dan libass
        # diam-diam jatuh ke font pengganti yang tidak mirip logo sama sekali.
        fontsdir = _escape(str(FONTS_DIR))
        video_chain += f";[vv]ass='{path}':fontsdir='{fontsdir}'[vout]"
    else:
        video_chain += ";[vv]null[vout]"

    return trim_chain + ";" + video_chain


def safe_filename(title: str, fallback: str) -> str:
    """Judul klip -> nama berkas. Satu aturan, dipakai server dan CLI.

    Sebelumnya aturan ini ditulis ulang di tiga tempat dengan dua perilaku
    berbeda, jadi nama yang ditampilkan UI tidak selalu sama dengan nama yang
    benar-benar ditulis ke disk.
    """
    kept = "".join(c if c.isalnum() or c in "- " else " " for c in title)
    name = "-".join(kept.lower().split())
    return (name or fallback) + ".mp4"


def render(source: Path, job: RenderJob, dest: Path,
           words: list[Word] | None = None, style: dict | None = None,
           src_width: int = 1920, src_height: int = 1080,
           has_audio: bool = True, verbose: bool = True) -> Path:
    if not job.spans:
        raise RuntimeError("No spans to render.")
    if not has_audio:
        # Filter graph di bawah selalu memakai [0:a]. Tanpa penjaga ini ffmpeg
        # gagal dengan "Stream specifier ':a' in filtergraph description" --
        # pesan yang tidak berarti apa-apa bagi pengguna.
        raise RuntimeError(
            f"{source.name} has no audio track, so it cannot be turned into "
            f"a clip. Use a source file that has sound.")

    ffmpeg = _require("ffmpeg")
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Dulu file ASS cuma dibuat kalau ADA kata caption (`if words:`) --
    # masuk akal selama ASS-nya cuma untuk caption. Sekarang watermark juga
    # lewat file yang sama (lihat build_ass()), dan itu harus tetap muncul
    # walau tidak ada satu kata pun (transkrip belum ada, atau caption
    # sengaja dimatikan) -- jadi gate-nya sekarang "ada YANG PERLU ditulis
    # ke ASS", bukan "ada kata".
    watermark_aktif = (style or {}).get("watermark", True)
    ass_path = None
    if words or watermark_aktif:
        ass_path = dest.with_suffix(".ass")
        ass_path.write_text(build_ass(job, words, style), encoding="utf-8")

    try:
        filt = build_filter(job, src_width, src_height, ass_path)

        def susun(encoder: str) -> list[str]:
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

        # has_encoder hanya membuktikan encodernya ada di build ffmpeg, bukan
        # bahwa driver di mesin ini bisa memakainya. Kalau QSV gagal, ulangi
        # sekali dengan libx264 -- lebih lambat, tapi jadi, dan itu yang
        # dibutuhkan pengguna.
        urutan = ["h264_qsv", "libx264"] if has_encoder("h264_qsv") else ["libx264"]
        result = None
        for i, encoder in enumerate(urutan):
            if verbose:
                print(f"  encoder  : {encoder}")
                if i == 0:
                    print(f"  spans    : {len(job.spans)}  ·  duration {job.duration:.1f}s")

            result = subprocess.run(susun(encoder), capture_output=True, text=True,
                                    encoding="utf-8", errors="replace", timeout=3600)
            if result.returncode == 0:
                return dest
            if i < len(urutan) - 1 and verbose:
                print(f"  {encoder} failed, retrying with {urutan[i+1]}")

        tail = (result.stderr or "").strip().splitlines()[-14:]
        raise RuntimeError("ffmpeg gagal:\n" + "\n".join(tail))

    finally:
        # Bersihkan ASS file yang tertinggal kalau render gagal
        if ass_path and ass_path.exists():
            ass_path.unlink(missing_ok=True)
