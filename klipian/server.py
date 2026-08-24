"""Server lokal — yang membuat tombol Render di UI benar-benar menghasilkan MP4.

Halaman statis tidak bisa menjalankan ffmpeg. Selama UI cuma dilayani
`http.server`, tombol Render tidak punya apa pun untuk dipanggil, dan
progress yang ditampilkannya bohong. Berkas ini menutup lubang itu.

Sengaja memakai pustaka bawaan Python, bukan FastAPI: klipian menjaga
instalasinya tetap ringan, dan untuk satu pengguna di satu mesin
ThreadingHTTPServer sudah lebih dari cukup.

    klipian serve            ->  http://127.0.0.1:5177

Terikat ke 127.0.0.1 saja. Server ini membuka Explorer dan menjalankan
ffmpeg atas permintaan HTTP; itu aman untuk alat lokal, tapi tidak boleh
terjangkau dari jaringan.
"""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from .cache import Cache
from .models import Transcript
from . import render as engine

ROOT = Path(__file__).resolve().parent.parent
SERVED_DIRS = ("ui", "cache", "out", "prompts", "samples")   # folder yang dilayani

# pekerjaan render yang sedang / sudah berjalan
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
# video -> id job transkripsi yang sedang berjalan, supaya tidak ada dua job
# untuk berkas yang sama: yang selesai duluan menghapus wav sementara yang
# masih dipakai yang lain
ACTIVE_TRANSCRIBES: dict[str, str] = {}
MAX_JOBS = 100  # batas entries di TUGAS supaya tidak memory leak


def _prune_jobs():
    """Buang entry yang sudah selesai/gagal kalau terlalu banyak."""
    with LOCK:
        if len(JOBS) <= MAX_JOBS:
            return
        done = [k for k, v in JOBS.items()
                   if v.get("state") in ("done", "failed")]
        # Buang separuh yang paling lama (entry terawal = paling lama)
        for k in done[:len(done) // 2]:
            JOBS.pop(k, None)


# --------------------------------------------------------------------------
# pekerjaan render
# --------------------------------------------------------------------------

def _on_battery() -> bool:
    """Transkripsi di baterai bisa dua kali lebih lambat -- Intel membatasi
    daya CPU, dan Whisper beban yang paling terasa terkena. Lebih baik
    pengguna tahu sebelum menunggu 40 menit."""
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        class S(ctypes.Structure):
            _fields_ = [("ACLineStatus", ctypes.c_byte), ("BatteryFlag", ctypes.c_byte),
                        ("BatteryLifePercent", ctypes.c_byte), ("Reserved1", ctypes.c_byte),
                        ("BatteryLifeTime", ctypes.c_ulong), ("BatteryFullLifeTime", ctypes.c_ulong)]
        st = S()
        if ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.pointer(st)):
            return st.ACLineStatus == 0
    except Exception:                              # noqa: BLE001
        pass
    return False


def _find_video(name: str) -> Path | None:
    """Browser tidak memberi jalur lengkap, hanya nama berkas. Cari di folder
    yang dijangkau server."""
    # Cegah path traversal: hanya terima nama berkas tanpa direktori
    if "/" in name or "\\" in name or ".." in name:
        return None
    for folder in ("samples", "", "out"):
        p = ROOT / folder / name if folder else ROOT / name
        if p.is_file():
            return p
    return None


def _run_render(job_id: str, req: dict) -> None:
    t = JOBS[job_id]
    try:
        video = _find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} tidak ada di folder yang dijangkau server. "
                f"Taruh berkasnya di samples/.")

        # transkrip dipakai untuk caption; boleh tidak ada
        words = []
        try:
            cache = Cache(ROOT / "cache")
            path = cache.transcript_path(video, "large-v3-turbo", "id")
            if path.exists():
                words = Transcript.load(path).words
        except Exception:
            pass

        from .ffmpeg_tools import probe
        info = probe(video)
        out_dir = ROOT / "out" / video.stem
        clips = req["clips"]
        t["total"] = len(clips)

        for i, k in enumerate(clips):
            with LOCK:
                t["current"] = k["title"]
                t["index"] = i

            try:
                spans = [engine.Span(float(p["start"]), float(p["end"]))
                            for p in k.get("spans", [])]
            except (KeyError, TypeError, ValueError):
                raise ValueError(
                    f"Klip \"{k.get('title', '?')}\" tidak punya titik waktu yang sah. "
                    f"Impor ulang hasil Claude, atau buat klip manual.") from None
            if not spans:
                raise ValueError(f"Klip \"{k.get('title', '?')}\" tidak punya potongan.")
            crop = k.get("crop") or {}
            job = engine.RenderJob(
                title=k["title"],
                spans=spans,
                crop=engine.CropBox(
                    left=crop.get("left", 37), top=crop.get("top", 4),
                    width=crop.get("width", 26), height=crop.get("height", 92)),
                layout=k.get("layout", "face"),
                out_width=int(k.get("width", 1080)),
            )
            name = engine.safe_filename(k["title"], f"klip-{i+1}")
            dest = out_dir / name

            engine.render(video, job, dest, words=words,
                         src_width=info.width, src_height=info.height,
                         has_audio=info.has_audio, verbose=False)

            with LOCK:
                t["result"].append({
                    "title": k["title"],
                    "file": name,
                    "url": f"/out/{video.stem}/{name}",
                    "folder": str(out_dir),
                    "mb": round(dest.stat().st_size / 1048576, 1),
                    "duration": round(job.duration, 1),
                })
                t["done"] = i + 1

        with LOCK:
            t["state"] = "done"

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)


def _run_transcribe(job_id: str, req: dict) -> None:
    """Transkripsi sungguhan dengan progress nyata.

    Sebelumnya layar Analisis cuma menganimasikan bar selama 9 detik. Angkanya
    memang diturunkan dari durasi file, tapi tidak ada yang benar-benar
    ditranskripsi -- UI bergantung pada cache yang diisi lewat command.
    """
    t = JOBS[job_id]
    try:
        from .ffmpeg_tools import extract_audio, probe
        from .glossary import Glossary
        from .transcribe import DEFAULT_THREADS, transcribe

        video = _find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} tidak ada di samples/.")

        cache = Cache(ROOT / "cache")
        model = req.get("model", "large-v3-turbo")
        lang = req.get("lang", "id")
        path = cache.transcript_path(video, model, lang)

        info = probe(video)
        with LOCK:
            t["duration"] = info.duration
            t["battery"] = _on_battery()

        if path.exists() and not req.get("force"):
            with LOCK:
                t["state"] = "done"
                t["cached"] = True
                t["file"] = path.name
            return

        with LOCK:
            t["stage"] = "audio"

        # wav diberi akhiran id job: dua job untuk video yang sama tidak
        # saling menghapus berkas sementara milik yang lain
        wav = cache.audio_path(video).with_suffix(f".{job_id}.wav")
        extract_audio(video, wav)
        if not wav.is_file():
            raise FileNotFoundError(
                f"Gagal menyiapkan audio sementara: {wav.name}")

        with LOCK:
            t["stage"] = "transcribe"

        # transcribe() mencetak progress ke stderr; di sini progresnya diambil
        # dari posisi segmen supaya bisa dikirim ke UI
        import faster_whisper
        gloss = Glossary.load(ROOT / "prompts" / "glossary.txt")
        # cpu_threads sengaja diset eksplisit. Bawaan faster-whisper (0)
        # diterjemahkan CTranslate2 jadi 4 thread saja. Diukur di 185H:
        # 8 thread paling cepat; 22 thread justru turun karena E-core ikut
        # dipakai dan menghambat yang lain.
        wm = faster_whisper.WhisperModel(model, device="cpu", compute_type="int8",
                                         cpu_threads=int(req.get("threads", DEFAULT_THREADS)))
        segments_iter, meta = wm.transcribe(
            str(wav), language=lang, beam_size=5, word_timestamps=True,
            vad_filter=True, vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
            initial_prompt=gloss.initial_prompt(lang), hotwords=gloss.hotwords())

        from .models import Segment, Word
        segments = []
        total = meta.duration or info.duration
        for sg in segments_iter:
            segments.append(Segment(
                text=gloss.apply(sg.text), start=round(sg.start, 3), end=round(sg.end, 3),
                words=[Word(text=gloss.apply(w.word), start=round(w.start, 3),
                            end=round(w.end, 3), prob=round(getattr(w, "probability", 1.0), 3))
                       for w in (sg.words or [])]))
            with LOCK:
                t["position"] = sg.end
                t["percent"] = min(100, round(sg.end / total * 100))

        Transcript(source=str(video), duration=total, language=meta.language or lang,
                   model=model, segments=segments).save(path)

        with LOCK:
            t["state"] = "done"
            t["file"] = path.name
            t["percent"] = 100

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        with LOCK:
            ACTIVE_TRANSCRIBES.pop(req.get("video", ""), None)
        try:
            for leftover in (ROOT / "cache").glob(f"*.{job_id}.wav"):
                leftover.unlink(missing_ok=True)       # wav sementara tidak pernah ditinggal
        except Exception:                          # noqa: BLE001
            pass


def _thumbnail(video: Path, seconds: float, crop: dict, width: int) -> Path:
    """Satu frame dari detik klipnya, sudah dipotong 9:16.

    Kartu kandidat harus menampilkan wajah orang saat momen itu terjadi --
    frame generik tidak membantu memilih klip mana yang diambil."""
    from .ffmpeg_tools import _require, probe
    dest = ROOT / "out" / video.stem / "thumbs" /         f"{int(seconds*10)}-{int(crop['left'])}-{int(crop['width'])}-{width}.jpg"
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)

    info = probe(video)
    even = lambda v: max(2, int(v) // 2 * 2)
    cw = even(info.width * crop["width"] / 100)
    ch = even(info.height * crop["height"] / 100)
    cx = even(info.width * crop["left"] / 100)
    cy = even(info.height * crop["top"] / 100)

    result = subprocess.run([
        _require("ffmpeg"), "-y", "-loglevel", "error",
        "-ss", f"{seconds:.2f}", "-i", str(video), "-frames:v", "1",
        "-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={width}:-2",
        "-q:v", "4", str(dest)], capture_output=True)
    if result.returncode != 0:
        # Thumbnail gagal — kembalikan path kosong supaya caller tahu
        return Path()
    return dest


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "klipian"

    def log_message(self, format, *args):          # noqa: A002
        if "/api/" in str(args):                   # diam untuk berkas statis
            sys.stderr.write(f"  {args[0]}\n")

    # ---- util ----

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get("Content-Length", 0))
        MAX_BODY = 10 * 1024 * 1024  # 10 MB — batas body request
        if n > MAX_BODY:
            raise ValueError(f"Body terlalu besar ({n:,} byte, max {MAX_BODY:,})")
        return json.loads(self.rfile.read(n) or b"{}")

    # ---- GET ----

    def do_GET(self):                              # noqa: N802
        path = unquote(urlparse(self.path).path)

        # Salin dulu di dalam lock: thread render menulis dict yang sama, dan
        # json.dumps yang mengiterasinya sambil berubah akan melempar
        # "dictionary changed size during iteration".
        if path.startswith("/api/render/") or path.startswith("/api/transcribe/"):
            with LOCK:
                t = JOBS.get(path.rsplit("/", 1)[-1])
                salinan = dict(t) if t else None
                if salinan and isinstance(salinan.get("result"), list):
                    salinan["result"] = list(salinan["result"])
            return self._send_json(salinan or {"state": "missing"}, 200 if salinan else 404)

        if path == "/api/thumb":
            from urllib.parse import parse_qs
            q = parse_qs(urlparse(self.path).query)
            num = lambda k, d: float(q.get(k, [d])[0])
            video = _find_video(q.get("video", [""])[0])
            if not video:
                return self._send_json({"error": "video tidak ada"}, 404)
            file = _thumbnail(video, num("t", 0),
                                {"left": num("left", 37), "top": num("top", 4),
                                 "width": num("width", 26), "height": num("height", 92)},
                                int(num("w", 132)))
            if not file.is_file():
                return self._send_json({"error": "gagal membuat thumbnail"}, 500)
            data = file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "max-age=3600")
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/api/cache":
            # UI perlu tahu transkrip apa saja yang tersedia. Server ini tidak
            # membuat daftar direktori HTML seperti http.server, jadi
            # disediakan endpoint sendiri.
            file = sorted(p.name for p in (ROOT / "cache").glob("*.transcript.json"))
            return self._send_json({"transcript": file})

        if path == "/api/video":
            file = sorted(p.name for p in (ROOT / "samples").glob("*")
                            if p.suffix.lower() in {".mp4", ".mkv", ".mov", ".webm"})
            return self._send_json({"video": file})

        # "/" dialihkan ke "/ui/" -- BUKAN disajikan langsung, karena
        # index.html memakai path skrip relatif dan akan meleset ke akar.
        # "/ui/" sendiri disajikan sebagai index.html supaya alamatnya bersih.
        if path.rstrip("/") == "":
            self.send_response(302)
            self.send_header("Location", "/ui/")
            self.end_headers()
            return
        if path == "/ui/":
            path = "/ui/index.html"

        # Membuang ".." saja TIDAK cukup di Windows: satu komponen berisi
        # backslash atau huruf drive akan me-reset hasil joinpath, jadi
        # "/ui/C:%5CWindows%5Cwin.ini" tadinya menyajikan berkas sistem.
        # Komponen ditolak kalau mengandung pemisah jalur, lalu hasil akhirnya
        # tetap diperiksa harus berada di dalam ROOT.
        parts = [b for b in path.strip("/").split("/") if b not in ("", ".", "..")]
        if not parts or parts[0] not in SERVED_DIRS:
            return self._send_json({"error": "tidak dilayani"}, 404)
        if any("\\" in b or "/" in b or b == ".." for b in parts):
            return self._send_json({"error": "jalur tidak sah"}, 400)

        file = ROOT.joinpath(*parts)
        try:
            file = file.resolve(strict=True)
        except OSError:
            return self._send_json({"error": f"tidak ada: {path}"}, 404)
        if not file.is_relative_to(ROOT.resolve()):
            return self._send_json({"error": "jalur tidak sah"}, 400)
        if not file.is_file():
            return self._send_json({"error": f"tidak ada: {path}"}, 404)

        mime = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
        return self._send_file(file, mime)

    def _send_file(self, file: Path, mime: str) -> None:
        """Kirim berkas per potongan, dan hormati header Range.

        Dulu seluruh berkas dibaca ke memori lebih dulu -- video sumber 2 GB
        berarti 2 GB RAM untuk satu permintaan. Accept-Ranges juga sudah
        diiklankan padahal Range diabaikan, jadi seek di elemen <video> minta
        potongan yang tidak pernah diberikan.
        """
        size = file.stat().st_size
        start, end = 0, size - 1
        status = 200

        rentang = self.headers.get("Range", "")
        if rentang.startswith("bytes="):
            sisi = rentang[6:].split(",")[0].split("-")
            try:
                if sisi[0].strip():                     # bytes=100-  /  bytes=100-200
                    start = int(sisi[0])
                    if len(sisi) > 1 and sisi[1].strip():
                        end = min(int(sisi[1]), size - 1)
                elif len(sisi) > 1 and sisi[1].strip():  # bytes=-500 (ekor)
                    start = max(0, size - int(sisi[1]))
            except ValueError:
                start, end = 0, size - 1                 # Range ngawur: kirim utuh
            else:
                if start >= size or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                status = 206

        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()

        sisa = end - start + 1
        with file.open("rb") as f:
            f.seek(start)
            while sisa > 0:
                blok = f.read(min(64 * 1024, sisa))
                if not blok:
                    break
                try:
                    self.wfile.write(blok)
                except (BrokenPipeError, ConnectionResetError):
                    return          # pemutar menutup koneksi saat seek -- wajar
                sisa -= len(blok)

    # ---- POST ----

    def do_POST(self):                             # noqa: N802
        path = urlparse(self.path).path

        if path == "/api/render":
            try:
                req = self._read_json()
                if not req.get("clips"):
                    return self._send_json({"error": "tidak ada klip"}, 400)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)

            _prune_jobs()

            job_id = uuid.uuid4().hex[:8]
            JOBS[job_id] = {"state": "running", "done": 0,
                               "total": len(req["clips"]), "index": 0,
                               "current": "", "result": [], "error": None}
            threading.Thread(target=_run_render, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

        if path == "/api/transcribe":
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            name = req.get("video", "")
            _prune_jobs()
            # Seluruh check-then-register di dalam satu lock supaya tidak ada
            # dua thread yang sama-sama lolos dan membuat job ganda.
            with LOCK:
                previous = ACTIVE_TRANSCRIBES.get(name)
                if previous and JOBS.get(previous, {}).get("state") == "running":
                    return self._send_json({"id": previous, "already_running": True})
                job_id = uuid.uuid4().hex[:8]
                ACTIVE_TRANSCRIBES[name] = job_id
            JOBS[job_id] = {"state": "running", "stage": "start", "percent": 0,
                               "position": 0, "duration": 0, "file": None,
                               "cached": False, "error": None}
            threading.Thread(target=_run_transcribe, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

        if path == "/api/open-folder":
            try:
                folder = Path(self._read_json().get("folder", "")).resolve()
                if not folder.is_dir():
                    return self._send_json({"error": "folder tidak ada"}, 404)
                # Cegah path traversal: hanya buka folder di dalam project.
                # Pakai is_relative_to, bukan startswith -- "klipian-lain"
                # berawalan sama dengan "klipian" tapi folder yang berbeda.
                if not folder.is_relative_to(ROOT.resolve()):
                    return self._send_json(
                        {"error": "hanya folder dalam project yang boleh dibuka"}, 403)
                if sys.platform == "win32":
                    os.startfile(folder)           # noqa: S606
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", str(folder)])
                else:
                    subprocess.Popen(["xdg-open", str(folder)])
                return self._send_json({"ok": True})
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)

        self._send_json({"error": "tidak dikenal"}, 404)


def _sweep_temp() -> int:
    """Buang wav sementara yang tertinggal dari job yang terhenti paksa.
    Berkas ini bisa ratusan MB dan tidak ada gunanya setelah servernya mati."""
    n = 0
    for w in (ROOT / "cache").glob("*.wav"):
        try:
            w.unlink()
            n += 1
        except OSError:
            pass
    return n


def serve(port: int = 5177) -> int:
    leftover = _sweep_temp()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("")
    print(f"  klipian  ->  http://127.0.0.1:{port}")
    print(f"  melayani {ROOT}")
    if leftover:
        print(f"  {leftover} berkas audio sementara dibersihkan")
    print("  Ctrl+C untuk berhenti")
    print("")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  berhenti\n")
    return 0
