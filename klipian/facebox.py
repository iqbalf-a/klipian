"""Deteksi wajah/orang untuk merapatkan kotak crop -- pelengkap AI Framing.

Diarization (diarize.py) tahu KAPAN harus ganti frame. Modul ini menjawab
pertanyaan yang beda: KE MANA persis kotaknya harus diarahkan. Tanpa ini,
tiap titik framing yang dibuat AI Framing cuma salinan MENTAH dari posisi
yang digeser manual sekali di awal klip -- kalau geseran awalnya kurang pas,
atau orangnya sedikit bergerak di kursi sepanjang klip, hasilnya bisa
memotong wajah atau menyorot kursi kosong di sebelahnya. Modul ini
memeriksa ULANG posisi wajah sungguhan di SETIAP titik, bukan percaya begitu
saja pada satu koordinat statis untuk seluruh klip.

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
# fit_crop_to_face menjawab SATU titik. track_crops menjawab SATU RENTANG:
# subjek dilacak sepanjang giliran, dan tiap kali dia bergeser cukup jauh
# (melewati deadzone) DAN bertahan cukup lama, sebuah titik framing BARU
# dikeluarkan -- caller menaruhnya sebagai potongan (Span) baru. Ini bukan
# pan kontinu; ini keputusan "kapan potong keras", sejalan dengan prinsip
# framing klipian. Logika lock/tahan diadaptasi dari smart_crop, tapi
# keluarannya diskret (deret titik), bukan geseran per-frame.


def track_crops(video: Path, start: float, end: float, rough: dict,
                fps: int = 3, min_chunk: float = 1.2,
                deadzone_frac: float = 0.12) -> list[dict]:
    """Lacak wajah aktif sepanjang [start, end) -> daftar {at, crop}.

    Selalu ada minimal satu titik (di `start`). Titik tambahan muncul hanya
    saat subjek bergeser > deadzone_frac*lebar-sumber dari pusat titik
    terakhir DAN sudah bertahan >= min_chunk detik -- peredam ini yang mencegah
    jitter bikin klip kedap-kedip. Kalau tidak ada wajah sama sekali,
    kembalikan satu titik memakai kotak kasar apa adanya (caller jatuh ke situ,
    persis perilaku fit_crop_to_face yang mengembalikan None)."""
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
        centers: list[tuple] = []   # (t, cx_or_None, face_or_None)
        prev_gray = None
        locked_cx = rw / 2          # region-coord; ~ pusat kotak kasar di awal
        for i, p in enumerate(files):
            img = cv2.imread(str(p))
            if img is None:
                centers.append((start + i / fps, None, None))
                continue
            region = img[sy:ey, sx:ex]
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
            faces = _detect_faces(gray, rw)
            grays = [prev_gray, gray] if prev_gray is not None else [gray]
            chosen = _pick_active_face(faces, grays, len(grays) - 1, locked_cx)
            if chosen is not None:
                locked_cx = chosen["cx"]                       # region-coord
                fx, fy, fw, fh = chosen["bbox"]
                centers.append((start + i / fps, fx + sx + fw / 2, chosen))
            else:
                centers.append((start + i / fps, None, None))
            prev_gray = gray

    return _segments_from_centers(centers, start, rough, W, H, rw, rh,
                                  fps, min_chunk, deadzone_frac)


def _segments_from_centers(centers, start, rough, W, H, rw, rh,
                           fps, min_chunk, deadzone_frac) -> list[dict]:
    """Deret pusat-x per sampel -> deret titik framing diskret. Titik baru
    dikeluarkan saat pusat bergeser > deadzone dari titik terakhir DAN sudah
    bertahan >= min_chunk detik. Sampel tanpa wajah (cx None) di-skip: posisi
    ditahan, umur-tahan direset supaya wajah yang muncul lagi harus bertahan
    ulang sebelum memicu potongan (meniru smart_crop yang menahan posisi saat
    deteksi hilang)."""
    min_hold = max(2, int(round(fps * min_chunk)))
    deadzone = W * deadzone_frac

    # Titik pertama: pusat wajah pertama yang ketemu; kalau tak ada sama
    # sekali, kotak kasar apa adanya.
    first = next((c for c in centers if c[1] is not None), None)
    if first is None:
        return [{"at": start, "crop": dict(rough)}]

    def crop_at(cx: float) -> dict:
        # x mengikuti wajah; y/tinggi/lebar ikut kotak kasar. Melacak x saja
        # (seperti smart_crop) menjaga sumbu vertikal stabil -- wajah duduk
        # nyaris tidak naik-turun, dan menahannya menghindari getar tegak.
        left = max(0, min(W - rw, cx - rw / 2))
        return {
            "left": round(float(left) / W * 100, 2),
            "top": float(rough.get("top", 4)),
            "width": round(float(rw) / W * 100, 2),
            "height": round(float(rh) / H * 100, 2),
        }

    points = [{"at": start, "crop": crop_at(first[1])}]
    seg_cx = first[1]
    age = 0
    for (t, cx, _face) in centers:
        if cx is None:
            age = 0
            continue
        if abs(cx - seg_cx) > deadzone and age >= min_hold:
            points.append({"at": round(t, 3), "crop": crop_at(cx)})
            seg_cx = cx
            age = 0
        else:
            age += 1
    return points
