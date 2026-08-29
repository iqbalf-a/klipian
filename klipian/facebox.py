"""Deteksi wajah untuk merapatkan kotak crop -- pelengkap AI Framing.

Diarization (diarize.py) tahu KAPAN harus ganti frame. Modul ini menjawab
pertanyaan yang beda: KE MANA persis kotaknya harus diarahkan. Tanpa ini,
tiap titik framing yang dibuat AI Framing cuma salinan MENTAH dari posisi
yang digeser manual sekali di awal klip -- kalau geseran awalnya kurang pas,
atau orangnya sedikit bergerak di kursi sepanjang klip, hasilnya bisa
memotong wajah atau menyorot kursi kosong di sebelahnya. Modul ini
memeriksa ULANG posisi wajah sungguhan di SETIAP titik, bukan percaya begitu
saja pada satu koordinat statis untuk seluruh klip.

Pakai deteksi wajah KLASIK OpenCV (Haar cascade), BUKAN model deep learning
-- sudah ikut terpasang bersama opencv-python-headless, tidak perlu unduh
bobot terpisah dari mana pun, dan untuk wajah menghadap kamera seperti
podcast akurasinya sudah cukup untuk kebutuhan ini.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

_detector = None


def _load_detector():
    global _detector
    if _detector is not None:
        return _detector
    import cv2
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    _detector = cv2.CascadeClassifier(cascade_path)
    return _detector


def fit_crop_to_face(video: Path, at: float, rough: dict) -> dict | None:
    """Cari wajah di sekitar kotak KASAR `rough` ({left,top,width,height}
    dalam persen frame), kembalikan kotak baru yang dipusatkan ke wajah itu
    -- juga dalam persen, BELUM dikunci rasio (client mengunci rasionya
    sendiri lewat samakanRasio, sama seperti kotak yang digeser manual).
    None kalau tidak ada wajah yang ditemukan sama sekali di frame itu."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    if not W or not H:
        return None

    with tempfile.TemporaryDirectory(prefix="klipian-face-") as tmp:
        frame_path = Path(tmp) / "frame.jpg"
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{at:.3f}", "-i", str(video),
            "-frames:v", "1", str(frame_path),
        ], desc="mengambil frame untuk deteksi wajah")

        img = cv2.imread(str(frame_path))
        if img is None:
            return None
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        faces = _load_detector().detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        if len(faces) == 0:
            return None

        # Wajah yang PALING DEKAT ke pusat kotak kasar yang dipilih, bukan
        # yang terbesar/pertama -- kotak kasar sudah menunjukkan orang yang
        # MANA (kiri/kanan), deteksi wajah cuma merapikan posisinya, bukan
        # menebak ulang siapa yang dimaksud dari nol.
        rx = (rough.get("left", 0) / 100) * W
        ry = (rough.get("top", 0) / 100) * H
        rw = (rough.get("width", 100) / 100) * W
        rh = (rough.get("height", 100) / 100) * H
        cx, cy = rx + rw / 2, ry + rh / 2

        def jarak(f):
            fx, fy, fw, fh = f
            fcx, fcy = fx + fw / 2, fy + fh / 2
            return (fcx - cx) ** 2 + (fcy - cy) ** 2

        fx, fy, fw, fh = min(faces, key=jarak)

        # Kotak akhir: wajah + ruang lebih di ATAS (rambut/topi) dan di
        # BAWAH (bahu), bukan pas-pasan di tepi wajah -- kotak pas-pasan
        # bikin kepala kepotong begitu rasio dikunci ulang di client
        # (samakanRasio menyesuaikan LEBAR mengikuti rasio target, tinggi
        # yang pas-pasan jadi terlalu pendek untuk lebar barunya).
        margin_x = fw * 0.6
        margin_atas = fh * 0.9
        margin_bawah = fh * 1.4

        left = max(0, fx - margin_x)
        top = max(0, fy - margin_atas)
        width = min(W - left, fw + margin_x * 2)
        height = min(H - top, fh + margin_atas + margin_bawah)

        # float() eksplisit: OpenCV mengembalikan np.float64/np.int32, dan
        # json.dumps bawaan Python tidak tahu cara menulis tipe numpy --
        # tanpa ini endpoint-nya pecah dengan "Object of type float64 is
        # not JSON serializable" begitu dipanggil dari server sungguhan.
        return {
            "left": round(float(left) / W * 100, 2),
            "top": round(float(top) / H * 100, 2),
            "width": round(float(width) / W * 100, 2),
            "height": round(float(height) / H * 100, 2),
        }
