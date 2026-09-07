"""Deteksi wajah/orang untuk merapatkan kotak crop -- pelengkap AI Framing.

Diarization (diarize.py) tahu KAPAN harus ganti frame. Modul ini menjawab
pertanyaan yang beda: KE MANA persis kotaknya harus diarahkan -- tiga cara,
tiap satu butuh petunjuk posisi awal yang berbeda:

  - fit_crop_to_face()  -- SATU titik, DI SEKITAR kotak kasar yang diketahui
  - track_crops()       -- SATU RENTANG, DI SEKITAR kotak kasar yang diketahui
  - locate_speaker()    -- SATU RENTANG, TANPA kotak kasar sama sekali
    (mencari dari nol di hampir seluruh frame -- dipakai supaya AI Framing
    bisa sepenuhnya otomatis, tanpa konfirmasi manual per pembicara)

Tanpa fit_crop_to_face/track_crops, tiap titik framing yang dibuat AI
Framing cuma salinan MENTAH dari posisi yang digeser manual sekali di awal
klip -- kalau geseran awalnya kurang pas, atau orangnya sedikit bergerak di
kursi sepanjang klip, hasilnya bisa memotong wajah atau menyorot kursi
kosong di sebelahnya. Keduanya memeriksa ULANG posisi wajah sungguhan di
SETIAP titik, bukan percaya begitu saja pada satu koordinat statis.

Semua klasik OpenCV -- BUKAN model deep learning, tidak nambah beban PyTorch
yang sudah dipakai diarization, tidak perlu unduh bobot terpisah dari mana
pun:

  1. Haar cascade wajah FRONTAL + PROFIL (dua arah lewat cv2.flip), dicari
     HANYA di sekitar kotak kasar (bukan seluruh frame) -- membatasi area
     pencarian sendirian sudah menyaring banyak salah-tangkap tanpa perlu
     parameter super ketat. Profil ditambahkan supaya pembicara yang
     kepalanya menoleh (sering di podcast dua orang saling hadap) tetap
     ketangkap; frontal-saja melewatkannya.
  2. Kalau ADA lebih dari satu wajah di area itu (dua orang duduk
     berdekatan), yang dipilih BUKAN yang terbesar melainkan yang MULUTNYA
     BERGERAK -- itulah yang sedang bicara. Diukur dari beda antar-frame di
     region mulut, dibobot gradien Sobel supaya gerak bibir/rahang menonjol
     di atas noise latar. Ide ini dari referensi smart_crop; di sini
     dipakai untuk memilih ORANG YANG BENAR, bukan untuk pan kontinu --
     klipian tetap potong keras.
  3. Kalau wajah tidak ketemu sama sekali: HOG+SVM deteksi ORANG (bawaan
     OpenCV, tanpa unduhan) sebagai cadangan -- kurang presisi (dilatih
     untuk pejalan kaki berdiri, bukan podcast duduk), tapi lebih baik
     daripada kotak kasar mentah kalau memang ketemu.
  4. Semua gagal -> None, caller jatuh ke kotak kasar apa adanya.

Laporan nyata sebelum modul ini ditulis ulang: mencari di SELURUH frame
dengan parameter longgar sesekali salah tangkap tekstur (rambut, motif
kain) sebagai "wajah" kecil, dan kotak yang dihasilkan MENIMPA titik yang
tadinya benar -- bukan cuma gagal diam-diam. Membatasi area pencarian ke
sekitar kotak kasar adalah perbaikan utamanya; filter ukuran, NMS, dan
pemilihan-lewat-gerak-mulut di bawah ini lapisan berikutnya.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

_face_detector = None
_profile_detector = None
_hog_detector = None


def _load_face_detector():
    global _face_detector
    if _face_detector is not None:
        return _face_detector
    import cv2
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    _face_detector = cv2.CascadeClassifier(cascade_path)
    return _face_detector


def _load_profile_detector():
    """Cascade wajah PROFIL (menghadap samping). Dipakai dua arah: apa adanya
    untuk yang menghadap satu sisi, lalu pada frame yang di-flip untuk sisi
    lawannya (cascade profil OpenCV cuma dilatih satu arah). Bisa saja tidak
    ada di build OpenCV tertentu -> _detect_faces mengabaikannya kalau empty."""
    global _profile_detector
    if _profile_detector is not None:
        return _profile_detector
    import cv2
    _profile_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_profileface.xml")
    return _profile_detector


def _load_hog_detector():
    global _hog_detector
    if _hog_detector is not None:
        return _hog_detector
    import cv2
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    _hog_detector = hog
    return _hog_detector


def _nms(boxes: list, iou_thr: float = 0.35) -> list:
    """Buang deteksi kembar (frontal & profil sering menandai wajah yang sama).
    Yang berarea terbesar dipertahankan lebih dulu."""
    if len(boxes) <= 1:
        return boxes
    import numpy as np
    b = np.array(boxes, dtype=float)
    x1, y1 = b[:, 0], b[:, 1]
    x2, y2 = b[:, 0] + b[:, 2], b[:, 1] + b[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = areas.argsort()[::-1]
    keep = []
    while len(order):
        i = order[0]
        keep.append(int(i))
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        order = order[1:][iou < iou_thr]
    return [boxes[k] for k in keep]


def _detect_faces(gray_region, rw: float) -> list[dict]:
    """Semua wajah DI DALAM `gray_region` -> daftar
    {cx, bbox:(x,y,w,h), mouth:(x,y,w,h)} dalam koordinat REGION.

    Frontal + profil (dua arah). minNeighbors dibiarkan di 5 (bukan dinaikkan)
    karena area pencariannya sudah dibatasi ke sekitar kotak kasar -- pembatas
    area itu sendiri yang menyaring kebanyakan salah-tangkap. `mouth` = 30%
    bawah bbox wajah; dipakai untuk skor gerak-mulut di _pick_active_face.
    Disaring ukuran (>= rw*0.15) sama seperti versi lama supaya tekstur kecil
    tidak lolos."""
    import cv2
    kw = dict(scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    raw: list[tuple] = []

    front = _load_face_detector()
    for (x, y, w, h) in front.detectMultiScale(gray_region, **kw):
        raw.append((int(x), int(y), int(w), int(h)))

    prof = _load_profile_detector()
    if prof is not None and not prof.empty():
        for (x, y, w, h) in prof.detectMultiScale(gray_region, **kw):
            raw.append((int(x), int(y), int(w), int(h)))
        W = gray_region.shape[1]
        flipped = cv2.flip(gray_region, 1)
        for (x, y, w, h) in prof.detectMultiScale(flipped, **kw):
            # Menghadap sisi lawan: deteksi di frame yang di-flip, lalu cermin
            # x-nya balik ke koordinat region asli.
            raw.append((W - int(x) - int(w), int(y), int(w), int(h)))

    if not raw:
        return []

    faces = []
    for (x, y, w, h) in _nms(raw):
        if w < rw * 0.15:
            continue
        my = y + int(h * 0.65)
        mh = max(8, int(h * 0.30))
        faces.append({"cx": x + w // 2, "bbox": (x, y, w, h),
                      "mouth": (x, my, w, mh)})
    return faces


def _mouth_motion(gray_curr, gray_prev, mouth: tuple) -> float:
    """Seberapa banyak region mulut BERGERAK antara dua frame. Diff mentah
    dibobot magnitudo gradien Sobel: gerak di tepi bibir/rahang diperkuat,
    noise latar yang datar ditekan. x-gradien menangkap geser rahang (profil),
    y-gradien menangkap buka-tutup bibir (frontal). Port dari smart_crop."""
    import cv2
    import numpy as np
    mx, my, mw, mh = mouth
    if mw <= 0 or mh <= 0:
        return 0.0
    c = gray_curr[my:my + mh, mx:mx + mw]
    p = gray_prev[my:my + mh, mx:mx + mw]
    if c.size == 0 or c.shape != p.shape:
        return 0.0
    diff = cv2.absdiff(c, p).astype(np.float32)
    gx = cv2.Sobel(c, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(c, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx * gx + gy * gy)
    mean_grad = float(grad_mag.mean())
    if mean_grad > 1.0:
        weight = np.clip(grad_mag / (mean_grad + 1e-6), 0.5, 2.5)
        return float((diff * weight).mean())
    return float(diff.mean())


def _sharpness(gray, bbox: tuple) -> float:
    import cv2
    x, y, w, h = bbox
    roi = gray[y:y + h, x:x + w]
    if roi.size == 0:
        return 0.0
    return float(cv2.Laplacian(roi, cv2.CV_64F).var())


def _pick_active_face(faces: list[dict], grays: list, ref_idx: int,
                       locked_cx: float | None) -> dict | None:
    """Dari beberapa wajah di region, pilih yang SEDANG BICARA.

    Prioritas: pemenang gerak-mulut yang jelas -> wajah terdekat ke posisi
    yang sedang dilacak (kontinuitas) -> wajah paling tajam (hanya kalau belum
    ada yang dilacak). `grays` beberapa frame region beruntun; gerak mulut
    dijumlahkan lintas pasangan supaya fase mulut (kebetulan tertutup di satu
    frame) tidak menipu. Port logika dari smart_crop.pick_speaker_cx, tapi
    mengembalikan WAJAHnya (butuh bbox untuk memusatkan kotak), bukan cx saja."""
    if not faces:
        return None
    if len(faces) == 1:
        return faces[0]

    if len(grays) >= 2:
        scored = []
        for f in faces:
            total, pairs = 0.0, 0
            for i in range(1, len(grays)):
                if grays[i].shape == grays[i - 1].shape:
                    total += _mouth_motion(grays[i], grays[i - 1], f["mouth"])
                    pairs += 1
            scored.append((f, total / pairs if pairs else 0.0))
        best, best_score = max(scored, key=lambda t: t[1])
        rest_avg = (sum(s for _, s in scored) - best_score) / (len(scored) - 1)
        # Ambang sama seperti smart_crop: pemenang harus jelas (>1.0) DAN jauh
        # lebih tinggi dari rata-rata sisanya (2x), kalau tidak dianggap ambigu.
        if best_score > 1.0 and best_score > rest_avg * 2.0:
            return best

    # Sinyal gerak ambigu (dua orang sama-sama diam atau sama-sama bergerak):
    # tetap ke yang paling dekat posisi terlacak, jangan menebak. Inilah niat
    # facebox versi lama juga -- "wajah terdekat kotak kasar" -- cuma sekarang
    # gerak-mulut mendapat kesempatan pertama sebelum jatuh ke sini.
    if locked_cx is not None:
        return min(faces, key=lambda f: abs(f["cx"] - locked_cx))

    return max(faces, key=lambda f: _sharpness(grays[ref_idx], f["bbox"]))


def _region_rect(rough: dict, W: int, H: int, pad: float = 0.4) -> tuple:
    """Kotak kasar (persen) -> rect pencarian piksel (sx,sy,ex,ey), DILEBARKAN
    `pad` di tiap sisi. Geseran manual bisa sedikit meleset dari wajah
    sungguhan (justru alasan fitur ini ada), jadi ruang ekstra supaya wajah
    yang sedikit di luar kotak kasar tetap kejangkau."""
    rx = (rough.get("left", 0) / 100) * W
    ry = (rough.get("top", 0) / 100) * H
    rw = (rough.get("width", 100) / 100) * W
    rh = (rough.get("height", 100) / 100) * H
    pad_x, pad_y = rw * pad, rh * pad
    sx = int(max(0, rx - pad_x))
    sy = int(max(0, ry - pad_y))
    ex = int(min(W, rx + rw + pad_x))
    ey = int(min(H, ry + rh + pad_y))
    return sx, sy, ex, ey, rw, rh


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
    idx = max(range(len(rects)), key=lambda i: float(weights[i]))
    return tuple(rects[idx])


def _extract_frames(video: Path, at: float, tmp: str,
                    span: float = 0.4, fps: int = 10) -> list:
    """Ambil beberapa frame BGR di sekitar `at` (perlu >=2 untuk diff gerak
    mulut). Satu panggilan ffmpeg dengan filter fps, bukan banyak -ss, supaya
    ongkos spawn proses tetap satu seperti versi lama yang cuma ambil 1 frame.
    Kembalikan daftar (t_relatif_ke_video, img_bgr) terurut waktu."""
    import cv2

    from .ffmpeg_tools import _require, run

    t0 = max(0.0, at - span / 2)
    run([
        _require("ffmpeg"), "-y", "-loglevel", "error",
        "-ss", f"{t0:.3f}", "-i", str(video),
        "-t", f"{span:.3f}", "-vf", f"fps={fps}",
        str(Path(tmp) / "f_%03d.jpg"),
    ], desc="mengambil frame untuk deteksi wajah")

    frames = []
    for i, p in enumerate(sorted(Path(tmp).glob("f_*.jpg"))):
        img = cv2.imread(str(p))
        if img is not None:
            frames.append((t0 + i / fps, img))
    return frames


def _place_box(fcx: float, fcy: float, width: float, height: float,
               W: int, H: int) -> dict:
    """Pusat wajah (piksel) + ukuran kotak kasar (piksel) -> kotak crop dalam
    PERSEN frame, dijepit ke dalam frame. Ukuran SAMA PERSIS dengan kotak
    kasar -- deteksi cuma menggeser POSISI, bukan menentukan zoom (itu
    keputusan ian lewat kotak kasarnya sendiri)."""
    left = max(0, min(W - width, fcx - width / 2))
    top = max(0, min(H - height, fcy - height / 2))
    # float() eksplisit: OpenCV mengembalikan np.float64/np.int32, dan json
    # bawaan tidak tahu cara menulis tipe numpy -> endpoint pecah dengan
    # "Object of type float64 is not JSON serializable" tanpa ini.
    return {
        "left": round(float(left) / W * 100, 2),
        "top": round(float(top) / H * 100, 2),
        "width": round(float(width) / W * 100, 2),
        "height": round(float(height) / H * 100, 2),
    }


def fit_crop_to_face(video: Path, at: float, rough: dict) -> dict | None:
    """Cari wajah PALING AKTIF (lalu, kalau gagal, badan orang) DI SEKITAR
    kotak KASAR `rough` ({left,top,width,height} persen), kembalikan kotak
    baru yang dipusatkan ke situ -- juga persen, BELUM dikunci rasio (client
    mengunci rasionya sendiri lewat samakanRasio). None kalau semua gagal."""
    import cv2

    from .ffmpeg_tools import probe

    info = probe(video)
    W, H = info.width, info.height
    if not W or not H:
        return None

    with tempfile.TemporaryDirectory(prefix="klipian-face-") as tmp:
        frames = _extract_frames(video, at, tmp)
        if not frames:
            return None

        sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H)
        if ex <= sx or ey <= sy:
            return None

        # Frame acuan = yang paling dekat ke `at`; deteksi dijalankan di situ,
        # frame lain cuma dipakai untuk mengukur gerak mulut.
        ref_idx = min(range(len(frames)), key=lambda i: abs(frames[i][0] - at))
        grays = [cv2.cvtColor(img[sy:ey, sx:ex], cv2.COLOR_BGR2GRAY)
                 for _, img in frames]

        faces = _detect_faces(grays[ref_idx], rw)
        chosen = _pick_active_face(faces, grays, ref_idx,
                                   locked_cx=(rw / 2))  # pusat region ~ kotak kasar
        if chosen is not None:
            fx, fy, fw, fh = chosen["bbox"]
        else:
            found = _cari_orang(frames[ref_idx][1][sy:ey, sx:ex])
            if found is None:
                return None
            fx, fy, fw, fh = found

        # REGION -> FRAME UTUH, lalu titik tengahnya.
        fcx = fx + sx + fw / 2
        fcy = fy + sy + fh / 2
        return _place_box(fcx, fcy, rw, rh, W, H)


# ══════════════════════════════ pelacakan ══════════════════════════════
# fit_crop_to_face menjawab SATU titik. track_crops juga menjawab SATU
# titik -- tapi lebih tahan-noise, karena posisinya median dari BANYAK
# sampel di sepanjang [start, end), bukan satu frame saja.
#
# Sebelumnya fungsi ini juga bisa mengeluarkan titik TAMBAHAN sendiri kapan
# pun subjek bergeser cukup jauh (deadzone) dan bertahan cukup lama
# (min_chunk) -- niatnya mengikuti orang yang pindah tempat duduk di
# giliran panjang. Praktiknya, orang bicara wajar bergerak (menoleh,
# condong ke depan) TANPA video sumbernya sendiri berganti shot atau
# pembicaranya berganti -- dan karena klipian potong KERAS (bukan pan
# kontinu, lihat catatan style di atas), titik tambahan dari gerak biasa
# begini kelihatan seperti kesalahan framing di preview/hasil render,
# bukan koreksi yang membantu (laporan nyata dari ian: "targetnya masih
# orang yang sama... harusnya diam saja").
#
# SATU-SATUNYA alasan sah untuk titik framing baru sekarang datang dari
# PEMANGGIL (aiFramingTerapkan di framing.js): giliran bicara berganti,
# atau video sumber sendiri ganti shot (klipian/scenecut.py). Titik ini
# TIDAK lagi menebak sendiri kapan harus memecah -- cukup satu posisi yang
# mewakili SELURUH rentang yang diberikan.


def track_crops(video: Path, start: float, end: float, rough: dict,
                fps: int = 3) -> list[dict]:
    """Posisi wajah aktif yang mewakili SELURUH [start, end) -> satu
    {at: start, crop}. Diambil dari MEDIAN posisi di banyak sampel
    (bukan cuma satu frame) -- median tahan terhadap outlier sesaat
    (kepala menoleh penuh sedetik, salah tangkap wajah sekali sampel),
    beda dari rata-rata yang bisa tertarik jauh oleh satu sampel aneh.

    Kalau tidak ada wajah sama sekali di sepanjang rentang, kembalikan
    kotak kasar apa adanya (caller jatuh ke situ, persis perilaku
    fit_crop_to_face yang mengembalikan None)."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return [{"at": start, "crop": dict(rough)}]

    # Region pelacakan dilebarkan lebih longgar dari fit_crop_to_face (0.6):
    # dalam satu giliran orangnya bisa bergeser di kursi lebih jauh dari sekali
    # geser manual, dan kita ingin tetap mengejarnya, bukan kehilangan di tepi.
    sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H, pad=0.6)
    if ex <= sx or ey <= sy:
        return [{"at": start, "crop": dict(rough)}]

    with tempfile.TemporaryDirectory(prefix="klipian-track-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "t_%04d.jpg"),
        ], desc="mengambil frame untuk pelacakan wajah")

        files = sorted(Path(tmp).glob("t_*.jpg"))
        if not files:
            return [{"at": start, "crop": dict(rough)}]

        # Pusat-x subjek aktif per sampel (piksel FRAME), None kalau tak ada
        # wajah di frame itu. prev_gray bergulir supaya gerak mulut bisa
        # diukur tanpa menyimpan semua frame sekaligus.
        cx_list: list[float] = []
        prev_gray = None
        locked_cx = rw / 2          # region-coord; ~ pusat kotak kasar di awal
        for p in files:
            img = cv2.imread(str(p))
            if img is None:
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]                       # region-coord
                fx, fy, fw, fh = chosen["bbox"]
                cx_list.append(fx + sx + fw / 2)
            prev_gray = gray

    if not cx_list:
        return [{"at": start, "crop": dict(rough)}]

    cx_list.sort()
    median_cx = cx_list[len(cx_list) // 2]

    # x mengikuti wajah; y/tinggi/lebar ikut kotak kasar. Melacak x saja
    # (seperti smart_crop) menjaga sumbu vertikal stabil -- wajah duduk
    # nyaris tidak naik-turun, dan menahannya menghindari getar tegak.
    left = max(0, min(W - rw, median_cx - rw / 2))
    crop = {
        "left": round(float(left) / W * 100, 2),
        "top": float(rough.get("top", 4)),
        "width": round(float(rw) / W * 100, 2),
        "height": round(float(rh) / H * 100, 2),
    }
    return [{"at": start, "crop": crop}]


# ══════════════════════════════ head tracking ══════════════════════════════
# track_crops (di atas) meringkas seluruh [start, end) jadi SATU titik
# median -- cocok untuk AI Framing (satu kotak per giliran, potong keras).
# track_head() beda tujuannya: bukan meringkas, tapi MEMPERTAHANKAN gerakan
# sebagai LINTASAN -- dipakai fitur head tracking yang OPSIONAL per titik
# framing (ian: "berlaku di 1 titik framing saja, tidak keseluruhan, dan
# opsional -- tidak semua titik perlu"). Kotak yang bergerak mengikuti
# kepala DI DALAM satu titik, potong keras tetap terjadi ANTAR titik --
# klipian tidak berubah jadi pan berkelanjutan lintas video.

def track_head(video: Path, start: float, end: float, rough: dict,
               fps: int = 3, smooth_window: int = 5) -> list[dict] | None:
    """Lintasan posisi wajah aktif sepanjang [start, end) -> daftar
    {t, left} terurut waktu (t detik RELATIF ke `start`, left persen posisi
    kotak) -- bukan satu titik median seperti track_crops(), karena di sini
    gerakannya justru yang mau dipertahankan.

    Sampel yang wajahnya tidak ketemu di-skip (bukan diisi placeholder) --
    pemanggil (interpolasi di preview JS, sendcmd di render.py) menyambung
    linear antar keyframe yang valid, jadi kekosongan pendek otomatis
    "diseberangi" dengan mulus, bukan macet.

    Deret cx mentah di-smooth pakai rata-rata bergerak simetris sebelum
    dikembalikan -- deteksi wajah per-frame selalu berjitter dikit, tanpa
    ini kotaknya bergetar alih-alih bergerak mulus.

    None kalau sampel valid < 2 (tidak cukup untuk lintasan) -- pemanggil
    membiarkan titik itu tetap statis, sama seperti sebelum tracking
    dicoba."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return None

    # Region sama longgarnya dengan track_crops (pad=0.6) -- alasan sama:
    # kepala boleh bergerak cukup jauh dari kotak kasar awal.
    sx, sy, ex, ey, rw, rh = _region_rect(rough, W, H, pad=0.6)
    if ex <= sx or ey <= sy:
        return None

    with tempfile.TemporaryDirectory(prefix="klipian-headtrack-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "h_%04d.jpg"),
        ], desc="melacak gerak kepala")

        files = sorted(Path(tmp).glob("h_*.jpg"))
        if not files:
            return None

        # (t relatif ke start, cx piksel FRAME) per sampel yang wajahnya
        # ketemu. prev_gray direset ke None kalau satu frame gagal dibaca,
        # supaya gerak-mulut tidak dihitung lintas jeda yang tidak mulus.
        samples: list[tuple[float, float]] = []
        prev_gray = None
        locked_cx = rw / 2
        for i, p in enumerate(files):
            img = cv2.imread(str(p))
            if img is None:
                prev_gray = None
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]
                fx, fy, fw, fh = chosen["bbox"]
                samples.append((i / fps, fx + sx + fw / 2))
            prev_gray = gray

    if len(samples) < 2:
        return None

    # Rata-rata bergerak simetris, jendela kecil (dijepit di tepi deret) --
    # meredam getar deteksi tanpa menunda gerakan sungguhan terlalu jauh.
    half = smooth_window // 2
    keyframes = []
    for i in range(len(samples)):
        lo, hi = max(0, i - half), min(len(samples), i + half + 1)
        avg_cx = sum(c for _, c in samples[lo:hi]) / (hi - lo)
        left = max(0, min(W - rw, avg_cx - rw / 2))
        keyframes.append({
            "t": round(samples[i][0], 3),
            "left": round(float(left) / W * 100, 2),
        })
    return keyframes


# ══════════════════════════════ pencarian buta ══════════════════════════════
# fit_crop_to_face dan track_crops BUTUH kotak kasar (rough) -- petunjuk
# posisi AWAL untuk membatasi area pencarian, itulah tepatnya yang dulu
# dikonfirmasi manual per pembicara di AI Framing ("geser kotak ke orangnya").
# locate_speaker() TIDAK butuh petunjuk itu -- dipakai supaya AI Framing bisa
# sepenuhnya otomatis, tanpa konfirmasi (ian: podcast tidak selalu 2 orang,
# konfirmasi satu-satu per pembicara jadi tidak praktis).
#
# Risikonya PERSIS yang sudah pernah terjadi dan ditulis di docstring modul
# ini: mencari seluas frame gampang salah tangkap tekstur (rambut, motif
# kain) sebagai wajah kecil. locate_speaker() TIDAK meniru pengamanan
# _pick_active_face apa adanya (yang boleh jatuh ke "wajah paling tajam" saat
# gerak-mulut ambigu) -- di pencarian sebuas ini itu berbahaya, tekstur acak
# bisa "tajam" begitu saja. Sampel yang wajahnya ganda tapi TANPA pemenang
# gerak-mulut yang jelas DIBUANG, bukan ditebak; posisi akhir cuma dari
# sampel yang benar-benar yakin, digabung lewat median lintas seluruh
# giliran bicara -- bukan satu frame.

def locate_speaker(video: Path, start: float, end: float,
                    crop_size: dict, fps: int = 3) -> dict | None:
    """Temukan posisi pembicara aktif di [start, end) TANPA petunjuk posisi
    awal apa pun -- beda dari track_crops() yang melacak DI SEKITAR kotak
    kasar yang sudah diketahui, ini mencari dari NOL di (hampir) seluruh
    frame, dibimbing gerak-mulut lintas beberapa sampel.

    `crop_size` = {width, height} PERSEN -- ukuran kotak KELUARAN, sengaja
    dipisah total dari lebar area pencarian (yang selebar hampir seluruh
    frame) supaya hasilnya tetap potret sempit, bukan selebar area yang
    dipindai. `top`/`left` keluaran dihitung dari pusat wajah yang
    ditemukan, bukan dari `crop_size`.

    None kalau tidak ada satu pun sampel yang lolos syarat gerak-mulut
    (caller jatuh ke kotak bawaan, sama seperti fit_crop_to_face/
    track_crops kalau wajah tidak ketemu)."""
    import cv2

    from .ffmpeg_tools import _require, probe, run

    info = probe(video)
    W, H = info.width, info.height
    dur = max(0.0, end - start)
    if not W or not H or dur <= 0:
        return None

    cw = max(1, (crop_size.get("width", 26) / 100) * W)
    ch = max(1, (crop_size.get("height", 84) / 100) * H)

    # Margin tipis di tepi -- wajah podcast duduk nyaris tidak pernah
    # menempel piksel 0, dan mengecualikan tepi menahan sedikit salah-
    # tangkap di sudut frame (logo studio, watermark).
    margin = 0.03
    sx, sy = int(W * margin), int(H * margin)
    ex, ey = int(W * (1 - margin)), int(H * (1 - margin))
    rw_scan = ex - sx   # lebar area PENCARIAN -- bukan lebar kotak keluaran

    with tempfile.TemporaryDirectory(prefix="klipian-locate-") as tmp:
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-i", str(video),
            "-t", f"{dur:.3f}", "-vf", f"fps={fps}",
            str(Path(tmp) / "l_%04d.jpg"),
        ], desc="mencari pembicara aktif")

        files = sorted(Path(tmp).glob("l_*.jpg"))
        if not files:
            return None

        kandidat: list[tuple[float, float]] = []   # (cx, cy) piksel FRAME, per sampel yang lolos
        prev_gray = None
        for p in files:
            img = cv2.imread(str(p))
            if img is None:
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw_scan)
            if not faces:
                prev_gray = gray
                continue
            if len(faces) == 1:
                fx, fy, fw, fh = faces[0]["bbox"]
                kandidat.append((fx + sx + fw / 2, fy + sy + fh / 2))
            elif prev_gray is not None and prev_gray.shape == gray.shape:
                # >1 wajah: WAJIB pemenang gerak-mulut jelas. Tidak ada
                # fallback "paling tajam" seperti _pick_active_face biasa --
                # lihat alasan di komentar modul di atas.
                scored = [(f, _mouth_motion(gray, prev_gray, f["mouth"])) for f in faces]
                best, best_score = max(scored, key=lambda s: s[1])
                rest_avg = (sum(s for _, s in scored) - best_score) / (len(scored) - 1)
                if best_score > 1.0 and best_score > rest_avg * 2.0:
                    fx, fy, fw, fh = best["bbox"]
                    kandidat.append((fx + sx + fw / 2, fy + sy + fh / 2))
            prev_gray = gray

    if not kandidat:
        return None

    cx_med = sorted(c[0] for c in kandidat)[len(kandidat) // 2]
    cy_med = sorted(c[1] for c in kandidat)[len(kandidat) // 2]
    return _place_box(cx_med, cy_med, cw, ch, W, H)
