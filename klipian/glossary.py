"""Glosarium istilah.

Menyelesaikan masalah paling umum pada transkripsi Bahasa Indonesia: nama
orang, nama brand, dan istilah teknis yang salah didengar model. Dipakai dua
kali dalam satu jalur:

1. Sebagai `initial_prompt` ke Whisper -- model "dikenalkan" dulu dengan
   istilah yang akan muncul, sehingga cenderung menuliskannya dengan benar.
2. Sebagai koreksi find-replace setelah transkripsi, untuk yang tetap lolos.

Format file (prompts/glossary.txt):

    # baris berawalan pagar = komentar
    Pegadaian                 <- istilah, masuk ke initial_prompt
    LoadRunner
    pegadean => Pegadaian     <- koreksi, salah di kiri, benar di kanan
"""

from __future__ import annotations

import re
from pathlib import Path


def _bounded(word: str) -> str:
    r"""Bungkus \b hanya di sisi yang berupa karakter word.

    Tanpa ini, entri seperti "c++" jadi \bc\+\+\b -- dan \b sesudah "+"
    menuntut karakter word sesudahnya, sehingga koreksinya tidak pernah
    berlaku dan tidak ada yang memberi tahu penggunanya.
    """
    kiri = r"\b" if word[:1].isalnum() or word[:1] == "_" else ""
    kanan = r"\b" if word[-1:].isalnum() or word[-1:] == "_" else ""
    return kiri + re.escape(word) + kanan


class Glossary:
    def __init__(self, terms: list[str] | None = None,
                 fixes: list[tuple[str, str]] | None = None):
        self.terms = terms or []
        self.fixes = fixes or []
        # Pola dan peta dibangun sekali di sini, bukan setiap apply().
        # apply() dipanggil sekali per kata: podcast 40 menit berarti ribuan
        # kali membangun ulang pola yang isinya tidak pernah berubah.
        # Diurut dari yang PALING PANJANG dulu: alternasi regex leftmost-first,
        # jadi "c" sebelum "c++" akan menutupi "c++". Yang panjang harus dicoba
        # duluan supaya cocokan terpanjang menang.
        fixes_urut = sorted(self.fixes, key=lambda wr: len(wr[0]), reverse=True)
        self._pattern = re.compile(
            "|".join(_bounded(w) for w, _ in fixes_urut), re.IGNORECASE
        ) if self.fixes else None
        self._mapping = {w.lower(): r for w, r in self.fixes}

    def __bool__(self) -> bool:
        return bool(self.terms or self.fixes)

    @classmethod
    def load(cls, path: Path | None) -> "Glossary":
        if not path:
            return cls()
        path = Path(path)
        if not path.exists():
            return cls()

        terms: list[str] = []
        fixes: list[tuple[str, str]] = []
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=>" in line:
                wrong, _, right = line.partition("=>")
                wrong, right = wrong.strip(), right.strip()
                if wrong and right:
                    fixes.append((wrong, right))
                    if right not in terms:
                        terms.append(right)
            else:
                terms.append(line)
        return cls(terms, fixes)

    def initial_prompt(self, language: str = "id") -> str | None:
        """Kalimat pembuka untuk Whisper. Ditulis natural, bukan daftar kaku --
        model merespons lebih baik pada konteks berbentuk kalimat."""
        if not self.terms:
            return None
        joined = ", ".join(self.terms)
        if language == "id":
            return f"Percakapan ini menyebut istilah dan nama berikut: {joined}."
        return f"This conversation mentions the following terms and names: {joined}."

    def hotwords(self) -> str | None:
        """Daftar istilah untuk parameter `hotwords` faster-whisper.

        Berbeda dari initial_prompt yang hanya mempengaruhi jendela pertama,
        hotwords disisipkan ulang di setiap jendela 30 detik -- jadi istilahnya
        tetap dikenali sampai akhir podcast, bukan cuma menit-menit awal.
        """
        return ", ".join(self.terms) if self.terms else None

    def apply(self, text: str) -> str:
        """Koreksi find-replace, case-insensitive tapi mempertahankan batas kata.

        Semua fix diterapkan dalam satu pass supaya tidak ada cascading
        (fix 1 menghasilkan text yang lalu kena fix 2).
        """
        if not self._pattern:
            return text
        # Satu regex gabungan (dibangun di __init__): \bpegadean\b|\bloadrunner\b|...
        # re.sub dengan callable mengganti berdasarkan urutan match dalam text,
        # bukan urutan di daftar -- jadi tidak ada cascading.
        def _swap(m: re.Match) -> str:
            return self._mapping[m.group(0).lower()]

        return self._pattern.sub(_swap, text)
