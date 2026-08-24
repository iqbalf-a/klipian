"""Round-trip manual lewat Claude, tanpa API key.

Alurnya:

    klipian brief video.mp4      ->  out/<video>/brief-claude.md
                                     jatuhkan ke Claude, minta dikerjakan
    (Claude membalas dengan JSON)
    klipian impor video.mp4 balasan.json
                                 ->  out/<video>/kandidat.json

Kenapa ini bukan sekadar akal-akalan menghindari biaya: kamu melihat
pertimbangan Claude sebelum apa pun dirender, dan bisa mendebatnya. Tools
berbasis API menyembunyikan langkah itu.

Pembagian tugas yang penting:

    Claude   memberi waktu KIRA-KIRA dalam menit:detik
    klipian  menggeser waktu itu ke batas kata yang tepat

Claude tidak perlu presisi milidetik -- itu bukan pekerjaannya, dan memaksanya
justru bikin hasilnya rapuh. Timestamp per kata yang sudah kita punya di cache
yang mengerjakan pembulatan akhirnya.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .models import Transcript, Word


def fmt_time(seconds: float) -> str:
    t = max(0, int(round(seconds)))  # clamp ke 0 supaya tidak negatif
    return f"{t // 60}:{t % 60:02d}" if t < 3600 else f"{t // 3600}:{(t % 3600) // 60:02d}:{t % 60:02d}"


def seconds(text: str) -> float:
    """Terima 1:07, 01:07, atau 1:24:10."""
    parts = [float(x) for x in str(text).strip().split(":")]
    result = 0.0
    for b in parts:
        result = result * 60 + b
    return result


# --------------------------------------------------------------------------
# EKSPOR: berkas yang dijatuhkan ke Claude
# --------------------------------------------------------------------------

def build_brief(transcript: Transcript, rubric: Path, video: Path) -> str:
    """Satu berkas yang berdiri sendiri: tugas, rubrik, transkrip, dan bentuk
    jawaban yang diharapkan. Pengguna cukup menjatuhkannya dan bilang
    "kerjakan" -- tidak perlu menjelaskan apa pun."""

    rubric_text = rubric.read_text(encoding="utf-8") if rubric.exists() else ""
    # buang judul rubrik supaya tidak bertabrakan dengan judul brief
    rubric_text = re.sub(r"\A# .*?\n+", "", rubric_text)
    # Buang paragraf pembuka rubrik yang ditujukan ke PENGGUNA, bukan ke Claude.
    # Kalimat "ubah file ini kalau hasilnya belum sesuai selera" tidak berarti
    # apa-apa bagi yang sedang membaca brief ini.
    rubric_text = re.sub(r"\AIni yang dibaca Claude.*?---\s*\n+", "", rubric_text, flags=re.S)

    lines = []
    for seg in transcript.segments:
        text = seg.text.strip()
        if text:
            lines.append(f"[{fmt_time(seg.start)}] {text}")
    transcript_lines = "\n".join(lines)

    return f"""# Cari klip — {video.name}

Halo. Tolong baca transkrip di bagian bawah berkas ini dan pilih momen yang
layak dijadikan video vertikal pendek.

**Durasi sumber:** {fmt_time(transcript.duration)} · **{len(transcript.words)} kata**

Waktu yang kamu berikan tidak perlu presisi. Cukup menit:detik yang mendekati;
klipian yang akan menggeser titik potongnya ke batas kata terdekat.

---

## Rubrik penilaian

{rubric_text}

---

## Bentuk jawaban

Balas dengan **satu blok JSON** persis seperti ini, tanpa penjelasan tambahan
di luar bloknya. Simpan sebagai `.json`, lalu impor kembali ke klipian.

```json
{{
  "source": "{video.name}",
  "clips": [
    {{
      "start": "0:12",
      "end": "1:07",
      "title": "Rugi 300 Juta karena Timing",
      "hook": "kutipan persis dari transkrip",
      "scores": {{ "hook": 9, "complete": 8, "payoff": 9, "emotion": 8, "duration": 9 }},
      "reason": "satu dua kalimat untuk dibaca manusia"
    }}
  ]
}}
```

---

## Transkrip

{transcript_lines}
"""


# --------------------------------------------------------------------------
# IMPOR: membaca balasan Claude
# --------------------------------------------------------------------------

@dataclass
class Candidate:
    start: float
    end: float
    title: str
    hook: str
    scores: dict
    reason: str

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def total(self) -> float:
        n = []
        for v in self.scores.values():
            try:                       # "9" ikut dihitung, "sembilan" dilewati
                n.append(float(v))
            except (TypeError, ValueError):
                pass
        return round(sum(n) / len(n), 1) if n else 0.0


def extract_json(text: str) -> dict:
    """Balasan Claude sering dibungkus pagar kode atau diberi kalimat pengantar.
    Ambil objek JSON terbesar yang ada, jangan menuntut berkas bersih."""
    # Cari di dalam code fence dulu. Pakai lazy match yang diakhiri pagar
    # penutup -- sama persis dengan extractJSON() di ui/roundtrip.js. Versi
    # greedy dulu merentang dari pagar pertama sampai pagar TERAKHIR, jadi
    # balasan dengan dua blok kode gagal di CLI tapi berhasil di UI.
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        return json.loads(fence.group(1))
    # Fallback: cari { ... } terbesar (greedy rfind)
    first, end = text.find("{"), text.rfind("}")
    if first == -1 or end <= first:
        raise ValueError("Tidak ada blok JSON di berkas itu.")
    return json.loads(text[first:end + 1])


# Sejauh mana titik potong boleh digeser untuk mengejar batas kata. Batas kata
# yang lebih jauh dari ini berarti Claude menunjuk ke keheningan, bukan ke kata
# yang meleset sedikit -- di situ angka aslinya yang benar. Tanpa batas ini,
# klip 5 detik di tengah jeda panjang pernah membengkak jadi 79 detik.
SNAP_MAX = 2.0


def snap_to_word(words: list[Word], moment: float, side: str) -> float:
    """Geser ke batas kata terdekat, maksimal SNAP_MAX detik.

    side="start" -> ke AWAL kata yang sedang/akan diucapkan
    side="end"   -> ke AKHIR kata yang baru selesai

    Inilah bagian yang tidak bisa dikerjakan Claude: ia tidak punya timestamp
    per kata. Kita punya.
    """
    if not words:
        return moment
    if side == "start":
        candidates = [w.start for w in words]
    else:
        candidates = [w.end for w in words]
    nearest = min(candidates, key=lambda t: abs(t - moment))
    return nearest if abs(nearest - moment) <= SNAP_MAX else moment


def parse_reply(transcript: Transcript, text: str) -> list[Candidate]:
    """Kunci Inggris yang utama; kunci Indonesia tetap diterima sebagai
    cadangan supaya balasan Claude yang lama masih bisa diimpor."""
    data = extract_json(text)
    raw = data.get("clips") or data.get("klip") or []
    if not raw:
        raise ValueError('JSON-nya tidak punya daftar "clips".')

    words = transcript.words
    result: list[Candidate] = []
    for k in raw:
        try:
            m = seconds(k.get("start") or k.get("mulai"))
            s = seconds(k.get("end") or k.get("selesai"))
        except (TypeError, ValueError):
            continue
        if s <= m:
            continue

        # Diperiksa LAGI sesudah digeser: dua sisi bergerak sendiri-sendiri,
        # jadi rentang yang tadinya sah bisa jadi terbalik. Kalau itu terjadi,
        # pakai angka asli dari Claude -- lebih baik meleset sedikit daripada
        # kandidat rusak yang baru ketahuan saat render.
        a = round(snap_to_word(words, m, "start"), 3)
        b = round(snap_to_word(words, s, "end"), 3)
        if b <= a:
            a, b = m, s

        result.append(Candidate(
            start=a,
            end=b,
            title=(k.get("title") or k.get("judul") or "Tanpa judul").strip(),
            hook=(k.get("hook") or "").strip(),
            # Explicit check: empty dict {} valid tapi falsy, jangan pakai or
            scores=k["scores"] if "scores" in k else (k.get("skor") or {}),
            reason=(k.get("reason") or k.get("alasan") or "").strip(),
        ))

    result.sort(key=lambda x: x.total, reverse=True)
    return result


def save_candidates(candidates: list[Candidate], video: Path, dest: Path) -> Path:
    """Bentuknya sengaja sama persis dengan yang dipakai prototipe UI, supaya
    nanti tinggal dibaca tanpa penerjemahan."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({
        "source": video.name,
        "candidates": [{
            "title": k.title,
            "hook": k.hook,
            "in": fmt_time(k.start),
            "out": fmt_time(k.end),
            "start_sec": k.start,
            "end_sec": k.end,
            "dur": round(k.duration),
            "total": k.total,
            "scores": k.scores,
            "reason": k.reason,
        } for k in candidates],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return dest
