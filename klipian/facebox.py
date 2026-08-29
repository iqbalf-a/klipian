"""Deteksi wajah/orang untuk merapatkan kotak crop -- pelengkap AI Framing.

Diarization (diarize.py) tahu KAPAN harus ganti frame. Modul ini menjawab
pertanyaan yang beda: KE MANA persis kotaknya harus diarahkan. Tanpa ini,
tiap titik framing yang dibuat AI Framing cuma salinan MENTAH dari posisi
yang digeser manual sekali di awal klip -- kalau geseran awalnya kurang pas,
atau orangnya sedikit bergerak di kursi sepanjang klip, hasilnya bisa
memotong wajah atau menyorot kursi kosong di sebelahnya. Modul ini
memeriksa ULANG posisi wajah sungguhan di SETIAP titik, bukan percaya begitu
saja pada satu koordinat statis untuk seluruh klip.

Tiga lapis, klasik OpenCV semua -- BUKAN model deep learning, tidak nambah
beban PyTorch yang sudah dipakai diarization, tidak perlu unduh bobot
terpisah dari mana pun:

  1. Haar cascade wajah, dicari HANYA di sekitar kotak kasar (bukan seluruh
     frame) -- membatasi area pencarian sendirian sudah menyaring banyak
     salah-tangkap tanpa perlu parameter super ketat.
  2. Kalau wajah tidak ketemu (mis. menghadap agak samping): HOG+SVM
     deteksi ORANG (bawaan OpenCV, tanpa unduhan) sebagai cadangan --
     kurang presisi (dilatih untuk pejalan kaki berdiri, bukan podcast
     duduk), tapi lebih baik daripada kotak kasar mentah kalau memang
     ketemu.
  3. Dua-duanya gagal -> None, caller jatuh ke kotak kasar apa adanya.

Laporan nyata sebelum modul ini ditulis ulang: mencari di SELURUH frame
dengan parameter longgar sesekali salah tangkap tekstur (rambut, motif
kain) sebagai "wajah" kecil, dan kotak yang dihasilkan MENIMPA titik yang
tadinya benar -- bukan cuma gagal diam-diam. Membatasi area pencarian ke
sekitar kotak kasar adalah perbaikan utamanya; filter ukuran dan
pemeriksaan akhir di bawah ini lapisan kedua.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

_face_detector = None
_hog_detector = None


def _load_face_detector():
    global _face_detector
    if _face_detector is not None:
        return _face_detector
    import cv2
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    _face_detector = cv2.CascadeClassifier(cascade_path)
    return _face_detector


def _load_hog_detector():
    global _hog_detector
    if _hog_detector is not None:
        return _hog_detector
    import cv2
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    _hog_detector = hog
    return _hog_detector


def _cari_wajah(gray_region, rw: float) -> tuple | None:
    """(x,y,w,h) RELATIF ke `gray_region`, atau None. minNeighbors dibiarkan
    di bawaan (bukan dinaikkan) karena area pencariannya sudah dibatasi ke
    sekitar kotak kasar -- pembatas area itu sendiri yang menyaring
    kebanyakan salah-tangkap, tidak perlu parameter super ketat yang justru
    bikin wajah asli ikut tidak terdeteksi (persis yang terjadi sebelum ini
    diperbaiki: minNeighbors dinaikkan ke 7 untuk cari di SELURUH frame,
    hasilnya wajah asli pun ikut lolos-tak-terdeteksi)."""
    faces = _load_face_detector().detectMultiScale(
        gray_region, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) == 0:
        return None
    # Wajah TERBESAR di area yang sudah dipersempit ke sekitar satu orang
    # -- bukan pusat-terdekat lagi, karena areanya sendiri sudah jadi
    # penyaring "orang yang mana". Wajah terbesar = yang paling dekat ke
    # kamera / paling jelas, biasanya memang orang yang dimaksud.
    besar_cukup = [f for f in faces if f[2] >= rw * 0.15]
    if not besar_cukup:
        return None
    return max(besar_cukup, key=lambda f: f[2] * f[3])


def _cari_orang(bgr_region) -> tuple | None:
    """Cadangan kalau wajah tidak ketemu -- HOG+SVM deteksi badan/orang.
    Dilatih untuk pejalan kaki berdiri penuh badan, jadi untuk podcast
    duduk hasilnya kasar (biasanya lebih lebar dari badan sungguhan) --
    tetap lebih baik daripada kotak kasar statis yang mungkin sudah
    meleset dari orangnya."""
    hog = _load_hog_detector()
    rects, weights = hog.detectMultiScale(bgr_region, winStride=(8, 8))
    if len(rects) == 0:
        return None
    # Yang skornya paling tinggi (paling yakin), bukan yang pertama.
    idx = max(range(len(rects)), key=lambda i: weights[i])
    return tuple(rects[idx])


def fit_crop_to_face(video: Path, at: float, rough: dict) -> dict | None:
    """Cari wajah (lalu, kalau gagal, badan orang) DI SEKITAR kotak KASAR
    `rough` ({left,top,width,height} dalam persen frame), kembalikan kotak
    baru yang dipusatkan ke situ -- juga dalam persen, BELUM dikunci rasio
    (client mengunci rasionya sendiri lewat samakanRasio, sama seperti
    kotak yang digeser manual). None kalau dua-duanya gagal."""
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

        rx = (rough.get("left", 0) / 100) * W
        ry = (rough.get("top", 0) / 100) * H
        rw = (rough.get("width", 100) / 100) * W
        rh = (rough.get("height", 100) / 100) * H

        # Area pencarian = kotak kasar DILEBARKAN, bukan pas-pasan --
        # geseran manual ian bisa sedikit meleset dari wajah sungguhan
        # (itu justru alasan fitur ini ada), jadi ruang ekstra di semua
        # sisi supaya wajah yang sedikit di luar kotak kasar tetap
        # kejangkau. Inilah perbaikan UTAMA dibanding versi sebelumnya
        # (yang mencari di SELURUH frame lalu menyaring lewat jarak-ke-
        # pusat -- gampang salah pilih kalau ada wajah/tekstur lain yang
        # kebetulan lebih dekat ke pusat kotak).
        pad_x, pad_y = rw * 0.4, rh * 0.4
        sx = int(max(0, rx - pad_x))
        sy = int(max(0, ry - pad_y))
        ex = int(min(W, rx + rw + pad_x))
        ey = int(min(H, ry + rh + pad_y))
        if ex <= sx or ey <= sy:
            return None
        region = img[sy:ey, sx:ex]
        gray_region = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

        found = _cari_wajah(gray_region, rw)
        if found is not None:
            fx, fy, fw, fh = found
            # Wajah + ruang lebih di ATAS (rambut/topi) dan di BAWAH
            # (bahu) -- kotak pas-pasan di tepi wajah bikin kepala
            # kepotong begitu rasio dikunci ulang di client
            # (samakanRasio menyesuaikan LEBAR mengikuti rasio target,
            # tinggi yang pas-pasan jadi terlalu pendek untuk lebar
            # barunya).
            margin_x, margin_atas, margin_bawah = fw * 0.6, fh * 0.9, fh * 1.4
        else:
            found = _cari_orang(region)
            if found is None:
                return None
            fx, fy, fw, fh = found
            # Kotak HOG sudah mencakup badan -- tidak perlu margin
            # tambahan sebesar wajah, cukup sedikit napas di semua sisi.
            margin_x, margin_atas, margin_bawah = fw * 0.1, fh * 0.05, fh * 0.05

        # Balik dari koordinat REGION ke koordinat FRAME UTUH.
        fx, fy = fx + sx, fy + sy

        left = max(0, fx - margin_x)
        top = max(0, fy - margin_atas)
        width = min(W - left, fw + margin_x * 2)
        height = min(H - top, fh + margin_atas + margin_bawah)

        # Jaring pengaman terakhir: kotak akhir yang jauh lebih sempit
        # dari kotak kasarnya berarti ada yang salah di sepanjang
        # perhitungan di atas. Lebih aman mengaku tidak ketemu daripada
        # mengembalikan kotak yang jelas rusak.
        if width < rw * 0.25:
            return None

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
